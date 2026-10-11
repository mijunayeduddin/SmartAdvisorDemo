import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import './globals.css';
import { ToastHost } from '@/components/ui/Toast';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display' });
const body = Figtree({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'SmartAdvisor',
  description: 'Course advising that stays correct when everyone registers at once.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        {children}
        <ToastHost />
      </body>
    </html>
  );
}
