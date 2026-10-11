'use client';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';

/**
 * One square per seat: taken seats are grey, open seats are coloured by urgency.
 * The count flashes when a live event changes it, so a student can see a seat vanish.
 */
export function SeatPips({ seats, capacity }: { seats: number; capacity: number }) {
  const prev = useRef(seats);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (prev.current === seats) return;
    setFlash(seats > prev.current ? 'up' : 'down');
    prev.current = seats;
    const t = setTimeout(() => setFlash(null), 900);
    return () => clearTimeout(t);
  }, [seats]);

  const state = seats === 0 ? 'full' : seats <= Math.ceil(capacity * 0.1) ? 'low' : 'open';
  const tone = { open: 'bg-open', low: 'bg-low', full: 'bg-full' }[state];
  const text = { open: 'text-open', low: 'text-[#8A5A08]', full: 'text-full' }[state];
  const taken = capacity - seats;

  return (
    <div className="flex items-center gap-3" role="img" aria-label={`${seats} of ${capacity} seats open`}>
      {capacity <= 60 ? (
        <div className="flex max-w-[11rem] flex-wrap gap-[3px]" aria-hidden>
          {Array.from({ length: capacity }, (_, i) => (
            <span key={i} className={clsx('h-2 w-2 rounded-[2px]', i < taken ? 'bg-ink/15' : tone)} />
          ))}
        </div>
      ) : (
        <div className="h-2 w-44 overflow-hidden rounded bg-ink/15" aria-hidden>
          <div className={clsx('h-full', tone)} style={{ width: `${(seats / capacity) * 100}%` }} />
        </div>
      )}
      <span
        className={clsx(
          'min-w-[4.5rem] rounded px-1.5 text-sm font-semibold tabular-nums',
          text,
          flash === 'down' && 'seat-flash-down',
          flash === 'up' && 'seat-flash-up',
        )}
      >
        {seats === 0 ? 'Full' : `${seats} open`}
      </span>
    </div>
  );
}
