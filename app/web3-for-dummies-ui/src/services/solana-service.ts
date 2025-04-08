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

const NETWORK_URLS = {
  localnet: "http://localhost:8899",
  devnet: "https://api.devnet.solana.com",
  mainnet: "https://solana-mainnet.rpc.extrnode.com"
}

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
    if (tokenUpperCase === 'SOL') {
      // SOL transfer code remains the same
      console.log(`Creating SOL transfer on ${network}...`);
      // ... existing SOL transfer code ...
    } else if (tokenUpperCase !== 'SOL' && tokenCache[network][tokenUpperCase]) {
      // Handle token transfers using the token service
      console.log(`Transferring ${amount} ${tokenUpperCase} tokens to ${recipient}`);
      
      try {
        const signature = await transferToken(
          networkConnection,
          wallet,
          recipient,
          amount,
          tokenUpperCase,
          network,
        );

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
          message: `Successfully sent ${amount} ${tokenUpperCase} to ${recipient.substring(0, 8)}...on ${network}`
        }
      } catch (error : any) {
        console.error("Token transfer error:", error);
        return {
          success: false,
          error: error.message,
          message: `Failed to send ${tokenUpperCase}: ${error.message}`
        }
      }
    } else {
      // Fall back to using the program-based token transfer for LOCALNET_TOKENS
      console.log(`Using program-based transfer for ${tokenUpperCase}`);
      
      // Token transfers (for USDC etc.)
      // Get token mint address based on the token type
      const tokenMint = LOCALNET_TOKENS[tokenUpperCase] || 
                        new PublicKey(token);
      
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
      
      // Convert amount to blockchain format with decimals
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
      console.log(`Sending ${tokenUpperCase} transaction to ${network}...`);
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
        message: `Successfully sent ${amount} ${token} to ${recipient.substring(0, 8)}...on ${network}`
      };
    }
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
  network: "localnet" | "devnet" | "mainnet" = "localnet"
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
    
    const balances = [
      {
        token: 'SOL',
        balance: solBalanceInSOL,
        decimals: 9
      }
    ];
    
    // Get balances for all cached tokens in this network
    const tokenSymbols = Object.keys(tokenCache[network] || {});
    
    for (const symbol of tokenSymbols) {
      try {
        const { balance, decimals } = await getTokenBalance(
          networkConnection,
          wallet,
          symbol,
          network
        );
        
        // Always include tokens that exist in our cache, even with zero balance
        balances.push({
          token: symbol,
          balance,
          decimals
        });
      } catch (error) {
        console.warn(`Failed to get balance for ${symbol}:`, error);
        // Continue to the next token
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