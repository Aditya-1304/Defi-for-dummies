import { Connection, PublicKey, Keypair, Transaction } from "@solana/web3.js";
import {
  getMint, createTransferInstruction,
  getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID, TokenAccountNotFoundError,
  createInitializeMintInstruction, createMintToInstruction, createCloseAccountInstruction,
  createBurnInstruction
} from "@solana/spl-token";
import * as web3 from '@solana/web3.js';
import { createLogger } from "@/utils/logger";

// Definition for token information
export type TokenInfo = {
  mint: PublicKey;
  decimals: number;
  symbol: string;
  name?: string;
  logoURI?: string;
};

function saveTokenMappingToLocalStorage(network: string, mintAddress: string, tokenInfo: {
  symbol: string;
  decimals: number;
}) {
  if (typeof window === 'undefined') return;

  try {
    // Change to plural to match saveTokenMappingsToLocalStorage
    const storageKey = `token-mappings-${network}`;
    const existing = localStorage.getItem(storageKey);
    const mappings = existing ? JSON.parse(existing) : {};

    mappings[mintAddress] = tokenInfo;
    localStorage.setItem(storageKey, JSON.stringify(mappings));
    console.log(`Saved token mapping for ${tokenInfo.symbol} (${mintAddress}) on ${network}`);
  } catch (err) {
    console.error("Failed to save token mapping to localStorage:", err);
  }
}
function getTokenMappingsFromLocalStorage(network: string): Record<string, {
  symbol: string;
  decimals: number;
}> {
  if (typeof window === 'undefined') return {};

  try {
    // Change this line to match the plural form used in saveTokenMappingsToLocalStorage
    const storageKey = `token-mappings-${network}`;
    const existing = localStorage.getItem(storageKey);
    return existing ? JSON.parse(existing) : {};
  } catch (err) {
    console.error("Failed to get token mappings from localStorage:", err);
    return {};
  }
}

const mintInfoCache: Record<string, any> = {};
const logger = createLogger("Tokens-Service");


let hasPreloaded = false;
const WRAPPED_SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const WRAPPED_SOL_INFO: TokenInfo = { mint: WRAPPED_SOL_MINT, decimals: 9, symbol: "SOL", name: "Wrapped SOL" }; // Added name for consistency



// Cache tokens per network to reduce RPC calls
export const tokenCache: Record<string, Record<string, TokenInfo>> = {
  localnet: {},
  devnet: {},
  mainnet: {},
};

