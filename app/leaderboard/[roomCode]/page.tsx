'use client';

import { use, useEffect, useRef, useState } from 'react';
import { watchGame, watchPlayers } from '@/lib/db';
import { Game, Player } from '@/lib/types';
import { ensureSoundEnabled, playLpRoll } from '@/lib/lpSound';
import { playAnthem } from '@/lib/anthem';
import Avatar from '@/components/Avatar';
import ShoutOverlay from '@/components/ShoutOverlay';

const ROW_H = 84; // px — row slot height incl. gap, drives the FLIP reorder
const ROLL_MS = 1200;

/** Rolls the displayed number toward the live value, LP-counter style,
    firing the tick-whir sound for the duration of the roll. */
function ScoreTicker({ value, sound }: { value: number; sound: boolean }) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const from = shownRef.current;
    if (from === value) return;
    if (sound) playLpRoll(ROLL_MS, value > from ? 'up' : 'down');
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ROLL_MS);
      const eased = 1 - Math.pow(1 - t, 2);
      const current = Math.round(from + (value - from) * eased);
      shownRef.current = current;
      setShown(current);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, sound]);

  return <>{shown}</>;
}

export default function LeaderboardPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode: rawCode } = use(params);
  const roomCode = rawCode.toUpperCase();
  const [game, setGame] = useState<Game | null | 'loading'>('loading');
  const [players, setPlayers] = useState<Player[]>([]);
  const [soundOn, setSoundOn] = useState(false);
  const [flash, setFlash] = useState<Record<string, 'up' | 'down'>>({});
  const prevScores = useRef<Map<string, number>>(new Map());
  const playedWinnerAnthem = useRef(false);

  useEffect(() => {
    const unsubs = [watchGame(roomCode, setGame), watchPlayers(roomCode, setPlayers)];
    return () => unsubs.forEach((u) => u());
  }, [roomCode]);

  // Flash rows green/red when their score moves.
  useEffect(() => {
    const changes: Record<string, 'up' | 'down'> = {};
    for (const p of players) {
      const prev = prevScores.current.get(p.id);
      if (prev !== undefined && prev !== p.score) {
        changes[p.id] = p.score > prev ? 'up' : 'down';
      }
      prevScores.current.set(p.id, p.score);
    }
    if (Object.keys(changes).length > 0) {
      // deferred a frame — the linter flags synchronous setState in effects
      const id = requestAnimationFrame(() => setFlash((f) => ({ ...f, ...changes })));
      const t = setTimeout(() => setFlash({}), ROLL_MS + 600);
      return () => {
        cancelAnimationFrame(id);
        clearTimeout(t);
      };
    }
  }, [players]);

  // Winner's anthem when the game completes (needs sound enabled — the
  // enable tap doubles as the autoplay-policy user gesture).
  const status = game !== 'loading' && game !== null ? game.status : null;
  useEffect(() => {
    if (status !== 'completed' || playedWinnerAnthem.current) return;
    const winner = [...players].sort((a, b) => b.score - a.score)[0];
    if (!winner) return;
    playedWinnerAnthem.current = true;
    void playAnthem(winner.anthem);
  }, [status, players]);

  if (game === 'loading') {
    return (
      <div className="anim-fade-in flex min-h-screen items-center justify-center text-indigo-300">
        Loading leaderboard…
      </div>
    );
  }
  if (game === null) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-white">
        <p className="anim-rise-in rounded-xl bg-red-900/60 px-6 py-4 text-red-200 ring-1 ring-red-800">
          No game exists for room code {roomCode}.
        </p>
      </div>
    );
  }

  const ranked = [...players].sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name)
  );
  const completed = game.status === 'completed';

  return (
    <div className="flex min-h-screen flex-col items-center px-6 py-10 text-white">
      <header className="anim-fade-in flex w-full max-w-3xl items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-400">
            {completed ? 'Final standings' : 'Live leaderboard'}
          </p>
          <h1 className="font-display text-4xl uppercase tracking-wide sm:text-5xl">
            Friend <span className="text-amber-400">Trivia</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundOn(ensureSoundEnabled())}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95 ${
              soundOn
                ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                : 'border-indigo-600 text-indigo-300 hover:bg-indigo-800/60'
            }`}
            aria-pressed={soundOn}
          >
            {soundOn ? '🔊 Sound on' : '🔇 Enable sound'}
          </button>
          <p className="font-display text-2xl tracking-[0.2em] text-indigo-400">
            {roomCode}
          </p>
        </div>
      </header>

      <div
        className="relative mt-10 w-full max-w-3xl"
        style={{ height: ranked.length * ROW_H }}
      >
        {ranked.map((p, rank) => {
          const f = flash[p.id];
          const leader = rank === 0 && p.score > 0;
          return (
            <div
              key={p.id}
              className="absolute left-0 right-0 transition-[top] duration-700 ease-in-out"
              style={{ top: rank * ROW_H }}
            >
              <div
                className={`flex items-center gap-4 rounded-2xl px-5 py-3.5 ring-1 transition-colors duration-500 ${
                  f === 'up'
                    ? 'bg-emerald-500/20 ring-emerald-400/60'
                    : f === 'down'
                      ? 'bg-red-500/20 ring-red-400/60'
                      : leader
                        ? 'bg-gradient-to-r from-amber-400/25 to-indigo-900/70 ring-amber-400/50'
                        : 'bg-indigo-900/70 ring-indigo-700/50'
                }`}
              >
                <span
                  className={`w-10 text-center font-display text-2xl ${
                    leader ? 'text-amber-400' : 'text-indigo-400'
                  }`}
                >
                  {completed && rank === 0 ? '👑' : rank + 1}
                </span>
                <Avatar player={p} sizeClass="h-14 w-14" textClass="text-xl" />
                <span className="min-w-0 flex-1 truncate text-xl font-semibold">
                  {p.name}
                </span>
                {p.anthem && (
                  <span
                    className="hidden max-w-40 truncate text-xs text-indigo-400 sm:block"
                    title={`${p.anthem.title} — ${p.anthem.artist}`}
                  >
                    🎵 {p.anthem.title}
                  </span>
                )}
                <span
                  className={`font-display text-3xl tabular-nums ${
                    f === 'up'
                      ? 'text-emerald-300'
                      : f === 'down'
                        ? 'text-red-300'
                        : p.score < 0
                          ? 'text-red-400'
                          : 'text-amber-400'
                  }`}
                >
                  <ScoreTicker value={p.score} sound={soundOn} />
                </span>
              </div>
            </div>
          );
        })}
        {ranked.length === 0 && (
          <p className="pt-10 text-center text-indigo-400">
            Waiting for players to join room {roomCode}…
          </p>
        )}
      </div>

      <p className="anim-fade-in mt-8 text-sm text-indigo-500">
        Updates live as the host scores — put me on the second screen 📺
      </p>
      <ShoutOverlay roomCode={roomCode} />
    </div>
  );
}
