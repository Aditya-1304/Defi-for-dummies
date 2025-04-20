import { Connection, PublicKey } from '@solana/web3.js';
import { BN } from "@coral-xyz/anchor"
import { WalletContextState } from '@solana/wallet-adapter-react';
import { getOrCreateToken } from './tokens-service';
import { executePoolSwap } from './solana-service';

export { executePoolSwap } from './solana-service';


export function calculateExpectedOutput(
  amountIn: number,
  reserveIn: number,
  reserveOut: number,
  inputDecimals: number,
  outputDecimals: number,
): { outputAmount: number, minOutputAmount: number, priceImpactBps: number } {
  const amountInRaw = new BN(Math.floor(amountIn * Math.pow(10, inputDecimals)));
  const reserveInRaw = new BN(reserveIn);
  const reserveOutRaw = new BN(reserveOut);

  const amountInU128 = BigInt(amountInRaw.toString());
  const reserveInU128 = BigInt(reserveInRaw.toString());
  const reserveOutU128 = BigInt(reserveOutRaw.toString());

  if (reserveInU128 === BigInt(0) || reserveOutU128 === BigInt(0) || amountInU128 === BigInt(0)) {
    return {
      outputAmount: 0,
      minOutputAmount: 0,
      priceImpactBps: 0,
    };
  }

  const feeNumerator = BigInt(3);
  const feeDenominator = BigInt(1000);
  const amountInAfterFee = (amountInU128 * (feeDenominator - feeNumerator)) / feeDenominator;

  const constantProduct = reserveInU128 * reserveOutU128;
  const newReserveIn = reserveInU128 + amountInAfterFee;
  const newReserveOut = constantProduct / newReserveIn;
  const amountOutU128 = reserveOutU128 > newReserveOut ? reserveOutU128 - newReserveOut : BigInt(0);


  const priceImpactBps = Number(
    (amountOutU128 * BigInt(10000)) / reserveOutU128
  );

  const outputAmount = Number(amountOutU128) / Math.pow(10, outputDecimals);

  const minOutputAmount = outputAmount * 0.995;

  return {
    outputAmount,
    minOutputAmount,
    priceImpactBps,
  }

}

