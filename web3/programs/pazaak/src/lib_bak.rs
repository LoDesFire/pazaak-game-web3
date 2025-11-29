use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

pub mod states;
use states::{
    game_config::GameConfig, game_room::CreatedGameRoom, game_room::GameRoom,
    game_room::GameRoomState,
};

declare_id!("E2Gdsj1RKoVGPTWZVN8qvZDYtD9AXPRZBVj6nvDJJ34C");

pub const GAME_ROOM_SEED: &[u8] = b"pazaak-room";
pub const GAME_CONFIG_SEED: &[u8] = b"pazaak-config";
pub const ROOM_TREASURY_SEED: &[u8] = b"pazaak-room-treasury";

#[program]
pub mod pazaak {
    use super::*;

    pub fn initialize_game_config(
        ctx: Context<InitializeGameConfig>,
        game_authority: Pubkey,
        token_minimal_bid: u64,
    ) -> Result<()> {
        require!(token_minimal_bid > 0, PazaakError::InvalidMinimalBid);

        let config = &mut ctx.accounts.config;
        config.config_authority = ctx.accounts.config_authority.key();
        config.game_authority = game_authority;
        config.token_mint = ctx.accounts.token_mint.key();
        config.token_treasury = ctx.accounts.token_treasury.key();
        config.token_minimal_bid = token_minimal_bid;

        Ok(())
    }

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
            to: ctx.accounts.room_treasury.to_account_info(),
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
pub struct InitializeGameConfig<'info> {
    #[account(mut)]
    pub config_authority: Signer<'info>,
    /// CHECK:
    pub game_authority: UncheckedAccount<'info>,
    #[account(
        init,
        payer = config_authority,
        space = 8 + GameConfig::INIT_SPACE,
        seeds = [GAME_CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, GameConfig>,
    pub token_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = token_treasury.mint == token_mint.key() @ PazaakError::InvalidTreasuryMint
    )]
    pub token_treasury: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

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
        init,
        payer = player,
        seeds = [ROOM_TREASURY_SEED, room_id.to_le_bytes().as_ref()],
        bump,
        token::mint = token_mint,
        token::authority = game_room
    )]
    pub room_treasury: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = config.token_mint,
        associated_token::authority = player
    )]
    pub player_token_account: Account<'info, TokenAccount>,
    #[account(address = config.token_mint)]
    pub token_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// =============================================
// == Errors
// =============================================

#[error_code]
pub enum PazaakError {
    #[msg("Bid is smaller than minimal required bid")]
    BidTooSmall,
    #[msg("Minimal bid must be greater than zero")]
    InvalidMinimalBid,
    #[msg("Token treasury mint mismatch")]
    InvalidTreasuryMint,
}
