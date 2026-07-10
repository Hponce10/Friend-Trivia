'use client';

import { Tile as TileType } from '@/lib/types';

interface Props {
  tile: TileType;
  compact?: boolean;
  index?: number;
  onClick: () => void;
}

export default function Tile({ tile, compact = false, index = 0, onClick }: Props) {
  const delay = `${Math.min(index * 35, 900)}ms`;

  if (tile.status === 'used') {
    // Keep a dim ghost of the value so the host doesn't lose their place
    // on a board full of anonymous dark holes.
    return (
      <div
        className={`flex aspect-[4/3] items-center justify-center rounded-lg bg-indigo-900/30 font-display text-indigo-500/30 ring-1 ring-indigo-800/40 ${
          compact ? 'text-lg' : 'text-xl sm:text-2xl'
        }`}
        aria-hidden="true"
      >
        {tile.pointValue}
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`anim-tile-in flex aspect-[4/3] items-center justify-center rounded-lg bg-gradient-to-b from-indigo-600 to-indigo-800 font-display text-amber-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_8px_rgba(0,0,0,0.35)] ring-1 ring-white/10 transition duration-150 hover:-translate-y-0.5 hover:brightness-115 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_6px_20px_rgba(68,80,201,0.55)] active:scale-95 ${
        compact ? 'text-2xl' : 'text-3xl sm:text-4xl'
      }`}
      style={{ animationDelay: delay, textShadow: '0 2px 6px rgba(0,0,0,0.4)' }}
    >
      {tile.pointValue}
    </button>
  );
}
