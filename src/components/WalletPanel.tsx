import { useState } from "react";
import { Wallet, Lock, Unlock, Copy, LogOut, Loader2, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface WalletPanelProps {
  isConnected: boolean;
  isLoading: boolean;
  hasStored: boolean;
  address: string;
  shortAddress: string;
  balance: string;
  balanceUsd: string;
  onConnect: (privateKey: string, password: string) => Promise<void>;
  onUnlock: (password: string) => Promise<void>;
  onDisconnect: () => void;
}

export default function WalletPanel({
  isConnected,
  isLoading,
  hasStored,
  address,
  shortAddress,
  balance,
  balanceUsd,
  onConnect,
  onUnlock,
  onDisconnect,
}: WalletPanelProps) {
  const [privateKey, setPrivateKey] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"new" | "unlock">(hasStored ? "unlock" : "new");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    try {
      if (mode === "new") {
        await onConnect(privateKey, password);
      } else {
        await onUnlock(password);
      }
      setPrivateKey("");
      setPassword("");
    } catch {
      // error handled in hook
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    toast.success("Address copied");
  };

  if (isConnected) {
    return (
      <div className="rounded-md border border-border bg-card p-4 animate-fade-in">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-buy animate-pulse-slow" />
            <span className="text-sm font-medium text-card-foreground">Connected</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDisconnect}
            className="text-muted-foreground hover:text-destructive h-7 px-2"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div
          className="flex items-center gap-2 cursor-pointer group mb-3"
          onClick={copyAddress}
        >
          <span className="font-mono text-sm text-card-foreground">{shortAddress}</span>
          <Copy className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-md bg-secondary px-3 py-2">
            <span className="text-xs text-muted-foreground">ETH Balance</span>
            <div className="text-right">
              <span className="font-mono text-sm font-semibold text-primary block">{balance} ETH</span>
              <span className="font-mono text-[10px] text-muted-foreground flex items-center justify-end gap-0.5">
                <DollarSign className="h-2.5 w-2.5" />
                {balanceUsd}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-card-foreground">Wallet Setup</span>
      </div>

      {hasStored && (
        <div className="flex gap-1 mb-3">
          <button
            onClick={() => setMode("unlock")}
            className={`flex-1 text-xs py-1.5 rounded-sm transition-colors ${
              mode === "unlock"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            <Unlock className="h-3 w-3 inline mr-1" />
            Unlock
          </button>
          <button
            onClick={() => setMode("new")}
            className={`flex-1 text-xs py-1.5 rounded-sm transition-colors ${
              mode === "new"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            <Lock className="h-3 w-3 inline mr-1" />
            New Key
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === "new" && (
          <Input
            type="password"
            placeholder="Private key (0x...)"
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            className="font-mono text-xs bg-secondary border-border"
          />
        )}
        <Input
          type="password"
          placeholder={mode === "new" ? "Encryption password" : "Enter password to unlock"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="text-xs bg-secondary border-border"
        />
        <Button
          type="submit"
          disabled={isLoading || !password || (mode === "new" && !privateKey)}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-8"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : mode === "new" ? (
            "Encrypt & Connect"
          ) : (
            "Unlock Wallet"
          )}
        </Button>
      </form>

      <p className="text-[10px] text-muted-foreground mt-2 leading-tight">
        Key is AES-256 encrypted before storage. Never transmitted.
      </p>
    </div>
  );
}
