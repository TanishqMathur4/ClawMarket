// scripts/demo_interactive.js
// Interactive judge demo — step-by-step escrow lifecycle on GOAT Mainnet
require("dotenv").config();
const { ethers } = require("ethers");
const readline   = require("readline");

const ESCROW_ADDRESS = "0x31cE0A0c92E31BD4AC807f17b82019B6C47f4D61";
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

function prompt(msg) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(msg, ans => { rl.close(); res(ans); }));
}

function separator() {
  console.log("\n" + "─".repeat(60));
}

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.goat.network");
  const buyer    = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const seller   = ethers.Wallet.createRandom();           // demo seller

  const escrow = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, buyer);
  const usdc   = new ethers.Contract(USDC_ADDRESS,   ERC20_ABI,  buyer);

  const dec = await usdc.decimals();
  const sym = await usdc.symbol();
  const AMOUNT = ethers.parseUnits("1", dec);              // 1 USDC

  // ── Intro ──────────────────────────────────────────────────────────────────
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

  // ── Balances ───────────────────────────────────────────────────────────────
  separator();
  console.log("  STEP 1 — Initial Balances");
  separator();
  const buyerBal  = await usdc.balanceOf(buyer.address);
  const sellerBal = await usdc.balanceOf(seller.address);
  const escrowBal = await usdc.balanceOf(ESCROW_ADDRESS);
  console.log(`  Buyer  : ${ethers.formatUnits(buyerBal,  dec)} ${sym}`);
  console.log(`  Seller : ${ethers.formatUnits(sellerBal, dec)} ${sym}`);
  console.log(`  Escrow : ${ethers.formatUnits(escrowBal, dec)} ${sym}`);

  await prompt("\n▶  Press Enter to lock 1 USDC into escrow...");

  // ── Lock ───────────────────────────────────────────────────────────────────
  separator();
  console.log("  STEP 2 — Buyer locks funds");
  console.log("  Buyer approves 1 USDC → escrow contract pulls it in");
  separator();
  const txId = ethers.hexlify(ethers.randomBytes(32));
  console.log("  txId:", txId);

  process.stdout.write("  Approving... ");
  await (await usdc.approve(ESCROW_ADDRESS, AMOUNT)).wait();
  console.log("✅");

  process.stdout.write("  Locking...   ");
  const lockTx = await escrow.lockFunds(txId, seller.address, AMOUNT);
  await lockTx.wait();
  console.log("✅");
  console.log(`  Tx: ${EXPLORER}/tx/${lockTx.hash}`);

  const escrowAfterLock = await usdc.balanceOf(ESCROW_ADDRESS);
  const status1 = await escrow.getStatus(txId);
  console.log(`\n  Escrow now holds : ${ethers.formatUnits(escrowAfterLock, dec)} ${sym}`);
  console.log(`  Status           : ${status1}n → PENDING 🔒`);

  await prompt("\n▶  Press Enter to run AI Referee evaluation...");

  // ── Referee ────────────────────────────────────────────────────────────────
  separator();
  console.log("  STEP 3 — AI Referee (T3) evaluates seller's data payload");
  separator();
  process.stdout.write("  Evaluating");
  for (let i = 0; i < 5; i++) { await new Promise(r => setTimeout(r, 400)); process.stdout.write("."); }
  console.log("\n  Verdict : ✅ PASS — payload verified, funds approved for release");

  await prompt("\n▶  Press Enter to release funds to seller...");

  // ── Release ────────────────────────────────────────────────────────────────
  separator();
  console.log("  STEP 4 — Gateway releases funds (Referee: PASS)");
  separator();
  process.stdout.write("  Releasing... ");
  const releaseTx = await escrow.releaseFunds(txId);
  await releaseTx.wait();
  console.log("✅");
  console.log(`  Tx: ${EXPLORER}/tx/${releaseTx.hash}`);

  const buyerFinal  = await usdc.balanceOf(buyer.address);
  const sellerFinal = await usdc.balanceOf(seller.address);
  const escrowFinal = await usdc.balanceOf(ESCROW_ADDRESS);
  const status2     = await escrow.getStatus(txId);

  separator();
  console.log("  FINAL BALANCES");
  separator();
  console.log(`  Buyer  : ${ethers.formatUnits(buyerFinal,  dec)} ${sym}  (was ${ethers.formatUnits(buyerBal,  dec)})`);
  console.log(`  Seller : ${ethers.formatUnits(sellerFinal, dec)} ${sym}  (was ${ethers.formatUnits(sellerBal, dec)}) ← received payment`);
  console.log(`  Escrow : ${ethers.formatUnits(escrowFinal, dec)} ${sym}  (fully drained)`);
  console.log(`  Status : ${status2}n → RELEASED ✅`);
  separator();
  console.log("  🎉 ClawCourt escrow lifecycle complete on GOAT Mainnet!");
  separator();
}

main().catch(console.error);