export async function getSwapQuote(
  connection: Connection,
  fromTokenSymbol: string,
  toTokenSymbol: string,
  amountIn: number,
  wallet: WalletContextState,
  network: "localnet" | "devnet" | "mainnet" = "localnet",
): Promise<{
  fromToken: {
    symbol: string,
    decimals: number,
    mint: string,
  },
  toToken: {
    symbol: string,
    decimals: number,
    mint: string,
  },
  inputAmount: number,
  expectedOutputAmount: number,
  minOutputAmount: number,
  priceImpactBps: number,
  success: boolean,
  message?: string,
  needsPoolCreation?: boolean,
}> {
  try {
    console.log(` Getting swap quote: ${amountIn} ${fromTokenSymbol} -> ${toTokenSymbol}`);

    const fromTokenInfo = await getOrCreateToken(connection, wallet, fromTokenSymbol, network)

    const toTokenInfo = await getOrCreateToken(connection, wallet, toTokenSymbol, network)

    if (!fromTokenInfo || !toTokenInfo) {
      return {
        fromToken: {
          symbol: fromTokenSymbol,
          decimals: 0,
          mint: ""
        },
        toToken: {
          symbol: toTokenSymbol,
          decimals: 0,
          mint: "",
        },
        inputAmount: 0,
        expectedOutputAmount: 0,
        minOutputAmount: 0,
        priceImpactBps: 0,
        success: false,
        message: "Could not find token information"
      };
    }


    const program = getProgram(connection, wallet);

    try {
      const { poolPda } = await getPoolPDAs(
        program.programId,
        fromTokenInfo.mint,
        toTokenInfo.mint,
      );
      try {

        const poolAccount = await program.account.liquidityPool.fetch(poolPda);

        let fromTokenVault, toTokenVault;

        if ((poolAccount.tokenAMint.equals(fromTokenInfo.mint) && poolAccount.tokenBMint.equals(toTokenInfo.mint))) {
          fromTokenVault = poolAccount.tokenAVault;
          toTokenVault = poolAccount.tokenBVault
        } else if ((poolAccount.tokenBMint.equals(fromTokenInfo.mint) && poolAccount.tokenAMint.equals(toTokenInfo.mint))) {
          fromTokenVault = poolAccount.tokenBVault;
          toTokenVault = poolAccount.tokenAVault
        } else {
          return {
            fromToken: {
              symbol: fromTokenSymbol,
              decimals: fromTokenInfo.decimals,
              mint: fromTokenInfo.mint.toString(),
            },
            toToken: {
              symbol: toTokenSymbol,
              decimals: toTokenInfo.decimals,
              mint: toTokenInfo.mint.toString(),
            },
            inputAmount: amountIn,
            expectedOutputAmount: 0,
            minOutputAmount: 0,
            priceImpactBps: 0,
            success: false,
            message: "Pool not found for token pair"
          };
        }

        const fromVaultBalance = await connection.getTokenAccountBalance(fromTokenVault).then(res => Number(res.value.amount));

        const toVaultBalance = await connection.getTokenAccountBalance(toTokenVault).then(res => Number(res.value.amount));

        const { outputAmount, minOutputAmount, priceImpactBps } = calculateExpectedOutput(
          amountIn,
          fromVaultBalance,
          toVaultBalance,
          fromTokenInfo.decimals,
          toTokenInfo.decimals
        );

        return {
          fromToken: {
            symbol: fromTokenSymbol,
            decimals: fromTokenInfo.decimals,
            mint: fromTokenInfo.mint.toString(),
          },
          toToken: {
            symbol: toTokenSymbol,
            decimals: toTokenInfo.decimals,
            mint: toTokenInfo.mint.toString(),
          },
          inputAmount: amountIn,
          expectedOutputAmount: outputAmount,
          minOutputAmount,
          priceImpactBps,
          success: true,
        };
      } catch (error: any) {
        if (error.message.includes("Account does not exist") || error.message.includes("has no data")) {
          return {
            fromToken: {
              symbol: fromTokenSymbol,
              decimals: fromTokenInfo.decimals,
              mint: fromTokenInfo.mint.toString(),
            },
            toToken: {
              symbol: toTokenSymbol,
              decimals: fromTokenInfo.decimals,
              mint: fromTokenInfo.mint.toString(),
            },
            inputAmount: amountIn,
            expectedOutputAmount: 0,
            minOutputAmount: 0,
            priceImpactBps: 0,
            success: false,
            message: `No liquidity pool exist for ${fromTokenSymbol}/${toTokenSymbol}. Would you like to create it?`,
            needsPoolCreation: true,
          }
        }
        throw error;
      }

    } catch (error: any) {
      console.error("Error getting swap quote:", error);
      return {
        fromToken: {
          symbol: fromTokenSymbol,
          decimals: fromTokenInfo.decimals,
          mint: fromTokenInfo.mint.toString(),
        },
        toToken: {
          symbol: toTokenSymbol,
          decimals: toTokenInfo.decimals,
          mint: toTokenInfo.mint.toString(),
        },
        inputAmount: amountIn,
        expectedOutputAmount: 0,
        minOutputAmount: 0,
        priceImpactBps: 0,
        success: false,
        message: `Error calculating swap: ${error.message}`,
      };
    }
  } catch (error: any) {
    console.error("Failed to get swap quote:", error);
    return {
      fromToken: {
        symbol: fromTokenSymbol,
        decimals: 0,
        mint: "",
      },
      toToken: {
        symbol: toTokenSymbol,
        decimals: 0,
        mint: "",
      },
      inputAmount: 0,
      expectedOutputAmount: 0,
      minOutputAmount: 0,
      priceImpactBps: 0,
      success: false,
      message: `Failed to get swap quote: ${error.message}`
    }
  }
}


export async function executeSwap(
  connection: Connection,
  wallet: WalletContextState,
  fromTokenSymbol: string,
  toTokenSymbol: string,
  amountIn: number,
  slippageBps: number = 50,
  network: "localnet" | "devnet" | "mainnet" = "localnet",

): Promise<{
  success: boolean;
  message?: string;
  signature?: string;
  explorerUrl?: string;
  inputAmount?: number;
  outputAmount?: number;
  error?: any;
}> {
  return executePoolSwap(
    connection,
    wallet,
    fromTokenSymbol,
    toTokenSymbol,
    amountIn,
    slippageBps,
    network,
  );
}

function getProgram(connection: Connection, wallet: any) {
  const { getProgram } = require('./solana-service');
  return getProgram(connection, wallet);
}

async function getPoolPDAs(programId: PublicKey, mintA: PublicKey, mintB: PublicKey) {
  const { getPoolPDAs } = require('./solana-service');
  return getPoolPDAs(programId, mintA, mintB)
}
