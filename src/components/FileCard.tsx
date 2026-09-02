import React from 'react';
import { 
  FileText, 
  Download, 
  Eye, 
  Settings, 
  Play, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Gauge, 
  Sparkles,
  RefreshCw,
  FileCheck
} from 'lucide-react';
import { QueueItem } from '../types';
import { formatBytes, formatDuration } from '../services/converterEngine';

interface FileCardProps {
  item: QueueItem;
  onConvert: (id: string) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onDownload: (item: QueueItem) => void;
  onPreview: (item: QueueItem) => void;
  onOpenSettings: (item: QueueItem) => void;
}

export const FileCard: React.FC<FileCardProps> = ({
  item,
  onConvert,
  onCancel,
  onRemove,
  onDownload,
  onPreview,
  onOpenSettings,
}) => {
  const isConverting = item.status === 'reading' || item.status === 'extracting' || item.status === 'generating';
  const isCompleted = item.status === 'completed' && item.result;

  // Calculate speed if completed
  let speedLabel: string | null = null;
  if (isCompleted && item.result) {
    const sec = item.result.durationMs / 1000;
    if (sec > 0) {
      const pgsPerSec = (item.result.pageCount / sec).toFixed(1);
      speedLabel = `${pgsPerSec} pgs/s (${formatDuration(item.result.durationMs)})`;
    }
  }

  // Get preview thumbnail from result or placeholder
  const thumbnail = item.result?.extractedPages?.[0]?.thumbnailUrl;

  return (
    <div
      id={`file-card-${item.id}`}
      className={`relative rounded-xl border transition-all duration-200 overflow-hidden p-4 sm:p-5 ${
        isCompleted
          ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/20 dark:bg-slate-800/80 shadow-md shadow-emerald-500/5'
          : isConverting
          ? 'border-blue-300 dark:border-blue-500/50 bg-blue-50/20 dark:bg-slate-800/90 shadow-md shadow-blue-500/10'
          : item.status === 'error'
          ? 'border-red-200 dark:border-red-500/40 bg-red-50/20 dark:bg-slate-800/60'
          : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-600 shadow-xs dark:shadow-none'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left: Thumbnail & Document Info */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {/* Thumbnail / Icon */}
          <div className="relative w-12 h-14 sm:w-14 sm:h-16 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden group/thumb">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt="Document preview"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex flex-col items-center justify-center">
                <FileText className="w-6 h-6 text-rose-500 dark:text-rose-400" />
                <span className="text-[9px] font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider mt-0.5">PDF</span>
              </div>
            )}
            {isCompleted && (
              <div className="absolute inset-0 bg-emerald-900/20 dark:bg-emerald-950/40 flex items-center justify-center backdrop-blur-[1px]">
                <FileCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate" title={item.name}>
                {item.name}
              </h3>
              
              {/* Status Badge */}
              {isCompleted ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 shrink-0">
                  <CheckCircle2 className="w-3 h-3" />
                  Ready
                </span>
              ) : isConverting ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 shrink-0 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {item.status === 'reading' ? 'Loading' : item.status === 'extracting' ? 'Extracting' : 'Generating DOCX'}
                </span>
              ) : item.status === 'error' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30 shrink-0">
                  <AlertCircle className="w-3 h-3" />
                  Error
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 shrink-0">
                  Queued
                </span>
              )}
            </div>

            {/* Sub-meta */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span>{formatBytes(item.size)}</span>
              {item.totalPages > 0 && (
                <>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span>{item.totalPages} {item.totalPages === 1 ? 'page' : 'pages'}</span>
                </>
              )}
              {isCompleted && item.result && (
                <>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    Word: {formatBytes(item.result.fileSizeBytes)}
                  </span>
                </>
              )}
              {speedLabel && (
                <>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-300 font-mono text-[11px]">
                    <Gauge className="w-3 h-3" />
                    {speedLabel}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-center shrink-0">
          {/* Settings button */}
          <button
            id={`btn-file-settings-${item.id}`}
            onClick={() => onOpenSettings(item)}
            disabled={isConverting}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 shadow-xs dark:shadow-none"
            title="Configure settings for this document"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Preview button (if completed) */}
          {isCompleted && (
            <button
              id={`btn-file-preview-${item.id}`}
              onClick={() => onPreview(item)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-xs font-medium shadow-xs dark:shadow-none"
              title="Preview extracted layout"
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Preview</span>
            </button>
          )}

          {/* Convert or Download button */}
          {isCompleted ? (
            <button
              id={`btn-file-download-${item.id}`}
              onClick={() => onDownload(item)}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download .DOCX</span>
            </button>
          ) : isConverting ? (
            <button
              id={`btn-file-cancel-${item.id}`}
              onClick={() => onCancel(item.id)}
              className="px-3 py-2 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/20 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          ) : (
            <button
              id={`btn-file-convert-${item.id}`}
              onClick={() => onConvert(item.id)}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all"
            >
              {item.status === 'error' ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Convert</span>
                </>
              )}
            </button>
          )}

          {/* Remove from queue */}
          {!isConverting && (
            <button
              id={`btn-file-remove-${item.id}`}
              onClick={() => onRemove(item.id)}
              className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress & Live status bar */}
      {isConverting && (
        <div className="mt-3 pt-3 border-t border-slate-700/60">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-300 font-mono text-[11px] truncate flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
              {item.currentStepMessage || 'Processing...'}
            </span>
            <span className="text-blue-400 font-mono font-semibold shrink-0 ml-2">
              {item.progress}%
            </span>
          </div>

          {/* Progress bar line */}
          <div className="w-full h-1.5 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 rounded-full"
              style={{ width: `${Math.max(5, item.progress)}%` }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {item.status === 'error' && item.error && (
        <div className="mt-3 pt-3 border-t border-red-500/20 text-xs text-red-300 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
          <span className="truncate">{item.error}</span>
        </div>
      )}
    </div>
  );
};
