import type { TimeSlot } from './types';

export function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`;
}

export function fmtSlots(slots: TimeSlot[]): string {
  if (slots.length === 0) return 'Time to be announced';
  const days = slots.map((s) => s.day).join(' & ');
  return `${days}, ${fmtTime(slots[0].start)} to ${fmtTime(slots[0].end)}`;
}

export function timeAgo(ts: number): string {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
