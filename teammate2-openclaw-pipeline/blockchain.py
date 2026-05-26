import json
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from eth_account import Account
from web3 import Web3

load_dotenv()

logger = logging.getLogger(__name__)

RPC_URL = os.environ["GOAT_RPC_URL"]
PRIVATE_KEY = os.environ["GATEWAY_PRIVATE_KEY"]
CONTRACT_ADDRESS = os.environ["CONTRACT_ADDRESS"]

_CONTRACT_META_PATH = Path(__file__).parent.parent / "shared" / "contract_meta.json"
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


def _load_abi() -> list:
    if _CONTRACT_META_PATH.exists():
        meta = json.loads(_CONTRACT_META_PATH.read_text())
        return meta["abi"]
    logger.warning("contract_meta.json not found — using mock ABI")
    return _MOCK_ABI


def connect() -> tuple[Web3, object, Account]:
    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    if not w3.is_connected():
        raise ConnectionError(f"Cannot connect to RPC: {RPC_URL}")
    logger.info("Connected to GOAT Network — block %d", w3.eth.block_number)

    abi = _load_abi()
    contract = w3.eth.contract(address=Web3.to_checksum_address(CONTRACT_ADDRESS), abi=abi)
    account = Account.from_key(PRIVATE_KEY)
    logger.info("Gateway wallet: %s", account.address)
    return w3, contract, account


def settle(w3: Web3, contract, account: Account, tx_id: bytes, verdict: str) -> str:
    if verdict == "PASS":
        fn = contract.functions.releaseFunds(tx_id)
    else:
        fn = contract.functions.refundFunds(tx_id)

    gas_estimate = fn.estimate_gas({"from": account.address})
    tx = fn.build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address, "pending"),
        "gas": gas_estimate * 12 // 10,
        "gasPrice": w3.eth.gas_price,
    })
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
    logger.info("Settled txId=%s verdict=%s hash=%s", tx_id.hex(), verdict, tx_hash.hex())
    return tx_hash.hex()
