'use client';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { useToast } from '@/store/toast';

const bar = { info: 'bg-brand', success: 'bg-open', warning: 'bg-low', error: 'bg-full' };

export function ToastHost() {
  const { toasts, dismiss } = useToast();
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-20 right-4 z-[60] flex w-[min(92vw,22rem)] flex-col gap-2 md:bottom-4">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto flex overflow-hidden rounded-lg border border-line bg-white shadow-pop">
          <div className={clsx('w-1.5 shrink-0', bar[t.tone])} />
          <div className="flex-1 px-3 py-2.5">
            <p className="text-sm font-semibold">{t.title}</p>
            {t.body && <p className="mt-0.5 text-sm text-ink-soft">{t.body}</p>}
          </div>
          <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="px-2 text-ink-faint hover:text-ink">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
