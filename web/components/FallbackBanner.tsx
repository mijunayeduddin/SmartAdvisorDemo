'use client';

import React from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { AlertTriangle, CheckCircle, XCircle, ArrowRight, ShieldCheck, Sparkles, Clock, MapPin, User } from 'lucide-react';

export const FallbackBanner: React.FC = () => {
  const { fallbackProposal, acceptFallback, rejectFallback } = useScheduleStore();

  if (!fallbackProposal) return null;

  const { requested, alternative, strategyUsed } = fallbackProposal;
  const isNoAlt = fallbackProposal.status === 'NO_ALTERNATIVE' || !alternative;

  return (
    <div
      id="fallback-banner"
      className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-surface-850 to-surface-850 p-5 shadow-glow-critical backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-300 mb-6"
    >
      {/* Ambient background glow */}
      <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Side: Header & Alert */}
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5 animate-bounce-slight" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                0 Seats Available
              </span>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                {strategyUsed || 'Smart Fallback Router'}
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-white mt-1" id="fallback-banner-title">
              <span className="text-amber-400">
                {requested.courseCode} §{requested.sectionNumber || 1}
              </span>{' '}
              is full — here&apos;s your best alternative
            </h3>

            {alternative ? (
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {alternative.rationale}
              </p>
            ) : (
              <p className="text-xs text-rose-300 mt-1">
                All sections for this requirement are currently filled or produce schedule conflicts.
              </p>
            )}
          </div>
        </div>

        {/* Right Side: Alternative Card & Actions */}
        {alternative && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-surface-900/80 p-3.5 rounded-xl border border-surface-700/60 lg:min-w-[420px]">
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-white text-sm flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">
                    {alternative.courseCode} §{alternative.sectionNumber}
                  </span>
                  <span className="text-slate-400 text-xs truncate max-w-[140px]">
                    {alternative.title}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                  {alternative.seatsAvailable} seats open
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  {alternative.dayOfWeek} {alternative.startTime?.slice(0, 5)}-{alternative.endTime?.slice(0, 5)}
                </span>
                {alternative.facultyName && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-500" />
                    {alternative.facultyName}
                  </span>
                )}
                {alternative.room && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-500" />
                    {alternative.room}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 sm:border-l border-surface-700 sm:pl-3">
              <button
                id="accept-fallback-btn"
                onClick={acceptFallback}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-glow-emerald cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Accept</span>
              </button>
              <button
                id="reject-fallback-btn"
                onClick={rejectFallback}
                className="flex items-center justify-center p-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Dismiss"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {isNoAlt && (
          <button
            onClick={rejectFallback}
            className="px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 text-slate-300 text-xs self-start lg:self-center"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};
