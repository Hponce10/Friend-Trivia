'use client';

import { use, useEffect, useState } from 'react';
import { watchGame, watchPlayers, watchBuzzes, sendBuzz, sendShout, setFinalWager } from '@/lib/db';
import WagerInput from '@/components/host/WagerInput';
import { Buzz, Game, Player } from '@/lib/types';
import Avatar from '@/components/Avatar';
import HomeLink from '@/components/HomeLink';

const REACTIONS = ['🔥', '😂', '👏', '💀', '😱', '🎉'];
const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

// Module-scope rate limiter: at most one reaction per 800ms per device.
let lastReactionAt = 0;
function reactionAllowed(): boolean {
  const now = Date.now();
  if (now - lastReactionAt < 800) return false;
  lastReactionAt = now;
  return true;
}

export default function PlayPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode: rawCode } = use(params);
  const roomCode = rawCode.toUpperCase();
  const [game, setGame] = useState<Game | null | 'loading'>('loading');
  const [players, setPlayers] = useState<Player[]>([]);
  const [buzzes, setBuzzes] = useState<Buzz[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [buzzing, setBuzzing] = useState(false);
  const [note, setNote] = useState('');
  const [noteSent, setNoteSent] = useState(false);

  useEffect(() => {
    const unsubs = [
      watchGame(roomCode, setGame),
      watchPlayers(roomCode, setPlayers),
      watchBuzzes(roomCode, setBuzzes),
    ];
    // localStorage isn't available during SSR; deferred via setTimeout to
    // keep the effect free of synchronous setState (rAF would never fire
    // in a throttled background tab).
    const id = setTimeout(() => setMyId(localStorage.getItem(`ft-player-${roomCode}`)), 0);
    return () => {
      clearTimeout(id);
      unsubs.forEach((u) => u());
    };
  }, [roomCode]);

  if (game === 'loading') {
    return (
      <div className="anim-fade-in flex min-h-screen items-center justify-center text-indigo-300">
        Loading…
      </div>
    );
  }
  if (game === null) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-white">
        <HomeLink />
        <p className="anim-rise-in rounded-xl bg-red-900/60 px-6 py-4 text-red-200 ring-1 ring-red-800">
          No game exists for room code {roomCode}.
        </p>
      </div>
    );
  }

  const me = players.find((p) => p.id === myId) ?? null;

  // ---- Identity claim ----
  if (!me) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 text-white">
        <HomeLink />
        <p className="anim-fade-in text-xs font-semibold uppercase tracking-[0.3em] text-indigo-400">
          Room {roomCode}
        </p>
        <h1 className="anim-rise-in mt-1 text-center font-display text-4xl uppercase tracking-wide">
          Who are <span className="text-amber-400">you</span>?
        </h1>
        <p className="mt-2 max-w-xs text-center text-sm text-indigo-300">
          Claim your player to turn this phone into your buzzer.
        </p>
        <ul className="anim-rise-in mt-6 grid w-full max-w-sm grid-cols-1 gap-2">
          {players.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => {
                  localStorage.setItem(`ft-player-${roomCode}`, p.id);
                  setMyId(p.id);
                }}
                className="flex w-full items-center gap-3 rounded-2xl bg-indigo-900/70 px-4 py-3 ring-1 ring-indigo-700/50 transition hover:bg-indigo-800/70 active:scale-[0.98]"
              >
                <Avatar player={p} sizeClass="h-11 w-11" textClass="text-base" />
                <span className="flex-1 truncate text-left text-lg font-semibold">
                  {p.name}
                </span>
                <span className="text-indigo-400">→</span>
              </button>
            </li>
          ))}
          {players.length === 0 && (
            <li className="text-center text-indigo-400">
              No players yet — submit your questions first!
            </li>
          )}
        </ul>
      </div>
    );
  }

  // ---- Controller ----
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const myRank = ranked.findIndex((p) => p.id === me.id);
  const armed = game.buzzerArmed === true && game.status === 'in_progress';
  const round = game.buzzerRound ?? 0;
  const roundBuzzes = buzzes.filter((b) => b.round === round);
  const myBuzzIndex = roundBuzzes.findIndex((b) => b.playerId === me.id);
  const hasBuzzed = myBuzzIndex >= 0;

  async function handleBuzz() {
    if (!armed || hasBuzzed || buzzing || !me) return;
    setBuzzing(true);
    if (navigator.vibrate) navigator.vibrate(80);
    try {
      await sendBuzz(roomCode, me, round);
    } finally {
      setBuzzing(false);
    }
  }

  async function handleReaction(emoji: string) {
    if (!me || !reactionAllowed()) return;
    await sendShout(roomCode, me, { emoji });
  }

  async function handleNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim() || !me) return;
    await sendShout(roomCode, me, { text: note.trim() });
    setNote('');
    setNoteSent(true);
    setTimeout(() => setNoteSent(false), 2000);
  }

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 px-4 py-6 text-white">
      {/* Header: who I am */}
      <header className="anim-fade-in flex w-full max-w-sm items-center gap-3">
        <Avatar player={me} sizeClass="h-12 w-12" textClass="text-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold leading-tight">{me.name}</p>
          <p className="text-xs text-indigo-400">
            Room {roomCode} ·{' '}
            <button
              onClick={() => {
                localStorage.removeItem(`ft-player-${roomCode}`);
                setMyId(null);
              }}
              className="underline-offset-2 hover:underline"
            >
              not you?
            </button>
          </p>
        </div>
        <div className="rounded-2xl bg-indigo-900/80 px-4 py-2 text-center ring-1 ring-indigo-700/50">
          <p className="font-display text-2xl leading-none text-amber-400">{me.score}</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-indigo-400">
            {ORDINALS[myRank] ?? `${myRank + 1}th`} place
          </p>
        </div>
      </header>

      {/* Final round: secret wager from this phone */}
      {game.status === 'final_round' && game.finalRound?.step === 'wagers' && (
        <div className="anim-pop-in flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl bg-indigo-900/70 p-6 ring-1 ring-amber-400/40">
          <p className="font-display text-2xl uppercase tracking-wide text-amber-400">
            Final Wager
          </p>
          {me.finalWager == null ? (
            <>
              <p className="text-center text-sm text-indigo-300">
                Secretly wager up to your score. Correct wins it, wrong loses it.
              </p>
              <WagerInput
                label="Your secret wager"
                max={Math.max(me.score, 0)}
                onConfirm={(amount) => setFinalWager(me.id, amount)}
              />
            </>
          ) : (
            <p className="text-lg font-semibold text-emerald-300">
              🔒 Locked in: {me.finalWager}
            </p>
          )}
        </div>
      )}
      {game.status === 'final_round' && game.finalRound?.step !== 'wagers' && (
        <div className="anim-rise-in w-full max-w-sm rounded-3xl bg-indigo-900/70 p-6 text-center ring-1 ring-indigo-700/50">
          <p className="font-display text-xl uppercase tracking-wide text-amber-400">
            Final Wager
          </p>
          <p className="mt-2 text-sm text-indigo-300">
            👀 Eyes on the big screen — answer out loud when the question shows!
          </p>
        </div>
      )}

      {/* The buzzer */}
      <div className="anim-rise-in flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4">
        <button
          onClick={handleBuzz}
          disabled={!armed || hasBuzzed}
          aria-label="Buzz in"
          className={`flex aspect-square w-56 flex-col items-center justify-center rounded-full font-display text-4xl uppercase tracking-wide transition active:scale-95 ${
            hasBuzzed
              ? myBuzzIndex === 0
                ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-indigo-950 shadow-[0_0_60px_rgba(246,196,83,0.5)]'
                : 'bg-indigo-800 text-indigo-300 ring-2 ring-indigo-600'
              : armed
                ? 'anim-buzz-pulse bg-gradient-to-b from-rose-500 to-rose-700 text-white shadow-[0_10px_40px_rgba(244,63,94,0.45)]'
                : 'bg-indigo-900/70 text-indigo-500 ring-1 ring-indigo-700/50'
          }`}
        >
          {hasBuzzed ? (
            <>
              <span className="text-6xl">{myBuzzIndex === 0 ? '⚡' : '⏱'}</span>
              <span className="mt-1">{ORDINALS[myBuzzIndex] ?? `${myBuzzIndex + 1}th`}</span>
              {myBuzzIndex > 0 && roundBuzzes[0] && (
                <span className="font-sans text-sm normal-case tracking-normal text-indigo-400">
                  +{((roundBuzzes[myBuzzIndex].at - roundBuzzes[0].at) / 1000).toFixed(2)}s
                </span>
              )}
            </>
          ) : armed ? (
            'BUZZ!'
          ) : (
            <span className="px-6 text-center font-sans text-base font-semibold normal-case tracking-normal">
              {game.status === 'in_progress'
                ? 'Waiting for the next question…'
                : 'Buzzers wake up during the board round'}
            </span>
          )}
        </button>
        {hasBuzzed && myBuzzIndex === 0 && (
          <p className="anim-rise-in font-semibold text-amber-300">
            First! The floor is yours 🎤
          </p>
        )}
      </div>

      {/* Reactions */}
      <div className="anim-rise-in w-full max-w-sm">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-indigo-400">
          React on the big screen
        </p>
        <div className="mt-2 flex justify-between gap-1.5">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              aria-label={`Send ${emoji} reaction`}
              className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-indigo-900/70 text-2xl ring-1 ring-indigo-700/50 transition hover:bg-indigo-800 active:scale-90"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Note to the big screen */}
      <form onSubmit={handleNote} className="anim-rise-in flex w-full max-w-sm gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={80}
          placeholder="Talk your talk — shows on the big screen"
          aria-label="Send a note to the main screen"
          className="min-w-0 flex-1 rounded-2xl border border-indigo-700 bg-indigo-900/70 px-4 py-3 text-base placeholder:text-indigo-500 focus:border-amber-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!note.trim()}
          className={`shrink-0 rounded-2xl px-5 py-3 font-bold transition active:scale-95 disabled:opacity-40 ${
            noteSent
              ? 'bg-emerald-500 text-white'
              : 'bg-gradient-to-b from-amber-300 to-amber-400 text-indigo-950'
          }`}
        >
          {noteSent ? '✓' : 'Send'}
        </button>
      </form>

      {/* Mini leaderboard */}
      <div className="anim-rise-in w-full max-w-sm pb-4">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-indigo-400">
          Standings
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {ranked.map((p, i) => (
            <li
              key={p.id}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-sm ring-1 ${
                p.id === me.id
                  ? 'bg-amber-400/15 ring-amber-400/40'
                  : 'bg-indigo-900/60 ring-indigo-800/50'
              }`}
            >
              <span className="w-5 text-center font-display text-indigo-400">{i + 1}</span>
              <Avatar player={p} sizeClass="h-7 w-7" textClass="text-xs" />
              <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
              <span
                className={`font-mono font-bold tabular-nums ${
                  p.score < 0 ? 'text-red-400' : 'text-amber-300'
                }`}
              >
                {p.score}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
