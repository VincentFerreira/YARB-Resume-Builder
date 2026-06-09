"""Bot configuration loaded from environment variables."""
import os

from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
AUTHORIZED_USER_ID = int(os.environ["TELEGRAM_USER_ID"])
