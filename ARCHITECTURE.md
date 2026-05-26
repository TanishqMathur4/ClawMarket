1# ClawCourt — Master Architecture

> **ClawCourt** is an automated escrow and dispute-resolution middleware layer for AI-agent machine-to-machine commerce, built on the GOAT Network Testnet.

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          GOAT Network Testnet (Chain ID: 2345)           │
│                                                                          │
│   ┌─────────────┐   tUSDC.approve()    ┌──────────────────────────────┐ │
│   │ Buyer Agent │ ───────────────────► │    ClawCourtEscrow.sol       │ │
│   │             │   lockFunds()        │    (contracts/)   T1         │ │
│   └─────────────┘                      │                              │ │
│                                        │  PENDING → RELEASED/REFUNDED │ │
│   ┌─────────────┐  releaseFunds()      │  tUSDC held in escrow        │ │
│   │  Gateway    │ ──────────────────►  │                              │ │
│   │ (pipeline/) │  refundFunds()       └──────────────┬───────────────┘ │
│   │    T2       │ ◄──── Events ────────────────────── │                 │
│   └──────┬──────┘                                     │                 │
└──────────┼─────────────────────────────────────────────────────────────┘
           │
           │ writes
           ▼
┌──────────────────────┐     calls      ┌───────────────────────────────┐
│  pipeline/           │ ─────────────► │  referee/                     │
│  pipeline.py   T2    │                │  referee.py             T3    │
│  blockchain.py       │ ◄─ PASS/FAIL ─ │  verify_payload()             │
│  event_listener.py   │                │  Pydantic + Claude Haiku      │
│  log_writer.py       │                └───────────────────────────────┘
└──────────┬───────────┘
           │ writes
           ▼
┌──────────────────────┐     polls      ┌───────────────────────────────┐
│  shared/log.json     │ ◄─────────────  │  dashboard/                  │
│  (shared artifact)   │                │  Next.js App            T4    │
│                      │                │  EscrowList + Terminal +       │
└──────────────────────┘                │  SettlementAlert              │
                                        └───────────────────────────────┘
```

---

## Unified Repository Structure

```
ClawMarket/
│
├── ARCHITECTURE.md              ← This file (master)
├── CLAUDE.md                    ← Master AI assistant context
├── .gitignore
├── .env.example                 ← All environment variables (all teammates)
├── requirements.txt             ← Python deps: web3, anthropic, pydantic
├── package.json                 ← Node deps: hardhat, openzeppelin, ethers
├── hardhat.config.js            ← GOAT Testnet (chainId: 2345) config
│
├── shared/                      ← Cross-team artifacts (read/write by multiple teams)
│   ├── contract_meta.json       ← T1 writes → T2 + T4 read (address + ABI)
│   └── log.json                 ← T2 writes → T4 reads (transaction log)
│
├── contracts/                   ── T1: Smart Contract ──────────────────────
│   └── ClawCourtEscrow.sol      ← Primary deliverable (escrow + state machine)
│
├── scripts/                     ── T1: Deployment ──────────────────────────
│   └── deploy.js                ← Hardhat deploy to GOAT Testnet
│
├── test/                        ── T1: Contract Tests ──────────────────────
│   └── ClawCourtEscrow.test.js  ← Hardhat unit tests (happy + failure paths)
│
├── pipeline/                    ── T2: OpenClaw Pipeline ───────────────────
│   ├── pipeline.py              ← Main orchestration loop
│   ├── blockchain.py            ← web3.py helpers (connect, sign, send)
│   ├── event_listener.py        ← Polls FundsLocked events every 2s
│   ├── log_writer.py            ← Writes/updates shared/log.json
│   └── openclaw_skill.py        ← OpenClaw skill entrypoint wrapper
│
├── referee/                     ── T3: AI Referee ──────────────────────────
│   ├── referee.py               ← verify_payload() — PRIMARY public API
│   ├── prompts.py               ← REFEREE_SYSTEM_PROMPT constant
│   ├── models.py                ← Pydantic RefereeVerdict model
│   └── test_referee.py          ← Local tests for both mock payloads
│
├── dashboard/                   ── T4: Live Ledger UI ──────────────────────
│   ├── app/
│   │   ├── layout.tsx           ← Dark theme global layout
│   │   ├── page.tsx             ← 3-column dashboard grid
│   │   └── api/log/route.ts     ← Next.js API route → reads shared/log.json
│   ├── components/
│   │   ├── EscrowCard.tsx       ← Single transaction card (L column)
│   │   ├── EscrowList.tsx       ← List container (L column)
│   │   ├── RefereeTerminal.tsx  ← Scrolling log terminal (C column)
│   │   ├── SettlementAlert.tsx  ← Flash alert GREEN/RED (R column)
│   │   └── StatusBadge.tsx      ← PENDING / RELEASED / REFUNDED chip
│   ├── hooks/
│   │   └── useDemoLoop.ts       ← setInterval mock animation (Phase 1)
│   ├── lib/
│   │   ├── mockData.ts          ← Mock transaction generator
│   │   └── types.ts             ← TypeScript interfaces (EscrowEntry etc.)
│   └── public/
│       └── log.json             ← Optional: T2 writes here for direct serving
│
├── teammate1-smart-contract/    ← Reference docs only (no code)
│   ├── CLAUDE.md
│   └── architecture.md
├── teammate2-openclaw-pipeline/ ← Reference docs only (no code)
│   ├── CLAUDE.md
│   └── architecture.md
├── teammate3-referee-ai/        ← Reference docs only (no code)
│   ├── CLAUDE.md
│   └── architecture.md
└── teammate4-live-ledger/       ← Reference docs only (no code)
    ├── CLAUDE.md
    └── architecture.md
