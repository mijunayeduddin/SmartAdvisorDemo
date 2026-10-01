import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SmartAdvisor - Live Academic Advising & DAG Solver',
  description: 'Real-time course scheduling, DAG prerequisite critical path solver, and intelligent fallback routing for NSU students.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-surface-900 text-slate-100 min-h-screen antialiased selection:bg-brand-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
