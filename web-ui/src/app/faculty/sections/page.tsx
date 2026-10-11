'use client';
import { useState } from 'react';
import { SeatPips } from '@/components/seats/SeatPips';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { fmtSlots } from '@/lib/format';
import { useAdvising } from '@/store/advising';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';

export default function FacultySections() {
  const user = useAuth((s) => s.user)!;
  const { sections, loaded, expand } = useAdvising();
  const push = useToast((s) => s.push);
  const [by, setBy] = useState(5);
  const [busy, setBusy] = useState<string | null>(null);
  const mine = sections.filter((s) => s.facultyId === user.id);

  async function add(id: string, code: string) {
    setBusy(id);
    try {
      await expand(id, by, user.id);
      push({ tone: 'success', title: `${code}: ${by} seats added`, body: 'Waiting students are notified.' });
    } catch (e) {
      push({ tone: 'error', title: e instanceof Error ? e.message : 'Could not add seats' });
    } finally {
      setBusy(null);
    }
  }

  if (!loaded) return <p className="text-ink-soft">Loading sections…</p>;

  return (
    <>
      <PageHeader
        title="My sections"
        subtitle="Add seats to a section with one click."
        action={
          <label className="flex items-center gap-2 text-sm">
            Seats to add
            <select value={by} onChange={(e) => setBy(Number(e.target.value))} className="h-9 rounded-md border border-line bg-white px-2">
              {[1, 5, 10].map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
        }
      />
      <ul className="divide-y divide-line rounded-xl border border-line bg-white">
        {mine.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-[11rem]">
              <p className="font-medium">{s.courseCode} {s.label}</p>
              <p className="text-sm text-ink-soft">{fmtSlots(s.slots)}</p>
            </div>
            <SeatPips seats={s.seats} capacity={s.capacity} />
            <Button size="sm" variant="secondary" loading={busy === s.id} onClick={() => add(s.id, s.courseCode)}>Add {by} seats</Button>
          </li>
        ))}
      </ul>
    </>
  );
}
