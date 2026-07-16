import { Game, Player, Question, Tile, WildcardType } from './types';

// Game records & replay — the pure half. Types for the persisted GameRecord,
// the compiler that turns a raw event log into one, and the fold that
// reconstructs any moment of the game for the replay UI. No Firebase or
// Supabase imports so all of it unit-tests in vitest; the I/O lives in
// lib/recorder.ts (Firestore, during play) and lib/archive.ts (Supabase,
// at game end).

export type GameEventType =
  | 'game_start'
  | 'clue_selected'
  | 'answer_submitted'
  | 'answer_judged'
  | 'wildcard_used'
  | 'wager_set'
  | 'round_change'
  | 'final_wager_placed'
  | 'final_answer_judged'
  | 'score_change'
  | 'game_end';

export interface EAVerdict {
  playerId: string;
  name: string;
  text: string | null;
  correct: boolean;
  delta: number;
  newScore: number;
}

export interface FinalResult {
  playerId: string;
  name: string;
  wager: number;
  correct: boolean;
  delta: number;
  newScore: number;
}

// One permissive payload shape instead of a discriminated union: events are
// written by several app versions over time and replay must degrade
// gracefully, so every field is optional and readers never assume presence.
export interface EventPayload {
  tileId?: string;
  playerId?: string;
  name?: string;
  correct?: boolean;
  delta?: number;
  newScore?: number;
  // The tile leaves the board after this event (wrong answers without a
  // lockout-clearing resolution keep it open).
  resolved?: boolean;
  stump?: boolean;
  lightning?: boolean;
  pendingSteal?: boolean;
  ea?: EAVerdict[];
  // clue_selected
  ownerPlayerId?: string;
  pointValue?: number;
  wildcardType?: WildcardType | null;
  // wagers & steals
  amount?: number;
  kind?: 'steal' | 'steal_skip' | 'swap' | 'daily_double_pick';
  winnerId?: string;
  victimId?: string;
  aId?: string;
  bId?: string;
  // round_change
  phase?: 'board' | 'lightning' | 'final';
  questionText?: string;
  answerText?: string;
  questionCount?: number;
  perCorrect?: number;
  // final_answer_judged
  results?: FinalResult[];
  // game_end / score_change
  abandoned?: boolean;
  reason?: string;
}

// What each surface appends during play. `seq` is assigned at compile time:
// events come from several devices (host TV, console phone, player phones),
// so a per-client counter would collide — wall-clock `at` orders them.
export interface RawGameEvent {
  at: number;
  type: GameEventType;
  payload: EventPayload;
  // Per-player totals AFTER this event. Only present on score-changing
  // events, and may be partial — the fold merges snapshots cumulatively.
  scoresSnapshot?: Record<string, number>;
}

export interface GameEvent extends RawGameEvent {
  seq: number;
}

export interface RecordPlayer {
  id: string;
  name: string;
  photo: string | null;
  finalScore: number;
  placement: number; // competition ranking: ties share (1, 1, 3)
  finalWager: number | null;
}

export interface RecordTile {
  id: string;
  ownerPlayerId: string;
  pointValue: number;
  wildcardType: WildcardType | null;
  questionText: string;
  answerText: string;
  played: boolean;
}

export interface GameRecordBoard {
  pointScale: number[];
  // Column order matches the live board (alphabetical by name).
  columns: { playerId: string; name: string }[];
  tiles: RecordTile[];
}

export interface FinalWagerRecord {
  questionText: string;
  answerText: string;
  results: FinalResult[];
}

export interface GameRecord {
  version: 1;
  roomCode: string;
  status: 'completed' | 'abandoned';
  createdAt: number;
  startedAt: number | null;
  endedAt: number;
  durationMs: number | null;
  players: RecordPlayer[];
  winnerIds: string[]; // every player tied for first
  board: GameRecordBoard;
  events: GameEvent[];
  // True when no live event log existed and the record was reconstructed
  // from end-of-game state — the replay shows standings, not a timeline.
  coarse: boolean;
  finalWager: FinalWagerRecord | null;
}

