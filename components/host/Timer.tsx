'use client';

import { useEffect, useState } from 'react';

const PRESETS = [15, 30, 60];

export default function Timer() {
  const [duration, setDuration] = useState(30);
  const [remaining, setRemaining] = useState(30);
  // Wall-clock deadline while running; null while paused. Recomputing from
  // Date.now() keeps the clock honest even when the browser throttles timers
  // (background tab, host switching to a music app, etc.).
  const [endsAt, setEndsAt] = useState<number | null>(null);

  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  const expired = remaining === 0;
  const running = endsAt !== null && !expired;
  const pct = (remaining / duration) * 100;

  function reset(to?: number) {
    setEndsAt(null);
    setRemaining(to ?? duration);
  }

  return (
    <div className="w-full max-w-lg">
      <div className="flex items-center gap-3">
        <span
          className={`w-10 text-center font-display text-2xl tabular-nums ${
            expired
              ? 'animate-pulse text-red-400'
              : remaining <= 5
                ? 'text-red-300'
                : 'text-amber-400'
          }`}
          aria-live={expired ? 'assertive' : 'off'}
        >
          {remaining}
        </span>

        {/* Ambient pressure: a slim bar draining under the question */}
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ease-linear ${
              expired || remaining <= 5 ? 'bg-red-400' : 'bg-amber-400'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <button
          onClick={() => {
            if (expired) reset();
            else if (running) setEndsAt(null);
            else setEndsAt(Date.now() + remaining * 1000);
          }}
          className="min-w-20 rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold transition hover:bg-indigo-600 active:scale-[0.97]"
        >
          {expired ? '↻ Again' : running ? '⏸ Pause' : '▶ Go'}
        </button>
        <span className="flex gap-1">
          {PRESETS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setDuration(s);
                reset(s);
              }}
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
      </div>
    </div>
  );
}
