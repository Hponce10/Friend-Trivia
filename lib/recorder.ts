import {
  arrayUnion,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { EventPayload, GameEventType, RawGameEvent } from './replay';
import { Player } from './types';

// Live-game event recording. Events buffer in memory and flush to a single
// Firestore doc (gameEvents/{roomCode}) on a short debounce, so recording
// adds at most one write every couple of seconds on top of gameplay.
// Everything here is fire-and-forget-safe: a failed flush (rules not yet
// deployed, offline phone) drops events silently and can NEVER affect the
// live game — the archive falls back to a coarse record.

const FLUSH_MS = 1500;
// These are rare and mark segment boundaries the compiler leans on — flush
// them immediately rather than risking a lost debounce window.
const FLUSH_NOW: GameEventType[] = ['game_start', 'round_change', 'game_end'];

let buffer: RawGameEvent[] = [];
let bufferRoom: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

// Latest known scores, fed by whichever host surface is watching players —
// lets score-changing events carry a full scoresSnapshot without the
// recorder needing its own listener. Player phones never feed this; their
// events (final_wager_placed) don't carry snapshots.
let cacheRoom: string | null = null;
let cacheScores: Record<string, number> = {};

export function trackPlayersForRecorder(roomCode: string, players: Player[]): void {
  cacheRoom = roomCode;
  cacheScores = Object.fromEntries(players.map((p) => [p.id, p.score]));
}

async function flush(): Promise<void> {
  if (!bufferRoom || buffer.length === 0) return;
  const room = bufferRoom;
  const events = buffer;
  buffer = [];
  try {
    // setDoc+merge creates the doc on the first event; arrayUnion appends
    // are atomic server-side, so concurrent surfaces can't clobber each other.
    await setDoc(
      doc(db, 'gameEvents', room),
      { roomCode: room, events: arrayUnion(...events) },
      { merge: true }
    );
  } catch {
    // Recording must never affect gameplay — drop and move on.
  }
}

/** Append an event (fire-and-forget). `scoreOverrides` are the totals this
    action just wrote — they're overlaid on the tracked cache, which may not
    have caught up through the listener yet. */
export function recordEvent(
  roomCode: string,
  type: GameEventType,
  payload: EventPayload = {},
  scoreOverrides?: Record<string, number>
): void {
  if (bufferRoom && bufferRoom !== roomCode) void flush();
  bufferRoom = roomCode;

  const event: RawGameEvent = { at: Date.now(), type, payload };
  if (scoreOverrides) {
    event.scoresSnapshot =
      cacheRoom === roomCode ? { ...cacheScores, ...scoreOverrides } : { ...scoreOverrides };
  }
  buffer.push(event);

  if (FLUSH_NOW.includes(type)) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    void flush();
    return;
  }
  if (!timer) {
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, FLUSH_MS);
  }
}

/** Force out anything buffered — call before compiling the archive. */
export async function flushEvents(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  await flush();
}

export async function fetchEvents(roomCode: string): Promise<RawGameEvent[]> {
  const snap = await getDoc(doc(db, 'gameEvents', roomCode));
  if (!snap.exists()) return [];
  const events = (snap.data().events ?? []) as RawGameEvent[];
  return events;
}

/** Sweep the live event doc once the record is safely archived. */
export async function deleteEvents(roomCode: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'gameEvents', roomCode));
  } catch {
    // A stale doc is harmless; rules allow anyone to sweep it later.
  }
}
