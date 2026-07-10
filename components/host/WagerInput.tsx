'use client';

import { useState } from 'react';

interface Props {
  label: string;
  max: number;
  onConfirm: (amount: number) => void;
}

export default function WagerInput({ label, max, onConfirm }: Props) {
  const [value, setValue] = useState('');
  const amount = parseInt(value, 10);
  const valid = !isNaN(amount) && amount >= 0 && amount <= max;

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-indigo-300">
        {label} <span className="text-indigo-400">(0–{max})</span>
      </p>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0"
          className="w-36 rounded-2xl border border-indigo-600 bg-indigo-950 px-4 py-3 text-center font-display text-3xl text-amber-300 placeholder:text-indigo-700 focus:border-amber-400 focus:outline-none"
        />
        <button
          onClick={() => valid && onConfirm(amount)}
          disabled={!valid}
          className="rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 px-5 py-3 font-bold text-indigo-950 shadow-[0_4px_18px_rgba(246,196,83,0.3)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
        >
          Lock it in
        </button>
      </div>
      {!valid && value !== '' && (
        <p className="text-sm text-red-300">Wager must be between 0 and {max}.</p>
      )}
    </div>
  );
}
