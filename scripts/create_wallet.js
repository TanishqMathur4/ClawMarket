// scripts/create_wallet.js
// Generates a fresh EVM wallet and writes the private key to .env
// Only the public address is printed to stdout.

const { ethers } = require("ethers");
const fs   = require("fs");
const path = require("path");

const wallet  = ethers.Wallet.createRandom();
const envPath = path.join(__dirname, "..", ".env");

// Read existing .env and replace PRIVATE_KEY line
let env = fs.readFileSync(envPath, "utf8");
env = env.replace(
  /^PRIVATE_KEY=.*$/m,
  `PRIVATE_KEY=${wallet.privateKey.slice(2)}`  // strip 0x prefix
);
fs.writeFileSync(envPath, env, "utf8");

console.log("✅ Agent wallet created");
console.log("   Address :", wallet.address);
console.log("   .env updated with private key (key not displayed)");
console.log("\n📋 Paste this address into the hackathon Google Form:");
console.log("   " + wallet.address);
