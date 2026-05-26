# pipeline/blockchain.py
# ── T2: web3.py helpers ────────────────────────────────────────────────────
# Handles: connect to GOAT RPC, instantiate contract, sign & send txs.
#
# TODO (Teammate 2): implement connect(), settle()

from web3 import Web3
from eth_account import Account
import json, os

def connect():
    """Connect to GOAT Testnet and return (w3, contract, account)."""
    raise NotImplementedError("Teammate 2: implement connect()")


def settle(w3, contract, account, tx_id: bytes, verdict: str) -> str:
    """Build, sign, and send releaseFunds or refundFunds. Returns tx hash."""
    raise NotImplementedError("Teammate 2: implement settle()")
