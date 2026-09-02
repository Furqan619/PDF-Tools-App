import React from 'react';
import { 
  FileStack, 
  CheckCircle, 
  HardDrive, 
  Zap, 
  Clock, 
  Layers
} from 'lucide-react';
import { ProcessingMetrics } from '../types';
import { formatBytes } from '../services/converterEngine';

interface StatsBarProps {
  metrics: ProcessingMetrics;
}

export const StatsBar: React.FC<StatsBarProps> = ({ metrics }) => {
  if (metrics.totalFiles === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-xs dark:shadow-none transition-colors">
        <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
          <FileStack className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Total Documents</div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            {metrics.completedFiles} / {metrics.totalFiles} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">files</span>
          </div>
        </div>
      </div>

      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-xs dark:shadow-none transition-colors">
        <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
          <Layers className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Pages Processed</div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            {metrics.totalPagesProcessed} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">pages</span>
          </div>
        </div>
      </div>

      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-xs dark:shadow-none transition-colors">
        <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
          <HardDrive className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Data Converted</div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            {formatBytes(metrics.totalBytesProcessed)}
          </div>
        </div>
      </div>

      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-xs dark:shadow-none transition-colors">
        <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
          <Zap className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Average Velocity</div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            {metrics.averageSpeedPagesPerSec > 0 ? `${metrics.averageSpeedPagesPerSec} pgs/sec` : '—'}
          </div>
        </div>
      </div>
    </div>
  );
};
