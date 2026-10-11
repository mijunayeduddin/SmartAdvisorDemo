'use client';
import { RequestTable } from '@/components/requests/RequestTable';
import { EmptyState, PageHeader } from '@/components/ui/PageHeader';
import { useAdvising } from '@/store/advising';
import { useAuth } from '@/store/auth';

export default function MyRequestsPage() {
  const user = useAuth((s) => s.user)!;
  const { requests, loaded } = useAdvising();
  const mine = requests.filter((r) => r.studentId === user.id);

  return (
    <>
      <PageHeader title="My requests" subtitle="Approved requests are decided instantly. Anything that needs a person appears as waiting for faculty." />
      {!loaded ? <p className="text-ink-soft">Loading…</p> : mine.length === 0 ? <EmptyState title="No requests yet" body="Request a seat from the Courses page." /> : <RequestTable requests={mine} />}
    </>
  );
}
