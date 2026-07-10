'use client';

import { useEffect, useState } from 'react';
import { fetchHallOfFame, archiveEnabled, HallOfFame } from '@/lib/archive';
import Avatar from '@/components/Avatar';
import HomeLink from '@/components/HomeLink';

// The Hall of Fame: career stats and all-time records across every game
// night, read from the Supabase archive.

export default function HistoryPage() {
  const [hall, setHall] = useState<HallOfFame | null | 'loading' | 'error'>('loading');

  useEffect(() => {
    // deferred a tick — the linter flags synchronous setState in effects
    const id = setTimeout(() => {
      if (!archiveEnabled()) {
        setHall(null);
        return;
      }
      fetchHallOfFame()
        .then((h) => setHall(h))
        .catch(() => setHall('error'));
    }, 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-10 text-white">
      <HomeLink />
      <p className="anim-fade-in text-xs font-semibold uppercase tracking-[0.3em] text-indigo-400">
        Every game night, remembered
      </p>
      <h1 className="anim-rise-in mt-1 text-center font-display text-5xl uppercase tracking-wide sm:text-6xl">
        Hall of <span className="text-amber-400">Fame</span>
      </h1>

      {hall === 'loading' && (
        <p className="anim-fade-in mt-16 text-indigo-300">Dusting off the trophies…</p>
      )}

      {(hall === null || hall === 'error') && (
        <div className="anim-rise-in mt-14 max-w-md rounded-3xl bg-indigo-900/70 p-8 text-center ring-1 ring-indigo-700/50">
          <p className="text-4xl">🏆</p>
          <p className="mt-3 text-indigo-200">
            {hall === 'error'
              ? 'The archive is napping — try again in a minute.'
              : 'The archive isn’t configured on this deployment.'}
          </p>
        </div>
      )}

      {hall !== 'loading' && hall !== null && hall !== 'error' && hall.totalGames === 0 && (
        <div className="anim-rise-in mt-14 max-w-md rounded-3xl bg-indigo-900/70 p-8 text-center ring-1 ring-indigo-700/50">
          <p className="text-4xl">📜</p>
          <p className="mt-3 text-indigo-200">
            No games in the books yet. Finish a game night and history begins.
          </p>
        </div>
      )}

      {hall !== 'loading' && hall !== null && hall !== 'error' && hall.totalGames > 0 && (
        <div className="mt-10 flex w-full max-w-3xl flex-col gap-10 pb-16">
          {/* All-time records */}
          {hall.records.length > 0 && (
            <section className="anim-rise-in">
              <h2 className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.25em] text-indigo-400">
                All-time records · {hall.totalGames}{' '}
                {hall.totalGames === 1 ? 'game' : 'games'} played
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {hall.records.map((r) => (
                  <div
                    key={r.label}
                    className="flex items-center gap-4 rounded-2xl bg-indigo-900/70 p-4 ring-1 ring-indigo-700/50"
                  >
                    <span className="text-3xl">{r.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
                        {r.label}
                      </p>
                      <p className="truncate font-semibold">
                        {r.holder}{' '}
                        <span className="font-display text-xl text-amber-400">{r.value}</span>
                      </p>
                      <p className="truncate text-xs text-indigo-500">{r.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Career leaderboard */}
          <section className="anim-rise-in" style={{ animationDelay: '120ms' }}>
            <h2 className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.25em] text-indigo-400">
              Career standings
            </h2>
            <div className="overflow-x-auto rounded-2xl ring-1 ring-indigo-700/50">
              <table className="w-full min-w-[560px] bg-indigo-900/60 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-widest text-indigo-400">
                    <th className="px-4 py-3">Player</th>
                    <th className="px-3 py-3 text-center">Games</th>
                    <th className="px-3 py-3 text-center">Wins</th>
                    <th className="px-3 py-3 text-right">Total pts</th>
                    <th className="px-3 py-3 text-right">Best</th>
                    <th className="px-4 py-3 text-right">Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {hall.careers.map((c, i) => (
                    <tr
                      key={c.profileId}
                      className={`border-t border-indigo-800/60 ${
                        i === 0 ? 'bg-amber-400/10' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-3">
                          <span className="w-5 text-center font-display text-indigo-400">
                            {i + 1}
                          </span>
                          <Avatar
                            player={{ name: c.name, photo: c.photo }}
                            sizeClass="h-9 w-9"
                            textClass="text-sm"
                          />
                          <span className="font-semibold">
                            {c.name} {i === 0 && c.wins > 0 && '👑'}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{c.gamesPlayed}</td>
                      <td className="px-3 py-2.5 text-center font-bold tabular-nums text-amber-300">
                        {c.wins}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {c.totalPoints}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-300">
                        {c.bestScore}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-indigo-300">
                        {c.avgScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Recent game nights */}
          <section className="anim-rise-in" style={{ animationDelay: '240ms' }}>
            <h2 className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.25em] text-indigo-400">
              Recent game nights
            </h2>
            <ul className="flex flex-col gap-2">
              {hall.recentGames.map((g) => (
                <li
                  key={`${g.roomCode}-${g.playedAt}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-indigo-900/70 px-4 py-3 ring-1 ring-indigo-700/50"
                >
                  <span className="font-display text-lg tracking-widest text-amber-400">
                    {g.roomCode}
                  </span>
                  <span className="text-xs text-indigo-400">
                    {g.playedAt} · {g.playerCount} players
                  </span>
                  <span className="min-w-0 flex-1 truncate text-right text-sm text-indigo-200">
                    {g.podium.map((p, i) => (
                      <span key={p.name} className="ml-3 whitespace-nowrap">
                        {['🥇', '🥈', '🥉'][i]} {p.name}{' '}
                        <span className="font-mono text-indigo-400">{p.score}</span>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
