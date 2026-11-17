import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

// Never commit a real key. Put it in .env (which is git-ignored).
const accounts = process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      // QIE's own developer guide compiles with evmVersion "paris" for the widest compatibility
      // (no PUSH0 / Cancun opcodes), so we do the same.
      evmVersion: "paris",
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    qieTestnet: {
      url: process.env.QIE_TESTNET_RPC || "https://rpc1testnet.qie.digital",
      chainId: 1983,
      accounts,
    },
    qieMainnet: {
      url: process.env.QIE_MAINNET_RPC || "https://rpc1mainnet.qie.digital",
      chainId: 1990,
      accounts,
    },
  },
  // Source verification on QIE's Blockscout explorers (Etherscan-compatible API; any key string works).
  etherscan: {
    apiKey: { qieTestnet: "qie", qieMainnet: "qie" },
    customChains: [
      {
        network: "qieTestnet",
        chainId: 1983,
        urls: { apiURL: "https://testnet.qie.digital/api", browserURL: "https://testnet.qie.digital" },
      },
      {
        network: "qieMainnet",
        chainId: 1990,
        urls: { apiURL: "https://mainnet.qie.digital/api", browserURL: "https://mainnet.qie.digital" },
      },
    ],
  },
  sourcify: { enabled: false },
};

export default config;
