'use client';

import { Player } from '@/lib/types';

interface Props {
  players: Player[];
}

export default function Scoreboard({ players }: Props) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const topScore = sorted[0]?.score ?? 0;

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {sorted.map((p) => {
        const leader = p.score === topScore && p.score > 0;
        return (
          <div
            key={p.id}
            className={`flex items-baseline gap-2 rounded-full px-4 py-1.5 ring-1 transition-all duration-300 ${
              leader
                ? 'bg-gradient-to-b from-amber-300 to-amber-400 text-indigo-950 ring-amber-200/60 shadow-[0_2px_14px_rgba(246,196,83,0.35)]'
                : 'bg-indigo-900/80 text-white ring-indigo-700/50'
            }`}
          >
            <span className="text-sm font-semibold">{p.name}</span>
            <span
              className={`font-mono text-base font-bold tabular-nums ${
                p.score < 0 ? 'text-red-400' : ''
              }`}
            >
              {p.score}
            </span>
          </div>
        );
      })}
    </div>
  );
}
