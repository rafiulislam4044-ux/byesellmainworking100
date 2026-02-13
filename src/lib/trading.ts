import { ethers } from "ethers";
import { getAlchemyProvider, getGasData } from "./provider";
import { WETH_BASE, ensureApproval } from "./tokens";

// Uniswap V2 Router ABI (shared by Aerodrome)
const V2_ROUTER_ABI = [
  "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable",
  "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)",
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[])",
];

// Uniswap V3 Router ABI
const V3_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256)",
];

// Aerodrome Router ABI
const AERODROME_ROUTER_ABI = [
  "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256 amountOutMin, (address from, address to, bool stable)[] routes, address to, uint256 deadline) payable",
  "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, (address from, address to, bool stable)[] routes, address to, uint256 deadline)",
  "function getAmountsOut(uint256 amountIn, (address from, address to, bool stable)[] routes) view returns (uint256[])",
];

export interface TradeParams {
  tokenAddress: string;
  amount: string; // in ETH for buy, token units for sell
  slippage: number; // percentage e.g. 5 for 5%
  wallet: ethers.Wallet;
  dex: string;
  router: string;
  fee?: number;
  isStable?: boolean;
}

/**
 * Estimate gas for a transaction and add 30% buffer.
 */
async function estimateGasWithBuffer(
  contract: ethers.Contract,
  method: string,
  args: any[],
  overrides: any
): Promise<bigint> {
  try {
    const estimated = await contract[method].estimateGas(...args, overrides);
    // Add 30% buffer for safety
    return (estimated * 130n) / 100n;
  } catch {
    // Default gas limit if estimation fails
    return 300000n;
  }
}

/**
 * Execute a BUY: ETH → Token via the identified DEX router.
 */
export async function executeBuy(params: TradeParams): Promise<ethers.TransactionResponse> {
  const { tokenAddress, amount, slippage, wallet, dex, router } = params;
  const gasData = await getGasData();
  const deadline = Math.floor(Date.now() / 1000) + 300; // 5 min
  const amountInWei = ethers.parseEther(amount);

  if (dex === "Uniswap V3") {
    const routerContract = new ethers.Contract(router, V3_ROUTER_ABI, wallet);
    const swapParams = {
      tokenIn: WETH_BASE,
      tokenOut: tokenAddress,
      fee: params.fee || 3000,
      recipient: wallet.address,
      amountIn: amountInWei,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
    };

    const gasLimit = await estimateGasWithBuffer(
      routerContract, "exactInputSingle", [swapParams],
      { value: amountInWei }
    );

    console.log("Uniswap V3 Buy Params:", swapParams);
    const tx = await routerContract.exactInputSingle(swapParams, {
      value: amountInWei,
      gasLimit,
      maxFeePerGas: gasData.maxFeePerGas,
      maxPriorityFeePerGas: gasData.maxPriorityFeePerGas,
    });
    return tx;
  }

  if (dex === "Aerodrome") {
    const routerContract = new ethers.Contract(router, AERODROME_ROUTER_ABI, wallet);
    const routes = [{ from: WETH_BASE, to: tokenAddress, stable: params.isStable || false }];
    console.log("Aerodrome Buy Routes:", routes);

    let amountOutMin = 0n;
    try {
      const amounts = await routerContract.getAmountsOut(amountInWei, routes);
      if (amounts[1] === 0n) {
        throw new Error("No liquidity available on Aerodrome for this token.");
      }
      amountOutMin = (amounts[1] * BigInt(100 - slippage)) / 100n;
    } catch (e: any) {
      if (e.message.includes("No liquidity")) throw e;
      // if it's another error, we'll try to proceed with 0 and let gas estimate catch it
    }

    const swapArgs = [amountOutMin, routes, wallet.address, deadline];
    const gasLimit = await estimateGasWithBuffer(
      routerContract, "swapExactETHForTokensSupportingFeeOnTransferTokens", swapArgs, { value: amountInWei }
    );

    console.log("Aerodrome Buy Args:", swapArgs);
    const tx = await routerContract.swapExactETHForTokensSupportingFeeOnTransferTokens(...swapArgs, {
      value: amountInWei,
      gasLimit,
      maxFeePerGas: gasData.maxFeePerGas,
      maxPriorityFeePerGas: gasData.maxPriorityFeePerGas,
    });
    return tx;
  }

  // Fallback: Uniswap V2
  const routerContract = new ethers.Contract(router, V2_ROUTER_ABI, wallet);

  let amountOutMin = 0n;
  try {
    const amounts = await routerContract.getAmountsOut(amountInWei, [WETH_BASE, tokenAddress]);
    if (amounts[1] === 0n) {
      throw new Error("No liquidity available on Uniswap V2 for this token.");
    }
    const expected = amounts[1];
    amountOutMin = (expected * BigInt(100 - slippage)) / 100n;
  } catch (e: any) {
    if (e.message.includes("No liquidity")) throw e;
  }

  const swapArgs = [amountOutMin, [WETH_BASE, tokenAddress], wallet.address, deadline];
  const gasLimit = await estimateGasWithBuffer(
    routerContract, "swapExactETHForTokensSupportingFeeOnTransferTokens", swapArgs, { value: amountInWei }
  );

  console.log("Uniswap V2 Buy Args:", swapArgs);
  const tx = await routerContract.swapExactETHForTokensSupportingFeeOnTransferTokens(...swapArgs, {
    value: amountInWei,
    gasLimit,
    maxFeePerGas: gasData.maxFeePerGas,
    maxPriorityFeePerGas: gasData.maxPriorityFeePerGas,
  });
  return tx;
}

