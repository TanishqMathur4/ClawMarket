import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

logger = logging.getLogger(__name__)

LOG_PATH = Path(os.environ.get("LOG_FILE_PATH", "../shared/log.json"))
_lock = Lock()


def _read() -> list:
    if LOG_PATH.exists():
        try:
            return json.loads(LOG_PATH.read_text())
        except json.JSONDecodeError:
            logger.warning("log.json corrupt — resetting")
    return []


def _write(entries: list) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    LOG_PATH.write_text(json.dumps(entries, indent=2))


def upsert(tx_id_hex: str, fields: dict) -> None:
    with _lock:
        entries = _read()
        for entry in entries:
            if entry["txId"] == tx_id_hex:
                entry.update(fields)
                _write(entries)
                return
        entries.append({"txId": tx_id_hex, **fields})
        _write(entries)


def write_pending(tx_id: bytes, buyer: str, seller: str, amount: int) -> None:
    upsert(tx_id.hex(), {
        "buyer": buyer,
        "seller": seller,
        "amount": f"{amount / 1e6:.2f}",
        "status": "PENDING",
        "refereeVerdict": None,
        "refereeReason": None,
        "settlementTxHash": None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    logger.info("log.json ← PENDING txId=%s", tx_id.hex())


def write_verdict(tx_id: bytes, verdict: str, reason: str) -> None:
    upsert(tx_id.hex(), {"refereeVerdict": verdict, "refereeReason": reason})
    logger.info("log.json ← verdict=%s txId=%s", verdict, tx_id.hex())


def write_settled(tx_id: bytes, verdict: str, settlement_tx_hash: str) -> None:
    status = "RELEASED" if verdict == "PASS" else "REFUNDED"
    upsert(tx_id.hex(), {"status": status, "settlementTxHash": settlement_tx_hash})
    logger.info("log.json ← %s txId=%s hash=%s", status, tx_id.hex(), settlement_tx_hash)
