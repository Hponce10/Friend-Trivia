import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Game, Player } from './types';

// The Hall of Fame archive lives on Supabase (Postgres) — one write per
// completed game, powering career stats across game nights. The live game
// stays entirely on Firestore; every function here is fire-and-forget-safe
// and can never affect gameplay.

let client: SupabaseClient | null | undefined;

function supabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_KEY;
  client = url && key ? createClient(url, key) : null;
  return client;
}

export function archiveEnabled(): boolean {
  return supabase() !== null;
}

/** Archive a finished game: upsert player profiles (identity = name,
    case-insensitive), insert the game and each player's result. Idempotent
    via the (room_code, source_created_at) unique key. Throws on failure —
    callers treat this as fire-and-forget. */
export async function archiveGame(game: Game, players: Player[]): Promise<void> {
  const sb = supabase();
  if (!sb || players.length === 0) return;

  // 1. Profiles — update the photo when a newer one exists.
  const profileRows = players.map((p) => ({
    name: p.name,
    ...(p.photo ? { photo: p.photo } : {}),
  }));
  const { data: profiles, error: pErr } = await sb
    .from('profiles')
    .upsert(profileRows, { onConflict: 'name_key' })
    .select('id, name');
  if (pErr) throw pErr;
  const idByName = new Map(
    (profiles ?? []).map((p: { id: string; name: string }) => [p.name.toLowerCase(), p.id])
  );

  // 2. The game row (idempotent on the Firestore identity).
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const winnerId = idByName.get(ranked[0].name.toLowerCase()) ?? null;
  const { data: gameRow, error: gErr } = await sb
    .from('games')
    .upsert(
      {
        room_code: game.roomCode,
        source_created_at: game.createdAt,
        player_count: players.length,
        winner_profile_id: winnerId,
      },
      { onConflict: 'room_code,source_created_at' }
    )
    .select('id')
    .single();
  if (gErr) throw gErr;

  // 3. Per-player results.
  const resultRows = ranked
    .filter((p) => idByName.has(p.name.toLowerCase()))
    .map((p, i) => ({
      game_id: gameRow.id,
      profile_id: idByName.get(p.name.toLowerCase())!,
      final_score: p.score,
      rank: i + 1,
      final_wager: p.finalWager ?? null,
      anthem_title: p.anthem ? `${p.anthem.title} — ${p.anthem.artist}` : null,
    }));
  const { error: rErr } = await sb
    .from('game_results')
    .upsert(resultRows, { onConflict: 'game_id,profile_id' });
  if (rErr) throw rErr;
}

/* ---- Hall of Fame reads ---- */

export interface CareerRow {
  profileId: string;
  name: string;
  photo: string | null;
  gamesPlayed: number;
  wins: number;
  totalPoints: number;
  bestScore: number;
  worstScore: number;
  avgScore: number;
}

export interface HallRecord {
  label: string;
  emoji: string;
  holder: string;
  value: string;
  detail: string;
}

export interface RecentGame {
  playedAt: string;
  roomCode: string;
  playerCount: number;
  podium: { name: string; score: number }[];
}

export interface HallOfFame {
  careers: CareerRow[];
  records: HallRecord[];
  recentGames: RecentGame[];
  totalGames: number;
}

interface ResultRow {
  final_score: number;
  rank: number;
  final_wager: number | null;
  profiles: { id: string; name: string; photo: string | null };
  games: { id: string; room_code: string; played_at: string; player_count: number };
}

export async function fetchHallOfFame(): Promise<HallOfFame | null> {
  const sb = supabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from('game_results')
    .select(
      'final_score, rank, final_wager, profiles(id, name, photo), games(id, room_code, played_at, player_count)'
    )
    .order('played_at', { referencedTable: 'games', ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as ResultRow[];

  // Career aggregates — friends-scale data, computed client-side.
  const byProfile = new Map<string, CareerRow & { scores: number[] }>();
  for (const r of rows) {
    const key = r.profiles.id;
    let c = byProfile.get(key);
    if (!c) {
      c = {
        profileId: key,
        name: r.profiles.name,
        photo: r.profiles.photo,
        gamesPlayed: 0,
        wins: 0,
        totalPoints: 0,
        bestScore: -Infinity,
        worstScore: Infinity,
        avgScore: 0,
        scores: [],
      };
      byProfile.set(key, c);
    }
    c.gamesPlayed += 1;
    c.totalPoints += r.final_score;
    if (r.rank === 1) c.wins += 1;
    c.bestScore = Math.max(c.bestScore, r.final_score);
    c.worstScore = Math.min(c.worstScore, r.final_score);
    c.scores.push(r.final_score);
  }
  const careers = [...byProfile.values()]
    .map(({ scores, ...c }) => ({
      ...c,
      avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }))
    .sort((a, b) => b.wins - a.wins || b.totalPoints - a.totalPoints);

  // All-time records.
  const records: HallRecord[] = [];
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const best = rows.reduce<ResultRow | null>(
    (m, r) => (m === null || r.final_score > m.final_score ? r : m),
    null
  );
  if (best) {
    records.push({
      label: 'Highest score ever',
      emoji: '🚀',
      holder: best.profiles.name,
      value: String(best.final_score),
      detail: `${best.games.room_code} · ${fmt(best.games.played_at)}`,
    });
  }
  const worst = rows.reduce<ResultRow | null>(
    (m, r) => (m === null || r.final_score < m.final_score ? r : m),
    null
  );
  if (worst && worst.final_score < 0) {
    records.push({
      label: 'Hall of shame',
      emoji: '🕳️',
      holder: worst.profiles.name,
      value: String(worst.final_score),
      detail: `${worst.games.room_code} · ${fmt(worst.games.played_at)}`,
    });
  }
  const boldest = rows.reduce<ResultRow | null>(
    (m, r) =>
      r.final_wager !== null && (m === null || r.final_wager > (m.final_wager ?? 0)) ? r : m,
    null
  );
  if (boldest && (boldest.final_wager ?? 0) > 0) {
    records.push({
      label: 'Boldest final wager',
      emoji: '🎲',
      holder: boldest.profiles.name,
      value: String(boldest.final_wager),
      detail: `${boldest.games.room_code} · ${fmt(boldest.games.played_at)}`,
    });
  }
  if (careers.length > 0) {
    const champ = careers[0];
    if (champ.wins > 0) {
      records.push({
        label: 'Most crowns',
        emoji: '👑',
        holder: champ.name,
        value: `${champ.wins} ${champ.wins === 1 ? 'win' : 'wins'}`,
        detail: `${champ.gamesPlayed} ${champ.gamesPlayed === 1 ? 'game' : 'games'} played`,
      });
    }
  }

  // Recent games with podiums.
  const byGame = new Map<string, { meta: ResultRow['games']; results: ResultRow[] }>();
  for (const r of rows) {
    const g = byGame.get(r.games.id) ?? { meta: r.games, results: [] };
    g.results.push(r);
    byGame.set(r.games.id, g);
  }
  const recentGames = [...byGame.values()]
    .sort((a, b) => +new Date(b.meta.played_at) - +new Date(a.meta.played_at))
    .slice(0, 10)
    .map((g) => ({
      playedAt: fmt(g.meta.played_at),
      roomCode: g.meta.room_code,
      playerCount: g.meta.player_count,
      podium: g.results
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 3)
        .map((r) => ({ name: r.profiles.name, score: r.final_score })),
    }));

  return { careers, records, recentGames, totalGames: byGame.size };
}
