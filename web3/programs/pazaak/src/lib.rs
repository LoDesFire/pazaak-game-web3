use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

pub mod states;
use states::{
    game_config::GameConfig, game_room::CreatedGameRoom, game_room::GameRoom,
    game_room::GameRoomState,
};

declare_id!("4vgRgThcJSXbP2a4qjwvWqxXwWxiDchUkpRvRQiuMUkR");

pub const GAME_ROOM_SEED: &[u8] = b"pazaak-room";
pub const GAME_CONFIG_SEED: &[u8] = b"pazaak-config";

#[program]
pub mod pazaak {
    use super::*;

    pub fn create_game_room(
        ctx: Context<CreateGameRoom>,
        room_id: u64,
        token_bid: u64,
        cards_permutation_hash: [u8; 32],
    ) -> Result<()> {
        require!(
            token_bid >= ctx.accounts.config.token_minimal_bid,
            PazaakError::BidTooSmall
        );

        let game_room = &mut ctx.accounts.game_room;
        game_room.state = GameRoomState::Created(CreatedGameRoom {
            player1: ctx.accounts.player.key(),
            token_bid,
            cards_permutation_hash,
        });

        // Перевод токенов
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_accounts = Transfer {
            from: ctx.accounts.player_token_account.to_account_info(),
            to: ctx.accounts.token_treasury.to_account_info(),
            authority: ctx.accounts.player.to_account_info(),
        };

        // CPI не требует подписи PDA здесь, т.к. authority — игрок (Signer)
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, token_bid)?;

        msg!("Game room #{} created", room_id);
        Ok(())
    }
}

// =============================================
// == Accounts
// =============================================

#[derive(Accounts)]
#[instruction(room_id: u64)]
pub struct CreateGameRoom<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(
        seeds = [GAME_CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, GameConfig>,
    #[account(
        init,
        payer = player,
        space = 8 + GameRoom::INIT_SPACE,
        seeds = [GAME_ROOM_SEED, room_id.to_le_bytes().as_ref()],
        bump
    )]
    pub game_room: Account<'info, GameRoom>,
    #[account(
        mut,
        associated_token::mint = config.token_mint,
        associated_token::authority = player
    )]
    pub player_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = config.token_mint
    )]
    pub token_treasury: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// =============================================
// == Errors
// =============================================

#[error_code]
pub enum PazaakError {
    #[msg("Bid is smaller than minimal required bid")]
    BidTooSmall,
}
