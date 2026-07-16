'use client';

import { Fragment, use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchGameRecord } from '@/lib/archive';
import {
  eventDwellMs,
  frameAt,
  GameEvent,
  GameRecord,
  RecordTile,
  ReplayFrame,
} from '@/lib/replay';
import { WILDCARD_INFO } from '@/components/host/QuestionModal';

// Re-watch a finished game turn by turn. The whole record (board, players,
// event log) arrives in ONE Supabase read; from there everything is local —
// scrubbing just re-folds the event list, so there's nothing to get out of
// sync. Deliberately reuses the live game's palette, fonts and animation
// classes: a replay should feel like re-watching the night, not a log view.

const SPEEDS = [1, 2, 4];

export default function ReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [record, setRecord] = useState<GameRecord | null | 'loading' | 'missing'>('loading');

  useEffect(() => {
    // deferred a tick — the linter flags synchronous setState in effects
    const t = setTimeout(() => {
      fetchGameRecord(id)
        .then((r) => setRecord(r ?? 'missing'))
        .catch(() => setRecord('missing'));
    }, 0);
    return () => clearTimeout(t);
  }, [id]);

  if (record === 'loading') {
    return (
      <div className="anim-fade-in flex min-h-screen items-center justify-center text-indigo-300">
        Rewinding the tape…
      </div>
    );
  }
  if (record === 'missing' || record === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-white">
        <p className="anim-rise-in rounded-xl bg-red-900/60 px-6 py-4 text-red-200 ring-1 ring-red-800">
          That replay doesn&apos;t exist (unfinished games are only kept for a while).
        </p>
        <Link href="/history" className="text-indigo-300 underline-offset-4 hover:underline">
          ← Back to the Hall of Fame
        </Link>
      </div>
    );
  }
  return record.coarse ? <CoarseView record={record} /> : <ReplayViewer record={record} />;
}

/* ---- Shared bits ---- */

