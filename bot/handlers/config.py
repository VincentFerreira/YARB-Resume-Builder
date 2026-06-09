"""Config menu — view and edit the post topics Decker looks for."""
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ParseMode
from telegram.ext import ContextTypes

from bot.auth import restricted
from bot.storage import get_settings_store

# ctx.user_data flag set while waiting for the user to send new interests
AWAITING_INTERESTS = "awaiting_interests"

_store = get_settings_store()


def _config_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[InlineKeyboardButton("✏️ Edit", callback_data="config:edit")]])


def _format_interests(interests: list[str]) -> str:
    if not interests:
        return (
            "⚙️ *Configuration*\n\n"
            "No topics configured yet — Decker doesn't know what to look for."
        )
    bullets = "\n".join(f"• {topic}" for topic in interests)
    return f"⚙️ *Configuration*\n\nDecker looks for posts about:\n{bullets}"


@restricted
async def cb_config_show(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    await query.edit_message_text(
        _format_interests(_store.get_interests()),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=_config_keyboard(),
    )


@restricted
async def cb_config_edit(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    ctx.user_data[AWAITING_INTERESTS] = True
    await query.edit_message_text(
        "Send a comma-separated list of topics Decker should look for, "
        "e.g. `QA, automation, hiring`:",
        parse_mode=ParseMode.MARKDOWN,
    )


@restricted
async def receive_interests(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Plain-text handler — only acts while a /config edit is pending."""
    if not ctx.user_data.pop(AWAITING_INTERESTS, False):
        return

    interests = [topic.strip() for topic in update.message.text.split(",") if topic.strip()]
    _store.set_interests(interests)
    await update.message.reply_text(
        _format_interests(interests),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=_config_keyboard(),
    )
