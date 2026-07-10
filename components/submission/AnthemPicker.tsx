'use client';

import { useEffect, useRef, useState } from 'react';
import { Anthem } from '@/lib/types';
import { searchTracks, TrackResult } from '@/lib/anthem';

interface Props {
  value: Anthem | null;
  onChange: (anthem: Anthem | null) => void;
}

export default function AnthemPicker({ value, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TrackResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditioningId, setAuditioningId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => audioRef.current?.pause();
  }, []);

  function stopAudition() {
    audioRef.current?.pause();
    audioRef.current = null;
    setAuditioningId(null);
  }

  function toggleAudition(track: TrackResult) {
    if (auditioningId === track.trackId) {
      stopAudition();
      return;
    }
    stopAudition();
    const audio = new Audio(track.preview);
    audioRef.current = audio;
    setAuditioningId(track.trackId);
    audio.play().catch(() => setAuditioningId(null));
    audio.onended = () => setAuditioningId(null);
  }

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const tracks = await searchTracks(query.trim());
      setResults(tracks);
      if (tracks.length === 0) setError('No songs found — try another search.');
    } catch {
      setError('Song search is unavailable right now — try again in a moment.');
    }
    setSearching(false);
  }

  function select(track: TrackResult) {
    stopAudition();
    onChange({
      trackId: track.trackId,
      title: track.title,
      artist: track.artist,
      cover: track.cover,
    });
    setResults([]);
    setQuery('');
  }

  if (value) {
    return (
      <div className="anim-rise-in flex items-center gap-3 rounded-xl bg-indigo-50 p-3 ring-1 ring-indigo-200 dark:bg-indigo-950/50 dark:ring-indigo-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value.cover} alt="" className="h-12 w-12 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
            🎵 {value.title}
          </p>
          <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{value.artist}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSearch();
            }
          }}
          placeholder="Search a song or artist…"
          aria-label="Search for your victory song"
          className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <button
          type="button"
          onClick={() => handleSearch()}
          disabled={searching || !query.trim()}
          className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white transition hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-40"
        >
          {searching ? '…' : 'Search'}
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {results.length > 0 && (
        <ul className="anim-rise-in mt-3 flex flex-col gap-1.5">
          {results.map((track) => (
            <li
              key={track.trackId}
              className="flex items-center gap-3 rounded-xl bg-zinc-50 p-2 ring-1 ring-zinc-200 dark:bg-zinc-800/60 dark:ring-zinc-700"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={track.cover} alt="" className="h-11 w-11 rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {track.title}
                </p>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {track.artist}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleAudition(track)}
                aria-label={auditioningId === track.trackId ? 'Stop preview' : 'Play preview'}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {auditioningId === track.trackId ? '⏸' : '▶'}
              </button>
              <button
                type="button"
                onClick={() => select(track)}
                className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-[0.98]"
              >
                Pick
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
