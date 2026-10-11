import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SeatPips } from './SeatPips';
import { fmtSlots } from '@/lib/format';
import type { Course, Section, SeatRequest } from '@/lib/types';

interface Props {
  course: Course;
  sections: Section[];
  missing: string[];
  completed: boolean;
  request?: SeatRequest;
  busyId?: string | null;
  onRequest: (section: Section) => void;
}

export function CourseCard({ course, sections, missing, completed, request, busyId, onRequest }: Props) {
  const locked = missing.length > 0;
  const holds = request && request.status !== 'rejected';

  return (
    <article className="rounded-xl border border-line bg-white">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h3 className="text-lg font-semibold">
            {course.code} <span className="font-normal text-ink-soft">{course.title}</span>
          </h3>
          <p className="text-sm text-ink-faint">{course.credits} credits</p>
        </div>
        {completed ? (
          <Badge tone="good">Completed</Badge>
        ) : locked ? (
          <Badge tone="warn">Needs {missing.join(', ')}</Badge>
        ) : (
          <Badge tone="brand">Prerequisites met</Badge>
        )}
      </header>

      {completed ? null : sections.length === 0 ? (
        <p className="px-4 py-3 text-sm text-ink-soft">No sections are open for this course this semester.</p>
      ) : (
        <ul className="divide-y divide-line">
          {sections.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-[10rem]">
                <p className="font-medium">{s.label}</p>
                <p className="text-sm text-ink-soft">{s.facultyName}</p>
                <p className="text-sm text-ink-soft">{fmtSlots(s.slots)}</p>
              </div>
              <SeatPips seats={s.seats} capacity={s.capacity} />
              <Button
                size="sm"
                variant={locked ? 'secondary' : 'primary'}
                loading={busyId === s.id}
                disabled={Boolean(holds)}
                onClick={() => onRequest(s)}
              >
                {holds ? (request!.sectionId === s.id ? 'Requested' : 'Already requested') : locked ? 'Ask for override' : s.seats === 0 ? 'Join waitlist' : 'Request seat'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
