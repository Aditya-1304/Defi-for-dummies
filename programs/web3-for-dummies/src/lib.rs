use anchor_lang::{prelude::*, system_program};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        self, // Using the newer token_interface standard
        transfer_checked, // For transfers that check mint decimals
        Mint,
        TokenAccount,
        TokenInterface,
        TransferChecked, // Struct for transfer_checked CPI
        MintTo, // Struct for mint_to CPI (not used here, but good practice)
        mint_to, // Function for mint_to CPI (not used here)
        Burn, // Struct for burn CPI (not used here)
        burn // Function for burn CPI (not used here)
    },

};

// Required for getting mutable access to account data, e.g., pool state
use std::ops::DerefMut;
// Required for min/max functions used in PDA seed generation
use std::cmp::{max, min};


// Declare the program's on-chain address (ID)
declare_id!("B53vYkHSs1vMQzofYfKjz6Unzv8P4TwCcvvTbMWVnctv");

#[program]
pub mod web3_for_dummies {

    use super::*; // Imports items from the outer scope (like structs, errors, etc.)

    /// Initializes a new liquidity pool with the given token mints.
    /// Creates the pool state account and associated token accounts (vaults) to hold the tokens.
    pub fn initialize_pool(ctx: Context<InitializePool>) -> Result<()> {
        // Get mutable access to the newly created pool account
        let pool = &mut ctx.accounts.pool;

        // Store the public keys of the token mints and vaults in the pool state
        pool.token_a_mint = ctx.accounts.token_a_mint.key();
        pool.token_b_mint = ctx.accounts.token_b_mint.key();
        pool.token_a_vault = ctx.accounts.token_a_vault.key();
        pool.token_b_vault = ctx.accounts.token_b_vault.key();
        // Store the bump seed for the pool's PDA, needed for signing CPIs later
        pool.bump = ctx.bumps.pool;

        // Log the details of the initialized pool (useful for debugging)
        msg!("Pool Initialized!");
        msg!("Mint A: {}", pool.token_a_mint);
        msg!("Mint B: {}", pool.token_b_mint);
        msg!("Vault A: {}", pool.token_a_vault);
        msg!("Vault B: {}", pool.token_b_vault);

        Ok(()) // Indicate successful execution
    }

