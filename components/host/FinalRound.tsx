'use client';

import { useMemo, useState } from 'react';
import { Game, Player, Question } from '@/lib/types';
import {
  pickFinalRoundQuestion,
  pickLightningQuestions,
  resolveDailyDouble,
} from '@/lib/gameLogic';
import {
  updatePlayerScore,
  updateGame,
  markQuestionUsed,
  startFinalRound,
  startLightning,
  updateFinalRound,
  setFinalWager,
} from '@/lib/db';
import Avatar from '@/components/Avatar';
import LightningRound from './LightningRound';

interface Props {
  game: Game;
  players: Player[];
  questions: Question[];
}

// The Final Wager round, driven by game.finalRound so the stage and the
// host console stay in sync. Wagers arrive live from each player's phone.
export default function FinalRound({ game, players, questions }: Props) {
  const fr = game.finalRound ?? null;
  const [rerollKey, setRerollKey] = useState(0);
  const [useCustom, setUseCustom] = useState(false);
  const [customText, setCustomText] = useState('');
  const [customAnswer, setCustomAnswer] = useState('');
  const [verdicts, setVerdicts] = useState<Record<string, boolean>>({});
  const [resolving, setResolving] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pooled = useMemo(() => pickFinalRoundQuestion(questions), [questions.length, rerollKey]);

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const locked = players.filter((p) => p.finalWager != null);

  async function begin() {
    const q = useCustom
      ? { questionText: customText.trim(), answerText: customAnswer.trim(), poolId: null }
      : pooled
        ? { questionText: pooled.text, answerText: pooled.answer, poolId: pooled.id }
        : null;
    if (!q) return;
    await startFinalRound(game.roomCode, players, q);
  }

  async function forceMissingToZero() {
    await Promise.all(
      players.filter((p) => p.finalWager == null).map((p) => setFinalWager(p.id, 0))
    );
  }

  async function applyResults() {
    if (!fr) return;
    setResolving(true);
    // finalScores rides the same write as status='completed' so the archive
    // never reads a players snapshot that predates the wager updates.
    const finalScores: Record<string, number> = {};
    for (const p of players) {
      finalScores[p.id] = resolveDailyDouble(p.score, p.finalWager ?? 0, verdicts[p.id] ?? false);
    }
    await Promise.all(players.map((p) => updatePlayerScore(p.id, finalScores[p.id])));
    if (fr.poolId) await markQuestionUsed(fr.poolId);
    await updateGame(game.roomCode, { status: 'completed', finalRound: null, finalScores });
  }

  // Lightning takes over the whole final-round screen while it runs.
  if (game.lightning) {
    return <LightningRound game={game} players={players} questions={questions} />;
  }

  const lightningPool = pickLightningQuestions(questions);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 text-white">
      <p className="anim-fade-in font-display text-3xl uppercase tracking-[0.2em] text-amber-400 drop-shadow-[0_4px_20px_rgba(246,196,83,0.35)] sm:text-4xl">
        Final Wager
      </p>

      {/* Setup — pick the question */}
      {fr === null && (
        <div className="anim-rise-in mt-8 flex w-full max-w-lg flex-col items-center gap-6">
          {lightningPool.length >= 3 && (
            <button
              onClick={() =>
                startLightning(game.roomCode, lightningPool, game.settings.pointScale[0])
              }
              className="w-full rounded-2xl border-2 border-amber-400/60 px-6 py-4 text-lg font-bold text-amber-300 transition hover:bg-amber-400/10 active:scale-[0.98]"
            >
              ⚡ Lightning round first — 60s of rapid fire ({lightningPool.length} unused
              questions)
            </button>
          )}
          {!useCustom ? (
            <>
              <p className="text-indigo-300">One last question, drawn from the unused pool:</p>
              <div className="w-full rounded-3xl bg-indigo-900/70 p-7 text-center ring-1 ring-indigo-700/60">
                {pooled ? (
                  <p className="text-xl font-semibold leading-snug">{pooled.text}</p>
                ) : (
                  <p className="text-indigo-400">
                    No unused questions left — write a custom one below.
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setRerollKey((k) => k + 1)}
                  disabled={!pooled}
                  className="rounded-xl border border-indigo-600 px-4 py-2.5 text-indigo-300 transition hover:bg-indigo-800/60 hover:text-white active:scale-[0.98] disabled:opacity-40"
                >
                  🎲 Reroll
                </button>
                <button
                  onClick={() => setUseCustom(true)}
                  className="rounded-xl border border-indigo-600 px-4 py-2.5 text-indigo-300 transition hover:bg-indigo-800/60 hover:text-white active:scale-[0.98]"
                >
                  ✍️ Write my own
                </button>
              </div>
            </>
          ) : (
            <div className="anim-rise-in flex w-full flex-col gap-3">
              <label className="text-sm text-indigo-300">
                Custom final question
                <textarea
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-indigo-700 bg-indigo-900 px-3 py-2 text-white focus:border-amber-400 focus:outline-none"
                />
              </label>
              <label className="text-sm text-indigo-300">
                Answer
                <input
                  value={customAnswer}
                  onChange={(e) => setCustomAnswer(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-indigo-700 bg-indigo-900 px-3 py-2 text-white focus:border-amber-400 focus:outline-none"
                />
              </label>
              <button
                onClick={() => setUseCustom(false)}
                className="self-start text-sm text-indigo-400 underline-offset-4 hover:text-indigo-300 hover:underline"
              >
                ← Back to the random pick
              </button>
            </div>
          )}

          <button
            onClick={begin}
            disabled={useCustom ? !customText.trim() || !customAnswer.trim() : !pooled}
            className="w-full max-w-sm rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-6 py-4 text-lg font-bold text-indigo-950 shadow-[0_8px_30px_rgba(246,196,83,0.3)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
          >
            Open wagers on everyone&apos;s phones
          </button>
        </div>
      )}

      {/* Wagers — live checklist while phones submit */}
      {fr?.step === 'wagers' && (
        <div className="anim-rise-in mt-8 flex w-full max-w-md flex-col items-center gap-6">
          <p className="text-center text-xl text-indigo-200">
            📱 Place your <span className="font-bold text-amber-300">secret wager</span> on
            your phone — up to your current score.
          </p>
          <p className="font-display text-3xl text-amber-400">
            {locked.length} / {players.length} locked in
          </p>
          <ul className="grid w-full grid-cols-2 gap-2">
            {sortedPlayers.map((p) => (
              <li
                key={p.id}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ring-1 transition ${
                  p.finalWager != null
                    ? 'bg-emerald-500/15 ring-emerald-500/40'
                    : 'bg-indigo-900/70 ring-indigo-700/50'
                }`}
              >
                <Avatar player={p} sizeClass="h-8 w-8" textClass="text-xs" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                <span>{p.finalWager != null ? '🔒' : '…'}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => updateFinalRound(game.roomCode, { step: 'question' })}
              disabled={locked.length < players.length}
              className="rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-8 py-4 text-lg font-bold text-indigo-950 shadow-[0_8px_30px_rgba(246,196,83,0.3)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
            >
              Show the question
            </button>
            {locked.length < players.length && (
              <button
                onClick={forceMissingToZero}
                className="text-sm text-indigo-400 underline-offset-4 hover:text-indigo-300 hover:underline"
              >
                Missing someone? Set their wager to 0
              </button>
            )}
          </div>
        </div>
      )}

      {/* Question on stage */}
      {fr?.step === 'question' && (
        <div className="anim-pop-in mt-8 flex w-full max-w-2xl flex-col items-center gap-8">
          <p className="max-w-xl text-center text-3xl font-semibold leading-snug tracking-tight sm:text-4xl">
            {fr.questionText}
          </p>
          <p className="text-indigo-400">
            Everyone answers out loud (or on paper) — then reveal.
          </p>
          <button
            onClick={() => updateFinalRound(game.roomCode, { step: 'judging' })}
            className="rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-9 py-4 text-lg font-bold text-indigo-950 shadow-[0_8px_30px_rgba(246,196,83,0.3)] transition hover:brightness-105 active:scale-[0.98]"
          >
            Reveal the answer
          </button>
        </div>
      )}

      {/* Judging — wagers become public, all changes land together */}
      {fr?.step === 'judging' && (
        <div className="anim-rise-in mt-8 flex w-full max-w-2xl flex-col items-center gap-6">
          <p className="max-w-xl text-center text-2xl font-semibold leading-snug">
            {fr.questionText}
          </p>
          <p className="anim-reveal-flip rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-7 py-3 text-2xl font-bold text-indigo-950 shadow-[0_4px_24px_rgba(246,196,83,0.4)]">
            {fr.answerText}
          </p>
          <p className="text-xs uppercase tracking-widest text-indigo-400">
            Mark who got it right — all wagers apply together
          </p>
          <ul className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
            {sortedPlayers.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-xl bg-indigo-900/80 px-4 py-3 ring-1 ring-indigo-700/50"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{p.name}</span>{' '}
                  <span className="font-mono text-sm text-indigo-400">
                    wagered {p.finalWager ?? 0}
                  </span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <button
                    onClick={() => setVerdicts((v) => ({ ...v, [p.id]: false }))}
                    className={`flex h-11 w-11 items-center justify-center rounded-full font-bold transition active:scale-95 ${
                      verdicts[p.id] === false
                        ? 'bg-red-600 ring-2 ring-red-300'
                        : 'bg-red-900/80 hover:bg-red-700'
                    }`}
                    aria-label={`${p.name} wrong`}
                  >
                    ✗
                  </button>
                  <button
                    onClick={() => setVerdicts((v) => ({ ...v, [p.id]: true }))}
                    className={`flex h-11 w-11 items-center justify-center rounded-full font-bold transition active:scale-95 ${
                      verdicts[p.id] === true
                        ? 'bg-emerald-500 ring-2 ring-emerald-200'
                        : 'bg-emerald-900/80 hover:bg-emerald-700'
                    }`}
                    aria-label={`${p.name} correct`}
                  >
                    ✓
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <button
            onClick={applyResults}
            disabled={resolving || players.some((p) => verdicts[p.id] === undefined)}
            className="w-full max-w-sm rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-6 py-4 text-lg font-bold text-indigo-950 shadow-[0_8px_30px_rgba(246,196,83,0.3)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
          >
            {resolving ? 'Applying…' : 'Apply results → final standings'}
          </button>
        </div>
      )}
    </div>
  );
}
