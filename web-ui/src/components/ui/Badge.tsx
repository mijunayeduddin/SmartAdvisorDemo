import clsx from 'clsx';
import type { RequestStatus } from '@/lib/types';

const tone = {
  neutral: 'bg-ink/5 text-ink-soft',
  good: 'bg-open/10 text-open',
  warn: 'bg-low/15 text-[#8A5A08]',
  bad: 'bg-full/10 text-full',
  brand: 'bg-brand-soft text-brand-dark',
};

export function Badge({ tone: t = 'neutral', children }: { tone?: keyof typeof tone; children: React.ReactNode }) {
  return <span className={clsx('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium', tone[t])}>{children}</span>;
}

const statusMap: Record<RequestStatus, { tone: keyof typeof tone; label: string }> = {
  approved: { tone: 'good', label: 'Approved' },
  pending: { tone: 'warn', label: 'Waiting for faculty' },
  rejected: { tone: 'bad', label: 'Rejected' },
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const s = statusMap[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
