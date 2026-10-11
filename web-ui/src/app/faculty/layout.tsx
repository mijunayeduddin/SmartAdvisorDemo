import { AppShell } from '@/components/layout/AppShell';
import { RoleGuard } from '@/components/layout/RoleGuard';

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="faculty">
      <AppShell>{children}</AppShell>
    </RoleGuard>
  );
}
