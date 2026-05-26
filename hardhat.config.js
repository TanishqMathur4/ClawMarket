require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ethers");

// Load .env for private key and RPC URL (never commit secrets)
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    // Local Hardhat node (default for tests)
    hardhat: {},

    // GOAT Network Testnet
    goatTestnet: {
      url: process.env.GOAT_RPC_URL || "https://rpc.testnet3.goat.network",
      chainId: 2345,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },

  // Optional: Etherscan-compatible block explorer for GOAT
  etherscan: {
    apiKey: {
      goatTestnet: process.env.GOAT_EXPLORER_API_KEY || "no-key-needed",
    },
    customChains: [
      {
        network: "goatTestnet",
        chainId: 2345,
        urls: {
          apiURL: "https://explorer.testnet3.goat.network/api",
          browserURL: "https://explorer.testnet3.goat.network",
        },
      },
    ],
  },
};
