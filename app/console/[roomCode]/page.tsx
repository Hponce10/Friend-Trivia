'use client';

import { use, useEffect, useState } from 'react';
import {
  watchGame,
  watchPlayers,
  watchQuestions,
  watchTiles,
  watchAnswers,
  openTile,
  updateStage,
  closeStage,
  updateGame,
  writeTiles,
  updateFinalRound,
  setFinalWager,
} from '@/lib/db';
import {
  judgeCorrect,
  judgeWrong,
  judgeSteal,
  judgeStealSkip,
  performSwap,
  nobodyGotIt,
  applyEveryoneAnswers,
  completeFinalRound,
} from '@/lib/judging';
import { trackPlayersForRecorder } from '@/lib/recorder';
import { generateBoard, settingsForGroup } from '@/lib/gameLogic';
import { Answer, Game, Player, Question, Tile } from '@/lib/types';
import { WILDCARD_INFO } from '@/components/host/QuestionModal';
import BuzzerPanel from '@/components/host/BuzzerPanel';
import LightningRound from '@/components/host/LightningRound';
import Timer from '@/components/host/Timer';
import WagerInput from '@/components/host/WagerInput';
import AdminPanel from '@/components/host/AdminPanel';
import Avatar from '@/components/Avatar';
import HomeLink from '@/components/HomeLink';

// The host console: a phone-first private remote. Everything it does writes
// shared state, so the stage (TV) follows along. Its superpower: the answer
// is always visible here, never leaking to the room until you reveal.

export default function ConsolePage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode: rawCode } = use(params);
  const roomCode = rawCode.toUpperCase();
  const [game, setGame] = useState<Game | null | 'loading'>('loading');
  const [players, setPlayers] = useState<Player[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [keyInput, setKeyInput] = useState('');
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);

  useEffect(() => {
    const unsubs = [
      watchGame(roomCode, setGame),
      watchPlayers(roomCode, (ps) => {
        // Feed the replay recorder so judged events carry full score snapshots.
        trackPlayersForRecorder(roomCode, ps);
        setPlayers(ps);
      }),
      watchQuestions(roomCode, setQuestions),
      watchTiles(roomCode, setTiles),
    ];
    // setTimeout, not rAF: rAF never fires in throttled/background tabs.
    const id = setTimeout(() => {
      const urlKey = new URLSearchParams(window.location.search).get('key');
      if (urlKey) {
        localStorage.setItem(`ft-hostkey-${roomCode}`, urlKey.toUpperCase());
        setStoredKey(urlKey.toUpperCase());
      } else {
        setStoredKey(localStorage.getItem(`ft-hostkey-${roomCode}`));
      }
    });
    return () => {
      clearTimeout(id);
      unsubs.forEach((u) => u());
    };
  }, [roomCode]);

  if (game === 'loading') {
    return (
      <div className="anim-fade-in flex min-h-screen items-center justify-center text-indigo-300">
        Loading console…
      </div>
    );
  }
  if (game === null) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-white">
        <HomeLink />
        <p className="anim-rise-in rounded-xl bg-red-900/60 px-6 py-4 text-red-200 ring-1 ring-red-800">
          No game exists for room code {roomCode}.
        </p>
      </div>
    );
  }

  // Gate: older games have no hostKey and pass through.
  const authorized = !game.hostKey || storedKey === game.hostKey;
  if (!authorized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-white">
        <HomeLink />
        <p className="font-display text-2xl uppercase tracking-wide text-amber-400">
          🎛 Host console
        </p>
        <p className="mt-2 max-w-xs text-center text-sm text-indigo-300">
          Enter the host key — find it in the 🛠 panel on the main screen
          (&ldquo;Copy console link&rdquo;).
        </p>
        <form
          className="mt-5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const k = keyInput.trim().toUpperCase();
            localStorage.setItem(`ft-hostkey-${roomCode}`, k);
            setStoredKey(k);
          }}
        >
          <input
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="Host key"
            aria-label="Host key"
            className="w-40 rounded-2xl border border-indigo-700 bg-indigo-900/70 px-4 py-3 text-center font-display text-xl tracking-[0.25em] uppercase placeholder:font-sans placeholder:text-sm placeholder:tracking-normal placeholder:text-indigo-500 focus:border-amber-400 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-5 py-3 font-bold text-indigo-950 transition active:scale-[0.98]"
          >
            Open
          </button>
        </form>
        {storedKey && <p className="mt-3 text-sm text-red-300">That key didn&apos;t match.</p>}
      </div>
    );
  }

  const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex min-h-screen flex-col items-center gap-5 px-4 py-6 text-white">
      {/* Header */}
      <header className="flex w-full max-w-md items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl uppercase tracking-wide">
            🎛 Console <span className="text-amber-400">{roomCode}</span>
          </p>
          <p className="text-xs text-indigo-400">
            {game.status === 'collecting_submissions'
              ? 'Collecting submissions'
              : game.status === 'in_progress'
                ? 'Board round'
                : game.status === 'final_round'
                  ? 'Final wager'
                  : 'Game over'}
          </p>
        </div>
        <button
          onClick={() => setAdminOpen(true)}
          aria-label="Open host controls"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-indigo-700 bg-indigo-900/80 text-lg transition hover:bg-indigo-800 active:scale-95"
        >
          🛠
        </button>
      </header>

      {game.status === 'collecting_submissions' && (
        <ConsoleLobby game={game} players={players} questions={questions} />
      )}
      {game.status === 'in_progress' && (
        <ConsoleBoard
          game={game}
          players={sortedPlayers}
          questions={questions}
          tiles={tiles}
        />
      )}
      {game.status === 'final_round' && (
        <ConsoleFinal game={game} players={players} questions={questions} />
      )}
      {game.status === 'completed' && (
        <div className="anim-rise-in w-full max-w-md rounded-3xl bg-indigo-900/70 p-6 text-center ring-1 ring-indigo-700/50">
          <p className="text-4xl">👑</p>
          <p className="mt-2 text-indigo-300">
            That&apos;s a wrap — the stage is showing the podium.
          </p>
        </div>
      )}

      {adminOpen && (
        <AdminPanel
          game={game}
          players={sortedPlayers}
          questions={questions}
          tiles={tiles}
          onClose={() => setAdminOpen(false)}
        />
      )}
    </div>
  );
}

