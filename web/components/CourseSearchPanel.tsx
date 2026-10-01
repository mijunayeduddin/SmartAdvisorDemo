'use client';

import React, { useState, useMemo } from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { Search, Plus, Check, Clock, User, MapPin, Sparkles, AlertCircle, Filter, Zap } from 'lucide-react';
import { Section, Course } from '../types';

export const CourseSearchPanel: React.FC = () => {
  const {
    courses,
    sections,
    enrolledSections,
    criticalPath,
    searchQuery,
    setSearchQuery,
    selectedCourseCode,
    setSelectedCourseCode,
    simulateAddSection,
    dropSection,
  } = useScheduleStore();

  const [activeTab, setActiveTab] = useState<'all' | 'critical' | 'eligible' | 'enrolled'>('all');
  const [simulatingKey, setSimulatingKey] = useState<string | null>(null);

  // Group sections by course code
  const sectionsByCourse = useMemo(() => {
    const map = new Map<string, Section[]>();
    for (const sec of sections) {
      const code = sec.course_code.toUpperCase();
      if (!map.has(code)) map.set(code, []);
      map.get(code)!.push(sec);
    }
    return map;
  }, [sections]);

  // Filter courses
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      // Text match
      const query = searchQuery.trim().toUpperCase();
      const matchesSearch =
        !query ||
        c.code.toUpperCase().includes(query) ||
        c.title.toUpperCase().includes(query) ||
        c.department?.toUpperCase().includes(query);

      if (!matchesSearch) return false;

      // Tab match
      if (activeTab === 'critical') return c.isCriticalPath;
      if (activeTab === 'eligible') return c.isEligible;
      if (activeTab === 'enrolled') {
        return enrolledSections.some((s) => s.course_code === c.code);
      }
      return true;
    });
  }, [courses, searchQuery, activeTab, enrolledSections]);

  const handleSimulate = async (courseCode: string, sectionNumber: number) => {
    const key = `${courseCode}-${sectionNumber}`;
    setSimulatingKey(key);
    await simulateAddSection(courseCode, sectionNumber);
    setSimulatingKey(null);
  };

  const handleQuickFullSectionDemo = () => {
    setSearchQuery('CSE311');
    handleSimulate('CSE311', 3);
  };

  return (
    <div className="glass-panel rounded-2xl p-5 border border-surface-700/60 flex flex-col h-full">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-800">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Search className="w-4 h-4 text-brand-400" />
            Course Catalog & Section Simulator
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Search courses, examine live seats, and test registration simulation.
          </p>
        </div>

        {/* Quick Demo Button for Full Section Simulation */}
        <button
          id="quick-full-section-btn"
          onClick={handleQuickFullSectionDemo}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all shadow-glow-critical cursor-pointer self-start sm:self-auto"
          title="Simulate registration for CSE311 §3 (0 seats available) to trigger fallback router"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <span>Simulate Full Section (CSE311 §3)</span>
        </button>
      </div>

      {/* Search input & Filter tabs */}
      <div className="flex flex-col sm:flex-row gap-2.5 my-3.5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="course-search-input"
            type="text"
            placeholder="Search by code (e.g. CSE311), title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-surface-900 border border-surface-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-surface-900 p-1 rounded-xl border border-surface-700/60 overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'all'
                ? 'bg-surface-700 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({courses.length})
          </button>
          <button
            onClick={() => setActiveTab('critical')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
              activeTab === 'critical'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-amber-400/70 hover:text-amber-300'
            }`}
          >
            <Sparkles className="w-3 h-3" /> Critical ({criticalPath.length})
          </button>
          <button
            onClick={() => setActiveTab('eligible')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'eligible'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-cyan-400/70 hover:text-cyan-300'
            }`}
          >
            Eligible
          </button>
          <button
            onClick={() => setActiveTab('enrolled')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'enrolled'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Simulated ({enrolledSections.length})
          </button>
        </div>
      </div>

      {/* Courses and Sections Scrollable List */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 max-h-[580px]">
        {filteredCourses.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            No courses found matching &quot;{searchQuery}&quot;
          </div>
        ) : (
          filteredCourses.map((course) => {
            const courseSections = sectionsByCourse.get(course.code.toUpperCase()) || [];
            const isCritical = course.isCriticalPath;
            const isEnrolledInCourse = enrolledSections.some((s) => s.course_code === course.code);

            return (
              <div
                key={course.code}
                id={`course-card-${course.code}`}
                className={`rounded-xl border p-4 transition-all ${
                  isCritical
                    ? 'border-amber-500/40 bg-gradient-to-br from-amber-950/20 via-surface-900 to-surface-900 shadow-glow-critical'
                    : 'border-surface-700/60 bg-surface-900/60'
                }`}
              >
                {/* Course Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-base text-white">
                        {course.code}
                      </span>
                      <span className="text-xs text-slate-400">
                        {course.credits} Credits
                      </span>

                      {isCritical && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-950 flex items-center gap-1 shadow-sm">
                          <Sparkles className="w-2.5 h-2.5" />
                          Critical Path #{course.criticalPathRank}
                        </span>
                      )}

                      {course.isMilestone && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-milestone/20 text-purple-300 border border-milestone/30">
                          Milestone
                        </span>
                      )}

                      {course.isCompleted && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Completed
                        </span>
                      )}

                      {course.isEligible && !course.isCompleted && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          Eligible
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-semibold text-slate-200 mt-1">
                      {course.title}
                    </h3>
                  </div>

                  {course.prerequisites && course.prerequisites.length > 0 && (
                    <div className="text-[11px] text-slate-400 shrink-0 text-right">
                      Prereq: <span className="text-slate-300">{course.prerequisites.join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* Section Offerings Grid */}
                <div className="mt-3.5 pt-3 border-t border-surface-800">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Offered Sections ({courseSections.length})</span>
                    <span className="text-[10px] text-slate-500">Live seat counts</span>
                  </div>

                  {courseSections.length === 0 ? (
                    <div className="text-xs text-slate-500 italic py-1">
                      No sections offered for this term.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {courseSections.map((sec) => {
                        const isEnrolled = enrolledSections.some(
                          (s) => s.course_code === sec.course_code && s.section_number === sec.section_number
                        );
                        const isFull = sec.seats_available <= 0;
                        const isSimulating = simulatingKey === `${sec.course_code}-${sec.section_number}`;

                        return (
                          <div
                            key={sec.id || `${sec.course_code}-${sec.section_number}`}
                            id={`section-card-${sec.course_code}-${sec.section_number}`}
                            className={`p-3 rounded-xl border flex flex-col justify-between gap-2 transition-all ${
                              isEnrolled
                                ? 'bg-emerald-950/30 border-emerald-500/50'
                                : isFull
                                ? 'bg-surface-850/80 border-rose-500/30'
                                : 'bg-surface-850 border-surface-700/60'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-white">
                                  Section {sec.section_number}
                                </span>
                                {sec.room && (
                                  <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                                    <MapPin className="w-3 h-3 text-slate-500" />
                                    {sec.room}
                                  </span>
                                )}
                              </div>

                              {/* Seats Available Badge */}
                              <span
                                id={`seats-badge-${sec.course_code}-${sec.section_number}`}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${
                                  isFull
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                                    : sec.seats_available <= 3
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                }`}
                              >
                                {isFull ? '0 SEATS (FULL)' : `${sec.seats_available} open`}
                              </span>
                            </div>

                            {/* Schedule & Faculty */}
                            <div className="text-[11px] text-slate-300 space-y-0.5">
                              <div className="flex items-center gap-1 text-slate-400">
                                <Clock className="w-3 h-3 text-slate-500" />
                                <span>
                                  {sec.day_of_week} {sec.start_time?.slice(0, 5)} - {sec.end_time?.slice(0, 5)}
                                </span>
                              </div>
                              {sec.faculty_name && (
                                <div className="flex items-center gap-1 text-slate-400">
                                  <User className="w-3 h-3 text-slate-500" />
                                  <span className="truncate">{sec.faculty_name}</span>
                                </div>
                              )}
                            </div>

                            {/* Action Button */}
                            <div className="pt-1">
                              {isEnrolled ? (
                                <button
                                  id={`drop-btn-${sec.course_code}-${sec.section_number}`}
                                  onClick={() => dropSection(sec.id)}
                                  className="w-full py-1.5 rounded-lg bg-surface-700 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Simulated (Click to Drop)</span>
                                </button>
                              ) : (
                                <button
                                  id={`simulate-btn-${sec.course_code}-${sec.section_number}`}
                                  disabled={isSimulating}
                                  onClick={() => handleSimulate(sec.course_code, sec.section_number)}
                                  className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                    isFull
                                      ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30'
                                      : 'bg-brand-600 hover:bg-brand-500 text-white shadow-sm'
                                  }`}
                                >
                                  {isSimulating ? (
                                    <span>Routing...</span>
                                  ) : isFull ? (
                                    <span>Simulate Add (Full Section)</span>
                                  ) : (
                                    <>
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Simulate Add</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