    /// Swaps one token for another using the constant product formula.
    /// Requires the amount of token to send in and the minimum amount of token expected out (slippage protection).
    pub fn swap(ctx: Context<Swap>, amount_in: u64, min_amount_out: u64) -> Result<()> {
        // Get immutable access to the pool state
        let pool = &ctx.accounts.pool;

        // --- Input Validation ---
        // Ensure the user's source token account mint matches one of the pool's tokens
        if ctx.accounts.user_source_token_account.mint != pool.token_a_mint && ctx.accounts.user_source_token_account.mint != pool.token_b_mint {
            return err!(SwapError::InvalidMint);
        }

        // --- Determine Source/Destination Vaults ---
        // Figure out which pool vault receives tokens (source) and which sends tokens (destination)
        // based on the mint of the user's source token account.
        // Also retrieve the decimals of the source mint for transfer_checked.
        let (source_vault_key, dest_vault_key, source_mint_decimals) = {
            if ctx.accounts.user_source_token_account.mint == pool.token_a_mint {
                // User is sending Token A, wants Token B
                (
                    ctx.accounts.token_a_vault.key(), // Pool's vault A is the source
                    ctx.accounts.token_b_vault.key(), // Pool's vault B is the destination
                    ctx.accounts.source_mint.decimals, // Decimals of Token A
                )
            } else {
                // User is sending Token B, wants Token A (since we already validated the mint)
                (
                    ctx.accounts.token_b_vault.key(), // Pool's vault B is the source
                    ctx.accounts.token_a_vault.key(), // Pool's vault A is the destination
                    ctx.accounts.source_mint.decimals, // Decimals of Token B
                )
            }
        };

        // --- Get Mutable Vault References ---
        // Borrow the vault accounts mutably from the context
        let token_a_vault_mut = &mut ctx.accounts.token_a_vault;
        let token_b_vault_mut = &mut ctx.accounts.token_b_vault;

        // Assign the correct mutable references based on the keys determined above
        let (final_source_vault, final_dest_vault) = if token_a_vault_mut.key() == source_vault_key {
            // token_a_vault is the source vault
            (token_a_vault_mut, token_b_vault_mut)
        } else {
            // token_b_vault is the source vault, swap the references
            (token_b_vault_mut, token_a_vault_mut)
        };

        // --- Destination Mint Check ---
        // Ensure the user's destination token account matches the mint of the pool's destination vault
        if ctx.accounts.user_destination_token_account.mint != final_dest_vault.mint {
            return err!(SwapError::InvalidDestinationMint);
        }

        // --- Get Reserves ---
        // Reload vault accounts to get the latest balance data on-chain
        final_source_vault.reload()?;
        final_dest_vault.reload()?;
        let reserve_in = final_source_vault.amount; // Current balance of the token being sent *in*
        let reserve_out = final_dest_vault.amount; // Current balance of the token being sent *out*

        // --- Swap Calculation (Constant Product: x * y = k) ---
        // Convert amounts to u128 for calculation to prevent intermediate overflows
        let amount_in_u128 = amount_in as u128;
        let reserve_in_u128 = reserve_in as u128;
        let reserve_out_u128 = reserve_out as u128;

        // Basic checks before calculation
        if reserve_in == 0 || reserve_out == 0 {
            return err!(SwapError::PoolIsEmpty); // Cannot swap if a pool is empty
        }
        if amount_in == 0 {
            return err!(SwapError::ZeroAmount); // Input amount must be positive
        }

        // Calculate the constant product (k)
        // x * y = k
        let constant_product = reserve_in_u128.checked_mul(reserve_out_u128).ok_or(SwapError::CalculationOverflow)?;

        // Calculate the new reserve amount for the input token
        // new_x = x + amount_in
        let new_reserve_in = reserve_in_u128.checked_add(amount_in_u128).ok_or(SwapError::CalculationOverflow)?;

        // Calculate the new reserve amount for the output token based on k
        // new_y = k / new_x
        // Note: Integer division truncates, favoring the pool slightly.
        let new_reserve_out = constant_product.checked_div(new_reserve_in).ok_or(SwapError::CalculationOverflow)?;

        // Calculate the amount of output tokens to send to the user
        // amount_out = y - new_y
        let amount_out_u128 = reserve_out_u128.checked_sub(new_reserve_out).ok_or(SwapError::CalculationOverflow)?;

        // Convert amount_out back to u64
        let amount_out = amount_out_u128 as u64;

        // --- Slippage Check ---
        // Ensure the calculated amount_out meets the user's minimum requirement
        if amount_out < min_amount_out {
            return err!(SwapError::SlippageExceeded);
        }

        // --- Perform Transfers via CPI ---

        // 1. Transfer IN: User -> Pool Source Vault
        let transfer_in_accounts = TransferChecked {
            from: ctx.accounts.user_source_token_account.to_account_info(), // User's source ATA
            mint: ctx.accounts.source_mint.to_account_info(), // Mint of the token being sent in
            to: final_source_vault.to_account_info(), // Pool's vault for receiving the token
            authority: ctx.accounts.user_authority.to_account_info(), // User signing the transaction
        };
        let transfer_in_cpi = CpiContext::new(
            ctx.accounts.token_program.to_account_info(), // Target program (Token Program)
            transfer_in_accounts, // Accounts required by transfer_checked
        );
        // Execute the CPI
        transfer_checked(transfer_in_cpi, amount_in, source_mint_decimals)?;


        // 2. Transfer OUT: Pool Destination Vault -> User
        // Define the PDA signer seeds for the pool authority
        let pool_signer_seeds : &[&[&[u8]]] = &[&[
            b"pool", // Constant seed prefix
            // Use canonical ordering of mints for deterministic PDA address
            min(pool.token_a_mint.as_ref(), pool.token_b_mint.as_ref()),
            max(pool.token_a_mint.as_ref(), pool.token_b_mint.as_ref()),
            &[pool.bump] // Bump seed stored in the pool account
        ]];

        let transfer_out_accounts = TransferChecked {
            from: final_dest_vault.to_account_info(), // Pool's vault sending the token
            mint: ctx.accounts.destination_mint.to_account_info(), // Mint of the token being sent out
            to: ctx.accounts.user_destination_token_account.to_account_info(), // User's destination ATA
            authority: ctx.accounts.pool_authority.to_account_info(), // The pool's PDA authority
        };
        // Create CPI context *with signer* because the authority is a PDA
        let transfer_out_cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(), // Target program (Token Program)
            transfer_out_accounts, // Accounts required by transfer_checked
            pool_signer_seeds, // Seeds for the PDA signer
        );
        // Execute the CPI
        transfer_checked(transfer_out_cpi, amount_out, ctx.accounts.destination_mint.decimals)?;

