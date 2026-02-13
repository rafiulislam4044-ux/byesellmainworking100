import { useState, useCallback } from "react";
import { extractTokenAddress, getTokenInfo, fetchTokenBalance, type TokenInfo } from "@/lib/tokens";
import { checkLiquidityFast, type LiquidityResult } from "@/lib/liquidity";
import { fetchTokenPriceUsd, formatUsd } from "@/lib/prices";
import { toast } from "sonner";

export interface TokenState {
  tokenInfo: TokenInfo | null;
  tokenBalance: string;
  tokenBalanceUsd: string;
  tokenPriceUsd: number;
  liquidity: LiquidityResult | null;
  isLoading: boolean;
  error: string | null;
}

export function useTokenInfo(walletAddress?: string) {
  const [state, setState] = useState<TokenState>({
    tokenInfo: null,
    tokenBalance: "0",
    tokenBalanceUsd: "$0.00",
    tokenPriceUsd: 0,
    liquidity: null,
    isLoading: false,
    error: null,
  });

  const fetchAll = useCallback(
    async (input: string) => {
      const address = extractTokenAddress(input);
      if (!address) {
        setState((prev) => ({ ...prev, error: "No valid token address found" }));
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const [info, liq] = await Promise.all([
          getTokenInfo(address),
          checkLiquidityFast(address),
        ]);

        let balance = "0";
        if (walletAddress) {
          try {
            balance = await fetchTokenBalance(address, walletAddress);
          } catch {
            // no balance
          }
        }

        // Fetch token USD price from liquidity pair
        let tokenPriceUsd = 0;
        if (liq.hasLiquidity && liq.pairAddress) {
          try {
            tokenPriceUsd = await fetchTokenPriceUsd(
              liq.pairAddress,
              address,
              info.decimals
            );
          } catch {
            // price unavailable
          }
        }

        const balNum = parseFloat(balance);
        const balUsd = tokenPriceUsd > 0 ? balNum * tokenPriceUsd : 0;

        setState({
          tokenInfo: info,
          tokenBalance: balNum.toFixed(6),
          tokenBalanceUsd: formatUsd(balUsd),
          tokenPriceUsd,
          liquidity: liq,
          isLoading: false,
          error: null,
        });

        toast.success(`${info.symbol} detected`, {
          description: `${liq.dex} | ${tokenPriceUsd > 0 ? formatUsd(tokenPriceUsd) : "Price N/A"}`,
        });
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err.message || "Failed to fetch token info",
        }));
        toast.error("Token fetch failed");
      }
    },
    [walletAddress]
  );

  const reset = useCallback(() => {
    setState({
      tokenInfo: null,
      tokenBalance: "0",
      tokenBalanceUsd: "$0.00",
      tokenPriceUsd: 0,
      liquidity: null,
      isLoading: false,
      error: null,
    });
  }, []);

  return { ...state, fetchAll, reset };
}
