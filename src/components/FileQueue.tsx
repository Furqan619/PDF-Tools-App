import React, { useState } from 'react';
import { 
  FileStack, 
  CheckCircle2, 
  Clock, 
  Download, 
  Layers, 
  ArrowUpDown,
  Sparkles
} from 'lucide-react';
import { QueueItem } from '../types';
import { FileCard } from './FileCard';

interface FileQueueProps {
  queue: QueueItem[];
  onConvert: (id: string) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onDownload: (item: QueueItem) => void;
  onPreview: (item: QueueItem) => void;
  onOpenSettings: (item: QueueItem) => void;
  onDownloadAllZip: () => void;
}

type FilterTab = 'all' | 'queued' | 'completed';

export const FileQueue: React.FC<FileQueueProps> = ({
  queue,
  onConvert,
  onCancel,
  onRemove,
  onDownload,
  onPreview,
  onOpenSettings,
  onDownloadAllZip,
}) => {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const completedItems = queue.filter((i) => i.status === 'completed' && i.result);
  const queuedItems = queue.filter((i) => i.status !== 'completed');

  const displayedItems = queue.filter((item) => {
    if (activeTab === 'completed') return item.status === 'completed';
    if (activeTab === 'queued') return item.status !== 'completed';
    return true;
  });

  if (queue.length === 0) return null;

  return (
    <div className="w-full space-y-4">
      {/* Queue Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <FileStack className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Conversion Queue ({queue.length})
          </h2>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs self-start sm:self-auto shadow-xs dark:shadow-none">
          <button
            id="tab-filter-all"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            All ({queue.length})
          </button>
          <button
            id="tab-filter-queued"
            onClick={() => setActiveTab('queued')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeTab === 'queued'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Queued ({queuedItems.length})
          </button>
          <button
            id="tab-filter-completed"
            onClick={() => setActiveTab('completed')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeTab === 'completed'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Converted ({completedItems.length})
          </button>
        </div>
      </div>

      {/* List of File Cards */}
      <div className="space-y-3">
        {displayedItems.map((item) => (
          <FileCard
            key={item.id}
            item={item}
            onConvert={onConvert}
            onCancel={onCancel}
            onRemove={onRemove}
            onDownload={onDownload}
            onPreview={onPreview}
            onOpenSettings={onOpenSettings}
          />
        ))}
      </div>
    </div>
  );
};
