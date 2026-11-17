import { defineChain, type Address, type Chain } from "viem";
import localhost from "./deployments/localhost.json";
import qieTestnet from "./deployments/qieTestnet.json";
import qieMainnet from "./deployments/qieMainnet.json";

export type NetworkName = "localhost" | "qieTestnet" | "qieMainnet";

type Deployment = {
  network: string;
  chainId: number;
  deployBlock: number;
  AjoForwarder: string;
  AjoPassbook: string;
  AjoCircle: string;
  Stablecoin?: string;
};

const CHAINS: Record<NetworkName, Chain> = {
  localhost: defineChain({
    id: 31337,
    name: "Local test chain",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
  }),
  qieTestnet: defineChain({
    id: 1983,
    name: "QIE Testnet",
    nativeCurrency: { name: "QIE", symbol: "QIE", decimals: 18 },
    rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_QIE_TESTNET_RPC || "https://rpc1testnet.qie.digital"] } },
    blockExplorers: { default: { name: "QIE Testnet Explorer", url: "https://testnet.qie.digital" } },
    testnet: true,
  }),
  qieMainnet: defineChain({
    id: 1990,
    name: "QIE Mainnet",
    nativeCurrency: { name: "QIE", symbol: "QIE", decimals: 18 },
    rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_QIE_MAINNET_RPC || "https://rpc1mainnet.qie.digital"] } },
    blockExplorers: { default: { name: "QIE Explorer", url: "https://mainnet.qie.digital" } },
  }),
};

const DEPLOYMENTS: Record<NetworkName, Deployment> = { localhost, qieTestnet, qieMainnet };

export const NETWORK: NetworkName = (process.env.NEXT_PUBLIC_NETWORK as NetworkName) || "localhost";
export const chain = CHAINS[NETWORK];
const d = DEPLOYMENTS[NETWORK];

export const addresses = {
  forwarder: d.AjoForwarder as Address,
  passbook: d.AjoPassbook as Address,
  circle: d.AjoCircle as Address,
  stablecoin: (d.Stablecoin || "") as Address,
};
export const deployBlock = BigInt(d.deployBlock || 0);
export const isDeployed = Boolean(d.AjoPassbook);

export function explorerTx(hash: string): string | null {
  const url = chain.blockExplorers?.default.url;
  return url ? `${url}/tx/${hash}` : null;
}

export function explorerAddress(address: string): string | null {
  const url = chain.blockExplorers?.default.url;
  return url ? `${url}/address/${address}` : null;
}

/** QIE uses legacy (type-0) transactions; the local chain accepts either. */
export const useLegacyTx = chain.id !== 31337;
