import { Connection, PublicKey, Keypair, Transaction } from "@solana/web3.js";
import {
  createMint, getMint, getOrCreateAssociatedTokenAccount, createTransferInstruction,
  mintTo, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
  transfer, TOKEN_PROGRAM_ID, TokenAccountNotFoundError,
  createInitializeMintInstruction, createMintToInstruction
} from "@solana/spl-token";
import * as web3 from '@solana/web3.js';

// Definition for token information
export type TokenInfo = {
  mint: PublicKey;
  decimals: number;
  symbol: string;
  name?: string;
  logoURI?: string;
};

const mintInfoCache: Record<string, any> = {};

let hasPreloaded = false;


// Cache tokens per network to reduce RPC calls
export const tokenCache: Record<string, Record<string, TokenInfo>> = {
  localnet: {},
  devnet: {},
  mainnet: {},
};

export function preloadTokensFromLocalStorage(): void {
  if (typeof window === 'undefined') return;

  if(hasPreloaded) {
    console.log("Token preloading already done");
    return;
  }
  
  const networks = ["localnet", "devnet", "mainnet"];
  
  for (const network of networks) {
    // Get all keys from localStorage that match our token pattern
    const tokenKeys = Object.keys(localStorage).filter(key => 
      key.startsWith(`token_${network}_`)
    );
    
    for (const key of tokenKeys) {
      try {
        // Extract the token symbol from the key (token_network_SYMBOL)
        const tokenSymbol = key.split('_')[2];
        const cachedToken = localStorage.getItem(key);
        
        if (cachedToken) {
          const parsed = JSON.parse(cachedToken);
          tokenCache[network][tokenSymbol] = {
            mint: new PublicKey(parsed.address),
            decimals: parsed.decimals,
            symbol: tokenSymbol,
            name: `${tokenSymbol} Test Token`
          };
          console.log(`Preloaded ${tokenSymbol} token on ${network} from localStorage`);
        }
      } catch (error) {
        console.error(`Error preloading token from ${key}:`, error);
      }
    }
  }
  hasPreloaded = true;
  console.log('Token preloading complete:', tokenCache);
}

// Well-known token addresses for different networks
export const KNOWN_TOKENS: Record<string, Record<string, string>> = {
  devnet: {
    'USDC': '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
  },
  mainnet: {
    'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    'SOL': 'So11111111111111111111111111111111111111112', // Native SOL wrapped
    'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    'JUP': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'
  },
};

// Default token decimals
const DEFAULT_TOKEN_DECIMALS: Record<string, number> = {
  'USDC': 6,
  'USDT': 6, 
  'SOL': 9,
  'DEFAULT': 9
};

/**
 * Get a token's info or create it if it doesn't exist (for localnet/devnet)
 */
export async function getOrCreateToken(
  connection: Connection, 
  wallet: any, // Wallet adapter
  symbol: string, 
  network: "localnet" | "devnet" | "mainnet" = "localnet"
): Promise<TokenInfo> {
  // 1. Check if we already have this token in cache
  const upperSymbol = symbol.toUpperCase();
  if (tokenCache[network][upperSymbol]) {
    console.log(`Using cached ${upperSymbol} token`)
    return tokenCache[network][upperSymbol];
  }

  if(typeof window !== 'undefined') {
    const cachedToken = localStorage.getItem(`token_${network}_${upperSymbol}`);
    if (cachedToken) {
      try {
        const parsed = JSON.parse(cachedToken);
        const tokenInfo = {
          mint: new PublicKey(parsed.address),
          decimals: parsed.decimals,
          symbol: upperSymbol,
          name: `${upperSymbol} Test Token`,
        };

        tokenCache[network][upperSymbol] = tokenInfo;
        console.log(`Loaded ${upperSymbol} token from localStorage cache`);
        return tokenInfo;
      } catch (error) {
        console.error(`Error parsing cached token ${upperSymbol} from localStorage:`, error);
        localStorage.removeItem(`token_${network}_${upperSymbol}`);
      }
    }
  }


  // 2. If it's a known token on this network, get its info
  if (network !== "localnet" && KNOWN_TOKENS[network]?.[upperSymbol]) {
    try {
      const mintAddress = new PublicKey(KNOWN_TOKENS[network][upperSymbol]);
      const mintInfo = await getMint(connection, mintAddress);

      const tokenInfo = {
        mint: mintAddress,
        decimals: mintInfo.decimals,
        symbol: upperSymbol,
        name: upperSymbol
      };

      // Cache it for future use
      tokenCache[network][upperSymbol] = tokenInfo;
      return tokenInfo;
    } catch (error) {
      console.error(`Failed to get info for known token ${upperSymbol}:`, error);
      // Continue to create a new token if we couldn't find the known one
    }
  }

  // 3. For localnet or if the token isn't known, create a new one
  if (network === "localnet" || network === "devnet") {
    console.log(`Creating new token ${upperSymbol} on ${network}...`);
    const tokenInfo = await createNewToken(connection, wallet, upperSymbol, network);

    if (typeof window !== 'undefined') {
      localStorage.setItem(`token_${network}_${upperSymbol}`, JSON.stringify({
        address: tokenInfo.mint.toString(),
        decimals: tokenInfo.decimals,
      }));
    }
    return tokenInfo;
  }

  // 4. If we're on mainnet and token isn't known, we can't create it
  throw new Error(`Token ${upperSymbol} not found on ${network}`);
}

