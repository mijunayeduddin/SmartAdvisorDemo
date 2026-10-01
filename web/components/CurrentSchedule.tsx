'use client';

import React from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { Calendar, Trash2, Clock, MapPin, User, CheckCircle2, AlertTriangle, BookOpen } from 'lucide-react';

export const CurrentSchedule: React.FC = () => {
  const { enrolledSections, dropSection, criticalPath } = useScheduleStore();

  const totalCredits = enrolledSections.reduce((acc, sec) => {
    return acc + Number(sec.course_credits || 3);
  }, 0);

  return (
    <div className="glass-panel rounded-2xl p-5 border border-surface-700/60 flex flex-col h-full">
      {/* Schedule Header */}
      <div className="flex items-center justify-between pb-3 border-b border-surface-800">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            Simulated Fall 2026 Schedule
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Active registration draft with real-time seat validation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-xl bg-surface-800 text-xs text-slate-300 font-semibold border border-surface-700">
            {enrolledSections.length} Sections
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-brand-600/20 text-brand-300 text-xs font-bold border border-brand-500/30">
            {totalCredits} Credits
          </span>
        </div>
      </div>

      {/* Enrolled Sections List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 my-3.5 pr-1 max-h-[400px]">
        {enrolledSections.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-xl border border-dashed border-surface-800 bg-surface-900/30">
            <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-400">No courses in simulated schedule</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Search for courses on the left or click on any section to simulate registration.
            </p>
          </div>
        ) : (
          enrolledSections.map((sec) => {
            const isCritical = criticalPath.includes(sec.course_code);

            return (
              <div
                key={sec.id || `${sec.course_code}-${sec.section_number}`}
                id={`enrolled-card-${sec.course_code}`}
                className="p-3.5 rounded-xl border border-surface-700 bg-surface-850/90 flex items-center justify-between gap-3 transition-all hover:border-surface-600"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-white">
                      {sec.course_code} §{sec.section_number}
                    </span>
                    <span className="text-xs text-slate-400 truncate max-w-[180px]">
                      {sec.course_title}
                    </span>

                    {isCritical && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-400/20 text-amber-300 border border-amber-500/30">
                        Critical
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1.5 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {sec.day_of_week} {sec.start_time?.slice(0, 5)} - {sec.end_time?.slice(0, 5)}
                    </span>
                    {sec.faculty_name && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-500" />
                        {sec.faculty_name}
                      </span>
                    )}
                    {sec.room && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {sec.room}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                    {sec.seats_available} open
                  </span>
                  <button
                    id={`drop-btn-${sec.course_code}`}
                    onClick={() => dropSection(sec.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
                    title="Drop section"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Graduation Target Status */}
      <div className="pt-3 border-t border-surface-800 flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Recommended Load: 12-15 credits</span>
        </span>
        <span className="text-slate-500">Degree Target: 130 credits</span>
      </div>
    </div>
  );
};
