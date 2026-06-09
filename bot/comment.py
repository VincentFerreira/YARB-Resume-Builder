"""Comment generation — asks Claude to draft 3 comment angles for a LinkedIn post.

Call `generate_comment_variants` from a thread executor — it blocks (subprocess).
"""
import json
import logging
import os
import re
import subprocess

logger = logging.getLogger(__name__)

CLAUDE_BIN = os.environ.get("CLAUDE_BIN", "/usr/local/bin/claude")
CLAUDE_TIMEOUT = int(os.environ.get("CLAUDE_TIMEOUT", "180"))

TEXT_EXCERPT_LEN = 500

_GENERATE_PROMPT = """\
You are a ghostwriter helping a professional leave a genuine, thoughtful LinkedIn comment.

Post author: {author}
Post text: "{text}"
User's interests: {interests}

Generate exactly 3 comment variants, each from a different angle:
- NUANCE: challenge or extend the author's idea with a counter-point
- EXPERIENCE: share a concrete personal story or resource related to the post
- QUESTION: ask an open question that invites dialogue

Requirements:
- Each variant under 280 characters
- Written in first person, professional but conversational, not generic
- Specific to this post's content (no hollow praise)
- Written in the same language as the post

Respond with ONLY a valid JSON array, no markdown fences:
[
  {{"angle": "NUANCE", "label": "① Nuance / Counter-point", "text": "<comment text>"}},
  {{"angle": "EXPERIENCE", "label": "② Personal experience", "text": "<comment text>"}},
  {{"angle": "QUESTION", "label": "③ Opening question", "text": "<comment text>"}}
]
"""

_ADJUST_PROMPT = """\
You are a ghostwriter. Rewrite the 3 LinkedIn comment variants below, applying this instruction: "{instruction}"

Original variants:
{variants_json}

Requirements:
- Keep the same 3 angles (NUANCE, EXPERIENCE, QUESTION) and labels
- Each under 280 characters
- Same language as the originals

Respond with ONLY a valid JSON array, no markdown fences:
[
  {{"angle": "NUANCE", "label": "① Nuance / Counter-point", "text": "<comment text>"}},
  {{"angle": "EXPERIENCE", "label": "② Personal experience", "text": "<comment text>"}},
  {{"angle": "QUESTION", "label": "③ Opening question", "text": "<comment text>"}}
]
"""


def _run_claude(prompt: str) -> list[dict]:
    cmd = [CLAUDE_BIN, "-p", prompt, "--output-format", "json"]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=CLAUDE_TIMEOUT)
    except FileNotFoundError:
        logger.error("Claude binary not found at %s", CLAUDE_BIN)
        return []
    except subprocess.TimeoutExpired:
        logger.error("Comment generation timed out after %ds", CLAUDE_TIMEOUT)
        return []

    if proc.returncode != 0:
        logger.error("Claude exited %d: %s", proc.returncode, proc.stderr.strip())
        return []

    try:
        raw = json.loads(proc.stdout.strip()).get("result", "")
    except (json.JSONDecodeError, AttributeError):
        raw = proc.stdout

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


def generate_comment_variants(
    post: dict,
    interests: list[str],
    *,
    instruction: str = "",
    previous_variants: list[dict] | None = None,
) -> list[dict]:
    """Generate 3 comment variants for `post`.

    If `instruction` + `previous_variants` are supplied, rewrites the previous
    variants applying the instruction. Otherwise generates fresh ones.
    Returns `[{"angle", "label", "text"}, ...]` or `[]` on failure.
    """
    author = post.get("author", "unknown")
    text = post.get("text", "")[:TEXT_EXCERPT_LEN].replace("\n", " ").strip()

    if instruction and previous_variants:
        prompt = _ADJUST_PROMPT.format(
            instruction=instruction,
            variants_json=json.dumps(previous_variants, ensure_ascii=False),
        )
    else:
        prompt = _GENERATE_PROMPT.format(
            author=author,
            text=text,
            interests=", ".join(interests),
        )

    items = _run_claude(prompt)
    result = []
    for item in items:
        if not isinstance(item, dict):
            continue
        angle = str(item.get("angle", "")).strip()
        label = str(item.get("label", "")).strip()
        text_val = str(item.get("text", "")).strip()
        if angle and label and text_val:
            result.append({"angle": angle, "label": label, "text": text_val})
    return result[:3]
