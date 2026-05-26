import json
import logging
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

LOG_PATH = Path(os.environ.get("LOG_FILE_PATH") or os.path.join(os.path.dirname(__file__), '..', 'shared', 'log.json'))
_lock = threading.Lock()


def _read() -> list:
    if LOG_PATH.exists():
        try:
            return json.loads(LOG_PATH.read_text())
        except json.JSONDecodeError:
            logger.warning("log.json corrupt — resetting")
    return []


def _flush(entries: list) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    LOG_PATH.write_text(json.dumps(entries, indent=2))


def write_log(entry: dict) -> None:
    """Append a new entry to shared/log.json."""
    entry.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
    with _lock:
        entries = _read()
        entries.append(entry)
        _flush(entries)
    logger.info("log.json ← new entry txId=%s status=%s", entry.get("txId"), entry.get("status"))


def update_log(tx_id: str, updates: dict) -> None:
    """Find an existing entry by txId and merge in updates."""
    with _lock:
        entries = _read()
        for entry in entries:
            if entry.get("txId") == tx_id:
                entry.update(updates)
                _flush(entries)
                logger.info("log.json ← updated txId=%s %s", tx_id, list(updates.keys()))
                return
        logger.warning("update_log: txId=%s not found — appending instead", tx_id)
        updates["txId"] = tx_id
        updates.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
        entries.append(updates)
        _flush(entries)
