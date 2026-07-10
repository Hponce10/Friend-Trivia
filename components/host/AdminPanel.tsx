'use client';

import { useState } from 'react';
import { Game, GameStatus, Player, Question, Tile } from '@/lib/types';
import {
  updatePlayerScore,
  updateQuestion,
  updateGame,
  reopenTile,
  removePlayerCascade,
} from '@/lib/db';

interface Props {
  game: Game;
  players: Player[];
  questions: Question[];
  tiles: Tile[];
  onClose: () => void;
}

export default function AdminPanel({ game, players, questions, tiles, onClose }: Props) {
  const usedTiles = tiles.filter((t) => t.status === 'used');
  // A fully-used board would auto-advance right back to the final round —
  // reopening a tile first is what makes returning to the board meaningful.
  const boardPlayable = tiles.some((t) => t.status !== 'used');

  const phaseTargets: { label: string; status: GameStatus; enabled: boolean }[] = [
    {
      label: 'Board',
      status: 'in_progress',
      enabled: boardPlayable && game.status !== 'in_progress',
    },
    {
      label: 'Final round',
      status: 'final_round',
      enabled: game.status !== 'final_round',
    },
    {
      label: 'Results',
      status: 'completed',
      enabled: game.status !== 'completed',
    },
  ];

  return (
    <div
      className="anim-fade-in fixed inset-0 z-[60] flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-md translate-x-0 overflow-y-auto bg-indigo-950 p-6 text-white shadow-2xl ring-1 ring-indigo-800 [animation:rise-in_.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">🛠 Host controls</h2>
          <button
            onClick={onClose}
            aria-label="Close admin panel"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-indigo-700 text-indigo-300 transition hover:bg-indigo-900"
          >
            ✕
          </button>
        </div>

        {/* Scores */}
        <section className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
            Scores
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {players.map((p) => (
              <ScoreRow key={p.id} player={p} />
            ))}
          </ul>
        </section>

        {/* Questions & answers */}
        <section className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
            Questions &amp; answers
          </h3>
          <div className="mt-2 flex flex-col gap-1">
            {players.map((p) => {
              const own = questions.filter((q) => q.ownerPlayerId === p.id);
              if (own.length === 0) return null;
              return (
                <details key={p.id} className="rounded-lg bg-indigo-900/60">
                  <summary className="cursor-pointer px-3 py-2 font-medium">
                    {p.name}{' '}
                    <span className="text-sm text-indigo-400">({own.length})</span>
                  </summary>
                  <ul className="flex flex-col gap-3 px-3 pb-3">
                    {[...own]
                      .sort((a, b) => a.tier - b.tier)
                      .map((q) => (
                        <QuestionRow key={q.id} question={q} />
                      ))}
                  </ul>
                </details>
              );
            })}
          </div>
        </section>

        {/* Reopen tiles */}
        <section className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
            Reopen a played tile
          </h3>
          {usedTiles.length === 0 ? (
            <p className="mt-2 text-sm text-indigo-500">No played tiles yet.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {usedTiles.map((t) => {
                const owner = players.find((p) => p.id === t.ownerPlayerId);
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => reopenTile(t)}
                      className="rounded-lg bg-indigo-800 px-3 py-1.5 text-sm transition hover:bg-indigo-700"
                      title="Put this tile back on the board"
                    >
                      ↩ {owner?.name ?? '?'} · {t.pointValue}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 text-xs text-indigo-500">
            Reopening restores the tile — score changes it caused are not undone
            (fix those under Scores).
          </p>
        </section>

        {/* Game phase */}
        <section className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
            Jump to phase
          </h3>
          {!boardPlayable && tiles.length > 0 && (
            <p className="mt-1 text-xs text-indigo-500">
              To return to the board, reopen a tile above first.
            </p>
          )}
          <div className="mt-2 flex gap-2">
            {phaseTargets.map((t) => (
              <button
                key={t.status}
                disabled={!t.enabled}
                onClick={() => {
                  if (window.confirm(`Jump to ${t.label}?`)) {
                    updateGame(game.roomCode, { status: t.status });
                  }
                }}
                className="flex-1 rounded-lg border border-indigo-700 px-3 py-2 text-sm font-medium transition hover:bg-indigo-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        {/* Remove player */}
        <section className="mt-8 pb-8">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-red-400">
            Remove a player
          </h3>
          <p className="mt-1 text-xs text-indigo-500">
            Deletes them plus all their questions and tiles. Can&apos;t be undone.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {players.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        `Remove ${p.name} and delete their questions and tiles?`
                      )
                    ) {
                      removePlayerCascade(p, questions, tiles);
                    }
                  }}
                  className="rounded-lg border border-red-900 px-3 py-1.5 text-sm text-red-300 transition hover:bg-red-950"
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function ScoreRow({ player }: { player: Player }) {
  const [draft, setDraft] = useState(String(player.score));
  const parsed = parseInt(draft, 10);
  const dirty = !isNaN(parsed) && parsed !== player.score;

  async function bump(delta: number) {
    await updatePlayerScore(player.id, player.score + delta);
    setDraft(String(player.score + delta));
  }

  return (
    <li className="flex items-center gap-2 rounded-lg bg-indigo-900/60 px-3 py-2">
      <span className="min-w-0 flex-1 truncate font-medium">{player.name}</span>
      <button
        onClick={() => bump(-100)}
        className="min-h-11 rounded-lg bg-indigo-800 px-2.5 text-sm font-bold transition hover:bg-indigo-700 active:scale-95"
        aria-label={`${player.name} minus 100`}
      >
        −100
      </button>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        inputMode="numeric"
        className="min-h-11 w-20 rounded-lg border border-indigo-700 bg-indigo-950 px-2 text-center font-mono text-sm focus:border-amber-400 focus:outline-none"
        aria-label={`${player.name} score`}
      />
      <button
        onClick={() => bump(100)}
        className="min-h-11 rounded-lg bg-indigo-800 px-2.5 text-sm font-bold transition hover:bg-indigo-700 active:scale-95"
        aria-label={`${player.name} plus 100`}
      >
        +100
      </button>
      <button
        onClick={() => dirty && updatePlayerScore(player.id, parsed)}
        disabled={!dirty}
        className="min-h-11 rounded-lg bg-amber-400 px-2.5 text-sm font-semibold text-indigo-950 transition hover:bg-amber-300 active:scale-95 disabled:opacity-30"
      >
        Set
      </button>
    </li>
  );
}

function QuestionRow({ question }: { question: Question }) {
  const [text, setText] = useState(question.text);
  const [answer, setAnswer] = useState(question.answer);
  const dirty = text !== question.text || answer !== question.answer;

  return (
    <li className="rounded-lg bg-indigo-950/60 p-2">
      <p className="text-xs text-indigo-500">
        Level {question.tier}
        {question.usedInGame && ' · played'}
      </p>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="mt-1 w-full rounded-md border border-indigo-800 bg-indigo-950 px-2 py-1 text-sm focus:border-amber-400 focus:outline-none"
        aria-label="Question text"
      />
      <div className="mt-1 flex gap-2">
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-indigo-800 bg-indigo-950 px-2 py-1 text-sm text-amber-200 focus:border-amber-400 focus:outline-none"
          aria-label="Answer"
        />
        <button
          onClick={() =>
            dirty && updateQuestion(question.id, { text: text.trim(), answer: answer.trim() })
          }
          disabled={!dirty}
          className="rounded-md bg-amber-400 px-2 py-1 text-xs font-semibold text-indigo-950 transition hover:bg-amber-300 disabled:opacity-30"
        >
          Save
        </button>
      </div>
    </li>
  );
}
