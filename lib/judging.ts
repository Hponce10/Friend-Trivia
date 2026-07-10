import { Game, Player, Question, Tile } from './types';
import {
  resolveNormal,
  resolveDailyDouble,
  resolveDoubleOrNothing,
  resolveSteal,
  resolveSwap,
} from './gameLogic';
import {
  updatePlayerScore,
  updateTile,
  markQuestionUsed,
  closeStage,
  updateStage,
  recordWin,
} from './db';

// Shared judging actions used by both the stage (TV) and the host console.
// All state lives in Firestore, so whichever surface calls these, both
// screens move together. Victory anthems are triggered via recordWin — the
// stage watches lastWin so the sound always comes from the TV.

async function finishTile(
  roomCode: string,
  tile: Tile,
  question: Question,
  winnerId?: string
): Promise<void> {
  await updateTile(tile.id, { status: 'used' });
  await markQuestionUsed(question.id);
  if (winnerId) await recordWin(roomCode, winnerId);
  await closeStage(roomCode);
}

export async function judgeCorrect(
  game: Game,
  tile: Tile,
  question: Question,
  player: Player
): Promise<void> {
  const stage = game.stage!;
  if (tile.wildcardType === 'daily_double') {
    await updatePlayerScore(player.id, resolveDailyDouble(player.score, stage.ddWager, true));
    await finishTile(game.roomCode, tile, question, player.id);
    return;
  }
  if (tile.wildcardType === 'double_or_nothing') {
    await updatePlayerScore(
      player.id,
      resolveDoubleOrNothing(player.score, tile.pointValue, true)
    );
    await finishTile(game.roomCode, tile, question, player.id);
    return;
  }
  if (tile.wildcardType === 'steal') {
    await updateStage(game.roomCode, { stealWinnerId: player.id, step: 'steal_pick' });
    return;
  }
  await updatePlayerScore(player.id, resolveNormal(player.score, tile.pointValue, true, true));
  await finishTile(game.roomCode, tile, question, player.id);
}

export async function judgeWrong(
  game: Game,
  tile: Tile,
  question: Question,
  player: Player
): Promise<void> {
  const stage = game.stage!;
  if (tile.wildcardType === 'daily_double') {
    await updatePlayerScore(player.id, resolveDailyDouble(player.score, stage.ddWager, false));
    await finishTile(game.roomCode, tile, question);
    return;
  }
  if (tile.wildcardType === 'double_or_nothing') {
    await updatePlayerScore(
      player.id,
      resolveDoubleOrNothing(player.score, tile.pointValue, false)
    );
    await finishTile(game.roomCode, tile, question);
    return;
  }
  await updatePlayerScore(
    player.id,
    resolveNormal(player.score, tile.pointValue, false, game.settings.penaltyOnWrong)
  );
  await updateStage(game.roomCode, { lockedOut: [...stage.lockedOut, player.id] });
}

export async function judgeSteal(
  game: Game,
  tile: Tile,
  question: Question,
  winner: Player,
  victim: Player,
  amount: number
): Promise<void> {
  const result = resolveSteal(winner.score, victim.score, tile.pointValue, amount);
  await updatePlayerScore(winner.id, result.answererScore);
  await updatePlayerScore(victim.id, result.opponentScore);
  await finishTile(game.roomCode, tile, question, winner.id);
}

export async function judgeStealSkip(
  game: Game,
  tile: Tile,
  question: Question,
  winner: Player
): Promise<void> {
  await updatePlayerScore(winner.id, winner.score + tile.pointValue);
  await finishTile(game.roomCode, tile, question, winner.id);
}

export async function performSwap(
  game: Game,
  playerA: Player,
  playerB: Player
): Promise<void> {
  const [newA, newB] = resolveSwap(playerA.score, playerB.score);
  await updatePlayerScore(playerA.id, newA);
  await updatePlayerScore(playerB.id, newB);
  await updateStage(game.roomCode, { step: 'question' });
}

export async function nobodyGotIt(
  game: Game,
  tile: Tile,
  question: Question
): Promise<void> {
  await finishTile(game.roomCode, tile, question);
}
