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
  bumpPlayerStats,
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
  void bumpPlayerStats(player.id, { correct: 1 }).catch(() => {});
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
  void bumpPlayerStats(player.id, { wrong: 1 }).catch(() => {});
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

// Stump bonus: when the whole room whiffs, the question's owner banks the
// tile value — writing a good deep-cut question is play too. Their anthem
// plays via recordWin, same as any win.
export async function nobodyGotIt(
  game: Game,
  tile: Tile,
  question: Question,
  players: Player[]
): Promise<void> {
  const owner = players.find((p) => p.id === tile.ownerPlayerId);
  if (owner) {
    await updatePlayerScore(owner.id, owner.score + tile.pointValue);
    void bumpPlayerStats(owner.id, { stumps: 1 }).catch(() => {});
    await finishTile(game.roomCode, tile, question, owner.id);
    return;
  }
  await finishTile(game.roomCode, tile, question);
}

// Everyone Answers: apply all verdicts at once. Correct earns the tile
// value; wrong costs nothing (typing blind is risk enough). A full-room
// whiff still pays the owner's stump bonus.
export async function applyEveryoneAnswers(
  game: Game,
  tile: Tile,
  question: Question,
  players: Player[],
  verdicts: Record<string, boolean>
): Promise<void> {
  const answerers = players.filter((p) => p.id !== tile.ownerPlayerId);
  const winners = answerers.filter((p) => verdicts[p.id] === true);
  await Promise.all(
    answerers.map((p) => {
      const correct = verdicts[p.id] === true;
      void bumpPlayerStats(p.id, correct ? { correct: 1 } : { wrong: 1 }).catch(() => {});
      return correct
        ? updatePlayerScore(p.id, p.score + tile.pointValue)
        : Promise.resolve();
    })
  );
  if (winners.length === 0) {
    await nobodyGotIt(game, tile, question, players);
    return;
  }
  // Anthem honors go to the top scorer among the winners.
  const star = [...winners].sort((a, b) => b.score - a.score)[0];
  await finishTile(game.roomCode, tile, question, star.id);
}

// Lightning round: ✓ pays the flat rate and the host advances; ✗ costs
// nothing (pace over punishment) but counts against accuracy.
export async function lightningJudge(
  player: Player,
  correct: boolean,
  perCorrect: number
): Promise<void> {
  void bumpPlayerStats(player.id, correct ? { correct: 1 } : { wrong: 1 }).catch(() => {});
  if (correct) await updatePlayerScore(player.id, player.score + perCorrect);
}
