'use client';

import React, { useMemo } from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import {
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowRight,
  Zap,
  Target,
  RotateCcw,
  Compass,
  Check,
  Award,
  Layers,
  Info
} from 'lucide-react';
import { PathwayMode } from '../types';

interface DagNode {
  code: string;
  title: string;
  stage: number;
  isCompleted: boolean;
  isEligible: boolean;
  isEnrolled: boolean;
  isTarget: boolean;
  isInPath: boolean;
  pathRole?: 'upstream' | 'target' | 'downstream';
  stepIndex?: number;
  prereqs: string[];
}

export const DagVisualizer: React.FC = () => {
  const {
    courses,
    enrolledSections,
    criticalPath,
    recommendations,
    activePathway,
    pathwayMode,
    setPathwayMode,
    selectedCourseCode,
    setSelectedCourseCode,
    setSearchQuery,
  } = useScheduleStore();

  const enrolledCodes = useMemo(
    () => new Set(enrolledSections.map((s) => s.course_code.toUpperCase())),
    [enrolledSections]
  );

  // Active path sequence to display in the flow strip
  const activeSequence = useMemo(() => {
    if (activePathway && activePathway.fullPath && activePathway.fullPath.length > 0) {
      return activePathway.fullPath;
    }
    return criticalPath;
  }, [activePathway, criticalPath]);

  // Target course of current active path
  const targetCode = activePathway?.target || selectedCourseCode || (activeSequence.length > 0 ? activeSequence[0] : null);

  // Curated landmark CSE curriculum courses
  const dagNodes: DagNode[] = useMemo(() => {
    const rawNodes = [
      { code: 'CSE225', title: 'Data Structures & Algorithms', stage: 1, prereqs: [] },
      { code: 'CSE231', title: 'Digital Logic Design', stage: 1, prereqs: [] },
      { code: 'CSE311', title: 'Database Management Systems', stage: 2, prereqs: ['CSE225'] },
      { code: 'CSE332', title: 'Computer Architecture & Org.', stage: 2, prereqs: ['CSE231'] },
      { code: 'CSE373', title: 'Design & Analysis of Algorithms', stage: 2, prereqs: ['CSE225'] },
      { code: 'CSE327', title: 'Software Engineering', stage: 3, prereqs: ['CSE311'] },
      { code: 'CSE323', title: 'Operating Systems Concepts', stage: 3, prereqs: ['CSE332'] },
      { code: 'CSE425', title: 'Programming Language Concepts', stage: 4, prereqs: ['CSE327'] },
      { code: 'CSE499A', title: 'Senior Design Project I', stage: 4, prereqs: ['CSE327'] },
      { code: 'CSE499B', title: 'Senior Design Project II', stage: 5, prereqs: ['CSE499A'] },
    ];

    const courseMap = new Map(courses.map((c) => [c.code.toUpperCase(), c]));
    const upstreamSet = new Set((activePathway?.upstream || []).map((c) => c.toUpperCase()));
    const downstreamSet = new Set((activePathway?.downstream || []).map((c) => c.toUpperCase()));
    const normTarget = (targetCode || '').toUpperCase();

    return rawNodes.map((n) => {
      const codeUpper = n.code.toUpperCase();
      const live = courseMap.get(codeUpper);
      const isCompleted = live?.isCompleted ?? false;
      const isEligible = live?.isEligible ?? false;
      const isEnrolled = enrolledCodes.has(codeUpper);

      const isTarget = normTarget === codeUpper;
      const isUpstream = upstreamSet.has(codeUpper);
      const isDownstream = downstreamSet.has(codeUpper);
      const isInPath = isTarget || isUpstream || isDownstream;

      let pathRole: 'upstream' | 'target' | 'downstream' | undefined = undefined;
      if (isTarget) pathRole = 'target';
      else if (isUpstream) pathRole = 'upstream';
      else if (isDownstream) pathRole = 'downstream';

      const stepIndex = isInPath ? activeSequence.indexOf(n.code) + 1 : undefined;

      return {
        code: n.code,
        title: live?.title || n.title,
        stage: n.stage,
        isCompleted,
        isEligible,
        isEnrolled,
        isTarget,
        isInPath,
        pathRole,
        stepIndex,
        prereqs: n.prereqs,
      };
    });
  }, [courses, enrolledCodes, activePathway, targetCode, activeSequence]);

  // Stages definition
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

  const handleResetToBest = () => {
    setSelectedCourseCode(null);
    setPathwayMode('best');
    setSearchQuery('');
  };

  const handleModeSwitch = (mode: PathwayMode) => {
    setPathwayMode(mode);
    if (mode === 'best') {
      setSelectedCourseCode(null);
    }
  };

  // Top 3 best recommendations for quick action chips
  const topRecommendations = useMemo(() => {
    return recommendations.slice(0, 3);
  }, [recommendations]);

  return (
    <div className="glass-panel rounded-2xl p-5 border border-surface-700/60 flex flex-col h-full">
      {/* Visualizer Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-surface-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Dynamic Curriculum DAG & Critical Path Solver
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/40">
              Interactive
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time topological progression. Click any course to resolve its critical pathway, or toggle recommended best next moves.
          </p>
        </div>

        {/* Mode Switcher & Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-1 rounded-xl bg-surface-900 border border-surface-700/70 text-xs">
            <button
              onClick={() => handleModeSwitch('best')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                pathwayMode === 'best'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>What is Best</span>
            </button>

            <button
              onClick={() => handleModeSwitch('selected')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                pathwayMode === 'selected'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Selected Focus {selectedCourseCode ? `(${selectedCourseCode})` : ''}</span>
            </button>

            <button
              onClick={() => handleModeSwitch('curriculum')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                pathwayMode === 'curriculum'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Degree Capstone</span>
            </button>
          </div>

          {selectedCourseCode && (
            <button
              onClick={handleResetToBest}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-surface-800 hover:bg-surface-700 text-slate-300 text-xs font-semibold border border-surface-700 transition-all cursor-pointer"
              title="Reset to recommended best move"
            >
              <RotateCcw className="w-3 h-3 text-amber-400" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick "What is Best" Recommendation Chips */}
      <div className="flex items-center gap-2 pt-3 pb-1 overflow-x-auto text-xs">
        <div className="flex items-center gap-1 text-[11px] font-bold text-amber-300 shrink-0 uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Top Advising Picks:</span>
        </div>
        <div className="flex items-center gap-2 flex-nowrap">
          {topRecommendations.map((rec, idx) => {
            const isRecSelected = selectedCourseCode === rec.code;
            return (
              <button
                key={rec.code}
                onClick={() => handleNodeClick(rec.code)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer shrink-0 ${
                  isRecSelected
                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-glow-critical'
                    : rec.isEnrolled
                    ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/40 hover:bg-cyan-950/60'
                    : 'bg-surface-900/90 text-slate-200 border-surface-700 hover:border-amber-400/60 hover:text-amber-300'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black flex items-center justify-center">
                  #{idx + 1}
                </span>
                <span className="font-extrabold">{rec.code}</span>
                {rec.isEnrolled ? (
                  <span className="text-[10px] text-cyan-400 flex items-center gap-0.5">
                    <Check className="w-2.5 h-2.5" /> Enrolled
                  </span>
                ) : (
                  <span className="text-[10px] opacity-75 font-normal">
                    {rec.code === 'CSE311' ? 'Capstone Gate' : rec.code === 'CSE332' ? 'Unlocks OS' : 'Algo Core'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic Critical Path Flow Strip */}
      <div className="my-2.5 p-3 rounded-xl bg-gradient-to-r from-amber-950/40 via-surface-900 to-surface-900 border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <Target className="w-4 h-4 text-amber-400" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
              {pathwayMode === 'selected'
                ? `Focused Pathway (${targetCode || 'Selected'}):`
                : pathwayMode === 'best'
                ? 'Optimal Sequence (Recommended Next Move):'
                : 'Curriculum Critical Path Sequence:'}
            </span>
            <span className="text-[10px] text-slate-400">
              {activeSequence.length} progression steps to landmark milestones
            </span>
          </div>
        </div>

        {/* Step-by-Step Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {activeSequence.map((code, idx) => {
            const isTargetNode = code === targetCode;
            const isEnrolled = enrolledCodes.has(code.toUpperCase());
            const isSelected = selectedCourseCode === code;

            return (
              <React.Fragment key={code}>
                <button
                  onClick={() => handleNodeClick(code)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                    isSelected || isTargetNode
                      ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-glow-critical ring-2 ring-amber-400/50'
                      : isEnrolled
                      ? 'bg-cyan-950/60 text-cyan-200 border-cyan-400/60 hover:bg-cyan-900/60'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
                      isSelected || isTargetNode
                        ? 'bg-slate-950 text-amber-400'
                        : 'bg-amber-400 text-slate-950'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span>{code}</span>
                  {isTargetNode && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-slate-950/80 text-amber-300 font-extrabold uppercase">
                      Focus
                    </span>
                  )}
                  {isEnrolled && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-medium">
                      In Term
                    </span>
                  )}
                </button>
                {idx < activeSequence.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Dynamic Pathway Rationale & Impact Card */}
      {activePathway && (
        <div className="mb-3 p-3 rounded-xl bg-surface-900/80 border border-surface-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-amber-400/10 text-amber-400 shrink-0 mt-0.5 sm:mt-0">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-xs">
                  Pathway Analysis for {activePathway.target}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-surface-800 text-slate-300 font-mono">
                  {activePathway.longestDownstreamLength > 0
                    ? `${activePathway.longestDownstreamLength} stages downstream`
                    : 'Terminal milestone'}
                </span>
                {activePathway.unlocksCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                    Unlocks {activePathway.unlocksCount} courses
                  </span>
                )}
              </div>
              <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">
                {activePathway.rationale}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {selectedCourseCode && (
              <button
                onClick={() => setSearchQuery(selectedCourseCode)}
                className="px-2.5 py-1 rounded-lg bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 border border-brand-500/40 text-[11px] font-semibold transition-all cursor-pointer"
              >
                View Sections
              </button>
            )}
          </div>
        </div>
      )}

      {/* Multi-stage DAG Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-1 flex-1 overflow-x-auto">
        {stages.map((st) => {
          const stageNodes = dagNodes.filter((n) => n.stage === st.id);

          return (
            <div
              key={st.id}
              className="flex flex-col gap-2.5 bg-surface-900/60 p-2.5 rounded-xl border border-surface-800/80 min-w-[150px]"
            >
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pb-1 border-b border-surface-800 flex items-center justify-between">
                <span>{st.label}</span>
                <span className="text-[10px] font-mono text-slate-500">{stageNodes.length}</span>
              </div>

              <div className="flex flex-col gap-2">
                {stageNodes.map((node) => {
                  const isSelected = selectedCourseCode === node.code;
                  const isTarget = node.isTarget;
                  const isInPath = node.isInPath;
                  const isEnrolled = node.isEnrolled;

                  let borderClass = 'border-surface-700/60 bg-surface-850/80 text-slate-300';
                  let badge = null;

                  if (isTarget) {
                    borderClass = 'border-amber-400 bg-amber-950/60 text-white shadow-glow-critical ring-2 ring-amber-400';
                    badge = (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-400 text-slate-950 uppercase tracking-wider flex items-center gap-0.5 shadow-sm">
                        <Sparkles className="w-2.5 h-2.5" />
                        Selected
                      </span>
                    );
                  } else if (isInPath) {
                    borderClass = isSelected
                      ? 'border-amber-400 bg-amber-950/50 text-white shadow-glow-critical ring-2 ring-amber-400'
                      : 'border-amber-500/70 bg-amber-950/30 text-amber-100 shadow-glow-critical';
                    badge = (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-500/30 text-amber-300 border border-amber-500/50 uppercase tracking-wider flex items-center gap-0.5">
                        <Award className="w-2.5 h-2.5 text-amber-400" />
                        {node.pathRole === 'upstream'
                          ? 'Prereq'
                          : `Step ${node.stepIndex}`}
                      </span>
                    );
                  } else if (isEnrolled) {
                    borderClass = 'border-cyan-400/80 bg-cyan-950/40 text-cyan-100 ring-1 ring-cyan-400/50';
                    badge = (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-500/30 text-cyan-200 border border-cyan-400/50 flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> In Term
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
