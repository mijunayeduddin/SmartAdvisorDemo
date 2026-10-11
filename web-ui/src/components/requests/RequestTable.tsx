import { StatusBadge } from '@/components/ui/Badge';
import { timeAgo } from '@/lib/format';
import type { SeatRequest } from '@/lib/types';

export function RequestTable({ requests }: { requests: SeatRequest[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead className="border-b border-line text-ink-soft">
          <tr>
            <th className="px-4 py-2.5 font-medium">Course</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Details</th>
            <th className="px-4 py-2.5 font-medium">Sent</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {requests.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 font-medium">{r.courseCode}</td>
              <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
              <td className="px-4 py-3 text-ink-soft">{r.reason ?? '-'}</td>
              <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{timeAgo(r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
