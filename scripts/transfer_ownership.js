// scripts/transfer_ownership.js
// Transfers ClawCourtEscrow ownership to the T2 gateway wallet.
// Run once after deploy: npx hardhat run scripts/transfer_ownership.js --network goatTestnet

const hre = require("hardhat");

const CONTRACT_ADDRESS  = "0x31cE0A0c92E31BD4AC807f17b82019B6C47f4D61";
const GATEWAY_ADDRESS   = "0x10C8D0880C520868f9d130b392d0f2ee51379064";

async function main() {
  const [owner] = await hre.ethers.getSigners();
  console.log("Current owner:", owner.address);
  console.log("Transferring to:", GATEWAY_ADDRESS);

  const escrow = await hre.ethers.getContractAt("ClawCourtEscrow", CONTRACT_ADDRESS);

  const tx = await escrow.transferOwnership(GATEWAY_ADDRESS);
  console.log("Tx submitted:", tx.hash);
  await tx.wait();

  const newOwner = await escrow.owner();
  console.log("\n✅ Ownership transferred!");
  console.log("   New owner:", newOwner);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
