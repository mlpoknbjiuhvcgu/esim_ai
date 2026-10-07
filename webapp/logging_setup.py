"""專案共用的 logging 設定。

- 寫檔：logs/<name>.log，單檔最大 5MB，保留 5 份舊檔
- 格式：timestamp [LEVEL] logger: message
- 同時輸出到 console
"""
from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

_FMT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
_DATE = "%Y-%m-%d %H:%M:%S"


def get_logger(name: str, filename: str | None = None) -> logging.Logger:
    """取得已掛好 RotatingFileHandler 的 logger。"""
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger
    logger.setLevel(logging.INFO)
    formatter = logging.Formatter(_FMT, _DATE)

    fh = RotatingFileHandler(
        LOG_DIR / (filename or f"{name}.log"),
        maxBytes=5 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    fh.setFormatter(formatter)
    logger.addHandler(fh)

    ch = logging.StreamHandler()
    ch.setFormatter(formatter)
    logger.addHandler(ch)

    logger.propagate = False
    return logger
