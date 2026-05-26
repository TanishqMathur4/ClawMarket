// scripts/deploy.js
// ── T1: Deploy ClawCourtEscrow to GOAT Testnet ────────────────────────────
//
// Usage:
//   npx hardhat run scripts/deploy.js --network goatTestnet
//
// Prerequisites:
//   1. Fill in PRIVATE_KEY and TUSDC_ADDRESS in .env
//   2. Fund the deployer wallet with GOAT Testnet gas tokens
//
// After deployment:
//   Copy the logged address + ABI into shared/contract_meta.json
//   Then call transferOwnership(gatewayWalletAddress) so Teammate 2's
//   pipeline key can sign releaseFunds / refundFunds.

const hre = require("hardhat");
const fs  = require("fs");
const path = require("path");

async function main() {
  const tUSDCAddress = process.env.TUSDC_ADDRESS;
  if (!tUSDCAddress || tUSDCAddress === "0x_FILL_FROM_GOAT_DOCS") {
    throw new Error("Set TUSDC_ADDRESS in .env before deploying.");
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying ClawCourtEscrow...");
  console.log("  Network  :", hre.network.name);
  console.log("  Deployer :", deployer.address);
  console.log("  tUSDC    :", tUSDCAddress);

  const ClawCourtEscrow = await hre.ethers.getContractFactory("ClawCourtEscrow");
  const escrow = await ClawCourtEscrow.deploy(tUSDCAddress);
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  const block   = await hre.ethers.provider.getBlockNumber();

  console.log("\n✅ ClawCourtEscrow deployed!");
  console.log("  Address    :", address);
  console.log("  Block      :", block);
  console.log("  Explorer   :", `https://explorer.testnet3.goat.network/address/${address}`);

  // ── Write shared/contract_meta.json ───────────────────────────────────
  const artifact = await hre.artifacts.readArtifact("ClawCourtEscrow");
  const meta = {
    network:     hre.network.name,
    chainId:     2345,
    address:     address,
    deployedAt:  block,
    abi:         artifact.abi,
  };

  const metaPath = path.join(__dirname, "..", "shared", "contract_meta.json");
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  console.log("\n📄 shared/contract_meta.json updated — Teammate 2 is unblocked.");

  // ── Reminder ───────────────────────────────────────────────────────────
  console.log("\n⚠️  NEXT STEP: Transfer ownership to the Gateway wallet.");
  console.log("   Run in Remix or via script:");
  console.log(`   escrow.transferOwnership("<GATEWAY_WALLET_ADDRESS>")`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