/* ---- Lobby ---- */

function ConsoleLobby({
  game,
  players,
  questions,
}: {
  game: Game;
  players: Player[];
  questions: Question[];
}) {
  const [building, setBuilding] = useState(false);

  async function build() {
    setBuilding(true);
    const settings = settingsForGroup(game.settings, players.length);
    await writeTiles(generateBoard(players, questions, settings));
    // Same roaming-wildcard budget handoff as the stage's build button.
    await updateGame(game.roomCode, {
      status: 'in_progress',
      settings,
      wildcardsRemaining: settings.wildcardCount,
    });
  }

  return (
    <div className="anim-rise-in w-full max-w-md rounded-3xl bg-indigo-900/70 p-5 ring-1 ring-indigo-700/50">
      <p className="text-center font-display text-2xl text-amber-400">
        {players.length} {players.length === 1 ? 'player' : 'players'} in
      </p>
      <ul className="mt-3 flex flex-wrap justify-center gap-2">
        {players.map((p) => (
          <li key={p.id} className="flex items-center gap-1.5 rounded-full bg-indigo-800/70 px-3 py-1 text-sm">
            <Avatar player={p} sizeClass="h-5 w-5" textClass="text-[9px]" /> {p.name}
          </li>
        ))}
      </ul>
      <button
        onClick={build}
        disabled={players.length < 2 || building}
        className="mt-4 w-full rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-6 py-3.5 font-bold text-indigo-950 transition active:scale-[0.98] disabled:opacity-40"
      >
        {building ? 'Building…' : 'Build the Board'}
      </button>
    </div>
  );
}

/* ---- Board round ---- */

