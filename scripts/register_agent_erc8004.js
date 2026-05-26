// scripts/register_agent_erc8004.js
// ERC-8004 agent identity registration on GOAT Mainnet.
// Each teammate runs this with THEIR OWN private key + wallet.
//
// Usage:
//   PRIVATE_KEY=<your_key> AGENT_WALLET=<your_0x_address> AGENT_NAME=<name> \
//   node scripts/register_agent_erc8004.js

const { ethers } = require("ethers");
require("dotenv").config();

const REGISTRY_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const RPC_URL          = "https://rpc.goat.network";

// ERC-8004 ABI — correct signature from GOAT hackathon docs
const ABI = [
  {
    inputs: [{ name: "name", type: "string" }],
    name: "register",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "", type: "uint256" }],
    name: "getAgentWallet",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  }
];

async function main() {
  // ── Config — override via env vars ───────────────────────────────────────
  const privateKey   = process.env.PRIVATE_KEY;
  const agentWallet  = process.env.AGENT_WALLET  || "0x7679E1f285335addBADE42fd44559F51c4B42123";
  const agentName    = process.env.AGENT_NAME    || "hackathontest_bot";

  if (!privateKey) throw new Error("Set PRIVATE_KEY env var to your wallet's private key");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer   = new ethers.Wallet(privateKey, provider);

  console.log("Registering ERC-8004 agent...");
  console.log("  Registry :", REGISTRY_ADDRESS);
  console.log("  Signer   :", signer.address);
  console.log("  Agent    :", agentName);
  console.log("  Wallet   :", agentWallet);

  // agentId = keccak256 of the agent name
  const agentId = ethers.id(agentName);   // ethers v6: ethers.id() = keccak256(utf8)

  // metadataURI — inline JSON for demo (replace with IPFS URI if needed)
  const metadata = JSON.stringify({
    name:            agentName,
    wallet:          agentWallet,
    contractAddress: "0xa5CC4A850e7DdF0ad3e648Df131c7829c83eE2bf",
    network:         "GOAT Mainnet",
    chainId:         2345,
  });
  const metadataURI = `data:application/json;utf8,${metadata}`;

  const registry = new ethers.Contract(REGISTRY_ADDRESS, ABI, signer);

  const tx = await registry.register(agentName);
  console.log("\nTx submitted:", tx.hash);
  const receipt = await tx.wait();

  console.log("\n✅ Agent registered!");
  console.log("  Explorer:", `https://explorer.goat.network/tx/${tx.hash}`);
  console.log("  Check listing: https://8004scan.io/agents?chain=2345");
}

main().catch((err) => { console.error("❌", err.message); process.exitCode = 1; });
