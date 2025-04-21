import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { BN } from "@coral-xyz/anchor"
import { WalletContextState } from '@solana/wallet-adapter-react';
import { getOrCreateToken } from './tokens-service';
import { executePoolSwap, getPoolPDAs, getProgram } from './solana-service';
import { createAssociatedTokenAccountInstruction, createCloseAccountInstruction, createSyncNativeInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';

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
    console.log(`[getSwapQuote] Getting swap quote: ${amountIn} ${fromTokenSymbol} -> ${toTokenSymbol}`);


    const fromTokenInfo = await getOrCreateToken(connection, wallet, fromTokenSymbol, network)

    const toTokenInfo = await getOrCreateToken(connection, wallet, toTokenSymbol, network)

    if (!fromTokenInfo || !toTokenInfo) {
      console.error("[getSwapQuote] Failed to get token info for one or both tokens.");

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

    console.log(`[getSwapQuote] From Mint: ${fromTokenInfo.mint.toBase58()}, To Mint: ${toTokenInfo.mint.toBase58()}`);

    const program = getProgram(connection, wallet);
    console.log(`[getSwapQuote] Using Program ID: ${program.programId.toBase58()}`);

    try {
      let poolPda: PublicKey;
      const pdaResult = await getPoolPDAs(
        program.programId,
        fromTokenInfo.mint,
        toTokenInfo.mint,
      );
      poolPda = pdaResult.poolPda;
      console.log(`[getSwapQuote] Derived Pool PDA: ${poolPda.toBase58()}`);
      console.log(`[getSwapQuote] Derived Pool Authority PDA: ${pdaResult.poolAuthorityPda.toBase58()}`);
      console.log(`[getSwapQuote] From Token Mint: ${fromTokenInfo.mint.toBase58()}`);
      console.log(`[getSwapQuote] To Token Mint: ${toTokenInfo.mint.toBase58()}`);
      console.log(`[getSwapQuote] From Token Symbol: ${fromTokenSymbol}`);
      console.log(`[getSwapQuote] To Token Symbol: ${toTokenSymbol}`);
      console.log(`[getSwapQuote] Amount In: ${amountIn}`);
      console.log(`[getSwapQuote] From Token Decimals: ${fromTokenInfo.decimals}`);
      console.log(`[getSwapQuote] To Token Decimals: ${toTokenInfo.decimals}`);
      console.log(`[getSwapQuote] Network: ${network}`);

      let poolAccount: any;
      try {
        console.log(`[getSwapQuote] Attempting manual getAccountInfo for ${poolPda.toBase58()}...`);
        const manualAccountInfo = await connection.getAccountInfo(poolPda);
        if (!manualAccountInfo) {
          console.error(`[getSwapQuote] MANUAL FETCH FAILED: Account ${poolPda.toBase58()} not found via connection.`);
          // Even if manual fails, let Anchor try, but log it.
        } else {
          console.log(`[getSwapQuote] MANUAL FETCH SUCCEEDED: Owner ${manualAccountInfo.owner.toBase58()}, Length ${manualAccountInfo.data.length}`);
          // Check owner - should be the swap program ID
          if (!manualAccountInfo.owner.equals(program.programId)) {
            console.warn(`[getSwapQuote] MANUAL FETCH WARNING: Pool account owner (${manualAccountInfo.owner.toBase58()}) does NOT match program ID (${program.programId.toBase58()})!`);
          }
        }
        console.log(`[getSwapQuote] Attempting Anchor fetch: program.account.liquidityPool.fetch(${poolPda.toBase58()})`);
        poolAccount = await program.account.liquidityPool.fetch(poolPda);
        console.log("[getSwapQuote] Anchor fetch SUCCEEDED.");

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

    } catch (fetchError: any) {
      console.error("[getSwapQuote] ANCHOR FETCH FAILED:", fetchError);
      console.error("[getSwapQuote] Anchor Fetch Error Name:", fetchError.name);
      console.error("[getSwapQuote] Anchor Fetch Error Message:", fetchError.message);
      // Log stack trace if available
      if (fetchError.stack) {
        console.error("[getSwapQuote] Anchor Fetch Stack Trace:", fetchError.stack);
      }
      // *** END LOGGING ***

      // Check if the error indicates the account doesn't exist (common case)
      const errorString = String(fetchError.message || fetchError.toString()).toLowerCase();
      if (errorString.includes("account does not exist") || errorString.includes("could not find account") || errorString.includes("account not found")) {
        console.log("[getSwapQuote] Anchor fetch failed specifically because account not found. Returning needsPoolCreation: true");
        return {
          /* ... needsPoolCreation response ... */
          success: false,
          message: `No liquidity pool exists for ${fromTokenSymbol}/${toTokenSymbol}. (Fetch failed: Account not found)`,
          needsPoolCreation: true,
          // Include other fields as needed
          fromToken: { symbol: fromTokenSymbol, decimals: fromTokenInfo.decimals, mint: fromTokenInfo.mint.toString() },
          toToken: { symbol: toTokenSymbol, decimals: toTokenInfo.decimals, mint: toTokenInfo.mint.toString() },
          inputAmount: amountIn, expectedOutputAmount: 0, minOutputAmount: 0, priceImpactBps: 0,
        };
      } else {
        // Handle other fetch errors (e.g., deserialization, RPC issues)
        console.log("[getSwapQuote] Anchor fetch failed for reason other than 'account not found'.");
        return {
          /* ... generic error response ... */
          success: false,
          message: `Error fetching pool state: ${fetchError.message || 'Unknown fetch error'}`,
          // Include other fields as needed
          fromToken: { symbol: fromTokenSymbol, decimals: fromTokenInfo.decimals, mint: fromTokenInfo.mint.toString() },
          toToken: { symbol: toTokenSymbol, decimals: toTokenInfo.decimals, mint: toTokenInfo.mint.toString() },
          inputAmount: amountIn, expectedOutputAmount: 0, minOutputAmount: 0, priceImpactBps: 0,
        };
      }
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
  wallet: any, // Use correct type
  fromTokenSymbol: string,
  toTokenSymbol: string,
  amountIn: number,
  slippageBps: number = 50, // Basis points (e.g., 50 = 0.5%)
  network: "localnet" | "devnet" | "mainnet" = "localnet"
): Promise<{
  success: boolean;
  message: string;
  signature?: string;
  explorerUrl?: string;
  outputAmount?: number; // Actual output amount
}> {

  console.log(`[executeSwap] Initiating swap: ${amountIn} ${fromTokenSymbol} -> ${toTokenSymbol}`);
  if (!wallet.publicKey || !wallet.signTransaction) {
    return { success: false, message: "Wallet not connected or does not support signing" };
  }
  try {
    const program = getProgram(connection, wallet);
    const authority = wallet.publicKey;

    // 1. Get Token Info (Handle SOL)
    const fromTokenInfo = await getOrCreateToken(connection, wallet, fromTokenSymbol, network);
    const toTokenInfo = await getOrCreateToken(connection, wallet, toTokenSymbol, network);

    if (!fromTokenInfo || !toTokenInfo) {
      return { success: false, message: "Failed to find token information for swap." };
    }

    const wrappedSolMint = new PublicKey("So11111111111111111111111111111111111111112");
    const fromIsSol = fromTokenSymbol.toUpperCase() === 'SOL';
    const toIsSol = toTokenSymbol.toUpperCase() === 'SOL';

    let fromMint = fromIsSol ? wrappedSolMint : fromTokenInfo.mint;
    let toMint = toIsSol ? wrappedSolMint : toTokenInfo.mint;
    let fromDecimals = fromTokenInfo.decimals;
    let toDecimals = toTokenInfo.decimals;

    // 2. Get Pool PDAs (getPoolPDAs sorts internally)
    // Pass the mints corresponding to the pool pair (order doesn't matter here)
    const { poolPda, poolAuthorityPda } = await getPoolPDAs(
      program.programId,
      fromMint, // Order doesn't matter for getPoolPDAs now
      toMint
    );

    // 3. Derive Vault ATAs using poolAuthorityPda and the correct mints for the pool pair
    // We need to know which mint corresponds to Vault A and Vault B in the pool state.
    // Fetch pool state or assume consistent ordering based on how initializePool stored them.
    // Let's ASSUME initializePool stored them sorted.
    const [sortedMintA, sortedMintB] = [fromMint, toMint].sort((a, b) => a.toBuffer().compare(b.toBuffer()));

    const tokenAVaultATA = await getAssociatedTokenAddress(
      sortedMintA,      // Use sorted mint A
      poolAuthorityPda,
      true
    );
    const tokenBVaultATA = await getAssociatedTokenAddress(
      sortedMintB,      // Use sorted mint B
      poolAuthorityPda,
      true
    );

    // 4. Get User ATAs (Handle SOL wrapping/unwrapping - simplified here)
    // NOTE: Proper SOL handling for swaps is more complex (wrap before, unwrap after)
    // This example assumes user already has wSOL if swapping from SOL.
    const userSourceTokenAccount = await getAssociatedTokenAddress(fromMint, authority);
    const userDestinationTokenAccount = await getAssociatedTokenAddress(toMint, authority);
    // TODO: Add ATA creation check/instruction for destination if it doesn't exist

    // 5. Calculate amounts
    const amountInBaseUnits = new BN(amountIn * Math.pow(10, fromDecimals));
    // Calculate minimum amount out based on slippage (requires quote or pool state)
    // For simplicity, we'll fetch the quote again or use a placeholder
    const quote = await getSwapQuote(connection, fromTokenSymbol, toTokenSymbol, amountIn, wallet, network);
    if (!quote.success) {
      return { success: false, message: `Swap failed: Could not get quote - ${quote.message}` };
    }

    if (quote.priceImpactBps > 1000) { // 10% price impact threshold
      return {
        success: false,
        message: `Swap rejected: Price impact too high (${(quote.priceImpactBps / 100).toFixed(2)}%). 
                  Try swapping a smaller amount to avoid moving the market price significantly.`
      };
    }
    const minAmountOutBaseUnits = new BN(quote.minOutputAmount * Math.pow(10, toDecimals));


    // 6. Build Transaction
    const tx = new Transaction();
    // TODO: Add wSOL wrapping instructions if fromIsSol
    // TODO: Add ATA creation instruction for userDestinationTokenAccount if needed

    console.log("[executeSwap] Checking if destination token account exists...");

    if (fromIsSol) {
      console.log("[executeSwap] Adding instructions to wrap SOL...");

      // Create the wSOL account if it doesn't exist
      let wsolAccountInfo = await connection.getAccountInfo(userSourceTokenAccount);

      if (!wsolAccountInfo) {
        console.log("[executeSwap] Creating wrapped SOL account...");
        tx.add(
          createAssociatedTokenAccountInstruction(
            authority,                // Payer
            userSourceTokenAccount,   // Associated token account address
            authority,                // Owner
            wrappedSolMint           // Mint
          )
        );
      }

      // Fund the wSOL account with native SOL - this performs the wrapping
      console.log(`[executeSwap] Wrapping ${amountIn} SOL...`);
      tx.add(
        SystemProgram.transfer({
          fromPubkey: authority,
          toPubkey: userSourceTokenAccount,
          lamports: amountInBaseUnits.toNumber()
        }),
        createSyncNativeInstruction(userSourceTokenAccount)
      );
    }


    let destinationAccountInfo = await connection.getAccountInfo(userDestinationTokenAccount);

    if (!destinationAccountInfo) {
      console.log("[executeSwap] Destination token account does not exist, creating it...");
      tx.add(
        createAssociatedTokenAccountInstruction(
          authority,                   // Payer
          userDestinationTokenAccount, // Associated token account address
          authority,                   // Owner
          toMint                       // Mint
        )
      );
      console.log("[executeSwap] Added instruction to create destination token account");
    }

    const actualOutputAmount = quote.expectedOutputAmount;
    // Add the Swap instruction
    // Ensure account names match your Rust program's Swap struct
    tx.add(
      program.instruction.swap(amountInBaseUnits, minAmountOutBaseUnits, { // Pass amounts
        accounts: {
          pool: poolPda,                  // Pool state PDA (derived via getPoolPDAs)
          poolAuthority: poolAuthorityPda, // Pool authority PDA (derived via getPoolPDAs)
          // Vaults must match the direction of the swap relative to the sorted mints in the pool
          // If swapping FromMint -> ToMint, and FromMint is SortedMintA:
          sourceMint: fromMint,
          destinationMint: toMint,
          userSourceTokenAccount: userSourceTokenAccount,       // User's source ATA
          userDestinationTokenAccount: userDestinationTokenAccount,
          tokenAVault: tokenAVaultATA,         // Vault A ATA
          tokenBVault: tokenBVaultATA,         // Vault B ATA
          // User's destination ATA
          userAuthority: authority,            // User's wallet
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      })
    );
    // let actualOutputAmount = quote.expectedOutputAmount; // Default to expected amount

    // if (toIsSol) {
    //   // Get the ATA that holds the wSOL
    //   const userWsolAccount = await getAssociatedTokenAddress(
    //     wrappedSolMint,
    //     authority
    //   );

    //   // Get the wSOL amount for tracking
    //   const wsolBalance = await connection.getTokenAccountBalance(userWsolAccount)
    //     .then(res => new BN(res.value.amount))
    //     .catch(() => minAmountOutBaseUnits);

    //   const actualOutputAmountRaw = wsolBalance;
    //   actualOutputAmount = Number(wsolBalance.toString()) / Math.pow(10, toDecimals);

    //   // DON'T automatically close the account!
    //   // Let the user decide when to unwrap their SOL

    // }
    // TODO: Add wSOL unwrapping instructions if toIsSol

    // 7. Send and Confirm
    console.log("Sending swap transaction...");

    let signature;

    if (network === "devnet") {
      // Devnet-specific handling with retry logic
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        attempts++;
        try {
          console.log(`Devnet swap transaction attempt ${attempts}/${maxAttempts}`);

          // Create a fresh connection with better timeout settings for devnet
          const devnetConnection = new Connection(
            "https://api.devnet.solana.com",
            { commitment: 'confirmed', confirmTransactionInitialTimeout: 60000 }
          );

          // Get fresh blockhash for each attempt
          const { blockhash, lastValidBlockHeight } = await devnetConnection.getLatestBlockhash('confirmed');
          tx.recentBlockhash = blockhash;
          tx.feePayer = authority;

          // Sign transaction first to avoid timeout issues
          const signedTx = await wallet.signTransaction(tx);

          // Send raw transaction
          console.log("Sending raw transaction to devnet...");
          signature = await devnetConnection.sendRawTransaction(signedTx.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed'
          });

          console.log(`Transaction sent: ${signature}`);

          // Wait for confirmation
          const confirmation = await devnetConnection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight
          }, 'confirmed');

          if (confirmation.value.err) {
            throw new Error(`Transaction confirmed but failed: ${confirmation.value.err}`);
          }

          console.log("Swap transaction confirmed!");
          break; // Exit the retry loop on success
        } catch (error: any) {
          console.warn(`Swap attempt ${attempts} failed:`, error);

          // If hitting last attempt, throw the error
          if (attempts >= maxAttempts) {
            throw error;
          }

          // Exponential backoff
          const delay = 2000 * Math.pow(2, attempts - 1);
          console.log(`Waiting ${delay}ms before next swap attempt...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // Add return statement here - this is what was missing
      let successMessage = '';
      if (toIsSol) {
        successMessage = `Successfully swapped ${amountIn} ${fromTokenSymbol} for ${actualOutputAmount.toFixed(6)} SOL. \nYour SOL is stored as wrapped SOL (wSOL) which you can use for future swaps or unwrap using the "unwrap sol" command.`;
      } else {
        successMessage = `Successfully swapped ${amountIn} ${fromTokenSymbol} for ${actualOutputAmount.toFixed(6)} ${toTokenSymbol}.`;
      }

      return {
        success: true,
        message: successMessage,
        signature,
        explorerUrl: signature ? getExplorerLink(signature, network) : '',
        outputAmount: actualOutputAmount,
      };
    } else {
      const signature = await wallet.sendTransaction(tx, connection);
      console.log("Swap transaction sent:", signature);

      const confirmation = await connection.confirmTransaction(signature, "confirmed");
      if (confirmation.value.err) {
        const txDetails = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0 });
        console.error("Swap Transaction confirmation error details:", confirmation.value.err);
        console.error("Transaction logs:", txDetails?.meta?.logMessages);
        throw new Error(`Transaction confirmed but failed: ${confirmation.value.err}`);
      }
      let successMessage = '';
      if (toIsSol) {
        successMessage = `Successfully swapped ${amountIn} ${fromTokenSymbol} for ${actualOutputAmount.toFixed(6)} SOL. \nYour SOL is stored as wrapped SOL (wSOL) which you can use for future swaps or unwrap using the "unwrap sol" command.`;
      } else {
        successMessage = `Successfully swapped ${amountIn} ${fromTokenSymbol} for ${actualOutputAmount.toFixed(6)} ${toTokenSymbol}.`;
      }

      console.log("Swap successful!");
      const explorerUrl = getExplorerLink(signature, network); // Use helper

      // TODO: Fetch actual output amount from transaction details if possible
      // const actualOutputAmount = quote.expectedOutputAmount; // Placeholder

      // return {
      //   success: true,
      //   message: `Successfully swapped ${amountIn} ${fromTokenSymbol} for ${actualOutputAmount.toFixed(6)} SOL. 
      //             Your SOL is stored as wrapped SOL (wSOL) which you can use for future swaps or unwrap.`,
      //   signature,
      //   explorerUrl,
      //   outputAmount: actualOutputAmount,
      // };
      return {
        success: true,
        message: successMessage,
        signature,
        explorerUrl: getExplorerLink(signature, network),
        outputAmount: actualOutputAmount,
      };
    }
  } catch (error: any) {
    console.error("Failed to execute swap:", error);
    let message = `Failed to execute swap: ${error.message || error.toString()}`;
    const errorLogs = error?.logs as string[] | undefined;
    if (errorLogs) {
      console.error("Error Logs:", errorLogs);
      if (errorLogs.some((log: string) => log.includes("SlippageToleranceExceeded"))) {
        message = `❌ Swap failed: SlippageToleranceExceeded. Price moved too much.`;
      } else if (errorLogs.some((log: string) => log.includes("ZeroAmount"))) {
        message = `❌ Swap failed: Input or output amount was zero.`;
      }
    }
    return { success: false, message };
  }
}
function getExplorerLink(signature: string, network: string): string {
  const clusterParam = network === "mainnet" ? "" : `?cluster=${network === 'localnet' ? `custom&customUrl=${encodeURIComponent('http://localhost:8899')}` : network}`;
  return `https://explorer.solana.com/tx/${signature}${clusterParam}`;
}