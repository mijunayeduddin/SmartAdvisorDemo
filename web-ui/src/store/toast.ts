import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';
export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

let n = 0;
export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = ++n;
    set({ toasts: [...get().toasts.slice(-3), { ...t, id }] });
    setTimeout(() => get().dismiss(id), 5000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
