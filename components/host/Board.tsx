'use client';

import { Player, Tile as TileType } from '@/lib/types';
import Tile from './Tile';

interface Props {
  players: Player[];
  tiles: TileType[];
  pointScale: number[];
  onTileClick: (tile: TileType) => void;
}

export default function Board({ players, tiles, pointScale, onTileClick }: Props) {
  const many = players.length > 6;

  return (
    <div className="overflow-x-auto pb-2">
      <div
        className="grid gap-1.5 sm:gap-2"
        style={{
          gridTemplateColumns: `repeat(${players.length}, minmax(${many ? 96 : 120}px, 1fr))`,
        }}
      >
        {players.map((p) => (
          <div
            key={p.id}
            title={p.name}
            className={`flex min-h-12 items-center justify-center truncate rounded-lg bg-gradient-to-b from-indigo-800 to-indigo-900 px-2 py-2 text-center font-bold uppercase tracking-wider text-indigo-200 ring-1 ring-white/5 ${
              many ? 'text-xs' : 'text-sm sm:text-base'
            }`}
          >
            <span className="truncate">{p.name}</span>
          </div>
        ))}

        {pointScale.map((value, row) =>
          players.map((p, col) => {
            const tile = tiles.find(
              (t) => t.ownerPlayerId === p.id && t.pointValue === value
            );
            if (!tile) {
              return <div key={`${p.id}-${value}`} className="aspect-[4/3]" />;
            }
            return (
              <Tile
                key={tile.id}
                tile={tile}
                compact={many}
                index={row * players.length + col}
                onClick={() => onTileClick(tile)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
