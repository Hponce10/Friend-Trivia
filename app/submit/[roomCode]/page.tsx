'use client';

import { use, useEffect, useState } from 'react';
import { getGame } from '@/lib/db';
import { Game } from '@/lib/types';
import SubmissionForm from '@/components/submission/SubmissionForm';
import HomeLink from '@/components/HomeLink';

export default function SubmitPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode: rawCode } = use(params);
  const roomCode = rawCode.toUpperCase();
  const [game, setGame] = useState<Game | null | 'loading'>('loading');

  useEffect(() => {
    getGame(roomCode).then((g) => setGame(g));
  }, [roomCode]);

  return (
    <div className="relative min-h-screen bg-zinc-50 px-4 pt-8 dark:bg-zinc-950">
      <HomeLink variant="light" position="absolute" />
      <header className="anim-rise-in mx-auto max-w-lg pb-6 text-center">
        <p className="font-display text-sm tracking-[0.35em] text-indigo-600 dark:text-indigo-400">
          ROOM {roomCode}
        </p>
        <h1 className="mt-2 font-display text-3xl uppercase tracking-wide text-zinc-900 dark:text-zinc-50">
          Friend <span className="text-indigo-600 dark:text-indigo-400">Trivia</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Your questions, your friends&apos; game night
        </p>
      </header>

      {game === 'loading' && (
        <p className="text-center text-zinc-500">Checking room code…</p>
      )}

      {game === null && (
        <p className="mx-auto max-w-md rounded-lg bg-red-100 px-4 py-3 text-center text-red-800 dark:bg-red-950 dark:text-red-200">
          No game exists for room code {roomCode}. Double-check the link from
          your host.
        </p>
      )}

      {game !== 'loading' && game !== null && game.status !== 'collecting_submissions' && (
        <p className="mx-auto max-w-md rounded-lg bg-amber-100 px-4 py-3 text-center text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          This game is no longer accepting submissions — the board has already
          been built.
        </p>
      )}

      {game !== 'loading' && game !== null && game.status === 'collecting_submissions' && (
        <SubmissionForm roomCode={roomCode} />
      )}
    </div>
  );
}
