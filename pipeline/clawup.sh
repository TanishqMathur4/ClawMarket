#!/usr/bin/env bash
# ClawUp deployment entrypoint.
# Assumption: ClawUp executes this script inside the skill directory after
# provisioning the environment variables listed in clawup.json.
#
# Stages:
#   1. Validate required env vars
#   2. Install Python dependencies
#   3. Register agent on ERC-8004 (one-time, idempotent)
#   4. Start the OpenClaw pipeline skill

set -euo pipefail

log() { echo "[clawup] $(date -u '+%Y-%m-%dT%H:%M:%SZ') — $*"; }

# ── 1. Validate env ────────────────────────────────────────────────────────────
REQUIRED_VARS=(
  GOAT_RPC_URL
  GATEWAY_PRIVATE_KEY
  CONTRACT_ADDRESS
  TUSDC_ADDRESS
  IDENTITY_REGISTRY_ADDRESS
  AGENT_JSON_URI
)

missing=()
for var in "${REQUIRED_VARS[@]}"; do
  [[ -z "${!var:-}" ]] && missing+=("$var")
done

if [[ ${#missing[@]} -gt 0 ]]; then
  log "ERROR: missing required environment variables: ${missing[*]}"
  log "Set them in the ClawUp UI or .env.production before deploying."
  exit 1
fi

log "Environment validated."

# ── 2. Install dependencies ────────────────────────────────────────────────────
log "Installing Python dependencies..."
pip3 install -r requirements.txt --quiet
log "Dependencies installed."

# ── 3. Register agent on ERC-8004 ─────────────────────────────────────────────
log "Running ERC-8004 agent registration on GOAT Network..."
python3 register_agent.py
log "Agent registration complete."

# ── 4. Start the pipeline skill ───────────────────────────────────────────────
log "Starting ClawCourt pipeline skill..."
exec python3 openclaw_skill.py
