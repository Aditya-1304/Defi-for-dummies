use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token_interface::{ transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked }};

declare_id!("B53vYkHSs1vMQzofYfKjz6Unzv8P4TwCcvvTbMWVnctv");

#[program]
pub mod web3_for_dummies {
    use super::*;

    

    pub fn process_transaction(ctx: Context<ProcessTransaction>, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.sender_token_account.to_account_info(),
            mint: ctx.accounts.sender_token_account_mint.to_account_info(),
            to: ctx.accounts.receiver_token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };

        let cpi_program= ctx.accounts.token_program.to_account_info();
        let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
        let decimals = ctx.accounts.sender_token_account_mint.decimals;
        transfer_checked(cpi_context, amount, decimals)?;

        emit!(TransactionEvent {
            from: ctx.accounts.authority.key(),
            to: ctx.accounts.receiver_token_account.key(),
            amount,
        });
        Ok(())
    }

}



#[account]
#[derive(Default)]
pub struct LiquidityPool {
    pub token_a_mint: Pubkey,
    pub token_b_mint: Pubkey,
    pub token_a_vault: Pubkey,
    pub token_b_vault: Pubkey,
    pub bump: u8,
    pub vault_a_bump: u8,
    pub vault_b_bump: u8,

}

const POOL_ACCOUNT_SIZE: usize = 8 + 32 + 32 + 32 + 32 + 1 + 1 + 1 + 64;

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = initializer,
        seeds = [
            b"pool",
            min(token_a_mint.key(), token_b_mint.key()).as_ref(),
            max(token_a_mint.key(), token_b_mint.key()).as_ref(),
        ],
        bump,
        space = POOL_ACCOUNT_SIZE,
    )]
    pub pool: Account<'info, LiquidityPool>,

    #[account(
        seeds = [
            b"pool",
            min(token_a_mint.key(), token_b_mint.key()).as_ref(),
            max(token_a_mint.key(), token_b_mint.key()).as_ref(),
            &[pool.bump],
        ],
        bump,
    )]
    pub pool_authority: AccountInfo<'info>,

    pub token_a_mint: InterfaceAccount<'info, Mint>,
    pub token_b_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = initializer,
        associated_token::mint = token_a_mint,
        associated_token::authority = pool_authority,
    )]
    pub token_a_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = initializer,
        associated_token::mint = token_b_mint,
        associated_token::authority = pool_authority,
    )]
    pub token_b_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub initializer: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,

}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(
        seeds = [
            b"pool",
            min(source_mint.key(), destination_mint.key()).as_ref(),
            max(source_mint.key(), destination_mint.key()).as_ref(),
        ],
        bump = pool.bump,
        constraint = (pool.token_a_mint == source_mint.key() || pool.token_a_mint == destination_mint.key()) @ SwapError::InvalidMint,
        constraint = (pool.token_b_mint == source_mint.key() || pool.token_b_mint == destination_mint.key()) @ SwapError::InvalidMint,
    )]
    pub pool: Account<'info, LiquidityPool>,

    #[account(
        seeds = [
            b"pool",
            min(source_mint.key(), destination_mint.key()).as_ref(),
            max(source_mint.key(), destination_mint.key()).as_ref(),
            &[pool.bump],
        ],
        bump
    )]
    pub pool_authority: AccountInfo<'info>,

    #[account(mut)]
    pub user_source_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub user_destination_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub token_a_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub token_b_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        address = user_source_token_account.mint @ SwapError::InvalidMint,
    )]
    pub source_mint: InterfaceAccount<'info, Mint>,

    #[account(
        address = user_destination_token_account.mint @ SwapError::InvalidMint,
    )]
    pub destination_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub user_authority: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,

}

#[derive(Accounts)]
pub struct ProcessTransaction<'info> {
    /// CHECK: Verified by the client and via CPI

    #[account(mut)]
    pub sender_token_account : InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub sender_token_account_mint : InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub receiver_token_account : InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,


    #[account(mut, signer)]
    pub authority: Signer<'info>,
    


}
#[event]
pub struct TransactionEvent {
    pub from: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
}

#[event]
pub struct SwapEvent {
    pub pool: Pubkey,
    pub user: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,
    pub source_mint: Pubkey,
    pub destination_mint: Pubkey,
}

#[error_code]
pub enum SwapError {
    #[msg("Invalid token mint provided")]
    InvalidMint,
    #[msg("Invalid destination token mint provided.")]
    InvalidDestinationMint,
    #[msg("Input amount must be greater than zero.")]
    ZeroAmount,
    #[msg("Pool reserve is zero.")]
    PoolIsEmpty,
    #[msg("Slippage tolerance exceeded.")]
    SlippageExceeded,
    #[msg("Calculation overflow.")]
    CalculationOverflow,
    #[msg("Invalid vault account provided.")]
    InvalidVault,
} 
    
use std::cmp::{max, min};