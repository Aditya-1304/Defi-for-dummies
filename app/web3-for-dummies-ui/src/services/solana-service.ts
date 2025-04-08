// src/services/solana-service.ts
import { PublicKey, Transaction, Connection } from '@solana/web3.js';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Web3ForDummies } from '../public/idl/types/web3_for_dummies';
import idl from '../public/idl/web3_for_dummies.json'; // Import your IDL JSON
import { getOrCreateToken, getTokenBalance, transferToken, mintMoreTokens, tokenCache } from './tokens-service';

const IDL = idl;

// For localnet, you'll likely be using fake tokens
// We'll either use the actual mint address from your local deployment
// or default to SOL transfers when needed
const LOCALNET_TOKENS: Record<string, PublicKey | null> = {
  // Update these with your locally deployed token mints
  USDC: new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"), // Example local USDC-like token
  SOL: null // null means native SOL
};

// Your program ID should match the one in Anchor.toml
const PROGRAM_ID = new PublicKey("B53vYkHSs1vMQzofYfKjz6Unzv8P4TwCcvvTbMWVnctv");

// Localnet URL (default Solana validator URL when running locally)
const LOCALNET_URL=  "http://localhost:8899";

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
//     if (tokenUpperCase === 'SOL') {
//       console.log(`Creating SOL transfer on ${network}...`);
      
//       try {
//         // Create a transaction with explicit blockhash handling
//         const transaction = new web3.Transaction();
        
//         // Get a recent blockhash
//         const blockhashObj = await networkConnection.getLatestBlockhash('confirmed');
//         transaction.recentBlockhash = blockhashObj.blockhash;
//         transaction.feePayer = wallet.publicKey;
        
//         // Add the transfer instruction
//         transaction.add(
//           web3.SystemProgram.transfer({
//             fromPubkey: wallet.publicKey,
//             toPubkey: new web3.PublicKey(recipient),
//             lamports: amount * web3.LAMPORTS_PER_SOL
//           })
//         );
        
//         // Sign and send transaction
//         console.log(`Sending ${amount} SOL to ${recipient} on ${network}...`);
//         const signature = await wallet.sendTransaction(transaction, networkConnection);
        
//         console.log("Confirming SOL transaction...");
//         // Use blockhashObj for better confirmation tracking
//         await networkConnection.confirmTransaction({
//           signature,
//           blockhash: blockhashObj.blockhash,
//           lastValidBlockHeight: blockhashObj.lastValidBlockHeight
//         }, 'confirmed');
        
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
//       } catch (error: any) {
//         console.error("SOL transfer error:", error);
        
//         // Provide better error messages
//         let errorMessage = error.message;
//         if (error.message && error.message.includes("Blockhash not found")) {
//           errorMessage = `Network synchronization issue on ${network}. Try again in a few moments.`;
//         } else if (error.message && error.message.includes("insufficient funds")) {
//           errorMessage = `Insufficient funds to complete this transaction on ${network}.`;
//         }
        
//         return {
//           success: false,
//           error: error.message,
//           message: `Failed to send SOL: ${errorMessage}`
//         };
//       }
//     } else if (tokenUpperCase !== 'SOL' && tokenCache[network][tokenUpperCase]) {
//       // Handle token transfers using the token service
//       console.log(`Transferring ${amount} ${tokenUpperCase} tokens to ${recipient}`);
      
//       try {
//         const signature = await transferToken(
//           networkConnection,
//           wallet,
//           recipient,
//           amount,
//           tokenUpperCase,
//           network,
//         );

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
//           message: `Successfully sent ${amount} ${tokenUpperCase} to ${recipient.substring(0, 8)}...on ${network}`
//         }
//       } catch (error : any) {
//         console.error("Token transfer error:", error);
//         return {
//           success: false,
//           error: error.message,
//           message: `Failed to send ${tokenUpperCase}: ${error.message}`
//         }
//       }
//     } else {
//       // Fall back to using the program-based token transfer for LOCALNET_TOKENS
//       console.log(`Using program-based transfer for ${tokenUpperCase}`);
      
//       // Token transfers (for USDC etc.)
//       // Get token mint address based on the token type
//       const tokenMint = LOCALNET_TOKENS[tokenUpperCase] || 
//                         new PublicKey(token);
      
//       // Create program instance using localnet connection
//       const provider = new AnchorProvider(
//         networkConnection,
//         wallet,
//         { commitment: 'confirmed' }
//       );
      
