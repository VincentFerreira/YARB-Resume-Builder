"""
Parse Claude Code JSONL conversation logs to aggregate token usage and estimate costs.

Scans all ~/.claude/projects/ session files regardless of project.
"""
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Pricing per million tokens — Sonnet 4.6 (claude.ai Pro subscription)
_PRICING = {
    "input":        3.00,
    "output":      15.00,
    "cache_write":  3.75,
    "cache_read":   0.30,
}

_CLAUDE_DIR = Path.home() / ".claude" / "projects"


def _cost(tokens: int, rate_per_mtok: float) -> float:
    return tokens * rate_per_mtok / 1_000_000


def _empty_bucket() -> dict:
    return {
        "messages": 0,
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_creation_tokens": 0,
        "cache_read_tokens": 0,
        "cost_usd": 0.0,
        "models": set(),
    }


def _add_usage(bucket: dict, usage: dict, model: str) -> None:
    bucket["messages"] += 1
    bucket["input_tokens"] += usage.get("input_tokens", 0)
    bucket["output_tokens"] += usage.get("output_tokens", 0)
    bucket["cache_creation_tokens"] += usage.get("cache_creation_input_tokens", 0)
    bucket["cache_read_tokens"] += usage.get("cache_read_input_tokens", 0)
    bucket["cost_usd"] += (
        _cost(usage.get("input_tokens", 0), _PRICING["input"])
        + _cost(usage.get("output_tokens", 0), _PRICING["output"])
        + _cost(usage.get("cache_creation_input_tokens", 0), _PRICING["cache_write"])
        + _cost(usage.get("cache_read_input_tokens", 0), _PRICING["cache_read"])
    )
    bucket["models"].add(model)


def get_usage_stats() -> dict:
    """
    Return token usage aggregated across all Claude Code projects.

    Returns dict with keys: today, week, total — each a bucket dict.
    """
    now = datetime.now(tz=timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    buckets = {
        "today": _empty_bucket(),
        "week": _empty_bucket(),
        "total": _empty_bucket(),
    }

    if not _CLAUDE_DIR.exists():
        return buckets

    for jsonl_file in _CLAUDE_DIR.rglob("*.jsonl"):
        try:
            with jsonl_file.open(encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    if entry.get("type") != "assistant":
                        continue

                    msg = entry.get("message", {})
                    usage = msg.get("usage")
                    if not usage:
                        continue

                    model = msg.get("model", "unknown")

                    ts_raw = entry.get("timestamp")
                    if ts_raw:
                        try:
                            ts = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
                        except ValueError:
                            ts = now
                    else:
                        ts = now

                    _add_usage(buckets["total"], usage, model)
                    if ts >= week_start:
                        _add_usage(buckets["week"], usage, model)
                    if ts >= today_start:
                        _add_usage(buckets["today"], usage, model)

        except OSError:
            continue

    # Convert sets to sorted lists for serialisation
    for b in buckets.values():
        b["models"] = sorted(b["models"])

    return buckets


def format_usage_message(stats: dict) -> str:
    """Format usage stats as a Telegram-ready Markdown string."""
    lines = ["📊 *Consommation Claude Code*\n"]

    labels = [("Aujourd'hui", "today"), ("7 derniers jours", "week"), ("Total", "total")]
    for label, key in labels:
        b = stats[key]
        total_tok = b["input_tokens"] + b["output_tokens"]
        lines.append(f"*{label}*")
        lines.append(f"  Messages : {b['messages']:,}")
        lines.append(f"  Input    : {b['input_tokens']:,} tok")
        lines.append(f"  Output   : {b['output_tokens']:,} tok")
        lines.append(f"  Cache wr : {b['cache_creation_tokens']:,} tok")
        lines.append(f"  Cache rd : {b['cache_read_tokens']:,} tok")
        lines.append(f"  Total    : {total_tok:,} tok")
        lines.append(f"  Coût est.: ${b['cost_usd']:.4f}")
        if b["models"]:
            lines.append(f"  Modèles  : {', '.join(b['models'])}")
        lines.append("")

    lines.append("_Tarifs Sonnet 4.6 — estimation uniquement_")
    return "\n".join(lines)
