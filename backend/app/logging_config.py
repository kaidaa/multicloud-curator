from __future__ import annotations

import logging
import logging.handlers
from pathlib import Path

from app.config import get_settings

_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
_LOG_DIR = Path("logs")
_LOG_FILE = _LOG_DIR / "app.log"
_MAX_BYTES = 10 * 1024 * 1024
_BACKUP_COUNT = 5


def setup_logging() -> None:
    settings = get_settings()
    log_level = settings.log_level.upper()

    _LOG_DIR.mkdir(parents=True, exist_ok=True)

    formatter = logging.Formatter(_FORMAT)

    root = logging.getLogger()
    root.setLevel(log_level)

    # Reset existing handlers to avoid duplicate logs.
    for handler in list(root.handlers):
        root.removeHandler(handler)

    file_handler = logging.handlers.RotatingFileHandler(
        _LOG_FILE,
        maxBytes=_MAX_BYTES,
        backupCount=_BACKUP_COUNT,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    root.addHandler(file_handler)

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    root.addHandler(console_handler)

    # Keep SQLAlchemy chatter out of normal app logs.
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    # OAuth callback URLs include code/state; do not log raw access URLs.
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
