// dashboard/hooks/useDemoLoop.ts
// ── T4: Mock animation loop ────────────────────────────────────────────────
// TODO (Teammate 4): implement the setInterval demo cycle
// Drives the UI through LOCK → INSPECT → SETTLE → RESET indefinitely.

import { useEffect } from "react";

export function useDemoLoop() {
  useEffect(() => {
    // TODO: implement setInterval stepping through DEMO_SEQUENCE
    // Step 1 (0ms):    New EscrowCard appears — PENDING
    // Step 2 (3000ms): Terminal lines stream in
    // Step 3 (7000ms): SettlementAlert flashes (alternating PASS/FAIL)
    // Step 4 (12000ms): Reset, new txId, repeat
  }, []);
}