/**
 * Create a new token for testing purposes
 */
async function createNewToken(
  connection: Connection,
  wallet: any,
  symbol: string,
  network: "localnet" | "devnet" | "mainnet"
): Promise<TokenInfo> {
  try {
    if (!wallet.publicKey) throw new Error("Wallet not connected");
    
    const upperSymbol = symbol.toUpperCase();
    const decimals = DEFAULT_TOKEN_DECIMALS[upperSymbol] || DEFAULT_TOKEN_DECIMALS.DEFAULT;
    
    console.log(`Creating ${upperSymbol} token with ${decimals} decimals...`);
    
    // Generate keypair for the new token mint
    const mintKeypair = Keypair.generate();
    console.log(`Mint keypair created: ${mintKeypair.publicKey.toString()}`);
    
    // Build the transaction for creating a mint
    const transaction = new Transaction();
    
    // Get minimum lamports for rent exemption
    const lamports = await connection.getMinimumBalanceForRentExemption(
      82 // Size of a mint account
    );
    
    // Create account instruction
    transaction.add(
      web3.SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: 82,
        lamports,
        programId: TOKEN_PROGRAM_ID
      }),
      // Initialize mint instruction
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        decimals,
        wallet.publicKey, // Set wallet as mint authority
        wallet.publicKey, // Set wallet as freeze authority
        TOKEN_PROGRAM_ID
      )
    );
    
    // Get blockhash and sign transaction
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    // Mint keypair needs to sign first
    transaction.partialSign(mintKeypair);
    
    // Then wallet signs
    const signedTransaction = await wallet.signTransaction(transaction);
    
    // Send transaction
    console.log("Sending transaction to create token mint...");
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());

    console.log("Waiting for mint creation confirmation...");
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight: await connection.getBlockHeight()
    }, 'confirmed');
    
    console.log(`Token mint created with signature: ${signature}`);

    console.log("Creating associated token account...");
    
    // // Now create the associated token account and mint some tokens
    // const tokenAccount = await getOrCreateAssociatedTokenAccount(
    //   connection,
    //   { 
    //     publicKey: wallet.publicKey, 
    //     signTransaction: wallet.signTransaction 
    //   }as any, // Simplified signer for ATA creation
    //   mintKeypair.publicKey,
    //   wallet.publicKey
    // );

    // const tokenAccountAddress = await getAssociatedTokenAddress(
    //   mintKeypair.publicKey,
    //   wallet.publicKey
    // );

    // const createAtaTransaction = new Transaction().add(
    //   createAssociatedTokenAccountInstruction(
    //     wallet.publicKey,
    //     tokenAccountAddress,
    //     wallet.publicKey,
    //     mintKeypair.publicKey
    //   )
    // );

    // const { blockhash: ataBlockhash } = await connection.getLatestBlockhash();
    // createAtaTransaction.recentBlockhash = ataBlockhash;
    // createAtaTransaction.feePayer = wallet.publicKey;

    // const signedAtaTx = await wallet.signTransaction(createAtaTransaction);
    // const ataTxId = await connection.sendRawTransaction(signedAtaTx.serialize());

    // await connection.confirmTransaction({
    //   signature: ataTxId,
    //   blockhash: ataBlockhash,
    //   lastValidBlockHeight: await connection.getBlockHeight()
    // }, 'confirmed');
    
    // console.log(`Token account created: ${tokenAccountAddress.toString()}`);
    
    // // Mint initial tokens to the user (1000 by default)
    // const mintAmount = 1000 * (10 ** decimals);
    
    // // Create mint transaction
    // const mintTx = new Transaction();
    // mintTx.add(
    //   createMintToInstruction(
    //     mintKeypair.publicKey,
    //     tokenAccountAddress,
    //     wallet.publicKey,
    //     BigInt(mintAmount),
    //     [],
    //     TOKEN_PROGRAM_ID
    //   )
    // );
    
    // // Set transaction properties
    // const { blockhash: mintBlockhash } = await connection.getLatestBlockhash();
    // mintTx.recentBlockhash = mintBlockhash;
    // mintTx.feePayer = wallet.publicKey;
    
    // // Sign and send mint transaction
    // const signedMintTx = await wallet.signTransaction(mintTx);
    // const mintSignature = await connection.sendRawTransaction(signedMintTx.serialize());
    // await connection.confirmTransaction({
    //   signature: mintSignature,
    //   blockhash: mintBlockhash,
    //   lastValidBlockHeight: await connection.getBlockHeight()
    // }, 'confirmed');
    
    // console.log(`Minted ${mintAmount / (10 ** decimals)} tokens with signature: ${mintSignature}`);
    
    // // Create and cache token info
    // const tokenInfo = {
    //   mint: mintKeypair.publicKey,
    //   decimals,
    //   symbol: upperSymbol,
    //   name: `${upperSymbol} Test Token`,
    // };

    const tokenInfo = {
      mint: mintKeypair.publicKey,
      decimals,
      symbol: upperSymbol,
      name: `${upperSymbol} Test Token`,
    };
    
    tokenCache[network][upperSymbol] = tokenInfo;
    return tokenInfo;
  } catch (error: any) {
    console.error("Error creating token:", error);
    throw new Error(`Failed to create token ${symbol}: ${error.message}`);
  }
}

