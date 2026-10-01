'use client';

import React, { useState, useEffect } from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { RefreshCw, Radio, Database } from 'lucide-react';

export const LiveSyncBadge: React.FC = () => {
  const { lastSyncedTimestamp, wsConnected, triggerManualSync } = useScheduleStore();
  const [secondsAgo, setSecondsAgo] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    const updateTicker = () => {
      if (!lastSyncedTimestamp) {
        setSecondsAgo(0);
        return;
      }
      const diffMs = Date.now() - new Date(lastSyncedTimestamp).getTime();
      setSecondsAgo(Math.max(0, Math.floor(diffMs / 1000)));
    };

    updateTicker();
    const interval = setInterval(updateTicker, 1000);
    return () => clearInterval(interval);
  }, [lastSyncedTimestamp]);

  const handleSync = async () => {
    setIsSyncing(true);
    await triggerManualSync();
    setTimeout(() => setIsSyncing(false), 600);
  };

  return (
    <div className="flex items-center gap-3 bg-surface-850/80 backdrop-blur border border-surface-700/60 rounded-xl px-3.5 py-1.5 text-xs text-slate-300">
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2.5 w-2.5">
          {wsConnected && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          <span
            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              wsConnected ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          ></span>
        </span>
        <span className="font-medium text-slate-300">
          {wsConnected ? 'WS Live' : 'Reconnecting'}
        </span>
      </div>

      <div className="h-3 w-[1px] bg-slate-700" />

      <div className="flex items-center gap-1.5" id="seats-sync-indicator">
        <Database className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-slate-300">
          Seats last synced{' '}
          <span className="font-semibold text-emerald-400" id="sync-timer-label">
            {secondsAgo}s ago
          </span>
        </span>
      </div>

      <button
        onClick={handleSync}
        disabled={isSyncing}
        title="Trigger immediate sync loop"
        className="flex items-center gap-1 text-slate-400 hover:text-cyan-300 transition-colors p-1 rounded hover:bg-surface-700/40"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-cyan-400' : ''}`} />
      </button>
    </div>
  );
};
