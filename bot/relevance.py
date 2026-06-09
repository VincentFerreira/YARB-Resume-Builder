"""Relevance evaluation — asks Claude Code to judge whether scraped posts
match the user's interests, rather than relying on naive keyword matching.

Runs the `claude` CLI as a one-shot subprocess (same approach as the old
chat bridge): one batched prompt per scan, asking for a verdict + a short
reason per post. Call `evaluate_posts` from a thread executor — it blocks.
"""
import json
import logging
import os
import re
import subprocess

logger = logging.getLogger(__name__)

CLAUDE_BIN = os.environ.get("CLAUDE_BIN", "/usr/local/bin/claude")
CLAUDE_TIMEOUT = int(os.environ.get("CLAUDE_TIMEOUT", "180"))

TEXT_EXCERPT_LEN = 400
REASON_MAX_LEN = 200

_PROMPT_TEMPLATE = """\
You are filtering a LinkedIn feed for someone interested in: {interests}.

For each post below, decide whether it is genuinely relevant to those interests \
and worth their attention — as opposed to generic feed noise. Also rate how \
strongly it matches their interests on a 0-100 scale. Respond with ONLY a JSON \
array, no prose and no markdown fences, in exactly this shape:
[{{"urn": "<urn>", "relevant": true|false, "score": <0-100>, "reason": "<reason in under 15 words>"}}]

Posts:
{posts}
"""


def _build_prompt(posts: list[dict], interests: list[str]) -> str:
    blocks = []
    for i, post in enumerate(posts, start=1):
        text = post.get("text", "")[:TEXT_EXCERPT_LEN].replace("\n", " ").strip()
        blocks.append(
            f'{i}. urn: {post["urn"]}\n   author: {post.get("author", "?")}\n   text: "{text}"'
        )
    return _PROMPT_TEMPLATE.format(interests=", ".join(interests), posts="\n".join(blocks))


def _extract_json_array(raw: str) -> list[dict]:
    raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    return []


def evaluate_posts(posts: list[dict], interests: list[str]) -> dict[str, dict]:
    """Ask Claude Code to judge each post's relevance to `interests`.

    Returns `{urn: {"relevant": bool, "score": int, "reason": str}}`, only for posts Claude
    actually returned a verdict for. Returns `{}` on any failure — callers
    should treat that as "could not evaluate this time, try again later".
    """
    if not posts:
        return {}

    # No --permission-mode flag: the prompt is pure text-in/text-out (no file
    # reads, no bash, no tool use), so nothing ever needs a permission check —
    # and bypass modes are refused by the CLI when running as root anyway.
    cmd = [
        CLAUDE_BIN, "-p", _build_prompt(posts, interests),
        "--output-format", "json",
    ]

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=CLAUDE_TIMEOUT)
    except FileNotFoundError:
        logger.error("Claude binary not found at %s", CLAUDE_BIN)
        return {}
    except subprocess.TimeoutExpired:
        logger.error("Claude evaluation timed out after %ds", CLAUDE_TIMEOUT)
        return {}

    if proc.returncode != 0:
        logger.error("Claude exited with code %d: %s", proc.returncode, proc.stderr.strip())
        return {}

    try:
        result = json.loads(proc.stdout.strip()).get("result", "")
    except json.JSONDecodeError:
        result = proc.stdout

    return {
        verdict["urn"]: {
            "relevant": bool(verdict.get("relevant")),
            "score": max(0, min(100, int(verdict.get("score", 0) or 0))),
            "reason": str(verdict.get("reason", ""))[:REASON_MAX_LEN],
        }
        for verdict in _extract_json_array(result)
        if isinstance(verdict, dict) and "urn" in verdict
    }
