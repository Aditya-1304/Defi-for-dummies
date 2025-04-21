// src/services/solana-service.ts
import { PublicKey, Transaction, Connection, Keypair, SystemProgram, LAMPORTS_PER_SOL, TransactionInstruction } from '@solana/web3.js';
import { AnchorProvider, BN, Idl, Program, web3, } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, MintLayout, createTransferInstruction, createSyncNativeInstruction, getOrCreateAssociatedTokenAccount, getAccount, Account as TokenAccount } from '@solana/spl-token';
import idl from '../public/idl/web3_for_dummies.json'; // Import your IDL JSON
import { getOrCreateToken, mintMoreTokens, tokenCache, KNOWN_TOKENS } from './tokens-service';
import { Web3ForDummies } from '@/public/idl/types/web3_for_dummies';
import * as spl from '@solana/spl-token';
import { WalletContextState } from '@solana/wallet-adapter-react';
import { ASSOCIATED_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/utils/token';



const IDL = idl as Web3ForDummies;

// For localnet, you'll likely be using fake tokens
// We'll either use the actual mint address from your local deployment
// or default to SOL transfers when needed
const LOCALNET_TOKENS: Record<string, PublicKey | null> = {
  // Update these with your locally deployed token mints
  //USDC: new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"), // Example local USDC-like token
  SOL: null // null means native SOL
};

// Your program ID should match the one in Anchor.toml
const PROGRAM_ID = new PublicKey("B53vYkHSs1vMQzofYfKjz6Unzv8P4TwCcvvTbMWVnctv");

// Localnet URL (default Solana validator URL when running locally)
const LOCALNET_URL = "http://localhost:8899";
// Local function to update token cache
function setTokenInCache(symbol: string, tokenInfo: { mint: PublicKey, decimals: number }, network: "localnet" | "devnet" | "mainnet"): void {
  if (!tokenCache[network]) tokenCache[network] = {};
  tokenCache[network][symbol] = {
    ...tokenInfo,
    symbol
  };
}

// Local function to persist token mappings to localStorage
function saveTokenMappingsToLocalStorage(mappings: any, network: string,): void {
  try {
    const storageKey = `token-mapping-${network}`;
    localStorage.setItem(storageKey, JSON.stringify(mappings));
  } catch (err) {
    console.error("Failed to save token mappings to localStorage:", err);
  }
}

const connectionCache: Record<string, web3.Connection> = {};

const NETWORK_URLS = {
  localnet: "http://localhost:8899",
  devnet: "https://api.devnet.solana.com",
  mainnet: "https://solana-mainnet.rpc.extrnode.com"
}


export function getNetworkConnection(network: "localnet" | "devnet" | "mainnet"): Connection {
  if (!connectionCache[network]) {
    connectionCache[network] = new Connection(NETWORK_URLS[network], "confirmed");
    console.log(`Created new connection for ${network}`);
  }
  return connectionCache[network];
}

export function clearConnectionCache(): void {
  Object.keys(connectionCache).forEach(key => {
    delete connectionCache[key];
  });
}

export function getProgram(connection: Connection, wallet: any): Program<Web3ForDummies> {
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new Program<Web3ForDummies>(IDL, provider);
}

export const getTokenBalance = async (connection: Connection, tokenAccount: PublicKey): Promise<number | null> => {
  try {
    const balance = await connection.getTokenAccountBalance(tokenAccount);
    return balance.value.uiAmount || null;
  } catch (e) {
    if (e instanceof Error && (e.message.includes("could not find account") || e.message.includes("Account does not exist"))) {
      return 0; // Token account doesn't exist
    }
    console.error(`Error getting balance for ${tokenAccount.toBase58()}:`, e)
    return null;
  }
}

const calculateExpectedOut = (amountIn: BN, reserveIn: BN, reserveOut: BN): BN => {
  const amountInU128 = BigInt(amountIn.toString());
  const reserveInU128 = BigInt(reserveIn.toString());
  const reserveOutU128 = BigInt(reserveOut.toString());

  if (reserveInU128 === BigInt(0) || reserveOutU128 === BigInt(0) || amountInU128 === BigInt(0)) {
    return new BN(0);
  }

  const feeNumerator = BigInt(3);
  const feeDenominator = BigInt(1000);
  const amountInAfterFee = (amountInU128 * (feeDenominator - feeNumerator)) / feeDenominator;

  const constantProduct = reserveInU128 * reserveOutU128;
  const newReserveIn = reserveInU128 + amountInAfterFee;
  if (newReserveIn === BigInt(0)) return new BN(0);
  const newReserveOut = constantProduct / newReserveIn;
  const amountOutU128 = reserveOutU128 > newReserveOut ? reserveOutU128 - newReserveOut : BigInt(0);

  return new BN(amountOutU128.toString());
}

// export async function getPoolPDAs(programId: PublicKey, mintA: PublicKey, mintB: PublicKey): Promise<{ poolPda: PublicKey; poolAuthorityPda: PublicKey; poolBump: number }> {
//   const [mintAKey, mintBKey] = [mintA, mintB].sort((a, b) => a.toBuffer().compare(b.toBuffer()));

//   const [poolPda, poolBump] = await PublicKey.findProgramAddressSync(
//     [
//       Buffer.from("pool"),
//       mintAKey.toBuffer(),
//       mintBKey.toBuffer(),
//     ],
//     programId
//   );

//   const [poolAuthorityPda] = await PublicKey.findProgramAddressSync(
//     [
//       Buffer.from("pool"),
//       mintAKey.toBuffer(),
//       mintBKey.toBuffer(),
//     ],
//     programId
//   );

//   return { poolPda, poolAuthorityPda, poolBump }

// }
// export async function getPoolPDAs(programId: PublicKey, mintA: PublicKey, mintB: PublicKey): Promise<{
//   poolPda: PublicKey;
//   poolAuthorityPda: PublicKey;
//   poolBump: number;
//   vaultAPda: PublicKey; // Added vaultAPda
//   vaultBPda: PublicKey; // Added vaultBPda
//   lpMintPda: PublicKey; // Added lpMintPda
// }> {
//   const [mintAKey, mintBKey] = [mintA, mintB].sort((a, b) => a.toBuffer().compare(b.toBuffer()));

//   const [poolPda, poolBump] = await PublicKey.findProgramAddressSync(
//     [
//       Buffer.from("pool"),
//       mintAKey.toBuffer(),
//       mintBKey.toBuffer(),
//     ],
//     programId
//   );

//   // Pool authority PDA might be the same as poolPda or derived differently depending on your program
//   // Assuming it's derived the same way for this example, adjust if needed based on your program logic
//   const [poolAuthorityPda] = await PublicKey.findProgramAddressSync(
//     [
//       Buffer.from("pool_authority"), // Or just "pool" if authority is the pool account itself
//       mintAKey.toBuffer(),
//       mintBKey.toBuffer(),
//     ],
//     programId
//   );

//   // Derive Vault PDAs (assuming standard derivation, adjust if your program uses different seeds)
//   const [vaultAPda] = await PublicKey.findProgramAddressSync(
//     [
//       Buffer.from("vault_a"),
//       poolPda.toBuffer(), // Often derived from the pool PDA
//     ],
//     programId
//   );

//   const [vaultBPda] = await PublicKey.findProgramAddressSync(
//     [
//       Buffer.from("vault_b"),
//       poolPda.toBuffer(), // Often derived from the pool PDA
//     ],
//     programId
//   );

//   // Derive LP Mint PDA (assuming standard derivation)
//   const [lpMintPda] = await PublicKey.findProgramAddressSync(
//     [
//       Buffer.from("lp_mint"),
//       poolPda.toBuffer(), // Often derived from the pool PDA
//     ],
//     programId
//   );


//   return { poolPda, poolAuthorityPda, poolBump, vaultAPda, vaultBPda, lpMintPda }; // Return all derived PDAs

// }
export async function getPoolPDAs(
  programId: PublicKey,
  mintA: PublicKey, // Can be unsorted
  mintB: PublicKey  // Can be unsorted
): Promise<{
  poolPda: PublicKey;
  poolAuthorityPda: PublicKey;
  poolBump: number; // Assuming your Rust code uses the same bump for both
}> {
  // Sort mints internally to ensure consistent PDA derivation
  // const [sortedMintA, sortedMintB] = [mintA, mintB].sort((a, b) =>
  //   a.toBuffer().compare(b.toBuffer())
  // );
  const [sortedMintA, sortedMintB] = [mintA, mintB].sort((a, b) =>
    a.toBuffer().compare(b.toBuffer()) // <-- **UNCOMMENT THIS**
  );

  // Derive poolPda using SORTED mints and "pool" seed
  const [poolPda, poolBump] = await PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool"),
      sortedMintA.toBuffer(), // Use sorted mint A
      sortedMintB.toBuffer(), // Use sorted mint B
    ],
    programId
  );

  // Derive poolAuthorityPda using SORTED mints and "pool" seed
  // IMPORTANT: Ensure your Rust program uses the *same seeds* for pool and authority
  // If seeds differ (e.g., "pool_authority"), adjust the Buffer.from() accordingly.
  const [poolAuthorityPda] = await PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool"), // Assuming same seed as poolPda
      sortedMintA.toBuffer(), // Use sorted mint A
      sortedMintB.toBuffer(), // Use sorted mint B
    ],
    programId
  );

  return { poolPda, poolAuthorityPda, poolBump };
}


// export async function executePayment(
//   connection: web3.Connection,
//   wallet: any, 
//   recipient: string, 
//   amount: number, 
//   token: string = 'SOL',
//   network: "localnet" | "devnet" | "mainnet" = "localnet",
// ) {
//   try {
//     if (!wallet.publicKey) throw new Error("Wallet not connected");

//     if (network === "mainnet") {
//       return {
//         success: false,
//         error: "Mainnet transactions unavailable",
//         message: "Mainnet transactions are unavailable in demo mode. Please use devnet or localnet."
//       }
//     }

//     const networkUrl = NETWORK_URLS[network];
//     const networkConnection = new Connection(networkUrl, "confirmed")  
//     console.log(`💸 Executing payment on ${network} network`);

//     const tokenUpperCase = token.toUpperCase();

//     // Handle SOL transfers differently (they don't use token accounts)
//     if (tokenUpperCase === 'SOL' && !LOCALNET_TOKENS.SOL) {

//       console.log(`Creating SOL transfer on ${network} with connection endpoint: ${networkConnection.rpcEndpoint}`);

//       try {
//         // Create a simple transfer instruction
//         const transferInstruction = web3.SystemProgram.transfer({
//           fromPubkey: wallet.publicKey,
//           toPubkey: new PublicKey(recipient),
//           lamports: amount * web3.LAMPORTS_PER_SOL
//         });

//         // Get the latest blockhash using the SAME connection object
//         const { blockhash, lastValidBlockHeight } = await networkConnection.getLatestBlockhash();
//         console.log(`Got blockhash: ${blockhash} from network: ${network}`);

//         // Create transaction and add our transfer instruction
//         const transaction = new Transaction();
//         transaction.add(transferInstruction);
//         transaction.recentBlockhash = blockhash;
//         transaction.feePayer = wallet.publicKey;

//         // Have the wallet sign the transaction
//         const signedTransaction = await wallet.signTransaction(transaction);
//         console.log("Transaction signed successfully");

//         // Now send the signed transaction with our connection
//         const signature = await networkConnection.sendRawTransaction(signedTransaction.serialize());
//         console.log("Raw transaction sent with signature:", signature);

//         // Wait for confirmation
//         console.log("Waiting for confirmation...");
//         const confirmation = await networkConnection.confirmTransaction(
//           {
//             signature,
//             blockhash,
//             lastValidBlockHeight: lastValidBlockHeight ?? 0
//           },
//           'confirmed'
//         );

//         if (confirmation.value.err) {
//           throw new Error(`Transaction confirmed but failed: ${confirmation.value.err.toString()}`);
//         }

//         console.log("Transaction confirmed successfully!");

//         // Create explorer URL
//         let explorerUrl;
//         if (network === "localnet") {
//           explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`;
//         } else if (network === "devnet") {
//           explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
//         } else if (network === "mainnet") {
//           explorerUrl = `https://explorer.solana.com/tx/${signature}`;
//         }

//         return {
//           success: true,
//           signature,
//           explorerUrl,
//           network,
//           message: `Successfully sent ${amount} SOL to ${recipient.substring(0, 8)}...on ${network}`
//         };
//     } catch (error) {
//       console.error("Transaction error:", error);

//       const errorMessage = error instanceof Error ? error.message : "Unknown error";
//       const logs = (error as any)?.logs || [];

//       return {
//         success: false,
//         error: errorMessage,
//         message: `Transaction failed on ${network}. ${errorMessage}${logs}`
//       }
//     }
//     }

//     // Token transfers (for USDC etc.)
//     // Get token mint address based on the token type
//       // With this updated version that checks the token cache:
//     const tokenMint =(tokenCache[network] && tokenCache[network][tokenUpperCase]?.mint) || LOCALNET_TOKENS[tokenUpperCase] || 

//     (tokenUpperCase === 'SOL' ? null : new PublicKey(token));

//     if (!tokenMint) {
//       throw new Error(`Token ${token} not supported on localnet`);
//     }



//     // Create program instance using localnet connection
//     const provider = new AnchorProvider(
//       networkConnection,
//       wallet,
//       { commitment: 'confirmed' }
//     );

//     const program = new Program<Web3ForDummies>(IDL, provider);

//     // Get token accounts
//     const senderTokenAccount = await getAssociatedTokenAddress(
//       tokenMint,
//       wallet.publicKey
//     );

//     const recipientPubkey = new PublicKey(recipient);
//     const recipientTokenAccount = await getAssociatedTokenAddress(
//       tokenMint,
//       recipientPubkey
//     );

//     // Check if recipient token account exists, if not create it
//     let transaction = new Transaction();
//     try {
//       await networkConnection.getAccountInfo(recipientTokenAccount);
//     } catch (error) {
//       // Add instruction to create recipient token account if it doesn't exist
//       transaction.add(
//         createAssociatedTokenAccountInstruction(
//           wallet.publicKey,
//           recipientTokenAccount,
//           recipientPubkey,
//           tokenMint
//         )
//       );
//     }

//     // Convert amount to blockchain format with decimals (USDC has 6 decimals)
//     const decimals = tokenUpperCase === 'USDC' ? 6 : 9;
//     const amountBN = new BN(amount * Math.pow(10, decimals));
//     const amountToTransfer = amount * Math.pow(10, decimals);


//     // Build the transaction for token transfer
//     // const transferTx = await program.methods
//     //   .processTransaction(amountBN)
//     //   .accounts({
//     //     authority: wallet.publicKey,
//     //     senderTokenAccount: senderTokenAccount,
//     //     senderTokenAccountMint: tokenMint,
//     //     receiverTokenAccount: recipientTokenAccount,
//     //     tokenProgram: TOKEN_PROGRAM_ID,
//     //   })
//     //   .transaction();

//     // // Add the transfer instructions to our transaction
//     // transaction.add(transferTx);

//     // // Sign and send transaction
//     // console.log("Sending transaction to localnet...");
//     // const signature = await wallet.sendTransaction(transaction, networkConnection);

//     // console.log("Confirming transaction...");
//     // await networkConnection.confirmTransaction(signature, 'confirmed');

//     const transferInstruction = spl.createTransferInstruction(
//       senderTokenAccount,       // source
//       recipientTokenAccount,    // destination
//       wallet.publicKey,         // owner
//       BigInt(amountToTransfer), // amount as BigInt
//       [],                       // multi-signature signers (empty for single signer)
//       spl.TOKEN_PROGRAM_ID      // token program ID
//     );

//     // Add the transfer instruction to our transaction
//     transaction.add(transferInstruction);

//     // // Get a fresh blockhash
//     // const { blockhash, lastValidBlockHeight } = await networkConnection.getLatestBlockhash();
//     // transaction.recentBlockhash = blockhash;
//     // transaction.feePayer = wallet.publicKey;

//     // // Sign and send transaction
//     // console.log(`Sending ${token} transaction to ${network}...`);
//     // const signature = await wallet.sendTransaction(transaction, networkConnection);
//     let blockhash, lastValidBlockHeight;
//     let retries = network ==="devnet" ? 5 : 3;
//     while (retries > 0) {
//       try {
//         console.log(`Getting latest blockhash for ${network}, attempt ${6-retries}...`);
//         // Use finalized for devnet for better stability
//         const commitment = network === "devnet" ? 'finalized' : 'confirmed';
//         const blockhashData = await networkConnection.getLatestBlockhash(commitment);
//         blockhash = blockhashData.blockhash;
//         lastValidBlockHeight = blockhashData.lastValidBlockHeight;

//         console.log(`Got blockhash: ${blockhash}, lastValidBlockHeight: ${lastValidBlockHeight}`);
//         if (blockhash) break;
//       } catch (err) {
//         console.warn("Error fetching blockhash, retrying...", err);
//       }
//       retries--;
//       // Short delay before retry
//       await new Promise(resolve => setTimeout(resolve, network === "devnet"? 1000: 500));
//     }

//     if (!blockhash) {
//       throw new Error("Failed to get a valid blockhash after multiple attempts. Network may be unstable.");
//     }

//     transaction.recentBlockhash = blockhash;
//     transaction.feePayer = wallet.publicKey;

//     try {
//       // First check if the token account exists
//       const tokenAccountInfo = await networkConnection.getAccountInfo(senderTokenAccount);

//       if (!tokenAccountInfo) {
//         console.log(`Token account doesn't exist yet for ${token}`);
//         return {
//           success: false,
//           error: "Token account not found",
//           message: `You don't have a ${token} token account yet. Try minting some tokens first.`
//         };
//       }

//       // Now safely get the balance
//       const senderAccountInfo = await networkConnection.getTokenAccountBalance(senderTokenAccount);
//       const senderBalance = senderAccountInfo.value.uiAmount || 0;

//       if (senderBalance < amount) {
//         return {
//           success: false,
//           error: "Insufficient funds",
//           message: `You only have ${senderBalance} ${token}, but tried to send ${amount} ${token}`
//         };
//       }

