'use client';
import { useEffect } from 'react';
import { socket } from '@/lib/realtime';
import { useAdvising } from '@/store/advising';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';

/** Loads initial data once, then keeps the store in sync with pushed events. Mount once inside the shell. */
export function RealtimeBridge() {
  const user = useAuth((s) => s.user);
  const load = useAdvising((s) => s.load);
  const applyEvent = useAdvising((s) => s.applyEvent);
  const push = useToast((s) => s.push);

  useEffect(() => {
    if (!user) return;
    load(user);
    return socket.subscribe((e) => {
      applyEvent(e);

      if (e.type === 'request') {
        const r = e.request;
        if (user.role === 'student' && r.studentId === user.id && r.decidedAt && r.status !== 'pending') {
          push({ tone: r.status === 'approved' ? 'success' : 'warning', title: `${r.courseCode} request ${r.status}` });
        }
        if (user.role === 'faculty' && r.status === 'pending') {
          const section = useAdvising.getState().sections.find((s) => s.id === r.sectionId);
          if (section?.facultyId === user.id && r.studentId !== user.id) {
            push({ tone: 'info', title: `New exception: ${r.courseCode}`, body: r.studentName });
          }
        }
      }
      if (e.type === 'shortage' && user.role === 'admin') {
        push({ tone: 'error', title: `${e.courseCode} has no seats left`, body: `${e.waiting} students are waiting.` });
      }
    });
  }, [user, load, applyEvent, push]);

  return null;
}