// The light payload embedded next to the record for history-list cards, so
// browsing /history never pulls full event logs.
export interface GameRecordSummaryData {
  players: { id: string; name: string; score: number; placement: number }[];
  winnerNames: string[];
  eventCount: number;
  coarse: boolean;
}

/** Competition-ranked placements: sorted by score desc, ties share a rank
    and the next distinct score skips past them (1, 1, 3). */
export function assignPlacements(
  players: { id: string; score: number }[]
): Map<string, number> {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const placements = new Map<string, number>();
  sorted.forEach((p, i) => {
    placements.set(
      p.id,
      i > 0 && sorted[i - 1].score === p.score
        ? placements.get(sorted[i - 1].id)!
        : i + 1
    );
  });
  return placements;
}

export interface CompileInput {
  game: Game;
  players: Player[];
  tiles: Tile[];
  questions: Question[];
  events: RawGameEvent[];
  status: 'completed' | 'abandoned';
  /** Fallback end time when no game_end event made it into the log. */
  endedAt: number;
}

export function compileGameRecord(input: CompileInput): GameRecord {
  const { game, players, tiles, questions, status } = input;

  // Order across devices by wall clock; ties keep append order (sort is
  // stable), then stamp the authoritative sequence.
  const events: GameEvent[] = [...input.events]
    .sort((a, b) => a.at - b.at)
    .map((e, i) => ({ ...e, seq: i + 1 }));

  // Prefer the authoritative finalScores written atomically with
  // status='completed' — same reasoning as ResultsScreen.
  const effective = players.map((p) => ({
    ...p,
    score: game.finalScores?.[p.id] ?? p.score,
  }));
  const placements = assignPlacements(effective);
  const recordPlayers: RecordPlayer[] = [...effective]
    .sort((a, b) => b.score - a.score)
    .map((p) => ({
      id: p.id,
      name: p.name,
      photo: p.photo ?? null,
      finalScore: p.score,
      placement: placements.get(p.id)!,
      finalWager: p.finalWager ?? null,
    }));
  const winnerIds = recordPlayers
    .filter((p) => p.placement === 1)
    .map((p) => p.id);

  const questionById = new Map(questions.map((q) => [q.id, q]));
  const board: GameRecordBoard = {
    pointScale: game.settings.pointScale,
    columns: [...players]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({ playerId: p.id, name: p.name })),
    tiles: tiles.map((t) => ({
      id: t.id,
      ownerPlayerId: t.ownerPlayerId,
      pointValue: t.pointValue,
      wildcardType: t.wildcardType,
      questionText: questionById.get(t.questionId)?.text ?? '',
      answerText: questionById.get(t.questionId)?.answer ?? '',
      played: t.status === 'used',
    })),
  };

  const startEvent = events.find((e) => e.type === 'game_start') ?? null;
  const endEvents = events.filter((e) => e.type === 'game_end');
  const endedAt =
    endEvents.length > 0 ? endEvents[endEvents.length - 1].at : input.endedAt;
  const startedAt = startEvent?.at ?? null;

  // The Final Wager segment: the round_change that opened it carries the
  // question, the final_answer_judged event carries everyone's outcome.
  const finalOpen = [...events]
    .reverse()
    .find((e) => e.type === 'round_change' && e.payload.phase === 'final' && e.payload.questionText);
  const finalJudged = [...events]
    .reverse()
    .find((e) => e.type === 'final_answer_judged');
  const finalWager: FinalWagerRecord | null =
    finalOpen || finalJudged
      ? {
          questionText: finalOpen?.payload.questionText ?? '',
          answerText: finalOpen?.payload.answerText ?? '',
          results: finalJudged?.payload.results ?? [],
        }
      : null;

  return {
    version: 1,
    roomCode: game.roomCode,
    status,
    createdAt: game.createdAt,
    startedAt,
    endedAt,
    durationMs: startedAt !== null ? Math.max(0, endedAt - startedAt) : null,
    players: recordPlayers,
    winnerIds,
    board,
    events,
    coarse: events.length === 0 || startEvent === null,
    finalWager,
  };
}