//       console.log(`Confirmed sender has sufficient balance: ${senderBalance} ${token}`);
//     } catch (error : any) {
//       console.error("Error checking sender balance:", error);
//       return {
//         success: false,
//         error: "Failed to verify sender balance",
//         message: `Could not verify if you have enough ${token} tokens: ${error.message}`
//       };
//     }
//     // Sign and send transaction with timeout handling
//     console.log(`Sending ${token} transaction to ${network}...`);
//     // const signature = await wallet.sendTransaction(transaction, networkConnection);

//     // // Wait for confirmation with proper error handling
//     // console.log(`Confirming transaction ${signature} on ${network}...`);
//     // const confirmationTimeout = network === "devnet" ? 60000 : 30000;

//     // const confirmationPromise = await networkConnection.confirmTransaction({
//     //   signature,
//     //   blockhash,
//     //   lastValidBlockHeight: lastValidBlockHeight ?? 0
//     // }, network === 'devnet' ? 'finalized': 'confirmed');

//     // const timeoutPromise = new Promise((_, reject) => {
//     //   setTimeout(()=> reject(new Error(`Transaction confirmation timed out after ${confirmationTimeout/1000} seconds`)), confirmationTimeout)
//     // })

//     // const confirmation = await Promise.race([confirmationPromise, timeoutPromise]) as any;

//     // if (confirmation.value.err) {
//     //   throw new Error(`Transaction confirmed but failed: ${confirmation.value.err.toString()}`);
//     // }
//     if (network === "devnet") {
//       let txSuccess = false;
//       let txSignature = '';
//       let txAttempts = 0;
//       const maxTxAttempts = 3;

//       while (!txSuccess && txAttempts < maxTxAttempts) {
//         txAttempts++;
//         try {
//           console.log(`Devnet transaction attempt ${txAttempts}/${maxTxAttempts}...`);

//           // Recreate connection with preferred commitment for each attempt
//           const freshConnection = new Connection(
//             "https://api.devnet.solana.com",
//             { commitment: 'confirmed', confirmTransactionInitialTimeout: 60000 }
//           );

//           // Get a fresh blockhash directly before sending
//           const { blockhash: freshBlockhash, lastValidBlockHeight } = 
//             await freshConnection.getLatestBlockhash('confirmed');

//           console.log(`Got fresh blockhash: ${freshBlockhash.slice(0, 10)}...`);

//           // Update transaction with fresh blockhash
//           transaction.recentBlockhash = freshBlockhash;
//           transaction.feePayer = wallet.publicKey;

//           // Sign the transaction first to avoid timeout issues
//           const signedTx = await wallet.signTransaction(transaction);

//           // Send raw transaction for more reliability
//           console.log(`Sending raw transaction to devnet...`);
//           txSignature = await freshConnection.sendRawTransaction(signedTx.serialize(), {
//             skipPreflight: false,
//             preflightCommitment: 'confirmed',
//           });

//           console.log(`Transaction sent with signature: ${txSignature}`);

//           // Confirm with slightly higher timeout
//           const confirmation = await freshConnection.confirmTransaction({
//             signature: txSignature,
//             blockhash: freshBlockhash,
//             lastValidBlockHeight
//           }, 'confirmed');

//           if (confirmation.value.err) {
//             throw new Error(`Transaction confirmed but failed: ${confirmation.value.err}`);
//           }

//           txSuccess = true;
//           console.log(`Transaction confirmed successfully!`);
//         } catch (error: any) {
//           console.warn(`Attempt ${txAttempts} failed:`, error);

//           if (txAttempts >= maxTxAttempts) {
//             throw error;
//           }

//           // Exponential backoff
//           const delay = 2000 * Math.pow(2, txAttempts - 1);
//           console.log(`Waiting ${delay}ms before next attempt...`);
//           await new Promise(resolve => setTimeout(resolve, delay));
//         }
//       }

//       // If we got here with a signature, the transaction was successful
//       if (txSuccess) {
//         console.log(`Transaction confirmed successfully after ${txAttempts} attempt(s)`);

//         // Create explorer URL
//         const explorerUrl = `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`;

//         return {
//           success: true,
//           signature: txSignature,
//           explorerUrl,
//           network,
//           message: `Successfully sent ${amount} ${token} to ${recipient.substring(0, 8)}... on devnet`
//         };
//       }
//     } else {
//       // Original code for localnet (which works fine)
//       const signature = await wallet.sendTransaction(transaction, networkConnection);

//       // Wait for confirmation with proper error handling
//       console.log(`Confirming transaction ${signature} on ${network}...`);
//       // Rest of the existing confirmation logic...
//       let explorerUrl;

//       if (network === "localnet"){
//         explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`;
//       }else if (network === "devnet") {
//         explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
//       }else if (network === "mainnet") {
//         explorerUrl = `https://explorer.solana.com/tx/${signature}`;
//       }

//     return {
//       success: true,
//       signature,
//       explorerUrl,
//       network,
//       message: `Successfully sent ${amount} ${token} to ${recipient.substring(0, 8)}...`
//     };
//     }


//   } catch (error: any) {
//     console.error("Payment execution error:", error);
//     return {
//       success: false,
//       error: error.message,
//       message: `Failed to send payment: ${error.message}`
//     };
//   }
// }

// export async function getWalletBalance(
//   connection: web3.Connection,
//   wallet: any,
//   token: string = 'SOL',
//   network: "localnet" | "devnet" | "mainnet" = "localnet",
// ) {
//   try {
//     if(!wallet.publicKey) throw new Error("wallet not connected");

//     console.log(`🌐 Getting balance on ${network} network`);

//     if (network === "mainnet") {
//       // Inform user about mainnet limitations
//       return {
//         success: true,
//         balance: 0,
//         token: token.toUpperCase(),
//         network,
//         message: `Mainnet balance check is not available in demo mode. Please use devnet or localnet.`
//       };
//     }

//     const networkUrl = NETWORK_URLS[network];
//     const networkConnection = new Connection(networkUrl, "confirmed");
//     const tokenUpperCase = token.toUpperCase();

//     if (tokenUpperCase === 'SOL') {
//       // SOL balance check
//       const balance = await networkConnection.getBalance(wallet.publicKey);
//       const solBalance = balance / web3.LAMPORTS_PER_SOL;

//       return {
//         success: true,
//         balance: solBalance,
//         token: 'SOL',
//         network,
//         message: `Your ${network} wallet balance is ${solBalance.toFixed(7)} SOL`
//       };
//     } else if (tokenCache[network] && tokenCache[network][tokenUpperCase]) {
//       // Token balance using token service - already cached token
//       try {
//         const { balance, decimals } = await getTokenBalance(
//           networkConnection,
//           wallet,
//           tokenUpperCase,
//           network
//         );

//         return {
//           success: true,
//           balance,
//           token: tokenUpperCase,
//           network,
//           message: `Your ${network} wallet balance is ${balance.toFixed(decimals)} ${tokenUpperCase}`
//         };
//       } catch (error: any) {
//         console.error(`Failed to get ${tokenUpperCase} balance:`, error);
//         return {
//           success: false,
//           error: error.message,
//           message: `Failed to get ${tokenUpperCase} balance: ${error.message}`
//         };
//       }
//     } else if (LOCALNET_TOKENS[tokenUpperCase]) {
//       // Check balance for predefined local token
//       const tokenMint = LOCALNET_TOKENS[tokenUpperCase];

//       // Get the token account address
//       const tokenAccount = await getAssociatedTokenAddress(
//         tokenMint,
//         wallet.publicKey
//       );

//       try {
//         // Get the token account info
//         const accountInfo = await networkConnection.getAccountInfo(tokenAccount);

//         if (!accountInfo) {
//           return {
//             success: true,
//             balance: 0,
//             token: tokenUpperCase,
//             network,
//             message: `Your wallet doesn't have any ${tokenUpperCase} tokens`
//           };
//         }

//         // Parse the account data properly
//         const tokenBalance = await networkConnection.getTokenAccountBalance(tokenAccount);
//         const balance = tokenBalance.value.uiAmount || 0;
//         const decimals = tokenBalance.value.decimals;

