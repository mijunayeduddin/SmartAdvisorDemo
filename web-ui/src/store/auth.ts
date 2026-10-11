import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mockApi } from '@/lib/mock/server';
import { realLogin } from '@/lib/api';
import type { Role, User } from '@/lib/types';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string, role?: Role) => Promise<User>;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: async (email, password, role) => {
        if (USE_MOCK) {
          const user = await mockApi.login(email, password, role);
          set({ user, token: null });
          return user;
        }
        const { user, token } = await realLogin(email, password);
        set({ user, token });
        return user;
      },
      logout: () => set({ user: null, token: null }),
    }),
    { name: 'smartadvisor-auth' },
  ),
);
