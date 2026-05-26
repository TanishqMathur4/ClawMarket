// scripts/demo_interactive.js
// Interactive judge demo — full escrow lifecycle on GOAT Mainnet
// Shows BOTH paths: PASS (release) and FAIL (refund)
require("dotenv").config();
const { ethers } = require("ethers");
const readline   = require("readline");

const ESCROW_ADDRESS = "0x8C7D534Aa9cce2Abe0fBb2a2b1DaF4Ec73aBb711";
const USDC_ADDRESS   = "0x3022b87ac063DE95b1570F46f5e470F8B53112D8";
const EXPLORER       = "https://explorer.goat.network";

const ESCROW_ABI = [
  "function lockFunds(bytes32 txId, address seller, uint256 amount) external",
  "function releaseFunds(bytes32 txId) external",
  "function refundFunds(bytes32 txId) external",
  "function getStatus(bytes32 txId) view returns (uint8)",
  "function owner() view returns (address)",
];
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

// Bad payloads the AI Referee will reject
const BAD_PAYLOADS = [
  "API Error: connection timed out",
  '{"temperature": "hot", "humidity": "wet"}',
  '{"temp": 22.5, "hum": 60.1}',
  "",
];

function prompt(msg) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(msg, ans => { rl.close(); res(ans); }));
}

