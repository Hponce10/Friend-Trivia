'use client';

import { useEffect, useState } from 'react';
import { Answer, Game, Player, Question, Tile, WildcardType } from '@/lib/types';
import { updateStage, closeStage, updateQuestion, watchAnswers } from '@/lib/db';
import {
  judgeCorrect,
  judgeWrong,
  judgeSteal,
  judgeStealSkip,
  performSwap,
  nobodyGotIt,
  applyEveryoneAnswers,
} from '@/lib/judging';
import WagerInput from './WagerInput';
import Timer from './Timer';
import BuzzerPanel from './BuzzerPanel';

interface Props {
  game: Game;
  tile: Tile;
  question: Question;
  players: Player[];
  onClose?: () => void; // optional local cleanup; stage close is shared
}

export const WILDCARD_INFO: Record<
  WildcardType,
  { title: string; emoji: string; blurb: string; world: string; button: string }
> = {
  daily_double: {
    title: 'Daily Double!',
    emoji: '🎰',
    blurb: 'Only the picker answers — after wagering up to their score.',
    world: 'from-amber-500 via-amber-600 to-orange-700',
    button: 'bg-indigo-950 text-amber-300 hover:bg-indigo-900',
  },
  double_or_nothing: {
    title: 'Double or Nothing!',
    emoji: '⚡',
    blurb: 'First to buzz. Correct doubles the tile value — wrong loses double.',
    world: 'from-violet-600 via-purple-700 to-indigo-900',
    button: 'bg-white text-violet-800 hover:bg-violet-100',
  },
  steal: {
    title: 'Steal!',
    emoji: '🏴‍☠️',
    blurb: 'Answer correctly and you also take points from an opponent.',
    world: 'from-rose-600 via-red-700 to-rose-950',
    button: 'bg-white text-rose-800 hover:bg-rose-100',
  },
  swap: {
    title: 'Swap!',
    emoji: '🔄',
    blurb: 'The picker may force a full score swap with an opponent before the question plays.',
    world: 'from-teal-500 via-cyan-700 to-slate-900',
    button: 'bg-white text-teal-800 hover:bg-teal-100',
  },
  everyone_answers: {
    title: 'Everyone Answers!',
    emoji: '📱',
    blurb: 'No buzzers — every phone types an answer at the same time. Correct earns the tile, wrong costs nothing.',
    world: 'from-emerald-500 via-teal-700 to-cyan-950',
    button: 'bg-white text-emerald-800 hover:bg-emerald-100',
  },
};

