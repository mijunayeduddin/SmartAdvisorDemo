'use client';
import Link from 'next/link';
import { SeatPips } from '@/components/seats/SeatPips';
import { RequestTable } from '@/components/requests/RequestTable';
import { EmptyState, PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { nextEligible } from '@/lib/dag';
import { useAdvising } from '@/store/advising';
import { useAuth } from '@/store/auth';

export default function StudentOverview() {
  const user = useAuth((s) => s.user)!;
  const { courses, sections, requests, completed, loaded } = useAdvising();
  const mine = requests.filter((r) => r.studentId === user.id);
  const eligible = nextEligible(courses, completed);
  const approvedCredits = mine
    .filter((r) => r.status === 'approved')
    .reduce((sum, r) => sum + (courses.find((c) => c.code === r.courseCode)?.credits ?? 0), 0);
  const watch = sections.filter((s) => eligible.some((c) => c.code === s.courseCode) && s.seats <= 3).slice(0, 4);

  if (!loaded) return <p className="text-ink-soft">Loading your advising data…</p>;

  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(' ')[0]}`} subtitle="Here is where your registration stands right now." />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Credits secured" value={approvedCredits} hint="From approved requests" />
        <StatCard label="Waiting for faculty" value={mine.filter((r) => r.status === 'pending').length} />
        <StatCard label="Courses you can take" value={eligible.length} hint="Prerequisites met" />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Sections filling up fast</h2>
        {watch.length === 0 ? (
          <EmptyState title="Nothing is running low" body="Sections for your eligible courses have plenty of seats." />
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-white">
            {watch.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <p className="font-medium">{s.courseCode} <span className="font-normal text-ink-soft">{s.label}</span></p>
                <SeatPips seats={s.seats} capacity={s.capacity} />
              </li>
            ))}
          </ul>
        )}
        <Link href="/student/courses" className="mt-3 inline-block text-sm font-medium text-brand-dark hover:underline">Browse all courses</Link>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Recent requests</h2>
        {mine.length === 0 ? <EmptyState title="No requests yet" body="Pick a course and request a seat to get started." /> : <RequestTable requests={mine.slice(0, 5)} />}
      </section>
    </>
  );
}
