use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum WinnerSide {
    None,
    Player1,
    Player2,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum GameRoomState {
    Created(CreatedGameRoom),
    Busy(BusyGameRoom),
    Finished(FinishedGameRoom),
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub struct CreatedGameRoom {
    pub player1: Pubkey,
    pub token_bid: u64,
    pub cards_permutation_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub struct BusyGameRoom {
    pub player1: Pubkey,
    pub player2: Pubkey,
    pub token_bid: u64,
    pub cards_permutation_hash: [u8; 32],
    pub vrf_seed: u32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub struct FinishedGameRoom {
    pub player1: Pubkey,
    pub token_bid: u64,
    pub cards_permutation_hash: [u8; 32],
    pub player2: Pubkey,
    pub seed: u32,
    pub winner: WinnerSide,
}


#[account]
pub struct GameRoom {
    pub state: GameRoomState,
}

impl Space for GameRoom {
    // Рассчитываем максимальный возможный размер
    const INIT_SPACE: usize = 8 + // discriminator for enum
        // CreatedGameRoom: 32 + 8 + 32 = 72
        // BusyGameRoom: 32 + 32 + 8 + 32 + 4 = 108
        // FinishedGameRoom: 32 + 8 + 32 + 32 + 4 + 1 = 109 (с выравниванием до 112)
        // Max ~112 + discriminator
        128; // conservative estimate with padding
}
