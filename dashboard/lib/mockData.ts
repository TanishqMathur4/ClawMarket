// dashboard/lib/mockData.ts
// ── T4: Mock transaction generator ────────────────────────────────────────
// TODO (Teammate 4): implement mock data helpers

import { EscrowEntry, TerminalLine } from "./types";

export function randomAddress(): string {
  // TODO: return a random 0x... address string
  return "0x0000000000000000000000000000000000000000";
}

export function randomTxId(): string {
  // TODO: return a random 0x... tx id string
  return "0x0000000000000000000000000000000000000000000000000000000000000000";
}

export function mockEscrowEntry(): EscrowEntry {
  // TODO: return a realistic mock EscrowEntry
  return {
    txId:      randomTxId(),
    buyer:     randomAddress(),
    seller:    randomAddress(),
    amount:    "50.00 tUSDC",
    status:    "PENDING",
    timestamp: new Date().toISOString(),
  };
}

export const DEMO_TERMINAL_LINES_PASS: TerminalLine[] = [
  { level: "INFO",  message: "Received payload from seller agent", ts: "" },
  { level: "INFO",  message: 'Parsing JSON structure...', ts: "" },
  { level: "INFO",  message: 'Found: temperature=22.5, humidity=65.3', ts: "" },
  { level: "INFO",  message: 'Verdict: PASS — Both fields present and within valid range.', ts: "" },
];

export const DEMO_TERMINAL_LINES_FAIL: TerminalLine[] = [
  { level: "INFO",  message: "Received payload from seller agent", ts: "" },
  { level: "INFO",  message: 'Parsing JSON structure...', ts: "" },
  { level: "WARN",  message: "Expected key 'humidity' — MISSING", ts: "" },
  { level: "ERROR", message: "Verdict: FAIL — Incomplete data payload.", ts: "" },
];
