"""
ERC-8004 agent registration on GOAT Network.

Called once by clawup.sh at deploy time. Safe to re-run — checks whether
this wallet already owns a token in the IdentityRegistry before minting.

The token URI points to this agent's /agent.json, making it discoverable
on 8004scan.io and by any broker running discoverAgents().
"""

import json
import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from eth_account import Account
from web3 import Web3

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────────────────────
RPC_URL                   = os.environ["GOAT_RPC_URL"]
PRIVATE_KEY               = os.environ["GATEWAY_PRIVATE_KEY"]
IDENTITY_REGISTRY_ADDRESS = os.environ["IDENTITY_REGISTRY_ADDRESS"]
AGENT_JSON_URI            = os.environ["AGENT_JSON_URI"]   # e.g. https://pipeline.clawcourt.xyz/agent.json

# Minimal ERC-8004 IdentityRegistry ABI — register + balanceOf to check existing
# Assumption: IdentityRegistry is ERC-721 with a register(string uri) mint function.
# Replace with the full ABI from shared/abi/Identity.json once Teammate 1 deploys.
_IDENTITY_ABI = [
    {
        "inputs": [{"name": "uri", "type": "string"}],
        "name": "register",
        "outputs": [{"name": "tokenId", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"name": "owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True,  "name": "owner",   "type": "address"},
            {"indexed": True,  "name": "tokenId", "type": "uint256"},
            {"indexed": False, "name": "uri",     "type": "string"},
        ],
        "name": "AgentRegistered",
        "type": "event",
    },
]

_SHARED_ABI_PATH = Path(__file__).parent.parent / "shared" / "abi" / "Identity.json"


def _load_abi() -> list:
    if _SHARED_ABI_PATH.exists():
        return json.loads(_SHARED_ABI_PATH.read_text())
    logger.warning("shared/abi/Identity.json not found — using inline minimal ABI")
    return _IDENTITY_ABI


def register() -> None:
    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    if not w3.is_connected():
        logger.error("Cannot connect to RPC: %s", RPC_URL)
        sys.exit(1)

    logger.info("Connected to GOAT Network — block %d", w3.eth.block_number)

    account = Account.from_key(PRIVATE_KEY)
    registry = w3.eth.contract(
        address=Web3.to_checksum_address(IDENTITY_REGISTRY_ADDRESS),
        abi=_load_abi(),
    )

    # Idempotency check — skip if wallet already has a token
    balance = registry.functions.balanceOf(account.address).call()
    if balance > 0:
        logger.info(
            "Agent already registered (wallet %s holds %d token(s)) — skipping mint.",
            account.address, balance,
        )
        return

    logger.info("Registering agent with URI: %s", AGENT_JSON_URI)

    fn = registry.functions.register(AGENT_JSON_URI)
    tx = fn.build_transaction({
        "from":     account.address,
        "nonce":    w3.eth.get_transaction_count(account.address, "pending"),
        "gas":      fn.estimate_gas({"from": account.address}) * 12 // 10,
        "gasPrice": w3.eth.gas_price,
    })
    signed  = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

    if receipt.status != 1:
        logger.error("Registration transaction reverted: %s", tx_hash.hex())
        sys.exit(1)

    logger.info(
        "Agent registered on ERC-8004. txHash=%s  Discoverable at: https://8004scan.io",
        tx_hash.hex(),
    )


if __name__ == "__main__":
    register()
