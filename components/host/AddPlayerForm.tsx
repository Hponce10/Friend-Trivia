'use client';

import { useState } from 'react';
import { Player } from '@/lib/types';
import { addManualPlayer } from '@/lib/db';

interface Props {
  roomCode: string;
  players: Player[];
  /** 'panel' fits the admin drawer; 'lobby' fits the lobby card. */
  variant?: 'panel' | 'lobby';
}

// Manually add a walk-in player from the host screen. They can score, buzz,
// and wager — they just won't have a board column (no submitted questions).
export default function AddPlayerForm({ roomCode, players, variant = 'panel' }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`There's already a player named ${trimmed}.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addManualPlayer(roomCode, trimmed);
      setName('');
      setOpen(false);
    } catch {
      setError('Could not add the player — try again.');
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={
          variant === 'lobby'
            ? 'mt-2 w-full rounded-xl border border-dashed border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-300 transition hover:bg-indigo-800/60 hover:text-white active:scale-[0.98]'
            : 'mt-2 w-full rounded-xl border border-indigo-700 px-4 py-2.5 text-sm font-semibold text-indigo-300 transition hover:bg-indigo-900 active:scale-[0.98]'
        }
      >
        ＋ Add a player manually
      </button>
    );
  }

  return (
    <form onSubmit={handleAdd} className="anim-rise-in mt-2 flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={30}
          placeholder="Player name"
          aria-label="New player name"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-indigo-700 bg-indigo-950 px-3 text-base text-white placeholder:text-indigo-500 focus:border-amber-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="min-h-11 shrink-0 rounded-xl bg-amber-400 px-4 text-sm font-bold text-indigo-950 transition hover:bg-amber-300 active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? '…' : 'Add'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          aria-label="Cancel adding player"
          className="min-h-11 w-11 shrink-0 rounded-xl border border-indigo-700 text-indigo-400 transition hover:bg-indigo-900"
        >
          ✕
        </button>
      </div>
      <p className="text-xs text-indigo-500">
        They&apos;ll score, buzz, and wager — but the board only has columns for
        people who submitted questions.
      </p>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </form>
  );
}