/**
 * Execute a SELL: Token → ETH via the identified DEX router.
 */
export async function executeSell(params: TradeParams): Promise<ethers.TransactionResponse> {
  console.log("Starting Sell Execution:", params);
  const { tokenAddress, amount, slippage, wallet, dex, router } = params;
  const gasData = await getGasData();
  const deadline = Math.floor(Date.now() / 1000) + 300;

  const tokenContract = new ethers.Contract(
    tokenAddress,
    ["function decimals() view returns (uint8)", "function balanceOf(address) view returns (uint256)"],
    wallet
  );
  const [decimals, actualBalance] = await Promise.all([
    tokenContract.decimals(),
    tokenContract.balanceOf(wallet.address),
  ]);

  let amountInUnits = ethers.parseUnits(amount, decimals);
  if (amountInUnits > actualBalance) amountInUnits = actualBalance;
  if (amountInUnits === 0n) throw new Error("No token balance to sell");

  const approvalTx = await ensureApproval(tokenAddress, router, wallet);
  if (approvalTx) await approvalTx.wait();

  const provider = getAlchemyProvider();
  const ethBalance = await provider.getBalance(wallet.address);
  const minGasNeeded = ethers.parseUnits("0.000001", "ether");
  if (ethBalance < minGasNeeded) {
    throw new Error(`Insufficient ETH for gas. Need ~0.000001 ETH, have ${ethers.formatEther(ethBalance)} ETH`);
  }

  if (dex === "Uniswap V3") {
    const routerContract = new ethers.Contract(router, V3_ROUTER_ABI, wallet);
    const swapParams = {
      tokenIn: tokenAddress,
      tokenOut: WETH_BASE,
      fee: params.fee || 3000,
      recipient: wallet.address,
      amountIn: amountInUnits,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
    };

    const gasLimit = await estimateGasWithBuffer(routerContract, "exactInputSingle", [swapParams], {});
    console.log("Uniswap V3 Sell Params:", swapParams);
    const tx = await routerContract.exactInputSingle(swapParams, {
      gasLimit,
      maxFeePerGas: gasData.maxFeePerGas,
      maxPriorityFeePerGas: gasData.maxPriorityFeePerGas,
    });
    return tx;
  }

  if (dex === "Aerodrome") {
    const routerContract = new ethers.Contract(router, AERODROME_ROUTER_ABI, wallet);
    const routes = [{ from: tokenAddress, to: WETH_BASE, stable: params.isStable || false }];

    let amountOutMin = 0n;
    try {
      const amounts = await routerContract.getAmountsOut(amountInUnits, routes);
      if (amounts[1] === 0n) {
        throw new Error("Cannot sell: Zero liquidity on Aerodrome. You will get 0 ETH.");
      }
      amountOutMin = (amounts[1] * BigInt(100 - slippage)) / 100n;
    } catch (e: any) {
      if (e.message.includes("Zero liquidity")) throw e;
    }

    const swapArgs = [amountInUnits, amountOutMin, routes, wallet.address, deadline];
    const gasLimit = await estimateGasWithBuffer(
      routerContract, "swapExactTokensForETHSupportingFeeOnTransferTokens", swapArgs, {}
    );

    console.log("Aerodrome Sell Args:", swapArgs);
    const tx = await routerContract.swapExactTokensForETHSupportingFeeOnTransferTokens(...swapArgs, {
      gasLimit,
      maxFeePerGas: gasData.maxFeePerGas,
      maxPriorityFeePerGas: gasData.maxPriorityFeePerGas,
    });
    return tx;
  }

  // Fallback: Uniswap V2
  const routerContract = new ethers.Contract(router, V2_ROUTER_ABI, wallet);
  let amountOutMin = 0n;
  try {
    const amounts = await routerContract.getAmountsOut(amountInUnits, [tokenAddress, WETH_BASE]);
    if (amounts[1] === 0n) {
      throw new Error("Cannot sell: Zero liquidity on Uniswap V2. You will get 0 ETH.");
    }
    amountOutMin = (amounts[1] * BigInt(100 - slippage)) / 100n;
  } catch (e: any) {
    if (e.message.includes("Zero liquidity")) throw e;
  }

  const swapArgs = [amountInUnits, amountOutMin, [tokenAddress, WETH_BASE], wallet.address, deadline];
  const gasLimit = await estimateGasWithBuffer(
    routerContract, "swapExactTokensForETHSupportingFeeOnTransferTokens", swapArgs, {}
  );

  console.log("Uniswap V2 Sell Args:", swapArgs);
  const tx = await routerContract.swapExactTokensForETHSupportingFeeOnTransferTokens(...swapArgs, {
    gasLimit,
    maxFeePerGas: gasData.maxFeePerGas,
    maxPriorityFeePerGas: gasData.maxPriorityFeePerGas,
  });
  return tx;
}
