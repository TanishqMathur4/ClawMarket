// dashboard/lib/types.ts
// ── T4: TypeScript interfaces ──────────────────────────────────────────────

export type TransactionStatus = "PENDING" | "RELEASED" | "REFUNDED";
export type RefereeVerdict    = "PASS" | "FAIL";
export type TerminalLevel     = "INFO" | "WARN" | "ERROR";

export interface EscrowEntry {
  txId:              string;   // "0x..." (full or truncated for display)
  buyer:             string;   // wallet address
  seller:            string;   // wallet address
  amount:            string;   // e.g. "50.00 tUSDC"
  status:            TransactionStatus;
  refereeVerdict?:   RefereeVerdict;
  refereeReason?:    string;
  settlementTxHash?: string;
  timestamp:         string;   // ISO 8601
}

export interface TerminalLine {
  level:   TerminalLevel;
  message: string;
  ts:      string;             // display timestamp "HH:MM:SS"
}
