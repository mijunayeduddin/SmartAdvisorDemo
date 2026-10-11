import { AppShell } from '@/components/layout/AppShell';
import { RoleGuard } from '@/components/layout/RoleGuard';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="student">
      <AppShell>{children}</AppShell>
    </RoleGuard>
  );
}