        // --- Emit Event ---
        // Log the details of the swap event
        emit!(SwapEvent {
            pool: ctx.accounts.pool.key(),
            user: ctx.accounts.user_authority.key(),
            amount_in,
            amount_out,
            source_mint: ctx.accounts.source_mint.key(),
            destination_mint: ctx.accounts.destination_mint.key()
        });

        Ok(()) // Indicate successful execution
    }

    /// A simple example instruction to transfer tokens between two accounts.
    /// (This seems separate from the swap logic, potentially for testing or another feature)
    pub fn process_transaction(ctx: Context<ProcessTransaction>, amount: u64) -> Result<()> {
        // Prepare accounts for the transfer_checked CPI
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.sender_token_account.to_account_info(),
            mint: ctx.accounts.sender_token_account_mint.to_account_info(),
            to: ctx.accounts.receiver_token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(), // The authority signing this transaction
        };

        let cpi_program= ctx.accounts.token_program.to_account_info();
        let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
        let decimals = ctx.accounts.sender_token_account_mint.decimals; // Get decimals for transfer_checked

        // Execute the transfer
        transfer_checked(cpi_context, amount, decimals)?;

        // Emit an event logging the transaction
        emit!(TransactionEvent {
            from: ctx.accounts.authority.key(),
            to: ctx.accounts.receiver_token_account.key(),
            amount,
        });
        Ok(()) // Indicate successful execution
    }
}


// --- Account Data Structures ---

/// Stores the state of a single liquidity pool.
#[account]
#[derive(Default)] // Allows initializing with default values (zeros, null pubkeys)
pub struct LiquidityPool {
    /// The mint address of the first token (Token A).
    pub token_a_mint: Pubkey,
    /// The mint address of the second token (Token B).
    pub token_b_mint: Pubkey,
    /// The address of the pool's vault (ATA) for Token A.
    pub token_a_vault: Pubkey,
    /// The address of the pool's vault (ATA) for Token B.
    pub token_b_vault: Pubkey,
    /// The bump seed used for the pool's PDA.
    pub bump: u8,
    // pub vault_a_bump: u8, // Bumps for vaults are not needed if using ATAs with PDA authority
    // pub vault_b_bump: u8,
}

/// Define the space required for the LiquidityPool account.
/// 8 bytes for discriminator + 4 * 32 bytes for Pubkeys + 1 byte for bump = 137 bytes.
/// Add a buffer (e.g., 64 bytes) for potential future fields.
const POOL_ACCOUNT_SIZE: usize = 8 + ( 32 * 4 ) + 1 + 64; // = 201 bytes

