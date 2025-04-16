import * as anchor from "@coral-xyz/anchor"
import { Program, BN } from "@coral-xyz/anchor"
import { Web3ForDummies } from "../target/types/web3_for_dummies"
import {
    PublicKey,
    Keypair,
    SystemProgram,
    LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { createMint, getAccount, getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { assert } from "chai";


describe("web3-for-dummies", () => {
    const provider = anchor.AnchorProvider.env()
    anchor.setProvider(provider)

    const program = anchor.workspace.Web3ForDummies as Program<Web3ForDummies>


    const payer = anchor.web3.Keypair.generate();
    const mintAuthority = anchor.web3.Keypair.generate();
    const alice = anchor.web3.Keypair.generate();
    const bob = anchor.web3.Keypair.generate();
    const intializer = anchor.web3.Keypair.generate();

    const decimals = 6;
    const initialMintAmount = 1_000_000 * (10 ** decimals);

    let simpleTransferMint: PublicKey;
    let aliceSimpleTokenAccount: PublicKey;
    let bobSimpleTokenAccount: PublicKey;


    let tokenAMint: PublicKey;
    let tokenBMint: PublicKey;
    let poolPda: PublicKey;
    let poolAuthorityPda: PublicKey;
    let poolTokenAVault: PublicKey;
    let poolTokenBVault: PublicKey;
    let aliceTokenAAccount: PublicKey;
    let aliceTokenBAccount: PublicKey;
    let poolBump: number;

    const getTokenBalance = async (tokenAccount: PublicKey): Promise<number> => {
        try {
            const accountInfo = await getAccount(provider.connection, tokenAccount);
            return Number(accountInfo.amount);
        } catch (e) {
            return 0;
        }
    };

    const setupToken = async (authority: Keypair, recipient: PublicKey, amount: number): Promise<{ mint: PublicKey, ata: PublicKey }> => {
        const mint = await createMint(
            provider.connection,
            payer,
            authority.publicKey,
            null,
            decimals
        );

        const ata = (await getOrCreateAssociatedTokenAccount(
            provider.connection,
            payer,
            mint,
            recipient,
            false,
        )).address


        await mintTo(
            provider.connection,
            payer,
            mint,
            ata,
            authority,
            BigInt(amount)
        );

        return { mint, ata };
    };

    before(async () => {
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(payer.publicKey, 2 * LAMPORTS_PER_SOL),
        );
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(alice.publicKey, 2 * LAMPORTS_PER_SOL),
        );
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(bob.publicKey, 2 * LAMPORTS_PER_SOL),
        );
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(intializer.publicKey, 2 * LAMPORTS_PER_SOL),
        );


        const simpleSetup = await setupToken(mintAuthority, alice.publicKey, initialMintAmount);
        simpleTransferMint = simpleSetup.mint;
        aliceSimpleTokenAccount = simpleSetup.ata;
        bobSimpleTokenAccount = (await getOrCreateAssociatedTokenAccount(provider.connection, payer, simpleTransferMint, bob.publicKey)).address;


        tokenAMint = await createMint(provider.connection, payer, mintAuthority.publicKey, null, decimals);

        tokenBMint = await createMint(provider.connection, payer, mintAuthority.publicKey, null, decimals)

        aliceTokenAAccount = (await getOrCreateAssociatedTokenAccount(provider.connection, payer, tokenAMint, alice.publicKey)).address;
        aliceTokenBAccount = (await getOrCreateAssociatedTokenAccount(provider.connection, payer, tokenBMint, alice.publicKey)).address;

        await mintTo(provider.connection, payer, tokenAMint, aliceTokenAAccount, mintAuthority, BigInt(initialMintAmount));
        await mintTo(provider.connection, payer, tokenBMint, aliceTokenBAccount, mintAuthority, BigInt(initialMintAmount));


        const [mintAkey, mintBKey] = [tokenAMint, tokenBMint].sort((a, b) => a.toBuffer().compare(b.toBuffer()));

        [poolPda, poolBump] = await PublicKey.findProgramAddressSync(
            [
                Buffer.from("pool"),
                mintAkey.toBuffer(),
                mintBKey.toBuffer(),
            ],
            program.programId
        );

        [poolAuthorityPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("pool"),
                mintAkey.toBuffer(),
                mintBKey.toBuffer(),
                Buffer.from([poolBump]),
            ],
            program.programId
        );

        poolTokenAVault = await getAssociatedTokenAddress(tokenAMint, poolAuthorityPda, true);
        poolTokenBVault = await getAssociatedTokenAddress(tokenBMint, poolAuthorityPda, true);

    });


    describe("process_transaction", () => {
        it("Processes a valid token transfer", async () => {
            const transferAmount = new BN(100 * 10 ** decimals);
            const aliceBefore = await getTokenBalance(aliceSimpleTokenAccount)
            const bobBefore = await getTokenBalance(bobSimpleTokenAccount)

            await program.methods
                .processTransaction(transferAmount)
                .accounts({
                    authority: alice.publicKey,
                    senderTokenAccount: aliceSimpleTokenAccount,
                    senderTokenAccountMint: simpleTransferMint,
                    receiverTokenAccount: bobSimpleTokenAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([alice])
                .rpc()

            const aliceAfter = await getTokenBalance(aliceSimpleTokenAccount)
            const bobAfter = await getTokenBalance(bobSimpleTokenAccount)

            assert.equal(aliceBefore - aliceAfter, transferAmount.toNumber(), "Alice balance mismatch");
            assert.equal(bobBefore - bobAfter, transferAmount.toNumber(), "Bob balance mismatch");
        });

        it("Fails when authority is not the sender", async () => {
            const transferAmount = new BN(50 * 10 ** decimals)
            try {
                await program.methods
                    .processTransaction(transferAmount)
                    .accounts({
                        authority: bob.publicKey,
                        senderTokenAccount: aliceSimpleTokenAccount,
                        senderTokenAccountMint: simpleTransferMint,
                        receiverTokenAccount: bobSimpleTokenAccount,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .signers([bob])
                    .rpc()
                assert.fail("Transaction should have failed due to invalid ownership");
            } catch (e) {
                assert.include(e.toString(), "InvalidOwner", "Excepted InvalidOwner error");
            }
        });

        it("Fails when transferring more than available balance", async () => {
            const aliceBalance = await getTokenBalance(aliceSimpleTokenAccount)
            const tooMuchAmount = new BN(aliceBalance + 1)

            try {
                await program.methods
                    .processTransaction(tooMuchAmount)
                    .accounts({
                        authority: alice.publicKey,
                        senderTokenAccount: aliceSimpleTokenAccount,
                        senderTokenAccountMint: simpleTransferMint,
                        receiverTokenAccount: bobSimpleTokenAccount,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .signers([alice])
                    .rpc()
                assert.fail("Transaction should have failed due to insufficient balance");
            } catch (e) {
                assert.include(e.toString(), "failed to send transaction", "Excepted transaction error");
            }
        });

        it("Fails eith mismatched mints", async () => {
            const transferAmount = new BN(10 * 10 ** decimals);

            const wrongMint = await createMint(provider.connection, payer, mintAuthority.publicKey, null, decimals)

            try {
                await program.methods
                    .processTransaction(transferAmount)
                    .accounts({
                        authority: alice.publicKey,
                        senderTokenAccount: aliceSimpleTokenAccount,
                        senderTokenAccountMint: wrongMint,
                        receiverTokenAccount: bobSimpleTokenAccount,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .signers([alice])
                    .rpc()
                assert.fail("Transcation should have failed due to mismatched mints");
            } catch (e) {
                assert.include(e.toString(), "InvalidMint", "Excepted InvalidMint error");
            }
        });
    });




})