//         return {
//           success: true,
//           balance,
//           token: tokenUpperCase,
//           network,
//           message: `Your wallet balance is ${balance.toFixed(decimals)} ${tokenUpperCase}`
//         };
//       } catch (error) {
//         // Token account might not exist
//         return {
//           success: true,
//           balance: 0,
//           token: tokenUpperCase,
//           network,
//           message: `Your wallet doesn't have any ${tokenUpperCase} tokens`
//         };
//       }
//     } else {
//       // Unknown token
//       return {
//         success: false,
//         error: `Unknown token ${tokenUpperCase}`,
//         network,
//         message: `Token ${tokenUpperCase} not supported on ${network}`
//       };
//     }
//   } catch (error: any) {
//     console.error("Balance check error:", error);
//     return {
//       success: false,
//       error: error.message,
//       network,
//       message: `Failed to get balance: ${error.message}`
//     };
//   }
// }
export async function executePayment(
  connection: web3.Connection,
  wallet: any,
  recipient: string,
  amount: number,
  token: string = 'SOL',
  network: "localnet" | "devnet" | "mainnet" = "localnet",
) {
  try {
    console.log(`💸 Executing payment on ${network} network`);

    if (!wallet?.publicKey) {
      return {
        success: false,
        error: "Wallet not connected",
        message: "Please connect your wallet to make a payment."
      };
    }

    // Create a new connection with improved reliability for devnet
    const networkConnection = new Connection(
      network === "devnet" ? "https://api.devnet.solana.com" :
        network === "mainnet" ? "https://solana-mainnet.rpc.extrnode.com" :
          "http://localhost:8899",
      { commitment: 'confirmed' }
    );

    // Handle different network types
    let blockhash;
    let retries = network === "devnet" ? 5 : 3;
    while (retries > 0) {
      try {
        console.log(`Getting latest blockhash for ${network}, attempt ${6 - retries}...`);
        // Use finalized for devnet for better stability
        const commitment = network === "devnet" ? 'finalized' : 'confirmed';
        const blockhashData = await networkConnection.getLatestBlockhash(commitment);
        blockhash = blockhashData.blockhash;

        console.log(`Got blockhash: ${blockhash.substring(0, 10)}...`);
        if (blockhash) break;
      } catch (err) {
        console.log(`Error getting blockhash, retrying... (${retries - 1} attempts left)`);
        retries--;
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!blockhash) {
      return {
        success: false,
        error: "Failed to get blockhash",
        message: "Network connection issue. Please try again."
      };
    }

    // Create a new transaction
    const transaction = new Transaction();

    // For SOL transfers
    if (token.toUpperCase() === 'SOL') {
      // Calculate amount in lamports
      const lamports = Math.floor(amount * web3.LAMPORTS_PER_SOL);

      // Add transfer instruction
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: new PublicKey(recipient),
          lamports
        })
      );
    }
    // For SPL token transfers
    else {
      // Get the SPL token details
      const upperSymbol = token.toUpperCase();
      let tokenInfo;


      try {
        tokenInfo = await getOrCreateToken(networkConnection, wallet, upperSymbol, network);
        if (!tokenInfo) {
          // Handle the case where the token couldn't be found or created
          console.error(`Failed to get or create token info for ${upperSymbol}`);
          return {
            success: false,
            error: `Token not found or could not be created: ${upperSymbol}`,
            message: `Could not find or create token: ${upperSymbol}. Cannot proceed with payment.`
          };
        }
      } catch (error) {
        console.error(`Failed to get token info for ${upperSymbol}:`, error);
        return {
          success: false,
          error: `Token not found: ${upperSymbol}`,
          message: `Could not find or create token: ${upperSymbol}`
        };
      }

      // Calculate token decimal amount
      const tokenMint = tokenInfo.mint;
      const tokenDecimals = tokenInfo.decimals;
      const amountToTransfer = Math.floor(amount * Math.pow(10, tokenDecimals));

      // Get sender's token account
      let senderTokenAccount;
      try {
        const senderTokenAccountAddress = await getAssociatedTokenAddress(
          tokenMint,
          wallet.publicKey
        );

        // Verify sender has this token account
        try {
          const accountInfo = await networkConnection.getParsedAccountInfo(senderTokenAccountAddress);
          if (!accountInfo?.value) {
            return {
              success: false,
              error: "Token account not found",
              message: `You don't have a ${upperSymbol} token account. Try minting some ${upperSymbol} first.`
            };
          }
          senderTokenAccount = senderTokenAccountAddress;

          // Verify sender has sufficient balance
          const balance = await networkConnection.getTokenAccountBalance(senderTokenAccount);
          if ((balance.value.uiAmount ?? 0) < amount) {
            return {
              success: false,
              error: "Insufficient token balance",
              message: `Your ${upperSymbol} balance (${balance.value.uiAmount}) is less than the amount to send (${amount}).`
            };
          }
          console.log(`Confirmed sender has sufficient balance: ${balance.value.uiAmount} ${upperSymbol}`);

        } catch (error) {
          console.error(`Error checking sender token account:`, error);
          return {
            success: false,
            error: "Failed to verify token account",
            message: `You need to have some ${upperSymbol} tokens to send. Try minting some first.`
          };
        }
      } catch (error) {
        console.error(`Failed to get sender token account:`, error);
        return {
          success: false,
          error: "Token account error",
          message: `Error with your ${upperSymbol} token account.`
        };
      }

      // Get or create recipient's token account
      const recipientPubkey = new PublicKey(recipient);
      const recipientTokenAccountAddress = await getAssociatedTokenAddress(
        tokenMint,
        recipientPubkey
      );

      // Check if recipient token account exists
      let recipientTokenAccountExists = false;
      try {
        const accountInfo = await networkConnection.getParsedAccountInfo(recipientTokenAccountAddress);
        recipientTokenAccountExists = !!accountInfo.value;
      } catch (error) {
        console.log(`Error checking recipient token account, assuming it doesn't exist`);
      }

      // If recipient token account doesn't exist, create it
      if (!recipientTokenAccountExists) {
        console.log(`Creating token account for recipient...`);
        transaction.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            recipientTokenAccountAddress,
            recipientPubkey,
            tokenMint
          )
        );
      }

      // Add the transfer instruction
      transaction.add(
        createTransferInstruction(
          senderTokenAccount,
          recipientTokenAccountAddress,
          wallet.publicKey,
          BigInt(amountToTransfer),
          [],
          TOKEN_PROGRAM_ID
        )
      );

      console.log(`Sending ${upperSymbol} transaction to ${network}...`);
    }

    // Set transaction properties
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    // For devnet, we implement a retry mechanism
    if (network === "devnet") {
      let attempts = 3;
      let backoffTime = 2000; // Start with 2 second delay

      for (let i = 1; i <= attempts; i++) {
        console.log(`Devnet transaction attempt ${i}/${attempts}...`);

        try {
          // Get a fresh blockhash for each attempt
          const { blockhash: freshBlockhash } = await networkConnection.getLatestBlockhash('confirmed');
          console.log(`Got fresh blockhash: ${freshBlockhash.substring(0, 10)}...`);
          transaction.recentBlockhash = freshBlockhash;

          // Sign transaction
          const signedTx = await wallet.signTransaction(transaction);

          // Send transaction directly as raw to avoid wallet adapter issues
          console.log(`Sending raw transaction to devnet...`);
          const signature = await networkConnection.sendRawTransaction(
            signedTx.serialize(),
            { skipPreflight: false, preflightCommitment: 'confirmed' }
          );

          // Wait for confirmation
          await networkConnection.confirmTransaction({
            signature,
            blockhash: freshBlockhash,
            lastValidBlockHeight: (await networkConnection.getLatestBlockhash()).lastValidBlockHeight
          }, 'confirmed');

          console.log(`Transaction confirmed with signature: ${signature}`);

          // We're already inside a devnet-specific block, so use devnet URL directly
          const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
          return {
            success: true,
            message: `Successfully sent ${amount} ${token} to ${recipient.substring(0, 8)}...`,
            signature,
            explorerUrl
          };
        } catch (error: any) {
          console.error(`Attempt ${i} failed:`, error);

          // Check if this is a simulation error with "insufficient funds"
          if (error.toString().includes('insufficient funds')) {
            // This is likely due to missing token account
            return {
              success: false,
              error: error.toString(),
              message: `Failed to send ${token}: The recipient may not have a ${token} account. Try adding 'create-account' to your command.`
            };
          }

          // If we've used all our attempts, throw the error
          if (i === attempts) {
            throw error;
          }

          // Exponential backoff
          console.log(`Waiting ${backoffTime}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          backoffTime *= 2; // Double the wait time for next attempt
        }
      }
    } else {
      // For other networks, just send without retry
      const signature = await wallet.sendTransaction(transaction, networkConnection);
      await networkConnection.confirmTransaction(signature);

      // Build explorer URL based on network
      const explorerUrl = network === "mainnet"
        ? `https://explorer.solana.com/tx/${signature}`
        : `https://explorer.solana.com/tx/${signature}?cluster=${network}`;

      return {
        success: true,
        message: `Successfully sent ${amount} ${token} to ${recipient.substring(0, 8)}...`,
        signature,
        explorerUrl
      };
    }

    // This should not be reached if everything goes well
    return {
      success: false,
      error: "Unknown error",
      message: "Failed to complete transaction for unknown reasons."
    };
  } catch (error: any) {
    console.error(`Payment execution error:`, error);

    return {
      success: false,
      error: error.toString(),
      message: `Failed to send payment: ${error.toString()}`
    };
  }
}
export async function getWalletBalance(
  connection: web3.Connection,
  wallet: any,
  token: string = 'SOL',
  network: "localnet" | "devnet" | "mainnet" = "localnet",
) {
  try {
    if (!wallet.publicKey) throw new Error("wallet not connected");

    console.log(`🌐 Getting balance for ${token} on ${network} network`);

    if (network === "mainnet") {
      return {
        success: true,
        balance: 0,
        token: token.toUpperCase(),
        network,
        message: `Mainnet balance check is not available in demo mode. Please use devnet or localnet.`
      };
    }

    const tokenUpperCase = token.toUpperCase();

    // Special fast path for SOL
    if (tokenUpperCase === 'SOL') {
      const balance = await connection.getBalance(wallet.publicKey);
      const solBalance = balance / web3.LAMPORTS_PER_SOL;

      return {
        success: true,
        balance: solBalance,
        token: 'SOL',
        network,
        message: `Your ${network} wallet balance is ${solBalance.toFixed(7)} SOL`
      };
    }

    // For other tokens, use the on-chain fetching approach
    const tokens = await fetchUserTokens(connection, wallet.publicKey, network, { hideUnknown: false });
    const targetToken = tokens.find(t => t.symbol.toUpperCase() === tokenUpperCase);

    if (!targetToken) {
      return {
        success: true,
        balance: 0,
        token: tokenUpperCase,
        network,
        message: `Your wallet doesn't have any ${tokenUpperCase} tokens on ${network}`
      };
    }

    return {
      success: true,
      balance: targetToken.balance,
      token: targetToken.symbol,
      network,
      message: `Your ${network} wallet balance is ${targetToken.balance.toFixed(
        targetToken.decimals === 9 ? 7 : 2
      )} ${targetToken.symbol}`
    };
  } catch (error: any) {
    console.error("Balance check error:", error);
    return {
      success: false,
      error: error.message,
      network,
      message: `Failed to get balance: ${error.message}`
    };
  }
}


export async function mintTestTokens(
  connection: web3.Connection,
  wallet: any,
  token: string = 'USDC',
  amount: number = 100,
  network: "localnet" | "devnet" | "mainnet" = "localnet",
) {
  try {
    if (!wallet.publicKey) throw new Error("Wallet not connected");

    if (network === "mainnet") {
      return {
        success: false,
        error: "Cannot mint tokens on mainnet",
        message: "Minting test tokens is not available on mainnet. Please use devnet or localnet."
      };
    }

    console.log(`🪙 Minting ${amount} ${token} tokens on ${network}...`);

    const networkUrl = NETWORK_URLS[network];
    const networkConnection = new Connection(networkUrl, "confirmed");

    // Special handling for devnet
    if (network === "devnet") {
      try {
        // Creating a custom token with user's wallet as mint authority
        const tokenSymbol = token.toUpperCase();

        const persistedMappings = getTokenMappingsFromLocalStorage(network);
        let existingTokenMint = null;

        let tokenInfo = await getOrRecreateTokenMint(connection, wallet, tokenSymbol, network);

        if (!tokenInfo || !tokenInfo.mint) {
          return {
            success: false,
            message: `Could not find or create mint for ${tokenSymbol}`
          };
        }

        try {
          // Use the existing token mint from cache
          const TokenMint = tokenCache[network][tokenSymbol].mint;

          // Mint more tokens from the existing mint
          const signature = await mintMoreCustomTokens(
            networkConnection,
            wallet,
            tokenInfo.mint,
            amount,
            tokenInfo.decimals
          );

          await consolidateTokenMappings(network, tokenSymbol, tokenInfo.mint);

          // Create mapping object in the expected format
          const tokenMapping = {
            [tokenInfo.mint.toString()]: {
              symbol: tokenSymbol,
              decimals: tokenInfo.decimals
            }
          };
          await saveTokenMappingsToLocalStorage(tokenMapping, network);

          return {
            success: true,
            token: tokenSymbol,
            amount,
            network,
            signature,
            message: `Successfully minted ${amount} ${tokenSymbol} tokens to your wallet on devnet`
          };
        } catch (error: any) {
          // If token needs recreation (was garbage collected), we'll continue to create a new one
          if (error.message === "TOKEN_NEEDS_RECREATION") {
            console.log(`Existing token ${tokenSymbol} needs to be recreated`);
            // Remove from cache to allow recreation
            delete tokenCache[network][tokenSymbol];
            // Continue to code below that creates a new token
          } else {
            throw error;
          }
        }
        // }

        // We need to create a new custom token mint
        console.log(`Creating new custom token: ${tokenSymbol} on devnet`);

        // Create new token mint with 9 decimals (or 6 for USDC-like tokens)
        const decimals = tokenSymbol.includes('USDC') ? 6 : 6;

        // Create the mint
        const mintKeypair = web3.Keypair.generate();
        const mintPubkey = mintKeypair.publicKey;

        saveTokenMappingToLocalStorage(network, mintPubkey.toString(), {
          symbol: tokenSymbol,
          decimals
        });

        // Create minimum balance for rent exemption transaction
        const lamports = await networkConnection.getMinimumBalanceForRentExemption(
          spl.MintLayout.span
        );

        // Create account transaction
        const createAccountTx = web3.SystemProgram.createAccount({
          fromPubkey: wallet.publicKey,
          newAccountPubkey: mintPubkey,
          lamports,
          space: spl.MintLayout.span,
          programId: spl.TOKEN_PROGRAM_ID
        });

        // Initialize mint transaction
        const initMintTx = spl.createInitializeMintInstruction(
          mintPubkey,
          decimals,
          wallet.publicKey,
          wallet.publicKey,
          spl.TOKEN_PROGRAM_ID
        );

        // Create associated token account for the user
        const associatedTokenAccount = await spl.getAssociatedTokenAddress(
          mintPubkey,
          wallet.publicKey
        );

        // Create token account transaction
        const createAssociatedTokenAccountTx = spl.createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          associatedTokenAccount,
          wallet.publicKey,
          mintPubkey
        );

        // Mint tokens transaction
        const mintToTx = spl.createMintToInstruction(
          mintPubkey,
          associatedTokenAccount,
          wallet.publicKey,
          BigInt(Math.floor(amount * Math.pow(10, decimals))), // Use BigInt for precise amounts
          [],
          spl.TOKEN_PROGRAM_ID
        );

        // Combine all transactions
        const transaction = new web3.Transaction().add(
          createAccountTx,
          initMintTx,
          createAssociatedTokenAccountTx,
          mintToTx
        );

        // Set recent blockhash
        const { blockhash } = await networkConnection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;

        // Sign with mint keypair and wallet
        transaction.partialSign(mintKeypair);
        const signedTransaction = await wallet.signTransaction(transaction);

        // Send and confirm transaction
        const signature = await networkConnection.sendRawTransaction(signedTransaction.serialize());
        await networkConnection.confirmTransaction(signature);

        // Store token in cache
        if (!tokenCache[network]) tokenCache[network] = {};
        tokenCache[network][tokenSymbol] = {
          mint: mintPubkey,
          decimals,
          symbol: tokenSymbol,
          tokenAccount: associatedTokenAccount
        } as any;

        console.log(`Created and minted new custom token ${tokenSymbol} on devnet`);

        return {
          success: true,
          token: tokenSymbol,
          amount,
          network,
          signature,
          message: `Successfully created and minted ${amount} ${tokenSymbol} tokens to your wallet on devnet`
        };
      } catch (devnetError: any) {
        console.error("Devnet token minting error:", devnetError);
        return {
          success: false,
          error: devnetError.message,
          message: `Failed to create/mint tokens on devnet: ${devnetError.message}`
        };
      }
    }

    // Standard handling for localnet
    await mintMoreTokens(
      networkConnection,
      wallet,
      token,
      amount,
      network
    );

    return {
      success: true,
      token,
      amount,
      network,
      message: `Successfully minted ${amount} ${token} tokens to your wallet on ${network}`
    };
  } catch (error: any) {
    console.error("Token minting error:", error);
    return {
      success: false,
      error: error.message,
      message: `Failed to mint tokens: ${error.message}`
    };
  }
};
async function mintMoreCustomTokens(
  connection: Connection,
  wallet: any,
  mintPubkey: PublicKey,
  amount: number,
  decimals: number = 9
) {
  try {
    // First check if the mint account exists
    const mintAccountInfo = await connection.getAccountInfo(mintPubkey);
    if (!mintAccountInfo) {
      console.error("Mint account does not exist:", mintPubkey.toString());
      throw new Error("Mint account not found on chain. It may have been garbage collected.");
    }

    console.log("Mint account exists, proceeding with mint operation");

    // Get the token account address
    const tokenAccount = await spl.getAssociatedTokenAddress(
      mintPubkey,
      wallet.publicKey
    );

    // Check if token account exists, create if needed
    const transaction = new web3.Transaction();
    let tokenAccountInfo;

    try {
      tokenAccountInfo = await connection.getAccountInfo(tokenAccount);
      if (!tokenAccountInfo) {
        console.log("Token account does not exist, adding creation instruction");
        transaction.add(
          spl.createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            tokenAccount,
            wallet.publicKey,
            mintPubkey
          )
        );
      }
    } catch (err) {
      console.log("Adding token account creation instruction");
      transaction.add(
        spl.createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          tokenAccount,
          wallet.publicKey,
          mintPubkey
        )
      );
    }

    // Create mint instruction
    const mintInstruction = spl.createMintToInstruction(
      mintPubkey,
      tokenAccount,
      wallet.publicKey,
      BigInt(Math.floor(amount * Math.pow(10, decimals))), // Use BigInt for precise amounts
      [],
      spl.TOKEN_PROGRAM_ID
    );

    // Add mint instruction to transaction
    transaction.add(mintInstruction);

    // For devnet, implement retry logic with fresh blockhashes
    if (connection.rpcEndpoint.includes('devnet')) {
      let txSuccess = false;
      let txSignature = '';
      let txAttempts = 0;
      const maxTxAttempts = 3;

      while (!txSuccess && txAttempts < maxTxAttempts) {
        txAttempts++;
        try {
          console.log(`Devnet minting attempt ${txAttempts}/${maxTxAttempts}...`);

          // Get a fresh blockhash directly before sending
          const { blockhash: freshBlockhash, lastValidBlockHeight } =
            await connection.getLatestBlockhash('confirmed');

          console.log(`Got fresh blockhash: ${freshBlockhash.slice(0, 10)}...`);

          // Update transaction with fresh blockhash
          transaction.recentBlockhash = freshBlockhash;
          transaction.feePayer = wallet.publicKey;

          // Sign the transaction first
          const signedTx = await wallet.signTransaction(transaction);

          // Send raw transaction for more reliability
          console.log(`Sending raw transaction to devnet...`);
          txSignature = await connection.sendRawTransaction(signedTx.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          });

          console.log(`Transaction sent with signature: ${txSignature}`);

          // Confirm with reasonable timeout
          const confirmation = await connection.confirmTransaction({
            signature: txSignature,
            blockhash: freshBlockhash,
            lastValidBlockHeight
          }, 'confirmed');

          if (confirmation.value.err) {
            throw new Error(`Transaction confirmed but failed: ${confirmation.value.err}`);
          }

          txSuccess = true;
          console.log(`Minting transaction confirmed successfully!`);
          return txSignature;
        } catch (error) {
          console.warn(`Minting attempt ${txAttempts} failed:`, error);

          // Check if this is a known error that indicates the mint is gone
          const errorStr = String(error);
          if (errorStr.includes("account not found") ||
            errorStr.includes("invalid account data") ||
            errorStr.includes("InvalidAccountData")) {

            // If it's the first attempt, we should try recreating the token
            if (txAttempts === 1) {
              console.log("Mint account may have been garbage collected. Creating new token instead...");
              throw new Error("MINT_ACCOUNT_INVALID");
            }
          }

          if (txAttempts >= maxTxAttempts) {
            throw error;
          }

          // Exponential backoff
          const delay = 2000 * Math.pow(2, txAttempts - 1);
          console.log(`Waiting ${delay}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      throw new Error("All minting attempts failed");
    } else {
      // Non-devnet networks - use standard approach
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      // Sign and send transaction
      const signature = await wallet.sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature);

      return signature;
    }
  } catch (error: any) {
    console.error("Error minting more custom tokens:", error);

    // Check for special error indicating we should create a new token
    if (error.message === "MINT_ACCOUNT_INVALID") {
      throw new Error("TOKEN_NEEDS_RECREATION");
    }

    throw error;
  }
}

export async function getAllWalletBalances(
  connection: web3.Connection,
  wallet: any,
  network: "localnet" | "devnet" | "mainnet" = "localnet",
  options: { initialOnly?: boolean } = {}
) {
  if (!wallet || !wallet.publicKey) {
    return {
      success: false,
      message: "Please connect your wallet",
    };
  }

  try {
    console.log(`🌐 Getting all balances on ${network} network`);

    if (network === "mainnet") {
      return {
        success: false,
        error: "Mainnet balance checks unavailable",
        message: "Mainnet balance checks are unavailable in demo mode. Please use devnet or localnet."
      };
    }

    // If initial only, just return SOL balance quickly
    if (options.initialOnly) {
      const solBalance = await connection.getBalance(wallet.publicKey);
      const solBalanceInSOL = solBalance / web3.LAMPORTS_PER_SOL;

      return {
        success: true,
        balances: [{
          token: 'SOL',
          balance: solBalanceInSOL,
          decimals: 9
        }],
        network,
        isPartial: true,
        message: `Your ${network} wallet has ${solBalanceInSOL.toFixed(7)} SOL`
      };
    }

    // Use the new function to get all tokens directly from blockchain
    const tokens = await fetchUserTokens(connection, wallet.publicKey, network, { hideUnknown: false });

    if (tokens.length === 0) {
      return {
        success: true,
        balances: [],
        network,
        message: `Your ${network} wallet has no tokens`
      };
    }

    // Convert to the expected format
    const balances = tokens.map(token => ({
      token: token.symbol,
      balance: token.balance,
      decimals: token.decimals
    }));

    // Format the message
    const tokenList = balances.map(b =>
      `${b.balance.toFixed(b.token === 'SOL' ? 7 : 2)} ${b.token}`
    );

    let message = `Your ${network} wallet balances:\n• ${tokenList.join('\n• ')}`;

    return {
      success: true,
      balances,
      network,
      message
    };
  } catch (error: any) {
    console.error("Balance check error:", error);
    return {
      success: false,
      error: error.message,
      network,
      message: `Failed to get balances: ${error.message}`
    };
  }
}


export async function getTokenBalancesOnly(
  connection: web3.Connection,
  wallet: any,
  network: "localnet" | "devnet" | "mainnet" = "localnet"
) {
  try {
    if (!wallet.publicKey) throw new Error("Wallet not connected");

    console.log(`🔍 Getting token balances on ${network} network`);

    if (network === "mainnet") {
      return {
        success: false,
        error: "Mainnet balance checks unavailable",
        balances: [],
        message: "Mainnet balance checks are unavailable in demo mode."
      };
    }

    const networkUrl = NETWORK_URLS[network];
    const networkConnection = new Connection(networkUrl, "confirmed");

    const tokenAddresses = [];
    const balances = [];

    // Get balances for all cached tokens in this network
    const tokenSymbols = Object.keys(tokenCache[network] || {});

    // Skip if no tokens in cache
    if (tokenSymbols.length === 0) {
      return {
        success: true,
        balances: [],
        network,
        message: "No tokens found in cache"
      };
    }

    // Get token account addresses
    for (const symbol of tokenSymbols) {
      const tokenInfo = tokenCache[network][symbol];
      try {
        const tokenAddress = await getAssociatedTokenAddress(
          tokenInfo.mint,
          wallet.publicKey
        );
        tokenAddresses.push(tokenAddress);
      } catch (error) {
        console.warn(`Error getting address for ${symbol}:`, error);
      }
    }

    // Batch request for account info
    const tokenInfos = await networkConnection.getMultipleAccountsInfo(tokenAddresses);

    // Process results
    for (let i = 0; i < tokenAddresses.length; i++) {
      const tokenAddress = tokenAddresses[i];
      const accountInfo = tokenInfos[i];
      const symbol = tokenSymbols[i];

      if (accountInfo) {
        try {
          // Process the account info directly
          const tokenBalance = await networkConnection.getTokenAccountBalance(tokenAddress);
          const balance = tokenBalance.value.uiAmount || 0;
          const decimals = tokenBalance.value.decimals;

          balances.push({
            token: symbol,
            balance,
            decimals
          });
        } catch (error) {
          console.warn(`Failed to parse token ${symbol} from batch request:`, error);
        }
      } else {
        // Account doesn't exist, push zero balance
        balances.push({
          token: symbol,
          balance: 0,
          decimals: tokenCache[network][symbol].decimals || 6
        });
      }
    }

    return {
      success: true,
      balances,
      network,
      message: `Loaded ${balances.length} token balances`
    };
  } catch (error: any) {
    console.error("Token balance check error:", error);
    return {
      success: false,
      error: error.message,
      balances: [],
      network,
      message: `Failed to get token balances: ${error.message}`
    };
  }
}

export async function fetchUserTokens(
  connection: web3.Connection,
  wallet: any,
  network: "localnet" | "devnet" | "mainnet" = "localnet",
  options = { hideUnknown: false }
): Promise<{
  mint: string;
  balance: number;
  symbol: string;
  decimals: number;
}[]> {
  if (!connection || !wallet.publicKey) {
    console.log("Missing connection or wallet address");
    return [];
  }

  const persistedMappings = getTokenMappingsFromLocalStorage(network);


  try {
    console.log(`Fetching on-chain tokens for ${wallet.publicKey.toString()} on ${network}...`);

    // Get all token accounts owned by the user directly from the blockchain
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      wallet.publicKey,
      { programId: TOKEN_PROGRAM_ID }
    );

    console.log(`Found ${tokenAccounts.value.length} token accounts on ${network}`);

    // Process each token account to get balance and metadata
    const tokens = tokenAccounts.value
      .map(account => {
        try {
          const parsedInfo = account.account.data.parsed.info;
          const mintAddress = parsedInfo.mint;
          const balance = parsedInfo.tokenAmount.uiAmount;

          // Skip tokens with zero balance
          if (balance === 0) return null;

          // Try to identify the token symbol from our various sources
          let symbol = "Unknown";
          let tokenInfo = null;

          if (persistedMappings[mintAddress]) {
            symbol = persistedMappings[mintAddress].symbol;
            console.log(`Found persisted mapping for ${mintAddress}: ${symbol}`);
          }

          // Check in token cache first
          else if (tokenCache[network]) {
            for (const [cachedSymbol, info] of Object.entries(tokenCache[network])) {
              if (info.mint?.toString() === mintAddress) {
                symbol = cachedSymbol;
                break;
              }
            }
          }

          // If still unknown, check in well-known tokens list
          else if (symbol === "Unknown" && KNOWN_TOKENS && KNOWN_TOKENS[network]) {
            for (const [knownSymbol, knownAddress] of Object.entries(KNOWN_TOKENS[network] || {})) {
              if (knownAddress === mintAddress) {
                symbol = knownSymbol;
                break;
              }
            }
          }

          console.log(`Found token: ${symbol} with balance ${balance}`);

          return {
            mint: mintAddress,
            balance,
            symbol,
            decimals: parsedInfo.tokenAmount.decimals
          };
        } catch (err) {
          console.error("Error processing token account:", err);
          return null;
        }
      })
      .filter(token => token !== null);

    // Add native SOL balance
    try {
      const solBalance = await connection.getBalance(wallet.publicKey);
      if (solBalance > 0) {
        tokens.push({
          mint: "SOL", // Special case for native SOL
          balance: solBalance / web3.LAMPORTS_PER_SOL,
          symbol: "SOL",
          decimals: 9
        });
      }
    } catch (err) {
      console.error("Error fetching SOL balance:", err);
    }

    console.log(`Found ${tokens.length} tokens with non-zero balance on ${network}`);
    if (options.hideUnknown) {
      return tokens.filter(token => token.symbol !== "Unknown");
    }
    return tokens;
  } catch (error) {
    console.error("Error fetching user tokens:", error);
    return [];
  }
}

// Add these functions to persist token mappings
function saveTokenMappingToLocalStorage(network: string, mintAddress: string, tokenInfo: {
  symbol: string;
  decimals: number;
}) {
  try {
    const storageKey = `token-mapping-${network}`;
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
  try {
    const storageKey = `token-mapping-${network}`;
    const existing = localStorage.getItem(storageKey);
    return existing ? JSON.parse(existing) : {};
  } catch (err) {
    console.error("Failed to get token mappings from localStorage:", err);
    return {};
  }
}

async function getTokenInfo(
  symbol: string,
  network: "localnet" | "devnet" | "mainnet"
): Promise<{ mint: PublicKey, decimals: number } | null> {
  // Check in-memory cache first
  if (tokenCache[network] && tokenCache[network][symbol]) {
    return {
      mint: tokenCache[network][symbol].mint,
      decimals: tokenCache[network][symbol].decimals
    };
  }

  // If not in memory, check localStorage
  const persistedMappings = getTokenMappingsFromLocalStorage(network);

  // Look through persisted mappings to find a match by symbol
  for (const [mintAddress, info] of Object.entries(persistedMappings)) {
    if (info.symbol === symbol) {
      const mint = new PublicKey(mintAddress);
      return {
        mint,
        decimals: info.decimals
      };
    }
  }

  // Not found anywhere
  return null;
}

async function getOrRecreateTokenMint(
  connection: Connection,
  wallet: any,
  tokenSymbol: string,
  network: "localnet" | "devnet" | "mainnet"
): Promise<{ mint: PublicKey, decimals: number } | null> {
  try {
    console.log(`Looking up token info for ${tokenSymbol}...`);

    // First check if we have the mint info cached
    let tokenInfo = await getTokenInfo(tokenSymbol, network);

    if (tokenInfo && tokenInfo.mint) {
      console.log(`Found cached mint: ${tokenInfo.mint.toString()}`);

      // Verify this mint still exists on-chain
      try {
        const mintAccount = await connection.getAccountInfo(tokenInfo.mint);

        if (mintAccount) {
          console.log(`Mint account verified on chain`);
          return tokenInfo;
        } else {
          console.log(`Mint account not found on chain, needs recreation`);
          // Continue to recreation logic below
        }
      } catch (error) {
        console.log(`Error checking mint account, will recreate:`, error);
        // Continue to recreation logic
      }
    }

    // If we get here, we need to create a new mint
    console.log(`Creating new mint for ${tokenSymbol}...`);

    // Create a new mint account
    const mintKeypair = Keypair.generate();
    const mintRent = await connection.getMinimumBalanceForRentExemption(
      MintLayout.span
    );

    // Add extra rent SOL to prevent garbage collection
    const mintSOL = mintRent * 2; // Double the rent to keep it alive longer

    // Create the mint account
    const createMintAccountIx = SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      lamports: mintSOL,
      space: MintLayout.span,
      programId: TOKEN_PROGRAM_ID
    });

    // Initialize mint
    const decimals = 6; // Standard for most tokens
    const initMintIx = createInitializeMintInstruction(
      mintKeypair.publicKey,
      decimals,
      wallet.publicKey,
      wallet.publicKey
    );

    // Create transaction with both instructions
    const transaction = new Transaction().add(
      createMintAccountIx,
      initMintIx
    );

    // Get recent blockhash and sign
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.feePayer = wallet.publicKey;
    transaction.recentBlockhash = blockhash;

    // Sign transaction
    transaction.partialSign(mintKeypair);
    const signedTx = await wallet.signTransaction(transaction);

    // Send and confirm transaction
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    await connection.confirmTransaction(signature);

    console.log(`Created new mint: ${mintKeypair.publicKey.toString()}`);

    // Save this new mint to our cache
    const newTokenInfo = {
      mint: mintKeypair.publicKey,
      decimals
    };

    // Update token cache
    await saveTokenInfo(tokenSymbol, newTokenInfo, network);

    return newTokenInfo;
  } catch (error) {
    console.error(`Error creating/getting token mint:`, error);
    return null;
  }
}
async function saveTokenInfo(
  symbol: string,
  tokenInfo: { mint: PublicKey, decimals: number },
  network: "localnet" | "devnet" | "mainnet"
): Promise<void> {
  // Import what you need from tokens-service


  // Update in-memory cache
  setTokenInCache(symbol, tokenInfo, network);

  // Update localStorage
  const persistedMappings = getTokenMappingsFromLocalStorage(network);
  persistedMappings[tokenInfo.mint.toString()] = {
    symbol,
    decimals: tokenInfo.decimals
  };
  saveTokenMappingsToLocalStorage(persistedMappings, network);

  console.log(`Saved ${symbol} token info to cache and localStorage`);
}

function createInitializeMintInstruction(
  mint: PublicKey,
  decimals: number,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey
) {
  return spl.createInitializeMintInstruction(
    mint,
    decimals,
    mintAuthority,
    freezeAuthority,
    spl.TOKEN_PROGRAM_ID
  );
}
/**
 * Consolidates token mappings to ensure a single symbol points to one mint
 */
async function consolidateTokenMappings(
  network: string,
  symbol: string,
  currentMint: PublicKey
): Promise<void> {
  try {
    const mappings = getTokenMappingsFromLocalStorage(network);
    const updatedMappings: Record<string, { symbol: string, decimals: number }> = {};
    const currentMintStr = currentMint.toString();

    // Find all entries for this symbol
    const mintAddresses = Object.keys(mappings);
    let foundCurrent = false;

    // First pass - keep the current mint and non-conflicting entries
    for (const mintAddress of mintAddresses) {
      const info = mappings[mintAddress];

      // If this is our current mint, mark it found
      if (mintAddress === currentMintStr) {
        updatedMappings[mintAddress] = info;
        foundCurrent = true;
      }
      // If this is a different symbol, keep it
      else if (info.symbol !== symbol) {
        updatedMappings[mintAddress] = info;
      }
      // Otherwise, it's a duplicate we'll discard
    }

    // If we didn't find our current mint in the mappings, add it
    if (!foundCurrent) {
      updatedMappings[currentMintStr] = {
        symbol,
        decimals: tokenCache[network][symbol]?.decimals || 6
      };
    }

    // Save the cleaned mappings
    saveTokenMappingsToLocalStorage(updatedMappings, network);
    console.log(`Consolidated token mappings for ${symbol}`);
  } catch (err) {
    console.error("Failed to consolidate token mappings:", err);
  }
}


export async function executePoolSwap(
  connection: Connection,
  _originalConnection: Connection,
  wallet: any,
  fromTokenSymbol: string,
  toTokenSymbol: string,
  amountIn: number,
  slippageBps: number = 50,
  network: "localnet" | "devnet" | "mainnet" = "localnet",
): Promise<{
  success: boolean;
  message: string;
  signature?: string;
  explorerUrl?: string;
  inputAmount?: number;
  outputAmount?: number;
  error?: any;
}> {
  console.log(">>> executePoolSwap FUNCTION ENTERED <<<");
  console.log(`🔄 Intializing pool swap: ${amountIn} ${fromTokenSymbol} -> ${toTokenSymbol} on ${network}`);

  if (!wallet.publicKey || !wallet.signTransaction) {
    return { success: false, message: "Wallet not connected or does not support signing" };
  }

  try {

    const connection = new Connection(NETWORK_URLS[network], "confirmed");
    console.log(`  Using FRESH connection endpoint: ${connection.rpcEndpoint}`);

    const program = getProgram(connection, wallet);

    console.log("  Fetching mint addresses...");
    const fromTokenInfo = await getOrCreateToken(connection, wallet, fromTokenSymbol, network)

    const toTokenInfo = await getOrCreateToken(connection, wallet, toTokenSymbol, network)




    if (!fromTokenInfo || !toTokenInfo) {
      return {
        success: false,
        message: "Could not find token mint addresses",
      }
    }

    const wrappedSolMint = new PublicKey("So11111111111111111111111111111111111111112");

    let fromMint = fromTokenInfo.mint;
    let toMint = toTokenInfo.mint;

    if (fromTokenSymbol.toUpperCase() === "SOL") {
      fromMint = wrappedSolMint;
      console.log("Using wrapped SOL mint for 'from' token");
    }

    if (toTokenSymbol.toUpperCase() === "SOL") {
      toMint = wrappedSolMint;
      console.log("Using wrapped SOL mint for 'to' token");
    }

    console.log(` From Mint (${fromTokenSymbol}): ${fromMint.toBase58()}`);
    console.log(` To Mint (${toTokenSymbol}): ${toMint.toBase58()}`);


    console.log(" Deriving pool PDAs...");
    const { poolPda, poolAuthorityPda } = await getPoolPDAs(program.programId, fromMint, toMint);
    console.log(`  Derived Pool PDA for fetch: ${poolPda.toBase58()}`);
    console.log(`  Using connection endpoint: ${connection.rpcEndpoint}`);
    console.log(`  Program ID used: ${program.programId.toBase58()}`);

    console.log(` Pool PDA: ${poolPda.toBase58()}`);
    console.log(` Pool Authority PDA: ${poolAuthorityPda.toBase58()}`);


    console.log("  Fetching pool state account...");
    let poolAccount: any;
    try {

      console.log(`  Attempting manual getAccountInfo for ${poolPda.toBase58()}...`);
      const accountInfo = await connection.getAccountInfo(poolPda); // Use fresh connection
      if (!accountInfo) {
        console.error(`  MANUAL FETCH FAILED: Account ${poolPda.toBase58()} not found via connection.`);
      } else {
        console.log(`  MANUAL FETCH SUCCEEDED: Owner ${accountInfo.owner.toBase58()}, Length ${accountInfo.data.length}`);
      }

      poolAccount = await program.account.liquidityPool.fetch(poolPda); // Anchor uses the provider's connection
      console.log(" Pool account fetched successfully via Anchor.");

    } catch (e) {
      console.error("Error fetching pool account:", e);
      return {
        success: false,
        message: `Liquidity pool for ${fromTokenSymbol}/${toTokenSymbol} not found`,
        error: e
      }
    }

    let poolSourceMint: PublicKey;
    let poolDestinationMint: PublicKey;
    let poolSourceVault: PublicKey;
    let poolDestinationVault: PublicKey;

    if (poolAccount.tokenAMint.equals(fromMint) && poolAccount.tokenBMint.equals(toMint)) {
      poolSourceMint = poolAccount.tokenAMint;
      poolDestinationMint = poolAccount.tokenBMint;
      poolSourceVault = poolAccount.tokenAVault;
      poolDestinationVault = poolAccount.tokenBVault;
      console.log(" Direction: Pool A -> Pool B");
    } else if (poolAccount.tokenAMint.equals(toMint) && poolAccount.tokenBMint.equals(fromMint)) {
      poolSourceMint = poolAccount.tokenBMint;
      poolDestinationMint = poolAccount.tokenAMint;
      poolSourceVault = poolAccount.tokenBVault;
      poolDestinationVault = poolAccount.tokenAVault;
      console.log(" Direction: Pool B -> Pool A");
    } else {
      return {
        success: false,
        message: "Mismatched Mints between input tokens and fetched pool state."
      }
    }


    console.log(" Fetching vault balances...");
    const sourceVaultBalanceRaw = (await connection.getTokenAccountBalance(poolSourceVault)).value.amount;
    const destinationVaultBalanceRaw = (await connection.getTokenAccountBalance(poolDestinationVault)).value.amount;

    if (sourceVaultBalanceRaw === null || destinationVaultBalanceRaw === null) {
      return { success: false, message: "Could not fetch vault balances." }
    }
    console.log(` Source Vault Balance: ${sourceVaultBalanceRaw}`)
    console.log(` Destination Vault Balance: ${destinationVaultBalanceRaw}`)



    const amountInBN = new BN(Math.floor(amountIn * Math.pow(10, fromTokenInfo.decimals)));
    const sourceReserveBN = new BN(sourceVaultBalanceRaw);
    const destinationReserveBN = new BN(destinationVaultBalanceRaw);

    if (sourceReserveBN.isZero() || destinationReserveBN.isZero()) {
      return {
        success: false,
        message: "Pool has zero liquidity in one of the vaults."
      }
    }

    const expectedAmountOutBN = calculateExpectedOut(amountInBN, sourceReserveBN, destinationReserveBN);
    const slippageTolerance = new BN(slippageBps);
    const hundred_thousand = new BN(100000);
    const minAmountOutBN = expectedAmountOutBN.mul(hundred_thousand.sub(slippageTolerance)).div(hundred_thousand);

    const estimatedOutputAmount = expectedAmountOutBN.toNumber() / Math.pow(10, toTokenInfo.decimals);

    console.log(` Amount IN (lamports): ${amountInBN.toString()}`);
    console.log(` Expected Out (lamports): ${expectedAmountOutBN.toString()}`);
    console.log(` Min Amount Out (lamports): ${minAmountOutBN.toString()}`);
    console.log(` Estimated Output (${toTokenSymbol}): ${estimatedOutputAmount}`);

    if (expectedAmountOutBN.isZero() || minAmountOutBN.isZero()) {
      return {
        success: false,
        message: "Calculated output zero. Check input amount or pool liquidity"
      }
    }

    console.log(" Getting user ATAs...");
    const userSourceTokenAccount = await getAssociatedTokenAddress(fromMint, wallet.publicKey);
    const userDestinationTokenAccount = await getAssociatedTokenAddress(toMint, wallet.publicKey)
    console.log(` User Source ATA: ${userSourceTokenAccount.toBase58()}`);
    console.log(` User Destination ATA: ${userDestinationTokenAccount.toBase58()}`);


    const transaction = new Transaction();
    // const destinationAccountInfo = await getAssociatedTokenAddress(fromMint, wallet.publicKey);
    let destinationAccountInfo;
    try {
      destinationAccountInfo = await connection.getAccountInfo(userDestinationTokenAccount);
    } catch (e) {
      if (!(e instanceof Error && (e.message.includes("could not find account") || e.message.includes("Account does not exists")))) {
        console.error("Error checking destination ATA:", e);
      }
    }
    if (!destinationAccountInfo) {
      console.log("Destination ATA not found, creating...")
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          userDestinationTokenAccount,
          wallet.publicKey,
          toMint
        )
      );
    }

    console.log(" Building swap instruction...");
    const swapIx = await program.methods
      .swap(amountInBN, minAmountOutBN)
      // *** START CHANGE HERE - Use snake_case for ALL keys ***
      .accounts({
        // Use camelCase names matching the TypeScript types
        userAuthority: wallet.publicKey,
        pool: poolPda,
        poolAuthority: poolAuthorityPda,

        sourceMint: poolSourceMint,          // Mint of token being sent IN
        destinationMint: poolDestinationMint, // Mint of token being sent OUT

        userSourceTokenAccount: userSourceTokenAccount, // User's ATA for source token
        userDestinationTokenAccount: userDestinationTokenAccount, // User's ATA for dest token

        tokenAVault: poolAccount.tokenAVault, // The ACTUAL vault A address from pool state
        tokenBVault: poolAccount.tokenBVault, // The ACTUAL vault B address from pool state

        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      // *** END CHANGE HERE ***
      .instruction();

    transaction.add(swapIx);


    console.log(" Sending transaction...");
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());

    console.log(` Transaction sent: ${signature}`);

    console.log(" Confirming transaction...");

    try {
      // Use the lastValidBlockHeight from the SAME getLatestBlockhash call
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight, // Use this instead of calling getBlockHeight() again
      }, "confirmed");

      if (confirmation.value.err) {
        throw new Error(`Transaction confirmed but failed: ${confirmation.value.err}`);
      }

      console.log(" Transaction confirmed!");

      const explorerUrl = network === "mainnet" ?
        `https://explorer.solana.com/tx/${signature}`
        : `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

      return {
        success: true,
        message: `Successfully swapped ${amountIn} ${fromTokenSymbol} for ~${estimatedOutputAmount.toFixed(4)} ${toTokenSymbol}`,
        signature,
        explorerUrl,
        inputAmount: amountIn,
        outputAmount: estimatedOutputAmount,
      };
    } catch (error: any) {
      console.error("Transaction confirmation error:", error);
      if (error.toString().includes("block height exceeded")) {
        // The transaction may still succeed, check manually
        try {
          const status = await connection.getSignatureStatus(signature);
          if (status?.value?.confirmationStatus === 'confirmed' || status?.value?.confirmationStatus === 'finalized') {
            console.log("Transaction succeeded despite confirmation timeout!");
            // ADD RETURN STATEMENT HERE
            const explorerUrl = network === "mainnet" ?
              `https://explorer.solana.com/tx/${signature}`
              : `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

            return {
              success: true,
              message: `Successfully swapped ${amountIn} ${fromTokenSymbol} for ~${estimatedOutputAmount.toFixed(4)} ${toTokenSymbol}`,
              signature,
              explorerUrl,
              inputAmount: amountIn,
              outputAmount: estimatedOutputAmount,
            };
          } else {
            throw new Error("Transaction expired and was not found in the ledger");
          }
        } catch (statusError) {
          throw error; // Re-throw original error if we can't get status
        }
      } else {
        throw error; // Re-throw other errors
      }
    }


  } catch (error: any) {
    console.error("Swap execution error:", error);
    let message = `Failed to execute swap: ${error.message}`;
    if (error.logs) {
      console.error("Transaction logs:", error.logs)

      if (error.logs.some((log: string) => log.includes("Slippage tolerance exceeded"))) {
        message = "Swap failed: Slippage tolerance exceeded. Priced moved too much."
      } else if (error.logs.some((log: string) => log.includes("Insufficient liquidity"))) {
        message = "Swap failed: Insufficient liquidity in the pool"
      }
    }
    return {
      success: false,
      message: message,
      error: error,
    }
  }
}

// export async function createLiquidityPool(
//   connection: Connection,
//   wallet: any,
//   tokenASymbol: string,
//   tokenBSymbol: string,
//   initialAmountA: number,
//   initialAmountB: number,
//   network: "localnet" | "devnet" | "mainnet" = "localnet",
// ): Promise<{
//   success: boolean;
//   message: string;
//   signature?: string;
//   explorerUrl?: string;
// }> {
//   try {
//     if (!wallet.connected || !wallet.publicKey) {
//       return {
//         success: false,
//         message: "Wallet not connected",
//       };
//     }

//     const program = getProgram(connection, wallet)
//     const authority = wallet.publicKey;

//     const tokenAIsSol = tokenASymbol.toUpperCase() === "SOL";
//     const tokenBIsSol = tokenBSymbol.toUpperCase() === "SOL";

//     if (tokenAIsSol !== tokenBIsSol) {
//       const solAmount = tokenAIsSol ? initialAmountA : initialAmountB;
//       const splAmount = tokenAIsSol ? initialAmountB : initialAmountA;
//       const splSymbol = tokenAIsSol ? tokenBSymbol : tokenASymbol;

//       if (solAmount <= 0) {
//         return {
//           success: false,
//           message: `Invalid initial amount for SOL (${solAmount}). Amount must be positive`,
//         }
//       }

//       const userValueRatio = splAmount / solAmount;
//       const targetValueRatio = 200;
//       const allowedDeviation = 0.2;

//       console.log(`Create Pool Value Check: User Ratio (${splSymbol}/SOL) = ${userValueRatio}, Target = ${targetValueRatio}`);

//       if (Math.abs(userValueRatio - targetValueRatio) / targetValueRatio > allowedDeviation) {
//         const suggestedSpl = (solAmount * targetValueRatio).toFixed(2);
//         const suggestedSol = (splAmount / targetValueRatio).toFixed(4);

//         return {
//           success: false,
//           message: `❌ Initial liquidity value ratio is unbalanced. For this test environment, please provide amounts closer to **1 SOL ≈ 200 ${splSymbol}**. \n\nSuggestions:\n- For ${solAmount} SOL, use ~${suggestedSpl} ${splSymbol}.\n- For ${splAmount} ${splSymbol}, use ~${suggestedSol} SOL.`

//         }
//       }
//     }

//     let tokenAInfo = await getOrCreateToken(connection, wallet, tokenASymbol, network);
//     let tokenBInfo = await getOrCreateToken(connection, wallet, tokenBSymbol, network);

//     if (!tokenAInfo || !tokenBInfo) {
//       return {
//         success: false,
//         message: "Failed to find token information"
//       };

//     }
//     const wrappedSolMint = new PublicKey("So11111111111111111111111111111111111111112")

//     // if (tokenAInfo && tokenAInfo.symbol === 'SOL') {
//     //   tokenAInfo = {
//     //     ...tokenAInfo,
//     //     mint: wrappedSolMint
//     //   }
//     // }

//     // if (tokenBInfo && tokenBInfo.symbol === "SOL") {
//     //   tokenBInfo = {
//     //     ...tokenBInfo,
//     //     mint: wrappedSolMint
//     //   };
//     // }

//     // const sortByMint = tokenAInfo.mint.toString() < tokenBInfo.mint.toString();

//     // const [firstToken, secondToken] = sortByMint ? [tokenAInfo, tokenBInfo] : [tokenBInfo, tokenAInfo];

//     // const [firstToken, secondToken] = [tokenAInfo, tokenBInfo].sort((a, b) => a.mint.toBuffer().compare(b.mint.toBuffer()));
//     let tokenAMint = tokenAIsSol ? wrappedSolMint : tokenAInfo.mint;
//     let tokenBMint = tokenBIsSol ? wrappedSolMint : tokenBInfo.mint;

//     // const [firstLiquidty, secondLiquidity] = sortByMint ? [initialLiquidityA, initialLiquidityB] : [initialLiquidityB, initialLiquidityA];

//     // const firstLiquidty = firstToken.symbol.toUpperCase() === tokenASymbol.toUpperCase() ? initialLiquidityA : initialLiquidityB;

//     // const secondLiquidity = firstToken.symbol.toUpperCase() === tokenASymbol.toUpperCase() ? initialLiquidityB : initialLiquidityA;

//     let firstAmount = initialAmountA;
//     let secondAmount = initialAmountB;

//     if (tokenAMint.toBuffer().compare(tokenBMint.toBuffer()) > 0) {
//       [tokenAMint, tokenBMint] = [tokenBMint, tokenAMint];
//       [firstAmount, secondAmount] = [initialAmountB, initialAmountA];
//       console.log("Swapped mint order for PDA derivation")
//     }

//     const amountABaseUnits = new BN(firstAmount * Math.pow(10, tokenAIsSol ? 9 : tokenAInfo.decimals));
//     const amountBBaseUnits = new BN(secondAmount * Math.pow(10, tokenBIsSol ? 9 : tokenBInfo.decimals));



//     const { poolPda, vaultAPda, vaultBPda, lpMintPda, poolAuthorityPda } = await getPoolPDAs(program.programId, tokenAMint, tokenBMint);



//     // console.log(`Creating pool for ${tokenASymbol}/${tokenBSymbol}`);
//     // console.log(` Pool PDA: ${poolPda.toString()}`);
//     // console.log(`Pool Authority PDA: ${poolAuthorityPda.toString()}`);

//     console.log("Creating pool with PDAs:", { poolPda: poolPda.toBase58(), vaultAPda: vaultAPda.toBase58(), vaultBPda: vaultBPda.toBase58(), lpMintPda: lpMintPda.toBase58() });

//     const solAmountToWrap = tokenAIsSol ? firstAmount : (tokenBIsSol ? secondAmount : 0);


//     const userTokenAAccount = await getAssociatedTokenAddress(firstToken.mint, wallet.publicKey);
//     const userTokenBAccount = await getAssociatedTokenAddress(secondToken.mint, wallet.publicKey);



//     const tokenAVault = await getAssociatedTokenAddress(
//       firstToken.mint,
//       poolAuthorityPda,
//       true
//     );
//     const tokenBVault = await getAssociatedTokenAddress(
//       secondToken.mint,
//       poolAuthorityPda,
//       true
//     );

//     const tx = await program.methods
//       .initializePool()
//       .accounts({
//         tokenAMint: firstToken.mint,
//         tokenBMint: secondToken.mint,
//         pool: poolPda,
//         poolAuthority: poolAuthorityPda,
//         tokenAVault: tokenAVault,
//         tokenBVault: tokenBVault,
//         initializer: wallet.publicKey,
//         tokenProgram: TOKEN_PROGRAM_ID,
//         associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
//         systemProgram: SystemProgram.programId,
//         rent: web3.SYSVAR_RENT_PUBKEY,
//       } as any)
//       .rpc();

//     console.log(`Checking balances before adding liquidity...`)
//     const firstTokenBalance = await getTokenBalance(connection, userTokenAAccount) || 0;
//     const secondTokenBalance = await getTokenBalance(connection, userTokenBAccount) || 0;

//     console.log(`User has ${firstTokenBalance} ${firstToken.symbol} and ${secondTokenBalance} ${secondToken.symbol}`)

//     if (firstTokenBalance < firstLiquidty) {
//       return {
//         success: false,
//         message: `Pool created, but couldn't add liquidity: Not enough ${firstToken.symbol}. You have ${firstTokenBalance}, but need ${firstLiquidty}`,
//         signature: tx,
//         explorerUrl: network === "mainnet"
//           ? `https://explorer.solana.com/tx/${tx}`
//           : `https://explorer.solana.com/tx/${tx}?cluster=devnet`,
//       };
//     }

//     if (secondTokenBalance < secondLiquidity) {
//       return {
//         success: false,
//         message: `Pool created, but couldn't add liquidity: Not enough ${secondToken.symbol}. You have ${secondTokenBalance}, but need ${secondLiquidity}`,
//         signature: tx,
//         explorerUrl: network === "mainnet"
//           ? `https://explorer.solana.com/tx/${tx}`
//           : `https://explorer.solana.com/tx/${tx}?cluster=devnet`,
//       };
//     }

//     try {
//       await connection.confirmTransaction(tx);



//       const addLiquidityTx = await program.methods
//         .addLiquidity(
//           new BN(firstLiquidty * Math.pow(10, firstToken.decimals)),
//           new BN(secondLiquidity * Math.pow(10, secondToken.decimals)),
//         )
//         .accounts({
//           pool: poolPda,
//           poolAuthority: poolAuthorityPda,
//           tokenAMint: firstToken.mint,
//           tokenBMint: secondToken.mint,
//           userTokenAAccount,
//           userTokenBAccount,
//           tokenAVault: tokenAVault,
//           tokenBVault: tokenBVault,
//           userAuthority: wallet.publicKey,
//           tokenProgram: TOKEN_PROGRAM_ID
//         } as any)
//         .rpc();

//       console.log("Added initial liquidity:", addLiquidityTx)
//     } catch (err: any) {
//       console.warn("Pool created but adding liquidity failed:", err);
//     }


//     const explorerUrl = network === "mainnet"
//       ? `https://explorer.solana.com/tx/${tx}`
//       : `https://explorer.solana.com/tx/${tx}?cluster=devnet`;

//     return {
//       success: true,
//       message: `Successfully created liquidity pool for ${tokenASymbol}/${tokenBSymbol}`,
//       signature: tx,
//       explorerUrl,
//     }
//   } catch (err: any) {
//     console.error("Failed to create liquidty pool:", err);
//     return {
//       success: false,
//       message: `Failed to create liquidity pool: ${err.message}`,
//     }
//   }
// }
// export async function createLiquidityPool(
//   connection: Connection,
//   wallet: any, // AnchorWallet or similar
//   tokenASymbol: string,
//   tokenBSymbol: string,
//   initialAmountA: number,
//   initialAmountB: number,
//   network: "localnet" | "devnet" | "mainnet" = "localnet"
// ): Promise<{ success: boolean; message: string; signature?: string; explorerUrl?: string; error?: any }> {
//   try {
//     const program = getProgram(connection, wallet);
//     const authority = wallet.publicKey;

//     // --- BEGIN VALUE RATIO CHECK FOR SOL POOLS ---
//     const tokenAIsSol = tokenASymbol.toUpperCase() === 'SOL';
//     const tokenBIsSol = tokenBSymbol.toUpperCase() === 'SOL';

//     // Check if exactly one of the tokens is SOL
//     if (tokenAIsSol !== tokenBIsSol) {
//       const solAmount = tokenAIsSol ? initialAmountA : initialAmountB;
//       const splAmount = tokenAIsSol ? initialAmountB : initialAmountA;
//       const splSymbol = tokenAIsSol ? tokenBSymbol : tokenASymbol;

//       if (solAmount <= 0) {
//         return { success: false, message: `Invalid initial amount for SOL (${solAmount}). Amount must be positive.`, error: "InvalidAmount" };
//       }

//       const userValueRatio = splAmount / solAmount;
//       const targetValueRatio = 200; // Your target: 1 SOL = 200 SPL
//       const allowedDeviation = 0.2; // Allow 20% deviation

//       console.log(`Create Pool Value Check: User Ratio (${splSymbol}/SOL) = ${userValueRatio}, Target = ${targetValueRatio}`);

//       if (Math.abs(userValueRatio - targetValueRatio) / targetValueRatio > allowedDeviation) {
//         const suggestedSpl = (solAmount * targetValueRatio).toFixed(2);
//         const suggestedSol = (splAmount / targetValueRatio).toFixed(4);

//         return {
//           success: false,
//           message: `❌ Initial liquidity value ratio is unbalanced. For this test environment, please provide amounts closer to **1 SOL ≈ 200 ${splSymbol}**. \n\nSuggestions:\n- For ${solAmount} SOL, use ~${suggestedSpl} ${splSymbol}.\n- For ${splAmount} ${splSymbol}, use ~${suggestedSol} SOL.`,
//           error: "InitialValueRatioImbalance"
//         };
//       }
//     }
//     else if (!tokenAIsSol && !tokenBIsSol) {
//       const amountA = initialAmountA;
//       const amountB = initialAmountB;

//       if (amountA <= 0 || amountB <= 0) {
//         return { success: false, message: `Invalid initial amounts (${amountA} ${tokenASymbol}, ${amountB} ${tokenBSymbol}). Amounts must be positive.`, error: "InvalidAmount" };
//       }

//       const userRatio = amountA / amountB;
//       const targetRatio = 1; // Target 1:1 ratio for SPL-to-SPL
//       const allowedDeviation = 0.1; // Allow 10% deviation for simplicity

//       console.log(`Create Pool Ratio Check (SPL-SPL Pool): User Ratio (${tokenASymbol}/${tokenBSymbol}) = ${userRatio}, Target = ${targetRatio}`);

//       if (Math.abs(userRatio - targetRatio) / targetRatio > allowedDeviation) {
//         return {
//           success: false,
//           message: `❌ Initial liquidity ratio is unbalanced for SPL-to-SPL pool. Please provide amounts closer to a **1:1 ratio** (e.g., 100 ${tokenASymbol} and 100 ${tokenBSymbol}).`,
//           error: "InitialSplRatioImbalance"
//         };
//       }
//     }
//     // --- END VALUE RATIO CHECK ---

//     // Get token mints (handle SOL wrapping if needed)
//     const tokenAInfo = await getOrCreateToken(connection, wallet, tokenASymbol, network);
//     const tokenBInfo = await getOrCreateToken(connection, wallet, tokenBSymbol, network);

//     if (!tokenAInfo || !tokenBInfo) {
//       throw new Error("Could not find or create token info for pool creation.");
//     }

//     const wrappedSolMint = new PublicKey("So11111111111111111111111111111111111111112");
//     let tokenAMint = tokenAIsSol ? wrappedSolMint : tokenAInfo.mint;
//     let tokenBMint = tokenBIsSol ? wrappedSolMint : tokenBInfo.mint;

//     // Ensure mint order (important for PDA derivation)



//     // if (tokenAMint.toBuffer().compare(tokenBMint.toBuffer()) > 0) {
//     //   [tokenAMint, tokenBMint] = [tokenBMint, tokenAMint];
//     //   [firstAmount, secondAmount] = [initialAmountB, initialAmountA];
//     //   console.log("Swapped mint order for PDA derivation.");
//     // }

//     // Convert amounts to base units (lamports)
//     // Ensure decimals are correctly fetched after potential swap
//     const firstTokenDecimals = tokenAMint.equals(tokenAInfo.mint) ? tokenAInfo.decimals : (tokenAMint.equals(wrappedSolMint) ? 9 : tokenBInfo.decimals);
//     const secondTokenDecimals = tokenBMint.equals(tokenBInfo.mint) ? tokenBInfo.decimals : (tokenBMint.equals(wrappedSolMint) ? 9 : tokenAInfo.decimals);

//     // const amountABaseUnits = new BN(firstAmount * Math.pow(10, firstTokenDecimals));
//     // const amountBBaseUnits = new BN(secondAmount * Math.pow(10, secondTokenDecimals));


//     // Derive PDAs - Now includes vault and lpMint PDAs
//     const { poolPda, poolAuthorityPda } = await getPoolPDAs(
//       program.programId,
//       tokenAMint, // Pass unsorted mint A
//       tokenBMint  // Pass unsorted mint B
//     );
//     console.log("Creating pool with PDAs:", { poolPda: poolPda.toBase58(), poolAuthorityPda: poolAuthorityPda.toBase58() });


//     const tokenAVaultATA = await getAssociatedTokenAddress(
//       tokenAMint, // Use unsorted mint A
//       poolAuthorityPda, // Authority is the derived PDA
//       true // Allow off-curve addresses
//     );
//     const tokenBVaultATA = await getAssociatedTokenAddress(
//       tokenBMint, // Use unsorted mint B
//       poolAuthorityPda, // Authority is the derived PDA
//       true // Allow off-curve addresses
//     );
//     // Check if SOL needs wrapping
//     // let wrapSolInstruction: TransactionInstruction | null = null; // Type is now recognized
//     // let cleanupInstruction: TransactionInstruction | null = null; // Type is now recognized
//     let userSourceTokenAccountA = await getAssociatedTokenAddress(tokenAMint, authority);
//     let userSourceTokenAccountB = await getAssociatedTokenAddress(tokenBMint, authority);
//     // Determine which amount corresponds to SOL after potential mint swap
//     const solAmountToWrap = tokenAMint.equals(wrappedSolMint) ? initialAmountA : (tokenBMint.equals(wrappedSolMint) ? initialAmountB : 0);

//     if (solAmountToWrap > 0) {
//       console.log(`Wrapping ${solAmountToWrap} SOL for initial liquidity...`);
//       const lamportsToWrap = new BN(solAmountToWrap * LAMPORTS_PER_SOL);

//       // Create temporary ATA for wrapped SOL
//       const associatedTokenAccount = await getAssociatedTokenAddress(wrappedSolMint, authority);

//       // Check if ATA exists, create if not
//       const ataInfo = await connection.getAccountInfo(associatedTokenAccount);
//       const instructions: TransactionInstruction[] = []; // Type is now recognized

//       if (!ataInfo) {
//         console.log("Creating ATA for wSOL...");
//         instructions.push(
//           createAssociatedTokenAccountInstruction(
//             authority, // payer
//             associatedTokenAccount, // ata
//             authority, // owner
//             wrappedSolMint // mint
//           )
//         );
//       }

//       // Transfer SOL and sync native
//       instructions.push(
//         SystemProgram.transfer({
//           fromPubkey: authority,
//           toPubkey: associatedTokenAccount,
//           lamports: lamportsToWrap.toNumber(),
//         }),
//         createSyncNativeInstruction(associatedTokenAccount)
//       );

//       // Create a transaction for wrapping
//       const wrapTx = new Transaction().add(...instructions);
//       try {
//         const wrapSig = await wallet.sendTransaction(wrapTx, connection);
//         await connection.confirmTransaction(wrapSig, 'confirmed');
//         console.log("SOL wrapped successfully, signature:", wrapSig);
//       } catch (wrapError) {
//         console.error("Failed to wrap SOL:", wrapError);
//         return { success: false, message: `Failed to wrap SOL for liquidity: ${wrapError instanceof Error ? wrapError.message : String(wrapError)}`, error: wrapError };
//       }


//       // Update the source account for the main transaction
//       if (tokenAMint.equals(wrappedSolMint)) userSourceTokenAccountA = associatedTokenAccount;
//       else if (tokenBMint.equals(wrappedSolMint)) userSourceTokenAccountB = associatedTokenAccount;

//       // Prepare instruction to close the temporary wSOL account after pool creation
//       // Note: This might be complex if the user already had a wSOL account.
//       // For simplicity in test env, we might skip auto-closing or require manual cleanup.
//       // cleanupInstruction = createCloseAccountInstruction(associatedTokenAccount, authority, authority);
//     }


//     // Build the main transaction
//     const tx = new Transaction();

//     // Add the InitializePool instruction
//     tx.add(
//       program.instruction.initializePool({
//         accounts: {
//           // pool: poolPda,
//           // poolAuthority: poolAuthorityPda, // Use derived pool authority PDA
//           // tokenAMint: tokenAMint,
//           // tokenBMint: tokenBMint,
//           // tokenAVault: vaultAPda, // Use derived vault PDA
//           // tokenBVault: vaultBPda, // Use derived vault PDA
//           // lpTokenMint: lpMintPda, // Use derived LP mint PDA
//           // userTokenAAccount: userSourceTokenAccountA,
//           // userTokenBAccount: userSourceTokenAccountB,
//           // userWallet: authority,
//           // tokenProgram: TOKEN_PROGRAM_ID,
//           // associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
//           // systemProgram: SystemProgram.programId,
//           // rent: web3.SYSVAR_RENT_PUBKEY, // Use imported SYSVAR_RENT_PUBKEY
//           tokenAMint: tokenAMint, // Mint A (ordered)
//           tokenBMint: tokenBMint, // Mint B (ordered)
//           pool: poolPda,          // Pool state account PDA
//           poolAuthority: poolAuthorityPda, // Pool authority PDA
//           tokenAVault: tokenAVaultATA, // Vault A PDA (derived using ordered mints)
//           tokenBVault: tokenBVaultATA, // Vault B PDA (derived using ordered mints)
//           initializer: authority, // Changed from userWallet to initializer
//           tokenProgram: TOKEN_PROGRAM_ID,
//           associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
//           systemProgram: SystemProgram.programId,
//           rent: web3.SYSVAR_RENT_PUBKEY,
//         },
//       } as any) // Removed 'as any' as types should align now
//     );

//     // Add cleanup instruction if needed (use with caution)
//     // if (cleanupInstruction) {
//     //    tx.add(cleanupInstruction);
//     // }

//     // Send and confirm transaction
//     const signature = await wallet.sendTransaction(tx, connection);
//     console.log("Create pool transaction sent:", signature);

//     const confirmation = await connection.confirmTransaction(signature, "confirmed");
//     if (confirmation.value.err) {
//       // Attempt to get logs for better error diagnosis
//       const txDetails = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0 });
//       console.error("Transaction confirmation error details:", confirmation.value.err);
//       console.error("Transaction logs:", txDetails?.meta?.logMessages);
//       throw new Error(`Transaction confirmed but failed: ${confirmation.value.err}`);
//     }

//     console.log("Pool created successfully!");
//     const explorerUrl = network === "mainnet" ?
//       `https://explorer.solana.com/tx/${signature}`
//       : `https://explorer.solana.com/tx/${signature}?cluster=${network}`;

//     return {
//       success: true,
//       message: `Successfully created liquidity pool for ${tokenASymbol}/${tokenBSymbol}.`,
//       signature,
//       explorerUrl,
//     };

//   } catch (error: any) {
//     console.error("Failed to create liquidity pool:", error);
//     // Try to provide more specific error messages
//     let message = `Failed to create liquidity pool: ${error.message}`;
//     // Check if error has logs property (common with Anchor errors after simulation/confirmation failure)
//     const errorLogs = error?.logs as string[] | undefined;
//     if (errorLogs) {
//       console.error("Error Logs:", errorLogs); // Log the errors
//       if (errorLogs.some((log: string) => log.includes("already in use"))) {
//         message = `❌ Pool for ${tokenASymbol}/${tokenBSymbol} already exists. Use 'add liquidity' instead.`;
//       } else if (errorLogs.some((log: string) => log.includes("insufficient lamports"))) {
//         message = `❌ Failed to create pool: Insufficient SOL balance for rent/fees.`;
//       }
//       // Add more specific checks based on program logs if needed
//     } else if (error.message?.includes("Attempt to debit an account but found no record of a prior credit")) {
//       message = `❌ Failed to create pool: Insufficient balance for one of the tokens or SOL for fees/rent.`;
//     } else if (error.message?.includes("Transaction simulation failed")) {
//       // Extract logs if available within the simulation error message itself
//       const logsMatch = error.message.match(/Logs:\s*(\[[\s\S]*\])/);
//       const logsString = logsMatch ? logsMatch[1] : "[]";
//       try {
//         const logsArray = JSON.parse(logsString.replace(/\\"/g, '"')); // Handle escaped quotes
//         console.error("Simulation Logs:", logsArray);
//         if (logsArray.some((log: string) => log.includes("already in use"))) {
//           message = `❌ Pool for ${tokenASymbol}/${tokenBSymbol} already exists. Use 'add liquidity' instead.`;
//         } else if (logsArray.some((log: string) => log.includes("insufficient lamports"))) {
//           message = `❌ Failed to create pool: Insufficient SOL balance for rent/fees.`;
//         }
//       } catch (parseError) {
//         console.error("Failed to parse simulation logs:", parseError);
//       }
//     }


//     return { success: false, message, error };
//   }
// }
export async function createLiquidityPool(
  connection: Connection,
  wallet: WalletContextState, // Use correct type
  tokenASymbol: string,
  tokenBSymbol: string,
  initialAmountA: number, // These are NOT used by initializePool, only for ratio check
  initialAmountB: number, // These are NOT used by initializePool, only for ratio check
  network: "localnet" | "devnet" | "mainnet" = "localnet"
): Promise<{ success: boolean; message: string; signature?: string; explorerUrl?: string; error?: any }> {
  try {
    if (!wallet.publicKey || !wallet.signTransaction) {
      return { success: false, message: "Wallet not connected or doesn't support signing." };
    }
    const program = getProgram(connection, wallet);
    const authority = wallet.publicKey;

    // --- Ratio Check (Keep this as it's good validation) ---
    const tokenAIsSol = tokenASymbol.toUpperCase() === 'SOL';
    const tokenBIsSol = tokenBSymbol.toUpperCase() === 'SOL';
    if (tokenAIsSol !== tokenBIsSol) {
      // ... (keep your existing ratio check logic) ...
      const solAmount = tokenAIsSol ? initialAmountA : initialAmountB;
      const splAmount = tokenAIsSol ? initialAmountB : initialAmountA;
      const splSymbol = tokenAIsSol ? tokenBSymbol : tokenASymbol;
      if (solAmount <= 0) return { success: false, message: `Invalid initial amount for SOL (${solAmount}).`, error: "InvalidAmount" };
      const userValueRatio = splAmount / solAmount;
      const targetValueRatio = 200;
      const allowedDeviation = 0.2;
      if (Math.abs(userValueRatio - targetValueRatio) / targetValueRatio > allowedDeviation) {
        const suggestedSpl = (solAmount * targetValueRatio).toFixed(2);
        const suggestedSol = (splAmount / targetValueRatio).toFixed(4);
        return { success: false, message: `❌ Initial liquidity value ratio is unbalanced. Target: **1 SOL ≈ 200 ${splSymbol}**. \nSuggestions:\n- For ${solAmount} SOL, use ~${suggestedSpl} ${splSymbol}.\n- For ${splAmount} ${splSymbol}, use ~${suggestedSol} SOL.`, error: "InitialValueRatioImbalance" };
      }
    } else if (!tokenAIsSol && !tokenBIsSol) {
      // ... (keep your existing SPL-SPL ratio check logic) ...
      const amountA = initialAmountA;
      const amountB = initialAmountB;
      if (amountA <= 0 || amountB <= 0) return { success: false, message: `Invalid initial amounts. Amounts must be positive.`, error: "InvalidAmount" };
      const userRatio = amountA / amountB;
      const targetRatio = 1;
      const allowedDeviation = 0.1;
      if (Math.abs(userRatio - targetRatio) / targetRatio > allowedDeviation) {
        return { success: false, message: `❌ Initial liquidity ratio is unbalanced for SPL-to-SPL pool. Please use a **1:1 ratio**.`, error: "InitialSplRatioImbalance" };
      }
    }
    // --- End Ratio Check ---

    // Get token info
    const tokenAInfo = await getOrCreateToken(connection, wallet, tokenASymbol, network);
    const tokenBInfo = await getOrCreateToken(connection, wallet, tokenBSymbol, network);
    if (!tokenAInfo || !tokenBInfo) throw new Error("Could not find token info.");

    const wrappedSolMint = new PublicKey("So11111111111111111111111111111111111111112");
    let mintA = tokenAIsSol ? wrappedSolMint : tokenAInfo.mint;
    let mintB = tokenBIsSol ? wrappedSolMint : tokenBInfo.mint;

    // **CRITICAL: Sort Mints**
    const [sortedMintA, sortedMintB] = [mintA, mintB].sort((a, b) =>
      a.toBuffer().compare(b.toBuffer())
    );
    console.log(` Sorted Mint A: ${sortedMintA.toBase58()}`);
    console.log(` Sorted Mint B: ${sortedMintB.toBase58()}`);

    // Derive PDAs using SORTED mints
    const { poolPda, poolAuthorityPda } = await getPoolPDAs(
      program.programId,
      sortedMintA, // Pass sorted
      sortedMintB  // Pass sorted
    );
    console.log(` Derived Pool PDA: ${poolPda.toBase58()}`);
    console.log(` Derived Pool Authority PDA: ${poolAuthorityPda.toBase58()}`);

    // Derive Vault ATAs using SORTED mints and the CORRECT authority
    const tokenAVaultATA = await getAssociatedTokenAddress(
      sortedMintA,        // Use sorted mint A
      poolAuthorityPda,   // Use correctly derived authority
      true                // Allow off-curve
    );
    const tokenBVaultATA = await getAssociatedTokenAddress(
      sortedMintB,        // Use sorted mint B
      poolAuthorityPda,   // Use correctly derived authority
      true                // Allow off-curve
    );
    console.log(` Derived Vault A ATA: ${tokenAVaultATA.toBase58()}`);
    console.log(` Derived Vault B ATA: ${tokenBVaultATA.toBase58()}`);

    // Build the InitializePool transaction
    const tx = new Transaction();

    // Use program.methods for type safety and clarity
    tx.add(
      await program.methods
        .initializePool() // No arguments needed for initializePool itself
        .accounts({
          tokenAMint: sortedMintA, // Pass SORTED mint A
          tokenBMint: sortedMintB, // Pass SORTED mint B
          pool: poolPda,
          poolAuthority: poolAuthorityPda,
          tokenAVault: tokenAVaultATA, // Pass CORRECTLY derived vault A
          tokenBVault: tokenBVaultATA, // Pass CORRECTLY derived vault B
          initializer: authority,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: web3.SYSVAR_RENT_PUBKEY,
        } as any)
        .instruction() // Get the instruction object
    );

    // Send and confirm transaction
    console.log(" Sending create pool transaction...");
    const signature = await wallet.sendTransaction(tx, connection);
    console.log(" Create pool transaction sent:", signature);

    const confirmation = await connection.confirmTransaction(signature, "confirmed");
    if (confirmation.value.err) {
      const txDetails = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0 });
      console.error("Create Pool Transaction confirmation failed:", confirmation.value.err);
      console.error("Transaction logs:", txDetails?.meta?.logMessages || "Logs not available");
      throw new Error(`Transaction confirmed but failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log("✅ Pool created successfully!");
    const explorerUrl = getExplorerLink(signature, network);

    return {
      success: true,
      message: `Successfully created liquidity pool for ${tokenASymbol}/${tokenBSymbol}. You can now add initial liquidity.`,
      signature,
      explorerUrl,
    };

  } catch (error: any) {
    console.error("💥 Failed to create liquidity pool:", error);
    let message = `Failed to create liquidity pool: ${error.message || error.toString()}`;
    const errorLogs = error?.logs as string[] | undefined;
    if (errorLogs) {
      console.error("Error Logs:", errorLogs);
      if (errorLogs.some((log: string) => log.includes("already in use") || log.includes("custom program error: 0x0"))) { // 0x0 is often account already in use
        message = `❌ Pool for ${tokenASymbol}/${tokenBSymbol} already exists. Use 'add liquidity' instead.`;
      } else if (errorLogs.some((log: string) => log.includes("insufficient lamports"))) {
        message = `❌ Failed to create pool: Insufficient SOL balance for rent/fees.`;
      }
    } else if (error.message?.includes("Transaction simulation failed")) {
      const logsMatch = error.message.match(/Logs:\s*(\[[\s\S]*\])/);
      const logsString = logsMatch ? logsMatch[1] : "[]";
      try {
        const logsArray = JSON.parse(logsString.replace(/\\"/g, '"'));
        console.error("Simulation Logs:", logsArray);
        if (logsArray.some((log: string) => log.includes("already in use") || log.includes("custom program error: 0x0"))) {
          message = `❌ Pool for ${tokenASymbol}/${tokenBSymbol} already exists. Use 'add liquidity' instead.`;
        } else if (logsArray.some((log: string) => log.includes("insufficient lamports"))) {
          message = `❌ Failed to create pool: Insufficient SOL balance for rent/fees.`;
        }
      } catch (parseError) { console.error("Failed to parse simulation logs:", parseError); }
    }
    return { success: false, message, error };
  }
}
// export async function addLiquidityToPool(
//   connection: Connection,
//   wallet: any, // Use correct type if available (e.g., AnchorWallet)
//   tokenASymbol: string,
//   tokenBSymbol: string,
//   liquidityAmountA: number,
//   liquidityAmountB: number,
//   network: "localnet" | "devnet" | "mainnet" = "localnet"
// ): Promise<{
//   success: boolean;
//   message: string;
//   signature?: string;
//   explorerUrl?: string;
// }> {
//   try {
//     const program = getProgram(connection, wallet);
//     const authority = wallet.publicKey;

//     // 1. Get Token Info (Handle SOL wrapping)
//     const tokenAInfo = await getOrCreateToken(connection, wallet, tokenASymbol, network);
//     const tokenBInfo = await getOrCreateToken(connection, wallet, tokenBSymbol, network);

//     if (!tokenAInfo || !tokenBInfo) {
//       return { success: false, message: "Failed to find token information for liquidity addition." };
//     }

//     const wrappedSolMint = new PublicKey("So11111111111111111111111111111111111111112");
//     const tokenAIsSol = tokenASymbol.toUpperCase() === 'SOL';
//     const tokenBIsSol = tokenBSymbol.toUpperCase() === 'SOL';

//     // Use original, unsorted mints based on input symbols
//     let originalMintA = tokenAIsSol ? wrappedSolMint : tokenAInfo.mint;
//     let originalMintB = tokenBIsSol ? wrappedSolMint : tokenBInfo.mint;
//     let decimalsA = tokenAInfo.decimals;
//     let decimalsB = tokenBInfo.decimals;


//     // 2. Get Pool PDAs (getPoolPDAs now handles sorting internally)
//     const { poolPda, } = await getPoolPDAs(
//       program.programId,
//       originalMintA, // Pass unsorted
//       originalMintB  // Pass unsorted
//     );

//     console.log("Fetching pool state...");
//     let poolAccount;
//     try {
//       poolAccount = await program.account.liquidityPool.fetch(poolPda);
//       console.log(` Pool State Mint A: ${poolAccount.tokenAMint.toString()}`);
//       console.log(` Pool State Mint B: ${poolAccount.tokenBMint.toString()}`);
//       console.log("Pool account fetched successfully.");
//     } catch (e) {
//       console.error("Error fetching pool account:", e);
//       return {
//         success: false,
//         message: `Liquidity pool for ${tokenASymbol}/${tokenBSymbol} not found or could not be accessed.`,
//       };
//     }

//     // 3. Derive Vault ATAs using the poolAuthorityPda and ORIGINAL (unsorted) mints
//     // const tokenAVaultATA = await getAssociatedTokenAddress(
//     //   originalMintA,    // Use original unsorted mint A
//     //   poolAuthorityPda, // Authority is the PDA derived (internally using sorted mints)
//     //   true              // Allow off-curve addresses
//     // );

//     // const [derivedPoolAuthorityPda, derivedBump] = await PublicKey.findProgramAddressSync(
//     //   [
//     //     Buffer.from("pool"),
//     //     poolAccount.tokenAMint.toBuffer(), // Use sorted mint from pool state
//     //     poolAccount.tokenBMint.toBuffer(), // Use sorted mint from pool state
//     //   ],
//     //   program.programId
//     // );

//     // let derivedPoolAuthorityPda: PublicKey;
//     // try {
//     //   derivedPoolAuthorityPda = PublicKey.createProgramAddressSync(
//     //     [
//     //       Buffer.from("pool"),
//     //       poolAccount.tokenAMint.toBuffer(), // Use sorted mint from pool state
//     //       poolAccount.tokenBMint.toBuffer(), // Use sorted mint from pool state
//     //       Buffer.from([poolAccount.bump]),   // Use the STORED bump from pool state
//     //     ],
//     //     program.programId
//     //   );
//     //   console.log("Derived pool authority PDA using stored bump:", derivedPoolAuthorityPda.toString());
//     // } catch (e) {
//     //   console.error("Failed to derive pool authority PDA using stored bump:", e);
//     //   // Fallback or re-throw might be needed depending on how critical this is
//     //   // Let's try deriving with findProgramAddressSync as a less ideal fallback, logging the issue
//     //   console.warn("Falling back to findProgramAddressSync for pool authority PDA derivation.");
//     //   [derivedPoolAuthorityPda] = await PublicKey.findProgramAddressSync(
//     //     [
//     //       Buffer.from("pool"),
//     //       poolAccount.tokenAMint.toBuffer(),
//     //       poolAccount.tokenBMint.toBuffer(),
//     //     ],
//     //     program.programId
//     //   );
//     //   console.warn("Derived pool authority PDA using findProgramAddressSync (may cause issues):", derivedPoolAuthorityPda.toString());
//     //   // It's likely the transaction will still fail if the bumps don't match, but this provides more info.
//     //   return { success: false, message: `Failed to derive correct pool authority PDA using stored bump (${poolAccount.bump}).` };
//     // }

//     const [derivedPoolAuthorityPda, derivedBump] = await PublicKey.findProgramAddressSync(
//       [
//         Buffer.from("pool"),
//         poolAccount.tokenAMint.toBuffer(), // Use sorted mint from pool state
//         poolAccount.tokenBMint.toBuffer(), // Use sorted mint from pool state
//       ],
//       program.programId
//     );
//     console.log(`Derived pool authority PDA using findProgramAddressSync (canonical bump ${derivedBump}): ${derivedPoolAuthorityPda.toString()}`);



//     // if (derivedBump !== poolAccount.bump) {
//     //   console.warn(`Derived bump (${derivedBump}) does not match stored bump (${poolAccount.bump}) for authority PDA. This might indicate an issue.`);
//     //   // Depending on program logic, you might want to throw an error here or proceed cautiously.
//     //   // For now, we'll proceed using the derived PDA.
//     // }
//     // console.log("Derived pool authority PDA using sorted state mints:", derivedPoolAuthorityPda.toString());


//     // console.log("Re-derived pool authority PDA using sorted mints:", poolAuthorityPda.toString());
//     const storedVaultA = poolAccount.tokenAVault;
//     const storedVaultB = poolAccount.tokenBVault;
//     console.log("Vault addresses stored in pool state:");
//     console.log(`  Stored Vault A: ${storedVaultA.toString()}`);
//     console.log(`  Stored Vault B: ${storedVaultB.toString()}`);

//     // Derive the expected vault ATAs based on the derived pool authority and sorted mints from state
//     const derivedVaultA = await getAssociatedTokenAddress(
//       poolAccount.tokenAMint,      // Pool's A mint (sorted)
//       derivedPoolAuthorityPda,   // Authority PDA derived using sorted mints + canonical bump
//       true                       // Allow off-curve (standard for ATAs derived with PDA)
//     );
//     const derivedVaultB = await getAssociatedTokenAddress(
//       poolAccount.tokenBMint,      // Pool's B mint (sorted)
//       derivedPoolAuthorityPda,   // Authority PDA derived using sorted mints + canonical bump
//       true                       // Allow off-curve
//     );
//     console.log("Vault addresses derived by client:");
//     console.log(`  Derived Vault A: ${derivedVaultA.toString()}`);
//     console.log(`  Derived Vault B: ${derivedVaultB.toString()}`);

//     // Compare derived vs stored (for debugging)
//     if (!derivedVaultA.equals(storedVaultA)) {
//       console.warn("MISMATCH: Derived Vault A does not match stored Vault A!");
//     }
//     if (!derivedVaultB.equals(storedVaultB)) {
//       console.warn("MISMATCH: Derived Vault B does not match stored Vault B!");
//     }
//     const tokenAVaultToUse = derivedVaultA;
//     const tokenBVaultToUse = derivedVaultB;

//     // const tokenAVaultATA = poolAccount.tokenAVault;
//     // const tokenBVaultATA = poolAccount.tokenBVault;
//     // console.log("Using vault addresses from pool state:");
//     // console.log(`Token A Vault: ${tokenAVaultATA.toString()}`);
//     // console.log(`Token B Vault: ${tokenBVaultATA.toString()}`);


//     // const tokenBVaultATA = await getAssociatedTokenAddress(
//     //   originalMintB,    // Use original unsorted mint B
//     //   poolAuthorityPda, // Authority is the PDA derived (internally using sorted mints)
//     //   true              // Allow off-curve addresses
//     // );

//     // 4. Get User's Source ATAs (Handle SOL wrapping)
//     let userSourceTokenAccountA = await getAssociatedTokenAddress(originalMintA, authority);
//     let userSourceTokenAccountB = await getAssociatedTokenAddress(originalMintB, authority);
//     const solAmountToWrap = tokenAIsSol ? liquidityAmountA : (tokenBIsSol ? liquidityAmountB : 0);
//     let wrapInstructions: TransactionInstruction[] = [];

//     let cleanupInstructions: TransactionInstruction[] = []; // Optional cleanup

//     if (solAmountToWrap > 0) {
//       console.log(`Wrapping ${solAmountToWrap} SOL for adding liquidity...`);
//       const lamportsToWrap = new BN(solAmountToWrap * LAMPORTS_PER_SOL);
//       const associatedTokenAccount = await getAssociatedTokenAddress(wrappedSolMint, authority);
//       const ataInfo = await connection.getAccountInfo(associatedTokenAccount);

//       if (!ataInfo) {
//         console.log("Creating ATA for wSOL...");
//         wrapInstructions.push(
//           createAssociatedTokenAccountInstruction(authority, associatedTokenAccount, authority, wrappedSolMint)
//         );
//       }
//       wrapInstructions.push(
//         SystemProgram.transfer({ fromPubkey: authority, toPubkey: associatedTokenAccount, lamports: lamportsToWrap.toNumber() }),
//         createSyncNativeInstruction(associatedTokenAccount)
//       );

//       // Update the source account for the main transaction
//       if (tokenAIsSol) userSourceTokenAccountA = associatedTokenAccount;
//       else if (tokenBIsSol) userSourceTokenAccountB = associatedTokenAccount;

//       // Optional: Add cleanup instruction (use with caution)
//       // cleanupInstructions.push(createCloseAccountInstruction(associatedTokenAccount, authority, authority));
//     }

//     // 5. Convert amounts to base units
//     const amountABaseUnits = new BN(liquidityAmountA * Math.pow(10, decimalsA)); // Amount for original A (DEB)
//     const amountBBaseUnits = new BN(liquidityAmountB * Math.pow(10, decimalsB)); // Amount for original B (SOL)

//     // 5.5 Determine the correct amounts and user accounts based on the pool's stored mint order
//     let finalAmountAForPool: BN;
//     let finalAmountBForPool: BN;
//     let finalUserTokenAAccountForPool: PublicKey;
//     let finalUserTokenBAccountForPool: PublicKey;

//     // Check if the original mint A matches the pool's token A mint
//     if (originalMintA.equals(poolAccount.tokenAMint)) {
//       // Order matches pool state: Pool A = Original A (DEB), Pool B = Original B (SOL)
//       // THIS IS UNLIKELY based on your logs (Pool A is SOL)
//       finalAmountAForPool = amountABaseUnits;
//       finalAmountBForPool = amountBBaseUnits;
//       finalUserTokenAAccountForPool = userSourceTokenAccountA; // User's DEB ATA
//       finalUserTokenBAccountForPool = userSourceTokenAccountB; // User's wSOL ATA
//       console.log("Pool order matches input order (A=A, B=B).");
//     } else if (originalMintA.equals(poolAccount.tokenBMint)) {
//       // Order is swapped vs pool state: Pool A = Original B (SOL), Pool B = Original A (DEB)
//       // THIS IS LIKELY based on your logs
//       finalAmountAForPool = amountBBaseUnits; // Amount for Pool's A (which is original B -> SOL amount)
//       finalAmountBForPool = amountABaseUnits; // Amount for Pool's B (which is original A -> DEB amount)
//       finalUserTokenAAccountForPool = userSourceTokenAccountB; // User's wSOL ATA (matches Pool's A Mint)
//       finalUserTokenBAccountForPool = userSourceTokenAccountA; // User's DEB ATA (matches Pool's B Mint)
//       console.log("Pool order swapped vs input order (A=B, B=A). Re-ordering accounts/amounts for instruction.");
//     } else {
//       // Should not happen if pool exists and mints are correct
//       console.error("Critical mismatch: Original mints do not match pool state mints.");
//       return { success: false, message: "Internal error: Token mint mismatch between input and pool state." };
//     }
//     // 6. Build Transaction
//     const tx = new Transaction();

//     // Add wrap instructions if any
//     if (wrapInstructions.length > 0) {
//       tx.add(...wrapInstructions);
//     }

//     // Add the AddLiquidity instruction
//     tx.add(
//       await program.methods
//         // Use amounts ordered for the pool
//         .addLiquidity(finalAmountAForPool, finalAmountBForPool)
//         .accounts({
//           pool: poolPda,
//           poolAuthority: derivedPoolAuthorityPda,
//           tokenAMint: poolAccount.tokenAMint,      // Pool's A Mint (wSOL)
//           tokenBMint: poolAccount.tokenBMint,      // Pool's B Mint (DEB)
//           tokenAVault: tokenAVaultToUse,           // Pool's A Vault (wSOL)
//           tokenBVault: tokenBVaultToUse,           // Pool's B Vault (DEB)
//           // Use user accounts ordered for the pool
//           userTokenAAccount: finalUserTokenAAccountForPool, // User account for Pool's A Mint (wSOL ATA)
//           userTokenBAccount: finalUserTokenBAccountForPool, // User account for Pool's B Mint (DEB ATA)
//           userAuthority: authority,
//           tokenProgram: TOKEN_PROGRAM_ID,
//         } as any) // Consider defining a proper type instead of 'as any' if possible
//         .instruction()
//     );

//     // Add cleanup instructions if any
//     if (cleanupInstructions.length > 0) {
//       tx.add(...cleanupInstructions);
//     }

//     // 7. Send and Confirm
//     console.log("Sending add liquidity transaction...");
//     const signature = await wallet.sendTransaction(tx, connection);
//     console.log("Add liquidity transaction sent:", signature);

//     const confirmation = await connection.confirmTransaction(signature, "confirmed");
//     if (confirmation.value.err) {
//       const txDetails = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0 });
//       console.error("Add Liquidity Transaction confirmation error details:", confirmation.value.err);
//       console.error("Transaction logs:", txDetails?.meta?.logMessages);
//       // Try to parse specific errors
//       const logs = txDetails?.meta?.logMessages || [];
//       if (logs.some(log => log.includes("Error: DisproportionateLiquidity"))) {
//         return { success: false, message: "❌ Failed to add liquidity: DisproportionateLiquidity. The amounts provided do not match the required pool ratio." };
//       }
//       if (logs.some(log => log.includes("ConstraintSeeds"))) {
//         return { success: false, message: "❌ Failed to add liquidity: Pool authority PDA mismatch (ConstraintSeeds)." };
//       }
//       throw new Error(`Transaction confirmed but failed: ${confirmation.value.err}`);
//     }

//     console.log("Liquidity added successfully!");
//     const explorerUrl = getExplorerLink(signature, network); // Use helper

//     return {
//       success: true,
//       message: `Successfully added liquidity to ${tokenASymbol}/${tokenBSymbol} pool.`,
//       signature,
//       explorerUrl,
//     };

//   } catch (error: any) {
//     console.error("Failed to add liquidity:", error);
//     let message = `Failed to add liquidity: ${error.message || error.toString()}`;
//     // Add specific error checks if needed
//     const errorLogs = error?.logs as string[] | undefined;
//     if (errorLogs) {
//       console.error("Error Logs:", errorLogs);
//       if (errorLogs.some((log: string) => log.includes("DisproportionateLiquidity"))) {
//         message = `❌ Failed to add liquidity: DisproportionateLiquidity. The amounts provided do not match the required pool ratio.`;
//       } else if (errorLogs.some((log: string) => log.includes("insufficient lamports"))) {
//         message = `❌ Failed to add liquidity: Insufficient SOL balance for fees.`;
//       } else if (errorLogs.some((log: string) => log.includes("ConstraintTokenOwner"))) {
//         message = `❌ Failed to add liquidity: Token account ownership constraint failed. Check vault/user accounts.`;
//       }
//     } else if (error.message?.includes("Attempt to debit an account but found no record of a prior credit")) {
//       message = `❌ Failed to add liquidity: Insufficient balance for one of the tokens.`;
//     }
//     return { success: false, message };
//   }
// }

export async function addLiquidityToPool(
  connection: Connection,
  wallet: WalletContextState, // Use the specific type from wallet-adapter
  tokenASymbol: string,
  tokenBSymbol: string,
  liquidityAmountA: number, // Removed default values, should be provided by caller
  liquidityAmountB: number, // Removed default values, should be provided by caller
  network: "localnet" | "devnet" | "mainnet" = "localnet"
): Promise<{
  success: boolean;
  message: string;
  signature?: string;
  explorerUrl?: string;
}> {
  try {
    // 1. Initial Checks
    if (!wallet.publicKey || !wallet.signTransaction) {
      return { success: false, message: "Wallet not connected or doesn't support signing." };
    }
    if (liquidityAmountA <= 0 || liquidityAmountB <= 0) {
      return { success: false, message: "Liquidity amounts must be positive." };
    }

    const program = getProgram(connection, wallet);
    const authority = wallet.publicKey;
    console.log(`🚀 Adding liquidity: ${liquidityAmountA} ${tokenASymbol} + ${liquidityAmountB} ${tokenBSymbol} on ${network}`);

    // 2. Get Token Info & Mints (Handle SOL)
    const tokenAInfo = await getOrCreateToken(connection, wallet, tokenASymbol, network);
    const tokenBInfo = await getOrCreateToken(connection, wallet, tokenBSymbol, network);

    if (!tokenAInfo || !tokenBInfo) {
      return { success: false, message: "Failed to find token information for liquidity addition." };
    }

    const wrappedSolMint = new PublicKey("So11111111111111111111111111111111111111112");
    const tokenAIsSol = tokenASymbol.toUpperCase() === 'SOL';
    const tokenBIsSol = tokenBSymbol.toUpperCase() === 'SOL';

    // Store original mints based on input symbols BEFORE sorting
    const originalMintA = tokenAIsSol ? wrappedSolMint : tokenAInfo.mint;
    const originalMintB = tokenBIsSol ? wrappedSolMint : tokenBInfo.mint;
    const decimalsA = tokenAInfo.decimals;
    const decimalsB = tokenBInfo.decimals;

    console.log(` Original Mint A (${tokenASymbol}): ${originalMintA.toBase58()}`);
    console.log(` Original Mint B (${tokenBSymbol}): ${originalMintB.toBase58()}`);

    // 3. Get Pool PDA (using original mints for lookup)
    // getPoolPDAs should handle internal sorting for consistent PDA derivation
    const { poolPda } = await getPoolPDAs(
      program.programId,
      originalMintA, // Pass original mint A
      originalMintB  // Pass original mint B
    );
    console.log(` Derived Pool PDA: ${poolPda.toBase58()}`);

    // 4. Fetch Pool State
    console.log(" Fetching pool state...");
    let poolAccount;
    try {
      poolAccount = await program.account.liquidityPool.fetch(poolPda);
      console.log(` Pool State Mint A: ${poolAccount.tokenAMint.toString()}`);
      console.log(` Pool State Mint B: ${poolAccount.tokenBMint.toString()}`);
      console.log(` Pool State Bump: ${poolAccount.bump}`);
      console.log(` Pool State Vault A: ${poolAccount.tokenAVault.toString()}`);
      console.log(` Pool State Vault B: ${poolAccount.tokenBVault.toString()}`);
      console.log(" Pool account fetched successfully.");
    } catch (e) {
      console.error("Error fetching pool account:", e);
      return {
        success: false,
        message: `Liquidity pool for ${tokenASymbol}/${tokenBSymbol} not found. Please create it first.`,
      };
    }

    // 5. Derive Pool Authority & Vaults using *Pool State* Mints and Canonical Bump
    // This is crucial because the program constraints use these seeds and the canonical bump.
    const [derivedPoolAuthorityPda, derivedBump] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("pool"), // Use the SAME seed as in your program's #[account(seeds = ...)]
        poolAccount.tokenAMint.toBuffer(), // Use sorted mint A from pool state
        poolAccount.tokenBMint.toBuffer(), // Use sorted mint B from pool state
      ],
      program.programId
    );
    console.log(` Derived Pool Authority PDA (using state mints, canonical bump ${derivedBump}): ${derivedPoolAuthorityPda.toString()}`);

    // Derive the expected vault ATAs based on the derived pool authority and sorted mints from state
    const derivedVaultA = await getAssociatedTokenAddress(
      poolAccount.tokenAMint,      // Pool's A mint (sorted)
      derivedPoolAuthorityPda,   // Authority PDA derived using sorted mints + canonical bump
      true                       // Allow off-curve (standard for ATAs derived with PDA owner)
    );
    const derivedVaultB = await getAssociatedTokenAddress(
      poolAccount.tokenBMint,      // Pool's B mint (sorted)
      derivedPoolAuthorityPda,   // Authority PDA derived using sorted mints + canonical bump
      true                       // Allow off-curve
    );
    console.log(" Vault addresses derived by client (using derived authority):");
    console.log(`  Derived Vault A: ${derivedVaultA.toString()}`);
    console.log(`  Derived Vault B: ${derivedVaultB.toString()}`);

    // Sanity check against stored vaults (optional, for debugging)
    if (!derivedVaultA.equals(poolAccount.tokenAVault)) {
      console.warn("WARNING: Derived Vault A does NOT match stored Vault A in pool state!");
    }
    if (!derivedVaultB.equals(poolAccount.tokenBVault)) {
      console.warn("WARNING: Derived Vault B does NOT match stored Vault B in pool state!");
    }
    // *** Use the DERIVED vaults for the instruction call ***
    const tokenAVaultToUse = derivedVaultA;
    const tokenBVaultToUse = derivedVaultB;

    // 6. Get User's Source ATAs & Handle SOL Wrapping (Atomically)
    let userSourceTokenAccountA = await getAssociatedTokenAddress(originalMintA, authority);
    let userSourceTokenAccountB = await getAssociatedTokenAddress(originalMintB, authority);
    console.log(` User Source ATA A (${tokenASymbol}): ${userSourceTokenAccountA.toBase58()}`);
    console.log(` User Source ATA B (${tokenBSymbol}): ${userSourceTokenAccountB.toBase58()}`);

    const solAmountToWrap = tokenAIsSol ? liquidityAmountA : (tokenBIsSol ? liquidityAmountB : 0);
    const instructions: TransactionInstruction[] = [];
    let wrappedSolATA: PublicKey | null = null; // Keep track if we created/used wSOL ATA

    if (solAmountToWrap > 0) {
      console.log(` Wrapping ${solAmountToWrap} SOL...`);
      const lamportsToWrap = new BN(solAmountToWrap * LAMPORTS_PER_SOL);
      wrappedSolATA = await getAssociatedTokenAddress(wrappedSolMint, authority); // wSOL ATA

      // Check if wSOL ATA exists
      let ataInfo: TokenAccount | null = null;
      try {
        ataInfo = await getAccount(connection, wrappedSolATA); // Use getAccount for robustness
        console.log(" wSOL ATA already exists.");
      } catch (error: any) {
        // Check if error is "Account not found"
        if (error.name === 'TokenAccountNotFoundError') {
          console.log(" Creating ATA for wSOL...");
          instructions.push(
            createAssociatedTokenAccountInstruction(authority, wrappedSolATA, authority, wrappedSolMint)
          );
        } else {
          // Rethrow other errors
          console.error("Error checking wSOL ATA:", error);
          throw error;
        }
      }

      // Add instructions to transfer SOL and sync
      instructions.push(
        SystemProgram.transfer({ fromPubkey: authority, toPubkey: wrappedSolATA, lamports: lamportsToWrap.toNumber() }),
        createSyncNativeInstruction(wrappedSolATA)
      );

      // Update the source account variable that will be used in the addLiquidity instruction
      if (tokenAIsSol) {
        userSourceTokenAccountA = wrappedSolATA;
        console.log(` User source for ${tokenASymbol} updated to wSOL ATA: ${userSourceTokenAccountA.toBase58()}`);
      } else { // tokenBIsSol must be true
        userSourceTokenAccountB = wrappedSolATA;
        console.log(` User source for ${tokenBSymbol} updated to wSOL ATA: ${userSourceTokenAccountB.toBase58()}`);
      }
    }

    // 7. Convert Amounts & Determine Final Order for Instruction
    const amountABaseUnits = new BN(liquidityAmountA * Math.pow(10, decimalsA)); // Amount for original A
    const amountBBaseUnits = new BN(liquidityAmountB * Math.pow(10, decimalsB)); // Amount for original B

    let finalAmountAForPool: BN;
    let finalAmountBForPool: BN;
    let finalUserTokenAAccountForPool: PublicKey;
    let finalUserTokenBAccountForPool: PublicKey;

    // Compare ORIGINAL input mint A with the POOL's state mint A
    if (originalMintA.equals(poolAccount.tokenAMint)) {
      // Order matches pool state: Pool A = Original A, Pool B = Original B
      finalAmountAForPool = amountABaseUnits;
      finalAmountBForPool = amountBBaseUnits;
      finalUserTokenAAccountForPool = userSourceTokenAccountA; // User's ATA for Original A
      finalUserTokenBAccountForPool = userSourceTokenAccountB; // User's ATA for Original B
      console.log(" Pool order matches input order (A=A, B=B). Using amounts/accounts as is.");
    } else if (originalMintA.equals(poolAccount.tokenBMint)) {
      // Order is swapped vs pool state: Pool A = Original B, Pool B = Original A
      finalAmountAForPool = amountBBaseUnits; // Amount for Pool's A (which is original B)
      finalAmountBForPool = amountABaseUnits; // Amount for Pool's B (which is original A)
      finalUserTokenAAccountForPool = userSourceTokenAccountB; // User's ATA for Original B (matches Pool's A Mint)
      finalUserTokenBAccountForPool = userSourceTokenAccountA; // User's ATA for Original A (matches Pool's B Mint)
      console.log(" Pool order swapped vs input order (A=B, B=A). Re-ordering amounts/accounts for instruction.");
    } else {
      // This should ideally not happen if pool exists and mints are correct
      console.error("CRITICAL MISMATCH: Original input mints do not match pool state mints.");
      return { success: false, message: "Internal error: Token mint mismatch between input and pool state." };
    }

    // 8. Build the Add Liquidity Transaction
    const tx = new Transaction();

    // Add wrapping instructions (if any) FIRST
    if (instructions.length > 0) {
      tx.add(...instructions);
    }

    // Add the AddLiquidity instruction
    console.log(" Adding AddLiquidity instruction...");
    console.log("  Accounts for instruction:");
    console.log(`   pool: ${poolPda.toBase58()}`);
    console.log(`   poolAuthority: ${derivedPoolAuthorityPda.toBase58()}`);
    console.log(`   tokenAMint (Pool's A): ${poolAccount.tokenAMint.toBase58()}`);
    console.log(`   tokenBMint (Pool's B): ${poolAccount.tokenBMint.toBase58()}`);
    console.log(`   tokenAVault (Pool's A): ${tokenAVaultToUse.toBase58()}`);
    console.log(`   tokenBVault (Pool's B): ${tokenBVaultToUse.toBase58()}`);
    console.log(`   userTokenAAccount (For Pool's A): ${finalUserTokenAAccountForPool.toBase58()}`);
    console.log(`   userTokenBAccount (For Pool's B): ${finalUserTokenBAccountForPool.toBase58()}`);
    console.log(`   userAuthority: ${authority.toBase58()}`);
    console.log(`  Amounts for instruction:`);
    console.log(`   amountA (Pool's A): ${finalAmountAForPool.toString()}`);
    console.log(`   amountB (Pool's B): ${finalAmountBForPool.toString()}`);

    tx.add(
      await program.methods
        .addLiquidity(finalAmountAForPool, finalAmountBForPool) // Use amounts ordered for the pool
        .accounts({
          pool: poolPda,
          poolAuthority: derivedPoolAuthorityPda, // Use the PDA derived with canonical bump
          tokenAMint: poolAccount.tokenAMint,      // Pool's A Mint (from state)
          tokenBMint: poolAccount.tokenBMint,      // Pool's B Mint (from state)
          tokenAVault: tokenAVaultToUse,           // Pool's A Vault (derived)
          tokenBVault: tokenBVaultToUse,           // Pool's B Vault (derived)
          userTokenAAccount: finalUserTokenAAccountForPool, // User account corresponding to Pool's A Mint
          userTokenBAccount: finalUserTokenBAccountForPool, // User account corresponding to Pool's B Mint
          userAuthority: authority,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .instruction()
    );

    // Optional: Add instruction to close temporary wSOL account if desired
    // Be careful with this - only close if you are sure the user doesn't need it otherwise.
    // if (wrappedSolATA && shouldCloseWSolAccount) {
    //    tx.add(createCloseAccountInstruction(wrappedSolATA, authority, authority));
    // }

    // 9. Send and Confirm Transaction
    console.log(" Sending add liquidity transaction...");
    const signature = await wallet.sendTransaction(tx, connection);
    console.log(" Transaction sent:", signature);

    console.log(" Confirming transaction...");
    const confirmation = await connection.confirmTransaction(signature, "confirmed");

    if (confirmation.value.err) {
      // Try to get logs for better error diagnosis
      const txDetails = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0 });
      console.error("Add Liquidity Transaction confirmation failed:", confirmation.value.err);
      console.error("Transaction logs:", txDetails?.meta?.logMessages || "Logs not available");

      // Parse specific errors from logs
      const logs = txDetails?.meta?.logMessages || [];
      if (logs.some(log => log.includes("Error: DisproportionateLiquidity"))) {
        return { success: false, message: "❌ Failed: DisproportionateLiquidity. Amounts don't match pool ratio." };
      }
      if (logs.some(log => log.includes("ConstraintSeeds"))) {
        // This often means the poolAuthority PDA passed didn't match what the program derived.
        // Double-check the seeds ("pool") and the mint order used for derivation.
        return { success: false, message: "❌ Failed: Pool authority PDA mismatch (ConstraintSeeds). Check derivation logic." };
      }
      if (logs.some(log => log.includes("ConstraintTokenOwner"))) {
        return { success: false, message: "❌ Failed: Token account ownership error. Check vault/user accounts." };
      }
      // Add more specific error checks based on your program's potential errors

      // Generic failure message
      throw new Error(`Transaction confirmed but failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log("✅ Liquidity added successfully!");
    const explorerUrl = getExplorerLink(signature, network);

    return {
      success: true,
      message: `Successfully added ${liquidityAmountA} ${tokenASymbol} and ${liquidityAmountB} ${tokenBSymbol} liquidity.`,
      signature,
      explorerUrl,
    };

  } catch (error: any) {
    console.error("💥 Failed to add liquidity:", error);
    let message = `Failed to add liquidity: ${error.message || error.toString()}`;

    // Attempt to parse logs from the error object itself if confirmation failed earlier
    const errorLogs = error?.logs as string[] | undefined;
    if (errorLogs) {
      console.error("Error Logs:", errorLogs);
      if (errorLogs.some((log: string) => log.includes("DisproportionateLiquidity"))) {
        message = `❌ Failed: DisproportionateLiquidity. Amounts don't match pool ratio.`;
      } else if (errorLogs.some((log: string) => log.includes("insufficient lamports"))) {
        message = `❌ Failed: Insufficient SOL balance for transaction fees.`;
      } else if (errorLogs.some((log: string) => log.includes("ConstraintTokenOwner"))) {
        message = `❌ Failed: Token account ownership error. Check vault/user accounts.`;
      } else if (errorLogs.some((log: string) => log.includes("ConstraintSeeds"))) {
        message = `❌ Failed: Pool authority PDA mismatch (ConstraintSeeds). Check derivation logic.`;
      }
    } else if (error.message?.includes("Attempt to debit an account but found no record of a prior credit")) {
      message = `❌ Failed: Insufficient balance for one of the tokens.`;
    } else if (error.message?.includes("Transaction simulation failed")) {
      // Extract logs if available within the simulation error message itself
      const logsMatch = error.message.match(/Logs:\s*(\[[\s\S]*\])/);
      const logsString = logsMatch ? logsMatch[1] : "[]";
      try {
        const logsArray = JSON.parse(logsString.replace(/\\"/g, '"')); // Handle escaped quotes
        console.error("Simulation Logs:", logsArray);
        if (logsArray.some((log: string) => log.includes("DisproportionateLiquidity"))) {
          message = `❌ Failed: DisproportionateLiquidity. Amounts don't match pool ratio.`;
        } else if (logsArray.some((log: string) => log.includes("ConstraintSeeds"))) {
          message = `❌ Failed: Pool authority PDA mismatch (ConstraintSeeds). Check derivation logic.`;
        }
        // Add other checks from simulation logs if needed
      } catch (parseError) {
        console.error("Failed to parse simulation logs:", parseError);
      }
    }

    return { success: false, message };
  }
}

function getExplorerLink(signature: string, network: string): string {
  const clusterParam = network === "mainnet" ? "" : `?cluster=${network === 'localnet' ? `custom&customUrl=${encodeURIComponent('http://localhost:8899')}` : network}`;
  return `https://explorer.solana.com/tx/${signature}${clusterParam}`;
}

export async function wrapSol(
  connection: Connection,
  wallet: WalletContextState,
  amount: number,
  network: "localnet" | "devnet" | "mainnet" = "localnet"
): Promise<{
  success: boolean;
  message: string;
  signature?: string;
}> {
  try {

    if (!wallet.connected || !wallet.publicKey) {
      return {
        success: false,
        message: "Wallet not connected",
      }
    }
    const wrappedSolMint = new PublicKey("So11111111111111111111111111111111111111112");
    const transaction = new Transaction();

    const ataAddress = await getAssociatedTokenAddress(
      wrappedSolMint,
      wallet.publicKey,
    );

    const ataInfo = await connection.getAccountInfo(ataAddress);

    if (!ataInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          ataAddress,
          wallet.publicKey,
          wrappedSolMint
        )
      );
    }

    const lamports = amount * LAMPORTS_PER_SOL;
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: ataAddress,
        lamports
      }),
    );
    transaction.add(createSyncNativeInstruction(ataAddress));

    const signature = await wallet.sendTransaction(transaction, connection);
    await connection.confirmTransaction(signature, "confirmed");

    return {
      success: true,
      message: `Successfully wrapped ${amount} SOL to wSOL`,
      signature
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message
    };
  }
}

export function normalizeTokenAmounts(
  tokenAAmount: number,
  tokenADecimals: number,
  tokenBAmount: number,
  tokenBDecimals: number,
  tokenAPrice: number = 1, // USD price of tokenA
  tokenBPrice: number = 1  // USD price of tokenB
): { normalizedAmountA: number, normalizedAmountB: number } {

  // Calculate the actual value of each token contribution
  const tokenAValue = tokenAAmount * tokenAPrice;
  const tokenBValue = tokenBAmount * tokenBPrice;

  // If values are already balanced, no adjustment needed
  if (Math.abs(tokenAValue - tokenBValue) < 0.01) {
    return { normalizedAmountA: tokenAAmount, normalizedAmountB: tokenBAmount };
  }

  // Otherwise, adjust to match value
  if (tokenAValue > tokenBValue) {
    // Keep tokenA amount, adjust tokenB to match value
    const newTokenBAmount = tokenAValue / tokenBPrice;
    return { normalizedAmountA: tokenAAmount, normalizedAmountB: newTokenBAmount };
  } else {
    // Keep tokenB amount, adjust tokenA to match value
    const newTokenAAmount = tokenBValue / tokenAPrice;
    return { normalizedAmountA: newTokenAAmount, normalizedAmountB: tokenBAmount };
  }
}

export function suggestBalancedLiquidity(
  tokenASymbol: String,
  tokenBSymbol: string,
): {
  suggestedAAmount: number,
  suggestedBAmount: number,
} {
  const tokenADecimals = tokenASymbol === "USDC" ? 6 : 9;
  const tokenBDecimals = tokenBSymbol === "USDC" ? 6 : 9;

  if (tokenADecimals === tokenBDecimals) {
    return {
      suggestedAAmount: 10,
      suggestedBAmount: 10
    }
  }

  if ((tokenASymbol === "USDC" && tokenBSymbol === "SOL") || (tokenASymbol === "SOL" && tokenBSymbol === "USDC")) {
    const solPrice = 200;

    if (tokenASymbol === "SOL") {
      return {
        suggestedAAmount: 1,
        suggestedBAmount: solPrice
      }
    } else {
      return {
        suggestedAAmount: solPrice,
        suggestedBAmount: 1
      }
    }
  }

  return {
    suggestedAAmount: 10,
    suggestedBAmount: 10
  }
}


export async function getPoolExactRatio(
  connection: Connection,
  tokenA: string,
  tokenB: string,
  network: "localnet" | "devnet" | "mainnet" = "localnet"
): Promise<{ tokenARatio: number, tokenBRatio: number, exactRatio: number, humanReadableRatio: string }> {
  try {
    const program = getProgram(connection, null);

    const tokenAInfo = await getOrCreateToken(connection, null, tokenA, network);
    const tokenBInfo = await getOrCreateToken(connection, null, tokenB, network);


    if (!tokenAInfo || !tokenBInfo) {
      throw new Error("Could not find token info");
    }

    const wrappedSolMint = new PublicKey("So11111111111111111111111111111111111111112");

    let tokenAMint = tokenA.toUpperCase() === "SOL" ? wrappedSolMint : tokenAInfo.mint;
    let tokenBMint = tokenB.toUpperCase() === "SOL" ? wrappedSolMint : tokenBInfo.mint;

    const { poolPda } = await getPoolPDAs(program.programId, tokenAMint, tokenBMint);

    const poolAccount = await program.account.liquidityPool.fetch(poolPda);

    const vaultABalance = new BN((await connection.getTokenAccountBalance(poolAccount.tokenAVault)).value.amount);
    const vaultBBalance = new BN((await connection.getTokenAccountBalance(poolAccount.tokenBVault)).value.amount);

    console.log("Vault A Balance (raw):", vaultABalance.toString()); // Log raw balances
    console.log("Vault B Balance (raw):", vaultBBalance.toString()); // Log raw balances

    // Calculate the exact ratio needed
    const exactRatio = vaultBBalance.isZero() ? 0 : Number(vaultABalance) / Number(vaultBBalance); // Avoid division by zero

    // Generate nice round numbers that match the ratio
    const gcd = vaultABalance.isZero() || vaultBBalance.isZero() ? 1 : calculateGCD(vaultABalance.toNumber(), vaultBBalance.toNumber()); // Handle zero balances

    const tokenARatio = vaultABalance.isZero() ? 0 : vaultABalance.toNumber() / gcd;
    const tokenBRatio = vaultBBalance.isZero() ? 0 : vaultBBalance.toNumber() / gcd;

    // Calculate human-readable values
    const tokenAValue = Number(vaultABalance) / Math.pow(10, tokenAInfo.decimals);
    const tokenBValue = Number(vaultBBalance) / Math.pow(10, tokenBInfo.decimals);

    console.log("Token A Value (human):", tokenAValue); // Log human-readable values
    console.log("Token B Value (human):", tokenBValue); // Log human-readable values

    // Find a simple ratio by dividing by the smaller non-zero value and rounding
    const scaleFactor = Math.min(tokenAValue > 0 ? tokenAValue : Infinity, tokenBValue > 0 ? tokenBValue : Infinity);

    // Handle cases where one or both values are zero or scaleFactor is Infinity
    let simpleRatioA = 0;
    let simpleRatioB = 0;
    let humanReadableRatio = "Ratio calculation error (zero balance?)";

    if (scaleFactor > 0 && scaleFactor !== Infinity) {
      simpleRatioA = Math.round((tokenAValue / scaleFactor) * 100) / 100;
      simpleRatioB = Math.round((tokenBValue / scaleFactor) * 100) / 100;
      humanReadableRatio = `${simpleRatioA} ${tokenA} : ${simpleRatioB} ${tokenB}`;
    } else if (tokenAValue > 0 && tokenBValue === 0) {
      humanReadableRatio = `Pool only contains ${tokenA}. Add ${tokenB} to establish a ratio.`;
    } else if (tokenBValue > 0 && tokenAValue === 0) {
      humanReadableRatio = `Pool only contains ${tokenB}. Add ${tokenA} to establish a ratio.`;
    } else {
      humanReadableRatio = `Pool appears empty. Add initial liquidity.`;
    }


    console.log("Calculated Human Readable Ratio:", humanReadableRatio); // Log the final ratio string

    return {
      tokenARatio,
      tokenBRatio,
      exactRatio,
      humanReadableRatio, // Ensure this is correctly assigned
    };
  } catch (error: any) {
    console.error("Error getting pool ratio:", error);
    // Rethrow or return a specific error structure if needed
    // For now, let's return a default error state
    return {
      tokenARatio: 0,
      tokenBRatio: 0,
      exactRatio: 0,
      humanReadableRatio: `Error fetching ratio: ${error.message}`
    };
  }
}

// Helper function to calculate Greatest Common Divisor
function calculateGCD(a: number, b: number): number {
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}