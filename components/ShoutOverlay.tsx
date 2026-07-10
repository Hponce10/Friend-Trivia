'use client';

import { useEffect, useRef, useState } from 'react';
import { watchShouts } from '@/lib/db';
import { Shout } from '@/lib/types';

// Renders phone-sent reactions over the main screen: emojis float up from
// the bottom, text notes stack as name-tagged toasts at the top. Purely
// decorative — pointer-events pass straight through to the game beneath.

interface FloatingEmoji {
  key: string;
  emoji: string;
  name: string;
  left: number; // vw-ish percent
  tilt: number;
}

interface NoteToast {
  key: string;
  name: string;
  text: string;
}

const EMOJI_LIFE_MS = 3200;
const TOAST_LIFE_MS = 6500;
const MAX_TOASTS = 4;

export default function ShoutOverlay({ roomCode }: { roomCode: string }) {
  const [emojis, setEmojis] = useState<FloatingEmoji[]>([]);
  const [toasts, setToasts] = useState<NoteToast[]>([]);
  const counter = useRef(0);

  useEffect(() => {
    const unsub = watchShouts(roomCode, (added: Shout[]) => {
      for (const s of added) {
        const key = `${s.id}-${counter.current++}`;
        if (s.emoji) {
          const item: FloatingEmoji = {
            key,
            emoji: s.emoji,
            name: s.name,
            left: 8 + Math.random() * 84,
            tilt: Math.random() * 24 - 12,
          };
          setEmojis((prev) => [...prev.slice(-30), item]);
          setTimeout(
            () => setEmojis((prev) => prev.filter((e) => e.key !== key)),
            EMOJI_LIFE_MS
          );
        } else if (s.text) {
          const item: NoteToast = { key, name: s.name, text: s.text };
          setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), item]);
          setTimeout(
            () => setToasts((prev) => prev.filter((t) => t.key !== key)),
            TOAST_LIFE_MS
          );
        }
      }
    });
    return unsub;
  }, [roomCode]);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-live="polite">
      {/* Floating emoji reactions */}
      {emojis.map((e) => (
        <div
          key={e.key}
          className="anim-emoji-float absolute bottom-6 flex flex-col items-center"
          style={{ left: `${e.left}%`, ['--emoji-tilt' as string]: `${e.tilt}deg` }}
        >
          <span className="text-5xl drop-shadow-lg">{e.emoji}</span>
          <span className="mt-1 rounded-full bg-black/50 px-2 py-0.5 text-xs font-semibold text-white/90">
            {e.name}
          </span>
        </div>
      ))}

      {/* Note toasts */}
      <div className="absolute left-1/2 top-5 flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.key}
            className="anim-toast-in rounded-2xl bg-indigo-950/90 px-4 py-3 shadow-xl ring-1 ring-amber-400/40 backdrop-blur"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
              💬 {t.name}
            </p>
            <p className="mt-0.5 break-words text-base font-medium text-white">{t.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