/**
 * Get token balance for a specific wallet
 */
export async function getTokenBalance(
  connection: Connection,
  wallet: any,
  tokenSymbol: string,
  network: "localnet" | "devnet" | "mainnet"
): Promise<{ balance: number, decimals: number }> {
  try {
    const upperSymbol = tokenSymbol.toUpperCase();
    
    // If token is SOL, get native balance
    if (upperSymbol === 'SOL') {
      const balance = await connection.getBalance(wallet.publicKey);
      return { 
        balance: balance / web3.LAMPORTS_PER_SOL, 
        decimals: 9 
      };
    }
    
    // Get token info (this will create the token if needed on localnet/devnet)
    const tokenInfo = await getOrCreateToken(connection, wallet, upperSymbol, network);
    
    // Get token account
    const tokenAddress = await getAssociatedTokenAddress(
      tokenInfo.mint,
      wallet.publicKey
    );
    
    try {
      // Get and parse token account data using getTokenAccountBalance
      const tokenBalance = await connection.getTokenAccountBalance(tokenAddress);
      
      return {
        balance: tokenBalance.value.uiAmount || 0,
        decimals: tokenInfo.decimals
      };
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        return { balance: 0, decimals: tokenInfo.decimals };
      }
      throw error;
    }
  } catch (error: any) {
    console.error(`Error getting ${tokenSymbol} balance:`, error);
    throw new Error(`Failed to get token balance: ${error.message}`);
  }
}

/**
 * Transfer tokens from one wallet to another
 */
