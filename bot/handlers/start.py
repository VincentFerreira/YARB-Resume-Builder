"""/start command — introduces Decker."""
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ParseMode
from telegram.ext import ContextTypes

from bot.auth import restricted

WELCOME_MESSAGE = (
    "👋 *Decker*\n\n"
    "I scrape your LinkedIn feed and ask Claude Code to judge which posts are "
    "genuinely worth commenting on, based on your interests.\n\n"
    "Use ⚙️ Config below to tell me what kind of posts to look for."
)

START_KEYBOARD = InlineKeyboardMarkup([
    [InlineKeyboardButton("🔍 New posts", callback_data="feed:scan")],
    [InlineKeyboardButton("📋 Found posts", callback_data="found:list")],
    [InlineKeyboardButton("⚙️ Config", callback_data="config:show")],
])


@restricted
async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(WELCOME_MESSAGE, parse_mode=ParseMode.MARKDOWN, reply_markup=START_KEYBOARD)