function ConsoleBoard({
  game,
  players,
  questions,
  tiles,
}: {
  game: Game;
  players: Player[];
  questions: Question[];
  tiles: Tile[];
}) {
  const stage = game.stage ?? null;
  const activeTile = stage ? tiles.find((t) => t.id === stage.activeTileId) ?? null : null;
  const activeQuestion = activeTile
    ? questions.find((q) => q.id === activeTile.questionId) ?? null
    : null;

  if (stage && activeTile && activeQuestion) {
    return (
      <ConsoleQuestion
        game={game}
        tile={activeTile}
        question={activeQuestion}
        players={players}
      />
    );
  }

  // Tile picker — grouped by player, phone friendly.
  return (
    <div className="anim-rise-in flex w-full max-w-md flex-col gap-2.5">
      <p className="text-center text-xs font-semibold uppercase tracking-widest text-indigo-400">
        Tap a tile to open it on stage
      </p>
      {players.map((p) => {
        const own = tiles
          .filter((t) => t.ownerPlayerId === p.id)
          .sort((a, b) => a.pointValue - b.pointValue);
        return (
          <div
            key={p.id}
            className="flex items-center gap-3 rounded-2xl bg-indigo-900/70 px-3 py-2.5 ring-1 ring-indigo-700/50"
          >
            <Avatar player={p} sizeClass="h-9 w-9" textClass="text-sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
            <span className="flex shrink-0 gap-1.5">
              {own.map((t) =>
                t.status === 'used' ? (
                  <span
                    key={t.id}
                    className="flex h-10 w-11 items-center justify-center rounded-lg bg-indigo-950/60 font-display text-sm text-indigo-600"
                  >
                    {t.pointValue}
                  </span>
                ) : (
                  <button
                    key={t.id}
                    onClick={() =>
                      openTile(game, t, tiles.filter((x) => x.status !== 'used').length)
                    }
                    className="flex h-10 w-11 items-center justify-center rounded-lg bg-gradient-to-b from-indigo-600 to-indigo-800 font-display text-sm text-amber-400 ring-1 ring-white/10 transition hover:brightness-115 active:scale-95"
                  >
                    {t.pointValue}
                  </button>
                )
              )}
            </span>
          </div>
        );
      })}
      <button
        onClick={() => {
          if (window.confirm('End the board early and go to the Final Wager Round?')) {
            updateGame(game.roomCode, { status: 'final_round' });
          }
        }}
        className="mt-1 text-sm text-indigo-400 underline-offset-4 hover:text-indigo-200 hover:underline"
      >
        Skip to final round →
      </button>
    </div>
  );
}

