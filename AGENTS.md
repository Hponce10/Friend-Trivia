<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Friend Trivia — agent guide

Jeopardy-style party game built from questions friends submit about themselves.
Feature-complete and **live**: https://friend-trivia.hectorponce16238.workers.dev
Repo: `Hponce10/Friend-Trivia` (private). README has full feature docs; this
file is for working on the code.

## Architecture (decided — see README "Architecture decisions")

- **Live game: Firestore** (client SDK, no auth — room code is the secret).
  Everything real-time via `onSnapshot`: lobby, board, buzzers, shouts,
  leaderboard, and `game.stage` (the live question, shared so the TV stage
  `/host` and the phone console `/console` control the same moment).
  All db access in `lib/db.ts`; scoring actions shared between surfaces in
  `lib/judging.ts`; pure logic + tests in `lib/gameLogic.ts`.
- **Hall of Fame archive: Supabase** (project `qtrminzcfwmrbblagvma`), written
  fire-and-forget once per completed game from ResultsScreen, guarded by
  `game.archived`. Client in `lib/archive.ts`, page at `/history`. NEVER move
  live-game data to Supabase (free tier auto-pauses;
  `.github/workflows/keep-alive.yml` pings it twice weekly).
- **Hosting: Cloudflare Workers** via OpenNext adapter. Deploys happen ONLY
  through CI (`.github/workflows/deploy.yml`: tsc → lint → vitest → deploy on
  push to main). Manual fallback: `npm run deploy` with `.env.cloudflare`.
- Routes: `/` home+guides, `/submit/[room]` player form, `/host/[room]` stage,
  `/console/[room]?key=` host remote (gated by `game.hostKey`),
  `/play/[room]` player phone (buzzer/reactions/final wagers),
  `/leaderboard/[room]` second screen, `/history` Hall of Fame,
  `/api/deezer` proxy (the only server code).

## Commands

- Dev server: preview launch config `trivia-dev` (port 3000)
- `npm test` (vitest, 20 tests) · `npm run lint` · `npx tsc --noEmit`
- Workers-runtime check: `npx opennextjs-cloudflare build` then
  `npx wrangler dev --port 8787` (tests the REAL workerd runtime)

## Landmines (each cost real debugging — do not relearn)

1. **`next.config.ts` aliases `@firebase/firestore` to its browser build.**
   The Node build pulls protobufjs → `EvalError: Code generation from strings`
   on Workers. Never remove. Firebase init is browser-only (`lib/firebase.ts`).
2. **Lint rule `react-hooks/set-state-in-effect`**: defer with
   `setTimeout(fn, 0)` — NOT `requestAnimationFrame` (rAF never fires in
   background/throttled tabs; this broke the console key gate once).
3. **Read FULL lint output.** A `| tail -1` once masked an error locally that
   then failed CI.
4. **Deezer preview URLs expire in ~15 min** — store only `trackId`, resolve
   fresh via `/api/deezer?track=` at play time (`lib/anthem.ts` does this).
5. **Timers** compute from wall-clock deadlines (`Date.now()` vs stored
   `endsAt`), never tick counting — browser throttling breaks tick counters.
6. New routes on workers.dev take ~30s of edge propagation after deploy —
   retry before diagnosing a 404.
7. Victory anthems play from the STAGE only, via the `game.lastWin` marker —
   don't add `playAnthem` calls to judging paths.

## Testing conventions

- Seed/verify Firestore with throwaway node scripts (pattern: write
  `*.tmp.mjs` in repo root with the firebase web config inline, run, delete).
- **Always clean up after testing**: delete test docs from ALL Firestore
  collections (games, players, questions, tiles, buzzes, shouts) AND truncate
  Supabase (profiles, games, game_results) if archives were written — the
  Hall of Fame must contain only real game nights.
- Verify UI in the browser preview at desktop AND mobile viewports; drive
  React inputs with native setters + dispatched input/change events.

## Firestore security rules (deployed 2026-07-10)

`firestore.rules` is LIVE (deployed via `firebase deploy --only firestore:rules`,
config in `firebase.json`). Key consequence: clients can no longer delete
games/players/questions/tiles — test cleanup must go through the Firebase CLI:
`firebase firestore:delete <path> --project friend-trivia-3568b --force`
(requires `firebase login` or a CI token).

## Env / secrets

`.env.local`: 6× `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_KEY` (publishable). `.env.cloudflare`: deploy token.
Same set in GitHub Actions secrets (`gh secret set`). Never commit env files.

## MCP connectors in play

GitHub + Cloudflare (infra), Supabase (schema via `apply_migration`, checks
via `execute_sql`), Context7 (docs — user needs a free API key, quota
exhausted), Vercel (unused — documented escape hatch only).

## Pending / known issues

- Final-round setup happens on the stage; console mirrors after start.
- `lib/gameLogic.test.ts` covers pure logic only; UI is verified manually.
