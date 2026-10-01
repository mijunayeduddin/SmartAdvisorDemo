'use client';

import React, { useMemo } from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { Sparkles, CheckCircle2, Lock, ArrowRight, Zap, Target } from 'lucide-react';

interface DagNode {
  code: string;
  title: string;
  stage: number;
  isCompleted: boolean;
  isEligible: boolean;
  isCriticalPath: boolean;
  criticalRank?: number;
  prereqs: string[];
}

export const DagVisualizer: React.FC = () => {
  const { courses, criticalPath, eligibleCourses, selectedCourseCode, setSelectedCourseCode, setSearchQuery } = useScheduleStore();

  // Curated DAG node layout for remaining and landmark CSE curriculum courses
  const dagNodes: DagNode[] = useMemo(() => {
    const rawNodes = [
      { code: 'CSE225', title: 'Data Structures', stage: 1, prereqs: [] },
      { code: 'CSE231', title: 'Digital Logic Design', stage: 1, prereqs: [] },
      { code: 'CSE311', title: 'Database Systems', stage: 2, prereqs: ['CSE225'] },
      { code: 'CSE332', title: 'Computer Architecture', stage: 2, prereqs: ['CSE231'] },
      { code: 'CSE373', title: 'Algorithms Design', stage: 2, prereqs: ['CSE225'] },
      { code: 'CSE327', title: 'Software Engineering', stage: 3, prereqs: ['CSE311'] },
      { code: 'CSE323', title: 'Operating Systems', stage: 3, prereqs: ['CSE332'] },
      { code: 'CSE425', title: 'Programming Lang. Concepts', stage: 4, prereqs: ['CSE327'] },
      { code: 'CSE499A', title: 'Senior Design I', stage: 4, prereqs: ['CSE327'] },
      { code: 'CSE499B', title: 'Senior Design II', stage: 5, prereqs: ['CSE499A'] },
    ];

    const courseMap = new Map(courses.map((c) => [c.code, c]));

    return rawNodes.map((n) => {
      const live = courseMap.get(n.code);
      const isCritical = criticalPath.includes(n.code);
      const rank = isCritical ? criticalPath.indexOf(n.code) + 1 : undefined;
      const isCompleted = live?.isCompleted ?? false;
      const isEligible = live?.isEligible ?? false;

      return {
        code: n.code,
        title: live?.title || n.title,
        stage: n.stage,
        isCompleted,
        isEligible,
        isCriticalPath: isCritical,
        criticalRank: rank,
        prereqs: n.prereqs,
      };
    });
  }, [courses, criticalPath]);

  // Group nodes by stage
  const stages = [
    { id: 1, label: 'Completed Foundations' },
    { id: 2, label: 'Term Available (Now)' },
    { id: 3, label: 'Upcoming Milestone' },
    { id: 4, label: 'Senior Core' },
    { id: 5, label: 'Graduation Capstone' },
  ];

  const handleNodeClick = (code: string) => {
    setSelectedCourseCode(code);
    setSearchQuery(code);
  };

  return (
    <div className="glass-panel rounded-2xl p-5 border border-surface-700/60 flex flex-col h-full">
      {/* Visualizer Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-surface-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Curriculum Path & Critical Path DAG
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time topological DAG resolution. Critical path is highlighted in vibrant gold.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] text-slate-300 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-glow-critical animate-pulse" />
            <span className="font-semibold text-amber-400">Critical Path</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <span>Eligible</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
            <span>Locked</span>
          </div>
        </div>
      </div>

      {/* Critical Path Flow Strip */}
      <div className="my-3.5 p-3 rounded-xl bg-gradient-to-r from-amber-950/30 via-surface-900 to-surface-900 border border-amber-500/30 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <Target className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
            Critical Path Sequence:
          </span>
        </div>

        <div className="flex items-center gap-2">
          {criticalPath.map((code, idx) => (
            <React.Fragment key={code}>
              <button
                onClick={() => handleNodeClick(code)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  selectedCourseCode === code
                    ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-glow-critical'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] flex items-center justify-center font-black">
                  {idx + 1}
                </span>
                <span>{code}</span>
              </button>
              {idx < criticalPath.length - 1 && (
                <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Multi-stage DAG Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 flex-1 overflow-x-auto">
        {stages.map((st) => {
          const stageNodes = dagNodes.filter((n) => n.stage === st.id);

          return (
            <div
              key={st.id}
              className="flex flex-col gap-2.5 bg-surface-900/60 p-2.5 rounded-xl border border-surface-800/80 min-w-[150px]"
            >
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pb-1 border-b border-surface-800">
                {st.label}
              </div>

              <div className="flex flex-col gap-2">
                {stageNodes.map((node) => {
                  const isCritical = node.isCriticalPath;
                  const isSelected = selectedCourseCode === node.code;

                  let borderClass = 'border-surface-700/60 bg-surface-850/80 text-slate-300';
                  let badge = null;

                  if (isCritical) {
                    borderClass = isSelected
                      ? 'border-amber-400 bg-amber-950/50 text-white shadow-glow-critical ring-2 ring-amber-400'
                      : 'border-amber-500/60 bg-amber-950/30 text-amber-100 shadow-glow-critical';
                    badge = (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-400 text-slate-950 uppercase tracking-wider flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" />
                        Step {node.criticalRank}
                      </span>
                    );
                  } else if (node.isCompleted) {
                    borderClass = 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200';
                    badge = (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-emerald-500/20 text-emerald-300 flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Done
                      </span>
                    );
                  } else if (node.isEligible) {
                    borderClass = isSelected
                      ? 'border-cyan-400 bg-cyan-950/40 text-cyan-100 ring-2 ring-cyan-400'
                      : 'border-cyan-500/40 bg-cyan-950/20 text-cyan-200';
                    badge = (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-cyan-500/20 text-cyan-300">
                        Eligible
                      </span>
                    );
                  } else {
                    borderClass = 'border-surface-800 bg-surface-900/40 text-slate-500 opacity-60';
                    badge = (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-slate-800 text-slate-400 flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> Locked
                      </span>
                    );
                  }

                  return (
                    <div
                      key={node.code}
                      onClick={() => handleNodeClick(node.code)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer hover:scale-[1.02] ${borderClass}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-extrabold text-xs tracking-tight">
                          {node.code}
                        </span>
                        {badge}
                      </div>

                      <div className="text-[11px] font-medium truncate mt-0.5 text-slate-300">
                        {node.title}
                      </div>

                      {node.prereqs.length > 0 && (
                        <div className="text-[9px] text-slate-400 mt-1.5">
                          Prereq: {node.prereqs.join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
