'use client';

/* Shared building blocks for the guide modals — numbered steps, section
   headers, callouts, and the wildcard reference cards. */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h3 className="border-b border-indigo-800/60 pb-2 font-display text-xl uppercase tracking-wide text-amber-400">
        {title}
      </h3>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-amber-300 to-amber-400 font-display text-lg text-indigo-950">
        {n}
      </span>
      <div className="min-w-0">
        <h4 className="font-semibold text-white">{title}</h4>
        <div className="mt-1 text-sm leading-relaxed text-indigo-300">{children}</div>
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-indigo-800/50 px-4 py-3 text-sm leading-relaxed text-indigo-200 ring-1 ring-indigo-700/50">
      <span className="mr-1.5">💡</span>
      {children}
    </div>
  );
}

function WildcardCard({
  emoji,
  name,
  world,
  children,
}: {
  emoji: string;
  name: string;
  world: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br p-4 ring-1 ring-white/15 ${world}`}>
      <p className="flex items-center gap-2 font-display text-lg uppercase tracking-wide">
        <span>{emoji}</span> {name}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-white/90">{children}</p>
    </div>
  );
}

function LevelRow({
  level,
  label,
  points,
  example,
}: {
  level: number;
  label: string;
  points: number;
  example: string;
}) {
  const colors = [
    'bg-emerald-600',
    'bg-teal-600',
    'bg-sky-600',
    'bg-violet-600',
    'bg-rose-600',
  ];
  return (
    <div className="flex items-center gap-3 rounded-xl bg-indigo-800/40 px-3 py-2.5 ring-1 ring-indigo-700/40">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-white ${colors[level - 1]}`}
      >
        {level}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="truncate text-xs text-indigo-300">{example}</p>
      </div>
      <span className="shrink-0 font-display text-amber-400">{points}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function PlayerGuide() {
  return (
    <>
      <p className="text-indigo-200">
        Someone invited you to a Friend Trivia night. Your only job before the
        party: tell the game 10 things about yourself. It takes about 5 minutes
        on your phone.
      </p>

      <Section title="Before game night">
        <Step n={1} title="Open your host's link (or scan their QR code)">
          Your host sends a link like <code className="rounded bg-indigo-800 px-1.5 py-0.5 text-xs">…/submit/ABCD</code>,
          or shows a QR code on their screen. It opens the submission form —
          no app install, no account, no password.
        </Step>
        <Step n={2} title="Enter your name and snap a photo">
          Your name becomes your column header on the game board, and your
          photo shows on the live leaderboard. Take one with your camera or
          upload from your library — skip it and you get stylish initials.
        </Step>
        <Step n={3} title="Answer 10 questions about yourself">
          Two questions for each of the five levels below. Pick from the
          suggested dropdowns or write your own. Every question needs your
          correct answer — that&apos;s what the host checks against on game night.
        </Step>
        <Step n={4} title="Pick your victory song 🎵">
          Search any song on Deezer and preview it right in the form. A short
          snippet of your pick blasts from the host&apos;s screen{' '}
          <em>every time you answer a question correctly</em> on game night —
          choose something worth strutting to.
        </Step>
        <Step n={5} title="Hit submit — you're done">
          You&apos;ll see a confirmation with confetti. Nothing else to do until
          the party. You can&apos;t edit after submitting, but your host can fix
          typos from their screen if you ask.
        </Step>
      </Section>

      <Section title="The five levels">
        <p className="text-sm text-indigo-300">
          Levels are about <em>how many friends know the answer</em>, not how
          hard the fact is. Level 1 should be a freebie; Level 5 should make
          the room gasp.
        </p>
        <div className="flex flex-col gap-2">
          <LevelRow level={1} label="Everyone Knows" points={100} example="“What city do I live in?”" />
          <LevelRow level={2} label="Most Would Know" points={200} example="“What was my first job?”" />
          <LevelRow level={3} label="Half Might Know" points={300} example="“What's my middle name?”" />
          <LevelRow level={4} label="Few Would Know" points={400} example="“What was my childhood nickname?”" />
          <LevelRow level={5} label="Maybe One Person Knows" points={500} example="“What did I want to be at age 7?”" />
        </div>
        <Tip>
          The game randomly keeps <strong>one of your two questions</strong> per
          level — so make both good. Don&apos;t hide your best question next to a
          throwaway.
        </Tip>
        <Tip>
          Pick facts with one clear, checkable answer. &ldquo;What&apos;s my
          favorite movie?&rdquo; works if you actually have one answer you&apos;d
          accept — not if you&apos;ll argue about three.
        </Tip>
      </Section>

      <Section title="On game night">
        <Step n={1} title="Your phone is your controller">
          Open <code className="rounded bg-indigo-800 px-1.5 py-0.5 text-xs">…/play/ABCD</code>{' '}
          (linked right after you submit — bookmark it!) and claim your name.
          You get a big red buzzer, emoji reactions and a message box that
          post to the big screen, plus your live score and rank.
        </Step>
        <Step n={2} title="Buzz to answer">
          When a question opens, every phone&apos;s buzzer goes live. First
          buzz wins the floor — the big screen shows the exact order and how
          many seconds behind everyone else was, so there are no arguments.
          If a tile from <em>your</em> column opens, stay quiet and enjoy the
          chaos.
        </Step>
        <Step n={3} title="Watch for wildcards">
          A few tiles are secret wildcards — Daily Double, Double or Nothing,
          Steal, and Swap. They announce themselves with a full-screen reveal.
          See the Game Rules guide for exactly how each one works.
        </Step>
        <Step n={4} title="The Final Wager decides it">
          After the board clears, everyone secretly wagers up to their score on
          one last question. The host passes their screen around to collect
          wagers, then reveals everything at once. Comebacks happen here.
        </Step>
      </Section>
    </>
  );
}

export function HostGuide() {
  return (
    <>
      <p className="text-indigo-200">
        You run the whole night from one screen. Here&apos;s the full operating
        manual, phase by phase — from creating the room to crowning a winner.
      </p>

      <Section title="Phase 1 — Set up (days before)">
        <Step n={1} title="Create the game">
          Hit <strong>Host a new game</strong> on the home page. You get a
          4-character room code and a lobby screen. Bookmark it, or just
          remember the code — you can reopen your game anytime from the home
          page with <strong>returning host? → room code</strong>.
        </Step>
        <Step n={2} title="Invite 3–8+ friends">
          Send the submission link (Copy button) to your group chat, or have
          people scan the QR code straight off your lobby screen. Each friend
          submits 10 questions about themselves from their own phone.
        </Step>
        <Step n={3} title="Chase the stragglers">
          The lobby updates live as submissions land. Anyone not on the list
          when you build the board won&apos;t be in the game — so nag
          accordingly.
        </Step>
      </Section>

      <Section title="Phase 2 — Build the board (game night)">
        <Step n={1} title="Press “Build the Board” when everyone's in">
          The game keeps one random question of each pair (5 per player),
          arranges the board — columns are friends, rows are point values — and
          secretly plants wildcards. Bigger groups automatically get more
          wildcards, and groups of 6+ unlock all four wildcard types.
        </Step>
        <Step n={2} title="Put it on the big screen">
          The host view is designed for a TV or a laptop everyone can see.
          Scores stay pinned at the top; the board scrolls sideways if you have
          a big group.
        </Step>
        <Step n={3} title="Optional: a second screen for the leaderboard">
          The 📊 button (bottom-right) opens a live leaderboard — player
          photos, rolling scores, and rank changes animating in real time.
          Open it on a second TV or laptop and tap{' '}
          <strong>Enable sound</strong> once for the life-points counter
          sound effect on every score change.
        </Step>
      </Section>

      <Section title="Phase 3 — Run the board">
        <Step n={1} title="Let players pick tiles">
          House rule it however you like — go around the table, or let whoever
          answered last pick next. Tap the tile they call.
        </Step>
        <Step n={2} title="Read the question aloud, start the timer">
          The question fills the screen with a countdown bar under it
          (15/30/60s presets, pause and resume anytime). The person the
          question is <em>about</em> stays quiet.
        </Step>
        <Step n={3} title="Phones buzz in automatically">
          Opening a question arms every player&apos;s phone buzzer (they play
          at <code className="rounded bg-indigo-800 px-1.5 py-0.5 text-xs">…/play/CODE</code> —
          the 🎮 chip on your screen shows the address). The modal lists the
          buzz order with time gaps; the first buzzer dings. Use ↻ Reset if
          the first answer was wrong and the floor reopens.
        </Step>
        <Step n={4} title="Reveal, then judge">
          Hit <strong>Reveal answer</strong>, then tap ✓ next to whoever got it
          (+points, closes the tile) or ✗ for wrong guesses (−points, they&apos;re
          locked out, others can keep trying). Nobody got it? There&apos;s a
          button for that too.
        </Step>
        <Step n={5} title="Misclicks are safe">
          Opened the wrong tile? The ✕ in the corner closes it without using it
          up. Resolved a tile by mistake? See the admin toolkit below.
        </Step>
      </Section>

      <Section title="Phase 4 — Final Wager & results">
        <Step n={1} title="The app moves itself">
          When the last tile closes, the Final Wager round starts
          automatically. (Running long? The <em>Skip to final round</em> link
          under the board gets you there early.)
        </Step>
        <Step n={2} title="Pick the final question">
          The app draws one from the unused pool — reroll until you like it, or
          write your own on the spot.
        </Step>
        <Step n={3} title="Collect secret wagers">
          Pass your screen around; each player privately wagers up to their
          current score (0 minimum — debt can&apos;t dig deeper here).
        </Step>
        <Step n={4} title="Reveal and crown">
          Everyone answers out loud or on paper, you reveal the answer, mark
          each player right or wrong, and all wagers apply at once. Podium,
          crown, confetti.
        </Step>
      </Section>

      <Section title="The admin toolkit 🛠">
        <p className="text-sm text-indigo-300">
          The wrench button (top-right of every host screen) opens your host
          controls. Nothing in the game is unfixable:
        </p>
        <ul className="flex flex-col gap-2 text-sm text-indigo-200">
          <li className="rounded-xl bg-indigo-800/40 px-4 py-2.5 ring-1 ring-indigo-700/40"><strong className="text-white">Scores</strong> — ±100 taps or type an exact value. For when you hit ✗ instead of ✓.</li>
          <li className="rounded-xl bg-indigo-800/40 px-4 py-2.5 ring-1 ring-indigo-700/40"><strong className="text-white">Questions &amp; answers</strong> — edit anyone&apos;s question or answer text, any time. There&apos;s also an ✎ right next to the answer during play.</li>
          <li className="rounded-xl bg-indigo-800/40 px-4 py-2.5 ring-1 ring-indigo-700/40"><strong className="text-white">Reopen a played tile</strong> — puts it back on the board (undo the score change yourself under Scores).</li>
          <li className="rounded-xl bg-indigo-800/40 px-4 py-2.5 ring-1 ring-indigo-700/40"><strong className="text-white">Jump to phase</strong> — force the game to Board, Final round, or Results.</li>
          <li className="rounded-xl bg-indigo-800/40 px-4 py-2.5 ring-1 ring-indigo-700/40"><strong className="text-white">Remove a player</strong> — deletes them and their tiles, for the friend who had to leave.</li>
        </ul>
        <Tip>
          Everything lives in the cloud as you play. Refresh the page, switch
          devices, lose Wi-Fi for a minute — reopen your room code and the game
          is exactly where you left it. (Only exception: a final-round refresh
          restarts that round&apos;s wager collection; scores are safe.)
        </Tip>
      </Section>
    </>
  );
}

export function RulesGuide() {
  return (
    <>
      <p className="text-indigo-200">
        The complete rulebook — scoring, wildcards, and the final round. Hosts
        judge; the room heckles.
      </p>

      <Section title="The board">
        <p className="text-sm leading-relaxed text-indigo-300">
          One column per friend, five rows of point values. Every tile hides a
          question <em>about the friend whose column it&apos;s in</em> — written by
          them. The higher the value, the fewer people should know the answer.
          The subject of a question stays quiet while everyone else answers.
        </p>
        <div className="flex flex-col gap-2">
          <LevelRow level={1} label="Everyone Knows" points={100} example="Warm-up territory" />
          <LevelRow level={2} label="Most Would Know" points={200} example="Casual-friend knowledge" />
          <LevelRow level={3} label="Half Might Know" points={300} example="Pay-attention knowledge" />
          <LevelRow level={4} label="Few Would Know" points={400} example="Inner-circle knowledge" />
          <LevelRow level={5} label="Maybe One Person Knows" points={500} example="Deep cuts" />
        </div>
      </Section>

      <Section title="Scoring">
        <ul className="flex flex-col gap-2 text-sm text-indigo-200">
          <li className="flex items-center justify-between rounded-xl bg-indigo-800/40 px-4 py-2.5 ring-1 ring-indigo-700/40">
            <span>Correct answer</span>
            <span className="font-display text-emerald-400">+ tile value</span>
          </li>
          <li className="flex items-center justify-between rounded-xl bg-indigo-800/40 px-4 py-2.5 ring-1 ring-indigo-700/40">
            <span>Wrong answer (classic mode)</span>
            <span className="font-display text-red-400">− tile value</span>
          </li>
          <li className="flex items-center justify-between rounded-xl bg-indigo-800/40 px-4 py-2.5 ring-1 ring-indigo-700/40">
            <span>Wrong guessers</span>
            <span className="text-indigo-300">locked out; others may try</span>
          </li>
          <li className="flex items-center justify-between rounded-xl bg-indigo-800/40 px-4 py-2.5 ring-1 ring-indigo-700/40">
            <span>Negative scores</span>
            <span className="text-indigo-300">allowed — climb out!</span>
          </li>
        </ul>
      </Section>

      <Section title="Wildcards">
        <p className="text-sm text-indigo-300">
          A handful of tiles are secretly wildcards — you find out the moment
          the tile opens. Bigger games hide more of them.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <WildcardCard emoji="🎰" name="Daily Double" world="from-amber-500 via-amber-600 to-orange-700">
            Only the picker answers. First they wager anything up to their
            score (or the tile value if they&apos;re broke) — then it&apos;s all
            or nothing: correct wins the wager, wrong loses it.
          </WildcardCard>
          <WildcardCard emoji="⚡" name="Double or Nothing" world="from-violet-600 via-purple-700 to-indigo-900">
            Open to everyone, but only the first buzz counts. Correct earns
            double the tile value; wrong loses double. One attempt ends the
            tile either way.
          </WildcardCard>
          <WildcardCard emoji="🏴‍☠️" name="Steal" world="from-rose-600 via-red-700 to-rose-950">
            Answer correctly and you take the tile&apos;s points{' '}
            <em>plus</em>{' '}up to the tile value straight out of any
            opponent&apos;s score. Choose your victim wisely.
          </WildcardCard>
          <WildcardCard emoji="🔄" name="Swap" world="from-teal-500 via-cyan-700 to-slate-900">
            Before the question plays, the picker may trade entire scores with
            any opponent. Then the question plays as normal. Chaos, by design.
          </WildcardCard>
        </div>
      </Section>

      <Section title="The Final Wager">
        <Step n={1} title="One last question for everyone">
          Drawn from the questions the board never used (or written fresh by
          the host).
        </Step>
        <Step n={2} title="Secret wagers first">
          Before hearing anything, each player wagers 0 up to their current
          score. Wagers are collected privately, pass-the-phone style.
        </Step>
        <Step n={3} title="Everyone answers, then one reveal">
          Correct answers win their wager; wrong answers lose it. All changes
          land at the same time — the crown often moves on this question.
        </Step>
      </Section>

      <Section title="House rules (recommended)">
        <ul className="list-inside list-disc text-sm leading-relaxed text-indigo-300">
          <li>Take turns picking tiles; whoever answers correctly picks next.</li>
          <li>The host&apos;s judgment on &ldquo;close enough&rdquo; answers is final. The question&apos;s subject may lobby.</li>
          <li>Phones stay down during questions — the group chat knows too much.</li>
          <li>3–8 players is the sweet spot; 10 works with a scrollable board and extra wildcards.</li>
        </ul>
      </Section>
    </>
  );
}
