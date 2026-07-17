<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Friend Trivia — agent guide

Jeopardy-style party game built from questions friends submit about themselves.
Feature-complete and **live**: https://friend-trivia.hectorponce16238.workers.dev
Repo: `Hponce10/Friend-Trivia` (public). README has full feature docs; this
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
  Tables: profiles, games (→ season_id), game_results (score/rank/wager +
  night-of stats: buzzes/correct/wrong/stumps), seasons. Games attach to the
  open season (created lazily as "Season N"); closing a season from /history
  crowns the champion (most wins, points tiebreak).
- **Game mechanics added 2026-07-13** (all verified end-to-end locally):
  scores floor at 0 everywhere (`clampScore` in gameLogic); stump bonus —
  "no one got it" pays the tile owner (`nobodyGotIt` needs the players
  array); Everyone Answers wildcard (phones type simultaneously via the
  `answers` collection, owner sits out via `stage.eaOwnerId`, no wrong
  penalty, 3+ players); lightning round (`game.lightning`, runs under
  final_round status before wagers, +lowest-tile-value per correct, no
  penalties); final wager floor — everyone may wager at least
  `pointScale[0]`; wildcard density ≈ tiles/7 clamped 1–6 (explicit
  wildcardCount is no longer honored); per-player `stats` counters bump
  atomically during judging and archive into game_results.
- **Roaming wildcards + own-question guards (2026-07-17)**: wildcards are
  NOT baked into tiles at board build anymore — `game.wildcardsRemaining`
  holds the budget and `openTile` rolls `rollWildcard(remaining, hidden)`
  per opened tile (sequential lottery: exact count guaranteed, placement
  un-metagameable; pre-feature games with baked tile types still play).
  A question's subject can never answer it: `stage.subjectId` +
  `lightning.ownerId` lock the phone buzzer on your own question (mirrors
  `eaOwnerId`), and dd_pick lists exclude the tile owner on both surfaces.
  Stump-bonus self-picks remain legal strategy by design.
- **Verdict reveal** (2026-07-13): every board-round ✓/✗ writes
  `game.verdictReveal`; the stage plays 3..2..1 then the result with a meme
  GIF (`components/host/VerdictReveal.tsx`). GIFs are curated Giphy CDN
  hotlinks in `lib/memes.ts` — each id was HTTP-checked and eyeballed;
  broken links fall back to emoji. Mounted for in_progress AND final_round
  so the last tile's reveal survives the auto phase transition. Not used in
  lightning (pace) or final-round batch judging.
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

When seeding test docs directly (bypassing the app), always include an
`id` field equal to the doc id — lib/db.ts writes it on every create and
components key lists off it. Seeds without it cause phantom React
"missing key" warnings that look like app bugs (they aren't).

## Env / secrets

`.env.local`: 6× `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_KEY` (publishable). `.env.cloudflare`: deploy token.
Same set in GitHub Actions secrets (`gh secret set`). Never commit env files.

## MCP connectors in play

GitHub + Cloudflare (infra), Supabase (schema via `apply_migration`, checks
via `execute_sql`), Context7 (docs — user needs a free API key, quota
exhausted), Vercel (unused — documented escape hatch only).

## Collaboration setup (since 2026-07-13)

The repo is PUBLIC with a collaborator (benjaminmasso, write access).
`main` is protected: collaborators merge via PR with 1 approving review and
a green `check-and-deploy` run (the workflow runs checks-only on PRs and
deploys only on push to main). The repo owner is exempt (enforce_admins
off), so agent sessions can still push to main directly. Never commit
secrets — the repo is world-readable now.

## Pending / known issues

- Final-round setup happens on the stage; console mirrors after start.
- `lib/gameLogic.test.ts` covers pure logic only; UI is verified manually.
