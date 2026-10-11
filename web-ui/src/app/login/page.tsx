'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { DEMO_PASSWORD, USERS } from '@/lib/mock/data';
import { ROLE_HOME, ROLE_LABEL } from '@/lib/roles';
import { ApiError, type Role } from '@/lib/types';
import { useAuth } from '@/store/auth';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [busy, setBusy] = useState(false);
  const isMock = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';

  async function submit(e?: React.FormEvent, creds?: { email: string; password: string }) {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await login(creds?.email ?? email, creds?.password ?? password, role);
      router.replace(ROLE_HOME[user.role]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-ink p-12 text-white lg:flex">
        <p className="font-display text-xl font-bold">SmartAdvisor</p>
        <div>
          <div className="mb-8 flex max-w-xs flex-wrap gap-1" aria-hidden>
            {Array.from({ length: 35 }, (_, i) => (
              <span key={i} className={i < 31 ? 'h-3 w-3 rounded-[3px] bg-white/15' : 'h-3 w-3 rounded-[3px] bg-[#4FC3D6]'} />
            ))}
          </div>
          <h1 className="max-w-md text-4xl font-semibold leading-tight">Every seat you see is a seat that exists.</h1>
          <p className="mt-4 max-w-sm text-white/70">Live seat counts, prerequisite checks and conflict-free schedules for North South University advising.</p>
        </div>
        <p className="text-sm text-white/50">CSE 327 Software Engineering project</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold">Sign in</h2>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              University email
              <input
                type="email"
                placeholder="name@northsouth.edu"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3"
              />
            </label>
            <label className="block text-sm font-medium">
              Password
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3"
              />
            </label>
            {isMock && (
              <label className="block text-sm font-medium">
                Sign in as
                <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3">
                  <option value="student">Student</option>
                  <option value="faculty">Faculty</option>
                  <option value="admin">IT admin</option>
                </select>
              </label>
            )}
            {error && <p role="alert" className="text-sm text-full">{error}</p>}
            <Button type="submit" loading={busy} className="w-full">Sign in</Button>
          </form>

          {isMock && (
            <p className="mt-4 text-xs text-ink-soft">
              Demo mode: any @northsouth.edu address works with any password. Your real password is never checked or sent anywhere.
            </p>
          )}

          <div className="mt-8 border-t border-line pt-6">
            <p className="mb-3 text-sm text-ink-soft">Demo accounts (password: {DEMO_PASSWORD})</p>
            <div className="grid gap-2">
              {USERS.map((u) => (
                <Button key={u.id} variant="secondary" disabled={busy} onClick={() => submit(undefined, { email: u.email, password: DEMO_PASSWORD })}>
                  Continue as {ROLE_LABEL[u.role].toLowerCase()}: {u.name}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