function ConsoleQuestion({
  game,
  tile,
  question,
  players,
}: {
  game: Game;
  tile: Tile;
  question: Question;
  players: Player[];
}) {
  const stage = game.stage!;
  const [resolving, setResolving] = useState(false);
  const [stealVictimId, setStealVictimId] = useState<string | null>(null);
  const [eaVerdicts, setEaVerdicts] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<Answer[]>([]);
  const owner = players.find((p) => p.id === tile.ownerPlayerId);
  const ddPlayer = players.find((p) => p.id === stage.ddPlayerId);
  const wildcard = tile.wildcardType;
  const isEA = wildcard === 'everyone_answers';

  useEffect(() => {
    if (!isEA) return;
    return watchAnswers(game.roomCode, setAnswers);
  }, [game.roomCode, isEA]);

  const roundAnswers = answers.filter((a) => a.round === (game.buzzerRound ?? 0));
  const eaAnswerers = players.filter((p) => p.id !== tile.ownerPlayerId);

  async function run(fn: () => Promise<void>) {
    setResolving(true);
    try {
      await fn();
    } finally {
      setResolving(false);
    }
  }

  const judge = (player: Player, correct: boolean) =>
    run(() =>
      correct ? judgeCorrect(game, tile, question, player) : judgeWrong(game, tile, question, player)
    );

  return (
    <div className="anim-pop-in flex w-full max-w-md flex-col gap-4">
      {/* Question + private answer */}
      <div className="rounded-3xl bg-indigo-900/70 p-5 ring-1 ring-indigo-700/50">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/90">
          About {owner?.name ?? '???'} · {tile.pointValue}
          {wildcard && ` · ${WILDCARD_INFO[wildcard].title.replace('!', '')}`}
        </p>
        <p className="mt-2 text-lg font-semibold leading-snug">{question.text}</p>
        <div className="mt-3 rounded-xl bg-gradient-to-b from-amber-300 to-amber-400 px-4 py-2.5 text-indigo-950">
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-900/60">
            Answer — only you can see this
          </p>
          <p className="text-lg font-bold">{question.answer}</p>
        </div>
      </div>

      {/* Step controls */}
      {stage.step === 'wc_reveal' && wildcard && (
        <button
          onClick={() =>
            updateStage(game.roomCode, {
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
          className={`rounded-2xl bg-gradient-to-br px-6 py-4 text-lg font-bold text-white shadow-lg transition active:scale-[0.98] ${WILDCARD_INFO[wildcard].world}`}
        >
          {WILDCARD_INFO[wildcard].emoji} {WILDCARD_INFO[wildcard].title} Let&apos;s play →
        </button>
      )}

      {stage.step === 'dd_pick' && (
        <PlayerPickList
          title={`Who picked this tile? Only they answer${
            owner ? ` — ${owner.name} sits their own question out` : ''
          }.`}
          players={players.filter((p) => p.id !== tile.ownerPlayerId)}
          onPick={(p) => updateStage(game.roomCode, { ddPlayerId: p.id, step: 'dd_wager' })}
        />
      )}

      {stage.step === 'dd_wager' && ddPlayer && (
        <div className="rounded-3xl bg-indigo-900/70 p-5 ring-1 ring-indigo-700/50">
          <p className="mb-3 text-center text-sm font-semibold text-indigo-200">
            {ddPlayer.name}&apos;s wager
          </p>
          <WagerInput
            label="Wager"
            max={Math.max(ddPlayer.score, tile.pointValue)}
            onConfirm={(amount) =>
              updateStage(game.roomCode, { ddWager: amount, step: 'question' })
            }
          />
        </div>
      )}

      {stage.step === 'swap_pick' && (
        <>
          <PlayerPickList
            title={
              stage.swapPickerId === null
                ? 'Who picked this tile?'
                : 'Swap their score with…'
            }
            players={players.filter((p) => p.id !== stage.swapPickerId)}
            onPick={(p) => {
              if (stage.swapPickerId === null) {
                updateStage(game.roomCode, { swapPickerId: p.id });
              } else {
                const picker = players.find((x) => x.id === stage.swapPickerId);
                if (picker) run(() => performSwap(game, picker, p));
              }
            }}
          />
          <button
            onClick={() => updateStage(game.roomCode, { step: 'question' })}
            className="text-sm text-indigo-400 underline-offset-4 hover:underline"
          >
            Skip the swap — play the question
          </button>
        </>
      )}

      {stage.step === 'question' && (
        <>
          <button
            onClick={() => updateStage(game.roomCode, { answerRevealed: true })}
            disabled={stage.answerRevealed}
            className={`rounded-2xl px-6 py-4 text-lg font-bold transition active:scale-[0.98] ${
              stage.answerRevealed
                ? 'bg-indigo-900/70 text-indigo-400 ring-1 ring-indigo-700/50'
                : 'bg-gradient-to-b from-amber-300 to-amber-400 text-indigo-950 shadow-[0_6px_24px_rgba(246,196,83,0.35)]'
            }`}
          >
            {stage.answerRevealed ? '✓ Answer is on stage' : '📺 Reveal answer on stage'}
          </button>

          <div className="rounded-3xl bg-indigo-900/70 p-4 ring-1 ring-indigo-700/50">
            <Timer
              endsAt={stage.timerEndsAt}
              remaining={stage.timerRemaining}
              duration={stage.timerDuration}
              onChange={(u) => updateStage(game.roomCode, u)}
            />
          </div>

          {/* Judge straight from the buzz order */}
          <BuzzerPanel
            game={game}
            players={players}
            onJudge={judge}
            judgingDisabled={resolving}
          />

          {/* Fallback: full player list */}
          <details className="rounded-2xl bg-indigo-900/50 ring-1 ring-indigo-800/50">
            <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold text-indigo-300">
              Judge someone who didn&apos;t buzz
            </summary>
            <ul className="flex flex-col gap-1.5 px-3 pb-3">
              {(wildcard === 'daily_double' && ddPlayer ? [ddPlayer] : players).map((p) => (
                <li
                  key={p.id}
                  className={`flex items-center justify-between rounded-xl bg-indigo-800/70 px-3 py-1.5 ${
                    stage.lockedOut.includes(p.id) ? 'opacity-40' : ''
                  }`}
                >
                  <span className="truncate text-sm font-medium">{p.name}</span>
                  <span className="flex gap-1.5">
                    <button
                      onClick={() => judge(p, false)}
                      disabled={resolving || stage.lockedOut.includes(p.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-red-700 font-bold transition active:scale-90 disabled:opacity-40"
                      aria-label={`${p.name} wrong`}
                    >
                      ✗
                    </button>
                    <button
                      onClick={() => judge(p, true)}
                      disabled={resolving || stage.lockedOut.includes(p.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 font-bold transition active:scale-90 disabled:opacity-40"
                      aria-label={`${p.name} correct`}
                    >
                      ✓
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </details>

          <div className="flex gap-2">
            <button
              onClick={() => run(() => nobodyGotIt(game, tile, question, players))}
              disabled={resolving}
              className="flex-1 rounded-xl border border-indigo-700 px-4 py-2.5 text-sm text-indigo-300 transition hover:bg-indigo-800/60"
            >
              No one got it{owner ? ` — ${owner.name} +${tile.pointValue}` : ''}
            </button>
            <button
              onClick={() => closeStage(game.roomCode)}
              className="rounded-xl border border-indigo-700 px-4 py-2.5 text-sm text-indigo-400 transition hover:bg-indigo-800/60"
              title="Close without resolving; the tile stays in play"
            >
              ✕ Cancel
            </button>
          </div>
        </>
      )}

      {stage.step === 'ea_answering' && (
        <div className="rounded-3xl bg-indigo-900/70 p-5 ring-1 ring-emerald-500/40">
          <p className="text-center font-display text-2xl text-emerald-300">
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
            onClick={() => updateStage(game.roomCode, { step: 'ea_judging' })}
            disabled={roundAnswers.length === 0}
            className="mt-4 w-full rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-6 py-3.5 font-bold text-indigo-950 transition active:scale-[0.98] disabled:opacity-40"
          >
            Reveal the answers on stage →
          </button>
        </div>
      )}

      {stage.step === 'ea_judging' && (
        <div className="rounded-3xl bg-indigo-900/70 p-4 ring-1 ring-emerald-500/40">
          <p className="mb-2.5 text-center text-xs uppercase tracking-widest text-indigo-400">
            Judge each answer, then apply
          </p>
          <ul className="flex flex-col gap-1.5">
            {roundAnswers.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-indigo-800/70 px-3 py-1.5"
              >
                <span className="min-w-0 truncate text-sm">
                  <span className="font-medium">{a.name}</span>{' '}
                  <span className="text-indigo-300">“{a.text}”</span>
                </span>
                <span className="flex shrink-0 gap-1.5">
                  <button
                    onClick={() => setEaVerdicts((v) => ({ ...v, [a.playerId]: false }))}
                    className={`flex h-9 w-9 items-center justify-center rounded-full font-bold transition active:scale-90 ${
                      eaVerdicts[a.playerId] === false
                        ? 'bg-red-600 ring-2 ring-red-300'
                        : 'bg-red-900/80'
                    }`}
                    aria-label={`${a.name} wrong`}
                  >
                    ✗
                  </button>
                  <button
                    onClick={() => setEaVerdicts((v) => ({ ...v, [a.playerId]: true }))}
                    className={`flex h-9 w-9 items-center justify-center rounded-full font-bold transition active:scale-90 ${
                      eaVerdicts[a.playerId] === true
                        ? 'bg-emerald-500 ring-2 ring-emerald-200'
                        : 'bg-emerald-900/80'
                    }`}
                    aria-label={`${a.name} correct`}
                  >
                    ✓
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <button
            onClick={() =>
              run(() => applyEveryoneAnswers(game, tile, question, players, eaVerdicts, roundAnswers))
            }
            disabled={
              resolving || roundAnswers.some((a) => eaVerdicts[a.playerId] === undefined)
            }
            className="mt-3 w-full rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-6 py-3.5 font-bold text-indigo-950 transition active:scale-[0.98] disabled:opacity-40"
          >
            {resolving ? 'Applying…' : 'Apply verdicts'}
          </button>
        </div>
      )}

      {stage.step === 'steal_pick' && (
        <div className="rounded-3xl bg-indigo-900/70 p-5 ring-1 ring-indigo-700/50">
          <p className="mb-3 text-center text-sm font-semibold text-indigo-200">
            🏴‍☠️ Correct! Pick the victim
          </p>
          {!stealVictimId ? (
            <ul className="flex flex-col gap-1.5">
              {players
                .filter((p) => p.id !== stage.stealWinnerId)
                .map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => setStealVictimId(p.id)}
                      className="w-full rounded-xl bg-indigo-800 px-4 py-2.5 text-sm font-medium transition hover:bg-indigo-700 active:scale-[0.98]"
                    >
                      {p.name} <span className="font-mono text-indigo-400">({p.score})</span>
                    </button>
                  </li>
                ))}
            </ul>
          ) : (
            <WagerInput
              label={`Steal from ${players.find((p) => p.id === stealVictimId)?.name}`}
              max={tile.pointValue}
              onConfirm={(amount) => {
                const winner = players.find((p) => p.id === stage.stealWinnerId);
                const victim = players.find((p) => p.id === stealVictimId);
                if (winner && victim)
                  run(() => judgeSteal(game, tile, question, winner, victim, amount));
              }}
            />
          )}
          <button
            onClick={() => {
              const winner = players.find((p) => p.id === stage.stealWinnerId);
              if (winner) run(() => judgeStealSkip(game, tile, question, winner));
            }}
            disabled={resolving}
            className="mt-3 w-full text-center text-sm text-indigo-400 underline-offset-4 hover:underline"
          >
            Skip the steal — just take the tile points
          </button>
        </div>
      )}
    </div>
  );
}

function PlayerPickList({
  title,
  players,
  onPick,
}: {
  title: string;
  players: Player[];
  onPick: (p: Player) => void;
}) {
  return (
    <div className="rounded-3xl bg-indigo-900/70 p-4 ring-1 ring-indigo-700/50">
      <p className="mb-2.5 text-center text-sm font-semibold text-indigo-200">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {players.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => onPick(p)}
              className="w-full rounded-xl bg-indigo-800 px-4 py-2.5 text-sm font-medium transition hover:bg-indigo-700 active:scale-[0.98]"
            >
              {p.name} <span className="font-mono text-indigo-400">({p.score})</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---- Final round ---- */

function ConsoleFinal({
  game,
  players,
  questions,
}: {
  game: Game;
  players: Player[];
  questions: Question[];
}) {
  const fr = game.finalRound ?? null;
  const [verdicts, setVerdicts] = useState<Record<string, boolean>>({});
  const [resolving, setResolving] = useState(false);
  const locked = players.filter((p) => p.finalWager != null);

  async function applyResults() {
    if (!fr) return;
    setResolving(true);
    await completeFinalRound(game, players, verdicts);
  }

  // Lightning round: full controls with the private answer visible.
  if (game.lightning) {
    return (
      <div className="anim-rise-in w-full max-w-md">
        <LightningRound game={game} players={players} questions={questions} compact />
      </div>
    );
  }

  if (fr === null) {
    return (
      <div className="anim-rise-in w-full max-w-md rounded-3xl bg-indigo-900/70 p-6 text-center ring-1 ring-indigo-700/50">
        <p className="font-display text-xl uppercase tracking-wide text-amber-400">
          Final Wager setup
        </p>
        <p className="mt-2 text-sm text-indigo-300">
          Pick the final question on the stage screen (reroll / write your
          own — or run a ⚡ lightning round first), then wagers open on
          everyone&apos;s phones automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="anim-rise-in flex w-full max-w-md flex-col gap-4">
      {/* Private answer card, every step */}
      <div className="rounded-3xl bg-indigo-900/70 p-5 ring-1 ring-indigo-700/50">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/90">
          Final question
        </p>
        <p className="mt-1.5 font-semibold leading-snug">{fr.questionText}</p>
        <div className="mt-3 rounded-xl bg-gradient-to-b from-amber-300 to-amber-400 px-4 py-2.5 text-indigo-950">
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-900/60">
            Answer — only you can see this
          </p>
          <p className="text-lg font-bold">{fr.answerText}</p>
        </div>
      </div>

      {fr.step === 'wagers' && (
        <div className="rounded-3xl bg-indigo-900/70 p-5 ring-1 ring-indigo-700/50">
          <p className="text-center font-display text-2xl text-amber-400">
            {locked.length} / {players.length} wagers in
          </p>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {players.map((p) => (
              <li
                key={p.id}
                className={`rounded-full px-3 py-1 text-sm ${
                  p.finalWager != null
                    ? 'bg-emerald-500/20 text-emerald-200'
                    : 'bg-indigo-800/70 text-indigo-300'
                }`}
              >
                {p.name} {p.finalWager != null ? '🔒' : '…'}
              </li>
            ))}
          </ul>
          <button
            onClick={() => updateFinalRound(game.roomCode, { step: 'question' })}
            disabled={locked.length < players.length}
            className="mt-4 w-full rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-6 py-3.5 font-bold text-indigo-950 transition active:scale-[0.98] disabled:opacity-40"
          >
            Show the question on stage
          </button>
          {locked.length < players.length && (
            <button
              onClick={() =>
                Promise.all(
                  players.filter((p) => p.finalWager == null).map((p) => setFinalWager(p, 0))
                )
              }
              className="mt-2 w-full text-center text-sm text-indigo-400 underline-offset-4 hover:underline"
            >
              Set missing wagers to 0
            </button>
          )}
        </div>
      )}

      {fr.step === 'question' && (
        <button
          onClick={() => updateFinalRound(game.roomCode, { step: 'judging' })}
          className="rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-6 py-4 text-lg font-bold text-indigo-950 shadow-[0_6px_24px_rgba(246,196,83,0.35)] transition active:scale-[0.98]"
        >
          📺 Reveal the answer on stage
        </button>
      )}

      {fr.step === 'judging' && (
        <div className="rounded-3xl bg-indigo-900/70 p-4 ring-1 ring-indigo-700/50">
          <p className="mb-2.5 text-center text-xs uppercase tracking-widest text-indigo-400">
            Judge everyone, then apply
          </p>
          <ul className="flex flex-col gap-1.5">
            {[...players]
              .sort((a, b) => b.score - a.score)
              .map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-xl bg-indigo-800/70 px-3 py-1.5"
                >
                  <span className="min-w-0 truncate text-sm">
                    <span className="font-medium">{p.name}</span>{' '}
                    <span className="font-mono text-xs text-indigo-400">
                      ±{p.finalWager ?? 0}
                    </span>
                  </span>
                  <span className="flex gap-1.5">
                    <button
                      onClick={() => setVerdicts((v) => ({ ...v, [p.id]: false }))}
                      className={`flex h-9 w-9 items-center justify-center rounded-full font-bold transition active:scale-90 ${
                        verdicts[p.id] === false ? 'bg-red-600 ring-2 ring-red-300' : 'bg-red-900/80'
                      }`}
                      aria-label={`${p.name} wrong`}
                    >
                      ✗
                    </button>
                    <button
                      onClick={() => setVerdicts((v) => ({ ...v, [p.id]: true }))}
                      className={`flex h-9 w-9 items-center justify-center rounded-full font-bold transition active:scale-90 ${
                        verdicts[p.id] === true
                          ? 'bg-emerald-500 ring-2 ring-emerald-200'
                          : 'bg-emerald-900/80'
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
            className="mt-3 w-full rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-6 py-3.5 font-bold text-indigo-950 transition active:scale-[0.98] disabled:opacity-40"
          >
            {resolving ? 'Applying…' : 'Apply results → podium'}
          </button>
        </div>
      )}
    </div>
  );
}
