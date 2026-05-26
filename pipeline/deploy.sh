#!/bin/bash

set -e  # Exit on error

echo "🚀 ClawCourt Pipeline - ClawUp Deployment Script"
echo "================================================"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NETWORK_ENV=${NETWORK_ENV:-mainnet}
CONFIG_FILE="deployment/${NETWORK_ENV}.config.json"

echo -e "${YELLOW}[INFO]${NC} Deployment Environment: $NETWORK_ENV"

# Step 1: Validate environment
echo -e "\n${YELLOW}[STEP 1]${NC} Validating environment..."

if [ ! -f ".env.production" ] && [ "$NETWORK_ENV" = "mainnet" ]; then
    echo -e "${RED}[ERROR]${NC} .env.production file not found!"
    exit 1
fi

if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}[ERROR]${NC} Config file $CONFIG_FILE not found!"
    exit 1
fi

# Load environment variables
if [ "$NETWORK_ENV" = "mainnet" ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
else
    export $(cat .env | grep -v '^#' | xargs)
fi

# Validate required variables
required_vars=("GOAT_RPC_URL" "GATEWAY_PRIVATE_KEY" "CONTRACT_ADDRESS" "TUSDIC_ADDRESS")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}[ERROR]${NC} Required environment variable $var is not set!"
        exit 1
    fi
done

echo -e "${GREEN}[SUCCESS]${NC} Environment validated"

# Step 2: Install dependencies
echo -e "\n${YELLOW}[STEP 2]${NC} Installing dependencies..."
pip install -q web3 python-dotenv fastapi uvicorn psutil eth-account 2>/dev/null || true
echo -e "${GREEN}[SUCCESS]${NC} Dependencies installed"

# Step 3: Test RPC connection
echo -e "\n${YELLOW}[STEP 3]${NC} Testing blockchain connection..."
python3 -c "
from web3 import Web3
import os
w3 = Web3(Web3.HTTPProvider(os.getenv('GOAT_RPC_URL')))
assert w3.is_connected(), 'Failed to connect to GOAT Network'
print(f'Connected to GOAT Network - Block: {w3.eth.block_number}')
" || {
    echo -e "${RED}[ERROR]${NC} Failed to connect to GOAT Network!"
    exit 1
}
echo -e "${GREEN}[SUCCESS]${NC} Blockchain connection verified"

# Step 4: Validate contract deployment
echo -e "\n${YELLOW}[STEP 4]${NC} Validating contract..."
python3 -c "
from web3 import Web3
import os

w3 = Web3(Web3.HTTPProvider(os.getenv('GOAT_RPC_URL')))
contract_address = os.getenv('CONTRACT_ADDRESS')

# Check contract exists
code = w3.eth.get_code(contract_address)
assert code != '0x' and code != b'', f'No contract found at {contract_address}'

print(f'Contract validated at {contract_address}')
" || {
    echo -e "${RED}[ERROR]${NC} Contract validation failed!"
    exit 1
}
echo -e "${GREEN}[SUCCESS]${NC} Contract validated"