export function preloadTokensFromLocalStorage(): void {
  if (typeof window === 'undefined') return;

  if (hasPreloaded) {
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
  'DEFAULT': 6
};

/**
 * Get a token's info or create it if it doesn't exist (for localnet/devnet)
 */
export async function getOrCreateToken(
  connection: Connection,
  wallet: any, // Wallet adapter
  symbol: string,
  network: "localnet" | "devnet" | "mainnet" = "localnet"
): Promise<TokenInfo | null> {
  console.log(`[getOrCreateToken] Called for symbol: ${symbol}, network: ${network}`) // Use logger
  const upperSymbol = symbol.toUpperCase();

  if (upperSymbol === "SOL") {
    console.log("[getOrCreateToken] Handling SOL symbol, returning Wrapped SOL info."); // Use logger
    // Ensure it's cached (optional but good practice)
    if (!tokenCache[network]) tokenCache[network] = {};
    tokenCache[network]["SOL"] = WRAPPED_SOL_INFO;
    // Optionally update localStorage if you persist SOL there using your specific function
    // saveTokenMappingsToLocalStorage("SOL", WRAPPED_SOL_MINT.toBase58(), network, 9); // Example using your function signature
    return WRAPPED_SOL_INFO;
  }
  // 1. Check if we already have this token in cache
  if (tokenCache[network][upperSymbol]) {
    console.log(`[getOrCreateToken] Using cached ${upperSymbol} token`)
    return tokenCache[network][upperSymbol];
  }
  const persistedMappings = getTokenMappingsFromLocalStorage(network);
  for (const [mintAddress, info] of Object.entries(persistedMappings)) {
    // Ensure info has symbol property before comparing
    if (info && info.symbol && info.symbol.toUpperCase() === upperSymbol) {
      // *** Skip if it's the fake SOL mint from previous runs ***
      // This check might be redundant now due to the top-level SOL handling, but keep for safety
      if (upperSymbol === "SOL" && mintAddress !== WRAPPED_SOL_MINT.toBase58()) {
        logger.warn(`[getOrCreateToken] Found non-wSOL mint (${mintAddress}) for symbol SOL in localStorage. Skipping.`); // Use logger
        continue; // Ignore this entry, rely on the special handling above
      }
      // *** End Skip ***

      console.log(`[getOrCreateToken] Found ${upperSymbol} in localStorage (Mint: ${mintAddress}). Verifying on-chain...`); // Use logger
      const mint = new PublicKey(mintAddress);
      try {
        // Verify mint exists on-chain (important!)
        const mintInfo = await getMint(connection, mint);
        const verifiedTokenInfo: TokenInfo = {
          mint: mint,
          decimals: mintInfo.decimals,
          symbol: upperSymbol,
          name: `${upperSymbol} Token` // Or fetch name if stored
        };
        // Cache it in memory
        if (!tokenCache[network]) tokenCache[network] = {};
        tokenCache[network][upperSymbol] = verifiedTokenInfo;
        console.log(`[getOrCreateToken] Verified and cached ${upperSymbol} from localStorage.`); // Use logger
        return verifiedTokenInfo;
      } catch (e) {
        logger.error(`[getOrCreateToken] Failed to verify mint ${mintAddress} from localStorage. Removing entry.`, e); // Use logger
        // Remove invalid entry from localStorage if verification fails
        delete persistedMappings[mintAddress];
        localStorage.setItem(`token-mappings-${network}`, JSON.stringify(persistedMappings));
      }
    }
  }

  if (typeof window !== 'undefined') {
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
      if (!tokenCache[network]) tokenCache[network] = {}; // Ensure network cache exists
      tokenCache[network][upperSymbol] = tokenInfo;
      console.log(`[getOrCreateToken] Found and cached known token ${upperSymbol}`);
      return tokenInfo;
    } catch (error) {
      console.error(`Failed to get info for known token ${upperSymbol}:`, error);
      // Continue, maybe try creating if on devnet/localnet (handled below)
    }
  }

  // 3. For localnet or if the token isn't known, create a new one
  // if (network === "localnet" || network === "devnet") {
  //   console.log(`Creating new token ${upperSymbol} on ${network}...`);
  //   const tokenInfo = await createNewToken(connection, wallet, upperSymbol, network);

  //   if (typeof window !== 'undefined') {
  //     localStorage.setItem(`token_${network}_${upperSymbol}`, JSON.stringify({
  //       address: tokenInfo.mint.toString(),
  //       decimals: tokenInfo.decimals,
  //     }));
  //   }
  //   return tokenInfo;
  // }
  if ((network === "localnet" || network === "devnet") && wallet && wallet.publicKey && upperSymbol !== "SOL") { // Ensure we don't try to create SOL
    console.log(`[getOrCreateToken] Token ${upperSymbol} not found. Attempting to create...`); // Use logger
    try {
      const newTokenInfo = await createNewToken(connection, wallet, upperSymbol, network); // Assuming createNewToken returns TokenInfo
      if (newTokenInfo) {
        // Add to cache
        if (!tokenCache[network]) tokenCache[network] = {};
        tokenCache[network][upperSymbol] = newTokenInfo;
        // Add to localStorage using your specific function
        saveTokenMappingsToLocalStorage(upperSymbol, newTokenInfo.mint.toBase58(), network, newTokenInfo.decimals); // Use your function signature
        return newTokenInfo;
      }
    } catch (error) {
      logger.error(`[getOrCreateToken] Failed to create new token ${upperSymbol}:`, error); // Use logger
      // Fall through to return null
    }
  }

  // 4. If we're on mainnet and token isn't known, we can't create it
  console.warn(`[getOrCreateToken] Token ${upperSymbol} could not be found or created. Returning null.`);
  return null;
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
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(); // Fetch both
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
    // Use the fetched lastValidBlockHeight and potentially increase timeout for localnet
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight // Use the height fetched before sending
    }, 'confirmed'); // You could add a longer timeout here if needed, e.g., { commitment: 'confirmed', confirmTransactionInitialTimeout: 60000 }

    if (confirmation.value.err) {
      throw new Error(`Mint creation transaction failed confirmation: ${JSON.stringify(confirmation.value.err)}`);
    }
    console.log("Mint creation confirmed.");
    console.log("Verifying mint account owner...");
    const mintAccountInfo = await connection.getAccountInfo(mintKeypair.publicKey);
    if (!mintAccountInfo) {
      console.error("Mint account not found after creation!");
      throw new Error("Mint account creation failed verification.");
    }
    console.log(`Mint account owner: ${mintAccountInfo.owner.toBase58()}`);
    if (!mintAccountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
      console.error(`Mint account owner is INCORRECT! Expected ${TOKEN_PROGRAM_ID.toBase58()}`);
      throw new Error("Mint account created with incorrect owner.");
    }
    console.log("Mint account owner verified successfully.");


    console.log(`Token mint created with signature: ${signature}`);

    console.log("Creating associated token account...");


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
    if (!tokenInfo) {
      // If token couldn't be found or created, return 0 balance with default/unknown decimals
      console.warn(`Could not get token info for ${upperSymbol} on ${network}. Returning 0 balance.`);
      // You might want to decide on a default decimal value or handle this differently
      return { balance: 0, decimals: DEFAULT_TOKEN_DECIMALS[upperSymbol] || DEFAULT_TOKEN_DECIMALS.DEFAULT };
    }

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
    if (!tokenInfo) {
      throw new Error(`Could not find or create token ${upperSymbol} on ${network}. Cannot perform transfer.`);
    }
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
    if (!tokenInfo) {
      // Throw a specific error if token couldn't be found/created
      throw new Error(`Could not find or create token ${upperSymbol} on ${network}. Creation might have failed. Cannot mint.`);
    }


    const tokenAccountAddress = await getAssociatedTokenAddress(
      tokenInfo.mint,
      wallet.publicKey
    )

    const transaction = new Transaction();
    let accountExists = false;

    try {
      const accountInfo = await connection.getAccountInfo(tokenAccountAddress);
      accountExists = !!accountInfo;
      console.log(`Token account ${accountExists ? 'exists' : 'does not exist'}`);
    } catch (error) {
      accountExists = false;
      console.log(`Error checking token account existence: ${error}, assuming it does not exist`);
    }

    if (!accountExists) {
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
    // Save token mapping to localStorage for persistence across server restarts
    saveTokenMappingToLocalStorage(network, tokenInfo.mint.toString(), {
      symbol: upperSymbol,
      decimals: tokenInfo.decimals
    });

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

export async function fetchUserTokens(
  connection: Connection,
  walletAddress: PublicKey,
  network: "localnet" | "devnet" | "mainnet" = "localnet",
  options: { hideUnknown?: boolean } = { hideUnknown: true }
): Promise<{
  mint: string;
  balance: number;
  symbol: string;
  decimals: number;
}[]> {
  if (!connection || !walletAddress) {
    console.log("Missing connection or wallet address");
    return [];
  }

  try {
    console.log(`Fetching on-chain tokens for ${walletAddress.toString()} on ${network}...`);

    // Get all token accounts owned by the user
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletAddress,
      { programId: TOKEN_PROGRAM_ID }
    );

    console.log(`Found ${tokenAccounts.value.length} token accounts`);

    // 1. First check mappings in localStorage (has priority)
    const mappingsKey = `token-mappings-${network}`;
    const mappingsJson = localStorage.getItem(mappingsKey);
    console.log(`Checking localStorage for token mappings with key: ${mappingsKey}`);
    const storedMappings = mappingsJson ? JSON.parse(mappingsJson) : {};
    console.log(`Found ${Object.keys(storedMappings).length} token mappings in localStorage`);

    // Process token accounts
    const tokens = tokenAccounts.value
      .map(account => {
        try {
          const parsedInfo = account.account.data.parsed.info;
          const mintAddress = parsedInfo.mint;
          const balance = parsedInfo.tokenAmount.uiAmount;

          // Skip tokens with zero balance
          if (balance === 0) return null;

          // Default symbol and decimals
          let symbol = "Unknown";
          let decimals = parsedInfo.tokenAmount.decimals;

          // 1. Check localStorage mappings first (highest priority)
          if (storedMappings[mintAddress]) {
            symbol = storedMappings[mintAddress].symbol;
            decimals = storedMappings[mintAddress].decimals || decimals;
            console.log(`Found token in localStorage: ${mintAddress} (${symbol})`);
          }
          // 2. Then check tokenCache if still unknown
          else if (symbol === "Unknown" && tokenCache[network]) {
            for (const [cachedSymbol, info] of Object.entries(tokenCache[network])) {
              if (info.mint?.toString() === mintAddress) {
                symbol = cachedSymbol;
                break;
              }
            }
          }

          // If this is an unknown token and we want to hide them, skip it
          if (symbol === "Unknown" && options.hideUnknown) {
            return null;
          }

          return {
            mint: mintAddress,
            balance,
            symbol,
            decimals
          };
        } catch (err) {
          console.error("Error processing token account:", err);
          return null;
        }
      })
      .filter((token): token is { mint: string; balance: number; symbol: string; decimals: number; } => token !== null);

    // Add native SOL balance
    try {
      const solBalance = await connection.getBalance(walletAddress);
      if (solBalance > 0) {
        tokens.push({
          mint: "SOL", // Special case for native SOL
          balance: solBalance / 1_000_000_000, // Convert lamports to SOL
          symbol: "SOL",
          decimals: 9
        });
      }
    } catch (err) {
      console.error("Error fetching SOL balance:", err);
    }

    console.log(`Found ${tokens.length} tokens with non-zero balance on ${network}`);
    return tokens;
  } catch (error) {
    console.error("Error fetching user tokens:", error);
    return [];
  }
}

