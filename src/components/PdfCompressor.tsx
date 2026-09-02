import React, { useState, useRef } from 'react';
import {
  Minimize2,
  Upload,
  FileText,
  Trash2,
  Download,
  Eye,
  Sliders,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LayoutGrid,
  Zap,
  Sparkles,
  Archive,
  TrendingDown,
  Lock,
  ArrowRight,
  SplitSquareVertical,
  X,
  FilePlus
} from 'lucide-react';
import {
  CompressionPreset,
  CompressionSettings,
  CompressFileItem,
  PRESET_CONFIGS,
  compressPdfDocument,
  downloadCompressedPdf,
  downloadAllCompressedZip
} from '../services/pdfCompressor';
import { pdfjsLib } from '../services/pdfWorker';
import { ThemeToggle } from './ThemeToggle';

interface PdfCompressorProps {
  onNavigateToDashboard: () => void;
}

export const PdfCompressor: React.FC<PdfCompressorProps> = ({ onNavigateToDashboard }) => {
  const [queue, setQueue] = useState<CompressFileItem[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<CompressionPreset>('recommended');
  const [customSettings, setCustomSettings] = useState<CompressionSettings>({
    preset: 'custom',
    scale: 1.2,
    quality: 0.65,
    grayscale: false,
    stripMetadata: true,
    maxDimension: 1600,
  });
  const [isProcessingAny, setIsProcessingAny] = useState(false);
  const [comparisonItem, setComparisonItem] = useState<CompressFileItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSettings =
    selectedPreset === 'custom' ? customSettings : PRESET_CONFIGS[selectedPreset];

  const formatBytes = (bytes?: number) => {
    if (bytes === undefined || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Add files to queue
  const handleFilesSelected = async (files: FileList | File[]) => {
    const pdfFiles = Array.from(files).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (pdfFiles.length === 0) return;

    const newItems: CompressFileItem[] = [];

    for (const file of pdfFiles) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        const totalPages = pdf.numPages;

        newItems.push({
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          name: file.name,
          originalSize: file.size,
          totalPages,
          status: 'queued',
          progress: 0,
        });
      } catch (err) {
        console.error('Error reading PDF pages:', err);
      }
    }

    setQueue((prev) => [...prev, ...newItems]);
  };

  // Process a single item
  const processItem = async (itemId: string, settings: CompressionSettings) => {
    const item = queue.find((it) => it.id === itemId);
    if (!item || item.status === 'processing') return;

    setQueue((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, status: 'processing', progress: 5, statusText: 'Initializing optimization...' }
          : it
      )
    );

    try {
      const result = await compressPdfDocument(item.file, settings, (progress, statusText) => {
        setQueue((prev) =>
          prev.map((it) => (it.id === itemId ? { ...it, progress, statusText } : it))
        );
      });

      setQueue((prev) =>
        prev.map((it) =>
          it.id === itemId
            ? {
                ...it,
                status: 'completed',
                progress: 100,
                statusText: 'Compressed successfully',
                compressedSize: result.compressedSize,
                compressedData: result.data,
                durationMs: result.durationMs,
                previewOriginalUrl: result.previewUrls?.original,
                previewCompressedUrl: result.previewUrls?.compressed,
              }
            : it
        )
      );
    } catch (err: any) {
      setQueue((prev) =>
        prev.map((it) =>
          it.id === itemId
            ? {
                ...it,
                status: 'error',
                error: err.message || 'Compression failed',
                statusText: 'Failed',
              }
            : it
        )
      );
    }
  };

  // Process all queued items sequentially
  const handleCompressAll = async () => {
    const queuedItems = queue.filter((it) => it.status === 'queued' || it.status === 'error');
    if (queuedItems.length === 0) return;

    setIsProcessingAny(true);

    for (const item of queuedItems) {
      await processItem(item.id, activeSettings);
    }

    setIsProcessingAny(false);
  };

  // Download single item
  const handleDownloadItem = (item: CompressFileItem) => {
    if (!item.compressedData) return;
    const outputName = item.name.replace(/\.pdf$/i, '_optimized.pdf');
    downloadCompressedPdf(item.compressedData, outputName);
  };

  // Download all as ZIP
  const handleDownloadAll = () => {
    downloadAllCompressedZip(queue);
  };

  // Clear queue
  const handleClearQueue = () => {
    setQueue([]);
  };

  // Remove single item
  const handleRemoveItem = (id: string) => {
    setQueue((prev) => prev.filter((it) => it.id !== id));
  };

  // Compute aggregate stats
  const completedItems = queue.filter((it) => it.status === 'completed' && it.compressedSize);
  const totalOriginalBytes = completedItems.reduce((acc, it) => acc + it.originalSize, 0);
  const totalCompressedBytes = completedItems.reduce((acc, it) => acc + (it.compressedSize || 0), 0);
  const totalSavedBytes = Math.max(0, totalOriginalBytes - totalCompressedBytes);
  const totalSavedPercentage =
    totalOriginalBytes > 0 ? ((totalSavedBytes / totalOriginalBytes) * 100).toFixed(1) : '0';

  return (
    <div className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Top Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur sticky top-0 z-30 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateToDashboard}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 text-xs font-medium transition-all group"
            >
              <LayoutGrid className="w-4 h-4 text-amber-500 dark:text-amber-400 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>

            <span className="text-slate-400 dark:text-slate-600 hidden sm:inline">/</span>

            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md shadow-amber-500/20 ring-1 ring-white/10 shrink-0">
              <Minimize2 className="w-4 h-4 text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  PDF <span className="text-amber-600 dark:text-amber-400 font-mono text-xs px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">Compressor</span>
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                  <Lock className="w-3 h-3" />
                  <span className="hidden xs:inline">100% In-Browser</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden md:block">
                High-performance PDF size reduction, image resampling, stream optimization & visual comparison
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {completedItems.length > 0 && (
              <button
                onClick={handleDownloadAll}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Download All ({completedItems.length} ZIP)</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Preset Selector Card */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-md dark:shadow-lg dark:shadow-black/20 space-y-4 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                Compression Level & Quality Presets
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Choose an optimization profile or configure precision quality parameters.
              </p>
            </div>

            {selectedPreset !== 'custom' && (
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-amber-600 dark:text-amber-400 font-mono self-start sm:self-auto">
                {selectedPreset === 'extreme' && 'DPI ~90 • Quality 48% • Metadata Stripped'}
                {selectedPreset === 'recommended' && 'DPI ~135 • Quality 72% • Metadata Stripped'}
                {selectedPreset === 'low' && 'DPI ~180 • Quality 88% • Lossless Retention'}
              </span>
            )}
          </div>

          {/* Preset Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Extreme */}
            <div
              onClick={() => setSelectedPreset('extreme')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                selectedPreset === 'extreme'
                  ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/70 ring-2 ring-amber-500/30 shadow-md shadow-amber-500/10'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    Extreme Compression
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 font-semibold">
                    ~75% Smaller
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5">
                  Smallest file size. Ideal for strict email attachment limits and low-bandwidth web sharing.
                </p>
              </div>
            </div>

            {/* Recommended */}
            <div
              onClick={() => setSelectedPreset('recommended')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                selectedPreset === 'recommended'
                  ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/70 ring-2 ring-amber-500/30 shadow-md shadow-amber-500/10'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    Recommended
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold">
                    ~50% Smaller
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5">
                  Optimal balance between sharp visual quality and substantial file size savings.
                </p>
              </div>
            </div>

            {/* Low */}
            <div
              onClick={() => setSelectedPreset('low')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                selectedPreset === 'low'
                  ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/70 ring-2 ring-amber-500/30 shadow-md shadow-amber-500/10'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    High Quality
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-semibold">
                    ~25% Smaller
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5">
                  Preserves highest visual clarity and vector sharpness. Recommended for documents meant to be printed.
                </p>
              </div>
            </div>

            {/* Custom */}
            <div
              onClick={() => setSelectedPreset('custom')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                selectedPreset === 'custom'
                  ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/70 ring-2 ring-amber-500/30 shadow-md shadow-amber-500/10'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    Custom Settings
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-semibold">
                    Manual
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5">
                  Fine-tune resolution scaling, JPEG quality, metadata stripping, and monochrome mode.
                </p>
              </div>
            </div>
          </div>

          {/* Custom Settings Sub-Panel */}
          {selectedPreset === 'custom' && (
            <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn">
              {/* Quality Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">JPEG Quality:</span>
                  <span className="text-amber-600 dark:text-amber-400 font-mono">{Math.round(customSettings.quality * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="95"
                  value={Math.round(customSettings.quality * 100)}
                  onChange={(e) =>
                    setCustomSettings((prev) => ({ ...prev, quality: parseInt(e.target.value, 10) / 100 }))
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Scale Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Resolution Multiplier:</span>
                  <span className="text-amber-600 dark:text-amber-400 font-mono">{(customSettings.scale * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="200"
                  step="10"
                  value={Math.round(customSettings.scale * 100)}
                  onChange={(e) =>
                    setCustomSettings((prev) => ({ ...prev, scale: parseInt(e.target.value, 10) / 100 }))
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Grayscale Toggle */}
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer self-center">
                <input
                  type="checkbox"
                  checked={customSettings.grayscale}
                  onChange={(e) => setCustomSettings((prev) => ({ ...prev, grayscale: e.target.checked }))}
                  className="rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 w-4 h-4"
                />
                <span>Convert to Grayscale (Scanned Documents)</span>
              </label>

              {/* Strip Metadata Toggle */}
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer self-center">
                <input
                  type="checkbox"
                  checked={customSettings.stripMetadata}
                  onChange={(e) => setCustomSettings((prev) => ({ ...prev, stripMetadata: e.target.checked }))}
                  className="rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 w-4 h-4"
                />
                <span>Strip Unused Metadata & Objects</span>
              </label>
            </div>
          )}
        </div>

        {/* Drag & Drop Zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleFilesSelected(e.dataTransfer.files);
            }
          }}
          className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500/60 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-2xl p-8 text-center cursor-pointer transition-all space-y-3 group shadow-xs dark:shadow-none"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFilesSelected(e.target.files);
            }}
          />
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
            <FilePlus className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Drop PDF documents here to compress, or <span className="text-amber-600 dark:text-amber-400 underline">browse</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Supports single and batch processing. All operations take place 100% inside your local browser.
            </p>
          </div>
        </div>

        {/* Performance & Savings Metric Bar */}
        {completedItems.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fadeIn">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center gap-3 shadow-sm dark:shadow-md transition-colors">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <TrendingDown className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Space Saved</div>
                <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {formatBytes(totalSavedBytes)} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(-{totalSavedPercentage}%)</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center gap-3 shadow-sm dark:shadow-md transition-colors">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Original → Compressed Size</div>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {formatBytes(totalOriginalBytes)} → <span className="text-amber-600 dark:text-amber-400 font-bold">{formatBytes(totalCompressedBytes)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center gap-3 shadow-sm dark:shadow-md transition-colors">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Optimization Status</div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  {completedItems.length} of {queue.length} files compressed
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Compression Queue Table */}
        {queue.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400">
                  Compression Queue ({queue.length} items)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearQueue}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-medium transition-colors"
                >
                  Clear Queue
                </button>

                <button
                  onClick={handleCompressAll}
                  disabled={isProcessingAny || queue.every((it) => it.status === 'completed')}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                >
                  {isProcessingAny ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Optimizing Queue...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Compress All Files</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {queue.map((item) => {
                const isCompleted = item.status === 'completed';
                const isProcessing = item.status === 'processing';
                const isError = item.status === 'error';
                const reductionPercent =
                  isCompleted && item.compressedSize
                    ? (((item.originalSize - item.compressedSize) / item.originalSize) * 100).toFixed(1)
                    : null;

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs dark:shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                  >
                    {/* File Meta */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isCompleted
                            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                            : isProcessing
                            ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                            : isError
                            ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                            : 'bg-slate-700/60 text-slate-300'
                        }`}
                      >
                        {isProcessing ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <FileText className="w-5 h-5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">{item.name}</div>
                        <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                          <span>{item.totalPages} pages</span>
                          <span>•</span>
                          <span>Original: {formatBytes(item.originalSize)}</span>

                          {isCompleted && item.compressedSize && (
                            <>
                              <ArrowRight className="w-3 h-3 text-slate-500" />
                              <span className="text-amber-400 font-bold">
                                Compressed: {formatBytes(item.compressedSize)}
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-semibold text-[10px]">
                                -{reductionPercent}%
                              </span>
                              {item.durationMs && (
                                <span className="text-slate-500 text-[10px]">({(item.durationMs / 1000).toFixed(1)}s)</span>
                              )}
                            </>
                          )}

                          {isError && <span className="text-red-400">{item.error}</span>}
                        </div>

                        {/* Progress line */}
                        {isProcessing && (
                          <div className="mt-2 space-y-1">
                            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-amber-500 to-orange-500 h-full transition-all duration-300"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-slate-400">{item.statusText}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      {/* Compare visual preview */}
                      {isCompleted && item.previewOriginalUrl && (
                        <button
                          onClick={() => setComparisonItem(item)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                          title="Visual quality comparison"
                        >
                          <SplitSquareVertical className="w-3.5 h-3.5 text-amber-400" />
                          <span className="hidden sm:inline">Compare</span>
                        </button>
                      )}

                      {/* Single Compress / Retry */}
                      {(item.status === 'queued' || item.status === 'error') && (
                        <button
                          onClick={() => processItem(item.id, activeSettings)}
                          disabled={isProcessingAny}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Compress</span>
                        </button>
                      )}

                      {/* Download */}
                      {isCompleted && (
                        <button
                          onClick={() => handleDownloadItem(item)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1.5 rounded-lg bg-slate-700/40 hover:bg-red-500/20 hover:text-red-400 text-slate-400 transition-colors"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Visual Side-by-Side Comparison Modal */}
      {comparisonItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <SplitSquareVertical className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  Visual Quality Inspection: {comparisonItem.name}
                </h3>
              </div>
              <button
                onClick={() => setComparisonItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Original Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">Original Page 1</span>
                  <span className="text-slate-400">{formatBytes(comparisonItem.originalSize)}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex items-center justify-center h-80 overflow-hidden">
                  {comparisonItem.previewOriginalUrl ? (
                    <img
                      src={comparisonItem.previewOriginalUrl}
                      alt="Original Preview"
                      className="max-h-full max-w-full object-contain rounded shadow"
                    />
                  ) : (
                    <span className="text-xs text-slate-500">Preview not available</span>
                  )}
                </div>
              </div>

              {/* Compressed Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-amber-400">Compressed Page 1</span>
                  <span className="text-emerald-400 font-bold">
                    {formatBytes(comparisonItem.compressedSize)} (
                    -
                    {(
                      ((comparisonItem.originalSize - (comparisonItem.compressedSize || 0)) /
                        comparisonItem.originalSize) *
                      100
                    ).toFixed(1)}
                    %)
                  </span>
                </div>
                <div className="bg-slate-950 p-2 rounded-xl border border-amber-500/30 flex items-center justify-center h-80 overflow-hidden ring-1 ring-amber-500/20">
                  {comparisonItem.previewCompressedUrl ? (
                    <img
                      src={comparisonItem.previewCompressedUrl}
                      alt="Compressed Preview"
                      className="max-h-full max-w-full object-contain rounded shadow"
                    />
                  ) : (
                    <span className="text-xs text-slate-500">Preview not available</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <span className="text-slate-400">
                Vector text metrics, image stream resampling, and page layout dimensions preserved.
              </span>
              <button
                onClick={() => {
                  handleDownloadItem(comparisonItem);
                  setComparisonItem(null);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 shadow-md transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Optimized File</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
