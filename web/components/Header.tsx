'use client';

import React from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { LiveSyncBadge } from './LiveSyncBadge';
import { StrategyMode } from '../types';
import { GraduationCap, Award, Compass, Zap } from 'lucide-react';

export const Header: React.FC = () => {
  const { student, strategy, setStrategy } = useScheduleStore();

  const handleStrategyChange = (newStrategy: StrategyMode) => {
    setStrategy(newStrategy);
  };

  return (
    <header className="border-b border-surface-800 bg-surface-900/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Student Identity */}
        <div className="flex items-center gap-3.5 self-start md:self-auto">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-500 flex items-center justify-center shadow-glow-brand shrink-0">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                SmartAdvisor <span className="text-brand-400 font-normal text-xs uppercase px-1.5 py-0.5 rounded bg-brand-900/50 border border-brand-500/20">DAG Solver</span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span className="text-slate-200 font-semibold">{student?.name || 'Tariqul Islam'}</span>
              <span className="text-slate-500">•</span>
              <span>ID: {student?.studentId || '2412800642'}</span>
              <span className="text-slate-500">•</span>
              <span className="text-cyan-400 font-medium">{student?.completedCredits || 70} credits completed</span>
            </p>
          </div>
        </div>

        {/* Center/Right: Strategy Switch & Live Sync Status */}
        <div className="flex items-center gap-3 flex-wrap justify-end w-full md:w-auto">
          {/* Strategy Switch */}
          <div className="flex items-center bg-surface-850 p-1 rounded-xl border border-surface-700/70" id="strategy-toggle-container">
            <button
              id="strategy-milestone-btn"
              onClick={() => handleStrategyChange('MilestonePriority')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                strategy === 'MilestonePriority'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Milestone Priority</span>
            </button>

            <button
              id="strategy-gaps-btn"
              onClick={() => handleStrategyChange('MinimizeGaps')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                strategy === 'MinimizeGaps'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Minimize Gaps</span>
            </button>
          </div>

          {/* Live Sync Badge */}
          <LiveSyncBadge />
        </div>
      </div>
    </header>
  );
};
