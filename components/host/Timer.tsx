'use client';

import { useEffect, useState } from 'react';
import { StageState } from '@/lib/types';

const PRESETS = [15, 30, 60];

interface Props {
  // Shared timer state from the stage doc — a wall-clock deadline while
  // running (null while paused), so every screen shows the same clock even
  // if a browser throttles timers.
  endsAt: number | null;
  remaining: number;
  duration: number;
  onChange: (updates: Partial<StageState>) => void;
  /** Hide the control buttons (pure display, e.g. a passive stage). */
  readOnly?: boolean;
}

export default function Timer({ endsAt, remaining, duration, onChange, readOnly = false }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  const shown =
    endsAt === null ? remaining : Math.max(0, Math.ceil((endsAt - now) / 1000));
  const expired = shown === 0;
  const running = endsAt !== null && !expired;
  const pct = (shown / duration) * 100;

  return (
    <div className="w-full max-w-lg">
      <div className="flex items-center gap-3">
        <span
          className={`w-10 text-center font-display text-2xl tabular-nums ${
            expired
              ? 'animate-pulse text-red-400'
              : shown <= 5
                ? 'text-red-300'
                : 'text-amber-400'
          }`}
          aria-live={expired ? 'assertive' : 'off'}
        >
          {shown}
        </span>

        {/* Ambient pressure: a slim bar draining under the question */}
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ease-linear ${
              expired || shown <= 5 ? 'bg-red-400' : 'bg-amber-400'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {!readOnly && (
          <>
            <button
              onClick={() => {
                if (expired) {
                  onChange({ timerEndsAt: null, timerRemaining: duration });
                } else if (running) {
                  onChange({ timerEndsAt: null, timerRemaining: shown });
                } else {
                  onChange({ timerEndsAt: Date.now() + remaining * 1000 });
                }
              }}
              className="min-w-20 rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold transition hover:bg-indigo-600 active:scale-[0.97]"
            >
              {expired ? '↻ Again' : running ? '⏸ Pause' : '▶ Go'}
            </button>
            <span className="flex gap-1">
              {PRESETS.map((s) => (
                <button
                  key={s}
                  onClick={() =>
                    onChange({ timerEndsAt: null, timerRemaining: s, timerDuration: s })
                  }
                  className={`rounded-md px-2 py-2 text-xs font-semibold transition ${
                    duration === s
                      ? 'bg-amber-400 text-indigo-950'
                      : 'bg-indigo-800/80 text-indigo-300 hover:bg-indigo-700'
                  }`}
                  aria-label={`Set timer to ${s} seconds`}
                >
                  {s}
                </button>
              ))}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
