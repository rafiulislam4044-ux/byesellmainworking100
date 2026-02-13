import { getAlchemyProvider } from "./provider";
import { ethers } from "ethers";
import { WETH_BASE } from "./tokens";

// Chainlink ETH/USD price feed on Base
const ETH_USD_FEED = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70";
const FEED_ABI = [
  "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
  "function decimals() view returns (uint8)",
];

// Uniswap V2 Pair ABI for token price
const PAIR_ABI = [
  "function getReserves() view returns (uint112, uint112, uint32)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
];

let _ethPriceCache: { price: number; timestamp: number } | null = null;
const CACHE_TTL = 30_000; // 30s

/**
 * Fetch ETH/USD price from Chainlink on Base.
 */
export async function fetchEthPrice(): Promise<number> {
  if (_ethPriceCache && Date.now() - _ethPriceCache.timestamp < CACHE_TTL) {
    return _ethPriceCache.price;
  }

  try {
    const provider = getAlchemyProvider();
    const feed = new ethers.Contract(ETH_USD_FEED, FEED_ABI, provider);
    const [, answer, , ,] = await feed.latestRoundData();
    const feedDecimals = await feed.decimals();
    const price = Number(answer) / Math.pow(10, Number(feedDecimals));
    _ethPriceCache = { price, timestamp: Date.now() };
    return price;
  } catch (e) {
    console.error("ETH price fetch failed:", e);
    // Fallback: return cached or 0
    return _ethPriceCache?.price || 0;
  }
}

/**
 * Get token price in USD using its WETH pair reserves.
 * Returns 0 if no pair found.
 */
export async function fetchTokenPriceUsd(
  pairAddress: string,
  tokenAddress: string,
  tokenDecimals: number
): Promise<number> {
  if (!pairAddress || pairAddress === ethers.ZeroAddress) return 0;

  try {
    const provider = getAlchemyProvider();
    const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);

    const [reserves, token0Addr, ethPrice] = await Promise.all([
      pair.getReserves(),
      pair.token0(),
      fetchEthPrice(),
    ]);

    const reserve0 = reserves[0];
    const reserve1 = reserves[1];

    const isToken0 = token0Addr.toLowerCase() === tokenAddress.toLowerCase();

    // Calculate token price in WETH
    let tokenPriceInEth: number;
    if (isToken0) {
      // token0 is our token, token1 is WETH
      const tokenReserve = Number(ethers.formatUnits(reserve0, tokenDecimals));
      const wethReserve = Number(ethers.formatEther(reserve1));
      tokenPriceInEth = tokenReserve > 0 ? wethReserve / tokenReserve : 0;
    } else {
      // token0 is WETH, token1 is our token
      const wethReserve = Number(ethers.formatEther(reserve0));
      const tokenReserve = Number(ethers.formatUnits(reserve1, tokenDecimals));
      tokenPriceInEth = tokenReserve > 0 ? wethReserve / tokenReserve : 0;
    }

    return tokenPriceInEth * ethPrice;
  } catch (e) {
    console.error("Token price fetch failed:", e);
    return 0;
  }
}

/**
 * Format USD value nicely.
 */
export function formatUsd(value: number): string {
  if (value === 0) return "$0.00";
  if (value < 0.01) return "<$0.01";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}
