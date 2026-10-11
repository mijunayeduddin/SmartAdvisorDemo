import { fmtTime } from '@/lib/format';
import type { Day, Section } from '@/lib/types';

const DAYS: Day[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
const START = 8 * 60;
const END = 17 * 60;
const HOUR_PX = 56;
const TINTS = ['#DDF0F3', '#F6E7C8', '#E3E6F6', '#DCEFE3', '#F5DDDD', '#EADFF3'];

export function ScheduleGrid({ picks }: { picks: Section[] }) {
  const hours = Array.from({ length: (END - START) / 60 }, (_, i) => START + i * 60);
  const height = ((END - START) / 60) * HOUR_PX;

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-[4.5rem_repeat(5,1fr)] border-b border-line text-sm font-medium">
          <div />
          {DAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-[4.5rem_repeat(5,1fr)]" style={{ height }}>
          <div className="relative">
            {hours.map((h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-xs text-ink-faint" style={{ top: ((h - START) / 60) * HOUR_PX }}>
                {fmtTime(h)}
              </span>
            ))}
          </div>
          {DAYS.map((day) => (
            <div key={day} className="relative border-l border-line">
              {hours.map((h) => (
                <div key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: ((h - START) / 60) * HOUR_PX }} />
              ))}
              {picks.map((s, i) =>
                s.slots
                  .filter((sl) => sl.day === day)
                  .map((sl) => (
                    <div
                      key={`${s.id}-${day}`}
                      className="absolute inset-x-1 overflow-hidden rounded-md border border-ink/10 px-2 py-1 text-xs"
                      style={{ top: ((sl.start - START) / 60) * HOUR_PX + 1, height: ((sl.end - sl.start) / 60) * HOUR_PX - 2, background: TINTS[i % TINTS.length] }}
                    >
                      <p className="font-semibold">{s.courseCode}</p>
                      <p className="text-ink-soft">{s.label}</p>
                    </div>
                  )),
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
