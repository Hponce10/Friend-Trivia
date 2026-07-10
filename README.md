# Friend Trivia Board

A Jeopardy-style party game built from questions about your friends. Everyone
submits 10 personal-trivia questions from their phone before game night; one
shared host screen runs the board, wildcards, final wager round, and results.

## How a game works

1. **Host** creates a game on the landing page and gets a 4-character room code.
2. **Players** (3–8) open `/submit/<ROOMCODE>` on their phones and each submit
   2 questions about themselves at every level, scaled by how many friends
   would know the answer (Level 1: everyone knows → Level 5: maybe one person
   knows, 10 total) — plus a **victory song** picked from Deezer, which plays
   a ~9-second snippet on the host screen whenever they answer correctly.
   (Deezer's public API is proxied through `/api/deezer` — no API key needed;
   preview URLs are signed and short-lived, so the app stores only the track
   id and re-resolves the URL at play time.)
3. The host watches submissions arrive live, then hits **Build the Board** —
   the game keeps 1 random question of each pair (5 per player) and secretly
   flags 3 tiles as wildcards.
4. Tiles resolve on the host screen: correct answers award points, wrong
   answers deduct them (classic mode). Wildcards interrupt with their own flow:
   - 🎰 **Daily Double** — only the picker answers, after wagering up to their score
   - ⚡ **Double or Nothing** — first to buzz; correct doubles the tile value, wrong loses double
   - 🏴‍☠️ **Steal** — a correct answer also takes up to the tile value from an opponent
   - 🔄 **Swap** — the picker may force a full score swap before the question plays
5. When the board clears, the app moves into the **Final Wager Round**
   (pass-device secret wagers, one bonus question), then the results screen —
   where the winner's victory song plays over the podium.

### Phone controllers — buzzing, reactions, notes

`/play/<ROOMCODE>` turns each player's phone into a game controller. Players
claim their name once (remembered per device) and get:

- **A big red buzzer** — armed automatically whenever the host opens a
  question. Buzz order is decided by **Firestore server timestamps**, so
  ordering is fair regardless of whose Wi-Fi is faster to render. The host's
  question modal shows the live order with time gaps ("Ben +0.31s"), dings on
  first buzz, and has a ↻ Reset for reopened questions. Phones show your
  position instantly ("1st! The floor is yours 🎤"), with haptic feedback on
  supported devices.
- **Emoji reactions** (🔥 😂 👏 💀 😱 🎉) that float up the main screen and
  leaderboard with the sender's name, gently rate-limited per device.
- **A note box** (80 chars) — messages appear as name-tagged toasts at the top
  of the big screen for a few seconds. Trash talk, answers disputes, dinner
  orders.
- **Live score, rank, and mini leaderboard** on the phone.

### Live leaderboard (second screen)

`/leaderboard/<ROOMCODE>` (or the 📊 button on any host screen) is a
standalone spectator view built for a second TV: player photos, live
rank-change animations, and scores that roll to their new value with a
synthesized life-points counter sound (an homage to a certain dueling
anime — generated with the Web Audio API, no audio assets). Tap
**Enable sound** once per screen; browsers require a user gesture before
audio. Players add their photo during submission (camera or upload,
center-cropped to a ~20 KB JPEG stored inline on their player doc — no
Firebase Storage needed); players without a photo get initials.

### Host controls

The 🛠 button (top-right of every host screen) opens the admin panel:

- **Scores** — quick ±100 or set any exact value, live on the scoreboard
- **Questions & answers** — edit any player's question or answer, any time
- **Reopen a played tile** — puts a mistakenly-resolved tile back on the board
  (score side-effects are yours to fix under Scores)
- **Jump to phase** — force the game to Board / Final round / Results
- **Remove a player** — deletes them with their questions and tiles

In the question modal: a **countdown timer** (15/30/60s presets, go/pause/reset),
an **✎ edit** next to the revealed answer for on-the-spot corrections, and a
**✕ cancel** that closes a misclicked tile without resolving it.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Firebase Firestore via the client SDK — no custom backend
- Realtime host views via `onSnapshot` listeners
- No auth: the room code is the shared secret (private game for friends)

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in your Firebase web-app config
npm run dev
```

Create a Firebase project at console.firebase.google.com, register a web app,
enable Firestore, and paste the config values into `.env.local`.

Deploy the security rules in `firestore.rules` from the Firebase console
(Firestore → Rules) or with `firebase deploy --only firestore:rules`.

## Tests

Board generation and all scoring functions are pure functions in
[lib/gameLogic.ts](lib/gameLogic.ts):

```bash
npm test
```

## Deployment (Cloudflare Workers)

Live at **https://friend-trivia.hectorponce16238.workers.dev** via the
[OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare) — the
current Cloudflare-recommended path for Next.js App Router apps (needed
because `/api/deezer` requires a server runtime).

- `wrangler.jsonc` — Worker config (`nodejs_compat`, assets binding)
- `open-next.config.ts` — OpenNext adapter config
- `next.config.ts` — aliases `@firebase/firestore` to its **browser build**
  for the server bundle; the Node build pulls in protobufjs, whose dynamic
  codegen is forbidden on the Workers runtime. Don't remove this alias.

Manual deploy from a machine with `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` set (see `.env.cloudflare`, not committed):

```bash
npm run deploy        # opennextjs-cloudflare build && deploy
npm run preview       # test locally in the real workerd runtime
```

### CI/CD

Every push to `main` runs `.github/workflows/deploy.yml`: type check →
lint → unit tests → build → deploy to Cloudflare. Required GitHub Actions
secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and the six
`NEXT_PUBLIC_FIREBASE_*` values (build-time inlining). The Cloudflare
token is scoped to Workers Scripts only and was created via the API.

## Known limitations (v1)

- Final-round question choice and collected wagers live in host-screen state:
  refreshing mid-final-round restarts that round (scores are safe in Firestore).
- "Who picked the tile" isn't tracked, so Daily Double / Swap ask the host to
  tap the picker's name.
