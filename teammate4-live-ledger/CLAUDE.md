# ClawCourt — Teammate 4: Live Ledger Designer (UI & Presentation)

## Project Role
You are the **Frontend / UX Engineer** for ClawCourt. Your job is to build a real-time monitoring dashboard that makes machine-to-machine blockchain activity visible and dramatic for judges. Think security operations terminal, not consumer app.

This UI is the face of the entire demo. It needs to look technical, live, and impressive — even when running entirely on mock/looped data.

---

## Tech Stack
| Tool | Purpose |
|------|---------|
| Next.js 14+ (App Router) | React framework |
| Tailwind CSS | Styling |
| TypeScript | Type safety |
| `setInterval` / React hooks | Mock data animation loop |
| `fetch` polling | Reading `shared/log.json` from Teammate 2 |

---

## Three Primary Layout Zones

```
┌─────────────────┬──────────────────────┬──────────────────────┐
│  LEFT COLUMN    │   CENTER COLUMN      │   RIGHT COLUMN       │
│                 │                      │                      │
│  Active Escrow  │  Referee Terminal    │  Settlement Alerts   │
│  Boxes          │  (streaming logs)    │  (flash: GREEN/RED)  │
│                 │                      │                      │
│  txId hash      │  [INFO] Parsing...   │  ✅ FUNDS UNLOCKED   │
│  Buyer: 0x...   │  [WARN] Missing key  │  0xabc123...         │
│  Seller: 0x...  │  [ERROR] FAIL        │                      │
│  50.00 tUSDC    │                      │  🔴 REFUND TRIGGERED │
│  [PENDING]      │                      │  0xdef456...         │
└─────────────────┴──────────────────────┴──────────────────────┘
```

---

## Visual Design Specification

### Overall Theme
- Background: `#0a0a0a` (near-black)
- Primary text: `#00ff41` (matrix green) for active/PASS states
- Danger text: `#ff2233` (bright red) for FAIL/REFUND states
- Neutral text: `#8892b0` (slate blue-grey) for labels/metadata
- Borders: `1px solid #1e2d3d` (dark cyan-steel)
- Font: `font-mono` (JetBrains Mono or Courier — terminal feel)

### Component Styles
- **Cards**: `bg-[#0d1117] border border-[#1e2d3d] rounded-md p-4`
- **Status badges**: pill-shaped, color-coded:
  - PENDING → amber/yellow
  - RELEASED → bright green
  - REFUNDED → bright red
- **Terminal box**: monospace text, slight phosphor glow on green text (`text-shadow: 0 0 8px #00ff41`)
- **Flash alerts**: full-width banner with pulsing animation on trigger

---

## Data Source Strategy

### Phase 1 (Hours 1–5): Pure Mock with `setInterval`
Build the UI entirely with local mock state. Use a `setInterval` that steps through a transaction sequence every 3–5 seconds:
```
Step 1: New txId appears in "Active Escrow" (PENDING)
Step 2: Terminal starts printing referee logs
Step 3: Flash alert — SUCCESS (green) or FAILURE (red)
Step 4: Escrow card updates status
Step 5: Reset loop with new txId
```

### Phase 2 (Hour 6+): Poll `shared/log.json`
Coordinate with Teammate 2 on the file location. Options:
- **A. Direct file polling**: Next.js API route that reads `log.json` from disk; frontend polls `/api/log` every 2s
- **B. Static file serving**: Teammate 2 writes `log.json` into `/public/` so the browser can fetch it directly
- **C. Keep mock only**: If integration is risky on demo day, stay with mock — judges can't tell

---

## Component Structure

```
teammate4-live-ledger/
├── CLAUDE.md
├── architecture.md
├── app/
│   ├── layout.tsx              ← Dark theme global layout
│   ├── page.tsx                ← Main dashboard (3-column grid)
│   └── api/
│       └── log/route.ts        ← Reads shared/log.json for frontend
├── components/
│   ├── EscrowCard.tsx          ← Left column: single transaction card
│   ├── EscrowList.tsx          ← Left column: list container
│   ├── RefereeTerminal.tsx     ← Center: scrolling log lines
│   ├── SettlementAlert.tsx     ← Right: flash alert (pass/fail)
│   └── StatusBadge.tsx         ← Reusable PENDING/RELEASED/REFUNDED chip
├── hooks/
│   └── useDemoLoop.ts          ← setInterval mock animation hook
├── lib/
│   ├── mockData.ts             ← Mock transaction generator
│   └── types.ts                ← TypeScript interfaces
└── public/
    └── log.json                ← (Optional) Teammate 2 writes here
```

---

## TypeScript Interfaces

```typescript
// lib/types.ts

export type TransactionStatus = "PENDING" | "RELEASED" | "REFUNDED";
export type RefereeVerdict    = "PASS" | "FAIL";

export interface EscrowEntry {
  txId:              string;   // "0x..." (truncated for display)
  buyer:             string;   // wallet address
  seller:            string;   // wallet address
  amount:            string;   // "50.00 tUSDC"
  status:            TransactionStatus;
  refereeVerdict?:   RefereeVerdict;
  refereeReason?:    string;
  settlementTxHash?: string;
  timestamp:         string;   // ISO 8601
}
```

---

## Demo Loop Sequence (useDemoLoop.ts)
```typescript
const DEMO_SEQUENCE = [
  { phase: "lock",    delay: 0 },     // tx appears as PENDING
  { phase: "inspect", delay: 3000 },  // terminal starts logging
  { phase: "fail",    delay: 7000 },  // REFUND alert flashes
  { phase: "reset",   delay: 12000 }, // clear, new tx starts
];
```
Loop this indefinitely. Add randomization so each cycle feels slightly different.

---

## Coding Conventions
- TypeScript strict mode: `"strict": true` in `tsconfig.json`
- No inline styles — Tailwind only
- All components are functional components with typed props
- Use `useEffect` + `useState` for animation state
- Keep `useDemoLoop` hook in `/hooks/` — import it from `page.tsx`
- Use `cn()` utility (from `clsx` + `tailwind-merge`) for conditional class names

---

## Integration Touchpoints
- **← Teammate 2** writes `shared/log.json` (or `public/log.json`) with transaction data
- **← Teammate 1** contract address used for block explorer links
- **← Teammate 3** `refereeReason` strings displayed in the terminal panel

---

## Hour-by-Hour Goals
| Hour | Goal |
|------|------|
| 1 | `npx create-next-app`, Tailwind setup, dark theme layout |
| 2 | Build `EscrowCard`, `RefereeTerminal`, `SettlementAlert` components with static mock data |
| 3 | Wire up `useDemoLoop` hook — animated cycle running |
| 4 | Polish visuals: glow effects, flash animations, terminal scrolling |
| 5 | Build `/api/log` route to serve `log.json`; test with fake file |
| 6 | Connect to real `log.json` from Teammate 2; verify data flows |
| 7–8 | Final polish: transitions, pulsing indicators, judge-ready demo loop |

---

## Common Pitfalls
- **CORS / file access**: Browser can't read arbitrary local files — use a Next.js API route or serve from `/public/`
- **Stale data**: Set polling interval to 2–3s; show a "last updated" timestamp
- **Long addresses**: Truncate wallet addresses: `0x1234...abcd` using `.slice(0, 6) + "..." + .slice(-4)`
- **Too many re-renders**: Memoize `EscrowCard` with `React.memo`; only re-render on status change
- **Terminal overflow**: Auto-scroll terminal to bottom on new log entry with `useEffect` + `scrollTop = scrollHeight`
