import { Anthem } from './types';

// Victory-song playback for the host screen. Resolves a fresh preview URL
// per play (Deezer's signed URLs expire in minutes), then plays a short
// snippet with a fade-out so the game keeps moving.

export interface TrackResult extends Anthem {
  preview: string;
}

export async function searchTracks(query: string): Promise<TrackResult[]> {
  const res = await fetch(`/api/deezer?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('search failed');
  const data = await res.json();
  return data.tracks as TrackResult[];
}

async function resolvePreview(trackId: number): Promise<string> {
  const res = await fetch(`/api/deezer?track=${trackId}`);
  if (!res.ok) throw new Error('track lookup failed');
  const data = await res.json();
  return data.preview as string;
}

const SNIPPET_MS = 9000;
const FADE_MS = 2000;

let current: { audio: HTMLAudioElement; timers: number[] } | null = null;

export function stopAnthem(): void {
  if (!current) return;
  current.timers.forEach((t) => window.clearTimeout(t));
  current.audio.pause();
  current.audio.src = '';
  current = null;
}

/** Play ~9s of the player's anthem with a fade-out. Safe to fire and forget —
    resolves silently on any failure so scoring is never blocked by audio. */
export async function playAnthem(anthem: Anthem | null | undefined): Promise<void> {
  if (!anthem) return;
  try {
    const url = await resolvePreview(anthem.trackId);
    stopAnthem();

    const audio = new Audio(url);
    audio.volume = 1;
    const timers: number[] = [];
    current = { audio, timers };

    await audio.play();

    // Fade out over the last FADE_MS, then stop.
    timers.push(
      window.setTimeout(() => {
        const steps = 20;
        for (let i = 1; i <= steps; i++) {
          timers.push(
            window.setTimeout(() => {
              audio.volume = Math.max(0, 1 - i / steps);
            }, (FADE_MS / steps) * i)
          );
        }
      }, SNIPPET_MS - FADE_MS)
    );
    timers.push(
      window.setTimeout(() => {
        if (current?.audio === audio) stopAnthem();
      }, SNIPPET_MS)
    );
  } catch {
    // Autoplay blocked, track gone, or network hiccup — the game goes on.
  }
}
