"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type TxStatus = "PENDING" | "INSPECTING" | "PASS" | "FAIL" | "RELEASED" | "REFUNDED";

type Tx = {
  id: string;
  buyer: string;
  seller: string;
  amount: string;
  status: TxStatus;
};

type LogFile = {
  transactions: Tx[];
  logs: string[];
};

// Deterministic fallback data (no randomness) used if /log.json is missing
const fallbackLogFile: LogFile = {
  transactions: [
    {
      id: "0xdeadbeef000001",
      buyer: "0x1234567890abcdef1234567890abcdef12345678",
      seller: "0xabcdef1234567890abcdef1234567890abcdef12",
      amount: "25.00 tUSDC",
      status: "PENDING",
    },
    {
      id: "0xdeadbeef000002",
      buyer: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      seller: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      amount: "30.00 tUSDC",
      status: "PENDING",
    },
    {
      id: "0xdeadbeef000003",
      buyer: "0xfeedfacefeedfacefeedfacefeedfacefeedface",
      seller: "0xbeefdeadbeefdeadbeefdeadbeefdeadbeefdead",
      amount: "40.00 tUSDC",
      status: "PENDING",
    },
  ],
  logs: [
    "[INFO] 0xdeadbeef000001 - Funds locked: 25.00 tUSDC",
    "[INFO] 0xdeadbeef000001 - Fetching seller payload from mock API...",
    "[OK] 0xdeadbeef000001 - Referee verdict: PASS",
    "[TX] 0xdeadbeef000001 - releaseFunds(txId) -> txhash: 0xabc1234",
    "[INFO] 0xdeadbeef000002 - Funds locked: 30.00 tUSDC",
    "[INFO] 0xdeadbeef000002 - Fetching seller payload from mock API...",
    "[ERROR] 0xdeadbeef000002 - Referee verdict: FAIL",
    "[TX] 0xdeadbeef000002 - refundFunds(txId) -> txhash: 0xdef5678",
    "[INFO] 0xdeadbeef000003 - Funds locked: 40.00 tUSDC",
    "[INFO] 0xdeadbeef000003 - Fetching seller payload from mock API...",
    "[OK] 0xdeadbeef000003 - Referee verdict: PASS",
    "[TX] 0xdeadbeef000003 - releaseFunds(txId) -> txhash: 0xfeedface",
  ],
};

