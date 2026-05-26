# pipeline/pipeline.py
# ── T2: OpenClaw Pipeline ──────────────────────────────────────────────────
# Main orchestration loop: listens for on-chain events, calls the AI Referee,
# settles funds on-chain, and writes shared/log.json for the dashboard.
#
# TODO (Teammate 2):
#   1. Implement blockchain.py — web3.py connect, sign, send helpers
#   2. Implement event_listener.py — poll FundsLocked every 2s
#   3. Implement log_writer.py — atomic writes to shared/log.json
#   4. Wire up verify_payload from referee/ module
#   5. Full integration with real contract from shared/contract_meta.json

import sys
import os

# Add referee module to path so T2 can import T3's function directly
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'referee'))

# from referee import verify_payload   # uncomment when T3 is ready
# from blockchain import settle        # uncomment when blockchain.py is done
# from event_listener import start_polling
# from log_writer import write_log


def run_pipeline():
    """Entry point called by the OpenClaw skill wrapper."""
    raise NotImplementedError("Teammate 2: implement run_pipeline()")


if __name__ == "__main__":
    run_pipeline()
