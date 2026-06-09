"""Authorization guard — only AUTHORIZED_USER_ID may interact with the bot."""
from functools import wraps

from telegram import Update
from telegram.ext import ContextTypes

from bot.config import AUTHORIZED_USER_ID


def restricted(handler):
    """Silently ignore updates from anyone other than the authorized user."""
    @wraps(handler)
    async def wrapper(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        user = update.effective_user
        if user is None or user.id != AUTHORIZED_USER_ID:
            return
        return await handler(update, ctx)
    return wrapper
