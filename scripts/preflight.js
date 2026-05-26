// scripts/preflight.js — one-time connectivity + balance check
require("dotenv").config();
const { ethers } = require("ethers");

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.GOAT_RPC_URL);
  const network  = await provider.getNetwork();
  console.log("✅ RPC connected");
  console.log("   Chain ID :", network.chainId.toString());

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log("   Deployer :", wallet.address);

  const bal = await provider.getBalance(wallet.address);
  const btc = ethers.formatUnits(bal, 8);
  console.log("   Balance  :", btc, "BTC");

  if (bal === 0n) {
    console.log("\n⏳ Balance is 0 — waiting for faucet funds before deploying.");
  } else {
    console.log("\n🚀 Ready to deploy!");
  }
}

main().catch(e => { console.error("❌", e.message); process.exitCode = 1; });
