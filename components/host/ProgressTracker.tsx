'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Game, Player, Question } from '@/lib/types';
import { generateBoard, settingsForGroup } from '@/lib/gameLogic';
import { writeTiles, updateGame } from '@/lib/db';
import Avatar from '@/components/Avatar';

interface Props {
  game: Game;
  players: Player[];
  questions: Question[];
}

export default function ProgressTracker({ game, players, questions }: Props) {
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitUrl, setSubmitUrl] = useState('');

  // window isn't available during SSR; set the URL after mount (deferred a
  // frame to avoid a synchronous setState-in-effect render cascade).
  useEffect(() => {
    const id = setTimeout(
      () => setSubmitUrl(`${window.location.origin}/submit/${game.roomCode}`),
      0
    );
    return () => clearTimeout(id);
  }, [game.roomCode]);

  // A player doc only exists once they submit, so everyone listed is in.
  // The host decides when the group is complete; 2+ players makes a game.
  const submittedCount = players.filter((p) => p.submitted).length;
  const canBuild = submittedCount >= 2;

  async function handleCopy() {
    await navigator.clipboard.writeText(submitUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleBuildBoard() {
    setBuilding(true);
    setError(null);
    try {
      const settings = settingsForGroup(game.settings, players.length);
      const tiles = generateBoard(players, questions, settings);
      await writeTiles(tiles);
      await updateGame(game.roomCode, { status: 'in_progress', settings });
    } catch {
      setError('Board build failed — try again.');
      setBuilding(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 text-white">
      <p className="anim-fade-in text-sm uppercase tracking-[0.3em] text-indigo-400">
        Room code
      </p>
      <p className="anim-rise-in font-display text-7xl uppercase tracking-[0.15em] text-amber-400 drop-shadow-[0_4px_24px_rgba(246,196,83,0.35)] sm:text-8xl">
        {game.roomCode}
      </p>

      <div className="anim-rise-in mt-10 flex w-full max-w-3xl flex-col items-stretch gap-6 sm:flex-row" style={{ animationDelay: '120ms' }}>
        {/* Invite card */}
        <div className="flex flex-1 flex-col items-center gap-4 rounded-3xl bg-indigo-900/70 p-6 ring-1 ring-indigo-700/60">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-indigo-300">
            Players scan to submit
          </h2>
          <div className="rounded-2xl bg-white p-3 shadow-lg">
            {submitUrl && (
              <QRCodeSVG value={submitUrl} size={168} fgColor="#0b0d24" bgColor="#ffffff" />
            )}
          </div>
          <button
            onClick={handleCopy}
            className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] ${
              copied
                ? 'bg-emerald-500 text-white'
                : 'border border-indigo-600 text-indigo-300 hover:bg-indigo-800/60 hover:text-white'
            }`}
          >
            {copied ? '✓ Link copied' : 'Copy submission link'}
          </button>
        </div>

        {/* Players card */}
        <div className="flex flex-1 flex-col rounded-3xl bg-indigo-900/70 p-6 ring-1 ring-indigo-700/60">
          <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-indigo-300">
            {submittedCount === 0
              ? 'Waiting for players'
              : `${submittedCount} ${submittedCount === 1 ? 'player' : 'players'} in`}
          </h2>
          <ul className="mt-4 flex flex-1 flex-col gap-2 overflow-y-auto">
            {players.map((p, i) => (
              <li
                key={p.id}
                className="anim-rise-in flex items-center gap-3 rounded-xl bg-indigo-800/70 px-4 py-2"
                style={{ animationDelay: `${Math.min(i * 60, 400)}ms` }}
              >
                <Avatar player={p} sizeClass="h-9 w-9" textClass="text-sm" />
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                <span aria-label="submitted">✅</span>
              </li>
            ))}
            {players.length === 0 && (
              <li className="flex flex-1 items-center justify-center py-6 text-center text-sm text-indigo-400">
                First scan starts the party…
              </li>
            )}
          </ul>

          <button
            onClick={handleBuildBoard}
            disabled={!canBuild || building}
            className="mt-5 w-full rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-6 py-4 text-lg font-bold text-indigo-950 shadow-[0_8px_30px_rgba(246,196,83,0.3)] transition hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {building ? 'Building…' : 'Build the Board'}
          </button>
          <p className="mt-2 text-center text-xs text-indigo-400">
            {canBuild
              ? 'Build once the whole group is in — anyone not listed won’t be on the board.'
              : 'Needs at least 2 players.'}
          </p>
          {error && (
            <p className="mt-2 rounded-xl bg-red-900/60 px-4 py-2 text-center text-sm text-red-200 ring-1 ring-red-800">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