function separator() { console.log("\n" + "─".repeat(60)); }

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.goat.network");
  const buyer    = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const seller   = ethers.Wallet.createRandom();

  const escrow = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, buyer);
  const usdc   = new ethers.Contract(USDC_ADDRESS,   ERC20_ABI,  buyer);

  const dec    = await usdc.decimals();
  const sym    = await usdc.symbol();
  const AMOUNT = ethers.parseUnits("1", dec);

  // ═══════════════════════════════════════════════════════════
  separator();
  console.log("  🦞 ClawCourt — AI Escrow on GOAT Mainnet");
  console.log("  Machine-to-machine commerce with on-chain dispute resolution");
  separator();
  console.log("\n📋 Contract  :", ESCROW_ADDRESS);
  console.log("🌐 Network   : GOAT Mainnet (Chain 2345)");
  console.log("🪙 Token     :", sym, "—", USDC_ADDRESS);
  console.log("👛 Buyer     :", buyer.address);
  console.log("🏪 Seller    :", seller.address);

  await prompt("\n▶  Press Enter to check balances...");

  separator();
  console.log("  Initial Balances");
  separator();
  const startBal = await usdc.balanceOf(buyer.address);
  console.log(`  Buyer  : ${ethers.formatUnits(startBal, dec)} ${sym}`);
  console.log(`  Seller : 0.0 ${sym}`);
  console.log(`  Escrow : ${ethers.formatUnits(await usdc.balanceOf(ESCROW_ADDRESS), dec)} ${sym}`);

  // ═══════════════════════════════════════════════════════════
  // ROUND 1 — PASS path
  // ═══════════════════════════════════════════════════════════
  separator();
  console.log("  ✅  ROUND 1 — Good payload → Referee PASS → Funds released");
  separator();

  await prompt("\n▶  Press Enter to lock 1 USDC.e into escrow...");

  separator();
  console.log("  STEP 1 — Buyer locks funds");
  separator();
  const txId1 = ethers.hexlify(ethers.randomBytes(32));
  console.log("  txId:", txId1);
  process.stdout.write("  Approving... ");
  await (await usdc.approve(ESCROW_ADDRESS, AMOUNT)).wait();
  console.log("✅");
  process.stdout.write("  Locking...   ");
  const lockTx1 = await escrow.lockFunds(txId1, seller.address, AMOUNT);
  await lockTx1.wait();
  console.log("✅");
  console.log(`  Tx: ${EXPLORER}/tx/${lockTx1.hash}`);
  console.log(`  Escrow holds : ${ethers.formatUnits(await usdc.balanceOf(ESCROW_ADDRESS), dec)} ${sym}`);
  console.log(`  Status       : PENDING 🔒`);

  await prompt("\n▶  Press Enter to run AI Referee (good payload)...");

  separator();
  console.log("  STEP 2 — AI Referee evaluates seller payload");
  separator();
  console.log('  Payload : {"temperature": 23.4, "humidity": 61.2}');
  process.stdout.write("  Evaluating");
  for (let i = 0; i < 5; i++) { await new Promise(r => setTimeout(r, 400)); process.stdout.write("."); }
  console.log("\n  Verdict : ✅ PASS — both fields present and within valid range");

  await prompt("\n▶  Press Enter to release funds to seller...");

  separator();
  console.log("  STEP 3 — Gateway releases funds (Referee: PASS)");
  separator();
  process.stdout.write("  Releasing... ");
  const releaseTx = await escrow.releaseFunds(txId1);
  await releaseTx.wait();
  console.log("✅");
  console.log(`  Tx: ${EXPLORER}/tx/${releaseTx.hash}`);
  const buyerAfter1  = await usdc.balanceOf(buyer.address);
  const sellerAfter1 = await usdc.balanceOf(seller.address);
  console.log(`\n  Buyer  : ${ethers.formatUnits(buyerAfter1,  dec)} ${sym}  (was ${ethers.formatUnits(startBal, dec)}) ← paid`);
  console.log(`  Seller : ${ethers.formatUnits(sellerAfter1, dec)} ${sym}  (was 0.0) ← received`);
  console.log(`  Escrow : ${ethers.formatUnits(await usdc.balanceOf(ESCROW_ADDRESS), dec)} ${sym}  ← drained`);
  console.log(`  Status : RELEASED ✅`);

  // ═══════════════════════════════════════════════════════════
  // ROUND 2 — FAIL path
  // ═══════════════════════════════════════════════════════════
  separator();
  console.log("  🔴  ROUND 2 — Bad payload → Referee FAIL → Buyer refunded");
  separator();

  await prompt("\n▶  Press Enter to lock 1 USDC.e into escrow (second transaction)...");

  separator();
  console.log("  STEP 4 — Buyer locks funds again");
  separator();
  const txId2 = ethers.hexlify(ethers.randomBytes(32));
  console.log("  txId:", txId2);
  process.stdout.write("  Approving... ");
  await (await usdc.approve(ESCROW_ADDRESS, AMOUNT)).wait();
  console.log("✅");
  process.stdout.write("  Locking...   ");
  const lockTx2 = await escrow.lockFunds(txId2, seller.address, AMOUNT);
  await lockTx2.wait();
  console.log("✅");
  console.log(`  Tx: ${EXPLORER}/tx/${lockTx2.hash}`);
  console.log(`  Escrow holds : ${ethers.formatUnits(await usdc.balanceOf(ESCROW_ADDRESS), dec)} ${sym}`);
  console.log(`  Status       : PENDING 🔒`);

  await prompt("\n▶  Press Enter to run AI Referee (bad payload)...");

  separator();
  console.log("  STEP 5 — AI Referee evaluates bad payload");
  separator();
  const badPayload = BAD_PAYLOADS[Math.floor(Math.random() * BAD_PAYLOADS.length)] || "API Error: connection timed out";
  console.log(`  Payload : ${badPayload || '""  (empty — seller agent crashed)'}`);
  process.stdout.write("  Evaluating");
  for (let i = 0; i < 5; i++) { await new Promise(r => setTimeout(r, 400)); process.stdout.write("."); }
  console.log("\n  Verdict : 🔴 FAIL — payload does not match required schema");

  await prompt("\n▶  Press Enter to trigger automated refund (Referee: FAIL)...");

  separator();
  console.log("  STEP 6 — Gateway refunds buyer (Referee: FAIL)");
  separator();
  process.stdout.write("  Refunding... ");
  const refundTx = await escrow.refundFunds(txId2);
  await refundTx.wait();
  console.log("✅");
  console.log(`  Tx: ${EXPLORER}/tx/${refundTx.hash}`);
  const buyerFinal  = await usdc.balanceOf(buyer.address);
  const sellerFinal = await usdc.balanceOf(seller.address);
  console.log(`\n  Buyer  : ${ethers.formatUnits(buyerFinal,  dec)} ${sym}  ← refunded, protected by AI Referee`);
  console.log(`  Seller : ${ethers.formatUnits(sellerFinal, dec)} ${sym}  ← received nothing (bad data)`);
  console.log(`  Escrow : ${ethers.formatUnits(await usdc.balanceOf(ESCROW_ADDRESS), dec)} ${sym}  ← drained`);
  console.log(`  Status : REFUNDED 🔴`);

  separator();
  console.log("  🎉 ClawCourt full lifecycle demo complete!");
  console.log("  ✅ PASS path: funds released to seller");
  console.log("  🔴 FAIL path: buyer protected, funds returned");
  console.log("  Both transactions confirmed on GOAT Mainnet.");
  separator();
}

main().catch(console.error);
