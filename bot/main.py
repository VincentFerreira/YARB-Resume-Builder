"""Builds the Application, registers handlers, and runs long-polling.

Security: only TELEGRAM_USER_ID can interact with the bot (see bot/auth.py).
"""
import logging

from telegram.ext import Application

from bot.config import BOT_TOKEN
from bot.handlers import register_handlers

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


def main():
    app = Application.builder().token(BOT_TOKEN).build()
    register_handlers(app)

    logger.info("Bot started — long-polling active")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
