// src/services/solana-service.ts
import { PublicKey, Transaction, Connection } from '@solana/web3.js';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Web3ForDummies } from '../public/idl/types/web3_for_dummies';
import idl from '../public/idl/web3_for_dummies.json'; // Import your IDL JSON
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
    if (tokenUpperCase === 'SOL' && !LOCALNET_TOKENS.SOL) {
      // Create a simple SOL transfer transaction
      const transaction = new Transaction().add(
        web3.SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: new PublicKey(recipient),
          lamports: amount * web3.LAMPORTS_PER_SOL
        })
      );
      
      // Sign and send transaction
      const signature = await wallet.sendTransaction(transaction, networkConnection);
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
        message: `Successfully sent ${amount} SOL to ${recipient.substring(0, 8)}...`
      };
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
    const networkConnection = new Connection(networkUrl, "confirmed")

    const tokenUpperCase = token.toUpperCase();

    if (tokenUpperCase === 'SOL') {
      const balance = await networkConnection.getBalance(wallet.publicKey);
      const solBalance = balance / web3.LAMPORTS_PER_SOL;

      return{
        success: true,
        balance: solBalance,
        token: 'SOL',
        network,
        message: `Your ${network} wallet balance is ${solBalance.toFixed(7)} SOL`
      };
    }

    const tokenMint = LOCALNET_TOKENS[tokenUpperCase];
    if (!tokenMint) {
      throw new Error(`Token ${token} not supported on localnet`);
    }
    
    // Get the token account address
    const tokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      wallet.publicKey
    );
    
    try {
      // Get the token account info
      const accountInfo = await connection.getAccountInfo(tokenAccount);
      
      if (!accountInfo) {
        return {
          success: true,
          balance: 0,
          token: tokenUpperCase,
          network,
          message: `Your wallet doesn't have any ${tokenUpperCase} tokens`
        };
      }
      
      // Parse the account data
      // For a full implementation, you'd need to properly decode the token account data
      // This is a simplification
      const decimals = tokenUpperCase === 'USDC' ? 6 : 9;
      const rawBalance = 0; // Replace with actual parsing of account data
      const tokenBalance = rawBalance / Math.pow(10, decimals);
      
      return {
        success: true,
        balance: tokenBalance,
        token: tokenUpperCase,
        network,
        message: `Your wallet balance is ${tokenBalance.toFixed(decimals)} ${tokenUpperCase}`
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