import { Answer, Game, Player, Question, Tile } from './types';
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
  updateGame,
  recordWin,
  bumpPlayerStats,
  announceVerdict,
} from './db';
import { recordEvent } from './recorder';
import { EAVerdict, FinalResult } from './replay';
import { randomVerdictGif } from './memes';

// Shared judging actions used by both the stage (TV) and the host console.
// All state lives in Firestore, so whichever surface calls these, both
// screens move together. Victory anthems are triggered via recordWin — the
// stage watches lastWin so the sound always comes from the TV.
// Each action also appends a replay event exactly once (whichever surface
// acted is the one that logs), carrying the scores it just wrote.

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
  // Kick off the stage's 3..2..1 + meme reveal before the scores move.
  await announceVerdict(game.roomCode, player, true, randomVerdictGif(true));
  const judged = (newScore: number, resolved: boolean) =>
    recordEvent(
      game.roomCode,
      'answer_judged',
      {
        tileId: tile.id,
        playerId: player.id,
        name: player.name,
        correct: true,
        delta: newScore - player.score,
        newScore,
        resolved,
      },
      { [player.id]: newScore }
    );
  if (tile.wildcardType === 'daily_double') {
    const newScore = resolveDailyDouble(player.score, stage.ddWager, true);
    await updatePlayerScore(player.id, newScore);
    judged(newScore, true);
    await finishTile(game.roomCode, tile, question, player.id);
    return;
  }
  if (tile.wildcardType === 'double_or_nothing') {
    const newScore = resolveDoubleOrNothing(player.score, tile.pointValue, true);
    await updatePlayerScore(player.id, newScore);
    judged(newScore, true);
    await finishTile(game.roomCode, tile, question, player.id);
    return;
  }
  if (tile.wildcardType === 'steal') {
    await updateStage(game.roomCode, { stealWinnerId: player.id, step: 'steal_pick' });
    // Scoring lands in judgeSteal / judgeStealSkip — the tile stays open.
    recordEvent(game.roomCode, 'answer_judged', {
      tileId: tile.id,
      playerId: player.id,
      name: player.name,
      correct: true,
      pendingSteal: true,
      resolved: false,
    });
    return;
  }
  const newScore = resolveNormal(player.score, tile.pointValue, true, true);
  await updatePlayerScore(player.id, newScore);
  judged(newScore, true);
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
  await announceVerdict(game.roomCode, player, false, randomVerdictGif(false));
  const judged = (newScore: number, resolved: boolean) =>
    recordEvent(
      game.roomCode,
      'answer_judged',
      {
        tileId: tile.id,
        playerId: player.id,
        name: player.name,
        correct: false,
        delta: newScore - player.score,
        newScore,
        resolved,
      },
      { [player.id]: newScore }
    );
  if (tile.wildcardType === 'daily_double') {
    const newScore = resolveDailyDouble(player.score, stage.ddWager, false);
    await updatePlayerScore(player.id, newScore);
    judged(newScore, true);
    await finishTile(game.roomCode, tile, question);
    return;
  }
  if (tile.wildcardType === 'double_or_nothing') {
    const newScore = resolveDoubleOrNothing(player.score, tile.pointValue, false);
    await updatePlayerScore(player.id, newScore);
    judged(newScore, true);
    await finishTile(game.roomCode, tile, question);
    return;
  }
  const newScore = resolveNormal(
    player.score,
    tile.pointValue,
    false,
    game.settings.penaltyOnWrong
  );
  await updatePlayerScore(player.id, newScore);
  judged(newScore, false); // others may still buzz — the tile stays open
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
  recordEvent(
    game.roomCode,
    'wildcard_used',
    {
      kind: 'steal',
      tileId: tile.id,
      winnerId: winner.id,
      name: winner.name,
      victimId: victim.id,
      amount,
      resolved: true,
    },
    { [winner.id]: result.answererScore, [victim.id]: result.opponentScore }
  );
  await finishTile(game.roomCode, tile, question, winner.id);
}

