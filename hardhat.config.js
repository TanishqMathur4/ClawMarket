require("@nomicfoundation/hardhat-toolbox");
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
    hardhat: {},

    goatTestnet: {
      url: process.env.GOAT_RPC_URL || "https://rpc.goat.network",
      chainId: 2345,  // GOAT Mainnet
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },

  etherscan: {
    apiKey: {
      goatTestnet: process.env.GOAT_EXPLORER_API_KEY || "no-key-needed",
    },
    customChains: [
      {
        network: "goatTestnet",
        chainId: 2345,  // GOAT Mainnet
        urls: {
          apiURL: "https://explorer.goat.network/api",
          browserURL: "https://explorer.goat.network",
        },
      },
    ],
  },
};