/// Defines the accounts required for the `initialize_pool` instruction.
#[derive(Accounts)]
pub struct InitializePool<'info> {
    /// The LiquidityPool account to be created.
    #[account(
        init, // Mark account for initialization
        payer = initializer, // The account paying for the rent
        seeds = [ // Seeds for the pool PDA address
            b"pool",
            // Use canonical ordering of mints for deterministic PDA address
            min(token_a_mint.key(), token_b_mint.key()).as_ref(),
            max(token_a_mint.key(), token_b_mint.key()).as_ref(),
        ],
        bump, // Anchor calculates and stores the bump seed
        space = POOL_ACCOUNT_SIZE, // Allocate space for the account
    )]
    pub pool: Account<'info, LiquidityPool>,

    /// CHECK: The authority PDA for the pool. Derived from the same seeds as the pool account.
    /// This account doesn't hold data but is required for signing transfers from vaults.
    /// Anchor automatically validates this matches the seeds + bump.
    #[account(
        seeds = [
            b"pool",
            min(token_a_mint.key(), token_b_mint.key()).as_ref(),
            max(token_a_mint.key(), token_b_mint.key()).as_ref(),
            &[pool.bump], // Use the bump from the already derived pool account
        ],
        bump, // Anchor validates this bump matches the derived address
    )]
    pub pool_authority: AccountInfo<'info>,

    /// The mint account for Token A.
    pub token_a_mint: InterfaceAccount<'info, Mint>,
    /// The mint account for Token B.
    pub token_b_mint: InterfaceAccount<'info, Mint>,

    /// The associated token account (vault) for Token A, owned by the pool_authority PDA.
    #[account(
        init, // Initialize this ATA
        payer = initializer,
        associated_token::mint = token_a_mint, // Mint for the ATA
        associated_token::authority = pool_authority, // Owner of the ATA (the PDA)
    )]
    pub token_a_vault: InterfaceAccount<'info, TokenAccount>,

    /// The associated token account (vault) for Token B, owned by the pool_authority PDA.
    #[account(
        init, // Initialize this ATA
        payer = initializer,
        associated_token::mint = token_b_mint, // Mint for the ATA
        associated_token::authority = pool_authority, // Owner of the ATA (the PDA)
    )]
    pub token_b_vault: InterfaceAccount<'info, TokenAccount>,

    /// The user initializing the pool (signer and payer).
    #[account(mut)]
    pub initializer: Signer<'info>,

    /// SPL Token Program (or Token-2022 program).
    pub token_program: Interface<'info, TokenInterface>,
    /// Associated Token Program, needed for creating ATAs.
    pub associated_token_program: Program<'info, AssociatedToken>,
    /// System Program, needed for creating accounts.
    pub system_program: Program<'info, System>,
}

/// Defines the accounts required for the `swap` instruction.
#[derive(Accounts)]
pub struct Swap<'info> {
    /// The LiquidityPool account containing the state for this swap.
    #[account(
        seeds = [ // Verify the pool PDA address matches the provided mints
            b"pool",
            min(source_mint.key(), destination_mint.key()).as_ref(),
            max(source_mint.key(), destination_mint.key()).as_ref(),
        ],
        bump = pool.bump, // Verify the bump matches the one stored in the pool account
        // --- Security Constraints ---
        // Ensure the vault accounts provided match those stored in the pool state
        constraint = token_a_vault.key() == pool.token_a_vault @SwapError::InvalidVault,
        constraint = token_b_vault.key() == pool.token_b_vault @SwapError::InvalidVault,
        // Ensure the pool actually supports the source and destination mints
        constraint = (pool.token_a_mint == source_mint.key() || pool.token_a_mint == destination_mint.key()) @ SwapError::InvalidMint,
        constraint = (pool.token_b_mint == source_mint.key() || pool.token_b_mint == destination_mint.key()) @ SwapError::InvalidMint,
    )]
    pub pool: Account<'info, LiquidityPool>,

    /// CHECK: The authority PDA for the pool. Required for signing the outgoing transfer.
    /// Anchor automatically validates this matches the seeds + bump.
    #[account(
        seeds = [
            b"pool",
            min(source_mint.key(), destination_mint.key()).as_ref(),
            max(source_mint.key(), destination_mint.key()).as_ref(),
            &[pool.bump],
        ],
        bump // Validate the bump
    )]
    pub pool_authority: AccountInfo<'info>,

    /// The user's token account for the token they are sending *in*.
    #[account(
        mut, // Needs to be mutable because its balance decreases
        // Ensure the user calling the instruction owns this account
        constraint = user_source_token_account.owner == user_authority.key() @ SwapError::InvalidOwner,
    )]
    pub user_source_token_account: InterfaceAccount<'info, TokenAccount>,

    /// The user's token account for the token they are receiving *out*.
    #[account(
        mut, // Needs to be mutable because its balance increases
        // Ensure the user calling the instruction owns this account
        constraint = user_destination_token_account.owner == user_authority.key() @ SwapError::InvalidOwner,
    )]
    pub user_destination_token_account: InterfaceAccount<'info, TokenAccount>,

    /// The pool's vault for Token A.
    #[account(
        mut, // Needs to be mutable for `reload()` and potentially receiving/sending tokens
        // Ensure the vault's mint matches one of the swap tokens
        constraint = (token_a_vault.mint == source_mint.key() || token_a_vault.mint == destination_mint.key()) @ SwapError::InvalidMint,
    )]
    pub token_a_vault: InterfaceAccount<'info, TokenAccount>,

    /// The pool's vault for Token B.
    #[account(
        mut, // Needs to be mutable for `reload()` and potentially receiving/sending tokens
        // Ensure the vault's mint matches one of the swap tokens
        constraint = (token_b_vault.mint == source_mint.key() || token_b_vault.mint == destination_mint.key()) @ SwapError::InvalidMint,
    )]
    pub token_b_vault: InterfaceAccount<'info, TokenAccount>,

    /// The mint account for the token being sent *in*.
    #[account(
        // Ensure the mint address matches the user's source token account's mint
        address = user_source_token_account.mint @ SwapError::InvalidMint,
    )]
    pub source_mint: InterfaceAccount<'info, Mint>,

    /// The mint account for the token being sent *out*.
    #[account(
        // Ensure the mint address matches the user's destination token account's mint
        address = user_destination_token_account.mint @ SwapError::InvalidMint,
    )]
    pub destination_mint: InterfaceAccount<'info, Mint>,

    /// The user performing the swap (signer).
    #[account(mut)] // Often needs to be mutable to pay transaction fees
    pub user_authority: Signer<'info>,

    /// SPL Token Program (or Token-2022 program).
    pub token_program: Interface<'info, TokenInterface>,
}

