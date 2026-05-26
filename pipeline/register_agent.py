"""
ERC-8004 Agent Registration Script
Registers the ClawCourt Pipeline agent on GOAT Network
"""

import json
import os
from web3 import Web3
from eth_account import Account
from dotenv import load_dotenv
import logging

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s — %(message)s"
)
logger = logging.getLogger(__name__)

# ERC-8004 Registry ABI (simplified)
ERC8004_ABI = [
    {
        "inputs": [
            {"name": "agentId", "type": "bytes32"},
            {"name": "metadataURI", "type": "string"}
        ],
        "name": "registerAgent",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"name": "agentId", "type": "bytes32"}],
        "name": "getAgent",
        "outputs": [
            {"name": "owner", "type": "address"},
            {"name": "metadataURI", "type": "string"},
            {"name": "isActive", "type": "bool"}
        ],
        "stateMutability": "view",
        "type": "function"
    }
]


def register_agent():
    """Register agent on ERC-8004 registry"""
    
    # Load configuration
    rpc_url = os.getenv("GOAT_RPC_URL")
    private_key = os.getenv("GATEWAY_PRIVATE_KEY")
    registry_address = "0x8004000000000000000000000000000000000000"  # ERC-8004 registry
    
    # Load agent metadata
    with open("agent-metadata.json", 'r') as f:
        metadata = json.load(f)
    
    agent_id = metadata["agentId"]
    
    # Connect to blockchain
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    account = Account.from_key(private_key)
    
    logger.info(f"Connecting to GOAT Network at {rpc_url}")
    logger.info(f"Deployer address: {account.address}")
    
    if not w3.is_connected():
        raise Exception("Failed to connect to GOAT Network")
    
    # Create registry contract instance
    registry = w3.eth.contract(
        address=Web3.to_checksum_address(registry_address),
        abi=ERC8004_ABI
    )
    
    # Convert agentId to bytes32
    agent_id_bytes = Web3.keccak(text=agent_id)
    
    # Upload metadata to IPFS or use inline JSON (for demo, we'll use a data URI)
    metadata_json = json.dumps(metadata)
    # For production, upload to IPFS and use that URI
    metadata_uri = f"data:application/json;base64,{metadata_json}"
    
    logger.info(f"Registering agent: {agent_id}")
    logger.info(f"Agent ID (bytes32): {agent_id_bytes.hex()}")
    
    # Check if already registered
    try:
        existing = registry.functions.getAgent(agent_id_bytes).call()
        if existing[2]:  # isActive
            logger.warning(f"Agent already registered by {existing[0]}")
            
            # Update if we're the owner
            if existing[0].lower() == account.address.lower():
                logger.info("Updating existing registration...")
            else:
                raise Exception("Agent registered by different address")
    except Exception as e:
        logger.info("Agent not yet registered, proceeding...")
    
    # Build registration transaction
    tx = registry.functions.registerAgent(
        agent_id_bytes,
        metadata_uri
    ).build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gas": 500000,
        "gasPrice": w3.eth.gas_price,
    })
    
    # Sign and send transaction
    logger.info("Signing registration transaction...")
    signed_tx = account.sign_transaction(tx)
    
    logger.info("Broadcasting transaction...")
    tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
    
    logger.info(f"Transaction sent: {tx_hash.hex()}")
    logger.info("Waiting for confirmation...")
    
    # Wait for receipt
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    
    if receipt["status"] == 1:
        logger.info("✓ Agent successfully registered on ERC-8004!")
        logger.info(f"Transaction: {tx_hash.hex()}")
        logger.info(f"Block: {receipt['blockNumber']}")
        logger.info(f"Gas used: {receipt['gasUsed']}")
        logger.info(f"\nView on 8004scan.io:")
        logger.info(f"https://8004scan.io/agent/{account.address}")
        
        # Save registration receipt
        receipt_data = {
            "agentId": agent_id,
            "txHash": tx_hash.hex(),
            "blockNumber": receipt["blockNumber"],
            "deployer": account.address,
            "registryAddress": registry_address,
            "timestamp": metadata["registrationTimestamp"]
        }
        
        with open("registration-receipt.json", 'w') as f:
            json.dump(receipt_data, f, indent=2)
        
        logger.info("Registration receipt saved to registration-receipt.json")
        
        return True
    else:
        logger.error("✗ Registration transaction failed!")
        return False


if __name__ == "__main__":
    try:
        success = register_agent()
        exit(0 if success else 1)
    except Exception as e:
        logger.error(f"Registration failed: {e}")
        exit(1)
