import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const styles: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark disabled:bg-ink-faint/40 disabled:text-white/80',
  secondary: 'bg-white text-ink border border-line hover:border-ink-faint disabled:text-ink-faint',
  danger: 'bg-white text-full border border-full/40 hover:bg-full/5',
  ghost: 'text-ink-soft hover:bg-ink/5',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  loading?: boolean;
}

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed',
        size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4 text-sm',
        styles[variant],
        className,
      )}
    >
      {loading ? 'Working…' : children}
    </button>
  );
}
