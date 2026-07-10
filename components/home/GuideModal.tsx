'use client';

import { useEffect } from 'react';

interface Props {
  kicker: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function GuideModal({ kicker, title, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="anim-fade-in fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="anim-pop-in flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-gradient-to-b from-indigo-900 to-indigo-950 text-white shadow-2xl ring-1 ring-indigo-700/60"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-indigo-800/60 px-6 py-5 sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">
              {kicker}
            </p>
            <h2 className="mt-1 font-display text-3xl uppercase tracking-wide">{title}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close guide"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-indigo-700 text-indigo-300 transition hover:bg-indigo-800 hover:text-white active:scale-95"
          >
            ✕
          </button>
        </header>
        <div className="overflow-y-auto px-6 py-6 sm:px-8">{children}</div>
      </div>
    </div>
  );
}
