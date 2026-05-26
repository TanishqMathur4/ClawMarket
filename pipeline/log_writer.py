# pipeline/log_writer.py
# ── T2: shared/log.json writer ────────────────────────────────────────────
# Atomic read-modify-write to shared/log.json with a threading lock.
#
# TODO (Teammate 2): implement write_log(), update_log()

import json, threading, os

LOG_PATH = os.path.join(os.path.dirname(__file__), '..', 'shared', 'log.json')
_lock = threading.Lock()

def write_log(entry: dict):
    """Append a new entry to shared/log.json."""
    raise NotImplementedError("Teammate 2: implement write_log()")


def update_log(tx_id: str, updates: dict):
    """Find an existing entry by txId and merge in updates."""
    raise NotImplementedError("Teammate 2: implement update_log()")
