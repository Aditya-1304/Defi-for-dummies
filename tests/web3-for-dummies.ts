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


    describe("intialize_pool", () => {
        it("Initializes the liquidity pool correctly", async () => {
            const [mintAkey, mintBKey] = [tokenAMint, tokenBMint].sort((a, b) => a.toBuffer().compare(b.toBuffer()));

            await program.methods
                .initializePool()
                .accounts({
                    initializer: intializer.publicKey,
                    tokenAMint: mintAkey,
                    tokenBMint: mintBKey,
                    pool: poolPda,
                    poolAuthority: poolAuthorityPda,
                    tokenAVault: poolTokenAVault,
                    tokenBVault: poolTokenBVault,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                } as any)
                .signers([intializer])
                .rpc();

            const poolAccount = await program.account.liquidityPool.fetch(poolPda);
            assert.ok(poolAccount.tokenAMint.equals(mintAkey), "Pool mint A mismatch");
            assert.ok(poolAccount.tokenBMint.equals(mintBKey), "Pool mint B mismatch");
            assert.ok(poolAccount.tokenAVault.equals(poolTokenAVault), "Pool vault A mismatch");
            assert.ok(poolAccount.tokenBVault.equals(poolTokenBVault), "Pool vault B mismatch");
            assert.equal(poolAccount.bump, poolBump, "Pool bump mismatch");

            const vaultAInfo = await getAccount(provider.connection, poolTokenAVault);
            const vaultBInfo = await getAccount(provider.connection, poolTokenBVault);
            assert.ok(vaultAInfo.owner.equals(poolAuthorityPda), "Vault A owner mismatch");
            assert.ok(vaultBInfo.owner.equals(poolAuthorityPda), "Vault B owner mismatch");
        });

        it("Fails to initialize an already intialized pool", async () => {
            const [mintAKey, mintBKey] = [tokenAMint, tokenBMint].sort((a, b) => a.toBuffer().compare(b.toBuffer()));

            try {
                await program.methods
                    .initializePool()
                    .accounts({
                        initializer: intializer.publicKey,
                        tokenAMint: mintAKey,
                        tokenBMint: mintBKey,
                        pool: poolPda,
                        poolAuthority: poolAuthorityPda,
                        tokenAVault: poolTokenAVault,
                        tokenBVault: poolTokenBVault,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                    } as any)
                    .signers([intializer])
                    .rpc();
                assert.fail("Should have failed to initialize an existing pool");

            } catch (e) {
                assert.include(e.toString(), "custom program error: 0x0", "Expected account already in use error (0x0)");
            }
        })
    });

    describe("add_liquidity", () => {
        const initialLiquidityA = new BN(100 * (10 ** decimals));
        const initialLiquidityB = new BN(100 * (10 ** decimals));

        it("Adds initial Liquidity successfully", async () => {
            const aliceA_before = await getTokenBalance(aliceTokenAAccount);
            const aliceB_before = await getTokenBalance(aliceTokenBAccount)
            const vaultA_before = await getTokenBalance(poolTokenAVault)
            const vaultB_before = await getTokenBalance(poolTokenBVault);


            await program.methods
                .addLiquidity(initialLiquidityA, initialLiquidityB)
                .accounts({
                    userAuthority: alice.publicKey,
                    pool: poolPda,
                    poolAuthority: poolAuthorityPda,
                    tokenAMint: tokenAMint,
                    tokenBMint: tokenBMint,
                    userTokenAAccount: aliceTokenAAccount,
                    userTokenBAccount: aliceTokenBAccount,
                    tokenAVault: poolTokenAVault,
                    tokenBVault: poolTokenBVault,
                    tokenProgram: TOKEN_PROGRAM_ID,
                } as any)
                .signers([alice])
                .rpc()
            const aliceA_after = await getTokenBalance(aliceTokenAAccount);
            const aliceB_after = await getTokenBalance(aliceTokenBAccount);
            const vaultA_after = await getTokenBalance(poolTokenAVault);
            const vaultB_after = await getTokenBalance(poolTokenBVault);

            assert.equal(aliceA_before - aliceA_after, initialLiquidityA.toNumber(), "Alice A balance change mismatch");
            assert.equal(aliceB_before - aliceB_after, initialLiquidityB.toNumber(), "Alice B balance change mismatch");
            assert.equal(vaultA_after - vaultA_before, initialLiquidityA.toNumber(), "Vault A balance change mismatch");
            assert.equal(vaultB_after - vaultB_before, initialLiquidityB.toNumber(), "Vault B balance change mismatch");
        });

        it("Adds subsequent proportional liquidity", async () => {
            const subsequentLiquidityA = new BN(50 * (10 ** decimals));
            const subsequentLiquidityB = new BN(50 * (10 ** decimals));

            const aliceA_before = await getTokenBalance(aliceTokenAAccount);
            const aliceB_before = await getTokenBalance(aliceTokenBAccount)
            const vaultA_before = await getTokenBalance(poolTokenAVault)
            const vaultB_before = await getTokenBalance(poolTokenBVault)

            await program.methods
                .addLiquidity(subsequentLiquidityA, subsequentLiquidityB)
                .accounts({
                    userAuthority: alice.publicKey,
                    pool: poolPda,
                    poolAuthority: poolAuthorityPda,
                    tokenAMint: tokenAMint,
                    tokenBMint: tokenBMint,
                    userTokenAAccount: aliceTokenAAccount,
                    userTokenBAccount: aliceTokenBAccount,
                    tokenAVault: poolTokenAVault,
                    tokenBVault: poolTokenBVault,
                    tokenProgram: TOKEN_PROGRAM_ID,
                } as any)
                .signers([alice])
                .rpc();

            const aliceA_after = await getTokenBalance(aliceTokenAAccount);
            const aliceB_after = await getTokenBalance(aliceTokenAAccount);
            const vaultA_after = await getTokenBalance(poolTokenAVault)
            const vaultB_after = await getTokenBalance(poolTokenBVault)

            assert.equal(aliceA_before - aliceA_after, subsequentLiquidityA.toNumber(), "Alice A balance change mismatch (subsequent)");
            assert.equal(aliceB_before - aliceB_after, subsequentLiquidityB.toNumber(), "Alice B balance change mismatch (subsequent)");
            assert.equal(vaultA_after - vaultA_before, subsequentLiquidityA.toNumber(), "Vault A balance change mismatch (subsequent)");
            assert.equal(vaultB_after - vaultB_before, subsequentLiquidityB.toNumber(), "Vault B balance change mismatch (subsequent)");

        });

        it("Fails to add liquidity with zero amount", async () => {
            try {
                await program.methods
                    .addLiquidity(new BN(0), new BN(10 * (10 ** decimals)))
                    .accounts({
                        userAuthority: alice.publicKey,
                        pool: poolPda,
                        poolAuthority: poolAuthorityPda,
                        tokenAMint: tokenAMint,
                        tokenBMint: tokenBMint,
                        userTokenAAccount: aliceTokenAAccount,
                        userTokenBAccount: aliceTokenBAccount,
                        tokenAVault: poolTokenAVault,
                        tokenBVault: poolTokenBVault,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    } as any)
                    .signers([alice])
                    .rpc();
                assert.fail("Should have failed due to zero amount");

            } catch (e) {
                assert.include(e.toString(), "ZeroAmount", "Expected ZeroAmount error");
            }
            try {
                await program.methods
                    .addLiquidity(new BN(10 * (10 ** decimals)), new BN(0))
                    .accounts({
                        userAuthority: alice.publicKey,
                        pool: poolPda,
                        poolAuthority: poolAuthorityPda,
                        tokenAMint: tokenAMint,
                        tokenBMint: tokenBMint,
                        userTokenAAccount: aliceTokenAAccount,
                        userTokenBAccount: aliceTokenBAccount,
                        tokenAVault: poolTokenAVault,
                        tokenBVault: poolTokenBVault,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    } as any)
                    .signers([alice])
                    .rpc()
                assert.fail("Should have failed due to zero amount");
            } catch (e) {
                assert.include(e.toString(), "ZeroAmount", "Expected ZeroAmount error");
            }
        });

        it("Fails to add disproportionate liquidity", async () => {
            const disproportionateLiquidityA = new BN(10 * (10 ** decimals));
            const disproportionateLiquidityB = new BN(50 * (10 ** decimals))

            try {
                await program.methods
                    .addLiquidity(disproportionateLiquidityA, disproportionateLiquidityB)
                    .accounts({
                        userAuthority: alice.publicKey,
                        pool: poolPda,
                        poolAuthority: poolAuthorityPda,
                        tokenAMint: tokenAMint,
                        tokenBMint: tokenBMint,
                        userTokenAAccount: aliceTokenAAccount,
                        userTokenBAccount: aliceTokenBAccount,
                        tokenAVault: poolTokenAVault,
                        tokenBVault: poolTokenBVault,
                        tokenProgram: TOKEN_PROGRAM_ID
                    } as any)
                    .signers([alice])
                    .rpc()
                assert.fail("Should have failed due to disproportionate liquidity");

            } catch (e) {
                assert.include(e.toString(), "DisproportionateLiquidity", "Expected DisproportionateLiquidity error");
            }
        });
    });

    describe("swap", () => {
        const swapAmountA = new BN(10 * (10 ** decimals));
        const mintAmountBOut = new BN(1);
        const swapAmountB = new BN(15 * (10 ** decimals))
        const minAmountAOut = new BN(1);

        const calculateExpectedOut = (amountIn: BN, reserveIn: BN, reserveOut: BN): BN => {
            const amountInU128 = BigInt(amountIn.toString());
            const reserveInU128 = BigInt(reserveIn.toString())
            const reserveOutU128 = BigInt(reserveOut.toString())

            if (reserveInU128 === BigInt(0) || reserveOutU128 === BigInt(0) || amountInU128 === BigInt(0)) {
                return new BN(0);
            }

            const feeNumerator = BigInt(3);
            const feeDenominator = BigInt(1000);
            const amountInAfterFee = (amountInU128 * (feeDenominator - feeNumerator)) / feeDenominator;

            const constantProduct = reserveInU128 * reserveOutU128;
            const newReserveIn = reserveInU128 + amountInAfterFee;
            const newReserveOut = constantProduct / newReserveIn;
            const amountOutU128 = reserveOutU128 - newReserveOut;

            return new BN(amountOutU128.toString());
        };

        it("Swaps Token A for Token B successfully", async () => {
            const aliceA_before = await getTokenBalance(aliceTokenAAccount)
            const aliceB_before = await getTokenBalance(aliceTokenBAccount)
            const vaultA_before = await getTokenBalance(poolTokenAVault)
            const vaultB_before = await getTokenBalance(poolTokenBVault)

            const expectedBOut = calculateExpectedOut(swapAmountA, new BN(vaultA_before), new BN(vaultB_before));
            console.log(`Swapping ${swapAmountA.toString()} A for B. Vaults: A=${vaultA_before}, B=${vaultB_before}. Expecting ~${expectedBOut.toString()} B out.`);
            assert.ok(expectedBOut.gt(new BN(0)), "Expected output should be positive");

            await program.methods
                .swap(swapAmountA, expectedBOut.muln(98).divn(100))
                .accounts({
                    userAuthority: alice.publicKey,
                    pool: poolPda,
                    poolAuthority: poolAuthorityPda,
                    sourceMint: tokenAMint,
                    destinationMint: tokenBMint,
                    userSourceTokenAccount: aliceTokenAAccount,
                    userDestinationTokenAccount: aliceTokenBAccount,
                    tokenAVault: poolTokenAVault,
                    tokenBVault: poolTokenBVault,
                    tokenProgram: TOKEN_PROGRAM_ID
                } as any)
                .signers([alice])
                .rpc()
            const aliceA_after = await getTokenBalance(aliceTokenAAccount)
            const aliceB_after = await getTokenBalance(aliceTokenBAccount)
            const vaultA_after = await getTokenBalance(poolTokenAVault)
            const vaultB_after = await getTokenBalance(poolTokenBVault)

            const actualAmountOutB = aliceB_after - aliceB_before;
            assert.equal(aliceA_before - aliceA_after, swapAmountA.toNumber(), "Alice A balance change mismatch (A->B swap)");
            // Check actual amount out is close to expected (within slippage)
            assert.ok(new BN(actualAmountOutB).gte(expectedBOut.muln(98).divn(100)), `Amount B out too low: ${actualAmountOutB} < ~${expectedBOut.toString()}`);
            assert.ok(new BN(actualAmountOutB).lte(expectedBOut.muln(102).divn(100)), `Amount B out too high: ${actualAmountOutB} > ~${expectedBOut.toString()}`);


            assert.equal(vaultA_after - vaultA_before, swapAmountA.toNumber(), "Vault A balance change mismatch (A->B swap)");
            assert.equal(vaultB_before - vaultB_after, actualAmountOutB, "Vault B balance change mismatch (A->B swap)");

        })
    })


})