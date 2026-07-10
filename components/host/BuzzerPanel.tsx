'use client';

import { useEffect, useRef, useState } from 'react';
import { Buzz, Game } from '@/lib/types';
import { armBuzzers, disarmBuzzers, watchBuzzes } from '@/lib/db';
import { playBuzzDing } from '@/lib/lpSound';

interface Props {
  game: Game;
}

// Lives inside the question modal: arms the phone buzzers on mount,
// shows the live buzz order with time deltas, disarms on unmount.
export default function BuzzerPanel({ game }: Props) {
  const [buzzes, setBuzzes] = useState<Buzz[]>([]);
  const [round, setRound] = useState<number | null>(null);
  const dingedRef = useRef(false);

  useEffect(() => {
    const newRound = (game.buzzerRound ?? 0) + 1;
    // deferred a frame — the linter flags synchronous setState in effects
    const id = requestAnimationFrame(() => setRound(newRound));
    void armBuzzers(game.roomCode, game.buzzerRound ?? 0);
    return () => {
      cancelAnimationFrame(id);
      void disarmBuzzers(game.roomCode);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.roomCode]);

  useEffect(() => {
    return watchBuzzes(game.roomCode, setBuzzes);
  }, [game.roomCode]);

  const roundBuzzes = round === null ? [] : buzzes.filter((b) => b.round === round);

  useEffect(() => {
    if (roundBuzzes.length > 0 && !dingedRef.current) {
      dingedRef.current = true;
      playBuzzDing();
    }
    if (roundBuzzes.length === 0) dingedRef.current = false;
  }, [roundBuzzes.length]);

  async function handleReset() {
    if (round === null) return;
    setBuzzes([]);
    await armBuzzers(game.roomCode, round);
    setRound(round + 1);
  }

  return (
    <div className="mt-5 rounded-2xl bg-indigo-950/60 px-4 py-3 ring-1 ring-indigo-700/40">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
          {roundBuzzes.length === 0 ? (
            <span className="animate-pulse">⚡ Buzzers armed — phones are live</span>
          ) : (
            '⚡ Buzz order'
          )}
        </p>
        <button
          onClick={handleReset}
          className="rounded-lg border border-indigo-700 px-2.5 py-1 text-xs font-semibold text-indigo-300 transition hover:bg-indigo-800"
        >
          ↻ Reset
        </button>
      </div>
      {roundBuzzes.length > 0 && (
        <ol className="mt-2 flex flex-wrap gap-2">
          {roundBuzzes.map((b, i) => (
            <li
              key={b.id}
              className={`anim-tile-in flex items-baseline gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
                i === 0
                  ? 'bg-gradient-to-b from-amber-300 to-amber-400 text-indigo-950'
                  : 'bg-indigo-800/80 text-indigo-200'
              }`}
            >
              <span className="font-display">{i + 1}</span>
              {b.name}
              {i > 0 && roundBuzzes[0].at !== Number.MAX_SAFE_INTEGER && (
                <span className={i === 0 ? 'text-indigo-900/70' : 'text-indigo-400'}>
                  +{((b.at - roundBuzzes[0].at) / 1000).toFixed(2)}s
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
