"""JSON-file backed implementation of SettingsStore."""
import json
from pathlib import Path

from bot.storage.interfaces import SettingsStore

DEFAULT_PATH = Path(__file__).resolve().parent.parent.parent / "bot_settings.json"


class JSONSettingsStore(SettingsStore):
    """Reads and writes Decker's settings to a flat JSON file on disk."""

    def __init__(self, path: Path | str = DEFAULT_PATH):
        self._path = Path(path)

    def get_interests(self) -> list[str]:
        return self._read().get("interests", [])

    def set_interests(self, interests: list[str]) -> None:
        data = self._read()
        data["interests"] = interests
        self._write(data)

    def _read(self) -> dict:
        if not self._path.exists():
            return {}
        try:
            return json.loads(self._path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}

    def _write(self, data: dict) -> None:
        self._path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
        )
