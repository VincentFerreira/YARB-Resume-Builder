"""Storage backend selection for Decker's data.

Returns store interfaces — currently both JSON-backed. To switch backends
(e.g. SQL), change what these functions return; nothing elsewhere needs to know.
"""
from bot.storage.interfaces import PostsStore, SettingsStore
from bot.storage.json_posts_store import JSONPostsStore
from bot.storage.json_store import JSONSettingsStore


def get_settings_store() -> SettingsStore:
    return JSONSettingsStore()


def get_posts_store() -> PostsStore:
    return JSONPostsStore()
