import { describe, it, expect } from 'vitest';
import {
  generateBoard,
  rollWildcard,
  resolveNormal,
  resolveDailyDouble,
  resolveDoubleOrNothing,
  resolveSteal,
  resolveSwap,
  pickFinalRoundQuestion,
  pickLightningQuestions,
  settingsForGroup,
} from './gameLogic';
import { Player, Question, DEFAULT_SETTINGS, WildcardType } from './types';

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

  it('bakes NO wildcards into tiles — they roam via rollWildcard at open time', () => {
    const players = makePlayers(6);
    const questions = makeQuestions(players);
    const tiles = generateBoard(players, questions, {
      ...DEFAULT_SETTINGS,
      wildcardCount: 3,
    });
    expect(tiles.every((t) => t.wildcardType === null)).toBe(true);
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

describe('rollWildcard', () => {
  const enabled: WildcardType[] = ['daily_double', 'double_or_nothing'];

  it('never rolls with no budget, no hidden tiles, or no enabled types', () => {
    expect(rollWildcard(0, 10, enabled, () => 0)).toBeNull();
    expect(rollWildcard(2, 0, enabled, () => 0)).toBeNull();
    expect(rollWildcard(2, 10, [], () => 0)).toBeNull();
  });

  it('is guaranteed when as many wildcards remain as hidden tiles', () => {
    // remaining/hidden === 1 → forced, no matter the rng draw.
    expect(rollWildcard(3, 3, enabled, () => 0.999999)).not.toBeNull();
    expect(rollWildcard(5, 3, enabled, () => 0.999999)).not.toBeNull();
  });

  it('respects the odds and picks only enabled types', () => {
    // 2 remaining / 10 hidden = 0.2 odds.
    expect(rollWildcard(2, 10, enabled, () => 0.19)).not.toBeNull();
    expect(rollWildcard(2, 10, enabled, () => 0.2)).toBeNull();
    const rolled = rollWildcard(2, 10, enabled, () => 0.1);
    expect(enabled).toContain(rolled);
  });

  it('surfaces exactly the budgeted count over a full board, wherever the rng lands', () => {
    // Simulate opening every tile of a 15-tile board with 2 wildcards, the
    // way openTile does: roll against remaining/hidden, decrement on a hit.
    for (let trial = 0; trial < 200; trial++) {
      let remaining = 2;
      let rolledCount = 0;
      for (let hidden = 15; hidden >= 1; hidden--) {
        if (rollWildcard(remaining, hidden, enabled) !== null) {
          remaining--;
          rolledCount++;
        }
      }
      expect(rolledCount).toBe(2);
    }
  });
});

describe('resolveNormal', () => {
  it('adds points on correct answer', () => {
    expect(resolveNormal(100, 200, true, true)).toBe(300);
  });
  it('subtracts points on wrong answer when penalty is on, floored at 0', () => {
    expect(resolveNormal(100, 200, false, true)).toBe(0);
    expect(resolveNormal(500, 200, false, true)).toBe(300);
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
  it('never drops below zero (final-wager floor lets 0-score players wager)', () => {
    expect(resolveDailyDouble(0, 100, false)).toBe(0);
  });
});

describe('resolveDoubleOrNothing', () => {
  it('doubles the tile value on correct', () => {
    expect(resolveDoubleOrNothing(100, 200, true)).toBe(500);
  });
  it('loses double the tile value on incorrect, floored at 0', () => {
    expect(resolveDoubleOrNothing(500, 200, false)).toBe(100);
    expect(resolveDoubleOrNothing(100, 200, false)).toBe(0);
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
  it('cannot steal more than the victim has — victim floors at 0', () => {
    const result = resolveSteal(100, 50, 200, 200);
    expect(result.answererScore).toBe(100 + 200 + 50);
    expect(result.opponentScore).toBe(0);
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
  it('derives wildcard density from board size (≈1 per 7 tiles, min 1)', () => {
    expect(settingsForGroup(DEFAULT_SETTINGS, 2).wildcardCount).toBe(1); // 10 tiles
    expect(settingsForGroup(DEFAULT_SETTINGS, 3).wildcardCount).toBe(2); // 15 tiles
    expect(settingsForGroup(DEFAULT_SETTINGS, 6).wildcardCount).toBe(4); // 30 tiles
  });

  it('caps wildcards at 6 for big groups and enables every type', () => {
    const scaled = settingsForGroup(DEFAULT_SETTINGS, 10);
    expect(scaled.wildcardCount).toBe(6); // 50 tiles / 7 ≈ 7, capped
    expect(scaled.enabledWildcards).toEqual([
      'daily_double',
      'double_or_nothing',
      'steal',
      'swap',
      'everyone_answers',
    ]);
  });

  it('adds everyone_answers from 3 players (owner sits out) but not at 2', () => {
    expect(settingsForGroup(DEFAULT_SETTINGS, 2).enabledWildcards).toEqual(
      DEFAULT_SETTINGS.enabledWildcards
    );
    expect(settingsForGroup(DEFAULT_SETTINGS, 3).enabledWildcards).toContain(
      'everyone_answers'
    );
    expect(settingsForGroup(DEFAULT_SETTINGS, 5).enabledWildcards).toHaveLength(3);
    expect(settingsForGroup(DEFAULT_SETTINGS, 6).enabledWildcards).toHaveLength(5);
  });
});

describe('pickLightningQuestions', () => {
  it('draws only unused questions and always leaves one for the final', () => {
    const players = makePlayers(1);
    const questions = makeQuestions(players); // 10, all unused
    const picked = pickLightningQuestions(questions);
    expect(picked.length).toBe(9); // one held back
    for (const id of picked) {
      expect(questions.find((q) => q.id === id)!.usedInGame).toBe(false);
    }
  });

  it('caps the pool so the round can finish', () => {
    const players = makePlayers(4);
    const questions = makeQuestions(players); // 40 unused
    expect(pickLightningQuestions(questions).length).toBe(15);
  });

  it('returns empty when nothing is unused', () => {
    const players = makePlayers(1);
    const questions = makeQuestions(players).map((q) => ({ ...q, usedInGame: true }));
    expect(pickLightningQuestions(questions)).toEqual([]);
  });
});
