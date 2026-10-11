'use client';
import clsx from 'clsx';
import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { NAV, ROLE_LABEL } from '@/lib/roles';
import { useAuth } from '@/store/auth';
import { RealtimeBridge } from './RealtimeBridge';

export function AppShell({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user)!;
  const logout = useAuth((s) => s.logout);
  const pathname = usePathname();
  const router = useRouter();
  const items = NAV[user.role];
  const isActive = (href: string) => (items.some((i) => i.href !== href && i.href.startsWith(href)) ? pathname === href : pathname.startsWith(href));

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <RealtimeBridge />

      <aside className="hidden flex-col border-r border-line bg-white md:flex">
        <div className="px-5 py-5">
          <p className="font-display text-xl font-bold text-brand-dark">SmartAdvisor</p>
          <p className="text-xs text-ink-faint">North South University</p>
        </div>
        <nav className="flex-1 space-y-1 px-3" aria-label="Main">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? 'page' : undefined}
              className={clsx(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                isActive(href) ? 'bg-brand-soft text-brand-dark' : 'text-ink-soft hover:bg-ink/5',
              )}
            >
              <Icon size={18} /> {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line p-4">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="mb-3 text-xs text-ink-faint">{ROLE_LABEL[user.role]}</p>
          <button
            onClick={() => {
              logout();
              router.replace('/login');
            }}
            className="flex items-center gap-2 text-sm text-ink-soft hover:text-ink"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 pb-20 md:pb-0">
        <header className="flex items-center justify-between border-b border-line bg-white px-4 py-3 md:hidden">
          <p className="font-display text-lg font-bold text-brand-dark">SmartAdvisor</p>
          <button
            aria-label="Sign out"
            onClick={() => {
              logout();
              router.replace('/login');
            }}
            className="text-ink-soft"
          >
            <LogOut size={18} />
          </button>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:py-8">{children}</main>
      </div>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-white md:hidden">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? 'page' : undefined}
            className={clsx('flex flex-1 flex-col items-center gap-0.5 py-2 text-xs', isActive(href) ? 'text-brand-dark' : 'text-ink-faint')}
          >
            <Icon size={20} /> {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
