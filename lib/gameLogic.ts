import { GameSettings, Player, Question, Tile } from './types';

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Scale game settings to the group size at board-build time. The base
// defaults (3 wildcards, two types) suit a small game; a 10-player board
// has 50 tiles and wants roughly one wildcard per 7 tiles, and steal/swap
// only get interesting once there are enough opponents to target.
export function settingsForGroup(
  settings: GameSettings,
  playerCount: number
): GameSettings {
  const tileCount = playerCount * 5;
  return {
    ...settings,
    wildcardCount: Math.max(settings.wildcardCount, Math.round(tileCount / 7)),
    enabledWildcards:
      playerCount >= 6
        ? ['daily_double', 'double_or_nothing', 'steal', 'swap']
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
  return penaltyOnWrong ? score - pointValue : score;
}

export function resolveDailyDouble(
  score: number,
  wager: number,
  correct: boolean
): number {
  return correct ? score + wager : score - wager;
}

export function resolveDoubleOrNothing(
  score: number,
  pointValue: number,
  correct: boolean
): number {
  return correct ? score + 2 * pointValue : score - 2 * pointValue;
}

export function resolveSteal(
  answererScore: number,
  opponentScore: number,
  pointValue: number,
  stolenAmount: number
): { answererScore: number; opponentScore: number } {
  const capped = Math.min(stolenAmount, pointValue);
  return {
    answererScore: answererScore + pointValue + capped,
    opponentScore: opponentScore - capped,
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
