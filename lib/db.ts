import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  addDoc,
  getDocs,
  increment,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  Anthem,
  Answer,
  Buzz,
  DEFAULT_SETTINGS,
  FinalRoundState,
  Game,
  LightningState,
  Player,
  PlayerStats,
  Question,
  Shout,
  StageState,
  Tile,
} from './types';

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

function generateHostKey(): string {
  let key = '';
  for (let i = 0; i < 6; i++) {
    key += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return key;
}

export async function createGame(): Promise<Game> {
  const roomCode = generateRoomCode();
  const game: Game = {
    roomCode,
    status: 'collecting_submissions',
    settings: DEFAULT_SETTINGS,
    createdAt: Date.now(),
    hostKey: generateHostKey(),
    stage: null,
    finalRound: null,
    lastWin: null,
  };
  await setDoc(doc(db, 'games', roomCode), game);
  return game;
}

export async function getGame(roomCode: string): Promise<Game | null> {
  const snap = await getDoc(doc(db, 'games', roomCode.toUpperCase()));
  return snap.exists() ? (snap.data() as Game) : null;
}

export function watchGame(
  roomCode: string,
  callback: (game: Game | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, 'games', roomCode), (snap) => {
    callback(snap.exists() ? (snap.data() as Game) : null);
  });
}

export function watchPlayers(
  roomCode: string,
  callback: (players: Player[]) => void
): Unsubscribe {
  const q = query(collection(db, 'players'), where('roomCode', '==', roomCode));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as Player));
  });
}

export function watchQuestions(
  roomCode: string,
  callback: (questions: Question[]) => void
): Unsubscribe {
  const q = query(collection(db, 'questions'), where('roomCode', '==', roomCode));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as Question));
  });
}

export function watchTiles(
  roomCode: string,
  callback: (tiles: Tile[]) => void
): Unsubscribe {
  const q = query(collection(db, 'tiles'), where('roomCode', '==', roomCode));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as Tile));
  });
}

export interface QuestionInput {
  tier: 1 | 2 | 3 | 4 | 5;
  text: string;
  answer: string;
}

// Host adds a walk-in player who never submitted questions. They score,
// buzz, and appear on the leaderboard — the board just has no column for
// them (columns come from submitted questions).
export async function addManualPlayer(roomCode: string, name: string): Promise<void> {
  const playerRef = doc(collection(db, 'players'));
  const player: Player = {
    id: playerRef.id,
    roomCode,
    name,
    score: 0,
    submitted: true,
    anthem: null,
    photo: null,
    finalWager: null,
  };
  await setDoc(playerRef, player);
}

export async function submitPlayer(
  roomCode: string,
  name: string,
  questions: QuestionInput[],
  anthem: Anthem | null = null,
  photo: string | null = null
): Promise<void> {
  const batch = writeBatch(db);
  const playerRef = doc(collection(db, 'players'));
  const player: Player = {
    id: playerRef.id,
    roomCode,
    name,
    score: 0,
    submitted: true,
    anthem,
    photo,
  };
  batch.set(playerRef, player);

  for (const q of questions) {
    const qRef = doc(collection(db, 'questions'));
    const question: Question = {
      id: qRef.id,
      roomCode,
      ownerPlayerId: playerRef.id,
      tier: q.tier,
      text: q.text,
      answer: q.answer,
      usedInGame: false,
    };
    batch.set(qRef, question);
  }

  await batch.commit();
}

export async function updateGame(
  roomCode: string,
  updates: Partial<Game>
): Promise<void> {
  await updateDoc(doc(db, 'games', roomCode), updates);
}

export async function updatePlayerScore(
  playerId: string,
  score: number
): Promise<void> {
  await updateDoc(doc(db, 'players', playerId), { score });
}

// Night-of stat counters, archived with the result at game end. Uses
// atomic increments so concurrent judging surfaces can't clobber each other.
export async function bumpPlayerStats(
  playerId: string,
  bumps: Partial<PlayerStats>
): Promise<void> {
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(bumps)) {
    if (v) updates[`stats.${k}`] = increment(v);
  }
  if (Object.keys(updates).length > 0) {
    await updateDoc(doc(db, 'players', playerId), updates);
  }
}

export async function updateTile(
  tileId: string,
  updates: Partial<Tile>
): Promise<void> {
  await updateDoc(doc(db, 'tiles', tileId), updates);
}

export async function markQuestionUsed(questionId: string): Promise<void> {
  await updateDoc(doc(db, 'questions', questionId), { usedInGame: true });
}

