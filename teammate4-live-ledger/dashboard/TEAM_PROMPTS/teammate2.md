# Teammate 2 — Systems Architect (OpenClaw Pipeline)

## Import instructions (add to top of your Python files when importing the Referee from teammate3)

```py
import sys
sys.path.insert(0, "../teammate3-referee-ai")
from referee import verify_payload
```

## Objective
Build the core Python logic loop linking the blockchain events to the AI validation steps using OpenClaw.

## Required behavior
- Connect to GOAT Network Testnet RPC using `web3.py`.
- Load contract instance from provided address + ABI.
- Listen/poll for `FundsLocked` events and capture `txId`, `buyer`, `seller`.
- Intercept a raw data payload string from a mock seller API and pass it to `verify_payload(raw_payload: str) -> str` imported from teammate 3 (returns "PASS" or "FAIL").
- On "PASS": build, sign, and send transaction calling `releaseFunds(txId)`.
- On "FAIL": build, sign, and send transaction calling `refundFunds(txId)`.
- Modular, asynchronous or clean polling script with robust logging and easy OpenClaw skill integration.

## ClawUp Deployment Requirement (added)
8. The entire OpenClaw skill environment and Python runtime must be structured to deploy seamlessly via the ClawUp platform. Ensure the directory layout includes a production setup or deployment configurations compatible with `clawup.sh` or the ClawUp UI so that when it goes live, it automatically triggers the agent registration on the GOAT Network Mainnet (ERC-8004) to make it searchable on 8004scan.io.

## Notes
- Use `verify_payload` from teammate 3 as shown in the import instructions above.
- Keep the script modular so it can be dropped into an OpenClaw custom skill folder.
