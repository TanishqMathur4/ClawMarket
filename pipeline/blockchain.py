import json
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from eth_account import Account
from web3 import Web3

load_dotenv()

logger = logging.getLogger(__name__)

_ROOT = Path(__file__).parent.parent
_CONTRACT_META_PATH = _ROOT / "shared" / "contract_meta.json"

_MOCK_ABI = [
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True,  "name": "txId",   "type": "bytes32"},
            {"indexed": True,  "name": "buyer",  "type": "address"},
            {"indexed": False, "name": "seller", "type": "address"},
            {"indexed": False, "name": "amount", "type": "uint256"},
        ],
        "name": "FundsLocked",
        "type": "event",
    },
    {
        "inputs": [{"name": "txId", "type": "bytes32"}],
        "name": "releaseFunds",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"name": "txId", "type": "bytes32"}],
        "name": "refundFunds",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]


def _load_contract_meta() -> tuple[str, list]:
    meta = json.loads(_CONTRACT_META_PATH.read_text())
    address = meta.get("address", os.environ.get("CONTRACT_ADDRESS", ""))
    abi = meta.get("abi") or []
    if not abi:
        logger.warning("contract_meta.json has no ABI yet — using mock ABI")
        abi = _MOCK_ABI
    return address, abi


def connect() -> tuple[Web3, object, Account]:
    """Connect to GOAT Testnet and return (w3, contract, account)."""
    rpc_url = os.environ["GOAT_RPC_URL"]
    private_key = os.environ.get("GATEWAY_PRIVATE_KEY") or os.environ["PRIVATE_KEY"]

    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        raise ConnectionError(f"Cannot connect to RPC: {rpc_url}")
    logger.info("Connected to GOAT Network — block %d", w3.eth.block_number)

    address, abi = _load_contract_meta()
    contract = w3.eth.contract(address=Web3.to_checksum_address(address), abi=abi)

    account = Account.from_key(private_key)
    logger.info("Gateway wallet: %s", account.address)
    return w3, contract, account


def settle(w3: Web3, contract, account: Account, tx_id: bytes, verdict: str) -> str:
    """Build, sign, and send releaseFunds or refundFunds. Returns tx hash."""
    fn = contract.functions.releaseFunds(tx_id) if verdict == "PASS" else contract.functions.refundFunds(tx_id)

    gas = fn.estimate_gas({"from": account.address}) * 12 // 10
    tx = fn.build_transaction({
        "from":     account.address,
        "nonce":    w3.eth.get_transaction_count(account.address, "pending"),
        "gas":      gas,
        "gasPrice": w3.eth.gas_price,
    })
    signed  = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
    logger.info("Settled txId=%s verdict=%s hash=%s", tx_id.hex(), verdict, tx_hash.hex())
    return tx_hash.hex()
