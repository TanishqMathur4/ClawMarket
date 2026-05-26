---
# OpenClaw skill manifest
# Assumption: ClawUp reads SKILL.md with this frontmatter to discover and deploy the skill.
# Field names follow the standard OpenClaw skill pattern (name, description, version,
# runtime, entrypoint, invocation, requires). Adjust if the hackathon organiser specifies
# a different schema.

name: clawcourt-pipeline
version: 0.2.0
description: >
  ClawCourt escrow pipeline. Listens for FundsLocked events on GOAT Network,
  calls the AI Referee to validate seller output, and settles on-chain via
  releaseFunds or refundFunds. Writes shared/log.json for the live dashboard.
runtime: python3.11
entrypoint: openclaw_skill.py
invocation: autonomous   # ClawUp starts this skill automatically; it is not user-triggered
long_running: true       # pipeline loop runs indefinitely

requires:
  - web3>=6.0.0
  - python-dotenv>=1.0.0

env:
  # All values must be present in the ClawUp environment before deployment.
  # See .env.production.example for descriptions.
  required:
    - GOAT_RPC_URL
    - GATEWAY_PRIVATE_KEY
    - CONTRACT_ADDRESS
    - TUSDC_ADDRESS
    - IDENTITY_REGISTRY_ADDRESS
    - AGENT_JSON_URI
  optional:
    - LOG_FILE_PATH          # default: ../shared/log.json
    - MOCK_EVENT_INTERVAL    # default: 4 (seconds between mock events)

on_deploy:
  # Assumption: ClawUp honours an `on_deploy` list of shell commands that run
  # once after the container/environment is ready, before the entrypoint starts.
  - python3 register_agent.py

tags:
  - escrow
  - blockchain
  - goat-network
  - erc-8004
  - clawcourt
---

# ClawCourt Pipeline Skill

This skill is the **pipeline layer** of ClawCourt. It is the glue between the
smart contract, the AI Referee, and the live dashboard.

## What it does

1. Connects to GOAT Network via web3.py
2. Polls the `ClawCourtEscrow` contract for `FundsLocked` events every 2 seconds
3. For each event, calls the AI Referee (`verify_payload`) to validate the seller's work
4. Signs and broadcasts `releaseFunds` (PASS) or `refundFunds` (FAIL) on-chain
5. Writes every state transition to `shared/log.json` for the dashboard

## Running locally (mock mode)

```bash
MOCK_MODE=true LOG_FILE_PATH=../shared/log.json python3 pipeline.py
```

## Running against a real contract

Fill in `.env` from `.env.example` then:

```bash
python3 pipeline.py
```
