'use client';

import { use, useEffect, useState } from 'react';
import HomeLink from '@/components/HomeLink';
import { watchGame, watchPlayers, watchQuestions, watchTiles } from '@/lib/db';
import { Game, Player, Question, Tile } from '@/lib/types';
import ProgressTracker from '@/components/host/ProgressTracker';
import Board from '@/components/host/Board';
import Scoreboard from '@/components/host/Scoreboard';
import QuestionModal from '@/components/host/QuestionModal';
import FinalRound from '@/components/host/FinalRound';
import ResultsScreen from '@/components/host/ResultsScreen';
import AdminPanel from '@/components/host/AdminPanel';
import ShoutOverlay from '@/components/ShoutOverlay';
import { updateGame } from '@/lib/db';
import { ensureSoundEnabled } from '@/lib/lpSound';

export default function HostPage({
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
  const [activeTileId, setActiveTileId] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);

  useEffect(() => {
    const unsubs = [
      watchGame(roomCode, setGame),
      watchPlayers(roomCode, setPlayers),
      watchQuestions(roomCode, setQuestions),
      watchTiles(roomCode, setTiles),
    ];
    return () => unsubs.forEach((u) => u());
  }, [roomCode]);

  // Stable alphabetical order for board columns and player pick-lists —
  // Firestore query order is arbitrary and shifts as scores update.
  const sortedPlayers = [...players].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const allTilesUsed =
    tiles.length > 0 && tiles.every((t) => t.status === 'used');

  useEffect(() => {
    if (
      game !== 'loading' &&
      game !== null &&
      game.status === 'in_progress' &&
      allTilesUsed
    ) {
      updateGame(roomCode, { status: 'final_round' });
    }
  }, [game, allTilesUsed, roomCode]);

  if (game === 'loading') {
    return (
      <div className="anim-fade-in flex min-h-screen items-center justify-center text-indigo-300">
        Loading game…
      </div>
    );
  }

  if (game === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-white">
        <HomeLink />
        <p className="anim-rise-in rounded-xl bg-red-900/60 px-6 py-4 text-red-200 ring-1 ring-red-800">
          No game exists for room code {roomCode}.
        </p>
      </div>
    );
  }

  let content: React.ReactNode;
  switch (game.status) {
    case 'collecting_submissions':
    case 'ready_to_build':
      content = (
        <ProgressTracker game={game} players={sortedPlayers} questions={questions} />
      );
      break;
    case 'in_progress': {
      const activeTile = tiles.find((t) => t.id === activeTileId) ?? null;
      const activeQuestion = activeTile
        ? questions.find((q) => q.id === activeTile.questionId) ?? null
        : null;
      content = (
        <div className="min-h-screen px-4 py-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            <Scoreboard players={sortedPlayers} />
            <Board
              players={sortedPlayers}
              tiles={tiles}
              pointScale={game.settings.pointScale}
              onTileClick={(tile) => {
                // A host gesture: also unlocks WebAudio for the buzz ding.
                ensureSoundEnabled();
                setActiveTileId(tile.id);
              }}
            />
          </div>
          <div className="mx-auto mt-2 flex max-w-5xl justify-end">
            <button
              onClick={() => {
                if (window.confirm('End the board early and go straight to the Final Wager Round?')) {
                  updateGame(roomCode, { status: 'final_round' });
                }
              }}
              className="rounded-lg px-2 py-2 text-sm text-indigo-400 underline-offset-4 transition hover:text-indigo-200 hover:underline"
            >
              Skip to final round →
            </button>
          </div>
          {activeTile && activeQuestion && (
            <QuestionModal
              key={activeTile.id}
              game={game}
              tile={activeTile}
              question={activeQuestion}
              players={sortedPlayers}
              onClose={() => setActiveTileId(null)}
            />
          )}
        </div>
      );
      break;
    }
    case 'final_round':
      content = <FinalRound game={game} players={sortedPlayers} questions={questions} />;
      break;
    case 'completed':
      content = <ResultsScreen players={sortedPlayers} />;
      break;
  }

  return (
    <>
      {/* keyed by status so each phase enters with a rise animation */}
      <div key={game.status} className="anim-fade-in">
        {content}
      </div>
      <HomeLink />
      <button
        onClick={() => setAdminOpen(true)}
        aria-label="Open host controls"
        title="Host controls"
        className="fixed right-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-indigo-700 bg-indigo-900/80 text-lg shadow-lg backdrop-blur transition hover:bg-indigo-800 active:scale-95"
      >
        🛠
      </button>
      <a
        href={`/leaderboard/${roomCode}`}
        target="_blank"
        rel="noopener"
        title="Open the live leaderboard — great on a second screen"
        className="fixed bottom-4 right-4 z-50 flex h-11 items-center gap-2 rounded-full border border-indigo-700 bg-indigo-900/80 px-4 text-sm font-semibold text-indigo-300 shadow-lg backdrop-blur transition hover:bg-indigo-800 hover:text-white active:scale-95"
      >
        📊 Leaderboard
      </a>
      <span
        title="Players open this on their phones to buzz in and react"
        className="fixed bottom-4 left-4 z-50 flex h-11 items-center gap-2 rounded-full border border-indigo-700 bg-indigo-900/80 px-4 text-sm font-semibold text-indigo-300 shadow-lg backdrop-blur"
      >
        🎮 Phones: <span className="font-mono text-amber-300">/play/{roomCode}</span>
      </span>
      {(game.status === 'in_progress' || game.status === 'final_round') && (
        <ShoutOverlay roomCode={roomCode} />
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
    </>
  );
}
