'use client';

import { useState } from 'react';
import { TIER_LABELS, TIER_HINTS } from '@/lib/types';
import { QUESTION_BANK, shuffled } from '@/lib/questionBank';

export interface TierQuestions {
  q1: { text: string; answer: string };
  q2: { text: string; answer: string };
}

interface Props {
  tier: 1 | 2 | 3 | 4 | 5;
  value: TierQuestions;
  onChange: (value: TierQuestions) => void;
}

const TIER_BANNERS: Record<number, string> = {
  1: 'from-emerald-500 to-emerald-600',
  2: 'from-teal-500 to-teal-600',
  3: 'from-sky-500 to-sky-600',
  4: 'from-violet-500 to-violet-600',
  5: 'from-rose-500 to-rose-600',
};

const CUSTOM = '__custom__';

export default function QuestionTierInput({ tier, value, onChange }: Props) {
  // Shuffled once per mount: each player sees the options in a different
  // order, spreading picks across the bank in bigger groups.
  const [bank] = useState(() => shuffled(QUESTION_BANK[tier]));
  // Track which slots are in "write my own" mode so an empty custom
  // textarea doesn't fall back to looking like an unpicked dropdown.
  const [customMode, setCustomMode] = useState<{ q1: boolean; q2: boolean }>({
    q1: false,
    q2: false,
  });

  const complete =
    value.q1.text.trim() !== '' &&
    value.q1.answer.trim() !== '' &&
    value.q2.text.trim() !== '' &&
    value.q2.answer.trim() !== '';

  function update(slot: 'q1' | 'q2', field: 'text' | 'answer', v: string) {
    onChange({ ...value, [slot]: { ...value[slot], [field]: v } });
  }

  function handleSelect(slot: 'q1' | 'q2', selected: string) {
    if (selected === CUSTOM) {
      setCustomMode((m) => ({ ...m, [slot]: true }));
      update(slot, 'text', '');
    } else {
      setCustomMode((m) => ({ ...m, [slot]: false }));
      update(slot, 'text', selected);
    }
  }

  return (
    <section
      className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition-shadow dark:bg-zinc-900 ${
        complete
          ? 'ring-2 ring-emerald-400 dark:ring-emerald-600'
          : 'ring-zinc-200 dark:ring-zinc-700'
      }`}
    >
      {/* Banner header */}
      <header
        className={`flex items-center gap-3 bg-gradient-to-r px-4 py-3 text-white ${TIER_BANNERS[tier]}`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20 font-display text-lg">
          {tier}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-tight">{TIER_LABELS[tier]}</h3>
          <p className="truncate text-xs text-white/80">{TIER_HINTS[tier]}</p>
        </div>
        <span
          className={`text-xl transition-opacity ${complete ? 'opacity-100' : 'opacity-0'}`}
          aria-label={complete ? 'Level complete' : undefined}
        >
          ✅
        </span>
      </header>

      <div className="p-4">
        {(['q1', 'q2'] as const).map((slot, i) => {
          const otherSlot = slot === 'q1' ? 'q2' : 'q1';
          const isCustom = customMode[slot];
          const selectValue = isCustom
            ? CUSTOM
            : bank.includes(value[slot].text)
              ? value[slot].text
              : '';
          return (
            <div
              key={slot}
              className={
                i === 1 ? 'mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800' : ''
              }
            >
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Question {i + 1}
                <select
                  value={selectValue}
                  onChange={(e) => handleSelect(slot, e.target.value)}
                  required={!isCustom}
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="" disabled>
                    Choose a question…
                  </option>
                  {bank.map((q) => (
                    <option key={q} value={q} disabled={q === value[otherSlot].text}>
                      {q}
                    </option>
                  ))}
                  <option value={CUSTOM}>✍️ Write my own question…</option>
                </select>
              </label>
              {isCustom && (
                <textarea
                  value={value[slot].text}
                  onChange={(e) => update(slot, 'text', e.target.value)}
                  rows={2}
                  required
                  autoFocus
                  placeholder="Your question, in your own words"
                  className="anim-rise-in mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              )}
              <label className="mt-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Answer
                <input
                  value={value[slot].answer}
                  onChange={(e) => update(slot, 'answer', e.target.value)}
                  required
                  placeholder="The correct answer"
                  className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}
