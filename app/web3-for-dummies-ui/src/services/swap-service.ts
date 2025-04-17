import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { QuoteGetRequest, QuoteResponse, SwapMode } from '@jup-ag/api';
import { WalletContextState } from "@solana/wallet-adapter-react";

interface SwapResponse {
  swapTransaction: string; // base64 encoded transaction
  lastValidBlockHeight?: number;
  prioritizationFeeLamports?: number;
}

const JUPITER_API_URL = {
  'mainnet': 'https://quote-api.jup.ag/v6',
  'devnet': 'https://quote-api.jup.ag/v6/?cluster=devnet',
  'localnet': 'https://quote-api.jup.ag/v6/?cluster=devnet'
};

let tokenListCache: any[] = [];

export async function getJupiterTokens(networkType: 'mainnet' | "devnet" | "localnet" = "localnet") {
  if (tokenListCache.length > 0) {
    return tokenListCache;
  }

  try {
    const effectiveNetwork = networkType === "localnet" ? "devnet" : networkType;
    const apiUrl = effectiveNetwork === "mainnet" ? "https://token.jup.ag/all" : 'https://token.jup.ag/all?cluster=devnet'

    const response = await fetch(apiUrl)
    const { tokens } = await response.json();
    tokenListCache = tokens;
    return tokens;
  } catch (error) {
    console.error("Error fetching token list:", error);
    return [];
  }

}


export async function findTokenBySymbol(symbol: string, networkType: 'mainnet' | "devnet" | "localnet" = "localnet") {
  const tokens = await getJupiterTokens(networkType);
  return tokens.find((t: any) => t.symbol.toUpperCase() === symbol.toUpperCase());
}

export async function getSwapRoutes(
  connection: Connection,
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 100,
  network: "localnet" | "devnet" | "mainnet" = "localnet",
): Promise<QuoteResponse | null> {
  try {
    const effectiveNetwork = network === "localnet" ? "devnet" : network;
    const apiUrl = JUPITER_API_URL[effectiveNetwork];

    const params: QuoteGetRequest = {
      inputMint,
      outputMint,
      amount: amount,
      slippageBps,
      onlyDirectRoutes: false,
      swapMode: SwapMode.ExactIn,

    }

    const searchParams = new URLSearchParams();

    // Add each parameter to the URLSearchParams, converting values to strings
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    }


    const quoteUrl = `${apiUrl}/quote?${searchParams}`;

    // Fetch the quote
    const response = await fetch(quoteUrl);
    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.statusText}`);
    }

    const quoteResponse = await response.json() as QuoteResponse;
    return quoteResponse;
  } catch (error: any) {
    console.error("Error getting swap routes:", error)
    return null;
  }
}

export async function executeJupiterSwap(
  connection: Connection,
  wallet: WalletContextState,
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 100,
  network: "localnet" | "devnet" | "mainnet" = "localnet"
): Promise<{
  success: boolean;
  message: string;
  signature?: string;
  explorerUrl?: string;
  inputAmount?: number;
  outputAmount?: number;
  error?: any;
}> {
  try {
    if (!wallet.publicKey) {
      return {
        success: false,
        message: "wallet not connected"
      }
    };

    const effectiveNetwork = network === "localnet" ? "devnet" : network;

    if (network === 'localnet') {
      console.warn("Note: Jupiter doesn't support localnet directly. Using ")
    }

    const quoteResponse = await getSwapRoutes(
      connection,
      inputMint,
      outputMint,
      amount,
      slippageBps,
      effectiveNetwork
    );

    if (!quoteResponse) {
      return {
        success: false,
        message: "Failed to get quote for swap"
      };
    }

    // Get input and output token information
    const inputToken = await findTokenBySymbol(quoteResponse.inputMint, network);
    const outputToken = await findTokenBySymbol(quoteResponse.outputMint, network);

    const inputTokenDecimals = inputToken?.decimals || 9;
    const outputTokenDecimals = outputToken?.decimals || 9;

    const inputAmount = parseFloat(quoteResponse.inAmount) / Math.pow(10, inputTokenDecimals);
    const outputAmount = parseFloat(quoteResponse.outAmount) / Math.pow(10, outputTokenDecimals);

    const apiUrl = JUPITER_API_URL[network];
    const swapUrl = `${apiUrl}/swap`;

    const swapPayload = {
      quoteResponse,
      userPublicKey: wallet.publicKey.toString(),
      wrapAndUnwrapSol: true,
    }

    const swapResponse = await fetch(swapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(swapPayload)
    });

    if (!swapResponse.ok) {
      throw new Error(`Jupiter swap API error: ${swapResponse.statusText}`)
    }

    const swapResult = await swapResponse.json() as SwapResponse;

    const { swapTransaction } = swapResult;

    const serializedTransaction = Buffer.from(swapTransaction, 'base64');
    const versionedTransaction = VersionedTransaction.deserialize(serializedTransaction);

    if (wallet.signTransaction) {
      const signedTransaction = await wallet.signTransaction(versionedTransaction)
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());

      await connection.confirmTransaction(signature, 'processed')

      const explorerUrl = network === 'mainnet' ?
        `https://explorer.solana.com/tx/${signature}`
        : `https://explorer.solana.com/tx/${signature}?cluster=devnet`;


      return {
        success: true,
        signature,
        explorerUrl,
        inputAmount,
        outputAmount,
        message: `Successfully swapped ${inputAmount.toFixed(6)} ${inputToken?.symbol || 'tokens'} for ${outputToken?.symbol || 'tokens'}`,

      }
    } else {
      throw new Error("Wallet does not support signing transcations")
    }

  } catch (error: any) {
    console.error("Error executing Jupiter swap:", error);
    return {
      success: false,
      error,
      message: `Failed to execute swap: ${error.message}`
    };
  }
}