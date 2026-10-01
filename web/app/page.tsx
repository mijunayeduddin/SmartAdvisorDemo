'use client';

import React, { useEffect } from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { Header } from '../components/Header';
import { FallbackBanner } from '../components/FallbackBanner';
import { DagVisualizer } from '../components/DagVisualizer';
import { CourseSearchPanel } from '../components/CourseSearchPanel';
import { CurrentSchedule } from '../components/CurrentSchedule';
import { Layers, Network, Activity, Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const { init, isLoading } = useScheduleStore();

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="min-h-screen flex flex-col bg-surface-900 text-slate-100">
      {/* Top Header */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Dynamic Fallback Suggestion Banner */}
        <FallbackBanner />

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
            <p className="text-sm font-medium">Connecting to SmartAdvisor DAG Solver & WebSockets...</p>
          </div>
        ) : (
          <>
            {/* Top View: Curriculum DAG & Critical Path Visualization */}
            <section className="w-full">
              <DagVisualizer />
            </section>

            {/* Split View: Course Catalog & Section Simulator + Current Schedule */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left/Main Column: Course Search + Sections Add/Drop Simulator */}
              <div className="lg:col-span-8">
                <CourseSearchPanel />
              </div>

              {/* Right Column: Simulated Schedule & Credit Counter */}
              <div className="lg:col-span-4 sticky top-24">
                <CurrentSchedule />
              </div>
            </section>
          </>
        )}
      </main>

      {/* System Footer & Pattern Badges */}
      <footer className="border-t border-surface-800 bg-surface-950 py-4 px-4 sm:px-6 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">SmartAdvisor Academic Engine</span>
            <span>•</span>
            <span>North South University (CSE 327)</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1 text-slate-400">
              <Network className="w-3.5 h-3.5 text-amber-400" />
              <span>DAG Critical Path Solver</span>
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Observer WebSocket Sync</span>
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <Layers className="w-3.5 h-3.5 text-brand-400" />
              <span>Strategy Pattern Fallback Router</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
