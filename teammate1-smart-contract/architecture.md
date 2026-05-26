# Architecture — Teammate 1: Smart Contract Layer

## Position in the Overall System

```
┌─────────────────────────────────────────────────────────────────┐
│                        GOAT Network Testnet                     │
│                                                                 │
│   ┌─────────────┐    lockFunds()    ┌──────────────────────┐   │
│   │ Buyer Agent │ ────────────────► │  ClawCourtEscrow.sol │   │
│   └─────────────┘                  │                      │   │
│                                    │  Status: PENDING     │   │
│                                    │  tUSDC held in       │   │
│   ┌─────────────┐  releaseFunds()  │  contract balance    │   │
│   │  Gateway    │ ────────────────►│                      │   │
│   │ (Teammate2) │  refundFunds()   │  Status: RELEASED /  │   │
│   └─────────────┘ ◄─── Events ─── │         REFUNDED     │   │
│                                    └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Contract State Machine

```
                  lockFunds()
  [NEW txId] ──────────────────► [PENDING]
                                     │
                      ┌──────────────┴──────────────┐
                      │                             │
               releaseFunds()               refundFunds()
             (Referee: PASS)              (Referee: FAIL)
                      │                             │
                      ▼                             ▼
                 [RELEASED]                    [REFUNDED]
               funds → seller               funds → buyer
```

Both terminal states are **irreversible** — no further state transitions are possible once a txId is settled.

---

## Data Model

```solidity
enum Status { PENDING, RELEASED, REFUNDED }

struct Escrow {
    address buyer;
    address seller;
    uint256 amount;      // in tUSDC smallest unit (6 decimals)
    Status  status;
}

mapping(bytes32 => Escrow) public escrows;
```

---

## Function Call Flow

### Happy Path (data passes validation)
```
1. Buyer calls tUSDC.approve(escrowAddr, amount)
2. Buyer (or Gateway) calls ClawCourtEscrow.lockFunds(txId, seller, amount)
   └─ Contract pulls tUSDC via transferFrom
   └─ Emits FundsLocked(txId, buyer, seller, amount)
3. Teammate 2 polls / listens for FundsLocked event
4. Teammate 3 Referee returns PASS
5. Gateway calls ClawCourtEscrow.releaseFunds(txId)
   └─ Contract sends tUSDC to seller
   └─ Emits FundsReleased(txId, seller, amount)
```

### Failure Path (corrupted / bad data)
```
1–3. Same as above
4. Teammate 3 Referee returns FAIL
5. Gateway calls ClawCourtEscrow.refundFunds(txId)
   └─ Contract sends tUSDC back to buyer
   └─ Emits FundsRefunded(txId, buyer, amount)
```

---

## Security Architecture

| Threat | Mitigation |
|--------|-----------|
| Reentrancy attack | `ReentrancyGuard` on `lockFunds`, `releaseFunds`, `refundFunds` |
| Silent token transfer failure | `SafeERC20.safeTransfer` / `safeTransferFrom` |
| Unauthorized fund release | `onlyOwner` modifier; owner = Gateway wallet |
| Double-spend / state replay | Guard: `require(escrow.status == PENDING)` before acting |
| txId collision | txId generated off-chain with sufficient entropy (keccak256 + timestamp + nonce) |
| Stuck funds | Both `releaseFunds` and `refundFunds` always move tokens out; no lock-forever path |

---

## File Structure

```
teammate1-smart-contract/
├── CLAUDE.md                    ← AI assistant context (this team)
├── architecture.md              ← This file
├── contracts/
│   └── ClawCourtEscrow.sol      ← Primary deliverable
├── scripts/
│   └── deploy.js                ← Optional Hardhat deploy script
└── test/
    └── ClawCourtEscrow.test.js  ← Optional Hardhat unit tests
```

---

## Shared Artifact Contract (Output to Team Repo)

```
shared/
└── contract_meta.json
    {
      "network": "GOAT Testnet",
      "chainId": 2345,
      "address": "0x<deployed_address>",
      "deployedAt": "<block number or timestamp>",
      "abi": [ ... full ABI array ... ]
    }
```

**Teammate 2** reads `address` and `abi` to instantiate the web3.py contract object.
**Teammate 4** may read `address` to display a block explorer link in the UI.

---

## Gas & Efficiency Notes

- Custom errors (`error NotPending()`) vs string reverts save ~50 gas per revert path
- Events are indexed on `txId` so Teammate 2 can filter by specific transaction without scanning all logs
- `mapping` lookup is O(1) — no array iteration needed
- No loops, no dynamic arrays → predictable gas costs
- tUSDC uses 6 decimals (like real USDC); all amounts stored as `uint256` in smallest unit

---

## Dependencies

```
npm install @openzeppelin/contracts
```

OpenZeppelin modules used:
- `Ownable` — ownership / access control
- `ReentrancyGuard` — re-entrancy protection
- `SafeERC20` — safe ERC-20 transfer wrappers
- `IERC20` — interface for tUSDC
