# Architecture — Teammate 2: OpenClaw Pipeline Layer

## Position in the Overall System

```
┌──────────────────────────────────────────────────────────────┐
│                    GOAT Network Testnet                      │
│  ClawCourtEscrow.sol                                         │
│       │  FundsLocked event                                   │
└───────┼──────────────────────────────────────────────────────┘
        │ (web3.py polls every 2s)
        ▼
┌──────────────────────────────────────────────────────────────┐
│                   pipeline.py  (YOU ARE HERE)                │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Event Listener  →  Payload Fetcher  →  Referee     │    │
│  │                                        (Teammate 3) │    │
│  └───────────────────────────┬─────────────────────────┘    │
│                              │ PASS / FAIL                   │
│  ┌───────────────────────────▼─────────────────────────┐    │
│  │  Transaction Builder + Signer (gateway private key) │    │
│  └───────────────────────────┬─────────────────────────┘    │
│                              │                               │
└──────────────────────────────┼───────────────────────────────┘
        │ releaseFunds / refundFunds        │ writes
        ▼                                  ▼
┌──────────────┐                  ┌─────────────────┐
│ GOAT Network │                  │ shared/log.json  │
│ (on-chain)   │                  │ (Teammate 4 UI) │
└──────────────┘                  └─────────────────┘
```

---

## Module Breakdown

```
teammate2-openclaw-pipeline/
├── CLAUDE.md
├── architecture.md
├── .env.example               ← safe template (no secrets)
├── pipeline.py                ← main orchestration loop
├── blockchain.py              ← web3.py helpers (connect, sign, send)
├── event_listener.py          ← polls FundsLocked events
├── log_writer.py              ← writes/updates shared/log.json
└── openclaw_skill.py          ← OpenClaw skill entrypoint wrapper
```

---

## Data Flow — Detailed

### Step 1: Connect & Load
```python
# blockchain.py
w3 = Web3(Web3.HTTPProvider(RPC_URL))
contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=ABI)
account  = Account.from_key(PRIVATE_KEY)
```

### Step 2: Event Polling Loop
```python
# event_listener.py — polls every 2 seconds
last_block = w3.eth.block_number
while True:
    events = contract.events.FundsLocked.get_logs(fromBlock=last_block)
    for event in events:
        txId   = event.args.txId
        buyer  = event.args.buyer
        seller = event.args.seller
        amount = event.args.amount
        handle_locked_event(txId, buyer, seller, amount)
    last_block = w3.eth.block_number
    sleep(2)
```

### Step 3: Payload Interception + Referee Call
```python
# pipeline.py
from teammate3_referee.referee import verify_payload

raw_payload = fetch_seller_payload(seller)   # mock or real
verdict     = verify_payload(raw_payload)    # "PASS" or "FAIL"
```

### Step 4: Settlement Transaction
```python
# blockchain.py
def settle(txId: bytes, verdict: str) -> str:
    if verdict == "PASS":
        fn = contract.functions.releaseFunds(txId)
    else:
        fn = contract.functions.refundFunds(txId)

    tx = fn.build_transaction({
        "from":     account.address,
        "nonce":    w3.eth.get_transaction_count(account.address, "pending"),
        "gas":      fn.estimate_gas({"from": account.address}) * 12 // 10,
        "gasPrice": w3.eth.gas_price,
    })
    signed   = account.sign_transaction(tx)
    tx_hash  = w3.eth.send_raw_transaction(signed.rawTransaction)
    receipt  = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
    return tx_hash.hex()
```

### Step 5: Log Writing
```python
# log_writer.py
def write_log(entry: dict):
    with filelock:
        log = read_log()
        log.append(entry)
        json.dump(log, open(LOG_PATH, "w"), indent=2)
```

---

## Log.json Entry Lifecycle

```
Event caught
    │
    ▼
{ status: "PENDING", txId, buyer, seller, amount, timestamp }
    │
    ▼ after Referee runs
{ ..., refereeVerdict: "PASS"|"FAIL", refereeReason: "..." }
    │
    ▼ after on-chain settlement
{ ..., status: "RELEASED"|"REFUNDED", settlementTxHash: "0x..." }
```

---

## Concurrency Model

```
Main Thread:
  └── polling loop (event_listener)
        └── on event: spawn asyncio task or thread
              ├── fetch payload
              ├── call verify_payload (blocking, ~1-2s LLM call)
              ├── sign & send transaction
              └── update log.json
```

For the hackathon, a simple synchronous blocking approach is fine — transactions are sequential and the demo won't have parallel events. For production: use `asyncio` with a task queue.

---

## Error Handling Strategy

| Error Type | Handling |
|-----------|---------|
| RPC connection failure | Retry with exponential backoff (3 attempts) |
| Transaction reverted | Log error + write FAILED status to log.json |
| verify_payload raises | Treat as FAIL; log the exception |
| log.json write conflict | Use threading.Lock for atomic writes |
| Timeout waiting for receipt | Log warning; continue polling |

---

## Security Considerations

- Private key loaded from `.env` — never logged, never hardcoded
- All transaction building done locally (no remote signing)
- Gateway wallet holds only the gas needed (no excess ETH/funds)
- `log.json` contains only public on-chain data — safe to expose to frontend

---

## Integration Checkpoints

| Milestone | What to verify |
|-----------|---------------|
| RPC connected | `w3.eth.block_number` returns a number |
| Contract instantiated | `contract.functions.lockFunds` exists |
| Event detected | Log shows `FundsLocked` caught with correct args |
| Referee called | `verify_payload` returns "PASS" or "FAIL" |
| Tx sent | `settlementTxHash` appears in log.json |
| Frontend reads it | Teammate 4 confirms their UI updates |
