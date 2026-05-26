# pipeline/event_listener.py
# ── T2: FundsLocked event poller ──────────────────────────────────────────
# Polls ClawCourtEscrow for FundsLocked events every 2 seconds.
#
# TODO (Teammate 2): implement start_polling()

from time import sleep

def start_polling(contract, on_event_callback, interval: int = 2):
    """Poll FundsLocked events and call on_event_callback for each new event."""
    raise NotImplementedError("Teammate 2: implement start_polling()")