```

---

## Team Responsibilities

| Teammate | Role | Primary Deliverable | Language |
|----------|------|---------------------|----------|
| **T1** | Smart Contract Lead | `contracts/ClawCourtEscrow.sol` | Solidity ^0.8.20 |
| **T2** | Pipeline / Systems Architect | `pipeline/pipeline.py` | Python 3.11+ |
| **T3** | AI Referee / Trust Engineer | `referee/referee.py` | Python 3.11+ |
| **T4** | Frontend / UX Engineer | `dashboard/` (Next.js app) | TypeScript |

---

## Data Flow — End to End

### Happy Path (data passes validation)
```
1. Buyer → tUSDC.approve(escrowAddress, amount)
2. Buyer → ClawCourtEscrow.lockFunds(txId, sellerAddr, amount)
   └─ Contract pulls tUSDC via transferFrom
   └─ Emits FundsLocked(txId, buyer, seller, amount)
   └─ shared/log.json entry: { status: "PENDING", ... }
3. pipeline.py catches FundsLocked event
4. pipeline.py calls referee/referee.py:verify_payload(raw_payload)
   └─ Claude Haiku validates payload against IoT schema
   └─ Returns "PASS"
5. pipeline.py → ClawCourtEscrow.releaseFunds(txId)
   └─ Contract sends tUSDC to seller
   └─ Emits FundsReleased(txId, seller, amount)
   └─ shared/log.json entry updated: { status: "RELEASED", settlementTxHash: "0x..." }
6. dashboard/ polls /api/log every 2s
   └─ EscrowCard turns green
   └─ SettlementAlert flashes GREEN: "✅ FUNDS UNLOCKED"
```

### Failure Path (bad / corrupted data)
```
Steps 1–3 identical
4. verify_payload returns "FAIL"
5. pipeline.py → ClawCourtEscrow.refundFunds(txId)
   └─ Contract sends tUSDC back to buyer
   └─ Emits FundsRefunded(txId, buyer, amount)
   └─ shared/log.json: { status: "REFUNDED", ... }
6. dashboard/ → EscrowCard turns red, SettlementAlert flashes RED: "🔴 REFUND TRIGGERED"
```

---

## Shared Artifact Schemas

### `shared/contract_meta.json` (T1 → T2, T4)
```json
{
  "network":     "GOAT Testnet",
  "chainId":     2345,
  "address":     "0x<deployed_address>",
  "deployedAt":  "<block number or timestamp>",
  "abi":         [ ... full ABI array ... ]
}
```

### `shared/log.json` (T2 → T4)
```json
[
  {
    "txId":              "0xabc123...",
    "buyer":             "0x...",
    "seller":            "0x...",
    "amount":            "50.00",
    "status":            "PENDING | RELEASED | REFUNDED",
    "refereeVerdict":    "PASS | FAIL",
    "refereeReason":     "Both fields present and within valid range.",
    "settlementTxHash":  "0x...",
    "timestamp":         "2024-01-01T12:00:00Z"
  }
]
```

---

## Smart Contract: `ClawCourtEscrow.sol`

### State Machine
```
  [NEW txId] ──lockFunds()──► [PENDING]
                                  │
                  ┌───────────────┴───────────────┐
                  │                               │
           releaseFunds()                   refundFunds()
         (Referee: PASS)                 (Referee: FAIL)
                  │                               │
                  ▼                               ▼
            [RELEASED]                       [REFUNDED]
          funds → seller                  funds → buyer
```
Both terminal states are **irreversible**.

### Functions
| Function | Caller | Action |
|----------|--------|--------|
| `lockFunds(bytes32, address, uint256)` | Buyer/Gateway | Pulls tUSDC from buyer → PENDING |
| `releaseFunds(bytes32)` | Owner (Gateway) | Sends tUSDC to seller → RELEASED |
| `refundFunds(bytes32)` | Owner (Gateway) | Returns tUSDC to buyer → REFUNDED |

### Events
- `FundsLocked(bytes32 indexed txId, address buyer, address seller, uint256 amount)`
- `FundsReleased(bytes32 indexed txId, address seller, uint256 amount)`
- `FundsRefunded(bytes32 indexed txId, address buyer, uint256 amount)`

### Security
| Threat | Mitigation |
|--------|-----------|
| Reentrancy | `ReentrancyGuard` on all state-changing functions |
| Silent token failure | `SafeERC20.safeTransfer` / `safeTransferFrom` |
| Unauthorized release | `onlyOwner` (owner = Gateway wallet) |
| Double-spend | Revert if `status != PENDING` |
| txId collision | Off-chain: `keccak256(abi.encodePacked(buyer, block.timestamp, nonce))` |

---

## AI Referee: `referee/referee.py`

### Decision Logic
```
raw_payload arrives
      │
      ├─ Parseable JSON?  ──No──► FAIL
      │       │ Yes
      ├─ Has temperature + humidity?  ──No──► FAIL
      │       │ Yes
      ├─ Both numeric + in range?  ──No──► FAIL
      │       │ Yes
      └──────► PASS
