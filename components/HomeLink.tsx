import Link from 'next/link';

interface Props {
  /** 'dark' sits on the navy stage; 'light' sits on the zinc submission page */
  variant?: 'dark' | 'light';
  /** 'absolute' scrolls away with the page — use where a sticky bar owns the top edge */
  position?: 'fixed' | 'absolute';
}

export default function HomeLink({ variant = 'dark', position = 'fixed' }: Props) {
  return (
    <Link
      href="/"
      title="Back to home"
      className={`${position} left-4 top-4 z-50 flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold shadow-lg backdrop-blur transition active:scale-95 ${
        variant === 'dark'
          ? 'border-indigo-700 bg-indigo-900/80 text-indigo-300 hover:bg-indigo-800 hover:text-white'
          : 'border-zinc-300 bg-white/80 text-zinc-600 hover:bg-white hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white'
      }`}
    >
      <span aria-hidden="true">⌂</span> Home
    </Link>
  );
}