/// Defines the accounts required for the `process_transaction` instruction.
#[derive(Accounts)]
pub struct ProcessTransaction<'info> {
    /// The token account sending the tokens.
    #[account(
        mut, // Balance decreases
        // Ensure the authority signing owns this account
        constraint = sender_token_account.owner == authority.key() @ SwapError::InvalidOwner,
        // Ensure the token account's mint matches the provided mint account
        constraint = sender_token_account.mint == sender_token_account_mint.key() @ SwapError::InvalidMint,
    )]
    pub sender_token_account : InterfaceAccount<'info, TokenAccount>,

    /// The mint of the token being transferred.
    // No mut needed if only reading decimals. Address constraint moved to sender_token_account.
    #[account(address = sender_token_account.mint @ SwapError::InvalidMint)]
    pub sender_token_account_mint : InterfaceAccount<'info, Mint>,

    /// The token account receiving the tokens.
    #[account(
        mut, // Balance increases
        // Ensure the receiver account is for the same token type
        constraint = receiver_token_account.mint == sender_token_account_mint.key() @ SwapError::InvalidMint,
    )]
    pub receiver_token_account : InterfaceAccount<'info, TokenAccount>,

    /// SPL Token Program (or Token-2022 program).
    pub token_program: Interface<'info, TokenInterface>,

    /// The authority (signer) authorizing the transfer.
    #[account(mut, signer)]
    pub authority: Signer<'info>,
}

// --- Events ---

/// Event emitted when a simple transfer occurs via `process_transaction`.
#[event]
pub struct TransactionEvent {
    pub from: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
}

/// Event emitted when a swap occurs.
#[event]
pub struct SwapEvent {
    /// The address of the pool where the swap happened.
    pub pool: Pubkey,
    /// The address of the user who performed the swap.
    pub user: Pubkey,
    /// The amount of tokens sent into the pool.
    pub amount_in: u64,
    /// The amount of tokens sent out of the pool.
    pub amount_out: u64,
    /// The mint of the token sent into the pool.
    pub source_mint: Pubkey,
    /// The mint of the token sent out of the pool.
    pub destination_mint: Pubkey,
}

// --- Errors ---

/// Custom errors for the swap program.
#[error_code]
pub enum SwapError {
    #[msg("Invalid token mint provided")]
    InvalidMint,
    #[msg("Invalid destination token mint provided.")]
    InvalidDestinationMint,
    #[msg("Input amount must be greater than zero.")]
    ZeroAmount,
    #[msg("Pool reserve is zero, cannot swap.")]
    PoolIsEmpty,
    #[msg("Slippage tolerance exceeded.")]
    SlippageExceeded,
    #[msg("Calculation overflow during swap.")]
    CalculationOverflow,
    #[msg("Invalid vault account provided.")]
    InvalidVault,
    #[msg("Invalid owner of the token account.")]
    InvalidOwner,
}