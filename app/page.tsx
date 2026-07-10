'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createGame, getGame } from '@/lib/db';
import GuideModal from '@/components/home/GuideModal';
import { PlayerGuide, HostGuide, RulesGuide } from '@/components/home/guides';

const DECOR_TILES = ['100', '200', '?', '400', '500'];

type GuideKey = 'player' | 'host' | 'rules';

const GUIDES: Record<
  GuideKey,
  { emoji: string; title: string; kicker: string; blurb: string }
> = {
  player: {
    emoji: '🙋',
    title: 'Player Guide',
    kicker: 'I got a link — now what?',
    blurb: 'Submitting your 10 questions & what game night looks like',
  },
  host: {
    emoji: '🎤',
    title: 'Host Guide',
    kicker: 'Running the show',
    blurb: 'The full playbook, from room code to crowning a winner',
  },
  rules: {
    emoji: '📖',
    title: 'Game Rules',
    kicker: 'The rulebook',
    blurb: 'Scoring, all four wildcards, and the Final Wager',
  },
};

export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openGuide, setOpenGuide] = useState<GuideKey | null>(null);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      const game = await createGame();
      router.push(`/host/${game.roomCode}`);
    } catch {
      setError('Could not create game. Check your connection and try again.');
      setBusy(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 4) {
      setError('Room codes are 4 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    const game = await getGame(code);
    if (!game) {
      setError(`No game found for room code ${code}.`);
      setBusy(false);
      return;
    }
    router.push(`/host/${code}`);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-white">
      <div className="anim-rise-in flex flex-col items-center">
        {/* Mini board motif */}
        <div className="flex gap-1.5" aria-hidden="true">
          {DECOR_TILES.map((v, i) => (
            <div
              key={i}
              className={`anim-tile-in flex h-10 w-14 items-center justify-center rounded-md font-display text-sm shadow-lg ring-1 ring-white/10 ${
                v === '?'
                  ? 'bg-gradient-to-b from-amber-300 to-amber-400 text-lg text-indigo-950'
                  : 'bg-gradient-to-b from-indigo-600 to-indigo-800 text-amber-400'
              }`}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              {v}
            </div>
          ))}
        </div>

        <h1 className="mt-6 text-center font-display text-5xl uppercase leading-none tracking-wide sm:text-7xl">
          Friend <span className="text-amber-400">Trivia</span>
        </h1>
        <p className="mt-4 max-w-md text-center text-indigo-300">
          A Jeopardy-style board built from questions about your friends.
          Everyone submits ahead of time; one screen hosts the game night.
        </p>
      </div>

      <div className="anim-rise-in mt-12 flex w-full max-w-sm flex-col gap-6" style={{ animationDelay: '150ms' }}>
        <button
          onClick={handleCreate}
          disabled={busy}
          className="rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-6 py-4 text-lg font-bold text-indigo-950 shadow-[0_8px_30px_rgba(246,196,83,0.35)] transition hover:brightness-105 hover:shadow-[0_8px_40px_rgba(246,196,83,0.5)] active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? 'Setting the stage…' : 'Host a new game'}
        </button>

        <div className="flex items-center gap-3 text-sm text-indigo-500">
          <div className="h-px flex-1 bg-indigo-800" />
          returning host?
          <div className="h-px flex-1 bg-indigo-800" />
        </div>

        <form onSubmit={handleJoin} className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Room code"
            maxLength={4}
            aria-label="Room code"
            className="min-w-0 flex-1 rounded-2xl border border-indigo-700 bg-indigo-900/70 px-4 py-3 text-center font-display text-xl tracking-[0.35em] uppercase placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:text-indigo-500 focus:border-amber-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-2xl border border-indigo-600 px-5 py-3 font-semibold text-indigo-300 transition hover:bg-indigo-800/60 hover:text-white active:scale-[0.98] disabled:opacity-50"
          >
            Open
          </button>
        </form>

        {error && (
          <p className="anim-rise-in rounded-xl bg-red-900/60 px-4 py-2.5 text-center text-sm text-red-200 ring-1 ring-red-800">
            {error}
          </p>
        )}

        <p className="text-center text-sm text-indigo-500">
          Players: your host will send you a link — or read the guides below.
        </p>
      </div>

      {/* Guides */}
      <div
        className="anim-rise-in mt-14 w-full max-w-3xl pb-10"
        style={{ animationDelay: '300ms' }}
      >
        <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-indigo-400">
          New here? Start with a guide
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(Object.keys(GUIDES) as GuideKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setOpenGuide(key)}
              className="group flex flex-col items-start gap-1.5 rounded-2xl bg-indigo-900/60 p-5 text-left ring-1 ring-indigo-700/50 transition hover:-translate-y-0.5 hover:bg-indigo-800/60 hover:ring-indigo-500/60 active:scale-[0.98]"
            >
              <span className="text-3xl">{GUIDES[key].emoji}</span>
              <span className="mt-1 font-display text-xl uppercase tracking-wide text-white">
                {GUIDES[key].title}
              </span>
              <span className="text-sm leading-snug text-indigo-300">
                {GUIDES[key].blurb}
              </span>
              <span className="mt-2 text-sm font-semibold text-amber-400 transition group-hover:translate-x-1">
                Read →
              </span>
            </button>
          ))}
        </div>
      </div>

      {openGuide && (
        <GuideModal
          kicker={GUIDES[openGuide].kicker}
          title={GUIDES[openGuide].title}
          onClose={() => setOpenGuide(null)}
        >
          {openGuide === 'player' && <PlayerGuide />}
          {openGuide === 'host' && <HostGuide />}
          {openGuide === 'rules' && <RulesGuide />}
        </GuideModal>
      )}
    </div>
  );
}
