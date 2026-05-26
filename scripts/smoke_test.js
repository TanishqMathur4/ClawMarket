// scripts/smoke_test.js — read-only sanity check on the live contract
const { ethers } = require("ethers");
require("dotenv").config();

const CONTRACT = "0xa5CC4A850e7DdF0ad3e648Df131c7829c83eE2bf";
const ABI = [
  "function owner() view returns (address)",
  "function token() view returns (address)",
  "function getStatus(bytes32 txId) view returns (uint8)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.GOAT_RPC_URL);
  const escrow   = new ethers.Contract(CONTRACT, ABI, provider);

  const owner  = await escrow.owner();
  const token  = await escrow.token();
  const status = await escrow.getStatus(ethers.ZeroHash);

  console.log("✅ Contract live on GOAT Mainnet");
  console.log("   Address :", CONTRACT);
  console.log("   Owner   :", owner);
  console.log("   Token   :", token);
  console.log("   Status of zero txId (should be 0/PENDING):", status.toString());

  const T2_GATEWAY = "0x10C8D0880C520868f9d130b392d0f2ee51379064";
  if (owner.toLowerCase() === T2_GATEWAY.toLowerCase()) {
    console.log("\n✅ Ownership correctly held by T2 gateway wallet");
  } else {
    console.log("\n⚠️  Owner mismatch — expected T2 gateway wallet");
  }
}

main().catch(console.error);