//       const program = new Program<Web3ForDummies>(IDL, provider);
      
//       // Get token accounts
//       const senderTokenAccount = await getAssociatedTokenAddress(
//         tokenMint,
//         wallet.publicKey
//       );
      
//       const recipientPubkey = new PublicKey(recipient);
//       const recipientTokenAccount = await getAssociatedTokenAddress(
//         tokenMint,
//         recipientPubkey
//       );
      
//       // Check if recipient token account exists, if not create it
//       let transaction = new Transaction();
//       try {
//         await networkConnection.getAccountInfo(recipientTokenAccount);
//       } catch (error) {
//         // Add instruction to create recipient token account if it doesn't exist
//         transaction.add(
//           createAssociatedTokenAccountInstruction(
//             wallet.publicKey,
//             recipientTokenAccount,
//             recipientPubkey,
//             tokenMint
//           )
//         );
//       }
      
//       // Convert amount to blockchain format with decimals
//       const decimals = tokenUpperCase === 'USDC' ? 6 : 9;
//       const amountBN = new BN(amount * Math.pow(10, decimals));
      
//       // Build the transaction for token transfer
//       const transferTx = await program.methods
//         .processTransaction(amountBN)
//         .accounts({
//           authority: wallet.publicKey,
//           senderTokenAccount: senderTokenAccount,
//           senderTokenAccountMint: tokenMint,
//           receiverTokenAccount: recipientTokenAccount,
//           tokenProgram: TOKEN_PROGRAM_ID,
//         })
//         .transaction();
      
//       // Add the transfer instructions to our transaction
//       transaction.add(transferTx);
      
//       // Sign and send transaction
//       console.log(`Sending ${tokenUpperCase} transaction to ${network}...`);
//       const signature = await wallet.sendTransaction(transaction, networkConnection);
      
//       console.log("Confirming transaction...");
//       await networkConnection.confirmTransaction(signature, 'confirmed');
      
//       let explorerUrl;
      
//         if (network === "localnet"){
//           explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`;
//         }else if (network === "devnet") {
//           explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
//         }else if (network === "mainnet") {
//           explorerUrl = `https://explorer.solana.com/tx/${signature}`;
//         }

//       return {
//         success: true,
//         signature,
//         explorerUrl,
//         network,
//         message: `Successfully sent ${amount} ${token} to ${recipient.substring(0, 8)}...on ${network}`
//       };
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

