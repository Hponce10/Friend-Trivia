'use client';

import { useEffect, useState } from 'react';
import { Game, Player, Question } from '@/lib/types';
import {
  armBuzzers,
  disarmBuzzers,
  endLightning,
  markQuestionUsed,
  updateLightning,
} from '@/lib/db';
import { lightningJudge } from '@/lib/judging';
import BuzzerPanel from './BuzzerPanel';

interface Props {
  game: Game;
  players: Player[];
  questions: Question[];
  /** Console mode shows the private answer and compact layout. */
  compact?: boolean;
}

const LIGHTNING_SECONDS = 60;

// The rapid-fire round between the board and the Final Wager. State lives on
// game.lightning so the stage, console, and phones move together. The clock
// is advisory — the host always ends the round explicitly (no auto-close
// effects; see AGENTS.md landmines).
export default function LightningRound({ game, players, questions, compact = false }: Props) {
  const lightning = game.lightning!;
  const [resolving, setResolving] = useState(false);
  // Wall clock lives in state (render must stay pure); ticks while running.
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (lightning.endsAt === null) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0); // deferred — no sync setState in effects
    const id = setInterval(tick, 250);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [lightning.endsAt]);

  const question = questions.find((q) => q.id === lightning.questionIds[lightning.index]) ?? null;
  const owner = question ? players.find((p) => p.id === question.ownerPlayerId) : null;
  const remaining =
    lightning.endsAt === null || now === 0
      ? LIGHTNING_SECONDS
      : Math.max(0, Math.ceil((lightning.endsAt - now) / 1000));
  const outOfQuestions = lightning.index >= lightning.questionIds.length;
  const timeUp = lightning.endsAt !== null && remaining === 0;
  const done = outOfQuestions || timeUp;

  async function start() {
    await updateLightning(game.roomCode, { endsAt: Date.now() + LIGHTNING_SECONDS * 1000 });
    await armBuzzers(game.roomCode, game.buzzerRound ?? 0);
  }

  async function advance() {
    if (question) await markQuestionUsed(question.id);
    const nextId = lightning.questionIds[lightning.index + 1];
    await updateLightning(game.roomCode, {
      index: lightning.index + 1,
      // Keep the phones told whose question is up — their buzzer locks on
      // their own question.
      ownerId: questions.find((q) => q.id === nextId)?.ownerPlayerId ?? null,
    });
    await armBuzzers(game.roomCode, game.buzzerRound ?? 0);
  }

  async function judge(player: Player, correct: boolean) {
    setResolving(true);
    try {
      await lightningJudge(player, correct, lightning.perCorrect);
      if (correct) await advance();
    } finally {
      setResolving(false);
    }
  }

  async function finish() {
    if (question && lightning.endsAt !== null) await markQuestionUsed(question.id);
    await endLightning(game.roomCode);
    await disarmBuzzers(game.roomCode);
  }

  return (
    <div className={`flex w-full flex-col items-center gap-5 ${compact ? '' : 'min-h-screen justify-center px-4 py-10'} text-white`}>
      <p className="anim-fade-in font-display text-3xl uppercase tracking-[0.2em] text-amber-400 drop-shadow-[0_4px_20px_rgba(246,196,83,0.35)]">
        ⚡ Lightning Round
      </p>

      {/* Countdown + progress */}
      <div className="flex items-center gap-5">
        <p
          className={`font-display text-6xl tabular-nums ${
            remaining <= 10 && lightning.endsAt !== null ? 'animate-pulse text-red-400' : 'text-white'
          }`}
        >
          {remaining}
        </p>
        <p className="text-sm text-indigo-400">
          Q {Math.min(lightning.index + 1, lightning.questionIds.length)} /{' '}
          {lightning.questionIds.length} · +{lightning.perCorrect} per correct · no penalties
        </p>
      </div>

      {lightning.endsAt === null ? (
        <div className="anim-rise-in flex flex-col items-center gap-4">
          <p className="max-w-md text-center text-indigo-300">
            {lightning.questionIds.length} unused questions, {LIGHTNING_SECONDS} seconds,
            first buzz answers. Ready?
          </p>
          <button
            onClick={start}
            className="rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-10 py-4 text-lg font-bold text-indigo-950 shadow-[0_8px_30px_rgba(246,196,83,0.3)] transition hover:brightness-105 active:scale-[0.98]"
          >
            ⚡ Start the clock
          </button>
          <button
            onClick={() => endLightning(game.roomCode)}
            className="text-sm text-indigo-400 underline-offset-4 hover:text-indigo-300 hover:underline"
          >
            Never mind — back to the Final Wager
          </button>
        </div>
      ) : done ? (
        <div className="anim-pop-in flex flex-col items-center gap-4">
          <p className="font-display text-4xl uppercase text-amber-400">
            {timeUp ? "⏰ Time!" : '🎉 Pool cleared!'}
          </p>
          <button
            onClick={finish}
            className="rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-8 py-4 text-lg font-bold text-indigo-950 shadow-[0_8px_30px_rgba(246,196,83,0.3)] transition hover:brightness-105 active:scale-[0.98]"
          >
            On to the Final Wager →
          </button>
        </div>
      ) : question ? (
        <div className="anim-rise-in w-full max-w-2xl">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-amber-400/90">
            About {owner?.name ?? '???'} — hands off your buzzer, {owner?.name ?? 'subject'}!
          </p>
          <p className="mx-auto mt-4 max-w-xl text-center text-3xl font-semibold leading-snug tracking-tight sm:text-4xl">
            {question.text}
          </p>
          {compact && (
            <div className="mt-3 rounded-xl bg-gradient-to-b from-amber-300 to-amber-400 px-4 py-2.5 text-indigo-950">
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-900/60">
                Answer — only you can see this
              </p>
              <p className="text-lg font-bold">{question.answer}</p>
            </div>
          )}

          <BuzzerPanel
            game={game}
            withSound={!compact}
            players={players}
            onJudge={judge}
            judgingDisabled={resolving}
          />

          <div className="mt-4 flex justify-center gap-3">
            <button
              onClick={() => advance()}
              disabled={resolving}
              className="rounded-xl border border-indigo-700 px-5 py-2.5 text-sm text-indigo-300 transition hover:bg-indigo-800/60 hover:text-white disabled:opacity-40"
            >
              Skip →
            </button>
            <button
              onClick={finish}
              className="rounded-xl border border-indigo-700 px-5 py-2.5 text-sm text-indigo-400 transition hover:bg-indigo-800/60"
            >
              End round early
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
