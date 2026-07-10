'use client';

import { useEffect, useRef, useState } from 'react';
import { Buzz, Game, Player } from '@/lib/types';
import { armBuzzers, watchBuzzes } from '@/lib/db';
import { playBuzzDing } from '@/lib/lpSound';

interface Props {
  game: Game;
  /** Play a ding on the first buzz (the stage does; the console doesn't). */
  withSound?: boolean;
  /** Console mode: render ✓/✗ next to each buzzer for one-tap judging. */
  players?: Player[];
  onJudge?: (player: Player, correct: boolean) => void;
  judgingDisabled?: boolean;
}

// Shows the live buzz order for the current round. Arming/disarming happens
// in the db layer (openTile/closeStage) so exactly one surface owns it.
export default function BuzzerPanel({
  game,
  withSound = false,
  players,
  onJudge,
  judgingDisabled = false,
}: Props) {
  const [buzzes, setBuzzes] = useState<Buzz[]>([]);
  const dingedRef = useRef(false);
  const round = game.buzzerRound ?? 0;

  useEffect(() => {
    return watchBuzzes(game.roomCode, setBuzzes);
  }, [game.roomCode]);

  const roundBuzzes = buzzes.filter((b) => b.round === round);
  const lockedOut = game.stage?.lockedOut ?? [];

  useEffect(() => {
    if (!withSound) return;
    if (roundBuzzes.length > 0 && !dingedRef.current) {
      dingedRef.current = true;
      playBuzzDing();
    }
    if (roundBuzzes.length === 0) dingedRef.current = false;
  }, [roundBuzzes.length, withSound]);

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
          onClick={() => armBuzzers(game.roomCode, round)}
          className="rounded-lg border border-indigo-700 px-2.5 py-1 text-xs font-semibold text-indigo-300 transition hover:bg-indigo-800"
        >
          ↻ Reset
        </button>
      </div>
      {roundBuzzes.length > 0 && (
        <ol className="mt-2 flex flex-col gap-1.5">
          {roundBuzzes.map((b, i) => {
            const player = players?.find((p) => p.id === b.playerId);
            const out = lockedOut.includes(b.playerId);
            return (
              <li
                key={b.id}
                className={`anim-tile-in flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold ${
                  i === 0 && !out
                    ? 'bg-gradient-to-r from-amber-400/90 to-amber-300/80 text-indigo-950'
                    : 'bg-indigo-800/80 text-indigo-200'
                } ${out ? 'opacity-40' : ''}`}
              >
                <span className="font-display">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{b.name}</span>
                {i > 0 && roundBuzzes[0].at !== Number.MAX_SAFE_INTEGER && (
                  <span className={i === 0 ? 'text-indigo-900/70' : 'text-indigo-400'}>
                    +{((b.at - roundBuzzes[0].at) / 1000).toFixed(2)}s
                  </span>
                )}
                {onJudge && player && (
                  <span className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => onJudge(player, false)}
                      disabled={judgingDisabled || out}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-red-700 font-bold text-white transition hover:bg-red-600 active:scale-90 disabled:opacity-40"
                      aria-label={`${b.name} wrong`}
                    >
                      ✗
                    </button>
                    <button
                      onClick={() => onJudge(player, true)}
                      disabled={judgingDisabled || out}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 font-bold text-white transition hover:bg-emerald-500 active:scale-90 disabled:opacity-40"
                      aria-label={`${b.name} correct`}
                    >
                      ✓
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
