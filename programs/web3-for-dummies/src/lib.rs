use anchor_lang::prelude::*;
use anchor_spl::token_interface::{ Mint, TokenAccount, TokenInterface, TransferChecked, transfer_checked };

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

#[derive(Accounts)]
pub struct ProcessTransaction<'info> {
    /// CHECK: Verified by the client and via CPI
    #[account(
        mut,
        signer
    )]
    pub authority: AccountInfo<'info>,

    #[account(mut)]
    pub sender_token_account : InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub sender_token_account_mint : InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub receiver_token_account : InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,

}


#[event]
pub struct TransactionEvent {
    pub from: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
}