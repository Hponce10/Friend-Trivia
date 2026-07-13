import { GameSettings, Player, Question, Tile } from './types';

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Scores never go below zero — wrong answers and lost wagers sting, but
// nobody gets mathematically buried (a dead-last player who can't recover
// checks out of the game).
export function clampScore(score: number): number {
  return Math.max(0, score);
}

// Scale game settings to the group size at board-build time: roughly one
// wildcard per 7 tiles (min 1, max 6) so a 10-tile board isn't all gimmick.
// Everyone Answers needs 3+ players (the owner sits out); steal/swap only
// get interesting once there are enough opponents to target.
export function settingsForGroup(
  settings: GameSettings,
  playerCount: number
): GameSettings {
  const tileCount = playerCount * 5;
  return {
    ...settings,
    wildcardCount: Math.min(6, Math.max(1, Math.round(tileCount / 7))),
    enabledWildcards:
      playerCount >= 6
        ? ['daily_double', 'double_or_nothing', 'steal', 'swap', 'everyone_answers']
        : playerCount >= 3
          ? [...new Set([...settings.enabledWildcards, 'everyone_answers' as const])]
          : settings.enabledWildcards,
  };
}

export function generateBoard(
  players: Player[],
  questions: Question[],
  settings: GameSettings
): Omit<Tile, 'id'>[] {
  const tiles: Omit<Tile, 'id'>[] = [];

  for (const player of players) {
    for (let tier = 1; tier <= 5; tier++) {
      const candidates = questions.filter(
        (q) => q.ownerPlayerId === player.id && q.tier === tier
      );
      if (candidates.length === 0) continue;
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      tiles.push({
        roomCode: player.roomCode,
        ownerPlayerId: player.id,
        questionId: chosen.id,
        pointValue: settings.pointScale[tier - 1],
        wildcardType: null,
        status: 'hidden',
      });
    }
  }

  const wildcardTiles = shuffle(tiles).slice(0, settings.wildcardCount);
  for (const tile of wildcardTiles) {
    tile.wildcardType =
      settings.enabledWildcards[
        Math.floor(Math.random() * settings.enabledWildcards.length)
      ];
  }

  return tiles;
}

export function resolveNormal(
  score: number,
  pointValue: number,
  correct: boolean,
  penaltyOnWrong: boolean
): number {
  if (correct) return score + pointValue;
  return penaltyOnWrong ? clampScore(score - pointValue) : score;
}

export function resolveDailyDouble(
  score: number,
  wager: number,
  correct: boolean
): number {
  return correct ? score + wager : clampScore(score - wager);
}

export function resolveDoubleOrNothing(
  score: number,
  pointValue: number,
  correct: boolean
): number {
  return correct ? score + 2 * pointValue : clampScore(score - 2 * pointValue);
}

export function resolveSteal(
  answererScore: number,
  opponentScore: number,
  pointValue: number,
  stolenAmount: number
): { answererScore: number; opponentScore: number } {
  // Can't steal more than the victim has — the floor is zero.
  const capped = Math.min(stolenAmount, pointValue, opponentScore);
  return {
    answererScore: answererScore + pointValue + capped,
    opponentScore: clampScore(opponentScore - capped),
  };
}

export function resolveSwap(
  playerAScore: number,
  playerBScore: number
): [number, number] {
  return [playerBScore, playerAScore];
}

export function pickFinalRoundQuestion(questions: Question[]): Question | null {
  const unused = questions.filter((q) => !q.usedInGame);
  if (unused.length === 0) return null;
  return unused[Math.floor(Math.random() * unused.length)];
}

// Lightning round pool: the unused half of everyone's question pairs,
// shuffled, capped so the round can actually finish. One is always held
// back for the Final Wager draw.
export function pickLightningQuestions(questions: Question[], cap = 15): string[] {
  const unused = shuffle(questions.filter((q) => !q.usedInGame));
  return unused.slice(0, Math.min(cap, Math.max(0, unused.length - 1))).map((q) => q.id);
}
