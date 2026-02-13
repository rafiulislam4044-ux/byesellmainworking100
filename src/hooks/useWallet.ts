import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import {
  connectHotWallet,
  encryptKey,
  decryptKey,
  saveEncryptedKey,
  loadEncryptedKey,
  clearStoredKey,
  hasStoredKey,
  shortenAddress,
} from "@/lib/wallet";
import { fetchNativeBalance } from "@/lib/provider";
import { fetchEthPrice, formatUsd } from "@/lib/prices";
import { toast } from "sonner";

export interface WalletState {
  wallet: ethers.Wallet | null;
  address: string;
  shortAddress: string;
  balance: string;
  balanceUsd: string;
  ethPrice: number;
  isConnected: boolean;
  isLoading: boolean;
  hasStored: boolean;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    wallet: null,
    address: "",
    shortAddress: "",
    balance: "0.0000",
    balanceUsd: "$0.00",
    ethPrice: 0,
    isConnected: false,
    isLoading: false,
    hasStored: hasStoredKey(),
  });

  const refreshBalance = useCallback(async (address: string) => {
    try {
      const [bal, ethPrice] = await Promise.all([
        fetchNativeBalance(address),
        fetchEthPrice(),
      ]);
      const balNum = parseFloat(bal);
      setState((prev) => ({
        ...prev,
        balance: balNum.toFixed(6),
        balanceUsd: formatUsd(balNum * ethPrice),
        ethPrice,
      }));
    } catch (e) {
      console.error("Balance fetch error:", e);
    }
  }, []);

  const connect = useCallback(
    async (privateKey: string, password: string) => {
      setState((prev) => ({ ...prev, isLoading: true }));
      try {
        const wallet = connectHotWallet(privateKey);
        const encrypted = await encryptKey(privateKey, password);
        saveEncryptedKey(encrypted);

        const [bal, ethPrice] = await Promise.all([
          fetchNativeBalance(wallet.address),
          fetchEthPrice(),
        ]);
        const balNum = parseFloat(bal);

        setState({
          wallet,
          address: wallet.address,
          shortAddress: shortenAddress(wallet.address),
          balance: balNum.toFixed(6),
          balanceUsd: formatUsd(balNum * ethPrice),
          ethPrice,
          isConnected: true,
          isLoading: false,
          hasStored: true,
        });

        toast.success("Wallet connected", {
          description: shortenAddress(wallet.address),
        });
      } catch (err: any) {
        setState((prev) => ({ ...prev, isLoading: false }));
        toast.error("Connection failed", {
          description: err.message || "Invalid private key",
        });
        throw err;
      }
    },
    []
  );

  const unlock = useCallback(
    async (password: string) => {
      setState((prev) => ({ ...prev, isLoading: true }));
      try {
        const encrypted = loadEncryptedKey();
        if (!encrypted) throw new Error("No stored wallet");

        const privateKey = await decryptKey(encrypted, password);
        const wallet = connectHotWallet(privateKey);
        const [bal, ethPrice] = await Promise.all([
          fetchNativeBalance(wallet.address),
          fetchEthPrice(),
        ]);
        const balNum = parseFloat(bal);

        setState({
          wallet,
          address: wallet.address,
          shortAddress: shortenAddress(wallet.address),
          balance: balNum.toFixed(6),
          balanceUsd: formatUsd(balNum * ethPrice),
          ethPrice,
          isConnected: true,
          isLoading: false,
          hasStored: true,
        });

        toast.success("Wallet unlocked");
      } catch (err: any) {
        setState((prev) => ({ ...prev, isLoading: false }));
        toast.error("Unlock failed", {
          description: "Wrong password or corrupted data",
        });
        throw err;
      }
    },
    []
  );

  const disconnect = useCallback(() => {
    clearStoredKey();
    setState({
      wallet: null,
      address: "",
      shortAddress: "",
      balance: "0.0000",
      balanceUsd: "$0.00",
      ethPrice: 0,
      isConnected: false,
      isLoading: false,
      hasStored: false,
    });
    toast.info("Wallet disconnected");
  }, []);

  // Auto-refresh balance every 15s when connected
  useEffect(() => {
    if (!state.isConnected || !state.address) return;
    const interval = setInterval(() => refreshBalance(state.address), 15000);
    return () => clearInterval(interval);
  }, [state.isConnected, state.address, refreshBalance]);

  return { ...state, connect, unlock, disconnect, refreshBalance };
}