export async function updateQuestion(
  questionId: string,
  updates: Partial<Pick<Question, 'text' | 'answer' | 'usedInGame'>>
): Promise<void> {
  await updateDoc(doc(db, 'questions', questionId), updates);
}

// Admin: reopen a tile that was resolved by mistake.
export async function reopenTile(tile: Tile): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'tiles', tile.id), { status: 'hidden' });
  batch.update(doc(db, 'questions', tile.questionId), { usedInGame: false });
  await batch.commit();
}

// Admin: remove a player and everything they own (questions + tiles).
export async function removePlayerCascade(
  player: Player,
  questions: Question[],
  tiles: Tile[]
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'players', player.id));
  for (const q of questions.filter((q) => q.ownerPlayerId === player.id)) {
    batch.delete(doc(db, 'questions', q.id));
  }
  for (const t of tiles.filter((t) => t.ownerPlayerId === player.id)) {
    batch.delete(doc(db, 'tiles', t.id));
  }
  await batch.commit();
}

export async function writeTiles(tiles: Omit<Tile, 'id'>[]): Promise<void> {
  const batch = writeBatch(db);
  for (const tile of tiles) {
    const ref = doc(collection(db, 'tiles'));
    batch.set(ref, { ...tile, id: ref.id });
  }
  await batch.commit();
}

/* ---- Shared stage state (drives both the TV stage and the console) ---- */

function freshStage(tile: Tile): StageState {
  return {
    activeTileId: tile.id,
    step: tile.wildcardType ? 'wc_reveal' : 'question',
    answerRevealed: false,
    ddPlayerId: null,
    ddWager: 0,
    stealWinnerId: null,
    swapPickerId: null,
    eaOwnerId: tile.wildcardType === 'everyone_answers' ? tile.ownerPlayerId : null,
    lockedOut: [],
    timerEndsAt: null,
    timerRemaining: 30,
    timerDuration: 30,
  };
}

// Open a tile: publish fresh stage state and arm the phone buzzers in the
// same batch (sweeping stale buzz and typed-answer docs from earlier
// questions).
export async function openTile(roomCode: string, tile: Tile, currentRound: number): Promise<void> {
  const [oldBuzzes, oldAnswers] = await Promise.all([
    getDocs(query(collection(db, 'buzzes'), where('roomCode', '==', roomCode))),
    getDocs(query(collection(db, 'answers'), where('roomCode', '==', roomCode))),
  ]);
  const batch = writeBatch(db);
  oldBuzzes.docs.forEach((d) => batch.delete(d.ref));
  oldAnswers.docs.forEach((d) => batch.delete(d.ref));
  batch.update(doc(db, 'games', roomCode), {
    stage: freshStage(tile),
    buzzerArmed: true,
    buzzerRound: currentRound + 1,
  });
  await batch.commit();
}

export async function updateStage(
  roomCode: string,
  updates: Partial<StageState>
): Promise<void> {
  const dotted: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) dotted[`stage.${k}`] = v;
  await updateDoc(doc(db, 'games', roomCode), dotted);
}

export async function closeStage(roomCode: string): Promise<void> {
  await updateDoc(doc(db, 'games', roomCode), { stage: null, buzzerArmed: false });
}

export async function recordWin(roomCode: string, playerId: string): Promise<void> {
  await updateDoc(doc(db, 'games', roomCode), {
    lastWin: { playerId, at: Date.now() },
  });
}

/* ---- Final round (wagers come from player phones) ---- */

export async function startFinalRound(
  roomCode: string,
  players: Player[],
  question: { questionText: string; answerText: string; poolId: string | null }
): Promise<void> {
  const batch = writeBatch(db);
  // Clear stale wagers from any previous attempt.
  for (const p of players) {
    batch.update(doc(db, 'players', p.id), { finalWager: null });
  }
  batch.update(doc(db, 'games', roomCode), {
    finalRound: { step: 'wagers', ...question },
  });
  await batch.commit();
}

export async function updateFinalRound(
  roomCode: string,
  updates: Partial<FinalRoundState>
): Promise<void> {
  const dotted: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) dotted[`finalRound.${k}`] = v;
  await updateDoc(doc(db, 'games', roomCode), dotted);
}

export async function setFinalWager(playerId: string, amount: number): Promise<void> {
  await updateDoc(doc(db, 'players', playerId), { finalWager: amount });
}

/* ---- Lightning round ---- */

