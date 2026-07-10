'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Player } from '@/lib/types';
import { playAnthem } from '@/lib/anthem';
import Avatar from '@/components/Avatar';

interface Props {
  players: Player[];
}

const PODIUM_ORDER = [1, 0, 2]; // display 2nd, 1st, 3rd
const PODIUM_HEIGHTS = ['h-24', 'h-36', 'h-16'];
const PODIUM_MEDALS = ['🥈', '🥇', '🥉'];

export default function ResultsScreen({ players }: Props) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const podium = PODIUM_ORDER.map((rank) => ({ player: sorted[rank], rank }));
  const rest = sorted.slice(3);

  const anthemPlayed = useRef(false);
  useEffect(() => {
    // Winner's victory lap — the "Apply results" click that got us here
    // satisfies the autoplay gesture requirement.
    if (winner && !anthemPlayed.current) {
      anthemPlayed.current = true;
      void playAnthem(winner.anthem);
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    import('canvas-confetti').then(({ default: confetti }) => {
      const burst = (x: number) =>
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { x, y: 0.5 },
          colors: ['#f6c453', '#ffd873', '#4450c9', '#ffffff'],
        });
      burst(0.3);
      setTimeout(() => burst(0.7), 250);
      setTimeout(() => burst(0.5), 550);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 text-white">
      <p className="anim-fade-in text-sm font-semibold uppercase tracking-[0.3em] text-indigo-400">
        Final standings
      </p>

      {winner && (
        <div className="anim-crown-drop mt-4 text-center" style={{ animationDelay: '900ms' }}>
          <p className="text-6xl">👑</p>
          <p className="mt-1 font-display text-5xl uppercase tracking-wide text-amber-400 drop-shadow-[0_4px_24px_rgba(246,196,83,0.4)] sm:text-6xl">
            {winner.name}
          </p>
        </div>
      )}

      {/* Podium */}
      <div className="mt-10 flex w-full max-w-lg items-end justify-center gap-3">
        {podium.map(({ player, rank }, i) =>
          player ? (
            <div
              key={player.id}
              className="anim-rise-in flex flex-1 flex-col items-center gap-2"
              style={{ animationDelay: `${600 - rank * 250}ms` }}
            >
              <span className="text-3xl">{PODIUM_MEDALS[i]}</span>
              <Avatar player={player} sizeClass="h-16 w-16" textClass="text-2xl" />
              <span className="max-w-full truncate font-semibold">{player.name}</span>
              <div
                className={`flex w-full items-start justify-center rounded-t-xl pt-2 font-display text-xl ring-1 ring-white/10 ${PODIUM_HEIGHTS[i]} ${
                  rank === 0
                    ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-indigo-950'
                    : 'bg-gradient-to-b from-indigo-700 to-indigo-800 text-amber-300'
                }`}
              >
                {player.score}
              </div>
            </div>
          ) : (
            <div key={`empty-${i}`} className="flex-1" />
          )
        )}
      </div>

      {/* Everyone else */}
      {rest.length > 0 && (
        <ul className="mt-8 flex w-full max-w-md flex-col gap-2">
          {rest.map((p, i) => (
            <li
              key={p.id}
              className="anim-rise-in flex items-center justify-between rounded-xl bg-indigo-900/70 px-5 py-2.5 ring-1 ring-indigo-700/50"
              style={{ animationDelay: `${800 + i * 100}ms` }}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="w-7 shrink-0 text-right font-display text-indigo-400">
                  {i + 4}
                </span>
                <span className="truncate font-medium">{p.name}</span>
              </span>
              <span
                className={`font-mono font-bold tabular-nums ${
                  p.score < 0 ? 'text-red-400' : 'text-indigo-200'
                }`}
              >
                {p.score}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/"
        className="anim-fade-in mt-12 rounded-2xl border border-indigo-600 px-6 py-3 text-indigo-300 transition hover:bg-indigo-800/60 hover:text-white active:scale-[0.98]"
        style={{ animationDelay: '1400ms' }}
      >
        Start a new game
      </Link>
    </div>
  );
}