export async function cleanupUnwantedTokens(
  connection: Connection,
  wallet: any,
  tokensToRemove: "unknown" | "all" | string[],
  network: "localnet" | "devnet" | "mainnet",
  burnFirst: boolean = true
): Promise<{
  success: boolean;
  message: string;
  removedTokens?: number;
  recoveredSOL?: number;
  burnedTokens?: { [symbol: string]: number };
  signatures?: string[];
}> {
  if (!wallet?.publicKey) {
    return {
      success: false,
      message: "Wallet not connected"
    };
  }

  try {
    console.log(`🧹 Cleaning up tokens (${tokensToRemove}) on ${network}...`);

    // Create a fresh connection for better reliability
    const networkConnection = new Connection(
      network === "devnet" ? "https://api.devnet.solana.com" :
        network === "mainnet" ? "https://solana-mainnet.rpc.extrnode.com" :
          "http://localhost:8899",
      { commitment: 'confirmed', confirmTransactionInitialTimeout: 60000 }
    );

    // Get all token accounts owned by the wallet
    const tokenAccounts = await networkConnection.getParsedTokenAccountsByOwner(
      wallet.publicKey,
      { programId: TOKEN_PROGRAM_ID }
    );

    console.log(`Found ${tokenAccounts.value.length} total token accounts`);

    // Process account data for easier handling
    const processedAccounts = tokenAccounts.value
      .map(account => {
        try {
          const parsedInfo = account.account.data.parsed.info;
          const mintAddress = parsedInfo.mint;
          const balance = parsedInfo.tokenAmount.uiAmount || 0;
          const decimals = parsedInfo.tokenAmount.decimals || 0;
          const rawAmount = parsedInfo.tokenAmount.amount;

          // Get token symbol
          let symbol = "Unknown";

          // Check localStorage mappings first
          const persistedMappings = getTokenMappingsFromLocalStorage(network);
          if (persistedMappings[mintAddress]) {
            symbol = persistedMappings[mintAddress].symbol;
          }
          // Check token cache if still unknown
          else if (tokenCache[network]) {
            for (const [cachedSymbol, info] of Object.entries(tokenCache[network])) {
              if (info.mint?.toString() === mintAddress) {
                symbol = cachedSymbol;
                break;
              }
            }
          }

          console.log(`Found token account: ${mintAddress} (${symbol}) with balance ${balance}`);

          return {
            pubkey: account.pubkey,
            mint: mintAddress,
            symbol,
            balance,
            decimals,
            rawAmount,
            isKnown: symbol !== "Unknown"
          };
        } catch (error) {
          console.error("Error processing token account:", error);
          return null;
        }
      })
      .filter(account => account !== null);

    // Filter accounts to process based on criteria
    interface ProcessedTokenAccount {
      pubkey: web3.PublicKey;
      mint: string;
      symbol: string;
      balance: number;
      decimals: number;
      rawAmount: string;
      isKnown: boolean;
    }

    let accountsToProcess: ProcessedTokenAccount[] = [];

    if (tokensToRemove === "all") {
      // Process ALL token accounts except native SOL
      accountsToProcess = processedAccounts.filter(account =>
        account.mint !== "So11111111111111111111111111111111111111112" &&
        account.mint !== "SOL"
      );
      console.log(`Processing ALL tokens: selected ${accountsToProcess.length} accounts`);
    }
    else if (tokensToRemove === "unknown") {
      // Process only unknown tokens
      accountsToProcess = processedAccounts.filter(account => !account.isKnown);
      console.log(`Processing UNKNOWN tokens: selected ${accountsToProcess.length} accounts`);
    }
    else if (Array.isArray(tokensToRemove)) {
      // Process specific token symbols
      accountsToProcess = processedAccounts.filter(account =>
        tokensToRemove.some(symbol =>
          symbol.toUpperCase() === account.symbol.toUpperCase()
        )
      );
      console.log(`Processing specific tokens (${tokensToRemove.join(', ')}): selected ${accountsToProcess.length} accounts`);
    }

    if (accountsToProcess.length === 0) {
      return {
        success: true,
        message: "No eligible tokens found to clean up",
        removedTokens: 0
      };
    }

    // Separate accounts with and without balance
    const accountsWithBalance = accountsToProcess.filter(account => account.balance > 0);
    const accountsWithoutBalance = accountsToProcess.filter(account => account.balance === 0);

    console.log(`Found ${accountsWithBalance.length} accounts with balance to burn`);
    console.log(`Found ${accountsWithoutBalance.length} empty accounts to close`);

    // Track burned tokens and signatures
    const burnedTokens: { [symbol: string]: number } = {};
    const signatures: string[] = [];

    // STEP 1: If requested, burn tokens with balance
    if (burnFirst && accountsWithBalance.length > 0) {
      console.log(`Burning tokens for ${accountsWithBalance.length} accounts...`);

      // Process each account individually for better error handling
      for (const account of accountsWithBalance) {
        try {
          console.log(`Burning ${account.balance} ${account.symbol}...`);

          // Create burn transaction
          const burnTx = new Transaction();
          burnTx.add(
            createBurnInstruction(
              account.pubkey,
              new PublicKey(account.mint),
              wallet.publicKey,
              BigInt(account.rawAmount),
              []
            )
          );

          // Get a fresh blockhash
          const { blockhash } = await networkConnection.getLatestBlockhash('finalized');
          burnTx.recentBlockhash = blockhash;
          burnTx.feePayer = wallet.publicKey;

          // Sign and send transaction
          const signedTx = await wallet.signTransaction(burnTx);
          const signature = await networkConnection.sendRawTransaction(signedTx.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed'
          });

          signatures.push(signature);
          await networkConnection.confirmTransaction(signature, 'confirmed');

          // Record burned token
          if (!burnedTokens[account.symbol]) {
            burnedTokens[account.symbol] = 0;
          }
          burnedTokens[account.symbol] += account.balance;

          console.log(`✅ Burned ${account.balance} ${account.symbol}`);

          // Give a short pause between transactions
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Failed to burn ${account.symbol}:`, error);
        }
      }
    }

    // STEP 2: Close accounts
    const accountsToClose = burnFirst
      ? [...accountsWithoutBalance, ...accountsWithBalance] // If we've burned tokens, try to close all accounts
      : accountsWithoutBalance;                            // Otherwise, only close empty accounts

    if (accountsToClose.length === 0) {
      const burnedList = Object.entries(burnedTokens)
        .map(([symbol, amount]) => `${amount.toFixed(2)} ${symbol}`)
        .join(", ");

      return {
        success: true,
        message: `Successfully burned: ${burnedList}`,
        removedTokens: 0,
        burnedTokens,
        signatures
      };
    }

    console.log(`Closing ${accountsToClose.length} token accounts...`);

    // Close accounts in smaller batches to avoid transaction size limits
    const BATCH_SIZE = 5;
    let closedCount = 0;

    for (let i = 0; i < accountsToClose.length; i += BATCH_SIZE) {
      const batch = accountsToClose.slice(i, i + BATCH_SIZE);
      console.log(`Processing close batch ${i / BATCH_SIZE + 1}/${Math.ceil(accountsToClose.length / BATCH_SIZE)}`);

      try {
        // Create a new transaction for each batch
        const closeTx = new Transaction();

        // Add close instruction for each account in batch
        batch.forEach(account => {
          closeTx.add(
            createCloseAccountInstruction(
              account.pubkey,
              wallet.publicKey,
              wallet.publicKey,
              []
            )
          );
        });

        // Get a fresh blockhash for each batch
        const { blockhash } = await networkConnection.getLatestBlockhash('finalized');
        closeTx.recentBlockhash = blockhash;
        closeTx.feePayer = wallet.publicKey;

        // Sign transaction first
        const signedTx = await wallet.signTransaction(closeTx);

        // Send raw transaction for better reliability
        console.log(`Sending raw transaction to close accounts...`);
        const signature = await networkConnection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        });

        signatures.push(signature);
        await networkConnection.confirmTransaction(signature, 'confirmed');

        closedCount += batch.length;
        console.log(`✅ Closed ${batch.length} accounts`);

        // Pause between batches
        if (i + BATCH_SIZE < accountsToClose.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`Failed to close batch:`, error);
      }
    }

    // Calculate recovered SOL (approximate)
    const estimatedRecoveredSOL = closedCount * 0.00203928;

    // Create result message
    let message = "";

    if (Object.keys(burnedTokens).length > 0) {
      const burnedList = Object.entries(burnedTokens)
        .map(([symbol, amount]) => `${amount.toFixed(2)} ${symbol}`)
        .join(", ");

      message += `Burned: ${burnedList}\n`;
    }

    message += `Successfully closed ${closedCount} token accounts and recovered approximately ${estimatedRecoveredSOL.toFixed(6)} SOL`;

    return {
      success: true,
      message,
      removedTokens: closedCount,
      recoveredSOL: estimatedRecoveredSOL,
      burnedTokens,
      signatures
    };
  } catch (error: any) {
    console.error("Error cleaning up tokens:", error);
    return {
      success: false,
      message: `Failed to clean up tokens: ${error.message}`
    };
  }
}

export async function burnSpecificTokenAmount(
  connection: Connection,
  wallet: any,
  tokenSymbol: string,
  amount: number,
  network: "localnet" | "devnet" | "mainnet",
  closeAccountIfEmpty: boolean = true

): Promise<{
  success: boolean;
  message: string;
  signature?: string;
}> {
  if (!wallet.publicKey) {
    return {
      success: false,
      message: "Wallet not connected"
    };
  }

  try {
    console.log(`🔥 Burning ${amount} ${tokenSymbol} tokens on ${network}...`);

    const upperSymbol = tokenSymbol.toUpperCase();

    // Get all token accounts owned by the wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      wallet.publicKey,
      { programId: TOKEN_PROGRAM_ID }
    );

    // Find the specific token account
    let targetAccount = null;
    let tokenInfo = null;

    for (const account of tokenAccounts.value) {
      const parsedInfo = account.account.data.parsed.info;
      const mintAddress = parsedInfo.mint;
      const balance = parsedInfo.tokenAmount.uiAmount || 0;
      const decimals = parsedInfo.tokenAmount.decimals || 0;

      // Skip accounts with zero balance
      if (balance === 0) continue;

      // Check if this matches our target token
      let symbol = "Unknown";

      // Check localStorage mappings
      const persistedMappings = getTokenMappingsFromLocalStorage(network);
      for (const [knownMint, info] of Object.entries(persistedMappings)) {
        if (knownMint === mintAddress) {
          symbol = info.symbol;
          break;
        }
      }

      // Check in-memory cache if not found
      if (symbol === "Unknown" && tokenCache[network]) {
        for (const [cachedSymbol, info] of Object.entries(tokenCache[network])) {
          if (info.mint.toString() === mintAddress) {
            symbol = cachedSymbol;
            break;
          }
        }
      }

      if (symbol.toUpperCase() === upperSymbol) {
        targetAccount = {
          pubkey: account.pubkey,
          mint: mintAddress,
          balance,
          decimals,
          rawAmount: parsedInfo.tokenAmount.amount
        };
        break;
      }
    }

    if (!targetAccount) {
      return {
        success: false,
        message: `No ${tokenSymbol} tokens found in your wallet`
      };
    }

    if (targetAccount.balance < amount) {
      return {
        success: false,
        message: `Insufficient balance: you have ${targetAccount.balance} ${tokenSymbol}, but tried to burn ${amount}`
      };
    }

    // Calculate the raw amount to burn
    const rawBurnAmount = BigInt(Math.floor(amount * Math.pow(10, targetAccount.decimals)));

    const willBeEmpty = targetAccount.balance <= amount;
    // Create transaction to burn the tokens
    const burnTransaction = new Transaction();

    burnTransaction.add(
      createBurnInstruction(
        targetAccount.pubkey,
        new PublicKey(targetAccount.mint),
        wallet.publicKey,
        rawBurnAmount,
        []
      )
    );
    if (willBeEmpty && closeAccountIfEmpty) {
      console.log("Account will be empty after burn, adding close instruction");
      burnTransaction.add(
        createCloseAccountInstruction(
          targetAccount.pubkey,
          wallet.publicKey,
          wallet.publicKey,
          []
        )
      );
    }
    // Get fresh blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    burnTransaction.recentBlockhash = blockhash;
    burnTransaction.feePayer = wallet.publicKey;

    console.log(`Sending burn transaction for ${amount} ${tokenSymbol}...`);

    // Sign and send the transaction
    const signedTx = await wallet.signTransaction(burnTransaction);
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: true
    });

    console.log(`Transaction sent with signature ${signature}`);

    // Wait for confirmation
    if (network === "devnet") {
      try {
        // For devnet, use longer timeout and more retries
        const confirmationOptions = {
          commitment: 'confirmed' as web3.Commitment,
          maxRetries: 60 // More retries for devnet
        };

        // Start a timeout that will provide status update if confirmation takes too long
        const timeoutId = setTimeout(() => {
          console.log("Transaction confirmation taking longer than expected, but it may still succeed");
        }, 10000); // Show message after 10 seconds

        await connection.confirmTransaction(signature, confirmationOptions.commitment);

        // Clear the timeout if we get here
        clearTimeout(timeoutId);

        console.log(`Successfully burned ${amount} ${tokenSymbol} tokens`);
        return {
          success: true,
          message: `Successfully burned ${amount} ${tokenSymbol} tokens`,
          signature // Include signature for reference
        };
      } catch (error) {
        console.warn("Confirmation error, but transaction may still be successful:", error);

        // Check transaction status directly
        try {
          const status = await connection.getSignatureStatus(signature);
          console.log("Transaction status:", status);

          if (status.value && !status.value.err) {
            return {
              success: true,
              message: `Burned ${amount} ${tokenSymbol} tokens (Transaction confirmed on explorer: ${signature})`,
              signature
            };
          } else if (status.value?.err) {
            return {
              success: false,
              message: `Failed to burn tokens: ${status.value.err.toString()}`,
              signature
            };
          } else {
            return {
              success: true,
              message: `Transaction sent (${signature}), but confirmation timed out. Check the explorer to confirm it succeeded.`,
              signature
            };
          }
        } catch (statusError) {
          console.error("Error checking transaction status:", statusError);
          return {
            success: true, // Assume success since we know the transaction was sent
            message: `Transaction may have succeeded (${signature}). Please check Solana Explorer to verify.`,
            signature
          };
        }
      }
    } else {
      // For other networks, use standard confirmation
      await connection.confirmTransaction(signature);
      console.log(`Successfully burned ${amount} ${tokenSymbol} tokens`);
      return {
        success: true,
        message: `Successfully burned ${amount} ${tokenSymbol} tokens`,
        signature
      };
    }

  } catch (error: any) {
    console.error(`Error burning tokens:`, error);
    return {
      success: false,
      message: `Failed to burn tokens: ${error.message}`
    };
  }
}


export async function burnTokensByMintAddress(
  connection: Connection,
  wallet: any,
  mintAddress: string,
  amount: number,
  network: "localnet" | "devnet" | "mainnet",
  closeAccountIfEmpty: boolean = true
): Promise<{
  success: boolean;
  message: string;
  signature?: string;
}> {
  if (!wallet.publicKey) {
    return {
      success: false,
      message: "Wallet not connected"
    };
  }

  try {
    console.log(`🔥 Burning ${amount} tokens from mint ${mintAddress} on ${network}...`);

    // Convert the mint address string to PublicKey
    const mintPubkey = new PublicKey(mintAddress);

    // Find the user's token account for this mint
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      wallet.publicKey,
      { mint: mintPubkey }
    );

    if (tokenAccounts.value.length === 0) {
      return {
        success: false,
        message: `No token account found for mint ${mintAddress.slice(0, 8)}...`
      };
    }

    // Use the first token account found
    const tokenAccount = tokenAccounts.value[0];
    const parsedInfo = tokenAccount.account.data.parsed.info;
    const balance = parsedInfo.tokenAmount.uiAmount || 0;
    const decimals = parsedInfo.tokenAmount.decimals || 0;

    console.log(`Found token account with balance: ${balance}`);

    if (balance < amount) {
      return {
        success: false,
        message: `Insufficient balance: you have ${balance} tokens, but tried to burn ${amount}`
      };
    }

    // Calculate raw amount to burn
    const rawBurnAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)));
    const willBeEmpty = balance <= amount;

    // Create burn transaction
    const burnTransaction = new Transaction();

    burnTransaction.add(
      createBurnInstruction(
        tokenAccount.pubkey,
        mintPubkey,
        wallet.publicKey,
        rawBurnAmount,
        []
      )
    );

    // Add close instruction if needed
    if (willBeEmpty && closeAccountIfEmpty) {
      console.log("Account will be empty after burn, adding close instruction");
      burnTransaction.add(
        createCloseAccountInstruction(
          tokenAccount.pubkey,
          wallet.publicKey,
          wallet.publicKey,
          []
        )
      );
    }

    // Get fresh blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    burnTransaction.recentBlockhash = blockhash;
    burnTransaction.feePayer = wallet.publicKey;

    console.log(`Sending burn transaction...`);

    // Sign and send transaction
    const signedTx = await wallet.signTransaction(burnTransaction);
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: true
    });

    console.log(`Transaction sent with signature ${signature}`);

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');

    console.log(`Successfully burned ${amount} tokens from mint ${mintAddress.slice(0, 8)}...`);

    // Create appropriate message based on whether we closed the account
    const message = willBeEmpty && closeAccountIfEmpty
      ? `Successfully burned all tokens and closed the account for mint ${mintAddress.slice(0, 8)}...`
      : `Successfully burned ${amount} tokens from mint ${mintAddress.slice(0, 8)}...`;

    return {
      success: true,
      message,
      signature
    };
  } catch (error: any) {
    console.error(`Error burning tokens by mint address:`, error);
    return {
      success: false,
      message: `Failed to burn tokens: ${error.message}`
    };
  }
}

export function saveTokenMappingsToLocalStorage(
  tokenSymbol: string,
  mintAddress: string,
  network: string,
  decimals: number = 6
): void {
  try {
    // Get existing mappings
    const mappingsKey = `token-mappings-${network}`;
    const mappingsJson = localStorage.getItem(mappingsKey);
    const mappings = mappingsJson ? JSON.parse(mappingsJson) : {};

    // Add new mapping
    mappings[mintAddress] = {
      symbol: tokenSymbol,
      decimals
    };

    // Store updated mappings
    localStorage.setItem(mappingsKey, JSON.stringify(mappings));
    console.log(`Saved token mapping for ${network}: ${tokenSymbol} (${mintAddress})`);
  } catch (error) {
    console.error("Failed to save token mapping:", error);
  }
}