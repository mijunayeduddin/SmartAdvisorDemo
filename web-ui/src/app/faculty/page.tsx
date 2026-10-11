'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState, PageHeader } from '@/components/ui/PageHeader';
import { RequestTable } from '@/components/requests/RequestTable';
import { timeAgo } from '@/lib/format';
import { useAdvising } from '@/store/advising';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';

export default function FacultyQueue() {
  const user = useAuth((s) => s.user)!;
  const { requests, sections, loaded, decide } = useAdvising();
  const push = useToast((s) => s.push);
  const [busy, setBusy] = useState<string | null>(null);

  const mineIds = new Set(sections.filter((s) => s.facultyId === user.id).map((s) => s.id));
  const forMe = requests.filter((r) => mineIds.has(r.sectionId));
  const pending = forMe.filter((r) => r.status === 'pending');
  const decided = forMe.filter((r) => r.status !== 'pending' && r.studentId !== user.id).slice(0, 8);

  async function act(id: string, decision: 'approved' | 'rejected') {
    setBusy(id);
    try {
      await decide(id, decision);
      push({ tone: 'success', title: decision === 'approved' ? 'Request approved' : 'Request rejected' });
    } catch (e) {
      push({ tone: 'error', title: e instanceof Error ? e.message : 'Could not save decision' });
    } finally {
      setBusy(null);
    }
  }

  if (!loaded) return <p className="text-ink-soft">Loading queue…</p>;

  return (
    <>
      <PageHeader title="Exception queue" subtitle="Only requests that failed a rule reach you. Everything else was approved automatically." />

      {pending.length === 0 ? (
        <EmptyState title="Queue is clear" body="New exceptions appear here the moment a student sends one." />
      ) : (
        <ul className="space-y-3">
          {pending.map((r) => {
            const s = sections.find((x) => x.id === r.sectionId);
            return (
              <li key={r.id} className="rounded-xl border border-line bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{r.studentName} <span className="font-normal text-ink-soft">for {r.courseCode} {s?.label}</span></p>
                    <p className="mt-1 max-w-prose text-sm text-ink-soft">{r.reason}</p>
                    <p className="mt-1 text-xs text-ink-faint">{timeAgo(r.createdAt)}{s ? ` · ${s.seats} seats left` : ''}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="danger" loading={busy === r.id} onClick={() => act(r.id, 'rejected')}>Reject</Button>
                    <Button size="sm" loading={busy === r.id} onClick={() => act(r.id, 'approved')}>Approve</Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {decided.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Recently decided</h2>
          <RequestTable requests={decided} />
        </section>
      )}
    </>
  );
}
