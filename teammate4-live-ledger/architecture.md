# Architecture — Teammate 4: Live Ledger Dashboard

## Position in the Overall System

```
┌──────────────────────────────────────────────────────────┐
│                  shared/log.json                         │
│  (written by Teammate 2's pipeline.py)                   │
└───────────────────┬──────────────────────────────────────┘
                    │ HTTP GET /api/log (every 2s)
                    ▼
┌──────────────────────────────────────────────────────────┐
│              Next.js App (YOU ARE HERE)                  │
│                                                          │
│  ┌──────────────┐ ┌──────────────────┐ ┌──────────────┐ │
│  │  EscrowList  │ │ RefereeTerminal  │ │ SettlementA. │ │
│  │  (left)      │ │ (center)         │ │ (right)      │ │
│  └──────────────┘ └──────────────────┘ └──────────────┘ │
│            ▲               ▲                  ▲          │
│            └───────────────┴──────────────────┘          │
│                  useDemoLoop / useLiveLog                 │
└──────────────────────────────────────────────────────────┘
                    │ displayed to
                    ▼
              Judges / Audience
```

---

## Page Layout Architecture

```
viewport (100vw × 100vh, bg-[#0a0a0a])
│
└── Header bar (full width)
│     "⚖️ CLAWCOURT  |  Machine-to-Machine Escrow Monitor"
│     Live indicator (blinking green dot + "LIVE")
│
└── 3-column grid (flex-1, overflow-hidden)
      │
      ├── LEFT (w-1/4)  — EscrowList
      │     Header: "ACTIVE ESCROWS"
      │     Scrollable list of EscrowCard components
      │
      ├── CENTER (w-1/2) — RefereeTerminal
      │     Header: "REFEREE PROCESSING TERMINAL"
      │     Dark terminal box, monospace, auto-scroll
      │     Log lines stream in with color-coded prefixes
      │
      └── RIGHT (w-1/4) — SettlementPanel
            Header: "SETTLEMENT STATUS"
            Flash alerts stack vertically
            Most recent alert is largest / most prominent
```

---

## Component Architecture

### `EscrowCard.tsx`
```
Props: EscrowEntry

Renders:
┌────────────────────────────────────┐
│ txId: 0x1234...abcd    [PENDING]   │ ← status badge (amber)
│ Buyer:  0xABCD...1234              │
│ Seller: 0xEFGH...5678              │
│ Amount: 50.00 tUSDC                │
│ 12:34:56 UTC                       │
└────────────────────────────────────┘

State transitions animate:
  PENDING → border: amber pulse
  RELEASED → border: green glow
  REFUNDED → border: red flash
```

### `RefereeTerminal.tsx`
```
Props: logLines: TerminalLine[]

interface TerminalLine {
  level:   "INFO" | "WARN" | "ERROR";
  message: string;
  ts:      string;
}

Renders one line per entry:
  [12:34:56] [INFO]  Received payload from seller agent
  [12:34:57] [INFO]  Parsing JSON structure...
  [12:34:57] [WARN]  Expected key 'humidity' — MISSING
  [12:34:58] [ERROR] Verdict: FAIL — incomplete data payload

Color map:
  INFO  → text-[#00ff41]     (matrix green)
  WARN  → text-[#ffa500]     (amber)
  ERROR → text-[#ff2233]     (bright red)

Auto-scrolls to bottom on new line.
New lines animate in with a fade+slide.
```

### `SettlementAlert.tsx`
```
Props: verdict: "PASS" | "FAIL", txHash: string, amount: string

PASS renders:
┌────────────────────────────────────────────────┐
│  ✅  FUNDS UNLOCKED                            │  ← green background flash
│     50.00 tUSDC released to seller             │
│     Tx: 0xabc...123  [View on Explorer ↗]      │
└────────────────────────────────────────────────┘

FAIL renders:
┌────────────────────────────────────────────────┐
│  🔴  AUTOMATED FALLBACK REFUND TRIGGERED       │  ← red pulse + shake anim
│     50.00 tUSDC returned to buyer              │
│     Tx: 0xdef...456  [View on Explorer ↗]      │
└────────────────────────────────────────────────┘

Animation: enters with scale-up + opacity transition, stays for 8s, fades out
```

