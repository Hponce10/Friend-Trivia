export type GameStatus =
  | 'collecting_submissions'
  | 'ready_to_build'
  | 'in_progress'
  | 'final_round'
  | 'completed';

export type WildcardType = 'daily_double' | 'double_or_nothing' | 'steal' | 'swap';

export interface GameSettings {
  penaltyOnWrong: boolean;
  wildcardCount: number;
  enabledWildcards: WildcardType[];
  pointScale: number[];
}

// The live question, shared through Firestore so the stage (TV) and the
// host console (phone) render and control the same moment in the game.
export type StageStep =
  | 'wc_reveal'
  | 'dd_pick'
  | 'dd_wager'
  | 'swap_pick'
  | 'question'
  | 'steal_pick';

export interface StageState {
  activeTileId: string;
  step: StageStep;
  answerRevealed: boolean;
  ddPlayerId: string | null;
  ddWager: number;
  stealWinnerId: string | null;
  swapPickerId: string | null;
  lockedOut: string[]; // playerIds who answered wrong this question
  timerEndsAt: number | null; // wall-clock deadline while running
  timerRemaining: number; // seconds, meaningful while paused
  timerDuration: number;
}

// Final round, shared the same way. Wagers come from each player's phone.
export interface FinalRoundState {
  step: 'wagers' | 'question' | 'judging';
  questionText: string;
  answerText: string;
  poolId: string | null;
}

export interface Game {
  roomCode: string;
  status: GameStatus;
  settings: GameSettings;
  createdAt: number;
  finalRoundQuestionId?: string | null;
  // Secret that gates the host console (/console/CODE?key=…).
  hostKey?: string;
  // Phone-buzzer state: armed while a question is open; the round number
  // groups buzzes so stale buzzes from earlier questions never leak in.
  buzzerArmed?: boolean;
  buzzerRound?: number;
  stage?: StageState | null;
  finalRound?: FinalRoundState | null;
  // Last scoring win — the stage watches this to play victory anthems,
  // no matter which surface (stage or console) did the judging.
  lastWin?: { playerId: string; at: number } | null;
}

// A press of the big red button, ordered by server timestamp for fairness.
export interface Buzz {
  id: string;
  roomCode: string;
  playerId: string;
  name: string;
  round: number;
  at: number; // server-time millis (resolved from serverTimestamp)
}

// A reaction or short note sent from a player's phone to the main screen.
export interface Shout {
  id: string;
  roomCode: string;
  playerId: string;
  name: string;
  emoji: string | null;
  text: string | null;
  at: number;
}

// A player's victory song, chosen from Deezer during submission. Only the
// stable track id matters for playback — Deezer preview URLs are signed and
// expire within minutes, so they're re-resolved at play time.
export interface Anthem {
  trackId: number;
  title: string;
  artist: string;
  cover: string;
}

export interface Player {
  id: string;
  roomCode: string;
  name: string;
  score: number;
  submitted: boolean;
  anthem?: Anthem | null;
  // Small center-cropped JPEG data URL (~20KB) captured at submission —
  // stored inline on the doc so no Firebase Storage setup is needed.
  photo?: string | null;
  // Final-round wager, submitted from the player's own phone.
  finalWager?: number | null;
}

export interface Question {
  id: string;
  roomCode: string;
  ownerPlayerId: string;
  tier: 1 | 2 | 3 | 4 | 5;
  text: string;
  answer: string;
  usedInGame: boolean;
}

export interface Tile {
  id: string;
  roomCode: string;
  ownerPlayerId: string;
  questionId: string;
  pointValue: number;
  wildcardType: WildcardType | null;
  status: 'hidden' | 'revealed' | 'used';
}

export const DEFAULT_SETTINGS: GameSettings = {
  penaltyOnWrong: true,
  wildcardCount: 3,
  enabledWildcards: ['daily_double', 'double_or_nothing'],
  pointScale: [100, 200, 300, 400, 500],
};

export const TIER_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Everyone Knows',
  2: 'Most Would Know',
  3: 'Half Might Know',
  4: 'Few Would Know',
  5: 'Maybe One Person Knows',
};

export const TIER_HINTS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'A gimme — every single person playing should get this about you.',
  2: 'Common knowledge in the group, but someone might blank on it.',
  3: 'The friends who pay attention will get it; the rest are guessing.',
  4: 'Only your closest friends stand a chance.',
  5: 'At most one person in the room could know this. Deep-cut territory.',
};
