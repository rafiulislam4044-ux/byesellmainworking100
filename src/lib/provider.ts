import { ethers } from "ethers";

// Alchemy as primary, public RPCs as fallback
const ALCHEMY_KEY = import.meta.env.VITE_ALCHEMY_API_KEY || "";
const ALCHEMY_RPC = ALCHEMY_KEY 
  ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
  : "https://mainnet.base.org";
const ALCHEMY_WSS = ALCHEMY_KEY
  ? `wss://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
  : "";

const BASE_RPC_URLS = [
  ALCHEMY_RPC,
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
];

let _provider: ethers.FallbackProvider | null = null;
let _wsProvider: ethers.WebSocketProvider | null = null;
let _jsonProvider: ethers.JsonRpcProvider | null = null;

/**
 * Get the primary Alchemy JsonRpcProvider (fastest single-source).
 * Used for wallet signing to avoid FallbackProvider quirks with signing.
 */
export function getAlchemyProvider(): ethers.JsonRpcProvider {
  if (_jsonProvider) return _jsonProvider;
  _jsonProvider = new ethers.JsonRpcProvider(ALCHEMY_RPC, {
    chainId: 8453,
    name: "base",
  });
  return _jsonProvider;
}

/**
 * Get a highly reliable FallbackProvider for Base Mainnet.
 * Alchemy is priority 1 with highest weight, public RPCs as fallback.
 */
export function getBaseProvider(): ethers.FallbackProvider {
  if (_provider) return _provider;

  const providers = BASE_RPC_URLS.map((url, i) => ({
    provider: new ethers.JsonRpcProvider(url, {
      chainId: 8453,
      name: "base",
    }),
    priority: i + 1,
    stallTimeout: i === 0 ? 3000 : 2000,
    weight: i === 0 ? 3 : 1,  // Alchemy gets 3x weight
  }));

  _provider = new ethers.FallbackProvider(providers, 8453);
  return _provider;
}

/**
 * Get a WebSocket provider for real-time streaming via Alchemy WSS.
 */
export function getWsProvider(): ethers.WebSocketProvider | null {
  if (_wsProvider) return _wsProvider;
  try {
    if (!ALCHEMY_WSS) {
      console.warn("Alchemy WSS not configured, using HTTP fallback");
      return null;
    }
    _wsProvider = new ethers.WebSocketProvider(ALCHEMY_WSS, {
      chainId: 8453,
      name: "base",
    });
    return _wsProvider;
  } catch {
    console.warn("WSS provider failed, using HTTP fallback");
    return null;
  }
}

/**
 * Fetch native ETH balance for an address on Base.
 */
export async function fetchNativeBalance(address: string): Promise<string> {
  const provider = getAlchemyProvider();
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}

/**
 * Get current Base gas fee data (EIP-1559).
 */
export async function getGasData() {
  const provider = getAlchemyProvider();
  const feeData = await provider.getFeeData();
  // Base-optimized: ultra-low priority fee for fast inclusion
  const basePriorityFee = ethers.parseUnits("0.0001", "gwei");
  return {
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: basePriorityFee,
    gasPrice: feeData.gasPrice,
  };
}

export const BASE_CHAIN_ID = 8453;
