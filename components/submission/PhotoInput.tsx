'use client';

import { useRef, useState } from 'react';

interface Props {
  value: string | null;
  onChange: (photo: string | null) => void;
}

// Center-crop to a square and downscale so the data URL stays ~20KB —
// small enough to live inline on the Firestore player doc.
const SIZE = 256;

async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.8);
}

export default function PhotoInput({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await fileToDataUrl(file));
    } catch {
      setError('Could not read that image — try a different one.');
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
        aria-label="Choose profile photo"
      />
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt="Your profile photo"
          className="h-20 w-20 rounded-full object-cover ring-2 ring-indigo-400"
        />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-zinc-300 text-2xl text-zinc-400 dark:border-zinc-600">
          📷
        </div>
      )}
      <div className="flex flex-col items-start gap-1.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 active:scale-[0.98] disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {busy ? 'Processing…' : value ? 'Change photo' : '📷 Take or upload a photo'}
        </button>
        {value ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
          >
            Remove
          </button>
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Shows on the board &amp; leaderboard. Skip it and you get initials.
          </p>
        )}
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
