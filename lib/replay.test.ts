import { describe, expect, it } from 'vitest';
import {
  assignPlacements,
  compileGameRecord,
  frameAt,
  RawGameEvent,
} from './replay';
import { DEFAULT_SETTINGS, Game, Player, Question, Tile } from './types';

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    roomCode: 'TEST',
    status: 'completed',
    settings: DEFAULT_SETTINGS,
    createdAt: 1000,
    ...overrides,
  };
}

function makePlayer(id: string, name: string, score: number): Player {
  return { id, roomCode: 'TEST', name, score, submitted: true };
}

const players = [
  makePlayer('a', 'Ana', 500),
  makePlayer('b', 'Bo', 500),
  makePlayer('c', 'Cy', 100),
];

const questions: Question[] = [
  {
    id: 'q1',
    roomCode: 'TEST',
    ownerPlayerId: 'a',
    tier: 1,
    text: 'Q one?',
    answer: 'A one',
    usedInGame: true,
  },
];

const tiles: Tile[] = [
  {
    id: 't1',
    roomCode: 'TEST',
    ownerPlayerId: 'a',
    questionId: 'q1',
    pointValue: 100,
    wildcardType: null,
    status: 'used',
  },
];

describe('assignPlacements', () => {
  it('shares placement on ties and skips past them', () => {
    const p = assignPlacements([
      { id: 'a', score: 500 },
      { id: 'b', score: 500 },
      { id: 'c', score: 100 },
    ]);
    expect(p.get('a')).toBe(1);
    expect(p.get('b')).toBe(1);
    expect(p.get('c')).toBe(3);
  });
});

describe('compileGameRecord', () => {
  const events: RawGameEvent[] = [
    { at: 30, type: 'clue_selected', payload: { tileId: 't1', pointValue: 100 } },
    { at: 10, type: 'game_start', payload: {} },
    {
      at: 40,
      type: 'answer_judged',
      payload: { tileId: 't1', playerId: 'a', correct: true, delta: 100, newScore: 100, resolved: true },
      scoresSnapshot: { a: 100 },
    },
    { at: 90, type: 'game_end', payload: {}, scoresSnapshot: { a: 500, b: 500, c: 100 } },
  ];

  it('orders events by timestamp and assigns seq', () => {
    const record = compileGameRecord({
      game: makeGame(),
      players,
      tiles,
      questions,
      events,
      status: 'completed',
      endedAt: 999,
    });
    expect(record.events.map((e) => e.type)).toEqual([
      'game_start',
      'clue_selected',
      'answer_judged',
      'game_end',
    ]);
    expect(record.events.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
    expect(record.coarse).toBe(false);
  });

  it('derives timing from game_start / game_end events', () => {
    const record = compileGameRecord({
      game: makeGame(),
      players,
      tiles,
      questions,
      events,
      status: 'completed',
      endedAt: 999,
    });
    expect(record.startedAt).toBe(10);
    expect(record.endedAt).toBe(90);
    expect(record.durationMs).toBe(80);
  });

  it('crowns all players tied for first', () => {
    const record = compileGameRecord({
      game: makeGame(),
      players,
      tiles,
      questions,
      events,
      status: 'completed',
      endedAt: 999,
    });
    expect(record.winnerIds.sort()).toEqual(['a', 'b']);
    expect(record.players.find((p) => p.id === 'c')?.placement).toBe(3);
  });

  it('prefers authoritative finalScores over the players snapshot', () => {
    const record = compileGameRecord({
      game: makeGame({ finalScores: { a: 0, b: 900, c: 100 } }),
      players,
      tiles,
      questions,
      events,
      status: 'completed',
      endedAt: 999,
    });
    expect(record.winnerIds).toEqual(['b']);
    expect(record.players[0]).toMatchObject({ id: 'b', finalScore: 900, placement: 1 });
  });

  it('falls back to a coarse record when no events survived', () => {
    const record = compileGameRecord({
      game: makeGame(),
      players,
      tiles,
      questions,
      events: [],
      status: 'completed',
      endedAt: 999,
    });
    expect(record.coarse).toBe(true);
    expect(record.startedAt).toBeNull();
    expect(record.durationMs).toBeNull();
    expect(record.endedAt).toBe(999);
    // Board metadata still lets the coarse view show what was played.
    expect(record.board.tiles[0]).toMatchObject({ questionText: 'Q one?', played: true });
  });

  it('builds the final wager segment from its events', () => {
    const record = compileGameRecord({
      game: makeGame(),
      players,
      tiles,
      questions,
      events: [
        ...events,
        {
          at: 60,
          type: 'round_change',
          payload: { phase: 'final', questionText: 'Last?', answerText: 'Yes' },
        },
        {
          at: 80,
          type: 'final_answer_judged',
          payload: {
            results: [
              { playerId: 'a', name: 'Ana', wager: 200, correct: false, delta: -200, newScore: 300 },
            ],
          },
          scoresSnapshot: { a: 300 },
        },
      ],
      status: 'completed',
      endedAt: 999,
    });
    expect(record.finalWager).toMatchObject({ questionText: 'Last?', answerText: 'Yes' });
    expect(record.finalWager?.results).toHaveLength(1);
  });
});

describe('frameAt', () => {
  const record = compileGameRecord({
    game: makeGame(),
    players,
    tiles,
    questions,
    events: [
      { at: 10, type: 'game_start', payload: {} },
      { at: 20, type: 'clue_selected', payload: { tileId: 't1' } },
      {
        at: 30,
        type: 'answer_judged',
        payload: { tileId: 't1', playerId: 'a', correct: true, resolved: true },
        scoresSnapshot: { a: 100 },
      },
      { at: 40, type: 'round_change', payload: { phase: 'final' } },
      { at: 50, type: 'game_end', payload: {}, scoresSnapshot: { a: 500, b: 500, c: 100 } },
    ],
    status: 'completed',
    endedAt: 999,
  });

  it('starts with zeros, hidden tiles and the pregame phase', () => {
    const f = frameAt(record, 0);
    expect(f.scores).toEqual({ a: 0, b: 0, c: 0 });
    expect(f.tileStates.t1).toBe('hidden');
    expect(f.phase).toBe('pregame');
    expect(f.lastEvent).toBeNull();
  });

  it('activates the selected tile, then retires it on resolution', () => {
    expect(frameAt(record, 2).tileStates.t1).toBe('active');
    expect(frameAt(record, 2).activeTileId).toBe('t1');
    const after = frameAt(record, 3);
    expect(after.tileStates.t1).toBe('used');
    expect(after.activeTileId).toBeNull();
    expect(after.scores.a).toBe(100);
  });

  it('merges partial snapshots cumulatively', () => {
    // The judged event only knew about player a; b and c keep their zeros
    // until the game_end snapshot mentions them.
    expect(frameAt(record, 3).scores).toEqual({ a: 100, b: 0, c: 0 });
    expect(frameAt(record, 5).scores).toEqual({ a: 500, b: 500, c: 100 });
  });

  it('tracks phases and clamps out-of-range indexes', () => {
    expect(frameAt(record, 1).phase).toBe('board');
    expect(frameAt(record, 4).phase).toBe('final');
    expect(frameAt(record, 5).phase).toBe('done');
    expect(frameAt(record, 99).phase).toBe('done');
    expect(frameAt(record, -5).phase).toBe('pregame');
  });
});
