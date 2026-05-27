export type ButtonTone = 'primary' | 'secondary' | 'cyan' | 'danger';

export const buttonStyles = (tone: ButtonTone) => {
  const base = 'inline-flex items-center justify-center gap-2 rounded px-3 py-2 text-sm font-semibold transition';

  const toneClass = {
    primary: 'bg-zinc-950 text-white hover:bg-zinc-800',
    secondary: 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50',
    cyan: 'border border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100',
    danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
  }[tone];

  return `${base} ${toneClass}`;
};
