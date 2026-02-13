import { ethers } from "ethers";
import { getAlchemyProvider } from "./provider";
import { WETH_BASE } from "./tokens";

// DEX Factory addresses on Base
const UNISWAP_V2_FACTORY = "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6";
const AERODROME_FACTORY = "0x420DD381b31aEf6683db6B902084cB0FFECe40Da";
const UNISWAP_V3_FACTORY = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";

// Router addresses
export const UNISWAP_V2_ROUTER = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24";
export const AERODROME_ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";
export const UNISWAP_V3_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481";

const V2_FACTORY_ABI = ["function getPair(address, address) view returns (address)"];
const V3_FACTORY_ABI = ["function getPool(address, address, uint24) view returns (address)"];

export interface LiquidityResult {
  dex: "Uniswap V2" | "Aerodrome" | "Uniswap V3" | "None";
  router: string;
  pairAddress: string;
  hasLiquidity: boolean;
  fee?: number; // For V3
  isStable?: boolean; // For Aerodrome
}

/**
 * Scan for liquidity across Base DEXes. Priority: V2 > Aerodrome > V3.
 */
export async function checkLiquidityFast(tokenAddress: string): Promise<LiquidityResult> {
  const provider = getAlchemyProvider();
  const ZERO = ethers.ZeroAddress;

  // Check Uniswap V2
  try {
    const v2Factory = new ethers.Contract(UNISWAP_V2_FACTORY, V2_FACTORY_ABI, provider);
    const pair = await v2Factory.getPair(tokenAddress, WETH_BASE);
    if (pair !== ZERO) {
      const weth = new ethers.Contract(WETH_BASE, ["function balanceOf(address) view returns (uint256)"], provider);
      const wethBalance = await weth.balanceOf(pair);
      if (wethBalance > 0n) {
        return { dex: "Uniswap V2", router: UNISWAP_V2_ROUTER, pairAddress: pair, hasLiquidity: true };
      }
    }
  } catch { /* continue */ }

  // Check Aerodrome (uses same V2-style factory)
  try {
    const aeroFactory = new ethers.Contract(AERODROME_FACTORY, V2_FACTORY_ABI, provider);
    const pair = await aeroFactory.getPair(tokenAddress, WETH_BASE);
    if (pair !== ZERO) {
      const weth = new ethers.Contract(WETH_BASE, ["function balanceOf(address) view returns (uint256)"], provider);
      const wethBalance = await weth.balanceOf(pair);
      if (wethBalance > 0n) {
        return { dex: "Aerodrome", router: AERODROME_ROUTER, pairAddress: pair, hasLiquidity: true };
      }
    }
  } catch { /* continue */ }

  // Check Uniswap V3 (common fee tiers)
  const feeTiers = [3000, 10000, 500];
  for (const fee of feeTiers) {
    try {
      const v3Factory = new ethers.Contract(UNISWAP_V3_FACTORY, V3_FACTORY_ABI, provider);
      const pool = await v3Factory.getPool(tokenAddress, WETH_BASE, fee);
      if (pool !== ZERO) {
        return {
          dex: "Uniswap V3",
          router: UNISWAP_V3_ROUTER,
          pairAddress: pool,
          hasLiquidity: true,
          fee
        };
      }
    } catch { /* continue */ }
  }

  return { dex: "None", router: "", pairAddress: "", hasLiquidity: false };
}
