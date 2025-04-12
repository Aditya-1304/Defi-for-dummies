// src/services/solana-service.ts
import { PublicKey, Transaction, Connection, Keypair, SystemProgram } from '@solana/web3.js';
import {  web3,  } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, MintLayout, createTransferInstruction } from '@solana/spl-token';
import idl from '../public/idl/web3_for_dummies.json'; // Import your IDL JSON
import { getOrCreateToken, mintMoreTokens, tokenCache, KNOWN_TOKENS } from './tokens-service';

import * as spl from '@solana/spl-token';



const IDL = idl;

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
const LOCALNET_URL=  "http://localhost:8899";
// Local function to update token cache
function setTokenInCache(symbol: string, tokenInfo: {mint: PublicKey, decimals: number}, network: "localnet" | "devnet" | "mainnet"): void {
  if (!tokenCache[network]) tokenCache[network] = {};
  tokenCache[network][symbol] = {
    ...tokenInfo,
    symbol
  };
}

// Local function to persist token mappings to localStorage
function saveTokenMappingsToLocalStorage(mappings: any, network: string, ): void {
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
        console.log(`Getting latest blockhash for ${network}, attempt ${6-retries}...`);
        // Use finalized for devnet for better stability
        const commitment = network === "devnet" ? 'finalized' : 'confirmed';
        const blockhashData = await networkConnection.getLatestBlockhash(commitment);
        blockhash = blockhashData.blockhash;
        
        console.log(`Got blockhash: ${blockhash.substring(0, 10)}...`);
        if (blockhash) break;
      } catch (err) {
        console.log(`Error getting blockhash, retrying... (${retries-1} attempts left)`);
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
    const tokens = await fetchUserTokens(connection, wallet.publicKey, network,{ hideUnknown: false });
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
    if(!wallet.publicKey) throw new Error("Wallet not connected");
    
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
        const decimals = tokenSymbol.includes('USDC') ? 6 : 9;
        
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
        }as any;
        
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
  options: { initialOnly?: boolean} = {}
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
    const tokens = await fetchUserTokens(connection, wallet.publicKey, network,{ hideUnknown: false });
    
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
  }}

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
): Promise<{mint: PublicKey, decimals: number} | null> {
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
): Promise<{mint: PublicKey, decimals: number} | null> {
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
  tokenInfo: {mint: PublicKey, decimals: number},
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
    const updatedMappings: Record<string, {symbol: string, decimals: number}> = {};
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