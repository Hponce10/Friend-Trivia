'use client';

import { useMemo, useState } from 'react';
import { Game, Player, Question } from '@/lib/types';
import { pickFinalRoundQuestion, resolveDailyDouble } from '@/lib/gameLogic';
import { updatePlayerScore, updateGame, markQuestionUsed } from '@/lib/db';
import WagerInput from './WagerInput';

interface Props {
  game: Game;
  players: Player[];
  questions: Question[];
}

type Step = 'setup' | 'wagers' | 'question' | 'judging';

export default function FinalRound({ game, players, questions }: Props) {
  const [step, setStep] = useState<Step>('setup');
  const [rerollKey, setRerollKey] = useState(0);
  const [useCustom, setUseCustom] = useState(false);
  const [customText, setCustomText] = useState('');
  const [customAnswer, setCustomAnswer] = useState('');
  const [finalQuestion, setFinalQuestion] = useState<{ text: string; answer: string; poolId: string | null } | null>(null);
  const [wagers, setWagers] = useState<Record<string, number>>({});
  const [wagerIndex, setWagerIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [verdicts, setVerdicts] = useState<Record<string, boolean>>({});
  const [resolving, setResolving] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pooled = useMemo(() => pickFinalRoundQuestion(questions), [questions.length, rerollKey]);

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const wagerPlayer = players[wagerIndex];

  function startWagers() {
    if (useCustom) {
      setFinalQuestion({ text: customText.trim(), answer: customAnswer.trim(), poolId: null });
    } else if (pooled) {
      setFinalQuestion({ text: pooled.text, answer: pooled.answer, poolId: pooled.id });
    }
    setStep('wagers');
  }

  async function applyResults() {
    setResolving(true);
    await Promise.all(
      players.map((p) =>
        updatePlayerScore(
          p.id,
          resolveDailyDouble(p.score, wagers[p.id] ?? 0, verdicts[p.id] ?? false)
        )
      )
    );
    if (finalQuestion?.poolId) {
      await markQuestionUsed(finalQuestion.poolId);
    }
    await updateGame(game.roomCode, { status: 'completed' });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 text-white">
      <p className="anim-fade-in font-display text-3xl uppercase tracking-[0.2em] text-amber-400 drop-shadow-[0_4px_20px_rgba(246,196,83,0.35)] sm:text-4xl">
        Final Wager
      </p>

      {step === 'setup' && (
        <div className="anim-rise-in mt-8 flex w-full max-w-lg flex-col items-center gap-6">
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
            onClick={startWagers}
            disabled={useCustom ? !customText.trim() || !customAnswer.trim() : !pooled}
            className="w-full max-w-sm rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-6 py-4 text-lg font-bold text-indigo-950 shadow-[0_8px_30px_rgba(246,196,83,0.3)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
          >
            Collect wagers
          </button>
        </div>
      )}

      {step === 'wagers' && wagerPlayer && (
        <div
          key={wagerPlayer.id}
          className="anim-pop-in mt-8 flex w-full max-w-md flex-col items-center gap-5 rounded-3xl bg-indigo-900/70 p-8 ring-1 ring-indigo-700/60"
        >
          <p className="rounded-full bg-indigo-800 px-4 py-1.5 text-sm text-indigo-300">
            📱 Pass the screen · {wagerIndex + 1} of {players.length}
          </p>
          <p className="font-display text-5xl uppercase tracking-wide">{wagerPlayer.name}</p>
          <p className="font-mono text-lg text-indigo-300">
            Current score: <span className="font-bold text-white">{wagerPlayer.score}</span>
          </p>
          <WagerInput
            key={wagerPlayer.id}
            label="Your secret wager"
            max={Math.max(wagerPlayer.score, 0)}
            onConfirm={(amount) => {
              setWagers((prev) => ({ ...prev, [wagerPlayer.id]: amount }));
              if (wagerIndex + 1 < players.length) {
                setWagerIndex(wagerIndex + 1);
              } else {
                setStep('question');
              }
            }}
          />
        </div>
      )}

      {step === 'question' && finalQuestion && (
        <div className="anim-pop-in mt-8 flex w-full max-w-2xl flex-col items-center gap-8">
          <p className="max-w-xl text-center text-3xl font-semibold leading-snug tracking-tight sm:text-4xl">
            {finalQuestion.text}
          </p>
          <p className="text-indigo-400">
            Everyone answers out loud (or on paper) — then reveal.
          </p>
          <button
            onClick={() => {
              setShowAnswer(true);
              setStep('judging');
            }}
            className="rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-9 py-4 text-lg font-bold text-indigo-950 shadow-[0_8px_30px_rgba(246,196,83,0.3)] transition hover:brightness-105 active:scale-[0.98]"
          >
            Reveal the answer
          </button>
        </div>
      )}

      {step === 'judging' && finalQuestion && (
        <div className="anim-rise-in mt-8 flex w-full max-w-2xl flex-col items-center gap-6">
          <p className="max-w-xl text-center text-2xl font-semibold leading-snug">
            {finalQuestion.text}
          </p>
          {showAnswer && (
            <p className="anim-reveal-flip rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-7 py-3 text-2xl font-bold text-indigo-950 shadow-[0_4px_24px_rgba(246,196,83,0.4)]">
              {finalQuestion.answer}
            </p>
          )}
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
                    wagered {wagers[p.id] ?? 0}
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
