import { useState, useEffect, useRef } from "react";
import { Search, Loader2, ExternalLink, Droplets, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { TokenInfo } from "@/lib/tokens";
import type { LiquidityResult } from "@/lib/liquidity";
import { formatUsd } from "@/lib/prices";

interface TokenInputProps {
  tokenInfo: TokenInfo | null;
  tokenBalance: string;
  tokenBalanceUsd: string;
  tokenPriceUsd: number;
  liquidity: LiquidityResult | null;
  isLoading: boolean;
  error: string | null;
  onFetch: (input: string) => void;
  onReset: () => void;
}

export default function TokenInput({
  tokenInfo,
  tokenBalance,
  tokenBalanceUsd,
  tokenPriceUsd,
  liquidity,
  isLoading,
  error,
  onFetch,
  onReset,
}: TokenInputProps) {
  const [input, setInput] = useState("");
  const debounceRef = useRef<NodeJS.Timeout>();

  // Auto-fetch on paste or debounce
  useEffect(() => {
    if (!input || input.length < 42) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onFetch(input), 300);
    return () => clearTimeout(debounceRef.current);
  }, [input, onFetch]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    if (!val) onReset();
  };

  return (
    <div className="rounded-md border border-border bg-card p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <Search className="h-4 w-4 text-accent" />
        <span className="text-sm font-medium text-card-foreground">Token</span>
      </div>

      <div className="relative">
        <Input
          placeholder="Paste token address or URL..."
          value={input}
          onChange={handleChange}
          className="font-mono text-xs bg-secondary border-border pr-8"
        />
        {isLoading && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-accent" />
        )}
      </div>

      {error && (
        <p className="text-[10px] text-destructive mt-2">{error}</p>
      )}

      {tokenInfo && (
        <div className="mt-3 space-y-2 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-card-foreground">
                {tokenInfo.symbol}
              </span>
              <span className="text-xs text-muted-foreground">{tokenInfo.name}</span>
            </div>
            <a
              href={`https://basescan.org/token/${tokenInfo.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-accent transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Price */}
          {tokenPriceUsd > 0 && (
            <div className="flex items-center gap-1 rounded-sm bg-secondary px-2 py-1.5">
              <DollarSign className="h-3 w-3 text-primary" />
              <span className="text-xs text-muted-foreground">Price:</span>
              <span className="font-mono text-xs font-medium text-primary">
                {tokenPriceUsd < 0.000001
                  ? `$${tokenPriceUsd.toExponential(2)}`
                  : tokenPriceUsd < 0.01
                  ? `$${tokenPriceUsd.toFixed(8)}`
                  : formatUsd(tokenPriceUsd)}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-sm bg-secondary px-2 py-1.5">
              <span className="text-[10px] text-muted-foreground block">Balance</span>
              <span className="font-mono text-xs text-card-foreground block">{tokenBalance}</span>
              {tokenPriceUsd > 0 && (
                <span className="font-mono text-[10px] text-primary">{tokenBalanceUsd}</span>
              )}
            </div>
            <div className="rounded-sm bg-secondary px-2 py-1.5">
              <span className="text-[10px] text-muted-foreground block">Decimals</span>
              <span className="font-mono text-xs text-card-foreground">{tokenInfo.decimals}</span>
            </div>
          </div>

          {liquidity && (
            <div
              className={`flex items-center gap-2 rounded-sm px-2 py-1.5 ${
                liquidity.hasLiquidity
                  ? "bg-buy/10 border border-buy/20"
                  : "bg-destructive/10 border border-destructive/20"
              }`}
            >
              <Droplets
                className={`h-3 w-3 ${
                  liquidity.hasLiquidity ? "text-buy" : "text-destructive"
                }`}
              />
              <span
                className={`text-xs font-medium ${
                  liquidity.hasLiquidity ? "text-buy" : "text-destructive"
                }`}
              >
                {liquidity.hasLiquidity ? liquidity.dex : "No liquidity found"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
