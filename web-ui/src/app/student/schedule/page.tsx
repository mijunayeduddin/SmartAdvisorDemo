'use client';
import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { ScheduleGrid } from '@/components/schedule/ScheduleGrid';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { nextEligible } from '@/lib/dag';
import { generateSchedule, type StrategyName } from '@/lib/scheduler';
import { useAdvising } from '@/store/advising';

const STRATEGIES: { id: StrategyName; label: string; hint: string }[] = [
  { id: 'MilestoneFirst', label: 'Milestone first', hint: 'Courses that unlock the most others get the best slots.' },
  { id: 'MinimizeGaps', label: 'Fewest gaps', hint: 'Classes sit close together so your day stays compact.' },
];

export default function SchedulePage() {
  const { courses, sections, completed, loaded } = useAdvising();
  const [strategy, setStrategy] = useState<StrategyName>('MilestoneFirst');
  const [creditLimit, setCreditLimit] = useState(9);
  const [deselected, setDeselected] = useState<string[]>([]);

  const eligible = useMemo(() => nextEligible(courses, completed), [courses, completed]);
  const chosen = eligible.map((c) => c.code).filter((c) => !deselected.includes(c));
  const result = useMemo(
    () => generateSchedule(chosen, courses, sections, strategy, creditLimit),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chosen.join(','), courses, sections, strategy, creditLimit],
  );

  if (!loaded) return <p className="text-ink-soft">Loading…</p>;

  const toggle = (code: string) => setDeselected((d) => (d.includes(code) ? d.filter((x) => x !== code) : [...d, code]));

  return (
    <>
      <PageHeader title="Schedule" subtitle="Pick the courses you want. We build a clash-free week from sections that still have seats, and it rebuilds when seats change." />

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <div className="space-y-6">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Courses</legend>
            <div className="space-y-1.5">
              {eligible.map((c) => (
                <label key={c.code} className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm">
                  <input type="checkbox" checked={!deselected.includes(c.code)} onChange={() => toggle(c.code)} className="h-4 w-4 accent-[#0B7A8C]" />
                  <span className="font-medium">{c.code}</span>
                  <span className="truncate text-ink-soft">{c.title}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Strategy</legend>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-ink/5 p-1" role="radiogroup">
              {STRATEGIES.map((s) => (
                <button
                  key={s.id}
                  role="radio"
                  aria-checked={strategy === s.id}
                  onClick={() => setStrategy(s.id)}
                  className={clsx('rounded-md px-2 py-1.5 text-sm font-medium', strategy === s.id ? 'bg-white shadow-sm' : 'text-ink-soft')}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-soft">{STRATEGIES.find((s) => s.id === strategy)!.hint}</p>
          </fieldset>

          <label className="block text-sm font-medium">
            Credit limit: {creditLimit}
            <input type="range" min={3} max={15} step={3} value={creditLimit} onChange={(e) => setCreditLimit(Number(e.target.value))} className="mt-2 w-full accent-[#0B7A8C]" />
          </label>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Credits" value={`${result.credits} / ${creditLimit}`} />
            <StatCard label="Idle time between classes" value={`${result.gapMinutes} min`} />
            <StatCard label="Overlapping slots" value={0} hint="Always zero by construction" />
          </div>
          {result.picks.length === 0 ? (
            <EmptyState title="No schedule yet" body="Select at least one course that has an open section." />
          ) : (
            <ScheduleGrid picks={result.picks} />
          )}
          {result.dropped.length > 0 && (
            <div className="rounded-lg border border-line bg-white p-4">
              <p className="mb-2 text-sm font-medium">Left out</p>
              <ul className="space-y-1.5 text-sm">
                {result.dropped.map((d) => (
                  <li key={d.code} className="flex items-center gap-2"><Badge tone="warn">{d.code}</Badge><span className="text-ink-soft">{d.reason}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
