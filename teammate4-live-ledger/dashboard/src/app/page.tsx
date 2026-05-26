"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
type TxStatus = "PENDING" | "INSPECTING" | "RELEASED" | "REFUNDED";
type Tx = { id: string; buyer: string; seller: string; amount: string; status: TxStatus };
type LogFile = { transactions: Tx[]; logs: string[] };

// ── Known wallet labels ────────────────────────────────────────────────────
const ADDR_LABELS: Record<string, string> = {
  "0xa500b38564f0e64b841a5038f4b4910ea119d0b0": "ClawCourt Agent",
  "0x10c8d0880c520868f9d130b392d0f2ee51379064": "T2 Gateway",
  "0x8c7d534aa9cce2abe0fbb2a2b1daf4ec73abb711": "Escrow Contract",
};
function addrLabel(a: string) {
  return ADDR_LABELS[a.toLowerCase()] ?? a.slice(0, 6) + "…" + a.slice(-4);
}
function shortId(id: string) {
  if (id.length > 16) return id.slice(0, 8) + "…" + id.slice(-6);
  return id;
}

// ── Lifecycle step (0=Lock, 1=Inspect, 2=Settle) ──────────────────────────
function getStep(s: TxStatus) {
  if (s === "PENDING") return 0;
  if (s === "INSPECTING") return 1;
  return 2;
}

// ── Log line color by prefix ───────────────────────────────────────────────
function logColor(line: string) {
  const l = line.toLowerCase();
  if (l.includes("[error]") || l.includes("fail")) return "text-red-400";
  if (l.includes("[ok]") || l.includes("pass") || l.includes("released")) return "text-emerald-400";
  if (l.includes("[tx]") || l.includes("[settle]")) return "text-emerald-300";
  if (l.includes("[referee]")) return "text-cyan-300";
  if (l.includes("[lock]")) return "text-amber-300";
  if (l.includes("[warn]")) return "text-yellow-400";
  return "text-zinc-400";
}

