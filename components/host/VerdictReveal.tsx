'use client';

import { useEffect, useRef, useState } from 'react';
import { Game } from '@/lib/types';

// The stage's dramatic verdict: on every board-round judgment, a 3..2..1
// countdown, then the result with a meme GIF. Purely presentational — all
// scoring already happened; this just paces how the room finds out.
// z-[55]: above the question modal (50), below admin (60) and rules (70).

const COUNT_MS = 800;
const REVEAL_MS = 3800;

type Phase = 'idle' | 3 | 2 | 1 | 'reveal';

export default function VerdictReveal({ game }: { game: Game }) {
  const reveal = game.verdictReveal ?? null;
  const [phase, setPhase] = useState<Phase>('idle');
  const [gifFailed, setGifFailed] = useState(false);
  // Don't replay a verdict that predates this page load (same pattern as
  // the lastWin anthem on the host page).
  const playedAt = useRef<number | null | undefined>(undefined);

  const at = reveal?.at ?? null;
  useEffect(() => {
    if (playedAt.current === undefined) {
      playedAt.current = at;
      return;
    }
    if (at === null || at === playedAt.current) return;
    playedAt.current = at;
    setGifFailed(false);
    setPhase(3);
    const timers = [
      setTimeout(() => setPhase(2), COUNT_MS),
      setTimeout(() => setPhase(1), COUNT_MS * 2),
      setTimeout(() => setPhase('reveal'), COUNT_MS * 3),
      setTimeout(() => setPhase('idle'), COUNT_MS * 3 + REVEAL_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [at]);

  if (phase === 'idle' || !reveal) return null;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/85 backdrop-blur-sm">
      {phase !== 'reveal' ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-indigo-300">
            {reveal.name}…
          </p>
          <p
            key={phase}
            className="anim-wildcard-pop font-display text-[11rem] leading-none text-amber-400 drop-shadow-[0_8px_40px_rgba(246,196,83,0.5)]"
          >
            {phase}
          </p>
          {/* preload the gif behind the countdown */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={reveal.gifUrl} alt="" className="hidden" onError={() => setGifFailed(true)} />
        </div>
      ) : (
        <div className="anim-pop-in flex max-w-2xl flex-col items-center gap-5 px-4 text-center">
          <p
            className={`font-display text-5xl uppercase tracking-wide drop-shadow-lg sm:text-6xl ${
              reveal.correct ? 'text-emerald-300' : 'text-red-400'
            }`}
          >
            {reveal.correct ? `${reveal.name} got it! 🎉` : `${reveal.name}… no. 💀`}
          </p>
          {gifFailed ? (
            <p className="text-9xl">{reveal.correct ? '🎉' : '💀'}</p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={reveal.gifUrl}
              alt={reveal.correct ? 'celebration meme' : 'fail meme'}
              onError={() => setGifFailed(true)}
              className="max-h-[55vh] max-w-full rounded-3xl shadow-2xl ring-2 ring-white/20"
            />
          )}
        </div>
      )}
    </div>
  );
}
