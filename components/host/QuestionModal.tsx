'use client';

import { useState } from 'react';
import { Game, Player, Question, Tile, WildcardType } from '@/lib/types';
import {
  resolveNormal,
  resolveDailyDouble,
  resolveDoubleOrNothing,
  resolveSteal,
  resolveSwap,
} from '@/lib/gameLogic';
import { updatePlayerScore, updateTile, markQuestionUsed, updateQuestion } from '@/lib/db';
import { playAnthem } from '@/lib/anthem';
import WagerInput from './WagerInput';
import Timer from './Timer';
import BuzzerPanel from './BuzzerPanel';

interface Props {
  game: Game;
  tile: Tile;
  question: Question;
  players: Player[];
  onClose: () => void;
}

type Step =
  | 'wildcard_reveal'
  | 'swap_pick'
  | 'dd_pick_player'
  | 'dd_wager'
  | 'question'
  | 'steal_pick';

const WILDCARD_INFO: Record<
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
};

export default function QuestionModal({ game, tile, question, players, onClose }: Props) {
  const wildcard = tile.wildcardType;
  const [step, setStep] = useState<Step>(wildcard ? 'wildcard_reveal' : 'question');
  const [showAnswer, setShowAnswer] = useState(false);
  const [lockedOut, setLockedOut] = useState<Set<string>>(new Set());
  const [resolving, setResolving] = useState(false);
  const [ddPlayerId, setDdPlayerId] = useState<string | null>(null);
  const [ddWager, setDdWager] = useState(0);
  const [stealWinnerId, setStealWinnerId] = useState<string | null>(null);
  const [swapAId, setSwapAId] = useState<string | null>(null);
  const [editingAnswer, setEditingAnswer] = useState(false);
  const [answerDraft, setAnswerDraft] = useState(question.answer);

  const owner = players.find((p) => p.id === tile.ownerPlayerId);
  const ddPlayer = players.find((p) => p.id === ddPlayerId);

  async function finishTile() {
    await updateTile(tile.id, { status: 'used' });
    await markQuestionUsed(question.id);
    onClose();
  }

  async function handleWrong(player: Player) {
    setResolving(true);
    if (wildcard === 'daily_double') {
      await updatePlayerScore(player.id, resolveDailyDouble(player.score, ddWager, false));
      await finishTile();
      return;
    }
    if (wildcard === 'double_or_nothing') {
      await updatePlayerScore(
        player.id,
        resolveDoubleOrNothing(player.score, tile.pointValue, false)
      );
      await finishTile();
      return;
    }
    const newScore = resolveNormal(
      player.score,
      tile.pointValue,
      false,
      game.settings.penaltyOnWrong
    );
    await updatePlayerScore(player.id, newScore);
    setLockedOut((prev) => new Set(prev).add(player.id));
    setResolving(false);
  }

  async function handleCorrect(player: Player) {
    setResolving(true);
    // Victory song — fire and forget; scoring never waits on audio.
    void playAnthem(player.anthem);
    if (wildcard === 'daily_double') {
      await updatePlayerScore(player.id, resolveDailyDouble(player.score, ddWager, true));
      await finishTile();
      return;
    }
    if (wildcard === 'double_or_nothing') {
      await updatePlayerScore(
        player.id,
        resolveDoubleOrNothing(player.score, tile.pointValue, true)
      );
      await finishTile();
      return;
    }
    if (wildcard === 'steal') {
      setStealWinnerId(player.id);
      setResolving(false);
      setStep('steal_pick');
      return;
    }
    await updatePlayerScore(player.id, resolveNormal(player.score, tile.pointValue, true, true));
    await finishTile();
  }

  async function handleSteal(victim: Player, amount: number) {
    const winner = players.find((p) => p.id === stealWinnerId);
    if (!winner) return;
    setResolving(true);
    const result = resolveSteal(winner.score, victim.score, tile.pointValue, amount);
    await updatePlayerScore(winner.id, result.answererScore);
    await updatePlayerScore(victim.id, result.opponentScore);
    await finishTile();
  }

  async function handleStealSkip() {
    const winner = players.find((p) => p.id === stealWinnerId);
    if (!winner) return;
    setResolving(true);
    await updatePlayerScore(winner.id, winner.score + tile.pointValue);
    await finishTile();
  }

  async function handleSwap(playerB: Player) {
    const playerA = players.find((p) => p.id === swapAId);
    if (!playerA) return;
    setResolving(true);
    const [newA, newB] = resolveSwap(playerA.score, playerB.score);
    await updatePlayerScore(playerA.id, newA);
    await updatePlayerScore(playerB.id, newB);
    setResolving(false);
    setStep('question');
  }

  async function handleNobody() {
    setResolving(true);
    await finishTile();
  }

  const answeringPlayers =
    wildcard === 'daily_double' && ddPlayer ? [ddPlayer] : players;

  // Full-screen wildcard takeover — its own color world per type.
  if (step === 'wildcard_reveal' && wildcard) {
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
              setStep(
                wildcard === 'daily_double'
                  ? 'dd_pick_player'
                  : wildcard === 'swap'
                    ? 'swap_pick'
                    : 'question'
              )
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
          onClick={onClose}
          aria-label="Cancel — keep this tile in play"
          title="Close without resolving; the tile stays on the board"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-indigo-700 text-sm text-indigo-400 transition hover:bg-indigo-800 hover:text-white"
        >
          ✕
        </button>

        {step === 'dd_pick_player' && (
          <div className="anim-rise-in flex flex-col items-center gap-4">
            <h3 className="font-display text-2xl uppercase tracking-wide text-amber-400">
              Who picked this tile?
            </h3>
            <p className="text-sm text-indigo-400">Only they get to answer.</p>
            <ul className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              {players.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      setDdPlayerId(p.id);
                      setStep('dd_wager');
                    }}
                    className="w-full rounded-xl bg-indigo-800 px-4 py-3 font-medium ring-1 ring-white/5 transition hover:bg-indigo-700 active:scale-[0.98]"
                  >
                    {p.name} <span className="font-mono text-indigo-400">({p.score})</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === 'dd_wager' && ddPlayer && (
          <div className="anim-rise-in flex flex-col items-center gap-4">
            <h3 className="font-display text-2xl uppercase tracking-wide text-amber-400">
              {ddPlayer.name}, place your wager
            </h3>
            <WagerInput
              label="Wager"
              max={Math.max(ddPlayer.score, tile.pointValue)}
              onConfirm={(amount) => {
                setDdWager(amount);
                setStep('question');
              }}
            />
          </div>
        )}

        {step === 'swap_pick' && (
          <div className="anim-rise-in flex flex-col items-center gap-4">
            <h3 className="font-display text-2xl uppercase tracking-wide text-amber-400">
              {swapAId === null ? 'Who picked this tile?' : 'Swap scores with…'}
            </h3>
            <p className="text-sm text-indigo-400">
              {swapAId === null
                ? 'The picker may force a score swap before the question plays.'
                : 'Pick an opponent — their scores trade places.'}
            </p>
            <ul className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              {players
                .filter((p) => p.id !== swapAId)
                .map((p) => (
                  <li key={p.id}>
                    <button
                      disabled={resolving}
                      onClick={() => {
                        if (swapAId === null) setSwapAId(p.id);
                        else handleSwap(p);
                      }}
                      className="w-full rounded-xl bg-indigo-800 px-4 py-3 font-medium ring-1 ring-white/5 transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
                    >
                      {p.name} <span className="font-mono text-indigo-400">({p.score})</span>
                    </button>
                  </li>
                ))}
            </ul>
            <button
              onClick={() => setStep('question')}
              className="text-sm text-indigo-400 underline-offset-4 hover:text-indigo-300 hover:underline"
            >
              Skip the swap — play the question
            </button>
          </div>
        )}

        {step === 'question' && (
          <div className="anim-rise-in">
            {/* Kicker */}
            <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-amber-400/90">
              About {owner?.name ?? '???'} · {tile.pointValue}
              {wildcard === 'daily_double' && ` · wager ${ddWager}`}
              {wildcard === 'double_or_nothing' && ' · double or nothing'}
              {wildcard === 'steal' && ' · steal'}
            </p>

            {/* The question is the hero */}
            <p className="mx-auto mt-6 min-h-24 max-w-xl text-center text-3xl font-semibold leading-snug tracking-tight sm:text-4xl">
              {question.text}
            </p>

            <div className="mt-6 flex justify-center">
              <Timer />
            </div>

            <BuzzerPanel game={game} />

            <div className="mt-6 flex min-h-14 items-center justify-center gap-2">
              {showAnswer ? (
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
                  onClick={() => setShowAnswer(true)}
                  className="rounded-2xl border-2 border-amber-400/70 px-8 py-3 text-lg font-semibold text-amber-300 transition hover:bg-amber-400/10 active:scale-[0.98]"
                >
                  Reveal answer
                </button>
              )}
            </div>

            {/* Resolution — de-emphasized until the answer is out */}
            <div
              className={`mt-8 transition-opacity duration-300 ${
                showAnswer ? 'opacity-100' : 'opacity-50'
              }`}
            >
              <p className="text-center text-xs uppercase tracking-widest text-indigo-400">
                {wildcard === 'daily_double' && ddPlayer
                  ? `${ddPlayer.name} answers alone · ✓ +${ddWager} · ✗ −${ddWager}`
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
                      lockedOut.has(p.id) ? 'opacity-35' : ''
                    }`}
                  >
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="flex shrink-0 gap-2">
                      <button
                        onClick={() => handleWrong(p)}
                        disabled={resolving || lockedOut.has(p.id)}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-red-700/90 font-bold transition hover:bg-red-600 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100"
                        aria-label={`${p.name} wrong`}
                      >
                        ✗
                      </button>
                      <button
                        onClick={() => handleCorrect(p)}
                        disabled={resolving || lockedOut.has(p.id)}
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
                onClick={handleNobody}
                disabled={resolving}
                className="mt-4 w-full rounded-xl border border-indigo-700 px-4 py-2.5 text-sm text-indigo-400 transition hover:bg-indigo-800/60 hover:text-indigo-200"
              >
                No one got it — close question
              </button>
            </div>
          </div>
        )}

        {step === 'steal_pick' && (
          <StealPicker
            players={players.filter((p) => p.id !== stealWinnerId)}
            maxSteal={tile.pointValue}
            resolving={resolving}
            onSteal={handleSteal}
            onSkip={handleStealSkip}
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
