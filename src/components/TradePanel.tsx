import { useState } from "react";
import { ArrowDownUp, Loader2, Zap, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ethers } from "ethers";
import { executeBuy, executeSell } from "@/lib/trading";
import type { TokenInfo } from "@/lib/tokens";
import type { LiquidityResult } from "@/lib/liquidity";
import { formatUsd } from "@/lib/prices";
import { toast } from "sonner";

interface TradePanelProps {
  wallet: ethers.Wallet | null;
  ethBalance: string;
  ethPrice: number;
  tokenInfo: TokenInfo | null;
  tokenBalance: string;
  tokenPriceUsd: number;
  liquidity: LiquidityResult | null;
  onTradeComplete: () => void;
}

export default function TradePanel({
  wallet,
  ethBalance,
  ethPrice,
  tokenInfo,
  tokenBalance,
  tokenPriceUsd,
  liquidity,
  onTradeComplete,
}: TradePanelProps) {
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("15");
  const [isExecuting, setIsExecuting] = useState(false);

  const maxBalance = mode === "buy" ? ethBalance : tokenBalance;
  const symbol = mode === "buy" ? "ETH" : tokenInfo?.symbol || "TOKEN";

  // USD value of current amount
  const amountNum = parseFloat(amount) || 0;
  const amountUsd =
    mode === "buy"
      ? amountNum * ethPrice
      : amountNum * tokenPriceUsd;

  const quickAmounts = [25, 50, 75, 100];

  const handleQuickAmount = (pct: number) => {
    const max = parseFloat(maxBalance);
    if (isNaN(max) || max <= 0) return;
    // For buy at 100%, leave gas buffer; for sell at 100%, use full balance
    const val = mode === "buy" && pct === 100 ? max * 0.95 : max * (pct / 100);
    setAmount(mode === "buy" ? val.toFixed(6) : val.toFixed(4));
  };

  // Low ETH warning for sells
  const ethBalNum = parseFloat(ethBalance);
  const lowGasWarning = mode === "sell" && ethBalNum < 0.001 && wallet;

  const canTrade =
    wallet &&
    tokenInfo &&
    liquidity?.hasLiquidity &&
    amount &&
    parseFloat(amount) > 0 &&
    parseFloat(slippage) > 0;

  const handleTrade = async () => {
    if (!canTrade || !wallet || !tokenInfo || !liquidity) return;
    setIsExecuting(true);

    const toastId = toast.loading(
      `${mode === "buy" ? "Buying" : "Selling"} ${tokenInfo.symbol}...`
    );

    try {
      const params = {
        tokenAddress: tokenInfo.address,
        amount,
        slippage: parseInt(slippage),
        wallet,
        dex: liquidity.dex,
        router: liquidity.router,
        fee: liquidity.fee,
        isStable: liquidity.isStable,
      };

      const tx = mode === "buy" ? await executeBuy(params) : await executeSell(params);

      toast.loading(`TX broadcast: ${tx.hash.slice(0, 10)}...`, { id: toastId });

      await tx.wait();

      toast.success(`${mode === "buy" ? "Buy" : "Sell"} confirmed!`, {
        id: toastId,
        description: (
          <a
            href={`https://basescan.org/tx/${tx.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            View on BaseScan
          </a>
        ),
      });

      setAmount("");
      onTradeComplete();
    } catch (err: any) {
      console.error("Trade execution detailed error:", err);
      // Try to find the revert reason
      const reason = err?.reason || err?.shortMessage || err?.data?.message || err?.message || "Check console for details";
      toast.error("Trade failed", { id: toastId, description: reason });
    } finally {
      setIsExecuting(false);
    }
  };

  const disabled = !wallet || !tokenInfo;

  return (
    <div className="rounded-md border border-border bg-card p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ArrowDownUp className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium text-card-foreground">Trade</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Zap className="h-3 w-3" />
          Base Mainnet
        </div>
      </div>

      {/* Buy / Sell toggle */}
      <div className="flex gap-1 mb-3">
        <button
          onClick={() => { setMode("buy"); setAmount(""); }}
          className={`flex-1 text-xs font-semibold py-2 rounded-sm transition-all ${mode === "buy"
            ? "bg-buy text-buy-foreground glow-primary"
            : "bg-secondary text-secondary-foreground"
            }`}
        >
          BUY
        </button>
        <button
          onClick={() => { setMode("sell"); setAmount(""); }}
          className={`flex-1 text-xs font-semibold py-2 rounded-sm transition-all ${mode === "sell"
            ? "bg-sell text-sell-foreground glow-sell"
            : "bg-secondary text-secondary-foreground"
            }`}
        >
          SELL
        </button>
      </div>

      {/* Low gas warning */}
      {lowGasWarning && (
        <div className="flex items-center gap-2 rounded-sm bg-warning/10 border border-warning/20 px-2 py-1.5 mb-2">
          <AlertTriangle className="h-3 w-3 text-warning flex-shrink-0" />
          <span className="text-[10px] text-warning">
            Low ETH for gas ({ethBalance} ETH). Sells need ~0.000001 ETH for gas fees.
          </span>
        </div>
      )}

      {/* Amount input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Amount ({symbol})</span>
          <span className="text-[10px] text-muted-foreground">
            Max: <span className="font-mono text-card-foreground">{parseFloat(maxBalance).toFixed(4)}</span>
          </span>
        </div>

        <div className="relative">
          <Input
            type="number"
            step="any"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={disabled}
            className="font-mono text-sm bg-secondary border-border"
          />
          {amountUsd > 0 && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-primary">
              ≈ {formatUsd(amountUsd)}
            </span>
          )}
        </div>

        {/* Quick amount buttons */}
        <div className="grid grid-cols-4 gap-1">
          {quickAmounts.map((pct) => (
            <button
              key={pct}
              onClick={() => handleQuickAmount(pct)}
              disabled={disabled}
              className="text-[10px] font-mono py-1 rounded-sm bg-secondary text-secondary-foreground hover:bg-muted hover:text-card-foreground transition-colors disabled:opacity-40"
            >
              {pct}%
            </button>
          ))}
        </div>

        {/* Slippage */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">Slippage %</span>
          <Input
            type="number"
            step="1"
            min="1"
            max="50"
            value={slippage}
            onChange={(e) => setSlippage(e.target.value)}
            className="font-mono text-xs bg-secondary border-border h-7 w-16"
          />
          <div className="flex gap-1">
            {[5, 10, 15, 25].map((s) => (
              <button
                key={s}
                onClick={() => setSlippage(String(s))}
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm transition-colors ${slippage === String(s)
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-muted-foreground hover:text-secondary-foreground"
                  }`}
              >
                {s}%
              </button>
            ))}
          </div>
        </div>

        {/* Execute button */}
        <Button
          onClick={handleTrade}
          disabled={!canTrade || isExecuting}
          className={`w-full text-xs font-semibold h-9 transition-all ${mode === "buy"
            ? "bg-buy text-buy-foreground hover:bg-buy/90 glow-primary"
            : "bg-sell text-sell-foreground hover:bg-sell/90 glow-sell"
            } disabled:opacity-40 disabled:shadow-none`}
        >
          {isExecuting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : !wallet ? (
            "Connect wallet first"
          ) : !tokenInfo ? (
            "Paste token address"
          ) : !liquidity?.hasLiquidity ? (
            "No liquidity"
          ) : (
            `${mode === "buy" ? "BUY" : "SELL"} ${tokenInfo?.symbol || ""}`
          )}
        </Button>

        {liquidity?.hasLiquidity && (
          <p className="text-[9px] text-muted-foreground text-center">
            via {liquidity.dex} • Gas optimized for Base
          </p>
        )}
      </div>
    </div>
  );
}