export async function executePayment(
  connection: web3.Connection,
  wallet: any, 
  recipient: string, 
  amount: number, 
  token: string = 'SOL',
  network: "localnet" | "devnet" | "mainnet" = "localnet",
) {
  try {
    if (!wallet.publicKey) throw new Error("Wallet not connected");

    if (network === "mainnet") {
      return {
        success: false,
        error: "Mainnet transactions unavailable",
        message: "Mainnet transactions are unavailable in demo mode. Please use devnet or localnet."
      }
    }
    
    const networkUrl = NETWORK_URLS[network];
    const networkConnection = new Connection(networkUrl, "confirmed")  
    console.log(`💸 Executing payment on ${network} network`);
    
    const tokenUpperCase = token.toUpperCase();
    
    // Handle SOL transfers differently (they don't use token accounts)
    if (tokenUpperCase === 'SOL' && !LOCALNET_TOKENS.SOL) {
      
      console.log(`Creating SOL transfer on ${network} with connection endpoint: ${networkConnection.rpcEndpoint}`);
  
      try {
        // Create a simple transfer instruction
        const transferInstruction = web3.SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: new PublicKey(recipient),
          lamports: amount * web3.LAMPORTS_PER_SOL
        });
    
        // Get the latest blockhash using the SAME connection object
        const { blockhash, lastValidBlockHeight } = await networkConnection.getLatestBlockhash();
        console.log(`Got blockhash: ${blockhash} from network: ${network}`);
        
        // Create transaction and add our transfer instruction
        const transaction = new Transaction();
        transaction.add(transferInstruction);
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
        
        // Have the wallet sign the transaction
        const signedTransaction = await wallet.signTransaction(transaction);
        console.log("Transaction signed successfully");
        
        // Now send the signed transaction with our connection
        const signature = await networkConnection.sendRawTransaction(signedTransaction.serialize());
        console.log("Raw transaction sent with signature:", signature);
        
        // Wait for confirmation
        console.log("Waiting for confirmation...");
        const confirmation = await networkConnection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        });
        
        if (confirmation.value.err) {
          throw new Error(`Transaction confirmed but failed: ${confirmation.value.err.toString()}`);
        }
        
        console.log("Transaction confirmed successfully!");
        
        // Create explorer URL
        let explorerUrl;
        if (network === "localnet") {
          explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`;
        } else if (network === "devnet") {
          explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
        } else if (network === "mainnet") {
          explorerUrl = `https://explorer.solana.com/tx/${signature}`;
        }
        
        return {
          success: true,
          signature,
          explorerUrl,
          network,
          message: `Successfully sent ${amount} SOL to ${recipient.substring(0, 8)}...on ${network}`
        };
    } catch (error) {
      console.error("Transaction error:", error);

      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const logs = (error as any)?.logs || [];
      
      return {
        success: false,
        error: errorMessage,
        message: `Transaction failed on ${network}. ${errorMessage}${logs}`
      }
    }
    }
    
    // Token transfers (for USDC etc.)
    // Get token mint address based on the token type
    const tokenMint = LOCALNET_TOKENS[tokenUpperCase] || 
                      (tokenUpperCase === 'SOL' ? null : new PublicKey(token));
    
    if (!tokenMint) {
      throw new Error(`Token ${token} not supported on localnet`);
    }
    
    // Create program instance using localnet connection
    const provider = new AnchorProvider(
      networkConnection,
      wallet,
      { commitment: 'confirmed' }
    );
    
    const program = new Program<Web3ForDummies>(IDL, provider);
    
    // Get token accounts
    const senderTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      wallet.publicKey
    );
    
    const recipientPubkey = new PublicKey(recipient);
    const recipientTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      recipientPubkey
    );
    
    // Check if recipient token account exists, if not create it
    let transaction = new Transaction();
    try {
      await networkConnection.getAccountInfo(recipientTokenAccount);
    } catch (error) {
      // Add instruction to create recipient token account if it doesn't exist
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          recipientTokenAccount,
          recipientPubkey,
          tokenMint
        )
      );
    }
    
    // Convert amount to blockchain format with decimals (USDC has 6 decimals)
    const decimals = tokenUpperCase === 'USDC' ? 6 : 9;
    const amountBN = new BN(amount * Math.pow(10, decimals));
    
    // Build the transaction for token transfer
    const transferTx = await program.methods
      .processTransaction(amountBN)
      .accounts({
        authority: wallet.publicKey,
        senderTokenAccount: senderTokenAccount,
        senderTokenAccountMint: tokenMint,
        receiverTokenAccount: recipientTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
    
    // Add the transfer instructions to our transaction
    transaction.add(transferTx);
    
    // Sign and send transaction
    console.log("Sending transaction to localnet...");
    const signature = await wallet.sendTransaction(transaction, networkConnection);
    
    console.log("Confirming transaction...");
    await networkConnection.confirmTransaction(signature, 'confirmed');
    
    let explorerUrl;
    
      if (network === "localnet"){
        explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`;
      }else if (network === "devnet") {
        explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
      }else if (network === "mainnet") {
        explorerUrl = `https://explorer.solana.com/tx/${signature}`;
      }

    return {
      success: true,
      signature,
      explorerUrl,
      network,
      message: `Successfully sent ${amount} ${token} to ${recipient.substring(0, 8)}...`
    };
  } catch (error: any) {
    console.error("Payment execution error:", error);
    return {
      success: false,
      error: error.message,
      message: `Failed to send payment: ${error.message}`
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
    if(!wallet.publicKey) throw new Error("wallet not connected");

    console.log(`🌐 Getting balance on ${network} network`);

    if (network === "mainnet") {
      // Inform user about mainnet limitations
      return {
        success: true,
        balance: 0,
        token: token.toUpperCase(),
        network,
        message: `Mainnet balance check is not available in demo mode. Please use devnet or localnet.`
      };
    }

    const networkUrl = NETWORK_URLS[network];
    const networkConnection = new Connection(networkUrl, "confirmed");
    const tokenUpperCase = token.toUpperCase();

    if (tokenUpperCase === 'SOL') {
      // SOL balance check
      const balance = await networkConnection.getBalance(wallet.publicKey);
      const solBalance = balance / web3.LAMPORTS_PER_SOL;

      return {
        success: true,
        balance: solBalance,
        token: 'SOL',
        network,
        message: `Your ${network} wallet balance is ${solBalance.toFixed(7)} SOL`
      };
    } else if (tokenCache[network] && tokenCache[network][tokenUpperCase]) {
      // Token balance using token service - already cached token
      try {
        const { balance, decimals } = await getTokenBalance(
          networkConnection,
          wallet,
          tokenUpperCase,
          network
        );

        return {
          success: true,
          balance,
          token: tokenUpperCase,
          network,
          message: `Your ${network} wallet balance is ${balance.toFixed(decimals)} ${tokenUpperCase}`
        };
      } catch (error: any) {
        console.error(`Failed to get ${tokenUpperCase} balance:`, error);
        return {
          success: false,
          error: error.message,
          message: `Failed to get ${tokenUpperCase} balance: ${error.message}`
        };
      }
    } else if (LOCALNET_TOKENS[tokenUpperCase]) {
      // Check balance for predefined local token
      const tokenMint = LOCALNET_TOKENS[tokenUpperCase];
      
      // Get the token account address
      const tokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        wallet.publicKey
      );
      
      try {
        // Get the token account info
        const accountInfo = await networkConnection.getAccountInfo(tokenAccount);
        
        if (!accountInfo) {
          return {
            success: true,
            balance: 0,
            token: tokenUpperCase,
            network,
            message: `Your wallet doesn't have any ${tokenUpperCase} tokens`
          };
        }
        
        // Parse the account data properly
        const tokenBalance = await networkConnection.getTokenAccountBalance(tokenAccount);
        const balance = tokenBalance.value.uiAmount || 0;
        const decimals = tokenBalance.value.decimals;
        
        return {
          success: true,
          balance,
          token: tokenUpperCase,
          network,
          message: `Your wallet balance is ${balance.toFixed(decimals)} ${tokenUpperCase}`
        };
      } catch (error) {
        // Token account might not exist
        return {
          success: true,
          balance: 0,
          token: tokenUpperCase,
          network,
          message: `Your wallet doesn't have any ${tokenUpperCase} tokens`
        };
      }
    } else {
      // Unknown token
      return {
        success: false,
        error: `Unknown token ${tokenUpperCase}`,
        network,
        message: `Token ${tokenUpperCase} not supported on ${network}`
      };
    }
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

export async function getAllWalletBalances(
  connection: web3.Connection,
  wallet: any,
  network: "localnet" | "devnet" | "mainnet" = "localnet",
  options: { initialOnly: false}
) {
  try {
    if (!wallet.publicKey) throw new Error("Wallet not connected");
    
    console.log(`🌐 Getting all balances on ${network} network`);
    
    if (network === "mainnet") {
      return {
        success: false,
        error: "Mainnet balance checks unavailable",
        message: "Mainnet balance checks are unavailable in demo mode. Please use devnet or localnet."
      };
    }
    
    const networkUrl = NETWORK_URLS[network];
    const networkConnection = new Connection(networkUrl, "confirmed");
    
    
    // Start with SOL balance
    const solBalance = await networkConnection.getBalance(wallet.publicKey);
    const solBalanceInSOL = solBalance / web3.LAMPORTS_PER_SOL;
    
    const initialBalances = [
      {
        token: 'SOL',
        balance: solBalanceInSOL,
        decimals: 9
      }
    ];
    
    if (options.initialOnly) {
      return {
        success: true,
        balances: initialBalances,
        network,
        isPartial: true,
        message: `Your ${network} wallet has ${solBalanceInSOL.toFixed(7)} SOL`
      };
    }
    
    const tokenAddresses = [];
    const balances = [...initialBalances];

    // Get balances for all cached tokens in this network
    const tokenSymbols = Object.keys(tokenCache[network] || {});
    
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

    const tokenInfos = await networkConnection.getMultipleAccountsInfo(tokenAddresses);
    
    for (let i = 0; i < tokenAddresses.length; i++) {
      const tokenAddress = tokenAddresses[i];
      const accountInfo = tokenInfos[i];
      const symbol = tokenSymbols[i];
      
      if (accountInfo) {
        try {
          // Process the account info directly instead of making another request
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

    // Format the message
    const tokens = balances.map(b => 
      `${b.balance.toFixed(b.token === 'SOL' ? 7 : 2)} ${b.token}`
    );
    
    let message;
    if (balances.length > 1) {
      message = `Your ${network} wallet balances:\n• ${tokens.join('\n• ')}`;
    } else if (balances.length === 1) {
      message = `Your ${network} wallet has ${tokens[0]}`;
    } else {
      message = `Your ${network} wallet has no tokens`;
    }
    
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
