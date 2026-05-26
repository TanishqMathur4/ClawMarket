# ClawCourt — Teammate 1: Smart Contract Lead

## Project Role
You are the **Web3 Backend / Smart Contract engineer** for ClawCourt — an automated escrow and dispute-resolution middleware layer for AI-agent machine-to-machine commerce.

Your deliverable is a single Solidity contract (`ClawCourtEscrow.sol`) that acts as the financial lockbox the rest of the system depends on.

---

## Tech Stack
| Tool | Purpose |
|------|---------|
| Solidity ^0.8.20 | Contract language |
| OpenZeppelin Contracts | Ownable, SafeERC20, ReentrancyGuard |
| Remix IDE | Browser-based compile + deploy |
| MetaMask | Wallet / transaction signing |
| GOAT Network Testnet | Target chain (EVM-compatible, Chain ID: 2345) |
| tUSDC | Test ERC-20 token used as payment asset |

---

## Target Chain Details
- **Network Name:** GOAT Network Testnet
- **Chain ID:** 2345
- **RPC URL:** (check GOAT Network docs for current testnet RPC)
- **Asset:** tUSDC — treat as a standard ERC-20 contract; get the deployed address from the GOAT testnet faucet/docs

---

## Contract: `ClawCourtEscrow.sol`

### Core Data Structures
```
bytes32 txId  →  Escrow { buyer, seller, amount, Status }
Status: PENDING | RELEASED | REFUNDED
```

### Required Functions
| Function | Caller | Action |
|----------|--------|--------|
| `lockFunds(bytes32, address, uint256)` | Buyer / Gateway | Pulls tUSDC from buyer into contract; sets PENDING |
| `releaseFunds(bytes32)` | Contract Owner (Gateway) | Sends funds to seller; sets RELEASED |
| `refundFunds(bytes32)` | Contract Owner (Gateway) | Sends funds back to buyer; sets REFUNDED |

### Required Events
- `FundsLocked(bytes32 indexed txId, address buyer, address seller, uint256 amount)`
- `FundsReleased(bytes32 indexed txId, address seller, uint256 amount)`
- `FundsRefunded(bytes32 indexed txId, address buyer, uint256 amount)`

### Security Requirements
- Use `SafeERC20` for all token transfers (prevents silent failures)
- Use `ReentrancyGuard` on all state-changing functions
- `releaseFunds` and `refundFunds` must be `onlyOwner`
- Guard against double-spend: revert if status is not `PENDING` before acting
- No `selfdestruct`, no upgradeable proxy complexity needed for hackathon scope

---

## What to Produce for the Team
After deployment you must hand off **two artifacts** to Teammate 2:

1. **Contract Address** — the deployed address on GOAT Testnet
2. **ABI JSON array** — copy from Remix "Compilation Details → ABI" panel

Drop both into `shared/contract_meta.json` in the team repo:
```json
{
  "address": "0x...",
  "abi": [ ... ]
}
```

---

## Coding Conventions
- Solidity SPDX header: `// SPDX-License-Identifier: MIT`
- Compiler pragma: `^0.8.20`
- Import from OpenZeppelin via npm-style path: `@openzeppelin/contracts/...`
- Use `custom errors` instead of string reverts for gas efficiency (e.g., `error NotPending()`)
- NatSpec comments on every public function

---

## Integration Touchpoints
- **→ Teammate 2** receives your contract address + ABI to wire up the web3.py polling script
- **→ Teammate 4** may display your emitted event data (txId, amounts, addresses) on the dashboard

---

## Hour-by-Hour Goals
| Hour | Goal |
|------|------|
| 1–2 | Write and compile `ClawCourtEscrow.sol` in Remix; run unit tests with Hardhat or Remix's built-in tests |
| 3 | Deploy to GOAT Testnet via MetaMask; verify on block explorer |
| 4 | Copy address + ABI into `shared/contract_meta.json`; ping Teammate 2 |
| 5–8 | Support Teammate 2 with ABI questions; optional: write a simple Hardhat test script |

---

## Common Pitfalls
- **tUSDC approval**: The buyer must call `tUSDC.approve(escrowAddress, amount)` before `lockFunds` — remind the demo script to do this
- **Owner**: On deployment, `msg.sender` becomes owner; transfer ownership to the gateway wallet address Teammate 2 will use to sign `releaseFunds`/`refundFunds`
- **txId collision**: Use `keccak256(abi.encodePacked(buyer, block.timestamp, nonce))` for unique IDs in the demo script
