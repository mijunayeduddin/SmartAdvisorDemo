'use client';

import React, { useState, useMemo } from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import {
  Search,
  Plus,
  Check,
  Clock,
  User,
  MapPin,
  Sparkles,
  AlertCircle,
  Filter,
  Zap,
  BookOpen,
  ChevronDown,
  Layers,
  RotateCcw,
  Target
} from 'lucide-react';
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
    selectedDepartment,
    setSelectedDepartment,
    seatFilter,
    setSeatFilter,
    simulateAddSection,
    dropSection,
  } = useScheduleStore();

  const [activeTab, setActiveTab] = useState<'all' | 'critical' | 'eligible' | 'enrolled'>('all');
  const [simulatingKey, setSimulatingKey] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(25);

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

  // Extract distinct departments with counts
  const departmentsWithCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of courses) {
      const dept = c.department ? c.department.toUpperCase() : 'OTHER';
      counts.set(dept, (counts.get(dept) || 0) + 1);
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return [{ dept: 'ALL', count: courses.length }, ...sorted.map(([dept, count]) => ({ dept, count }))];
  }, [courses]);

  // Multi-field filtered courses
  const filteredCourses = useMemo(() => {
    const query = searchQuery.trim().toUpperCase();

    return courses.filter((c) => {
      const courseSections = sectionsByCourse.get(c.code.toUpperCase()) || [];

      // 1. Department filter
      if (selectedDepartment && selectedDepartment !== 'ALL') {
        if ((c.department || '').toUpperCase() !== selectedDepartment) {
          return false;
        }
      }

      // 2. Seat filter
      if (seatFilter === 'open') {
        const hasOpenSeats = courseSections.some((s) => s.seats_available > 0);
        if (!hasOpenSeats && courseSections.length > 0) return false;
      } else if (seatFilter === 'full') {
        const hasFullSeats = courseSections.some((s) => s.seats_available <= 0);
        if (!hasFullSeats && courseSections.length > 0) return false;
      }

      // 3. Tab filter
      if (activeTab === 'critical' && !c.isCriticalPath) return false;
      if (activeTab === 'eligible' && !c.isEligible) return false;
      if (activeTab === 'enrolled') {
        const isEnrolled = enrolledSections.some((s) => s.course_code === c.code);
        if (!isEnrolled) return false;
      }

      // 4. Multi-attribute Search Match
      if (!query) return true;

      // Match course direct properties
      const matchesCourse =
        c.code.toUpperCase().includes(query) ||
        c.title.toUpperCase().includes(query) ||
        (c.department && c.department.toUpperCase().includes(query));

      if (matchesCourse) return true;

      // Match section properties (faculty, room, day, time)
      const matchesSection = courseSections.some((sec) => {
        const facMatch = sec.faculty_name?.toUpperCase().includes(query);
        const roomMatch = sec.room?.toUpperCase().includes(query);
        const dayMatch = sec.day_of_week?.toUpperCase().includes(query);
        const timeMatch = (sec.raw_time || `${sec.start_time} - ${sec.end_time}`).toUpperCase().includes(query);
        const secNumMatch = `SECTION ${sec.section_number}`.includes(query) || `SEC ${sec.section_number}`.includes(query);
        return facMatch || roomMatch || dayMatch || timeMatch || secNumMatch;
      });

      return matchesSection;
    });
  }, [courses, sectionsByCourse, searchQuery, selectedDepartment, seatFilter, activeTab, enrolledSections]);

  const handleSimulate = async (courseCode: string, sectionNumber: number) => {
    const key = `${courseCode}-${sectionNumber}`;
    setSimulatingKey(key);
    await simulateAddSection(courseCode, sectionNumber);
    setSimulatingKey(null);
  };

  const handleQuickFullSectionDemo = () => {
    setSearchQuery('ACT201');
    setSelectedDepartment('ACT');
    handleSimulate('ACT201', 1);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedDepartment('ALL');
    setSeatFilter('all');
    setActiveTab('all');
    setVisibleCount(25);
  };

  const visibleCourses = useMemo(() => {
    return filteredCourses.slice(0, visibleCount);
  }, [filteredCourses, visibleCount]);

  const uppercaseQuery = searchQuery.trim().toUpperCase();

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
            Search across <strong className="text-slate-200">{courses.length} courses</strong> and{' '}
            <strong className="text-slate-200">{sections.length} sections</strong> by Code, Title, Faculty, Room, or Department.
          </p>
        </div>

        {/* Quick Demo Button for Full Section Simulation */}
        <button
          id="quick-full-section-btn"
          onClick={handleQuickFullSectionDemo}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all shadow-glow-critical cursor-pointer self-start sm:self-auto"
          title="Simulate registration for a full section (0 seats available) to trigger fallback router"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <span>Simulate Full Section (ACT201 §1)</span>
        </button>
      </div>

      {/* Main Search Bar & Quick Filters */}
      <div className="flex flex-col gap-2.5 my-3.5">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="course-search-input"
              type="text"
              placeholder="Search code (ACT201, CSE115), title, faculty (ARM), room (NAC603)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(25); // reset view window on new search
              }}
              className="w-full pl-10 pr-16 py-2 rounded-xl bg-surface-900 border border-surface-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white bg-surface-800 px-2 py-0.5 rounded cursor-pointer transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Department Select Dropdown */}
          <div className="relative sm:w-48">
            <select
              id="department-filter-select"
              value={selectedDepartment}
              onChange={(e) => {
                setSelectedDepartment(e.target.value);
                setVisibleCount(25);
              }}
              className="w-full appearance-none pl-3 pr-8 py-2 rounded-xl bg-surface-900 border border-surface-700 text-xs font-semibold text-slate-200 focus:outline-none focus:border-brand-500 transition-all cursor-pointer"
            >
              {departmentsWithCounts.map(({ dept, count }) => (
                <option key={dept} value={dept} className="bg-surface-900 text-slate-200">
                  {dept === 'ALL' ? `All Depts (${count})` : `${dept} (${count})`}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Secondary Filter Bar: Status Tabs & Seat Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-surface-900 p-1 rounded-xl border border-surface-700/60 overflow-x-auto">
            <button
              onClick={() => { setActiveTab('all'); setVisibleCount(25); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'all'
                  ? 'bg-surface-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Courses ({filteredCourses.length})
            </button>
            <button
              onClick={() => { setActiveTab('critical'); setVisibleCount(25); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
                activeTab === 'critical'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-amber-400/70 hover:text-amber-300'
              }`}
            >
              <Sparkles className="w-3 h-3" /> Critical ({criticalPath.length})
            </button>
            <button
              onClick={() => { setActiveTab('eligible'); setVisibleCount(25); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'eligible'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-cyan-400/70 hover:text-cyan-300'
              }`}
            >
              Eligible
            </button>
            <button
              onClick={() => { setActiveTab('enrolled'); setVisibleCount(25); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'enrolled'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Simulated ({enrolledSections.length})
            </button>
          </div>

          {/* Seat Filter Toggle */}
          <div className="flex items-center gap-1 bg-surface-900 p-1 rounded-xl border border-surface-700/60 text-xs">
            <button
              onClick={() => setSeatFilter('all')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition-all ${
                seatFilter === 'all' ? 'bg-surface-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Seats
            </button>
            <button
              onClick={() => setSeatFilter('open')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition-all ${
                seatFilter === 'open' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-emerald-400/70 hover:text-emerald-300'
              }`}
            >
              Open Only
            </button>
            <button
              onClick={() => setSeatFilter('full')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition-all ${
                seatFilter === 'full' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-rose-400/70 hover:text-rose-300'
              }`}
            >
              Full Only
            </button>
          </div>
        </div>
      </div>

      {/* Courses and Sections Scrollable List */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 max-h-[580px]">
        {filteredCourses.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-xl border border-surface-800 bg-surface-900/40">
            <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <div className="text-slate-300 font-semibold text-sm">No courses matching your filters</div>
            <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
              We couldn&apos;t find any course matching query &quot;{searchQuery}&quot; with department {selectedDepartment}.
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 border border-brand-500/40 text-xs font-semibold cursor-pointer transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          </div>
        ) : (
          <>
            {visibleCourses.map((course) => {
              const courseSections = sectionsByCourse.get(course.code.toUpperCase()) || [];
              const isCritical = course.isCriticalPath;
              const isEnrolledInCourse = enrolledSections.some((s) => s.course_code === course.code);

              // Filter sections inside course if seatFilter or query is specific
              const displayedSections = courseSections.filter((sec) => {
                if (seatFilter === 'open' && sec.seats_available <= 0) return false;
                if (seatFilter === 'full' && sec.seats_available > 0) return false;
                return true;
              });

              const isSelectedInDag = selectedCourseCode === course.code;

              return (
                <div
                  key={course.code}
                  id={`course-card-${course.code}`}
                  onClick={() => setSelectedCourseCode(course.code)}
                  className={`rounded-xl border p-4 transition-all cursor-pointer ${
                    isSelectedInDag
                      ? 'border-amber-400 bg-amber-950/30 ring-2 ring-amber-400/60 shadow-glow-critical'
                      : isCritical
                      ? 'border-amber-500/40 bg-gradient-to-br from-amber-950/20 via-surface-900 to-surface-900 shadow-glow-critical'
                      : 'border-surface-700/60 bg-surface-900/60 hover:border-surface-600/80'
                  }`}
                >
                  {/* Course Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-base text-white tracking-wide">
                          {course.code}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-700/80 text-slate-300">
                          {course.department}
                        </span>
                        <span className="text-xs text-slate-400">
                          {course.credits} Credits
                        </span>

                        {/* Quick DAG inspection indicator */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCourseCode(course.code);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                            isSelectedInDag
                              ? 'bg-amber-400 text-slate-950 shadow-sm'
                              : 'bg-surface-800 hover:bg-surface-700 text-amber-300 border border-amber-500/30'
                          }`}
                          title="Inspect dynamic critical pathway in DAG"
                        >
                          <Target className="w-2.5 h-2.5" />
                          <span>{isSelectedInDag ? 'Viewing in DAG' : 'Inspect in DAG'}</span>
                        </button>

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
                      {course.description && (
                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                          {course.description}
                        </p>
                      )}
                    </div>

                    {course.prerequisites && course.prerequisites.length > 0 && (
                      <div className="text-[11px] text-slate-400 shrink-0 text-right">
                        Prereq: <span className="text-slate-300 font-mono">{course.prerequisites.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  {/* Section Offerings Grid */}
                  <div className="mt-3.5 pt-3 border-t border-surface-800">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span>Offered Sections ({displayedSections.length} of {courseSections.length})</span>
                      </span>
                      <span className="text-[10px] text-slate-500">Live seat counts</span>
                    </div>

                    {displayedSections.length === 0 ? (
                      <div className="text-xs text-slate-500 italic py-1">
                        {courseSections.length === 0
                          ? 'No sections scheduled for this term.'
                          : 'No sections match the current seat filter.'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {displayedSections.map((sec) => {
                          const isEnrolled = enrolledSections.some(
                            (s) => s.course_code === sec.course_code && s.section_number === sec.section_number
                          );
                          const isFull = sec.seats_available <= 0;
                          const isSimulating = simulatingKey === `${sec.course_code}-${sec.section_number}`;

                          // Highlight if query directly matches faculty or room
                          const matchesFaculty = uppercaseQuery && sec.faculty_name?.toUpperCase().includes(uppercaseQuery);
                          const matchesRoom = uppercaseQuery && sec.room?.toUpperCase().includes(uppercaseQuery);

                          return (
                            <div
                              key={sec.id || `${sec.course_code}-${sec.section_number}`}
                              id={`section-card-${sec.course_code}-${sec.section_number}`}
                              className={`p-3 rounded-xl border flex flex-col justify-between gap-2 transition-all ${
                                isEnrolled
                                  ? 'bg-emerald-950/30 border-emerald-500/50 shadow-sm'
                                  : isFull
                                  ? 'bg-surface-850/80 border-rose-500/30'
                                  : 'bg-surface-850 border-surface-700/60 hover:border-surface-600'
                              } ${matchesFaculty || matchesRoom ? 'ring-1 ring-brand-400/60' : ''}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-xs text-white">
                                    Section {sec.section_number}
                                  </span>
                                  {sec.room && sec.room !== 'TBA' && (
                                    <span className={`text-[11px] flex items-center gap-0.5 px-1.5 py-0.2 rounded ${
                                      matchesRoom ? 'bg-brand-500/30 text-brand-300 font-bold' : 'text-slate-400 bg-surface-800'
                                    }`}>
                                      <MapPin className="w-3 h-3 text-slate-400" />
                                      {sec.room}
                                    </span>
                                  )}
                                  {matchesFaculty && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                                      Faculty Match
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
                                  <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                                  <span>
                                    {sec.raw_time || `${sec.day_of_week} ${sec.start_time?.slice(0, 5)} - ${sec.end_time?.slice(0, 5)}`}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3 text-slate-500 shrink-0" />
                                  <span className={`truncate font-medium ${matchesFaculty ? 'text-cyan-300 font-bold' : 'text-slate-300'}`}>
                                    Faculty: {sec.faculty_name || 'TBA'}
                                  </span>
                                </div>
                              </div>

                              {/* Simulate / Action Button */}
                              <div className="pt-2 border-t border-surface-800 flex items-center justify-between gap-2">
                                <div className="text-[10px] text-slate-500">
                                  Cap: {sec.capacity || 35}
                                </div>

                                {isEnrolled ? (
                                  <button
                                    onClick={() => dropSection(sec.id || `${sec.course_code}-${sec.section_number}`)}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition-colors cursor-pointer"
                                  >
                                    Drop Section
                                  </button>
                                ) : (
                                  <button
                                    id={`simulate-btn-${sec.course_code}-${sec.section_number}`}
                                    onClick={() => handleSimulate(sec.course_code, sec.section_number)}
                                    disabled={isSimulating}
                                    className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                      isFull
                                        ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                                        : 'bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 border border-brand-500/40'
                                    }`}
                                  >
                                    {isSimulating ? (
                                      <span>Simulating...</span>
                                    ) : (
                                      <>
                                        <Plus className="w-3 h-3" />
                                        <span>{isFull ? 'Simulate (Full)' : 'Simulate Add'}</span>
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
            })}

            {/* Pagination / Load More Footer */}
            {filteredCourses.length > visibleCount && (
              <div className="text-center pt-2 pb-4">
                <button
                  onClick={() => setVisibleCount((prev) => prev + 30)}
                  className="px-4 py-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-slate-200 border border-surface-700 text-xs font-bold transition-all cursor-pointer shadow-sm hover:text-white"
                >
                  Show More Courses (Showing {visibleCount} of {filteredCourses.length})
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
