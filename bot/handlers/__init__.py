"""Registers all command, callback, and message handlers on the Application."""
from telegram.ext import Application, CallbackQueryHandler, CommandHandler, MessageHandler, filters

from bot.auth import restricted
from bot.handlers.config import AWAITING_INTERESTS, cb_config_edit, cb_config_show, receive_interests
from bot.handlers.feed import (
    AWAITING_COMMENT_ADJUST,
    cb_browse_action,
    cb_comment_adjust,
    cb_comment_back,
    cb_comment_back_variants,
    cb_comment_posted,
    cb_comment_regen,
    cb_comment_remind,
    cb_comment_start,
    cb_comment_use,
    cb_feed_scan,
    receive_comment_adjust,
)
from bot.handlers.found import cb_found_list
from bot.handlers.start import cmd_start


@restricted
async def _receive_text(update, ctx):
    """Combined plain-text dispatcher — routes to whichever input is pending."""
    if ctx.user_data.get(AWAITING_COMMENT_ADJUST):
        await receive_comment_adjust(update, ctx)
    elif ctx.user_data.get(AWAITING_INTERESTS):
        await receive_interests(update, ctx)


def register_handlers(app: Application) -> None:
    app.add_handler(CommandHandler("start", cmd_start))

    app.add_handler(CallbackQueryHandler(cb_config_show, pattern=r"^config:show$"))
    app.add_handler(CallbackQueryHandler(cb_config_edit, pattern=r"^config:edit$"))

    app.add_handler(CallbackQueryHandler(cb_feed_scan, pattern=r"^feed:scan$"))
    app.add_handler(CallbackQueryHandler(cb_found_list, pattern=r"^found:list$"))

    # Browse triage — comment is handled separately by the drafting flow
    app.add_handler(CallbackQueryHandler(cb_browse_action, pattern=r"^browse:(keep|skip|notrelevant)$"))

    # Comment drafting flow
    app.add_handler(CallbackQueryHandler(cb_comment_start, pattern=r"^browse:comment$"))
    app.add_handler(CallbackQueryHandler(cb_comment_use, pattern=r"^comment:use:\d+$"))
    app.add_handler(CallbackQueryHandler(cb_comment_regen, pattern=r"^comment:regen$"))
    app.add_handler(CallbackQueryHandler(cb_comment_adjust, pattern=r"^comment:adjust$"))
    app.add_handler(CallbackQueryHandler(cb_comment_back, pattern=r"^comment:back$"))
    app.add_handler(CallbackQueryHandler(cb_comment_back_variants, pattern=r"^comment:back_variants$"))
    app.add_handler(CallbackQueryHandler(cb_comment_posted, pattern=r"^comment:posted$"))
    app.add_handler(CallbackQueryHandler(cb_comment_remind, pattern=r"^comment:remind$"))

    # Plain text — dispatches to whichever text input is currently pending
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, _receive_text))
