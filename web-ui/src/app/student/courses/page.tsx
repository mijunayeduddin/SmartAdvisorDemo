'use client';
import { useState } from 'react';
import { CourseCard } from '@/components/seats/CourseCard';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { missingPrerequisites } from '@/lib/dag';
import { ApiError, type Section } from '@/lib/types';
import { useAdvising } from '@/store/advising';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';

export default function CoursesPage() {
  const user = useAuth((s) => s.user)!;
  const { courses, sections, requests, completed, loaded, submitRequest } = useAdvising();
  const push = useToast((s) => s.push);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [onlyEligible, setOnlyEligible] = useState(false);
  const [override, setOverride] = useState<Section | null>(null);
  const [reason, setReason] = useState('');

  async function send(section: Section, overrideReason?: string) {
    setBusyId(section.id);
    try {
      const r = await submitRequest(user, section.id, overrideReason);
      push(
        r.status === 'approved'
          ? { tone: 'success', title: `${r.courseCode} seat confirmed` }
          : { tone: 'info', title: `${r.courseCode} sent to faculty`, body: 'You will be notified when they decide.' },
      );
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SECTION_FULL') {
        const alts = (err.details?.alternatives as Section[] | undefined) ?? [];
        push({
          tone: 'warning',
          title: err.message,
          body: alts.length ? `Open instead: ${alts.map((a) => a.label).join(', ')}` : 'No other section has seats. IT staff have been alerted.',
        });
      } else {
        push({ tone: 'error', title: err instanceof Error ? err.message : 'Request failed. Try again.' });
      }
    } finally {
      setBusyId(null);
    }
  }

  function onRequest(section: Section) {
    const course = courses.find((c) => c.code === section.courseCode)!;
    if (missingPrerequisites(course, completed).length > 0) {
      setReason('');
      setOverride(section);
    } else {
      send(section);
    }
  }

  if (!loaded) return <p className="text-ink-soft">Loading courses…</p>;

  const visible = courses.filter((c) => !onlyEligible || (!completed.includes(c.code) && missingPrerequisites(c, completed).length === 0));

  return (
    <>
      <PageHeader
        title="Courses"
        subtitle="Seat counts update live. Courses with unmet prerequisites can still be requested, and faculty will review them."
        action={
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyEligible} onChange={(e) => setOnlyEligible(e.target.checked)} className="h-4 w-4 accent-[#0B7A8C]" />
            Only courses I can take
          </label>
        }
      />
      <div className="space-y-4">
        {visible.map((c) => (
          <CourseCard
            key={c.code}
            course={c}
            sections={sections.filter((s) => s.courseCode === c.code)}
            missing={missingPrerequisites(c, completed)}
            completed={completed.includes(c.code)}
            request={requests.find((r) => r.studentId === user.id && r.courseCode === c.code && r.status !== 'rejected')}
            busyId={busyId}
            onRequest={onRequest}
          />
        ))}
      </div>

      <Modal open={Boolean(override)} title="Ask faculty for an override" onClose={() => setOverride(null)}>
        <p className="mb-3 text-sm text-ink-soft">
          You are missing a prerequisite for {override?.courseCode}. Tell the instructor why you should be allowed in.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-line p-3 text-sm"
          placeholder="For example: I completed an equivalent course at another university."
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOverride(null)}>Cancel</Button>
          <Button
            disabled={reason.trim().length < 5}
            onClick={() => {
              const s = override!;
              setOverride(null);
              send(s, reason.trim());
            }}
          >
            Send to faculty
          </Button>
        </div>
      </Modal>
    </>
  );
}