// ── Status badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: TxStatus }) {
  const styles: Record<TxStatus, string> = {
    PENDING:    "bg-amber-900/50 text-amber-300 border-amber-700/40",
    INSPECTING: "bg-cyan-900/50 text-cyan-200 border-cyan-600/40 animate-pulse",
    RELEASED:   "bg-emerald-900/50 text-emerald-300 border-emerald-700/40",
    REFUNDED:   "bg-red-900/50 text-red-300 border-red-800/40",
  };
  const icons: Record<TxStatus, string> = {
    PENDING: "🔒", INSPECTING: "🤖", RELEASED: "✅", REFUNDED: "🔄",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${styles[status]}`}>
      {icons[status]} {status}
    </span>
  );
}

// ── 3-dot step progress indicator ─────────────────────────────────────────
function StepDots({ step }: { step: number }) {
  const labels = ["Lock", "Inspect", "Settle"];
  return (
    <div className="flex items-center mt-3 gap-0">
      {labels.map((label, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center min-w-0">
            <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
              i < step  ? "bg-emerald-400" :
              i === step ? "bg-cyan-400 ring-2 ring-cyan-400/30" :
                          "bg-zinc-700"
            }`} />
            <span className={`text-[8px] mt-0.5 whitespace-nowrap ${
              i === step ? "text-cyan-300" : i < step ? "text-emerald-500/80" : "text-zinc-600"
            }`}>{label}</span>
          </div>
          {i < 2 && (
            <div className={`h-px flex-1 mx-1 mb-3 transition-all duration-500 ${i < step ? "bg-emerald-500/50" : "bg-zinc-700"}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Fallback data (shown when log.json not found) ──────────────────────────
const FALLBACK_TXS: Tx[] = [
  { id: "0x9a3f1e72c4b508d163e7a2f9c0152d8e", buyer: "0xa500b38564F0E64b841A5038F4B4910ea119d0B0", seller: "0x10C8D0880C520868f9d130b392d0f2ee51379064", amount: "1.00 USDC.e", status: "RELEASED"   },
  { id: "0xc7d5f2a1e83094b6c21f7d5e3a9b042c", buyer: "0xa500b38564F0E64b841A5038F4B4910ea119d0B0", seller: "0x10C8D0880C520868f9d130b392d0f2ee51379064", amount: "0.50 USDC.e", status: "REFUNDED"   },
  { id: "0xe1b2c3d4f5a6b7c8d9e0f1a2b3c4d5e6", buyer: "0xa500b38564F0E64b841A5038F4B4910ea119d0B0", seller: "0x10C8D0880C520868f9d130b392d0f2ee51379064", amount: "2.00 USDC.e", status: "INSPECTING" },
  { id: "0xf3c2b1a0e9d8c7b6a5f4e3d2c1b0a9f8", buyer: "0xa500b38564F0E64b841A5038F4B4910ea119d0B0", seller: "0x10C8D0880C520868f9d130b392d0f2ee51379064", amount: "0.75 USDC.e", status: "PENDING"    },
];
const FALLBACK_LOGS: string[] = [
  "[LOCK] 0x9a3f…d8e — ClawCourt Agent locked 1.00 USDC.e into escrow",
  "[REFEREE] 0x9a3f…d8e — AI Referee spinning up evaluation context",
  "[REFEREE] 0x9a3f…d8e — Fetching seller data payload from endpoint…",
  "[REFEREE] 0x9a3f…d8e — Schema validation: OK  |  Integrity: OK",
  "[REFEREE] 0x9a3f…d8e — Verifying ERC-8004 identity: Agent #58",
  "[OK] 0x9a3f…d8e — Verdict PASS — payload verified, delivery confirmed",
  "[TX] 0x9a3f…d8e — releaseFunds() → 0x0432c165c5cb706d…",
  "[LOCK] 0xc7d5…42c — ClawCourt Agent locked 0.50 USDC.e into escrow",
  "[REFEREE] 0xc7d5…42c — AI Referee evaluating seller payload…",
  "[WARN] 0xc7d5…42c — Payload contains unverifiable data claims",
  "[ERROR] 0xc7d5…42c — Verdict FAIL — trust score 0.12, hallucinated content detected",
  "[TX] 0xc7d5…42c — refundFunds() → 0x72f922b2b2c0f547…",
  "[LOCK] 0xe1b2…5e6 — ClawCourt Agent locked 2.00 USDC.e into escrow",
  "[REFEREE] 0xe1b2…5e6 — AI Referee analyzing incoming payload…",
];

// ── Main component ─────────────────────────────────────────────────────────
export default function Home() {
  const [txs, setTxs]     = useState<Tx[]>([]);
  const [logs, setLogs]   = useState<string[]>([]);
  const [alert, setAlert] = useState<{ level: "ok" | "fail"; msg: string } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [utcTime, setUtcTime] = useState("");
  const logsRef     = useRef<HTMLDivElement | null>(null);
  const demoIdx     = useRef(0);
  const demoStage   = useRef(0);
  const lastDataRef = useRef("");  // fingerprint to skip redundant state updates

  useEffect(() => { setMounted(true); }, []);

  // ── Poll log.json every 2 s ────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    let lastLogLen = 0;

    async function poll() {
      try {
        const r = await fetch("/log.json?t=" + Date.now());
        if (!r.ok) throw new Error();
        const data: LogFile = await r.json();
        if (cancelled) return;

        const fingerprint = JSON.stringify(data);
        if (fingerprint === lastDataRef.current) return; // nothing changed
        lastDataRef.current = fingerprint;

        const nextTxs = data.transactions?.length ? data.transactions : FALLBACK_TXS;
        const nextLogs = data.logs?.length ? data.logs : FALLBACK_LOGS;
        setTxs(nextTxs as Tx[]);

        // Fire alert on new settlement events
        if (nextLogs.length > lastLogLen) {
          const newLines = nextLogs.slice(lastLogLen);
          const rel = newLines.find(l => l.toLowerCase().includes("releasefunds"));
          const ref = newLines.find(l => l.toLowerCase().includes("refundfunds"));
          if (rel) { setAlert({ level: "ok",   msg: "Funds released to seller — confirmed on-chain" }); setTimeout(() => setAlert(null), 6000); }
          if (ref) { setAlert({ level: "fail", msg: "Refund triggered — funds returned to buyer"    }); setTimeout(() => setAlert(null), 6000); }
          lastLogLen = nextLogs.length;
        }
        setLogs(nextLogs);
      } catch { /* keep current state */ }
    }

    poll();
    const id = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, [mounted]);

  // ── Auto-cycle: animates the demo when log.json is static ─────────────
  useEffect(() => {
    if (!mounted || txs.length === 0) return;
    const ts  = () => new Date().toISOString().split("T")[1].split(".")[0];
    const rnd = () => "0x" + Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

    const id = setInterval(() => {
      // Skip if log.json was updated in the last 4 s (real demo is running)
      setTxs(prev => {
        const next    = [...prev];
        const idx     = demoIdx.current % next.length;
        const tx      = { ...next[idx] };
        const stage   = demoStage.current;

        if (stage === 0) {
          if (tx.status === "RELEASED" || tx.status === "REFUNDED") tx.status = "PENDING";
          tx.status = "INSPECTING";
          setLogs(l => [...l.slice(-50),
            `[${ts()}] [LOCK] ${shortId(tx.id)} — ${addrLabel(tx.buyer)} locked ${tx.amount}`,
            `[${ts()}] [REFEREE] ${shortId(tx.id)} — AI Referee starting evaluation…`,
          ]);
        } else if (stage === 1) {
          setLogs(l => [...l.slice(-50),
            `[${ts()}] [REFEREE] ${shortId(tx.id)} — Checking ERC-8004 identity: Agent #58`,
            `[${ts()}] [REFEREE] ${shortId(tx.id)} — Verifying data schema and integrity…`,
          ]);
        } else {
          const pass = Math.random() > 0.35;
          tx.status = pass ? "RELEASED" : "REFUNDED";
          const hash = rnd();
          setLogs(l => [...l.slice(-50),
            pass
              ? `[${ts()}] [OK] ${shortId(tx.id)} — Verdict PASS — payload verified`
              : `[${ts()}] [ERROR] ${shortId(tx.id)} — Verdict FAIL — trust score below threshold`,
            pass
              ? `[${ts()}] [TX] ${shortId(tx.id)} — releaseFunds() → ${hash}`
              : `[${ts()}] [TX] ${shortId(tx.id)} — refundFunds() → ${hash}`,
          ]);
          setAlert({
            level: pass ? "ok" : "fail",
            msg: pass
              ? `${tx.amount} released to ${addrLabel(tx.seller)}`
              : `${tx.amount} refunded to ${addrLabel(tx.buyer)}`,
          });
          setTimeout(() => setAlert(null), 6000);
          demoIdx.current = (demoIdx.current + 1) % next.length;
        }

        demoStage.current = (stage + 1) % 3;
        next[idx] = tx;
        return next;
      });
    }, 5000);

    return () => clearInterval(id);
  }, [mounted, txs.length]);

  // ── UTC clock ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;
    const fmt = () => new Date().toISOString().replace("T", "  ").split(".")[0] + " UTC";
    setUtcTime(fmt());
    const t = setInterval(() => setUtcTime(fmt()), 1000);
    return () => clearInterval(t);
  }, [mounted]);

  // ── Auto-scroll terminal ───────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;
    const el = logsRef.current;
    if (!el) return;
    try { el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); } catch { el.scrollTop = el.scrollHeight; }
  }, [logs, mounted]);

  // ── Derived state ──────────────────────────────────────────────────────
  const settled      = useMemo(() => txs.filter(t => t.status === "RELEASED" || t.status === "REFUNDED"), [txs]);
  const released     = useMemo(() => settled.filter(t => t.status === "RELEASED"), [settled]);
  const refunded     = useMemo(() => settled.filter(t => t.status === "REFUNDED"), [settled]);
  const inspecting   = useMemo(() => txs.find(t => t.status === "INSPECTING"), [txs]);
  const successRate  = settled.length > 0 ? Math.round((released.length / settled.length) * 100) : null;
  const visibleLogs  = useMemo(() => logs.slice(-22), [logs]);

  // ── SSR skeleton ───────────────────────────────────────────────────────
  if (!mounted) return (
    <div className="min-h-screen bg-ink text-zinc-200 font-mono p-8">
      <p className="text-emerald-400 text-sm">Initializing ClawCourt…</p>
    </div>
  );

  // ── Main render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-ink text-zinc-200 font-sans p-5 relative overflow-hidden">
      <div className="screen-grid absolute inset-0 pointer-events-none" />

      {/* ══ HEADER ══════════════════════════════════════════════════════ */}
      <header className="mb-5 flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-emerald-400 text-xs font-mono uppercase tracking-widest">⬡ CLAWCOURT</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400/60 font-mono">LIVE</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight leading-tight">
            AI-Powered Escrow on GOAT Network
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Autonomous agents lock funds · Claude AI evaluates the deal · Smart contract settles on-chain — fully trustless
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm text-emerald-300 font-mono tabular-nums">{utcTime}</div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">GOAT Mainnet · Chain 2345</div>
          <div className="text-[10px] text-zinc-600 font-mono">ERC-8004 Agent #58</div>
        </div>
      </header>

      {/* ══ HOW IT WORKS STRIP ══════════════════════════════════════════ */}
      <div className="mb-5 bg-zinc-900/40 border border-zinc-800/50 rounded-2xl px-5 py-4">
        <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3 font-mono">What you&apos;re watching</div>
        <div className="flex items-stretch gap-2">
          {[
            { n: "①", label: "Buyer Locks Funds",      detail: "An AI agent deposits USDC.e into the escrow smart contract on GOAT Network",          color: "text-amber-300",   border: "border-amber-800/40",   bg: "bg-amber-950/30"   },
            { n: "②", label: "AI Referee Evaluates",   detail: "Claude inspects the seller's data payload — checking quality, integrity, and honesty", color: "text-cyan-300",    border: "border-cyan-800/40",    bg: "bg-cyan-950/30"    },
            { n: "③", label: "On-Chain Settlement",    detail: "Contract auto-releases to seller on PASS, or refunds buyer on FAIL — no human needed", color: "text-emerald-300", border: "border-emerald-800/40", bg: "bg-emerald-950/30" },
          ].map((s, i) => (
            <React.Fragment key={i}>
              <div className={`flex gap-3 px-4 py-3 rounded-xl border ${s.border} ${s.bg} flex-1`}>
                <span className={`text-xl font-mono leading-none mt-0.5 shrink-0 ${s.color}`}>{s.n}</span>
                <div>
                  <div className={`text-sm font-semibold ${s.color}`}>{s.label}</div>
                  <div className="text-xs text-zinc-400 mt-0.5 leading-snug">{s.detail}</div>
                </div>
              </div>
              {i < 2 && <div className="text-zinc-600 text-xl self-center shrink-0">→</div>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ══ ALERT BANNER ════════════════════════════════════════════════ */}
      {alert && (
        <div className={`mb-5 flex items-center gap-4 px-5 py-3 rounded-xl border animated-banner ${
          alert.level === "ok"
            ? "bg-emerald-950/80 border-emerald-600/30 text-emerald-200"
            : "bg-red-950/80   border-red-700/30    text-red-200"
        }`}>
          <span className="text-3xl leading-none">{alert.level === "ok" ? "✅" : "🔴"}</span>
          <div>
            <div className="font-bold text-sm">
              {alert.level === "ok" ? "FUNDS RELEASED — Settlement confirmed on GOAT Network" : "REFUND TRIGGERED — AI Referee protected the buyer"}
            </div>
            <div className="text-xs opacity-60 mt-0.5">{alert.msg}</div>
          </div>
        </div>
      )}

      {/* ══ 3-COLUMN GRID ═══════════════════════════════════════════════ */}
      <div className="grid grid-cols-12 gap-5">

        {/* ── LEFT: Escrow Queue ─────────────────────────────────────── */}
        <aside className="col-span-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Escrow Queue</h2>
            <span className="text-[10px] font-mono text-zinc-600">{txs.length} tx</span>
          </div>

          {txs.map(t => {
            const step = getStep(t.status);
            return (
              <div key={t.id} className={`bg-zinc-900/70 border rounded-2xl p-3 transition-all duration-500 ${
                t.status === "INSPECTING" ? "border-cyan-700/50 shadow-[0_0_24px_rgba(34,211,238,0.07)]" :
                t.status === "RELEASED"   ? "border-emerald-800/40 opacity-80" :
                t.status === "REFUNDED"   ? "border-red-900/40 opacity-70" :
                                            "border-zinc-800/60"
              }`}>
                {/* Header row */}
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-mono text-[9px] text-zinc-600">{shortId(t.id)}</span>
                  <StatusBadge status={t.status} />
                </div>
                {/* Amount */}
                <div className="text-2xl font-bold text-white mb-2 leading-none">{t.amount}</div>
                {/* Buyer / Seller */}
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-zinc-500 shrink-0">Buyer</span>
                    <span className="font-mono text-zinc-300 truncate">{addrLabel(t.buyer)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-zinc-500 shrink-0">Seller</span>
                    <span className="font-mono text-zinc-300 truncate">{addrLabel(t.seller)}</span>
                  </div>
                </div>
                {/* 3-step progress */}
                <StepDots step={step} />
              </div>
            );
          })}
        </aside>

        {/* ── CENTER: AI Referee Terminal ────────────────────────────── */}
        <main className="col-span-6 bg-zinc-900/70 rounded-2xl border border-zinc-800/60 flex flex-col overflow-hidden">
          {/* Terminal header */}
          <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">AI Referee Terminal</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {inspecting
                  ? `Evaluating transaction ${shortId(inspecting.id)} — ${inspecting.amount}`
                  : "Monitoring the escrow contract for new events…"}
              </p>
            </div>
            <span className={`text-[10px] font-mono px-2.5 py-1 rounded-lg ${
              inspecting
                ? "text-cyan-300 bg-cyan-900/40 border border-cyan-700/40"
                : "text-zinc-500 bg-zinc-800/50"
            }`}>
              {inspecting ? "● PROCESSING" : "● IDLE"}
            </span>
          </div>

          {/* Log stream */}
          <div
            ref={logsRef}
            className="flex-1 bg-black/60 p-4 font-mono text-xs overflow-auto terminal-scroll"
            style={{ minHeight: 360 }}
          >
            {visibleLogs.length === 0 ? (
              <span className="text-zinc-600">Waiting for on-chain events…</span>
            ) : (
              visibleLogs.map((line, i) => {
                const isTx = line.toLowerCase().includes("[tx]");
                if (isTx) {
                  const parts = line.split(" → ");
                  return (
                    <div key={i} className="log-line text-emerald-400 leading-5">
                      {parts[0]} →{" "}
                      <span className="tx-hash text-emerald-300">{parts[1]}</span>
                    </div>
                  );
                }
                return (
                  <div key={i} className={`log-line leading-5 ${logColor(line)}`}>{line}</div>
                );
              })
            )}
            <span className="text-emerald-400 cursor-blink">▋</span>
          </div>

          {/* Terminal footer */}
          <div className="px-4 py-2 border-t border-zinc-800/40 text-[10px] text-zinc-600 font-mono flex justify-between">
            <span>Contract: 0x8C7D534Aa9cce2Abe0fBb2a2b1DaF4Ec73aBb711</span>
            <a
              href="https://explorer.goat.network/address/0x8C7D534Aa9cce2Abe0fBb2a2b1DaF4Ec73aBb711"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:text-emerald-400 transition-colors"
            >
              View on GOAT Explorer ↗
            </a>
          </div>
        </main>

        {/* ── RIGHT: Stats + Settlement Feed ────────────────────────── */}
        <aside className="col-span-3 flex flex-col gap-3">

          {/* Live stats */}
          <div className="bg-zinc-900/70 border border-zinc-800/60 rounded-2xl p-4">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">Live Stats</h2>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500">Total monitored</span>
                <span className="text-sm font-bold text-white font-mono">{txs.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500">✅ Released (PASS)</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">{released.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500">🔄 Refunded (FAIL)</span>
                <span className="text-sm font-bold text-red-400 font-mono">{refunded.length}</span>
              </div>
              {successRate !== null && (
                <div className="pt-2 border-t border-zinc-800/60">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-zinc-500">AI accuracy</span>
                    <span className="text-sm font-bold text-emerald-300 font-mono">{successRate}% PASS</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                      style={{ width: successRate + "%" }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Settlement feed */}
          <div className="bg-zinc-900/70 border border-zinc-800/60 rounded-2xl p-4 flex-1">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">Settlement Feed</h2>

            {settled.length === 0 ? (
              <p className="text-xs text-zinc-600 italic">No settled transactions yet…</p>
            ) : (
              <div className="space-y-2.5">
                {[...settled].reverse().slice(0, 5).map(s => (
                  <div key={s.id} className={`p-3 rounded-xl border transition-all duration-300 ${
                    s.status === "RELEASED"
                      ? "border-emerald-800/40 bg-emerald-950/30"
                      : "border-red-900/40 bg-red-950/20"
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-base leading-none">{s.status === "RELEASED" ? "✅" : "🔄"}</span>
                      <span className={`text-[10px] font-bold tracking-wide ${s.status === "RELEASED" ? "text-emerald-400" : "text-red-400"}`}>
                        {s.status}
                      </span>
                    </div>
                    <div className="text-base font-bold text-white leading-none">{s.amount}</div>
                    <div className="text-[10px] text-zinc-400 mt-1.5 font-mono">
                      {s.status === "RELEASED"
                        ? <>→ Sent to <span className="text-zinc-300">{addrLabel(s.seller)}</span></>
                        : <>↩ Returned to <span className="text-zinc-300">{addrLabel(s.buyer)}</span></>
                      }
                    </div>
                    <div className="text-[9px] text-zinc-600 font-mono mt-0.5">{shortId(s.id)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ══ FOOTER ══════════════════════════════════════════════════════ */}
      <footer className="mt-5 flex items-center justify-between text-[9px] font-mono text-zinc-700 border-t border-zinc-800/40 pt-3">
        <span>GOAT Mainnet · Chain 2345 · 0x8C7D534Aa9cce2Abe0fBb2a2b1DaF4Ec73aBb711</span>
        <span>ERC-8004 Agent #58 · ClawCourt · OpenClaw Hackathon 2026</span>
      </footer>
    </div>
  );
}