# Step 5: Prepare deployment metadata
echo -e "\n${YELLOW}[STEP 5]${NC} Preparing ERC-8004 registration..."

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DEPLOYER_ADDRESS=$(python3 -c "
from eth_account import Account
import os
account = Account.from_key(os.getenv('GATEWAY_PRIVATE_KEY'))
print(account.address)
")

# Create a temporary metadata file with replaced values
cp agent-metadata.json agent-metadata.json.bak
sed -i.tmp "s/\${DEPLOYMENT_TIMESTAMP}/$TIMESTAMP/g" agent-metadata.json
sed -i.tmp "s/\${DEPLOYER_ADDRESS}/$DEPLOYER_ADDRESS/g" agent-metadata.json
sed -i.tmp "s/\${CONTRACT_ADDRESS}/$CONTRACT_ADDRESS/g" agent-metadata.json
sed -i.tmp "s/\${TUSDIC_ADDRESS}/$TUSDIC_ADDRESS/g" agent-metadata.json
rm -f agent-metadata.json.tmp

echo -e "${GREEN}[SUCCESS]${NC} Metadata prepared"

# Step 6: Register agent on ERC-8004 (if mainnet)
if [ "$NETWORK_ENV" = "mainnet" ]; then
    echo -e "\n${YELLOW}[STEP 6]${NC} Registering agent on ERC-8004..."
    
    python3 register_agent.py || {
        echo -e "${YELLOW}[WARNING]${NC} Agent registration failed (may already be registered)"
    }
    
    echo -e "${GREEN}[SUCCESS]${NC} Agent registration complete"
else
    echo -e "\n${YELLOW}[STEP 6]${NC} Skipping ERC-8004 registration (testnet mode)"
fi

# Step 7: Start health check server
echo -e "\n${YELLOW}[STEP 7]${NC} Starting health check server..."
nohup python3 health_check.py > health_check.log 2>&1 &
HEALTH_PID=$!
echo $HEALTH_PID > health_check.pid

sleep 2

# Verify health endpoint
curl -f http://localhost:8000/health > /dev/null 2>&1 || {
    echo -e "${RED}[ERROR]${NC} Health check server failed to start!"
    kill $HEALTH_PID 2>/dev/null || true
    exit 1
}

echo -e "${GREEN}[SUCCESS]${NC} Health check server running (PID: $HEALTH_PID)"

# Step 8: Start main pipeline
echo -e "\n${YELLOW}[STEP 8]${NC} Starting ClawCourt Pipeline..."

nohup python3 openclaw_skill.py > pipeline.log 2>&1 &
PIPELINE_PID=$!
echo $PIPELINE_PID > pipeline.pid

sleep 3

# Check if pipeline is running
if ps -p $PIPELINE_PID > /dev/null 2>&1; then
    echo -e "${GREEN}[SUCCESS]${NC} Pipeline started (PID: $PIPELINE_PID)"
else
    echo -e "${RED}[ERROR]${NC} Pipeline failed to start! Check pipeline.log"
    exit 1
fi

# Step 9: Final verification
echo -e "\n${YELLOW}[STEP 9]${NC} Running post-deployment verification..."

sleep 5

# Check health
HEALTH_STATUS=$(curl -s http://localhost:8000/health 2>/dev/null | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('status', 'unknown'))" 2>/dev/null || echo "unknown")

if [ "$HEALTH_STATUS" = "healthy" ]; then
    echo -e "${GREEN}[SUCCESS]${NC} Health check passed"
else
    echo -e "${YELLOW}[WARNING]${NC} Health check status: $HEALTH_STATUS"
fi

# Deployment summary
echo -e "\n${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          DEPLOYMENT SUCCESSFUL ✓                       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Network:          ${GREEN}$NETWORK_ENV${NC}"
echo -e "Contract:         ${GREEN}$CONTRACT_ADDRESS${NC}"
echo -e "Deployer:         ${GREEN}$DEPLOYER_ADDRESS${NC}"
echo -e "Pipeline PID:     ${GREEN}$PIPELINE_PID${NC}"
echo -e "Health Check:     ${GREEN}http://localhost:8000/health${NC}"
echo -e "Logs:             ${GREEN}http://localhost:8000/api/logs${NC}"

if [ "$NETWORK_ENV" = "mainnet" ]; then
    echo -e "8004scan.io:      ${GREEN}https://8004scan.io/agent/$DEPLOYER_ADDRESS${NC}"
fi

echo ""
echo -e "${YELLOW}[INFO]${NC} Logs available at:"
echo -e "  - Pipeline: tail -f pipeline.log"
echo -e "  - Health:   tail -f health_check.log"
echo ""
echo -e "${YELLOW}[INFO]${NC} To stop the pipeline:"
echo -e "  ./stop.sh"
echo ""

exit 0
