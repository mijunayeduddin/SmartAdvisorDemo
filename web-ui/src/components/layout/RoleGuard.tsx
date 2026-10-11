'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ROLE_HOME } from '@/lib/roles';
import type { Role } from '@/lib/types';
import { useAuth } from '@/store/auth';

/** Client-side route guard (UX only). The real RBAC check must live in the API. */
export function RoleGuard({ role, children }: { role: Role; children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace('/login');
    else if (user.role !== role) router.replace(ROLE_HOME[user.role]);
  }, [ready, user, role, router]);

  if (!ready || !user || user.role !== role) return null;
  return <>{children}</>;
}
