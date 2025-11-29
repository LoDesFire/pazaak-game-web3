import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Pazaak } from "../target/types/pazaak";
import * as spl from "@solana/spl-token";
import { PublicKey, Keypair } from "@solana/web3.js";

/**
 * Стендэлон-скрипт для запуска через `tsc && node`.
 * Шаги: создаёт mint/treasury, инициализирует GameConfig, минтит токены игроку и создаёт комнату
 * с отдельным PDA-казначейством комнаты.
 */

const CONFIG_SEED = Buffer.from("pazaak-config");
const ROOM_SEED = Buffer.from("pazaak-room");
const ROOM_TREASURY_SEED = Buffer.from("pazaak-room-treasury");

const ROOM_ID = new anchor.BN(12);
const TOKEN_BID = new anchor.BN(1_000_000); // 1.0 при decimals=6
const MIN_BID = new anchor.BN(10_000);
const CARDS_HASH = new Uint8Array(32).fill(1);

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Pazaak as Program<Pazaak>;
  const player = provider.wallet as anchor.Wallet;
  const playerKeypair = player.payer as Keypair;

  console.log("Payer:", playerKeypair.publicKey.toBase58());

  // Airdrop для покрытия транзакций
  // const airdropTx = await provider.connection.requestAirdrop(
  //   playerKeypair.publicKey,
  //   2 * anchor.web3.LAMPORTS_PER_SOL
  // );
  // await provider.connection.confirmTransaction(airdropTx);

  // PDA конфигурации и комнаты
  const [configPda] = PublicKey.findProgramAddressSync(
    [CONFIG_SEED],
    program.programId
  );
  const [gameRoomPda] = PublicKey.findProgramAddressSync(
    [ROOM_SEED, Buffer.from(ROOM_ID.toArray("le", 8))],
    program.programId
  );
  const [roomTreasuryPda] = PublicKey.findProgramAddressSync(
    [ROOM_TREASURY_SEED, Buffer.from(ROOM_ID.toArray("le", 8))],
    program.programId
  );

  // // Создаём тестовый mint
  // const tokenMint = await spl.createMint(
  //   provider.connection,
  //   playerKeypair,
  //   playerKeypair.publicKey,
  //   null,
  //   6
  // );
  let tokenMint = new PublicKey("DVv7y8qy85tQWhoxS8jfET1eABgSgrqE5M3MCr8Sg3Kd");

  // // Казначейство (ATA) для config
  const treasuryAccount = await spl.getOrCreateAssociatedTokenAccount(
    provider.connection,
    playerKeypair,
    tokenMint,
    playerKeypair.publicKey
  );
  const tokenTreasury = treasuryAccount.address;

  // Инициализация GameConfig
  await program.methods
    .initializeGameConfig(playerKeypair.publicKey, MIN_BID)
    .accounts({
      configAuthority: playerKeypair.publicKey,
      gameAuthority: playerKeypair.publicKey,
      tokenMint,
      tokenTreasury,
    })
    .signers([playerKeypair])
    .rpc();
  console.log("GameConfig initialized at", configPda.toBase58());

  // let cfg = await program.account.gameConfig.fetch(configPda);
  // let tokenMint = cfg.tokenMint;
  // let tokenTreasury = cfg.tokenTreasury;

  // ATA игрока и пополнение
  // const playerTokenAccount = await spl.getOrCreateAssociatedTokenAccount(
  //   provider.connection,
  //   playerKeypair,
  //   tokenMint,
  //   playerKeypair.publicKey
  // );
  // await spl.mintTo(
  //   provider.connection,
  //   playerKeypair,
  //   tokenMint,
  //   playerTokenAccount.address,
  //   playerKeypair,
  //   TOKEN_BID.toNumber()
  // );

  // // Создание комнаты (ставка уходит в roomTreasury PDA)
  // const tx = await program.methods
  //   .createGameRoom(ROOM_ID, TOKEN_BID, Array.from(CARDS_HASH))
  //   .accounts({
  //     player: playerKeypair.publicKey,
  //     tokenMint: tokenMint,
  //   })
  //   .signers([playerKeypair])
  //   .rpc();
  // console.log("Game room created at", gameRoomPda.toBase58(), "tx", tx);

  // // Вывод состояния комнаты
  // const gameRoomAccount = await program.account.gameRoom.fetch(gameRoomPda);
  // console.log("Game room account:", JSON.stringify(gameRoomAccount, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
