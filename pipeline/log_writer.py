import json
import logging
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

# Primary path: T4's public/ folder so the dashboard picks it up at /log.json
# Falls back to shared/log.json if LOG_FILE_PATH is explicitly set
_DEFAULT_PATH = Path(__file__).parent.parent / "teammate4-live-ledger" / "dashboard" / "public" / "log.json"
LOG_PATH = Path(os.environ.get("LOG_FILE_PATH") or _DEFAULT_PATH)

# Mirror writes to shared/log.json as well (for T1/T3 visibility)
_SHARED_PATH = Path(__file__).parent.parent / "shared" / "log.json"

_lock = threading.Lock()


# ── Internal helpers ───────────────────────────────────────────────────────────

def _read() -> dict:
    """Read the current log file. Returns {transactions: [], logs: []}."""
    if LOG_PATH.exists():
        try:
            data = json.loads(LOG_PATH.read_text())
            if isinstance(data, list):
                # Migrate old flat-array format
                data = {"transactions": data, "logs": []}
            return data
        except json.JSONDecodeError:
            logger.warning("log.json corrupt — resetting")
    return {"transactions": [], "logs": []}


def _flush(data: dict) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    LOG_PATH.write_text(json.dumps(data, indent=2))
    # Mirror to shared/log.json
    _SHARED_PATH.parent.mkdir(parents=True, exist_ok=True)
    _SHARED_PATH.write_text(json.dumps(data, indent=2))


def _fmt_amount(raw_amount: int) -> str:
    """Convert micro-USDC int to '25.00 tUSDC' string."""
    return f"{raw_amount / 1e6:.2f} tUSDC"


# ── Public API ─────────────────────────────────────────────────────────────────

def write_log(entry: dict) -> None:
    """
    Append a new transaction entry and a PENDING log line.
    entry must contain: txId (hex str), buyer, seller, amount (int micro-USDC), status
    """
    tx_id = entry["txId"]
    amount_str = _fmt_amount(entry["amount"]) if isinstance(entry["amount"], int) else entry["amount"]

    tx = {
        "id":     tx_id,
        "buyer":  entry["buyer"],
        "seller": entry["seller"],
        "amount": amount_str,
        "status": entry.get("status", "PENDING"),
    }
    log_line = f"[INFO] {tx_id[:18]}... - Funds locked: {amount_str}"

    with _lock:
        data = _read()
        data["transactions"].append(tx)
        data["logs"].append(log_line)
        _flush(data)
    logger.info("log.json ← PENDING txId=%s", tx_id)


def update_log(tx_id: str, updates: dict) -> None:
    """
    Update a transaction by txId and optionally append log lines.
    Handles status changes and referee verdict → log string generation.
    """
    with _lock:
        data = _read()

        # Find and update transaction
        tx = next((t for t in data["transactions"] if t.get("id") == tx_id), None)
        if tx is None:
            logger.warning("update_log: txId=%s not found", tx_id)
            return

        short = tx_id[:18] + "..."

        # Apply status update
        if "status" in updates:
            tx["status"] = updates["status"]

        # Generate log lines from known update types
        if "refereeVerdict" in updates:
            verdict = updates["refereeVerdict"]
            reason  = updates.get("refereeReason", "")
            if verdict == "PASS":
                data["logs"].append(f"[OK] {short} - Referee verdict: PASS — {reason}")
            else:
                data["logs"].append(f"[ERROR] {short} - Referee verdict: FAIL — {reason}")

        if "settlementTxHash" in updates:
            status   = updates.get("status", tx.get("status", ""))
            fn_name  = "releaseFunds" if status == "RELEASED" else "refundFunds"
            tx_hash  = updates["settlementTxHash"]
            data["logs"].append(f"[TX] {short} - {fn_name}(txId) -> txhash: {tx_hash[:18]}...")

        if updates.get("status") == "FAILED":
            data["logs"].append(f"[ERROR] {short} - Pipeline error — marked FAILED")

        _flush(data)
    logger.info("log.json ← updated txId=%s %s", tx_id, list(updates.keys()))
