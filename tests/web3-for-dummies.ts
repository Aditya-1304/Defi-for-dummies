import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Web3ForDummies } from "../target/types/web3_for_dummies";
import { 
    PublicKey, 
    Keypair, 
    SystemProgram, 
    LAMPORTS_PER_SOL 
} from "@solana/web3.js";
import { 
    createMint, 
    mintTo, 
    getOrCreateAssociatedTokenAccount,
    TOKEN_PROGRAM_ID,
    getAccount,
    getMint
} from "@solana/spl-token";
import { assert } from "chai";

describe("web3-for-dummies", () => {
    // Configure the client to use the local cluster
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.Web3ForDummies as Program<Web3ForDummies>;
    
    // Create keypairs for our testing
    const payer = anchor.web3.Keypair.generate();
    const mintAuthority = anchor.web3.Keypair.generate();
    const alice = anchor.web3.Keypair.generate();
    const bob = anchor.web3.Keypair.generate();
    
    let mint: PublicKey;
    let aliceTokenAccount: PublicKey;
    let bobTokenAccount: PublicKey;
    const decimals = 6;
    
    before(async () => {
        // Airdrop SOL to payer
        const signature = await provider.connection.requestAirdrop(
            payer.publicKey,
            2 * LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(signature);
        
        // Also airdrop to alice who will be our transaction authority
        const aliceSig = await provider.connection.requestAirdrop(
            alice.publicKey,
            LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(aliceSig);
        
        // Create a new token mint
        mint = await createMint(
            provider.connection,
            payer,
            mintAuthority.publicKey,
            null,
            decimals,
            undefined,
            undefined,
            TOKEN_PROGRAM_ID
        );
        
        // Create token accounts for Alice and Bob
        aliceTokenAccount = (await getOrCreateAssociatedTokenAccount(
            provider.connection,
            payer,
            mint,
            alice.publicKey,
            false,
            undefined,
            undefined,
            TOKEN_PROGRAM_ID
        )).address;
        
        bobTokenAccount = (await getOrCreateAssociatedTokenAccount(
            provider.connection,
            payer,
            mint,
            bob.publicKey,
            false,
            undefined,
            undefined,
            TOKEN_PROGRAM_ID
        )).address;
        
        // Mint some tokens to Alice's account
        await mintTo(
            provider.connection,
            payer,
            mint,
            aliceTokenAccount,
            mintAuthority,
            1000 * 10 ** decimals,
            undefined,
            undefined,
            TOKEN_PROGRAM_ID
        );
    });

    it("Processes a token transfer transaction", async () => {
        // Amount to transfer
        const transferAmount = new anchor.BN(100 * 10 ** decimals);
        
        // Get account balances before the transfer
        const aliceTokenBefore = await getAccount(
            provider.connection, 
            aliceTokenAccount,
            undefined,
            TOKEN_PROGRAM_ID
        );
        const bobTokenBefore = await getAccount(
            provider.connection, 
            bobTokenAccount,
            undefined,
            TOKEN_PROGRAM_ID
        );
        
        // Execute the transaction
        const tx = await program.methods
            .processTransaction(transferAmount)
            .accounts({
                authority: alice.publicKey,
                senderTokenAccount: aliceTokenAccount,
                senderTokenAccountMint: mint,
                receiverTokenAccount: bobTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([alice])
            .rpc();
        
        console.log("Transaction signature:", tx);
        
        // Get account balances after the transfer
        const aliceTokenAfter = await getAccount(
            provider.connection, 
            aliceTokenAccount,
            undefined,
            TOKEN_PROGRAM_ID
        );
        const bobTokenAfter = await getAccount(
            provider.connection, 
            bobTokenAccount,
            undefined,
            TOKEN_PROGRAM_ID
        );
        
        // Verify Alice's account was debited correctly
        assert.equal(
            Number(aliceTokenBefore.amount) - Number(aliceTokenAfter.amount),
            Number(transferAmount),
            "Incorrect amount debited from sender"
        );
        
        // Verify Bob's account was credited correctly
        assert.equal(
            Number(bobTokenAfter.amount) - Number(bobTokenBefore.amount),
            Number(transferAmount),
            "Incorrect amount credited to receiver"
        );
    });

    it("Fails when the authority is not the owner of the token account", async () => {
        const transferAmount = new anchor.BN(50 * 10 ** decimals);
        
        try {
            // Bob tries to transfer from Alice's account
            await program.methods
                .processTransaction(transferAmount)
                .accounts({
                    authority: bob.publicKey,
                    senderTokenAccount: aliceTokenAccount,
                    senderTokenAccountMint: mint,
                    receiverTokenAccount: bobTokenAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([bob])
                .rpc();
            
            assert.fail("Transaction should have failed");
        } catch (err) {
            // Expected to fail
            console.log("Transaction failed as expected when wrong authority used");
        }
    });

    it("Fails when transferring more than available balance", async () => {
        // Get Alice's current balance
        const aliceToken = await getAccount(
            provider.connection, 
            aliceTokenAccount,
            undefined,
            TOKEN_PROGRAM_ID
        );
        
        // Try to transfer more than available
        const tooMuchAmount = new anchor.BN(Number(aliceToken.amount) + 1);
        
        try {
            await program.methods
                .processTransaction(tooMuchAmount)
                .accounts({
                    authority: alice.publicKey,
                    senderTokenAccount: aliceTokenAccount,
                    senderTokenAccountMint: mint,
                    receiverTokenAccount: bobTokenAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([alice])
                .rpc();
            
            assert.fail("Transaction should have failed due to insufficient funds");
        } catch (err) {
            // Expected to fail
            console.log("Transaction failed as expected due to insufficient funds");
        }
    });
});