export default function Home() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [alert, setAlert] = useState<{ level: "ok" | "fail"; message: string } | null>(null);
  const [mounted, setMounted] = useState(false);
  const demoState = useRef({ index: 0, stage: 0 });
  const logsRef = useRef<HTMLDivElement | null>(null);
  const [utcTime, setUtcTime] = useState("");


  // mark mounted on client to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    async function loadLogJson() {
      try {
        const response = await fetch("/log.json");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data: LogFile = await response.json();
        if (cancelled) return;
        if (Array.isArray(data.transactions) && data.transactions.length > 0) {
          setTxs(data.transactions);
        } else {
          setTxs(fallbackLogFile.transactions);
        }
        if (Array.isArray(data.logs) && data.logs.length > 0) {
          setLogs(data.logs);
        } else {
          setLogs(fallbackLogFile.logs);
        }
      } catch (error) {
        console.warn("Failed to load /log.json, using fallback logs:", error);
        setTxs(fallbackLogFile.transactions);
        setLogs(fallbackLogFile.logs);
      }
    }

    loadLogJson();
    return () => {
      cancelled = true;
    };
  }, [mounted]);

  // Demo sequence driver: auto-cycle transaction phases every 8 seconds — client only
  useEffect(() => {
    if (!mounted || txs.length === 0) return;

    const getDemoHash = () => `0x${Math.floor(Math.random() * 1e12).toString(16).padStart(10, "0")}`;

    const interval = setInterval(() => {
      setTxs((prev) => {
        const next = [...prev];
        const current = demoState.current;
        const idx = current.index % next.length;
        const tx = next[idx];
        if (!tx) return prev;

        const pushLog = (line: string) => setLogs((l) => [...l.slice(-60), line]);

        if (current.stage === 0) {
          if (tx.status === "RELEASED" || tx.status === "REFUNDED") {
            next[idx] = { ...tx, status: "PENDING" };
          }
          next[idx].status = "INSPECTING";
          pushLog(`[LOCK] ${tx.id} - LOCK_FUNDS initiated for ${tx.amount}`);
          pushLog(`[REFEREE] ${tx.id} - REFEREE_INSPECT payload queued`);
        } else if (current.stage === 1) {
          pushLog(`[REFEREE] ${tx.id} - parsing payload and verifying schema...`);
          next[idx].status = "INSPECTING";
        } else {
          const pass = Math.random() > 0.45;
          next[idx].status = pass ? "RELEASED" : "REFUNDED";
          pushLog(pass ? `[OK] ${tx.id} - Verdict PASS` : `[ERROR] ${tx.id} - Verdict FAIL`);
          pushLog(
            pass
              ? `[TX] ${tx.id} - releaseFunds(txId) -> txhash: ${getDemoHash()}`
              : `[TX] ${tx.id} - refundFunds(txId) -> txhash: ${getDemoHash()}`
          );
          setAlert({
            level: pass ? "ok" : "fail",
            message: pass
              ? `FUNDS UNLOCKED: ${tx.id}`
              : `AUTOMATED FALLBACK REFUND TRIGGERED: ${tx.id}`,
          });
        }

        current.stage = (current.stage + 1) % 3;
        if (current.stage === 0) {
          current.index = (current.index + 1) % next.length;
        }

        return next;
      });

      setTimeout(() => setAlert(null), 3000);
    }, 8000);

    return () => clearInterval(interval);
  }, [mounted, txs.length]);

  const active = useMemo(() => txs.filter((t) => t.status === "PENDING" || t.status === "INSPECTING"), [txs]);
  const settled = useMemo(() => txs.filter((t) => t.status === "RELEASED" || t.status === "REFUNDED"), [txs]);

  const latestSettlement = useMemo(() => {
    if (settled.length === 0) return null;
    return settled[settled.length - 1];
  }, [settled]);

  // keep only last 15 logs for rendering
  const visibleLogs = useMemo(() => logs.slice(-15), [logs]);

  // live UTC time updater (client-only)
  useEffect(() => {
    if (!mounted) return;
    const fmt = () => new Date().toISOString().split("T")[1].split(".")[0] + " UTC";
    setUtcTime(fmt());
    const t = setInterval(() => setUtcTime(fmt()), 1000);
    return () => clearInterval(t);
  }, [mounted]);

  // auto-scroll terminal to newest logs
  useEffect(() => {
    if (!mounted) return;
    const el = logsRef.current;
    if (!el) return;
    // smooth scroll to bottom
    try {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } catch (e) {
      el.scrollTop = el.scrollHeight;
    }
  }, [visibleLogs, mounted]);
  if (!mounted) {
    return (
      <div className="min-h-screen bg-ink text-zinc-200 font-sans p-6 relative overflow-hidden">
        <div className="screen-grid absolute inset-0 pointer-events-none" />
        <header className="mb-6">
          <span className="inline-flex items-center gap-3 text-xs uppercase tracking-[0.35em] text-emerald-400/90">CLAWCOURT</span>
          <h1 className="text-2xl font-semibold text-white mt-2">Trust Layer for Autonomous Commerce</h1>
          <p className="text-zinc-500 mt-1">Loading demo environment…</p>
        </header>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3 bg-zinc-900/50 rounded-2xl p-6">Loading escrows…</div>
          <div className="col-span-6 bg-zinc-900/50 rounded-2xl p-6">Loading terminal…</div>
          <div className="col-span-3 bg-zinc-900/50 rounded-2xl p-6">Loading status…</div>
        </div>
        <footer className="mt-6 text-xs uppercase tracking-[0.32em] text-zinc-500 border-t border-zinc-800/70 pt-4">GOAT Mainnet • ERC-8004 • ClawCourt • Agent #58 • Demo Mode</footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink text-zinc-200 font-sans p-6 relative overflow-hidden">
      <div className="screen-grid absolute inset-0 pointer-events-none" />
      <header className="mb-6 flex flex-col gap-2 relative">
        <span className="inline-flex items-center gap-3 text-xs uppercase tracking-[0.35em] text-emerald-400/90">
          CLAWCOURT
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white drop-shadow-[0_0_30px_rgba(16,185,129,0.35)]">
            Trust Layer for Autonomous Commerce
          </h1>
          <p className="max-w-3xl text-sm text-zinc-400 sm:text-base">
            A live monitoring terminal for the GOAT Network demo, showing escrow lock events, AI referee inspection, and automated settlement status.
          </p>
        </div>
          <div className="absolute top-4 right-4 text-right">
            <div className="text-xs text-emerald-300 font-mono">{utcTime}</div>
            <div className="text-[10px] uppercase text-zinc-500 tracking-wider">GOAT MAINNET · CHAIN 2345</div>
          </div>
          {/* Top settlement banner */}
          <div className="mt-4">
            {latestSettlement ? (
              <div className={`settlement-banner inline-flex items-center gap-3 px-4 py-2 rounded ${latestSettlement.status === "RELEASED" ? "banner-ok" : "banner-fail"}`}>
                <div className="text-lg">{latestSettlement.status === "RELEASED" ? "🟢" : "🔴"}</div>
                <div className="font-semibold">{latestSettlement.status === "RELEASED" ? "FUNDS UNLOCKED" : "AUTOMATED FALLBACK REFUND TRIGGERED"}</div>
                <div className="text-xs font-mono text-zinc-300 ml-2 truncate">{latestSettlement.id}</div>
              </div>
            ) : (
              <div className="text-zinc-500">No recent settlement alerts</div>
            )}
          </div>
      </header>
      <div className="max-w-full mx-auto grid grid-cols-12 gap-6">
        {/* Left: Active Escrow Boxes */}
        <aside className="col-span-3 bg-zinc-900/70 rounded-3xl p-4 border border-zinc-800/70 shadow-[0_0_40px_rgba(16,185,129,0.15)] pulse-card">
          <h2 className="text-lg font-semibold mb-3">Active Escrow Boxes</h2>
          <div className="flex flex-col gap-3">
            {txs.map((t) => (
              <div key={t.id} className="p-3 rounded bg-zinc-900/40 border border-zinc-800 animate-pulse-card">
                <div className="text-xs text-zinc-400">TX ID</div>
                <div className="font-mono text-sm break-all">{t.id}</div>
                <div className="mt-2 text-xs text-zinc-400">Buyer</div>
                <div className="font-mono text-sm break-all">{t.buyer}</div>
                <div className="mt-2 text-xs text-zinc-400">Seller</div>
                <div className="font-mono text-sm break-all">{t.seller}</div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-sm">{t.amount}</div>
                  <div className={`text-xs px-2 py-1 rounded ${t.status === "REFUNDED" ? "bg-red-700 text-white" : t.status === "RELEASED" ? "bg-green-700 text-white" : "bg-zinc-800 text-zinc-300"}`}>
                    {t.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Center: Referee Processing Terminal */}
        <main className="col-span-6 bg-zinc-900/70 rounded-3xl p-4 border border-zinc-800/70 shadow-[0_0_50px_rgba(16,185,129,0.12)] pulse-card flex flex-col">
          <h2 className="text-lg font-semibold mb-3 text-white">Referee Processing Terminal</h2>
          <div ref={logsRef} className="flex-1 bg-black/70 rounded p-3 font-mono text-sm overflow-auto terminal-scroll relative" style={{ minHeight: 320 }}>
            {visibleLogs.length === 0 ? (
              <div className="text-zinc-500">[INFO] Waiting for events...</div>
            ) : (
              visibleLogs.map((l, i) => {
                const isTx = l.startsWith("[TX]");
                const className = l.startsWith("[ERROR]")
                  ? "text-red-400"
                  : l.startsWith("[OK]")
                  ? "text-green-400"
                  : "text-zinc-300";
                if (isTx) {
                  const [prefix, hash] = l.split(" -> ");
                  return (
                    <div key={i} className={`log-line ${className}`}>
                      <span>{prefix} →</span>{" "}
                      <span className="text-emerald-300 tx-hash">{hash}</span>
                    </div>
                  );
                }
                return (
                  <div key={i} className={`log-line ${className}`}>
                    {l}
                  </div>
                );
              })
            )}
            <div className="absolute bottom-3 left-3 text-emerald-300 cursor-blink">_</div>
          </div>
          <div className="mt-3 text-xs text-zinc-500">Mock stream of referee logs, parsed line-by-line.</div>
        </main>

        {/* Right: Settlement Status Dashboard */}
        <aside className="col-span-3 bg-zinc-900/70 rounded-3xl p-4 border border-zinc-800/70 shadow-[0_0_40px_rgba(16,185,129,0.12)] pulse-card flex flex-col items-stretch">
          <h2 className="text-lg font-semibold mb-3 text-white">Settlement Status</h2>

          {alert ? (
            <div className={`rounded p-3 mb-3 animated-banner ${alert.level === "ok" ? "bg-green-900/70 border border-green-500" : "bg-red-900/70 border border-red-500"}`}>
              <div className="font-semibold">{alert.level === "ok" ? "FUNDS UNLOCKED" : "AUTOMATED FALLBACK REFUND TRIGGERED"}</div>
              <div className="text-xs mt-1">{alert.message}</div>
            </div>
          ) : (
            <div className="rounded p-3 mb-3 bg-zinc-900/30">No recent settlement alerts</div>
          )}

          <div className="flex-1 overflow-auto">
            <h3 className="text-sm text-zinc-400 mb-2">Recent Settlements</h3>
            <ul className="space-y-2 text-xs font-mono">
              {settled.length === 0 && <li className="text-zinc-500">No settled transactions yet.</li>}
              {settled.map((s) => (
                <li key={s.id} className="p-2 rounded bg-zinc-900/30 border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="truncate" style={{ maxWidth: 160 }}>{s.id}</div>
                    <div className={`ml-2 ${s.status === "REFUNDED" ? "text-red-400" : "text-green-400"}`}>{s.status}</div>
                  </div>
                  <div className="text-zinc-500 text-xxs mt-1">{s.amount} • {s.seller}</div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
      <footer className="mt-6 text-xs uppercase tracking-[0.32em] text-zinc-500 border-t border-zinc-800/70 pt-4">
        GOAT Mainnet (Chain 2345) • ERC-8004 Agent #58 • Contract 0x31cE...D61 • ClawCourt Demo
      </footer>
    </div>
  );
}
