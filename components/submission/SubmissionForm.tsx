'use client';

import { useEffect, useState } from 'react';
import QuestionTierInput, { TierQuestions } from './QuestionTierInput';
import AnthemPicker from './AnthemPicker';
import PhotoInput from './PhotoInput';
import { submitPlayer, QuestionInput } from '@/lib/db';
import { Anthem } from '@/lib/types';

const TIERS = [1, 2, 3, 4, 5] as const;

function emptyTier(): TierQuestions {
  return { q1: { text: '', answer: '' }, q2: { text: '', answer: '' } };
}

function slotFilled(slot: { text: string; answer: string }): boolean {
  return slot.text.trim() !== '' && slot.answer.trim() !== '';
}

interface Props {
  roomCode: string;
}

export default function SubmissionForm({ roomCode }: Props) {
  const [name, setName] = useState('');
  const [tiers, setTiers] = useState<Record<number, TierQuestions>>({
    1: emptyTier(),
    2: emptyTier(),
    3: emptyTier(),
    4: emptyTier(),
    5: emptyTier(),
  });
  const [anthem, setAnthem] = useState<Anthem | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filled = TIERS.reduce(
    (n, t) => n + (slotFilled(tiers[t].q1) ? 1 : 0) + (slotFilled(tiers[t].q2) ? 1 : 0),
    0
  );

  useEffect(() => {
    if (!done) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    import('canvas-confetti').then(({ default: confetti }) => {
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
    });
  }, [done]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!anthem) {
      setError('Pick your victory song before submitting — it plays every time you get an answer right!');
      return;
    }
    setSubmitting(true);
    setError(null);
    const questions: QuestionInput[] = [];
    for (const tier of TIERS) {
      const t = tiers[tier];
      questions.push({ tier, text: t.q1.text.trim(), answer: t.q1.answer.trim() });
      questions.push({ tier, text: t.q2.text.trim(), answer: t.q2.answer.trim() });
    }
    try {
      await submitPlayer(roomCode, name.trim(), questions, anthem, photo);
      setDone(true);
    } catch {
      setError('Submission failed — check your connection and try again.');
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="anim-pop-in mx-auto mt-16 max-w-md rounded-3xl bg-white p-8 text-center shadow-xl ring-1 ring-emerald-200 dark:bg-zinc-900 dark:ring-emerald-900">
        <p className="text-5xl">🎉</p>
        <h2 className="mt-4 font-display text-3xl uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
          You&apos;re in!
        </h2>
        <p className="mt-3 text-zinc-600 dark:text-zinc-300">
          All 10 questions locked in, <span className="font-semibold">{name}</span>.
        </p>
        <a
          href={`/play/${roomCode}`}
          className="mt-6 block rounded-2xl bg-gradient-to-b from-rose-500 to-rose-600 px-6 py-4 text-lg font-bold text-white shadow-lg shadow-rose-600/30 transition hover:brightness-110 active:scale-[0.98]"
        >
          🎮 Open your buzzer
        </a>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Bookmark it for game night — your phone is your buzzer, your
          reactions, and your trash-talk channel.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Sticky progress header */}
      <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-zinc-200 bg-zinc-50/90 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <span className="font-display text-sm tracking-widest text-indigo-600 dark:text-indigo-400">
            {roomCode}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                filled === 10 ? 'bg-emerald-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${(filled / 10) * 100}%` }}
            />
          </div>
          <span
            className={`text-sm font-semibold tabular-nums ${
              filled === 10
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            {filled}/10
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto flex max-w-lg flex-col gap-5 pb-16">
        {/* Player details */}
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700">
          <header className="flex items-center gap-3 bg-gradient-to-r from-zinc-700 to-zinc-800 px-4 py-3 text-white">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20 text-lg">
              🙋
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold leading-tight">About you</h3>
              <p className="truncate text-xs text-white/80">
                Your name and face on the board
              </p>
            </div>
          </header>
          <div className="flex flex-col gap-4 p-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Your name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="How the board should show you"
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-3 text-lg text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>
            <PhotoInput value={photo} onChange={setPhoto} />
          </div>
        </section>

        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Pick 10 questions about yourself — 2 per level, from the dropdowns (or
          write your own). Level 1 should be a gimme that everyone playing knows;
          by Level 5, maybe one person in the room knows the answer. The game
          randomly keeps one of each pair, so make both good!
        </p>

        {TIERS.map((tier) => (
          <QuestionTierInput
            key={tier}
            tier={tier}
            value={tiers[tier]}
            onChange={(v) => setTiers((prev) => ({ ...prev, [tier]: v }))}
          />
        ))}

        {/* Victory song */}
        <section
          className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition-shadow dark:bg-zinc-900 ${
            anthem ? 'ring-2 ring-emerald-400 dark:ring-emerald-600' : 'ring-zinc-200 dark:ring-zinc-700'
          }`}
        >
          <header className="flex items-center gap-3 bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 text-white">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20 text-lg">
              🎵
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold leading-tight">Your victory song</h3>
              <p className="truncate text-xs text-white/80">
                Plays on the big screen every time you answer correctly
              </p>
            </div>
            <span
              className={`text-xl transition-opacity ${anthem ? 'opacity-100' : 'opacity-0'}`}
              aria-label={anthem ? 'Victory song chosen' : undefined}
            >
              ✅
            </span>
          </header>
          <div className="p-4">
            <AnthemPicker value={anthem} onChange={setAnthem} />
          </div>
        </section>

        {error && (
          <p className="rounded-xl bg-red-100 px-4 py-2.5 text-center text-sm text-red-800 ring-1 ring-red-200 dark:bg-red-950 dark:text-red-200 dark:ring-red-900">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-2xl bg-gradient-to-b from-indigo-500 to-indigo-600 px-6 py-4 text-lg font-bold text-white shadow-lg shadow-indigo-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : `Submit my 10 questions`}
        </button>
      </form>
    </>
  );
}
