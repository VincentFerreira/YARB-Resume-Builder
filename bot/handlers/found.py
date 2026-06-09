"""Found posts — browse what Claude has already flagged as relevant, through
the same one-card-at-a-time triage session as a fresh scan (see `feed.py`):
mark them as commented, keep them for later, skip past them, or mark them not
relevant (hidden for good and never resurfaced, even if re-detected).
"""
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from bot.auth import restricted
from bot.handlers.feed import SCAN_BUTTON, _start_browse
from bot.storage import get_posts_store

_store = get_posts_store()

FOUND_BUTTON = InlineKeyboardButton("📋 Found posts", callback_data="found:list")
_BROWSE_AGAIN_KEYBOARD = InlineKeyboardMarkup([[SCAN_BUTTON, FOUND_BUTTON]])


@restricted
async def cb_found_list(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    found = _store.get_found()
    if not found:
        await query.edit_message_text(
            "📋 No posts found yet — run a 🔍 New posts scan first."
        )
        return

    await _start_browse(
        query,
        ctx,
        found,
        done_text=f"✅ Reviewed all {len(found)} found post(s).",
        done_keyboard=_BROWSE_AGAIN_KEYBOARD,
    )
