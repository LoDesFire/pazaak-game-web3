import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Pazaak } from '../target/types/pazaak';
import { expect } from 'chai';
import * as spl from '@solana/spl-token';
import { PublicKey, Keypair } from '@solana/web3.js';

describe('pazaak', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Pazaak as Program<Pazaak>;

  // Глобальные переменные для теста
  const player = provider.wallet as anchor.Wallet;
  const playerKeypair = Keypair.fromSecretKey(new Uint8Array(anchor.web3.Keypair.generate().secretKey));

  // Константы
  const ROOM_ID = new anchor.BN(1);
  const TOKEN_BID = new anchor.BN(1_000_000); // например, 1_000_000 lamports или 1 USDC (зависит от decimals)
  const CARDS_HASH = new Uint8Array(32).fill(1); // dummy hash

  // PDAs
  let gameRoomPda: PublicKey;
  let configPda: PublicKey;
  let tokenMint: PublicKey;
  let tokenTreasury: PublicKey;

  before(async () => {
    // 1. Инициализация кошелька (если нужно)
    const airdropTx = await provider.connection.requestAirdrop(
      playerKeypair.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropTx);

    // 2. Создание токена (например, mock USDC)
    tokenMint = await spl.createMint(
      provider.connection,
      playerKeypair,
      playerKeypair.publicKey,
      null,
      6 // 6 decimals
    );

    // 3. Получение PDA для config и treasury
    [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('config')],
      program.programId
    );

    [tokenTreasury] = PublicKey.findProgramAddressSync(
      [Buffer.from('treasury'), tokenMint.toBuffer()], // предположим, сид: "treasury" + mint
      program.programId
    );

    // 4. Создание казначейства (token treasury account)
    await spl.createAccount(
      provider.connection,
      playerKeypair,
      tokenMint,
      configPda // authority — config (или game authority), зависит от вашей логики
    );

    // 5. Создание PDA комнаты
    [gameRoomPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('pazaak-room'), ROOM_ID.toArray('le', 8)],
      program.programId
    );
  });

  it('Инициализирует GameConfig', async () => {
    // Предположим, что у вас есть инструкция initialize_config
    // Если нет — её нужно добавить
    try {
      await program.methods
        .initializeConfig(new anchor.BN(100_000)) // min bid
        .accounts({
          config: configPda,
          tokenMint: tokenMint,
          tokenTreasury: tokenTreasury,
          authority: playerKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([playerKeypair])
        .rpc();
    } catch (err) {
      // Если уже инициализирован — пропускаем
      console.log('Config уже инициализирован или ошибка:', err);
    }
  });

  it('Создаёт игровую комнату', async () => {
    // ATA игрока
    const playerTokenAccount = await spl.getOrCreateAssociatedTokenAccount(
      provider.connection,
      playerKeypair,
      tokenMint,
      playerKeypair.publicKey
    );

    // Пополняем баланс игрока
    await spl.mintTo(
      provider.connection,
      playerKeypair,
      tokenMint,
      playerTokenAccount.address,
      playerKeypair,
      TOKEN_BID.toNumber()
    );

    // Вызов инструкции create_game_room
    await program.methods
      .createGameRoom(ROOM_ID, TOKEN_BID, CARDS_HASH)
      .accounts({
        player: playerKeypair.publicKey,
        config: configPda,
        gameRoom: gameRoomPda,
        playerTokenAccount: playerTokenAccount.address,
        tokenTreasury: tokenTreasury,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
      })
      .signers([playerKeypair])
      .rpc();

    // Проверка: аккаунт комнаты создан
    const gameRoomAccount = await program.account.gameRoom.fetch(gameRoomPda);
    const state = gameRoomAccount.state as any;
    expect(state.player1).to.eql(playerKeypair.publicKey.toString());
    expect(state.tokenBid.toString()).to.eq(TOKEN_BID.toString());
    expect(Buffer.from(state.cardsPermutationHash)).to.eql(CARDS_HASH);

    console.log('Game room успешно создана:', gameRoomPda.toString());
  });
});