---

## State Management

```
page.tsx (root)
│
├── entries: EscrowEntry[]        ← all transactions (from log.json or mock)
├── terminalLines: TerminalLine[] ← referee log stream
├── alerts: SettlementAlert[]     ← recent settlements (last 3)
│
├── useDemoLoop() — drives mock animation in absence of live data
│     setInterval every 3s, cycles through DEMO_SEQUENCE steps
│
└── useLiveLog() — polls /api/log every 2s when backend is ready
      Merges new entries from API into `entries` state
      Diff-compares to avoid re-rendering unchanged cards
```

---

## Demo Loop State Machine

```
[IDLE]
  │ setInterval fires
  ▼
[LOCK_FUNDS]
  │ New EscrowCard appears with status=PENDING
  │ txId, addresses, amount generated randomly
  ▼ (after 2s)
[REFEREE_INSPECTING]
  │ Terminal lines stream in one-by-one (200ms each):
  │   [INFO] Received payload from seller agent
  │   [INFO] Parsing JSON structure...
  │   [WARN] Expected key 'humidity' — MISSING   ← (on failure cycles)
  │   [ERROR] Verdict: FAIL                      ← (or [INFO] Verdict: PASS)
  ▼ (after 4s)
[SETTLEMENT]
  │ EscrowCard status → RELEASED or REFUNDED
  │ SettlementAlert flashes (green or red)
  ▼ (after 8s)
[RESET]
  │ Clear and start next cycle with new mock txId
  ▼
[LOCK_FUNDS] ← loop
```

Alternate between PASS and FAIL cycles so judges see both outcomes.

---

## Data Flow — Integration with Backend

```
Teammate 2 pipeline.py
  │ writes every ~5s
  ▼
shared/log.json
  └── [ { txId, buyer, seller, amount, status, refereeVerdict,
           refereeReason, settlementTxHash, timestamp }, ... ]

Next.js API route: /api/log
  │ reads file
  ▼
GET /api/log → JSON array

Frontend useLiveLog hook
  │ polls every 2s
  ▼
Merges into React state → re-renders updated components
```

---

## Animation & Visual Effects Spec

| Effect | CSS / Tailwind |
|--------|---------------|
| Green text glow | `drop-shadow-[0_0_8px_#00ff41]` |
| Pending pulse | `animate-pulse border-amber-500` |
| Released glow | `animate-none border-green-400 shadow-[0_0_12px_#4ade80]` |
| Refunded flash | `animate-ping border-red-500` (brief), then steady red |
| Terminal cursor | `::after { content: '▮'; animation: blink 1s step-end infinite }` |
| Alert entry | `animate-in slide-in-from-top-2 fade-in duration-300` |
| Alert shake (FAIL) | custom `@keyframes shake` applied on REFUNDED verdict |

---

## File Outputs / What Teammates Need From You

| Teammate | What they need |
|---------|---------------|
| Teammate 2 | Agreement on `log.json` schema (already defined in Teammate 2's architecture) |
| Teammate 1 | GOAT Testnet block explorer base URL for tx hash links |

Block explorer link format:
```typescript
const explorerUrl = (txHash: string) =>
  `https://explorer.goat.network/tx/${txHash}`;
  // (verify actual GOAT Testnet explorer URL with Teammate 1)
```

---

## Performance Notes

- EscrowList capped at 10 cards max (oldest auto-removed) — prevents DOM bloat during long demo
- Terminal capped at 100 lines — auto-trim oldest on overflow
- No external state management library needed (React `useState` is sufficient for hackathon scope)
- No database, no WebSocket — polling `log.json` is intentionally simple and reliable for demo day