```

### Target Schema (IoT sensor payload)
```json
{ "temperature": <float -50.0 to 100.0>, "humidity": <float 0.0 to 100.0> }
```

### LLM Setup
- Model: `claude-haiku-4-5-20251001` (fast, cheap)
- Output enforced by Pydantic: `{ "status": "PASS"|"FAIL", "reason": "..." }`
- **Never returns anything other than `"PASS"` or `"FAIL"` to the caller**

---

## Live Ledger Dashboard: `dashboard/`

### 3-Column Layout
```
┌─────────────────┬──────────────────────┬──────────────────────┐
│  LEFT (25%)     │   CENTER (50%)       │   RIGHT (25%)        │
│                 │                      │                      │
│  Active Escrow  │  Referee Terminal    │  Settlement Alerts   │
│  Cards          │  (streaming logs)    │  (flash GREEN/RED)   │
│                 │                      │                      │
│  txId hash      │  [INFO] Parsing...   │  ✅ FUNDS UNLOCKED   │
│  Buyer: 0x...   │  [WARN] Missing key  │  50.00 tUSDC         │
│  Seller: 0x...  │  [ERROR] FAIL        │                      │
│  50.00 tUSDC    │                      │  🔴 REFUND TRIGGERED │
│  [PENDING]      │                      │  50.00 tUSDC         │
└─────────────────┴──────────────────────┴──────────────────────┘
```

### Visual Theme
- Background: `#0a0a0a` | Green text: `#00ff41` | Red: `#ff2233`
- Font: monospace (terminal feel) | Borders: `#1e2d3d`

---

## Integration Dependency Map

```
T1 ──(contract_meta.json)──────────────────► T2  (needs address + ABI)
T1 ──(contract_meta.json)──────────────────► T4  (block explorer link)
T2 ──(calls)───────────────────────────────► T3  (verify_payload)
T3 ──(PASS/FAIL + reason)──────────────────► T2  (settlement decision)
T2 ──(log.json)────────────────────────────► T4  (dashboard data)
```

**Critical path order:** T1 → T2/T3 in parallel → T4

---

## Environment Variables (unified `.env`)

```
# ── T1 / T2: Chain ─────────────────────────────────
GOAT_RPC_URL=https://rpc.testnet3.goat.network
PRIVATE_KEY=<deployer / gateway wallet private key>
TUSDC_ADDRESS=<tUSDC contract address on GOAT Testnet>
GOAT_EXPLORER_API_KEY=

# ── T2: Pipeline ────────────────────────────────────
GATEWAY_PRIVATE_KEY=<same as PRIVATE_KEY or separate>
CONTRACT_ADDRESS=<filled after T1 deploys>
LOG_FILE_PATH=./shared/log.json

# ── T3: AI Referee ──────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...
LOG_LEVEL=INFO
```

---

## Tech Stack Summary

| Layer | Tool | Version |
|-------|------|---------|
| Blockchain | GOAT Network Testnet | EVM, Chain ID 2345 |
| Smart Contract | Solidity | ^0.8.20 |
| Contract Tooling | Hardhat + OpenZeppelin | hardhat 3.x |
| Pipeline | Python + web3.py | 3.11+ |
| AI Referee | Anthropic SDK + Pydantic | claude-haiku-4-5 |
| Frontend | Next.js + Tailwind + TypeScript | 14+ |
| Asset | tUSDC (ERC-20, 6 decimals) | GOAT Testnet |

---

## Hour-by-Hour Milestone Map

| Hour | T1 | T2 | T3 | T4 |
|------|----|----|----|-----|
| 1 | Write + compile `ClawCourtEscrow.sol` | Setup + web3.py connection | Setup + Pydantic model | `create-next-app` + layout |
| 2 | Hardhat unit tests | Mock event polling loop | `verify_payload` working | Static component build |
| 3 | Deploy to GOAT Testnet | Integrate T3's referee | Share module with T2 | `useDemoLoop` animated |
| 4 | Write `shared/contract_meta.json` | Swap mock → real contract | Polish + edge cases | Visual polish + glow FX |
| 5 | Support T2 with ABI Qs | Wire `log.json` | Help T4 terminal display | `/api/log` route |
| 6 | — | Full integration run | — | Connect to real log.json |
| 7–8 | — | Edge case handling | — | Demo-ready polish |