export async function startLightning(
  roomCode: string,
  questionIds: string[],
  perCorrect: number
): Promise<void> {
  const lightning: LightningState = { questionIds, index: 0, endsAt: null, perCorrect };
  await updateDoc(doc(db, 'games', roomCode), { lightning });
}

export async function updateLightning(
  roomCode: string,
  updates: Partial<LightningState>
): Promise<void> {
  const dotted: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) dotted[`lightning.${k}`] = v;
  await updateDoc(doc(db, 'games', roomCode), dotted);
}

export async function endLightning(roomCode: string): Promise<void> {
  await updateDoc(doc(db, 'games', roomCode), { lightning: null, buzzerArmed: false });
}

/* ---- Phone companion: buzzers & shouts ---- */

// Arm the buzzers for a new question: bump the round (so old buzzes can't
// leak in) and sweep away previous buzz docs to keep the collection tiny.
export async function armBuzzers(roomCode: string, currentRound: number): Promise<void> {
  const old = await getDocs(query(collection(db, 'buzzes'), where('roomCode', '==', roomCode)));
  const batch = writeBatch(db);
  old.docs.forEach((d) => batch.delete(d.ref));
  batch.update(doc(db, 'games', roomCode), {
    buzzerArmed: true,
    buzzerRound: currentRound + 1,
  });
  await batch.commit();
}

export async function disarmBuzzers(roomCode: string): Promise<void> {
  await updateDoc(doc(db, 'games', roomCode), { buzzerArmed: false });
}

export async function sendBuzz(
  roomCode: string,
  player: Player,
  round: number
): Promise<void> {
  await addDoc(collection(db, 'buzzes'), {
    roomCode,
    playerId: player.id,
    name: player.name,
    round,
    at: serverTimestamp(), // server-side ordering — fair across devices
  });
  // Stat counter is best-effort — never let it delay or fail the buzz.
  void bumpPlayerStats(player.id, { buzzes: 1 }).catch(() => {});
}

/* ---- Everyone Answers: typed answers from phones ---- */

const ANSWER_MAX_CHARS = 120;

export async function sendAnswer(
  roomCode: string,
  player: Player,
  round: number,
  text: string
): Promise<void> {
  await addDoc(collection(db, 'answers'), {
    roomCode,
    playerId: player.id,
    name: player.name,
    round,
    text: text.slice(0, ANSWER_MAX_CHARS),
    at: Date.now(),
  });
}

export function watchAnswers(
  roomCode: string,
  callback: (answers: Answer[]) => void
): Unsubscribe {
  const q = query(collection(db, 'answers'), where('roomCode', '==', roomCode));
  return onSnapshot(q, (snap) => {
    const answers = snap.docs
      .map((d) => ({ ...d.data(), id: d.id }) as Answer)
      .sort((a, b) => a.at - b.at);
    callback(answers);
  });
}

export function watchBuzzes(
  roomCode: string,
  callback: (buzzes: Buzz[]) => void
): Unsubscribe {
  const q = query(collection(db, 'buzzes'), where('roomCode', '==', roomCode));
  return onSnapshot(q, (snap) => {
    const buzzes = snap.docs
      .map((d) => {
        const data = d.data();
        const at =
          data.at instanceof Timestamp ? data.at.toMillis() : Number.MAX_SAFE_INTEGER;
        return { ...data, id: d.id, at } as Buzz;
      })
      .sort((a, b) => a.at - b.at);
    callback(buzzes);
  });
}

const SHOUT_MAX_CHARS = 80;

export async function sendShout(
  roomCode: string,
  player: Player,
  content: { emoji?: string; text?: string }
): Promise<void> {
  await addDoc(collection(db, 'shouts'), {
    roomCode,
    playerId: player.id,
    name: player.name,
    emoji: content.emoji ?? null,
    text: content.text ? content.text.slice(0, SHOUT_MAX_CHARS) : null,
    at: Date.now(),
  });
}

export function watchShouts(
  roomCode: string,
  callback: (added: Shout[]) => void
): Unsubscribe {
  const q = query(collection(db, 'shouts'), where('roomCode', '==', roomCode));
  let primed = false;
  return onSnapshot(q, (snap) => {
    // Only surface docs added after the listener attached — the overlay
    // shows a live feed, not history.
    const added = snap
      .docChanges()
      .filter((c) => c.type === 'added')
      .map((c) => ({ ...c.doc.data(), id: c.doc.id }) as Shout);
    if (!primed) {
      primed = true;
      return;
    }
    if (added.length > 0) callback(added);
  });
}
