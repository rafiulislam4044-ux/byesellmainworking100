import { ethers } from "ethers";
import { getAlchemyProvider } from "./provider";

// Minimal ERC20 ABI
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

// Bytes32 variant ABI (for MKR-style tokens)
const ERC20_BYTES32_ABI = [
  "function name() view returns (bytes32)",
  "function symbol() view returns (bytes32)",
];

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

// In-memory cache
const tokenInfoCache = new Map<string, TokenInfo>();

/**
 * Extract a token address from a string or URL (BaseScan, DexScreener, etc).
 */
export function extractTokenAddress(input: string): string | null {
  // Direct address
  const addrMatch = input.match(/0x[0-9a-fA-F]{40}/);
  if (addrMatch) return ethers.getAddress(addrMatch[0]);
  return null;
}

/**
 * Fetch token info with bytes32 fallback and caching.
 */
export async function getTokenInfo(address: string): Promise<TokenInfo> {
  const checksummed = ethers.getAddress(address);
  const cached = tokenInfoCache.get(checksummed);
  if (cached) return cached;

  const provider = getAlchemyProvider();
  const contract = new ethers.Contract(checksummed, ERC20_ABI, provider);
  const contractB32 = new ethers.Contract(checksummed, ERC20_BYTES32_ABI, provider);

  let name = "Unknown";
  let symbol = "???";
  let decimals = 18;

  try {
    decimals = await contract.decimals();
  } catch {
    // default 18
  }

  // Try string first, fallback to bytes32
  try {
    name = await contract.name();
  } catch {
    try {
      const raw = await contractB32.name();
      name = ethers.decodeBytes32String(raw);
    } catch {
      // keep Unknown
    }
  }

  try {
    symbol = await contract.symbol();
  } catch {
    try {
      const raw = await contractB32.symbol();
      symbol = ethers.decodeBytes32String(raw);
    } catch {
      // keep ???
    }
  }

  const info: TokenInfo = { address: checksummed, name, symbol, decimals };
  tokenInfoCache.set(checksummed, info);
  return info;
}

/**
 * Fetch token balance for a given wallet address.
 */
export async function fetchTokenBalance(
  tokenAddress: string,
  walletAddress: string
): Promise<string> {
  const provider = getAlchemyProvider();
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const [balance, decimals] = await Promise.all([
    contract.balanceOf(walletAddress),
    contract.decimals(),
  ]);
  return ethers.formatUnits(balance, decimals);
}

/**
 * Check current allowance and approve if needed (MaxUint256 single approval).
 */
export async function ensureApproval(
  tokenAddress: string,
  spenderAddress: string,
  wallet: ethers.Wallet
): Promise<ethers.TransactionResponse | null> {
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
  const allowance = await contract.allowance(wallet.address, spenderAddress);
  
  if (allowance < ethers.MaxUint256 / 2n) {
    const tx = await contract.approve(spenderAddress, ethers.MaxUint256);
    return tx;
  }
  return null;
}

export const WETH_BASE = "0x4200000000000000000000000000000000000006";