export function summarizeRecord(record: GameRecord): GameRecordSummaryData {
  return {
    players: record.players.map((p) => ({
      id: p.id,
      name: p.name,
      score: p.finalScore,
      placement: p.placement,
    })),
    winnerNames: record.players
      .filter((p) => record.winnerIds.includes(p.id))
      .map((p) => p.name),
    eventCount: record.events.length,
    coarse: record.coarse,
  };
}

/* ---- Replay playback ---- */

export type TileVisual = 'hidden' | 'active' | 'used';
export type ReplayPhase = 'pregame' | 'board' | 'lightning' | 'final' | 'done';

export interface ReplayFrame {
  // Per-player totals as of this moment (0 before any snapshot mentions them).
  scores: Record<string, number>;
  tileStates: Record<string, TileVisual>;
  activeTileId: string | null;
  phase: ReplayPhase;
  // The event that produced this frame — what the caption panel narrates.
  lastEvent: GameEvent | null;
}

/** Fold the first `index` events into a frame. O(events) per call, which is
    fine at party scale (a big night is a few hundred events) — no
    incremental state to get out of sync while scrubbing. */
export function frameAt(record: GameRecord, index: number): ReplayFrame {
  const upto = Math.max(0, Math.min(index, record.events.length));
  const scores: Record<string, number> = {};
  for (const p of record.players) scores[p.id] = 0;
  const tileStates: Record<string, TileVisual> = {};
  for (const t of record.board.tiles) tileStates[t.id] = 'hidden';

  let activeTileId: string | null = null;
  let phase: ReplayPhase = 'pregame';
  let lastEvent: GameEvent | null = null;

  for (let i = 0; i < upto; i++) {
    const e = record.events[i];
    lastEvent = e;
    // Snapshots may be partial (only the players a device knew about) —
    // merge cumulatively so earlier truths survive.
    if (e.scoresSnapshot) Object.assign(scores, e.scoresSnapshot);

    switch (e.type) {
      case 'game_start':
        phase = 'board';
        break;
      case 'clue_selected':
        if (e.payload.tileId) {
          activeTileId = e.payload.tileId;
          tileStates[e.payload.tileId] = 'active';
        }
        break;
      case 'round_change':
        if (e.payload.phase === 'lightning') phase = 'lightning';
        else if (e.payload.phase === 'final') phase = 'final';
        else if (e.payload.phase === 'board') phase = 'board';
        if (activeTileId) {
          // A phase jump abandons any open tile.
          tileStates[activeTileId] = 'used';
          activeTileId = null;
        }
        break;
      case 'game_end':
        phase = 'done';
        break;
      default:
        break;
    }

    // Any event may close the open tile (judgments, steals, stumps).
    if (e.payload.resolved && activeTileId) {
      tileStates[activeTileId] = 'used';
      activeTileId = null;
    }
  }

  return { scores, tileStates, activeTileId, phase, lastEvent };
}

/** How long auto-play lingers on each event at 1x, in ms — tuned so a
    replay feels like re-watching the night, not a slideshow of JSON. */
export function eventDwellMs(e: GameEvent): number {
  switch (e.type) {
    case 'game_start':
      return 2000;
    case 'clue_selected':
      return 2800; // time to read the question
    case 'answer_judged':
      return e.payload.ea ? 3600 : 2600;
    case 'wildcard_used':
      return 2400;
    case 'wager_set':
      return 1800;
    case 'round_change':
      return 2200;
    case 'final_wager_placed':
      return 900;
    case 'final_answer_judged':
      return 4000;
    case 'score_change':
      return 1400;
    case 'game_end':
      return 2500;
    default:
      return 1500;
  }
}
