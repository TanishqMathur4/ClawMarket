# ClawCourt — Teammate 2: Systems Architect (OpenClaw Pipeline)

## Project Role
You are the **Systems Architect / Pipeline Engineer** for ClawCourt. You own the glue layer — the Python script that sits between the blockchain, the AI Referee, and the frontend dashboard. Everything flows through you.

Your code listens for on-chain events, calls the AI Referee, decides whether to release or refund funds, signs and broadcasts those on-chain transactions, and writes a `log.json` file that Teammate 4's frontend reads in real time.

---

## Tech Stack
| Tool | Purpose |
|------|---------|
| Python 3.11+ | Primary language |
| web3.py | Ethereum / EVM blockchain interaction |
| OpenClaw | Skill environment that wraps and runs this script |
| asyncio | Async event polling |
| logging | Structured console + file logging |
| json | Writing `shared/log.json` for the frontend |

---

## External Dependencies
```
pip install web3 python-dotenv
```

---

## Environment Variables (`.env` file)
```
GOAT_RPC_URL=<GOAT Network Testnet RPC endpoint>
GATEWAY_PRIVATE_KEY=<private key of the wallet that owns ClawCourtEscrow>
CONTRACT_ADDRESS=<deployed address from Teammate 1>
TUSDIC_ADDRESS=<tUSDC token contract address>
LOG_FILE_PATH=../shared/log.json
```

> ⚠️ Never commit `.env` to the repo. Add it to `.gitignore`.

---

## Inputs You Depend On (from teammates)

| Source | Artifact | When available |
|--------|----------|----------------|
| Teammate 1 | `shared/contract_meta.json` → `address` + `abi` | Hour 4 |
| Teammate 3 | `verify_payload(raw_payload: str) -> str` function | Hour 3–4 |

---

## Primary Script: `pipeline.py`

### Logical Steps
```
1. Load .env, load contract_meta.json
2. Connect to GOAT Network RPC via web3.py
3. Instantiate ClawCourtEscrow contract object (address + ABI)
4. Poll / subscribe to FundsLocked events
5. On event:
   a. Extract txId, buyer, seller from event args
   b. Write PENDING entry to log.json
   c. Fetch raw payload from seller mock API (or Teammate 3's mock function)
   d. Call verify_payload(raw_payload) → "PASS" or "FAIL"
   e. Build & sign transaction:
      - PASS → releaseFunds(txId)
      - FAIL → refundFunds(txId)
   f. Send transaction, capture tx hash
   g. Update log.json entry with result + tx hash
```

### Shared Log File Schema (`shared/log.json`)
```json
[
  {
    "txId": "0xabc123...",
    "buyer": "0x...",
    "seller": "0x...",
    "amount": "50.00",
    "status": "PENDING | RELEASED | REFUNDED",
    "refereeVerdict": "PASS | FAIL",
    "refereeReason": "...",
    "settlementTxHash": "0x...",
    "timestamp": "2024-01-01T12:00:00Z"
  }
]
```

Teammate 4's frontend polls this file (or a simple `/api/log` endpoint you expose) every few seconds.

---

## OpenClaw Skill Integration Notes
- Wrap the core polling loop as an OpenClaw Skill so it can be invoked, paused, and logged within the OpenClaw environment
- Keep the business logic in `pipeline.py` pure Python so it's testable outside of OpenClaw
- OpenClaw skill entrypoint should just `import pipeline` and call `run_pipeline()`

---

## Coding Conventions
- Use `logging` module with format: `[%(asctime)s] %(levelname)s — %(message)s`
- All blockchain calls wrapped in try/except with meaningful error messages
- Functions should be small and single-purpose; avoid monolithic scripts
- Use `eth_account` from web3.py for transaction signing (never expose private key in logs)
- Transaction: build → sign locally → send raw (don't rely on unlocked node)

---

## Integration Touchpoints
- **← Teammate 1** supplies contract address + ABI (via `shared/contract_meta.json`)
- **← Teammate 3** supplies `verify_payload()` function (import directly)
- **→ Teammate 4** consumes `shared/log.json` for the live dashboard

---

## Hour-by-Hour Goals
| Hour | Goal |
|------|------|
| 1–2 | Set up project structure, web3.py connection to GOAT RPC, mock contract interaction |
| 3 | Build polling loop with mock events; integrate Teammate 3's `verify_payload` |
| 4 | Swap mock contract for real deployed address from Teammate 1; end-to-end test |
| 5 | Wire up `log.json` writing; coordinate with Teammate 4 on schema |
| 6–7 | Full integration run: lock → inspect → refund/release with real contract |
| 8 | Demo loop polish; handle edge cases (RPC timeout, bad tx) |

---

## Common Pitfalls
- **Nonce management**: If you send multiple transactions rapidly, increment nonce manually or use `pending` block parameter
- **Gas estimation**: Use `contract.functions.releaseFunds(txId).estimate_gas()` then add 20% buffer
- **Event polling vs subscription**: GOAT Testnet may not support WebSocket subscriptions — default to polling `get_logs` every 2–3 seconds
- **tUSDC decimals**: tUSDC has 6 decimals. When displaying amounts, divide by 1e6
- **txId type**: Solidity `bytes32` maps to a Python `bytes` of length 32 in web3.py — use `HexBytes` carefully
