'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '../../components/Header';
import { FallbackBanner } from '../../components/FallbackBanner';
import { DagVisualizer } from '../../components/DagVisualizer';
import { CourseSearchPanel } from '../../components/CourseSearchPanel';
import { CurrentSchedule } from '../../components/CurrentSchedule';
import { useScheduleStore } from '../../store/useScheduleStore';
import { Smartphone, Monitor, Zap, RefreshCw, Radio, CheckCircle, ArrowRightLeft } from 'lucide-react';

export default function SplitSyncPage() {
  const { init, enrolledSections, dropSection, simulateAddSection, wsConnected } = useScheduleStore();
  const [mobileUrl, setMobileUrl] = useState('http://localhost:8081');
  const [lastAction, setLastAction] = useState<string>('Ready for cross-device sync test');
  const [syncTimestamp, setSyncTimestamp] = useState<string>('');

  useEffect(() => {
    init();
    setSyncTimestamp(new Date().toLocaleTimeString());
  }, [init]);

  const handleQuickDropWeb = (courseCode: string) => {
    const sec = enrolledSections.find((s) => s.course_code === courseCode);
    if (sec) {
      dropSection(sec.id);
      setLastAction(`Dropped ${courseCode} on Web Dashboard → Sent SCHEDULE_SYNC`);
      setSyncTimestamp(new Date().toLocaleTimeString());
    }
  };

  const handleSimulateFallback = async () => {
    setLastAction('Triggering Full Section simulation (CSE311 §3)...');
    await simulateAddSection('CSE311', 3);
    setLastAction('Broadcasted FALLBACK_PROPOSED event to Web & Mobile Observers');
    setSyncTimestamp(new Date().toLocaleTimeString());
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Banner: Cross-Device Observer Test Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <ArrowRightLeft className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">Observer Cross-Device Live Synchronizer</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ACTIVE WEBSOCKET
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Left: Next.js Web App (Port 3000) • Right: React Native Mobile Client (Port 8081)
            </p>
          </div>
        </div>

        {/* Action Controls for Testing */}
        <div className="flex items-center gap-2">
          <button
            id="test-drop-cse332-btn"
            onClick={() => handleQuickDropWeb('CSE332')}
            className="px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <span>🗑️ Drop CSE332 (Web)</span>
          </button>

          <button
            id="test-simulate-fallback-btn"
            onClick={handleSimulateFallback}
            className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>🚨 Simulate Emergency Full Section</span>
          </button>

          <div className="h-6 w-px bg-slate-800 mx-1" />

          <div className="text-right">
            <span className="text-[11px] font-mono text-emerald-400 block">{lastAction}</span>
            <span className="text-[10px] text-slate-500 block">Sync clock: {syncTimestamp}</span>
          </div>
        </div>
      </div>

      {/* Main Split-Screen View */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-6 p-6 overflow-hidden">
        {/* Left Column (7 cols): Web App Dashboard */}
        <div className="xl:col-span-7 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-2xl">
          <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Monitor className="w-4 h-4 text-brand-400" />
              <span>Web Client (Desktop Workspace)</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>ws://localhost:5000/ws</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[calc(100vh-140px)]">
            <FallbackBanner />
            <DagVisualizer />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CurrentSchedule />
              <CourseSearchPanel />
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Mobile Emulator Chassis */}
        <div className="xl:col-span-5 flex flex-col items-center justify-start rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-2xl">
          <div className="w-full flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>Mobile Client ("On-The-Go Emergency Dashboard")</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
              Port 8081
            </span>
          </div>

          {/* Smartphone Hardware Frame */}
          <div
            id="mobile-phone-frame"
            className="w-full max-w-[390px] h-[780px] bg-slate-950 rounded-[48px] border-[6px] border-slate-700 shadow-2xl relative overflow-hidden flex flex-col ring-1 ring-white/10"
          >
            {/* Top Phone Notch / Dynamic Island */}
            <div className="w-full h-7 bg-slate-950 flex items-center justify-center relative z-20">
              <div className="w-24 h-4 bg-black rounded-full flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-900" />
                <div className="w-1.5 h-1.5 rounded-full bg-blue-900/50" />
              </div>
            </div>

            {/* Embedded Mobile React Native App */}
            <iframe
              id="mobile-app-iframe"
              src={mobileUrl}
              className="w-full flex-1 border-0 bg-slate-950"
              title="Mobile Client"
            />

            {/* Bottom Home Indicator Bar */}
            <div className="w-full h-5 bg-slate-950 flex items-center justify-center">
              <div className="w-32 h-1 bg-slate-600 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