export async function transferToken(
  connection: Connection,
  wallet: any,
  recipient: string,
  amount: number,
  tokenSymbol: string,
  network: "localnet" | "devnet" | "mainnet"
): Promise<string> {
  try {
    const upperSymbol = tokenSymbol.toUpperCase();
    
    // Get or create the token
    const tokenInfo = await getOrCreateToken(connection, wallet, upperSymbol, network);
    
    // Get sender's token account
    const senderTokenAccount = await getAssociatedTokenAddress(
      tokenInfo.mint, 
      wallet.publicKey
    );
    
    // Get or create recipient's token account
    const recipientPubkey = new PublicKey(recipient);
    const recipientTokenAccount = await getAssociatedTokenAddress(
      tokenInfo.mint,
      recipientPubkey
    );
    
    // Build transaction
    const transaction = new Transaction();
    
    // Check if recipient token account exists, if not, create it
    try {
      await connection.getAccountInfo(recipientTokenAccount);
    } catch (error) {
      // Add instruction to create the token account
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          recipientTokenAccount,
          recipientPubkey,
          tokenInfo.mint
        )
      );
    }
    
    // Convert amount to token units
    const tokenAmount = amount * Math.pow(10, tokenInfo.decimals);
    
    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        senderTokenAccount,           // source
        recipientTokenAccount,        // destination
        wallet.publicKey,             // owner
        BigInt(Math.floor(tokenAmount)), // amount as BigInt
        [],                           // multiSigners (empty for single signer)
        TOKEN_PROGRAM_ID              // program ID
      )
    );
    
    // Send transaction
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    const signature = await wallet.sendTransaction(transaction, connection);
    await connection.confirmTransaction(signature);
    
    return signature;
  } catch (error) {
    console.error(`Error transferring ${tokenSymbol}:`, error);
    throw error;
  }
}

/**
 * Mint more tokens to a wallet (for testing)
 */
export async function mintMoreTokens(
  connection: Connection,
  wallet: any,
  tokenSymbol: string,
  amount: number,
  network: "localnet" | "devnet" | "mainnet"
): Promise<boolean> {
  try {
    if (network === "mainnet") {
      throw new Error("Cannot mint tokens on mainnet");
    }
    
    const upperSymbol = tokenSymbol.toUpperCase();
    console.log(`Preparing to mint ${amount} ${upperSymbol} tokens`);
    // Get token info (this will create the token if needed)
    const tokenInfo = await getOrCreateToken(connection, wallet, upperSymbol, network);
    
    // Get user's token account (or create if it doesn't exist)
    // const tokenAccount = await getOrCreateAssociatedTokenAccount(
    //   connection,
    //   { 
    //     publicKey: wallet.publicKey, 
    //     signTransaction: wallet.signTransaction 
    //   }as any, // Simplified signer
    //   tokenInfo.mint,
    //   wallet.publicKey
    // );

    const tokenAccountAddress = await getAssociatedTokenAddress(
      tokenInfo.mint,
      wallet.publicKey
    )

    
    const transaction = new Transaction();

    let accountExists = false;

    try{
      const accountInfo = await connection.getAccountInfo(tokenAccountAddress);
      accountExists = !!accountInfo;
      console.log(`Token account ${accountExists ? 'exists' : 'does not exist'}`);
    }catch (error) {
      accountExists = false;
      console.log(`Error checking token account existence: ${error}, assuming it does not exist`);
    }

    if(!accountExists) {
      console.log(`Creating token account for ${upperSymbol}...`);

      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          tokenAccountAddress,
          wallet.publicKey,
          tokenInfo.mint
        )
      )
    }
    // Create a mint transaction
    const mintAmount = amount * Math.pow(10, tokenInfo.decimals);
    
    // Add mint instruction - the wallet is the mint authority because we set it that way in createNewToken
    transaction.add(
      createMintToInstruction(
        tokenInfo.mint,
        tokenAccountAddress,
        wallet.publicKey, // Mint authority is the wallet
        BigInt(Math.floor(mintAmount)),
        [],
        TOKEN_PROGRAM_ID
      )
    );
    
    // Get recent blockhash and sign
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    console.log(`Signing transaction with ${transaction.instructions.length} instructions...`);
    
    // Sign transaction with wallet
    const signedTx = await wallet.signTransaction(transaction);
    
    // Send and confirm transaction
    console.log(`Sending transaction to mint ${amount} ${upperSymbol} tokens...`);
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    await connection.confirmTransaction(signature);
    
    console.log(`Minted ${amount} ${tokenSymbol} with signature: ${signature}`);
    return true;
  } catch (error: any) {
    console.error(`Error minting ${tokenSymbol}:`, error);
    throw error;
  }
}

async function getMinInfo(connection: Connection, mintAddress: PublicKey) {
  const key = mintAddress.toString();
  if (!mintInfoCache[key]) {
    mintInfoCache[key] = await getMint(connection, mintAddress);
  }
  return mintInfoCache[key];
}