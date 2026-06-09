"""Shared formatting helpers for Telegram messages."""
from datetime import datetime, timezone


def format_age(iso: str) -> str:
    """Render an ISO-8601 timestamp as a short relative age, e.g. '5m ago'."""
    try:
        ts = datetime.fromisoformat(iso)
        seconds = int((datetime.now(tz=timezone.utc) - ts).total_seconds())
        if seconds < 60:
            return f"{seconds}s ago"
        if seconds < 3600:
            return f"{seconds // 60}m ago"
        if seconds < 86400:
            return f"{seconds // 3600}h ago"
        return f"{seconds // 86400}d ago"
    except (ValueError, TypeError):
        return "recently"
