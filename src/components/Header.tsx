import React from 'react';
import { 
  FileText, 
  ShieldCheck, 
  Settings, 
  Play, 
  Download, 
  Trash2, 
  Zap,
  LayoutGrid,
  ChevronRight
} from 'lucide-react';
import { QueueItem } from '../types';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  queue: QueueItem[];
  onOpenSettings: () => void;
  onConvertAll: () => void;
  onDownloadAllZip: () => void;
  onClearQueue: () => void;
  isConvertingAny: boolean;
  onNavigateToDashboard?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  queue,
  onOpenSettings,
  onConvertAll,
  onDownloadAllZip,
  onClearQueue,
  isConvertingAny,
  onNavigateToDashboard,
}) => {
  const idleCount = queue.filter((i) => i.status === 'idle' || i.status === 'error').length;
  const completedCount = queue.filter((i) => i.status === 'completed' && i.result).length;

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur sticky top-0 z-30 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Breadcrumbs */}
        <div className="flex items-center gap-3">
          {onNavigateToDashboard && (
            <button
              id="btn-back-to-dashboard"
              onClick={onNavigateToDashboard}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 text-xs font-medium transition-all group"
              title="Return to Apps Dashboard"
            >
              <LayoutGrid className="w-4 h-4 text-blue-500 dark:text-blue-400 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
          )}

          {onNavigateToDashboard && (
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-600 hidden sm:block" />
          )}

          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 ring-1 ring-white/10 shrink-0">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                PDF <span className="text-blue-600 dark:text-blue-400 font-mono text-xs px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">to DOCX</span>
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                <ShieldCheck className="w-3 h-3" />
                <span className="hidden xs:inline">100% In-Browser</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden md:block">
              High-performance client-side document conversion with streaming large file support
            </p>
          </div>
        </div>

        {/* Global Actions (Top Right) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Dark / Light Mode Toggle Button */}
          <ThemeToggle variant="button" />

          {/* Settings button */}
          <button
            id="btn-global-settings"
            onClick={onOpenSettings}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors flex items-center gap-1.5 text-xs font-medium shadow-xs"
            title="Conversion Settings"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden md:inline">Settings</span>
          </button>

          {queue.length > 0 && (
            <>
              {/* Clear button */}
              <button
                id="btn-clear-queue"
                onClick={onClearQueue}
                disabled={isConvertingAny}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-200 dark:hover:border-red-500/20 transition-colors flex items-center gap-1.5 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                title="Clear file queue"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden lg:inline">Clear</span>
              </button>

              {/* Download All ZIP */}
              {completedCount > 0 && (
                <button
                  id="btn-download-all-zip"
                  onClick={onDownloadAllZip}
                  className="px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 hover:text-indigo-900 dark:hover:text-white transition-all flex items-center gap-1.5 text-xs font-medium shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Download All ({completedCount})</span>
                </button>
              )}

              {/* Convert All */}
              {idleCount > 0 && (
                <button
                  id="btn-convert-all"
                  onClick={onConvertAll}
                  disabled={isConvertingAny}
                  className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConvertingAny ? (
                    <>
                      <Zap className="w-4 h-4 animate-spin" />
                      <span>Converting...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Convert All ({idleCount})</span>
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
};

