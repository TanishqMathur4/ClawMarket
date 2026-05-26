// scripts/demo.js — full escrow lifecycle demo
// Deploys a fresh contract (owner = agent wallet), runs lock → release
require("dotenv").config();
const { ethers } = require("ethers");
const hre = require("hardhat");

const USDC     = "0x3022b87ac063DE95b1570F46f5e470F8B53112D8";
const AMOUNT   = ethers.parseUnits("1", 6); // 1 USDC (try 6 decimals first)

async function main() {
  const { ethers: hEthers } = hre;
  const [owner] = await hEthers.getSigners();

  // ── Generate throwaway seller wallet ──────────────────────────────────────
  const seller = hEthers.Wallet.createRandom();
  console.log("🎭 Demo participants");
  console.log("   Buyer  (agent wallet):", owner.address);
  console.log("   Seller (demo wallet) :", seller.address);

  // ── Check USDC balance ────────────────────────────────────────────────────
  const usdc = await hEthers.getContractAt(
    ["function balanceOf(address) view returns (uint256)",
     "function approve(address,uint256) returns (bool)",
     "function decimals() view returns (uint8)"],
    USDC
  );
  const dec = await usdc.decimals();
  const amount = ethers.parseUnits("1", dec);
  const balBefore = await usdc.balanceOf(owner.address);
  console.log("\n💰 Buyer USDC before:", ethers.formatUnits(balBefore, dec));

  // ── Deploy fresh escrow (we keep ownership) ───────────────────────────────
  console.log("\n🚀 Deploying demo escrow...");
  const Factory = await hEthers.getContractFactory("ClawCourtEscrow");
  const escrow  = await Factory.deploy(USDC);
  await escrow.waitForDeployment();
  console.log("   Escrow:", escrow.target);

  // ── Approve + lock ────────────────────────────────────────────────────────
  console.log("\n🔒 Step 1: Buyer approves + locks 1 USDC into escrow...");
  await (await usdc.approve(escrow.target, amount)).wait();

  const txId = ethers.hexlify(ethers.randomBytes(32));
  await (await escrow.lockFunds(txId, seller.address, amount)).wait();

  const escrowBal = await usdc.balanceOf(escrow.target);
  console.log("   Escrow holds:", ethers.formatUnits(escrowBal, dec), "USDC");
  console.log("   Status:", await escrow.getStatus(txId), "(0 = PENDING ✅)");

  // ── Simulate Referee: PASS ────────────────────────────────────────────────
  console.log("\n🤖 Step 2: Referee returns PASS");

  // ── Release ───────────────────────────────────────────────────────────────
  console.log("\n✅ Step 3: Gateway releases funds to seller...");
  await (await escrow.releaseFunds(txId)).wait();

  const sellerBal  = await usdc.balanceOf(seller.address);
  const escrowAfter = await usdc.balanceOf(escrow.target);
  const buyerAfter  = await usdc.balanceOf(owner.address);

  console.log("   Seller received:", ethers.formatUnits(sellerBal, dec), "USDC ✅");
  console.log("   Escrow balance :", ethers.formatUnits(escrowAfter, dec), "USDC (should be 0)");
  console.log("   Buyer balance  :", ethers.formatUnits(buyerAfter, dec), "USDC");
  console.log("   Status:", await escrow.getStatus(txId), "(1 = RELEASED ✅)");

  console.log("\n🎉 Full escrow lifecycle complete!");
  console.log("   Explorer:", `https://explorer.goat.network/address/${escrow.target}`);
}

main().catch(console.error);
