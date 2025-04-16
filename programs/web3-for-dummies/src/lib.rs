use anchor_lang::{prelude::*, system_program};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{ 
        self,
        transfer_checked, 
        Mint, 
        TokenAccount, 
        TokenInterface, 
        TransferChecked,
        MintTo,
        mint_to,
        Burn,
        burn
     }};


declare_id!("B53vYkHSs1vMQzofYfKjz6Unzv8P4TwCcvvTbMWVnctv");

#[program]
pub mod web3_for_dummies {

    use super::*;

    pub fn initialize_pool(ctx: Context<InitializePool>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.token_a_mint = ctx.accounts.token_a_mint.key();
        pool.token_b_mint = ctx.accounts.token_b_mint.key();
        pool.token_a_vault = ctx.accounts.token_a_vault.key();
        pool.token_b_vault = ctx.accounts.token_b_vault.key();
        pool.bump = ctx.bumps.pool;
        pool.vault_a_bump = ctx.bumps.token_a_vault;
        pool.vault_b_bump = ctx.bumps.token_b_vault;

        msg!("Pool Initialized!");
        msg!("Mint A: {}", pool.token_a_mint);
        msg!("Mint B: {}", pool.token_b_mint);
        msg!("Vault A: {}", pool.token_a_vault);
        msg!("Vault B: {}", pool.token_b_vault);

        Ok(())

    }    

    pub fn swap(ctx: Context<Swap>, amount_in: u64, min_amount_out: u64) -> Result<()> {
        let pool = &ctx.accounts.pool;

        let (source_vault, source_vault_bump, dest_vault, dest_vault_bump, source_mint_decimals) =
            if ctx.accounts.user_source_token_account.mint == pool.token_a_mint {
                (
                    &ctx.accounts.token_a_vault,
                    pool.vault_a_bump,
                    &ctx.accounts.token_b_vault,
                    pool.vault_b_bump,
                    ctx.accounts.token_a_mint.decimals,
                )
            } else if ctx.accounts.user_source_token_account.mint == pool.token_b_mint {
                (
                    &ctx.accounts.token_b_vault,
                    pool.vault_b_bump,
                    &ctx.accounts.token_a_vault,
                    pool.vault_a_bump,
                    ctx.accounts.token_b_mint.decimals,
                )
            } else {
                return err!(SwapError::InvalidDestinationMint)
            };

            if ctx.accounts.user_destination_token_account.mint != dest_vault.mint {
                return err!(SwapError::InvalidDestinationMint);
            }

            source_vault.reload()?;
            dest_vault.reload()?;
            let reserve_in = source_vault.amount;
            let reserve_out = dest_vault.amount;


            let amount_in_u128 = amount_in as u128;
            let reserve_in_u128 = reserve_in as u128;
            let reserve_out_u128 = reserve_out as u128;

            if reserve_in == 0 || reserve_out == 0 {
                return  err!(SwapError::PoolIsEmpty);
            }
            if amount_in == 0 {
                return err!(SwapError::ZeroAmount)
            }

            let constant_product = reserve_in_u128.checked_mul(reserve_out_u128).ok_or(SwapError::CalculationOverflow)?;

            let new_reserve_in = reserve_in_u128.checked_add(amount_in_u128).ok_or(SwapError::CalculationOverflow);

            let new_reserve_out = constant_product.checked_div(new_reserve_in).ok_or(SwapError::CalculationOverflow)?;

            let amount_out_u128 = reserve_out_u128.checked_sub(new_reserve_out).ok_or(SwapError::CalculationOverflow)?;

            let amount_out = amount_out_u128 as u64;

            if amount_out < min_amount_out {
                return err!(SwapError::SlippageExceeded);
            }

            let transfer_in_accounts = TransferChecked {
                from: ctx.accounts.user_source_token_account.to_account_info(),
                mint: ctx.accounts.source_mint.to_account_info(),
                to: source_vault.to_account_info(),
                authority: ctx.accounts.user_authority.to_account_info(),
            };

            let transfer_in_cpi = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                transfer_in_accounts,
            );
            transfer_checked(transfer_in_cpi,amount_in, source_mint_decimals);


            let pool_signer_seeds : &[&[&[u8]]] = &[&[
                b"pool",
                pool.token_a_mint.as_ref(),
                pool.token_b_mint.as_ref(),
                &[pool.bump]
            ]];
        
            let transfer_out_accounts = TransferChecked {
                from: dest_vault.to_account_info(),
                mint: ctx.accounts.destination_mint.to_account_info(),
                to: ctx.accounts.user_destination_token_account.to_account_info(),
                authority: ctx.accounts.pool_authority.to_account_info(),
            };

            let transfer_out_cpi = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_out_accounts,
                pool_signer_seeds,
            );

            transfer_checked(transfer_out_cpi, amount_out, dest_vault.decimals)?;

            emit!(SwapEvent {
                pool: ctx.accounts.pool.key(),
                user: ctx.accounts.user_authority.key(),
                amount_in,
                amount_out,
                source_mint: ctx.accounts.source_mint.key(),
                destination_mint: ctx.accounts.destination_mint.key()
            });
        Ok(())
    }

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