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
      // QIE runs the Shanghai EVM: Cancun opcodes (mcopy, tload/tstore) are invalid there.
      evmVersion: "shanghai",
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    qieTestnet: {
      url: process.env.QIE_TESTNET_RPC || "https://rpc1testnet.qie.digital/",
      chainId: 1983,
      accounts,
    },
    qieMainnet: {
      url: process.env.QIE_MAINNET_RPC || "",
      chainId: 1990,
      accounts,
    },
  },
};

export default config;