// The stage rendering of the live question. All interactive state lives in
// game.stage (Firestore), so the host console and this screen always agree —
// buttons here keep working for single-screen setups.
export default function QuestionModal({ game, tile, question, players }: Props) {
  const stage = game.stage!;
  const wildcard = tile.wildcardType;
  const [resolving, setResolving] = useState(false);
  const [editingAnswer, setEditingAnswer] = useState(false);
  const [answerDraft, setAnswerDraft] = useState(question.answer);
  const [eaVerdicts, setEaVerdicts] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<Answer[]>([]);

  const isEA = wildcard === 'everyone_answers';
  useEffect(() => {
    if (!isEA) return;
    return watchAnswers(game.roomCode, setAnswers);
  }, [game.roomCode, isEA]);

  const owner = players.find((p) => p.id === tile.ownerPlayerId);
  const ddPlayer = players.find((p) => p.id === stage.ddPlayerId);
  const roomCode = game.roomCode;
  const roundAnswers = answers.filter((a) => a.round === (game.buzzerRound ?? 0));
  const eaAnswerers = players.filter((p) => p.id !== tile.ownerPlayerId);

  async function withResolving(fn: () => Promise<void>) {
    setResolving(true);
    try {
      await fn();
    } finally {
      setResolving(false);
    }
  }

  const answeringPlayers =
    wildcard === 'daily_double' && ddPlayer ? [ddPlayer] : players;

  // Full-screen wildcard takeover — its own color world per type.
  if (stage.step === 'wc_reveal' && wildcard) {
    const info = WILDCARD_INFO[wildcard];
    return (
      <div className="anim-fade-in fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={`anim-wildcard-pop flex w-full max-w-xl flex-col items-center gap-5 rounded-3xl bg-gradient-to-br px-8 py-14 text-center text-white shadow-2xl ring-1 ring-white/20 ${info.world}`}
        >
          <p className="text-7xl drop-shadow-lg">{info.emoji}</p>
          <h2 className="font-display text-5xl uppercase tracking-wide drop-shadow-md sm:text-6xl">
            {info.title}
          </h2>
          <p className="max-w-md text-lg text-white/85">{info.blurb}</p>
          <button
            onClick={() =>
              updateStage(roomCode, {
                step:
                  wildcard === 'daily_double'
                    ? 'dd_pick'
                    : wildcard === 'swap'
                      ? 'swap_pick'
                      : wildcard === 'everyone_answers'
                        ? 'ea_answering'
                        : 'question',
              })
            }
            className={`mt-4 rounded-2xl px-10 py-4 text-lg font-bold shadow-lg transition active:scale-[0.98] ${info.button}`}
          >
            Let&apos;s play
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="anim-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="anim-pop-in relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-gradient-to-b from-indigo-900 to-indigo-950 p-6 text-white shadow-2xl ring-1 ring-indigo-700/60 sm:p-10">
        <button
          onClick={() => closeStage(roomCode)}
          aria-label="Cancel — keep this tile in play"
          title="Close without resolving; the tile stays on the board"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-indigo-700 text-sm text-indigo-400 transition hover:bg-indigo-800 hover:text-white"
        >
          ✕
        </button>

        {stage.step === 'dd_pick' && (
          <div className="anim-rise-in flex flex-col items-center gap-4">
            <h3 className="font-display text-2xl uppercase tracking-wide text-amber-400">
              Who picked this tile?
            </h3>
            <p className="text-sm text-indigo-400">Only they get to answer.</p>
            <ul className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              {players.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() =>
                      updateStage(roomCode, { ddPlayerId: p.id, step: 'dd_wager' })
                    }
                    className="w-full rounded-xl bg-indigo-800 px-4 py-3 font-medium ring-1 ring-white/5 transition hover:bg-indigo-700 active:scale-[0.98]"
                  >
                    {p.name} <span className="font-mono text-indigo-400">({p.score})</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {stage.step === 'dd_wager' && ddPlayer && (
          <div className="anim-rise-in flex flex-col items-center gap-4">
            <h3 className="font-display text-2xl uppercase tracking-wide text-amber-400">
              {ddPlayer.name}, place your wager
            </h3>
            <WagerInput
              label="Wager"
              max={Math.max(ddPlayer.score, tile.pointValue)}
              onConfirm={(amount) =>
                updateStage(roomCode, { ddWager: amount, step: 'question' })
              }
            />
          </div>
        )}

        {stage.step === 'swap_pick' && (
          <div className="anim-rise-in flex flex-col items-center gap-4">
            <h3 className="font-display text-2xl uppercase tracking-wide text-amber-400">
              {stage.swapPickerId === null ? 'Who picked this tile?' : 'Swap scores with…'}
            </h3>
            <p className="text-sm text-indigo-400">
              {stage.swapPickerId === null
                ? 'The picker may force a score swap before the question plays.'
                : 'Pick an opponent — their scores trade places.'}
            </p>
            <ul className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              {players
                .filter((p) => p.id !== stage.swapPickerId)
                .map((p) => (
                  <li key={p.id}>
                    <button
                      disabled={resolving}
                      onClick={() => {
                        if (stage.swapPickerId === null) {
                          updateStage(roomCode, { swapPickerId: p.id });
                        } else {
                          const picker = players.find((x) => x.id === stage.swapPickerId);
                          if (picker) withResolving(() => performSwap(game, picker, p));
                        }
                      }}
                      className="w-full rounded-xl bg-indigo-800 px-4 py-3 font-medium ring-1 ring-white/5 transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
                    >
                      {p.name} <span className="font-mono text-indigo-400">({p.score})</span>
                    </button>
                  </li>
                ))}
            </ul>
            <button
              onClick={() => updateStage(roomCode, { step: 'question' })}
              className="text-sm text-indigo-400 underline-offset-4 hover:text-indigo-300 hover:underline"
            >
              Skip the swap — play the question
            </button>
          </div>
        )}

        {stage.step === 'question' && (
          <div className="anim-rise-in">
            {/* Kicker */}
            <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-amber-400/90">
              About {owner?.name ?? '???'} · {tile.pointValue}
              {wildcard === 'daily_double' && ` · wager ${stage.ddWager}`}
              {wildcard === 'double_or_nothing' && ' · double or nothing'}
              {wildcard === 'steal' && ' · steal'}
            </p>

            {/* The question is the hero */}
            <p className="mx-auto mt-6 min-h-24 max-w-xl text-center text-3xl font-semibold leading-snug tracking-tight sm:text-4xl">
              {question.text}
            </p>

            <div className="mt-6 flex justify-center">
              <Timer
                endsAt={stage.timerEndsAt}
                remaining={stage.timerRemaining}
                duration={stage.timerDuration}
                onChange={(u) => updateStage(roomCode, u)}
              />
            </div>

            <BuzzerPanel game={game} withSound />

            <div className="mt-6 flex min-h-14 items-center justify-center gap-2">
              {stage.answerRevealed ? (
                editingAnswer ? (
                  <span className="anim-fade-in flex items-center gap-2">
                    <input
                      value={answerDraft}
                      onChange={(e) => setAnswerDraft(e.target.value)}
                      autoFocus
                      className="rounded-xl border border-amber-400 bg-indigo-950 px-4 py-3 text-xl font-bold text-amber-300 focus:outline-none"
                      aria-label="Edit answer"
                    />
                    <button
                      onClick={async () => {
                        await updateQuestion(question.id, { answer: answerDraft.trim() });
                        setEditingAnswer(false);
                      }}
                      className="rounded-xl bg-amber-400 px-3 py-2.5 font-semibold text-indigo-950 transition hover:brightness-105 active:scale-[0.98]"
                    >
                      Save
                    </button>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <p className="anim-reveal-flip rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-7 py-3 text-2xl font-bold text-indigo-950 shadow-[0_4px_24px_rgba(246,196,83,0.4)]">
                      {question.answer}
                    </p>
                    <button
                      onClick={() => {
                        setAnswerDraft(question.answer);
                        setEditingAnswer(true);
                      }}
                      aria-label="Edit answer"
                      title="Fix the answer"
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-600 text-indigo-300 transition hover:bg-indigo-800"
                    >
                      ✎
                    </button>
                  </span>
                )
              ) : (
                <button
                  onClick={() => updateStage(roomCode, { answerRevealed: true })}
                  className="rounded-2xl border-2 border-amber-400/70 px-8 py-3 text-lg font-semibold text-amber-300 transition hover:bg-amber-400/10 active:scale-[0.98]"
                >
                  Reveal answer
                </button>
              )}
            </div>

            {/* Resolution — de-emphasized until the answer is out */}
            <div
              className={`mt-8 transition-opacity duration-300 ${
                stage.answerRevealed ? 'opacity-100' : 'opacity-50'
              }`}
            >
              <p className="text-center text-xs uppercase tracking-widest text-indigo-400">
                {wildcard === 'daily_double' && ddPlayer
                  ? `${ddPlayer.name} answers alone · ✓ +${stage.ddWager} · ✗ −${stage.ddWager}`
                  : wildcard === 'double_or_nothing'
                    ? `First to buzz · ✓ +${2 * tile.pointValue} · ✗ −${2 * tile.pointValue} · one attempt`
                    : wildcard === 'steal'
                      ? `✓ +${tile.pointValue} plus a steal${game.settings.penaltyOnWrong ? ` · ✗ −${tile.pointValue}` : ''}`
                      : `✓ +${tile.pointValue}${game.settings.penaltyOnWrong ? ` · ✗ −${tile.pointValue}` : ''}`}
              </p>
              <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {answeringPlayers.map((p) => (
                  <li
                    key={p.id}
                    className={`flex items-center justify-between rounded-xl bg-indigo-800/80 px-4 py-2 ring-1 ring-white/5 transition-opacity ${
                      stage.lockedOut.includes(p.id) ? 'opacity-35' : ''
                    }`}
                  >
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="flex shrink-0 gap-2">
                      <button
                        onClick={() => withResolving(() => judgeWrong(game, tile, question, p))}
                        disabled={resolving || stage.lockedOut.includes(p.id)}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-red-700/90 font-bold transition hover:bg-red-600 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100"
                        aria-label={`${p.name} wrong`}
                      >
                        ✗
                      </button>
                      <button
                        onClick={() => withResolving(() => judgeCorrect(game, tile, question, p))}
                        disabled={resolving || stage.lockedOut.includes(p.id)}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 font-bold transition hover:bg-emerald-500 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100"
                        aria-label={`${p.name} correct`}
                      >
                        ✓
                      </button>
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => withResolving(() => nobodyGotIt(game, tile, question, players))}
                disabled={resolving}
                className="mt-4 w-full rounded-xl border border-indigo-700 px-4 py-2.5 text-sm text-indigo-400 transition hover:bg-indigo-800/60 hover:text-indigo-200"
              >
                No one got it — {owner ? `${owner.name} banks ${tile.pointValue} 🧠` : 'close question'}
              </button>
            </div>
          </div>
        )}

        {stage.step === 'ea_answering' && (
          <div className="anim-rise-in">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400/90">
              📱 Everyone answers · about {owner?.name ?? '???'} · {tile.pointValue}
            </p>
            <p className="mx-auto mt-6 min-h-24 max-w-xl text-center text-3xl font-semibold leading-snug tracking-tight sm:text-4xl">
              {question.text}
            </p>
            <p className="mt-4 text-center text-sm text-indigo-300">
              Type your answer on your phone — {owner?.name ?? 'the subject'} stays quiet.
            </p>
            <p className="mt-6 text-center font-display text-3xl text-emerald-300">
              {roundAnswers.length} / {eaAnswerers.length} answers in
            </p>
            <ul className="mt-3 flex flex-wrap justify-center gap-2">
              {eaAnswerers.map((p) => {
                const answered = roundAnswers.some((a) => a.playerId === p.id);
                return (
                  <li
                    key={p.id}
                    className={`rounded-full px-3 py-1 text-sm ${
                      answered
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : 'bg-indigo-800/70 text-indigo-300'
                    }`}
                  >
                    {p.name} {answered ? '🔒' : '…'}
                  </li>
                );
              })}
            </ul>
            <button
              onClick={() => updateStage(roomCode, { step: 'ea_judging' })}
              disabled={roundAnswers.length === 0}
              className="mx-auto mt-8 block rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-8 py-4 text-lg font-bold text-indigo-950 shadow-[0_8px_30px_rgba(246,196,83,0.3)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
            >
              Reveal the answers →
            </button>
          </div>
        )}

        {stage.step === 'ea_judging' && (
          <div className="anim-rise-in">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400/90">
              📱 Everyone answers · about {owner?.name ?? '???'} · {tile.pointValue}
            </p>
            <p className="mx-auto mt-4 max-w-xl text-center text-xl font-semibold leading-snug">
              {question.text}
            </p>
            <p className="anim-reveal-flip mx-auto mt-4 w-fit rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-6 py-2.5 text-xl font-bold text-indigo-950 shadow-[0_4px_24px_rgba(246,196,83,0.4)]">
              {question.answer}
            </p>
            <ul className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {roundAnswers.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-indigo-800/80 px-4 py-2.5 ring-1 ring-white/5"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-indigo-400">{a.name}</span>
                    <span className="block truncate font-medium">“{a.text}”</span>
                  </span>
                  <span className="flex shrink-0 gap-2">
                    <button
                      onClick={() => setEaVerdicts((v) => ({ ...v, [a.playerId]: false }))}
                      className={`flex h-11 w-11 items-center justify-center rounded-full font-bold transition active:scale-95 ${
                        eaVerdicts[a.playerId] === false
                          ? 'bg-red-600 ring-2 ring-red-300'
                          : 'bg-red-900/80 hover:bg-red-700'
                      }`}
                      aria-label={`${a.name} wrong`}
                    >
                      ✗
                    </button>
                    <button
                      onClick={() => setEaVerdicts((v) => ({ ...v, [a.playerId]: true }))}
                      className={`flex h-11 w-11 items-center justify-center rounded-full font-bold transition active:scale-95 ${
                        eaVerdicts[a.playerId] === true
                          ? 'bg-emerald-500 ring-2 ring-emerald-200'
                          : 'bg-emerald-900/80 hover:bg-emerald-700'
                      }`}
                      aria-label={`${a.name} correct`}
                    >
                      ✓
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            {eaAnswerers.some((p) => !roundAnswers.some((a) => a.playerId === p.id)) && (
              <p className="mt-3 text-center text-xs text-indigo-400">
                No answer ={' '}
                {eaAnswerers
                  .filter((p) => !roundAnswers.some((a) => a.playerId === p.id))
                  .map((p) => p.name)
                  .join(', ')}{' '}
                — counts as a miss.
              </p>
            )}
            <button
              onClick={() =>
                withResolving(() =>
                  applyEveryoneAnswers(game, tile, question, players, eaVerdicts)
                )
              }
              disabled={
                resolving ||
                roundAnswers.some((a) => eaVerdicts[a.playerId] === undefined)
              }
              className="mx-auto mt-6 block w-full max-w-sm rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-6 py-4 text-lg font-bold text-indigo-950 shadow-[0_8px_30px_rgba(246,196,83,0.3)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
            >
              {resolving ? 'Applying…' : 'Apply — correct answers bank the tile'}
            </button>
          </div>
        )}

        {stage.step === 'steal_pick' && (
          <StealPicker
            players={players.filter((p) => p.id !== stage.stealWinnerId)}
            maxSteal={tile.pointValue}
            resolving={resolving}
            onSteal={(victim, amount) => {
              const winner = players.find((p) => p.id === stage.stealWinnerId);
              if (winner)
                withResolving(() => judgeSteal(game, tile, question, winner, victim, amount));
            }}
            onSkip={() => {
              const winner = players.find((p) => p.id === stage.stealWinnerId);
              if (winner) withResolving(() => judgeStealSkip(game, tile, question, winner));
            }}
          />
        )}
      </div>
    </div>
  );
}

function StealPicker({
  players,
  maxSteal,
  resolving,
  onSteal,
  onSkip,
}: {
  players: Player[];
  maxSteal: number;
  resolving: boolean;
  onSteal: (victim: Player, amount: number) => void;
  onSkip: () => void;
}) {
  const [victimId, setVictimId] = useState<string | null>(null);
  const victim = players.find((p) => p.id === victimId);

  return (
    <div className="anim-rise-in flex flex-col items-center gap-4">
      <h3 className="font-display text-2xl uppercase tracking-wide text-amber-400">
        🏴‍☠️ Correct! Pick your victim
      </h3>
      {!victim ? (
        <ul className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
          {players.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => setVictimId(p.id)}
                className="w-full rounded-xl bg-indigo-800 px-4 py-3 font-medium ring-1 ring-white/5 transition hover:bg-indigo-700 active:scale-[0.98]"
              >
                {p.name} <span className="font-mono text-indigo-400">({p.score})</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <WagerInput
          label={`Steal from ${victim.name}`}
          max={maxSteal}
          onConfirm={(amount) => !resolving && onSteal(victim, amount)}
        />
      )}
      <button
        onClick={onSkip}
        disabled={resolving}
        className="text-sm text-indigo-400 underline-offset-4 hover:text-indigo-300 hover:underline"
      >
        Skip the steal — just take the tile points
      </button>
    </div>
  );
}