function playerName(record: GameRecord, id?: string, fallback?: string): string {
  return (
    record.players.find((p) => p.id === id)?.name ??
    fallback ??
    'Someone'
  );
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtDuration(ms: number | null): string | null {
  if (ms === null) return null;
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function ReplayHeader({ record }: { record: GameRecord }) {
  const duration = fmtDuration(record.durationMs);
  return (
    <header className="flex flex-wrap items-baseline justify-center gap-x-4 gap-y-1 text-center">
      <Link
        href="/history"
        className="text-sm text-indigo-400 underline-offset-4 hover:text-indigo-200 hover:underline"
      >
        ← History
      </Link>
      <h1 className="font-display text-3xl uppercase tracking-widest text-amber-400">
        {record.roomCode}
      </h1>
      <span className="text-sm text-indigo-400">
        {fmtDate(record.endedAt)}
        {duration && ` · ${duration}`}
        {` · ${record.players.length} players`}
      </span>
      {record.status === 'abandoned' && (
        <span className="rounded-full bg-red-900/60 px-3 py-0.5 text-xs font-semibold text-red-200 ring-1 ring-red-800">
          🌙 ended early
        </span>
      )}
    </header>
  );
}

/* ---- Coarse record (no usable event log) ---- */

function CoarseView({ record }: { record: GameRecord }) {
  return (
    <div className="flex min-h-screen flex-col items-center gap-6 px-4 py-8 text-white">
      <ReplayHeader record={record} />
      <p className="max-w-md rounded-2xl bg-indigo-900/70 px-5 py-3 text-center text-sm text-indigo-300 ring-1 ring-indigo-700/50">
        No play-by-play was captured for this game — only the final standings
        survive.
      </p>
      <ul className="flex w-full max-w-md flex-col gap-2">
        {record.players.map((p) => (
          <li
            key={p.id}
            className={`flex items-center justify-between rounded-xl px-5 py-2.5 ring-1 ${
              p.placement === 1
                ? 'bg-amber-400/10 ring-amber-400/40'
                : 'bg-indigo-900/70 ring-indigo-700/50'
            }`}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="w-7 shrink-0 text-right font-display text-indigo-400">
                {p.placement}
              </span>
              <span className="truncate font-medium">
                {p.name} {p.placement === 1 && '👑'}
              </span>
            </span>
            <span
              className={`font-mono font-bold tabular-nums ${
                p.finalScore < 0 ? 'text-red-400' : 'text-indigo-200'
              }`}
            >
              {p.finalScore}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---- Full replay ---- */

function ReplayViewer({ record }: { record: GameRecord }) {
  const [index, setIndex] = useState(0); // frames shown: events[0..index-1]
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const total = record.events.length;
  const frame = useMemo(() => frameAt(record, index), [record, index]);

  // Auto-play: linger on the event just shown, then advance. Each index
  // change reschedules the next tick; pausing simply stops the chain.
  useEffect(() => {
    if (!playing) return;
    if (index >= total) {
      const t = setTimeout(() => setPlaying(false), 0);
      return () => clearTimeout(t);
    }
    const shown = index > 0 ? record.events[index - 1] : null;
    const dwell = shown ? eventDwellMs(shown) / speed : 500;
    const t = setTimeout(() => setIndex((i) => Math.min(i + 1, total)), dwell);
    return () => clearTimeout(t);
  }, [playing, index, speed, total, record]);

  // Manual navigation always pauses — surprise jumps mid-autoplay are worse
  // than having to hit play again.
  function jump(to: number) {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(to, total)));
  }

  return (
    <div className="flex min-h-screen flex-col items-center gap-5 px-4 pb-36 pt-6 text-white">
      <ReplayHeader record={record} />
      <ReplayScoreboard record={record} frame={frame} />
      <div className={`w-full max-w-5xl transition-opacity duration-500 ${
        frame.phase === 'final' || frame.phase === 'done' ? 'opacity-30' : 'opacity-100'
      }`}>
        <ReplayBoard record={record} frame={frame} />
      </div>
      <EventCaption record={record} frame={frame} atStart={index === 0} />

      {/* Controls — thumb-reachable on phones, always visible */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-indigo-800/60 bg-indigo-950/90 px-4 pb-4 pt-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-2">
          <input
            type="range"
            min={0}
            max={total}
            value={index}
            onChange={(e) => jump(Number(e.target.value))}
            aria-label="Replay timeline"
            className="w-full accent-amber-400"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="w-16 font-mono text-xs tabular-nums text-indigo-400">
              {index}/{total}
            </span>
            <span className="flex items-center gap-1.5">
              <ControlButton label="Restart" onClick={() => jump(0)}>⏮</ControlButton>
              <ControlButton label="Step back" onClick={() => jump(index - 1)}>◀</ControlButton>
              <button
                onClick={() => setPlaying((p) => !p && index < total ? true : false)}
                aria-label={playing ? 'Pause' : 'Play'}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-amber-300 to-amber-400 text-xl text-indigo-950 shadow-[0_4px_18px_rgba(246,196,83,0.35)] transition hover:brightness-105 active:scale-95"
              >
                {playing ? '⏸' : '▶'}
              </button>
              <ControlButton label="Step forward" onClick={() => jump(index + 1)}>▶</ControlButton>
              <ControlButton label="Jump to end" onClick={() => jump(total)}>⏭</ControlButton>
            </span>
            <button
              onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
              className="w-16 rounded-lg border border-indigo-700 px-2 py-1.5 text-sm font-semibold text-indigo-300 transition hover:bg-indigo-800/60"
              aria-label="Playback speed"
            >
              {speed}x
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-indigo-700 text-indigo-300 transition hover:bg-indigo-800/60 hover:text-white active:scale-95"
    >
      {children}
    </button>
  );
}

/* ---- Scoreboard at this moment ---- */

function ReplayScoreboard({ record, frame }: { record: GameRecord; frame: ReplayFrame }) {
  const e = frame.lastEvent;
  // Players the last event touched, for the delta flash.
  const deltas = new Map<string, number>();
  if (e) {
    const p = e.payload;
    if (p.playerId && typeof p.delta === 'number' && p.delta !== 0)
      deltas.set(p.playerId, p.delta);
    for (const v of p.ea ?? []) if (v.delta !== 0) deltas.set(v.playerId, v.delta);
    for (const r of p.results ?? []) if (r.delta !== 0) deltas.set(r.playerId, r.delta);
    if (p.kind === 'steal' && p.winnerId && typeof p.amount === 'number') {
      deltas.set(p.winnerId, 0); // highlighted, amount shown in the caption
      if (p.victimId) deltas.set(p.victimId, 0);
    }
  }
  const sorted = [...record.players].sort(
    (a, b) => (frame.scores[b.id] ?? 0) - (frame.scores[a.id] ?? 0)
  );
  const top = frame.scores[sorted[0]?.id] ?? 0;

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {sorted.map((p) => {
        const score = frame.scores[p.id] ?? 0;
        const leader = score === top && score > 0;
        const delta = deltas.get(p.id);
        return (
          <div
            key={`${p.id}-${frame.lastEvent?.seq ?? 0}`}
            className={`relative flex items-baseline gap-2 rounded-full px-4 py-1.5 ring-1 transition-all duration-300 ${
              leader
                ? 'bg-gradient-to-b from-amber-300 to-amber-400 text-indigo-950 ring-amber-200/60 shadow-[0_2px_14px_rgba(246,196,83,0.35)]'
                : 'bg-indigo-900/80 text-white ring-indigo-700/50'
            } ${delta !== undefined ? 'ring-2 ring-white/70' : ''}`}
          >
            <span className="text-sm font-semibold">{p.name}</span>
            <span
              className={`font-mono text-base font-bold tabular-nums ${
                score < 0 ? 'text-red-400' : ''
              }`}
            >
              {score}
            </span>
            {delta !== undefined && delta !== 0 && (
              <span
                className={`anim-rise-in absolute -top-3 right-2 rounded-full px-1.5 text-xs font-bold ${
                  delta > 0 ? 'bg-emerald-500 text-white' : 'bg-red-600 text-white'
                }`}
              >
                {delta > 0 ? `+${delta}` : delta}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---- The board as it looked at this moment ---- */

function ReplayBoard({ record, frame }: { record: GameRecord; frame: ReplayFrame }) {
  const { columns, pointScale, tiles } = record.board;
  if (columns.length === 0 || tiles.length === 0) return null;
  const many = columns.length > 6;

  return (
    <div className="overflow-x-auto pb-2">
      <div
        className="grid gap-1.5 sm:gap-2"
        style={{
          gridTemplateColumns: `5.5rem repeat(${columns.length}, minmax(${many ? 72 : 96}px, 1fr))`,
        }}
      >
        <div />
        {columns.map((c) => (
          <div
            key={c.playerId}
            title={c.name}
            className={`flex min-h-10 items-center justify-center truncate rounded-lg bg-gradient-to-b from-indigo-800 to-indigo-900 px-2 py-1.5 text-center font-bold uppercase tracking-wider text-indigo-200 ring-1 ring-white/5 ${
              many ? 'text-[10px]' : 'text-xs sm:text-sm'
            }`}
          >
            <span className="truncate">{c.name}</span>
          </div>
        ))}
        {pointScale.map((value, row) => (
          <Fragment key={value}>
            <div className="flex items-center justify-end pr-2">
              <span className="font-display text-sm tracking-wide text-amber-400/90">
                LVL {row + 1}
              </span>
            </div>
            {columns.map((c) => {
              const tile = tiles.find(
                (t) => t.ownerPlayerId === c.playerId && t.pointValue === value
              );
              if (!tile) return <div key={`${c.playerId}-${value}`} className="aspect-[4/3]" />;
              const state = frame.tileStates[tile.id] ?? 'hidden';
              if (state === 'used') {
                return (
                  <div
                    key={tile.id}
                    className="flex aspect-[4/3] items-center justify-center rounded-lg bg-indigo-900/30 font-display text-lg text-indigo-500/30 ring-1 ring-indigo-800/40"
                  >
                    {tile.pointValue}
                  </div>
                );
              }
              return (
                <div
                  key={tile.id}
                  className={`flex aspect-[4/3] items-center justify-center rounded-lg font-display text-xl text-amber-400 ring-1 sm:text-2xl ${
                    state === 'active'
                      ? 'animate-pulse bg-gradient-to-b from-amber-500/40 to-indigo-800 ring-2 ring-amber-400 shadow-[0_0_24px_rgba(246,196,83,0.45)]'
                      : 'bg-gradient-to-b from-indigo-600 to-indigo-800 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_8px_rgba(0,0,0,0.35)]'
                  }`}
                  style={{ textShadow: '0 2px 6px rgba(0,0,0,0.4)' }}
                >
                  {tile.pointValue}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/* ---- Narration of the current event ---- */

function EventCaption({
  record,
  frame,
  atStart,
}: {
  record: GameRecord;
  frame: ReplayFrame;
  atStart: boolean;
}) {
  const e = frame.lastEvent;
  const tileById = useMemo(
    () => new Map(record.board.tiles.map((t) => [t.id, t])),
    [record]
  );

  return (
    // Keyed by seq so every step re-enters with the pop animation.
    <div
      key={e?.seq ?? -1}
      className="anim-pop-in flex w-full max-w-2xl flex-col items-center gap-3 rounded-3xl bg-gradient-to-b from-indigo-900 to-indigo-950 px-6 py-6 text-center ring-1 ring-indigo-700/60"
    >
      {atStart || e === null ? (
        <>
          <p className="text-4xl">🍿</p>
          <p className="text-indigo-200">
            The board is set — {record.players.length} players,{' '}
            {record.board.tiles.length} tiles. Hit play to re-watch the night.
          </p>
        </>
      ) : (
        <CaptionBody record={record} e={e} tile={e.payload.tileId ? tileById.get(e.payload.tileId) : undefined} />
      )}
    </div>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400/90">
      {children}
    </p>
  );
}

function Verdict({ correct }: { correct: boolean }) {
  return (
    <span
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full font-bold text-white ${
        correct ? 'bg-emerald-500' : 'bg-red-600'
      }`}
    >
      {correct ? '✓' : '✗'}
    </span>
  );
}

function CaptionBody({
  record,
  e,
  tile,
}: {
  record: GameRecord;
  e: GameEvent;
  tile?: RecordTile;
}) {
  const p = e.payload;
  const name = playerName(record, p.playerId, p.name);

  switch (e.type) {
    case 'game_start':
      return (
        <>
          <p className="text-4xl">🎬</p>
          <p className="font-display text-2xl uppercase tracking-wide text-amber-400">
            Game on!
          </p>
        </>
      );

    case 'clue_selected': {
      const owner = playerName(record, p.ownerPlayerId);
      const wc = p.wildcardType ? WILDCARD_INFO[p.wildcardType] : null;
      return (
        <>
          <Kicker>
            About {owner} · {p.pointValue}
          </Kicker>
          {wc && (
            <p
              className={`w-full rounded-2xl bg-gradient-to-br px-4 py-3 font-display text-2xl uppercase tracking-wide text-white ${wc.world}`}
            >
              {wc.emoji} {wc.title}
            </p>
          )}
          {tile?.questionText && (
            <p className="text-xl font-semibold leading-snug sm:text-2xl">
              {tile.questionText}
            </p>
          )}
        </>
      );
    }

    case 'wildcard_used': {
      if (p.kind === 'daily_double_pick') {
        return (
          <p className="text-lg text-indigo-200">
            🎰 <span className="font-semibold">{name}</span> picked it — they answer
            alone.
          </p>
        );
      }
      if (p.kind === 'swap') {
        return (
          <p className="text-lg text-indigo-200">
            🔄 <span className="font-semibold">{playerName(record, p.aId)}</span> and{' '}
            <span className="font-semibold">{playerName(record, p.bId)}</span> swapped
            scores!
          </p>
        );
      }
      if (p.kind === 'steal') {
        return (
          <p className="text-lg text-indigo-200">
            🏴‍☠️ <span className="font-semibold">{playerName(record, p.winnerId, p.name)}</span>{' '}
            took the tile and stole{' '}
            <span className="font-bold text-amber-300">{p.amount}</span> from{' '}
            <span className="font-semibold">{playerName(record, p.victimId)}</span>!
          </p>
        );
      }
      if (p.kind === 'steal_skip') {
        return (
          <p className="text-lg text-indigo-200">
            🏴‍☠️ <span className="font-semibold">{playerName(record, p.winnerId, p.name)}</span>{' '}
            took the points and spared everyone.
          </p>
        );
      }
      return <p className="text-indigo-300">A wildcard played out.</p>;
    }

    case 'wager_set':
      return (
        <p className="text-lg text-indigo-200">
          🎰 Wager locked:{' '}
          <span className="font-display text-2xl text-amber-300">{p.amount}</span>
        </p>
      );

    case 'answer_judged': {
      if (p.ea) {
        return (
          <>
            <Kicker>📱 Everyone answered</Kicker>
            <ul className="flex w-full flex-col gap-1.5">
              {p.ea.map((v) => (
                <li
                  key={v.playerId}
                  className="flex items-center justify-between gap-3 rounded-xl bg-indigo-800/70 px-3 py-1.5 text-left"
                >
                  <span className="min-w-0 truncate text-sm">
                    <span className="font-semibold">{v.name}</span>
                    {v.text && <span className="text-indigo-300"> “{v.text}”</span>}
                  </span>
                  <Verdict correct={v.correct} />
                </li>
              ))}
            </ul>
            {tile?.answerText && (
              <p className="text-sm text-indigo-400">
                Answer: <span className="font-semibold text-amber-300">{tile.answerText}</span>
              </p>
            )}
          </>
        );
      }
      if (p.stump) {
        return (
          <>
            <p className="text-4xl">🧱</p>
            <p className="text-lg text-indigo-200">
              Nobody got it
              {p.playerId && (
                <>
                  {' '}
                  — <span className="font-semibold">{name}</span> banks{' '}
                  <span className="font-bold text-amber-300">+{p.delta}</span> for the
                  stump
                </>
              )}
              !
            </p>
            {tile?.answerText && (
              <p className="text-sm text-indigo-400">
                It was: <span className="font-semibold text-amber-300">{tile.answerText}</span>
              </p>
            )}
          </>
        );
      }
      return (
        <>
          {p.lightning && <Kicker>⚡ Lightning</Kicker>}
          {p.pendingSteal && <Kicker>🏴‍☠️ Steal incoming</Kicker>}
          <p className="flex items-center gap-3 text-xl">
            <Verdict correct={p.correct === true} />
            <span>
              <span className="font-semibold">{name}</span>{' '}
              {p.correct ? 'got it' : 'missed'}
              {typeof p.delta === 'number' && p.delta !== 0 && (
                <span
                  className={`ml-2 font-mono font-bold ${
                    p.delta > 0 ? 'text-emerald-300' : 'text-red-400'
                  }`}
                >
                  {p.delta > 0 ? `+${p.delta}` : p.delta}
                </span>
              )}
            </span>
          </p>
          {p.resolved && p.correct && tile?.answerText && (
            <p className="text-sm text-indigo-400">
              Answer: <span className="font-semibold text-amber-300">{tile.answerText}</span>
            </p>
          )}
        </>
      );
    }

    case 'round_change':
      if (p.phase === 'lightning') {
        return (
          <>
            <p className="font-display text-3xl uppercase tracking-[0.2em] text-amber-400">
              ⚡ Lightning Round
            </p>
            <p className="text-sm text-indigo-300">
              {p.questionCount} rapid-fire questions · +{p.perCorrect} each
            </p>
          </>
        );
      }
      return (
        <>
          <p className="font-display text-3xl uppercase tracking-[0.2em] text-amber-400">
            Final Wager
          </p>
          {p.questionText ? (
            <p className="text-xl font-semibold leading-snug">{p.questionText}</p>
          ) : (
            <p className="text-sm text-indigo-300">The board is done — one question left.</p>
          )}
        </>
      );

    case 'final_wager_placed':
      // The amount was secret in the room at this moment — the replay keeps
      // the suspense too; wagers go public at the final judgment.
      return (
        <p className="text-lg text-indigo-200">
          🔒 <span className="font-semibold">{name}</span> locked in a secret wager.
        </p>
      );

    case 'final_answer_judged':
      return (
        <>
          <Kicker>Wagers revealed</Kicker>
          <ul className="flex w-full flex-col gap-1.5">
            {(p.results ?? []).map((r) => (
              <li
                key={r.playerId}
                className="flex items-center justify-between gap-3 rounded-xl bg-indigo-800/70 px-3 py-1.5"
              >
                <span className="min-w-0 truncate text-left text-sm">
                  <span className="font-semibold">{r.name}</span>{' '}
                  <span className="font-mono text-indigo-400">wagered {r.wager}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className={`font-mono text-sm font-bold ${
                      r.delta > 0
                        ? 'text-emerald-300'
                        : r.delta < 0
                          ? 'text-red-400'
                          : 'text-indigo-400'
                    }`}
                  >
                    {r.delta > 0 ? `+${r.delta}` : r.delta}
                  </span>
                  <Verdict correct={r.correct} />
                </span>
              </li>
            ))}
          </ul>
          {record.finalWager?.answerText && (
            <p className="text-sm text-indigo-400">
              Answer:{' '}
              <span className="font-semibold text-amber-300">
                {record.finalWager.answerText}
              </span>
            </p>
          )}
        </>
      );

    case 'score_change':
      return (
        <p className="text-indigo-300">
          🛠 The host adjusted <span className="font-semibold">{name}</span> to{' '}
          <span className="font-mono font-bold">{p.newScore}</span>.
        </p>
      );

    case 'game_end': {
      const winners = record.players.filter((pl) => record.winnerIds.includes(pl.id));
      if (p.abandoned) {
        return (
          <p className="text-lg text-indigo-200">
            🌙 The night ended early — standings frozen.
          </p>
        );
      }
      return (
        <>
          <p className="text-5xl">👑</p>
          <p className="font-display text-3xl uppercase tracking-wide text-amber-400">
            {winners.map((w) => w.name).join(' & ')} {winners.length > 1 ? 'tie it!' : 'wins!'}
          </p>
          <p className="text-sm text-indigo-300">
            {record.players
              .map((pl) => `${pl.name} ${pl.finalScore}`)
              .join(' · ')}
          </p>
        </>
      );
    }

    default:
      // Unknown / future event types render as a quiet beat, never a crash.
      return <p className="text-indigo-400">…</p>;
  }
}
