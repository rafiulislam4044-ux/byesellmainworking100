import { Activity, Zap } from "lucide-react";
import WalletPanel from "@/components/WalletPanel";
import TokenInput from "@/components/TokenInput";
import TradePanel from "@/components/TradePanel";
import { useWallet } from "@/hooks/useWallet";
import { useTokenInfo } from "@/hooks/useTokenInfo";

const Index = () => {
  try {
    console.log("[v0] Index page rendering");
    const wallet = useWallet();
    console.log("[v0] Wallet hook initialized:", wallet.address);
    const token = useTokenInfo(wallet.address || undefined);
    console.log("[v0] Token hook initialized");

    const handleTradeComplete = () => {
      wallet.refreshBalance(wallet.address);
      if (token.tokenInfo) {
        token.fetchAll(token.tokenInfo.address);
      }
    };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-mono text-sm font-bold text-foreground tracking-tight">
              PURE<span className="text-primary">LOGIC</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Activity className="h-3 w-3 text-buy" />
            <span className="font-mono">Base Mainnet</span>
            <span className="font-mono text-primary">8453</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 py-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left column: Wallet + Token Info */}
            <div className="lg:col-span-5 space-y-4">
              <WalletPanel
                isConnected={wallet.isConnected}
                isLoading={wallet.isLoading}
                hasStored={wallet.hasStored}
                address={wallet.address}
                shortAddress={wallet.shortAddress}
                balance={wallet.balance}
                balanceUsd={wallet.balanceUsd}
                onConnect={wallet.connect}
                onUnlock={wallet.unlock}
                onDisconnect={wallet.disconnect}
              />
              <TokenInput
                tokenInfo={token.tokenInfo}
                tokenBalance={token.tokenBalance}
                tokenBalanceUsd={token.tokenBalanceUsd}
                tokenPriceUsd={token.tokenPriceUsd}
                liquidity={token.liquidity}
                isLoading={token.isLoading}
                error={token.error}
                onFetch={token.fetchAll}
                onReset={token.reset}
              />
            </div>

            {/* Right column: Trade Panel */}
            <div className="lg:col-span-7">
              <TradePanel
                wallet={wallet.wallet}
                ethBalance={wallet.balance}
                ethPrice={wallet.ethPrice}
                tokenInfo={token.tokenInfo}
                tokenBalance={token.tokenBalance}
                tokenPriceUsd={token.tokenPriceUsd}
                liquidity={token.liquidity}
                onTradeComplete={handleTradeComplete}
              />

              {/* Status footer */}
              <div className="mt-4 rounded-md border border-border bg-card p-3">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[9px] text-muted-foreground mb-0.5">Provider</p>
                    <p className="font-mono text-[10px] text-primary">Alchemy + 2 RPCs</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground mb-0.5">Gas Strategy</p>
                    <p className="font-mono text-[10px] text-primary">EIP-1559</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground mb-0.5">Approval</p>
                    <p className="font-mono text-[10px] text-card-foreground">MaxUint256</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-2">
        <p className="text-center text-[9px] text-muted-foreground font-mono">
          Pure Logic Trade System • Base Mainnet • Not financial advice
        </p>
      </footer>
    </div>
    );
  } catch (error) {
    console.error("[v0] Error in Index page:", error);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Error Loading Page</h1>
          <pre className="text-sm text-muted-foreground bg-card p-4 rounded-md overflow-auto max-h-64 text-left">
            {String(error)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
};

export default Index;
