import { describe, it, expect } from 'vitest';
import {
  generateBoard,
  resolveNormal,
  resolveDailyDouble,
  resolveDoubleOrNothing,
  resolveSteal,
  resolveSwap,
  pickFinalRoundQuestion,
  settingsForGroup,
} from './gameLogic';
import { Player, Question, GameSettings, DEFAULT_SETTINGS } from './types';

function makePlayers(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    roomCode: 'ROOM',
    name: `Player ${i}`,
    score: 0,
    submitted: true,
  }));
}

function makeQuestions(players: Player[]): Question[] {
  const questions: Question[] = [];
  for (const player of players) {
    for (let tier = 1; tier <= 5; tier++) {
      for (let dup = 0; dup < 2; dup++) {
        questions.push({
          id: `${player.id}-t${tier}-${dup}`,
          roomCode: 'ROOM',
          ownerPlayerId: player.id,
          tier: tier as 1 | 2 | 3 | 4 | 5,
          text: `Q ${player.id} ${tier} ${dup}`,
          answer: 'A',
          usedInGame: false,
        });
      }
    }
  }
  return questions;
}

describe('generateBoard', () => {
  it('produces 5 tiles per player', () => {
    const players = makePlayers(4);
    const questions = makeQuestions(players);
    const tiles = generateBoard(players, questions, DEFAULT_SETTINGS);
    expect(tiles.length).toBe(players.length * 5);
  });

  it('assigns the correct point value per tier via the chosen question', () => {
    const players = makePlayers(2);
    const questions = makeQuestions(players);
    const tiles = generateBoard(players, questions, DEFAULT_SETTINGS);
    for (const tile of tiles) {
      const q = questions.find((q) => q.id === tile.questionId)!;
      expect(tile.pointValue).toBe(DEFAULT_SETTINGS.pointScale[q.tier - 1]);
    }
  });

  it('flags exactly wildcardCount tiles with a valid wildcard type', () => {
    const players = makePlayers(6);
    const questions = makeQuestions(players);
    const settings: GameSettings = { ...DEFAULT_SETTINGS, wildcardCount: 3 };
    const tiles = generateBoard(players, questions, settings);
    const wildcardTiles = tiles.filter((t) => t.wildcardType !== null);
    expect(wildcardTiles.length).toBe(3);
    for (const tile of wildcardTiles) {
      expect(settings.enabledWildcards).toContain(tile.wildcardType);
    }
  });

  it('picks one of the two submitted questions per tier, never both or neither', () => {
    const players = makePlayers(1);
    const questions = makeQuestions(players);
    const tiles = generateBoard(players, questions, DEFAULT_SETTINGS);
    expect(tiles.length).toBe(5);
    const tiers = tiles.map((t) => questions.find((q) => q.id === t.questionId)!.tier);
    expect(new Set(tiers).size).toBe(5);
  });
});

describe('resolveNormal', () => {
  it('adds points on correct answer', () => {
    expect(resolveNormal(100, 200, true, true)).toBe(300);
  });
  it('subtracts points on wrong answer when penalty is on', () => {
    expect(resolveNormal(100, 200, false, true)).toBe(-100);
  });
  it('leaves score unchanged on wrong answer when penalty is off', () => {
    expect(resolveNormal(100, 200, false, false)).toBe(100);
  });
});

describe('resolveDailyDouble', () => {
  it('adds the wager on correct', () => {
    expect(resolveDailyDouble(500, 300, true)).toBe(800);
  });
  it('subtracts the wager on incorrect', () => {
    expect(resolveDailyDouble(500, 300, false)).toBe(200);
  });
});

describe('resolveDoubleOrNothing', () => {
  it('doubles the tile value on correct', () => {
    expect(resolveDoubleOrNothing(100, 200, true)).toBe(500);
  });
  it('loses double the tile value on incorrect', () => {
    expect(resolveDoubleOrNothing(500, 200, false)).toBe(100);
  });
});

describe('resolveSteal', () => {
  it('answerer gains pointValue plus stolen amount, opponent loses stolen amount', () => {
    const result = resolveSteal(100, 500, 200, 150);
    expect(result.answererScore).toBe(100 + 200 + 150);
    expect(result.opponentScore).toBe(500 - 150);
  });
  it('caps the stolen amount at pointValue', () => {
    const result = resolveSteal(100, 500, 200, 999);
    expect(result.answererScore).toBe(100 + 200 + 200);
    expect(result.opponentScore).toBe(500 - 200);
  });
});

describe('resolveSwap', () => {
  it('swaps the two scores', () => {
    expect(resolveSwap(300, 700)).toEqual([700, 300]);
  });
});

describe('pickFinalRoundQuestion', () => {
  it('only picks from unused questions', () => {
    const players = makePlayers(2);
    const questions = makeQuestions(players);
    questions[0].usedInGame = false;
    questions.slice(1).forEach((q) => (q.usedInGame = true));
    const picked = pickFinalRoundQuestion(questions);
    expect(picked?.id).toBe(questions[0].id);
  });
  it('returns null when no unused questions remain', () => {
    const players = makePlayers(1);
    const questions = makeQuestions(players).map((q) => ({ ...q, usedInGame: true }));
    expect(pickFinalRoundQuestion(questions)).toBeNull();
  });
});

describe('settingsForGroup', () => {
  it('keeps the base defaults for a small group', () => {
    const scaled = settingsForGroup(DEFAULT_SETTINGS, 3);
    expect(scaled.wildcardCount).toBe(3); // 15 tiles / 7 ≈ 2, base 3 wins
    expect(scaled.enabledWildcards).toEqual(DEFAULT_SETTINGS.enabledWildcards);
  });

  it('scales wildcards up and enables all types for a big group', () => {
    const scaled = settingsForGroup(DEFAULT_SETTINGS, 10);
    expect(scaled.wildcardCount).toBe(7); // 50 tiles / 7 ≈ 7
    expect(scaled.enabledWildcards).toEqual([
      'daily_double',
      'double_or_nothing',
      'steal',
      'swap',
    ]);
  });

  it('enables all wildcard types starting at 6 players', () => {
    expect(settingsForGroup(DEFAULT_SETTINGS, 5).enabledWildcards).toHaveLength(2);
    expect(settingsForGroup(DEFAULT_SETTINGS, 6).enabledWildcards).toHaveLength(4);
  });

  it('never lowers an explicit wildcard count', () => {
    const custom = { ...DEFAULT_SETTINGS, wildcardCount: 12 };
    expect(settingsForGroup(custom, 4).wildcardCount).toBe(12);
  });
});