export async function judgeStealSkip(
  game: Game,
  tile: Tile,
  question: Question,
  winner: Player
): Promise<void> {
  const newScore = winner.score + tile.pointValue;
  await updatePlayerScore(winner.id, newScore);
  recordEvent(
    game.roomCode,
    'wildcard_used',
    {
      kind: 'steal_skip',
      tileId: tile.id,
      winnerId: winner.id,
      name: winner.name,
      delta: tile.pointValue,
      newScore,
      resolved: true,
    },
    { [winner.id]: newScore }
  );
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
  recordEvent(
    game.roomCode,
    'wildcard_used',
    { kind: 'swap', aId: playerA.id, bId: playerB.id },
    { [playerA.id]: newA, [playerB.id]: newB }
  );
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
    const newScore = owner.score + tile.pointValue;
    await updatePlayerScore(owner.id, newScore);
    void bumpPlayerStats(owner.id, { stumps: 1 }).catch(() => {});
    recordEvent(
      game.roomCode,
      'answer_judged',
      {
        tileId: tile.id,
        stump: true,
        playerId: owner.id,
        name: owner.name,
        delta: tile.pointValue,
        newScore,
        resolved: true,
      },
      { [owner.id]: newScore }
    );
    await finishTile(game.roomCode, tile, question, owner.id);
    return;
  }
  recordEvent(game.roomCode, 'answer_judged', {
    tileId: tile.id,
    stump: true,
    resolved: true,
  });
  await finishTile(game.roomCode, tile, question);
}

// Everyone Answers: apply all verdicts at once. Correct earns the tile
// value; wrong costs nothing (typing blind is risk enough). A full-room
// whiff still pays the owner's stump bonus. `answers` (the typed texts) is
// optional flavor for the replay — gameplay only needs the verdicts.
export async function applyEveryoneAnswers(
  game: Game,
  tile: Tile,
  question: Question,
  players: Player[],
  verdicts: Record<string, boolean>,
  answers: Answer[] = []
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
  const ea: EAVerdict[] = answerers.map((p) => {
    const correct = verdicts[p.id] === true;
    return {
      playerId: p.id,
      name: p.name,
      text: answers.find((a) => a.playerId === p.id)?.text ?? null,
      correct,
      delta: correct ? tile.pointValue : 0,
      newScore: correct ? p.score + tile.pointValue : p.score,
    };
  });
  recordEvent(
    game.roomCode,
    'answer_judged',
    { tileId: tile.id, ea, resolved: winners.length > 0 },
    Object.fromEntries(ea.map((v) => [v.playerId, v.newScore]))
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
  const newScore = correct ? player.score + perCorrect : player.score;
  if (correct) await updatePlayerScore(player.id, newScore);
  recordEvent(
    player.roomCode,
    'answer_judged',
    {
      lightning: true,
      playerId: player.id,
      name: player.name,
      correct,
      delta: newScore - player.score,
      newScore,
      resolved: false,
    },
    correct ? { [player.id]: newScore } : undefined
  );
}

// Final Wager resolution, shared by the stage and the console (it was
// duplicated on both before). finalScores rides the same write as
// status='completed' so the archive never reads a players snapshot that
// predates the wager updates.
export async function completeFinalRound(
  game: Game,
  players: Player[],
  verdicts: Record<string, boolean>
): Promise<void> {
  const finalScores: Record<string, number> = {};
  const results: FinalResult[] = [];
  for (const p of players) {
    const wager = p.finalWager ?? 0;
    const correct = verdicts[p.id] ?? false;
    const newScore = resolveDailyDouble(p.score, wager, correct);
    finalScores[p.id] = newScore;
    results.push({
      playerId: p.id,
      name: p.name,
      wager,
      correct,
      delta: newScore - p.score,
      newScore,
    });
  }
  await Promise.all(players.map((p) => updatePlayerScore(p.id, finalScores[p.id])));
  if (game.finalRound?.poolId) await markQuestionUsed(game.finalRound.poolId);
  recordEvent(game.roomCode, 'final_answer_judged', { results }, finalScores);
  await updateGame(game.roomCode, { status: 'completed', finalRound: null, finalScores });
}
