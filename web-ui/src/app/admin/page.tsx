'use client';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { mockApi } from '@/lib/mock/server';
import type { HealthSnapshot } from '@/lib/types';
import { useAdvising } from '@/store/advising';

export default function AdminPage() {
  const { shortages, sections, loaded } = useAdvising();
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [rush, setRush] = useState(false);

  // Dashboard refreshes every 5 s (US-A1 AC1).
  useEffect(() => {
    const tick = () => mockApi.getHealth().then(setHealth);
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => () => mockApi.setRush(false), []);

  const slow = (health?.p95Ms ?? 0) > 200;

  return (
    <>
      <PageHeader
        title="Health & alerts"
        subtitle="Live system numbers and courses that have run out of seats."
        action={
          <Button
            variant={rush ? 'danger' : 'secondary'}
            onClick={() => {
              mockApi.setRush(!rush);
              setRush(!rush);
            }}
          >
            {rush ? 'Stop simulated rush' : 'Simulate registration rush'}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Requests per second" value={health?.rps ?? '-'} />
        <StatCard label="p95 latency" value={health ? `${health.p95Ms} ms` : '-'} hint={slow ? 'Above the 200 ms target' : 'Target: under 200 ms'} />
        <StatCard label="Error rate" value={health ? `${health.errorRatePct}%` : '-'} />
        <StatCard label="DB pool in use" value={health ? `${health.dbPoolPct}%` : '-'} />
      </div>

      <section className="mt-6 flex flex-wrap gap-4 rounded-xl border border-line bg-white p-4">
        {(['api', 'redis', 'postgres'] as const).map((k) => (
          <div key={k} className="flex items-center gap-2 text-sm">
            <span className={clsx('h-2.5 w-2.5 rounded-full', health?.services[k] === 'up' ? 'bg-open' : 'bg-full')} />
            <span className="font-medium capitalize">{k === 'api' ? 'API' : k === 'postgres' ? 'PostgreSQL' : 'Redis'}</span>
            <span className="text-ink-soft">{health?.services[k] ?? 'checking'}</span>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Seat shortages</h2>
        {!loaded || Object.keys(shortages).length === 0 ? (
          <EmptyState title="No shortages" body="An alert appears here when every section of a course reaches zero seats. It clears when seats are added." />
        ) : (
          <ul className="space-y-3">
            {Object.entries(shortages).map(([code, waiting]) => (
              <li key={code} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-full/30 bg-full/5 p-4">
                <div>
                  <p className="font-semibold">{code} has no open seats</p>
                  <p className="text-sm text-ink-soft">
                    Sections: {sections.filter((s) => s.courseCode === code).map((s) => s.label).join(', ')}
                  </p>
                </div>
                <Badge tone="bad">{waiting} students waiting</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
