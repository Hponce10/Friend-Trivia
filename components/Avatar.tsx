'use client';

import { Player } from '@/lib/types';

const FALLBACK_HUES = [15, 85, 155, 225, 295, 340, 45, 195];

export function hueFor(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return FALLBACK_HUES[h % FALLBACK_HUES.length];
}

interface Props {
  player: Pick<Player, 'name' | 'photo'>;
  /** Tailwind size classes, e.g. "h-12 w-12" */
  sizeClass?: string;
  textClass?: string;
}

export default function Avatar({
  player,
  sizeClass = 'h-12 w-12',
  textClass = 'text-lg',
}: Props) {
  if (player.photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={player.photo}
        alt={player.name}
        className={`${sizeClass} shrink-0 rounded-full object-cover ring-2 ring-white/20`}
      />
    );
  }
  const initials = player.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      aria-hidden="true"
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full font-display text-white ring-2 ring-white/20 ${textClass}`}
      style={{ backgroundColor: `hsl(${hueFor(player.name)} 55% 45%)` }}
    >
      {initials}
    </div>
  );
}
