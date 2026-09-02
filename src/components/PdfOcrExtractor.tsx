import React, { useState, useRef, useEffect } from 'react';
import {
  ScanText,
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
  Copy,
  Check,
  Search,
  Maximize2,
  FileSearch,
  Globe,
  FileType,
  Layers,
  ChevronLeft,
  ChevronRight,
  Code,
  FilePlus,
  BookOpen,
  HelpCircle,
  FileDown,
  ShieldCheck,
  X
} from 'lucide-react';
import {
  OcrLanguage,
  OcrSettings,
  DEFAULT_OCR_SETTINGS,
  SUPPORTED_OCR_LANGUAGES,
  OcrDocumentItem,
  OcrPageResult,
  OcrBlock,
  processDocumentOcr,
  exportAsPlainText,
  exportAsMarkdown,
  exportAsJson,
  exportAsSearchablePdf,
  downloadAllOcrZip
} from '../services/ocrEngine';
import { pdfjsLib } from '../services/pdfWorker';
import { generateSamplePdfBlob } from '../services/sampleFiles';

interface PdfOcrExtractorProps {
  onNavigateToDashboard: () => void;
}

export const PdfOcrExtractor: React.FC<PdfOcrExtractorProps> = ({ onNavigateToDashboard }) => {
  const [queue, setQueue] = useState<OcrDocumentItem[]>([]);
  const [settings, setSettings] = useState<OcrSettings>(DEFAULT_OCR_SETTINGS);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [isProcessingAny, setIsProcessingAny] = useState(false);
  const [activeInspectorDoc, setActiveInspectorDoc] = useState<OcrDocumentItem | null>(null);
  const [inspectorPageIdx, setInspectorPageIdx] = useState(0);
  const [inspectorTab, setInspectorTab] = useState<'markdown' | 'text' | 'json'>('markdown');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [showPreprocessedScan, setShowPreprocessedScan] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Format bytes
  const formatBytes = (bytes?: number) => {
    if (bytes === undefined || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Add files to queue
  const handleFilesSelected = async (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(
      (f) =>
        f.type === 'application/pdf' ||
        f.name.toLowerCase().endsWith('.pdf') ||
        f.type.startsWith('image/') ||
        /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(f.name)
    );
    if (validFiles.length === 0) return;

    const newItems: OcrDocumentItem[] = [];

    for (const file of validFiles) {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      let totalPages = 1;

      if (isPdf) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
          totalPages = pdf.numPages;
        } catch (e) {
          totalPages = 1;
        }
      }

      newItems.push({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        name: file.name,
        size: file.size,
        totalPages,
        status: 'queued',
        progress: 0,
        pages: [],
        fullText: '',
        fullMarkdown: '',
        overallConfidence: 0,
        totalWords: 0,
        totalCharacters: 0,
        languageUsed: settings.language,
        settingsUsed: settings,
      });
    }

    setQueue((prev) => [...prev, ...newItems]);
  };

  // Load sample scanned invoice
  const handleLoadSampleDocument = () => {
    const sampleFile = generateSamplePdfBlob('scanned-invoice');
    handleFilesSelected([sampleFile]);
  };

  // Process a single item
  const processItem = async (itemId: string) => {
    const item = queue.find((it) => it.id === itemId);
    if (!item || item.status === 'processing') return;

    setQueue((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, status: 'processing', progress: 5, statusText: 'Initializing neural engine...' }
          : it
      )
    );

    try {
      const completedDoc = await processDocumentOcr(item.file, settings, (progress, statusText) => {
        setQueue((prev) =>
          prev.map((it) => (it.id === itemId ? { ...it, progress, statusText } : it))
        );
      });

      setQueue((prev) =>
        prev.map((it) => (it.id === itemId ? { ...completedDoc, id: it.id } : it))
      );
    } catch (err: any) {
      setQueue((prev) =>
        prev.map((it) =>
          it.id === itemId
            ? {
                ...it,
                status: 'error',
                error: err.message || 'OCR extraction failed',
                statusText: 'Failed',
              }
            : it
        )
      );
    }
  };

  // Process all queued items sequentially
  const handleProcessAll = async () => {
    const queuedItems = queue.filter((it) => it.status === 'queued' || it.status === 'error');
    if (queuedItems.length === 0) return;

    setIsProcessingAny(true);

    for (const item of queuedItems) {
      await processItem(item.id);
    }

    setIsProcessingAny(false);
  };

  // Copy active text to clipboard
  const handleCopyText = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2200);
  };

  // Compute aggregate stats
  const completedItems = queue.filter((it) => it.status === 'completed');
  const totalWordsCount = completedItems.reduce((acc, it) => acc + it.totalWords, 0);
  const totalPagesCount = completedItems.reduce((acc, it) => acc + it.totalPages, 0);
  const avgConfidence =
    completedItems.length > 0
      ? Math.round(
          completedItems.reduce((acc, it) => acc + it.overallConfidence, 0) / completedItems.length
        )
      : 0;

  // Active page for inspector
  const currentInspectorPage: OcrPageResult | undefined =
    activeInspectorDoc?.pages?.[inspectorPageIdx];

  // Search matches count
  const searchMatchesCount =
    searchQuery && activeInspectorDoc
      ? (
          activeInspectorDoc.fullText.toLowerCase().match(
            new RegExp(searchQuery.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
          ) || []
        ).length
      : 0;

  return (
    <div className="min-h-full flex flex-col bg-slate-900 text-slate-100 font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateToDashboard}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition-all group"
            >
              <LayoutGrid className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>

            <span className="text-slate-600 hidden sm:inline">/</span>

            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-violet-700 flex items-center justify-center shadow-md shadow-purple-500/20 ring-1 ring-white/10 shrink-0">
              <ScanText className="w-4 h-4 text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                  OCR Text <span className="text-purple-400 font-mono text-xs px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">& Layout Extractor</span>
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <ShieldCheck className="w-3 h-3" />
                  <span className="hidden xs:inline">100% In-Browser</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden md:block">
                Deep optical character recognition, layout structure parsing, markdown formatting & searchable PDF generation
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            {completedItems.length > 0 && (
              <button
                onClick={() => downloadAllOcrZip(completedItems)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-500/20 transition-all cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Export All ({completedItems.length} ZIP)</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* OCR Engine Settings & Language Bar */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-800/80 border border-slate-700/80 shadow-lg shadow-black/20 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Recognition Language & Processing Pipeline
                </h2>
                <p className="text-xs text-slate-400">
                  Select primary language model, processing mode, and image enhancements.
                </p>
              </div>
            </div>

            {/* Quick Sample Document Button */}
            <button
              onClick={handleLoadSampleDocument}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-purple-500/30 hover:border-purple-500/60 text-purple-300 text-xs font-medium transition-all shadow-sm self-start sm:self-auto cursor-pointer"
            >
              <FileSearch className="w-3.5 h-3.5 text-purple-400" />
              <span>Load Scanned Invoice Sample</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Language Selector */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-purple-400" />
                OCR Target Language:
              </label>
              <select
                value={settings.language}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, language: e.target.value as OcrLanguage }))
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                {SUPPORTED_OCR_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name} ({lang.nativeName})
                  </option>
                ))}
              </select>
            </div>

            {/* Processing Mode */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                Extraction Method:
              </label>
              <select
                value={settings.mode}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, mode: e.target.value as any }))
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="auto">⚡ Auto (Hybrid Neural & Layout)</option>
                <option value="tesseract">🧠 Force Deep Neural OCR</option>
                <option value="native">📐 Digital Vector Layout Layer</option>
              </select>
            </div>

            {/* DPI Scaling */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-purple-400" />
                Render Sampling Scale:
              </label>
              <select
                value={settings.scaleDpi}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, scaleDpi: parseFloat(e.target.value) }))
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="1.5">1.5x (Fastest - 108 DPI)</option>
                <option value="2.0">2.0x (Optimal Precision - 144 DPI)</option>
                <option value="2.5">2.5x (Ultra Precision - 180 DPI)</option>
              </select>
            </div>

            {/* Preprocessing Drawer Toggle */}
            <div className="flex items-end">
              <button
                onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
                className={`w-full py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  showSettingsDrawer
                    ? 'bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-500/20'
                    : 'bg-slate-900 border-slate-700 hover:border-slate-600 text-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-purple-400" />
                <span>{showSettingsDrawer ? 'Hide Filters' : 'Image Scan Filters'}</span>
              </button>
            </div>
          </div>

          {/* Preprocessing Sub-Panel */}
          {showSettingsDrawer && (
            <div className="pt-3 border-t border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-fadeIn">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={settings.preprocessing.enhanceContrast}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      preprocessing: { ...prev.preprocessing, enhanceContrast: e.target.checked },
                    }))
                  }
                  className="rounded bg-slate-800 border-slate-700 text-purple-600 focus:ring-purple-500 w-4 h-4"
                />
                <span>Contrast Stretch (1.4x)</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={settings.preprocessing.binarize}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      preprocessing: { ...prev.preprocessing, binarize: e.target.checked },
                    }))
                  }
                  className="rounded bg-slate-800 border-slate-700 text-purple-600 focus:ring-purple-500 w-4 h-4"
                />
                <span>Adaptive Binarization (B&W)</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={settings.preprocessing.grayscale}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      preprocessing: { ...prev.preprocessing, grayscale: e.target.checked },
                    }))
                  }
                  className="rounded bg-slate-800 border-slate-700 text-purple-600 focus:ring-purple-500 w-4 h-4"
                />
                <span>Grayscale Scan Normalization</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={settings.preprocessing.invert}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      preprocessing: { ...prev.preprocessing, invert: e.target.checked },
                    }))
                  }
                  className="rounded bg-slate-800 border-slate-700 text-purple-600 focus:ring-purple-500 w-4 h-4"
                />
                <span>Invert Dark / Blueprint Scan</span>
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
          className="border-2 border-dashed border-slate-700 hover:border-purple-500/60 bg-slate-800/40 hover:bg-slate-800/70 rounded-2xl p-8 text-center cursor-pointer transition-all space-y-3 group"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,application/pdf,image/png,image/jpeg,image/jpg,image/webp,image/bmp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFilesSelected(e.target.files);
            }}
          />
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
            <FilePlus className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              Drop scanned PDFs or document photos here, or <span className="text-purple-400 underline">browse</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Supports multi-page PDFs, PNG, JPG, WebP, and TIFF. All recognition models execute 100% inside your browser.
            </p>
          </div>
        </div>

        {/* Aggregate Stats Bar */}
        {completedItems.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fadeIn">
            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center gap-3 shadow-md">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-400">Total Words Extracted</div>
                <div className="text-base font-bold text-purple-400">
                  {totalWordsCount.toLocaleString()} <span className="text-xs font-normal text-slate-400">words across {totalPagesCount} pages</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center gap-3 shadow-md">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-400">Mean OCR Confidence</div>
                <div className="text-base font-bold text-emerald-400">
                  {avgConfidence}% <span className="text-xs font-normal text-slate-400">accuracy score</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center gap-3 shadow-md">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-400">Processed Documents</div>
                <div className="text-xs font-semibold text-white">
                  {completedItems.length} of {queue.length} ready for inspect & export
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Processing Queue Table */}
        {queue.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Extraction Queue ({queue.length} items)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQueue([])}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition-colors"
                >
                  Clear Queue
                </button>

                <button
                  onClick={handleProcessAll}
                  disabled={isProcessingAny || queue.every((it) => it.status === 'completed')}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-purple-500/20 transition-all cursor-pointer"
                >
                  {isProcessingAny ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Extracting Queue...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Extract All Text</span>
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

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-slate-700/80 bg-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:border-slate-600 transition-colors"
                  >
                    {/* File Meta */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isCompleted
                            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                            : isProcessing
                            ? 'bg-purple-500/10 border border-purple-500/30 text-purple-400'
                            : isError
                            ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                            : 'bg-slate-700/60 text-slate-300'
                        }`}
                      >
                        {isProcessing ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <ScanText className="w-5 h-5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">{item.name}</div>
                        <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                          <span>{item.totalPages} {item.totalPages === 1 ? 'page' : 'pages'}</span>
                          <span>•</span>
                          <span>{formatBytes(item.size)}</span>

                          {isCompleted && (
                            <>
                              <span>•</span>
                              <span className="text-purple-400 font-bold">
                                {item.totalWords.toLocaleString()} words
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-semibold text-[10px]">
                                {item.overallConfidence}% confidence
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
                                className="bg-gradient-to-r from-purple-500 to-violet-500 h-full transition-all duration-300"
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
                      {/* Inspect / View Extracted Text */}
                      {isCompleted && (
                        <button
                          onClick={() => {
                            setActiveInspectorDoc(item);
                            setInspectorPageIdx(0);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-purple-400" />
                          <span>Inspect & Export</span>
                        </button>
                      )}

                      {/* Single Extract / Retry */}
                      {(item.status === 'queued' || item.status === 'error') && (
                        <button
                          onClick={() => processItem(item.id)}
                          disabled={isProcessingAny}
                          className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Extract</span>
                        </button>
                      )}

                      {/* Quick Plain Text Download */}
                      {isCompleted && (
                        <button
                          onClick={() => exportAsMarkdown(item)}
                          className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-200 transition-colors"
                          title="Download Markdown"
                        >
                          <FileDown className="w-3.5 h-3.5 text-purple-300" />
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => setQueue((prev) => prev.filter((it) => it.id !== item.id))}
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

      {/* Interactive OCR Document Inspector & Spatial Layout Modal */}
      {activeInspectorDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-6xl w-full h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/90">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                  <ScanText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">
                    {activeInspectorDoc.name}
                  </h3>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2">
                    <span>{activeInspectorDoc.totalWords.toLocaleString()} words</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-semibold">{activeInspectorDoc.overallConfidence}% confidence</span>
                    <span>•</span>
                    <span>{activeInspectorDoc.totalPages} {activeInspectorDoc.totalPages === 1 ? 'page' : 'pages'}</span>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setActiveInspectorDoc(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Split Screen */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 min-h-0">
              {/* Left Pane: Visual Page Viewer with Spatial Bounding Boxes */}
              <div className="flex flex-col bg-slate-950/60 p-4 space-y-3 min-h-0 overflow-y-auto">
                {/* Page Navigation & Layer Controls */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={inspectorPageIdx === 0}
                      onClick={() => setInspectorPageIdx((prev) => Math.max(0, prev - 1))}
                      className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-30 hover:bg-slate-700"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-semibold text-slate-300 px-1">
                      Page {inspectorPageIdx + 1} of {activeInspectorDoc.pages.length}
                    </span>
                    <button
                      disabled={inspectorPageIdx >= activeInspectorDoc.pages.length - 1}
                      onClick={() =>
                        setInspectorPageIdx((prev) =>
                          Math.min(activeInspectorDoc.pages.length - 1, prev + 1)
                        )
                      }
                      className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-30 hover:bg-slate-700"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showBoundingBoxes}
                        onChange={(e) => setShowBoundingBoxes(e.target.checked)}
                        className="rounded bg-slate-800 border-slate-700 text-purple-600 w-3.5 h-3.5"
                      />
                      <span>Bounding Boxes</span>
                    </label>

                    {currentInspectorPage?.preprocessedImageUrl && (
                      <label className="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showPreprocessedScan}
                          onChange={(e) => setShowPreprocessedScan(e.target.checked)}
                          className="rounded bg-slate-800 border-slate-700 text-purple-600 w-3.5 h-3.5"
                        />
                        <span>Filtered Scan</span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Visual Canvas Container with Overlay */}
                <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 p-2 flex items-center justify-center relative overflow-hidden min-h-[300px]">
                  {currentInspectorPage ? (
                    <div className="relative max-h-full max-w-full inline-block shadow-lg rounded">
                      <img
                        src={
                          showPreprocessedScan && currentInspectorPage.preprocessedImageUrl
                            ? currentInspectorPage.preprocessedImageUrl
                            : currentInspectorPage.previewImageUrl
                        }
                        alt={`Page ${currentInspectorPage.pageNumber}`}
                        className="max-h-[56vh] object-contain rounded select-none"
                      />

                      {/* Bounding Boxes Layer */}
                      {showBoundingBoxes &&
                        currentInspectorPage.blocks.map((block) => {
                          const scaleX = 100 / (currentInspectorPage.width || 612);
                          const scaleY = 100 / (currentInspectorPage.height || 792);

                          const isHovered = hoveredBlockId === block.id;

                          return (
                            <div
                              key={block.id}
                              onMouseEnter={() => setHoveredBlockId(block.id)}
                              onMouseLeave={() => setHoveredBlockId(null)}
                              className={`absolute border transition-all pointer-events-auto cursor-pointer rounded-sm ${
                                isHovered
                                  ? 'border-purple-400 bg-purple-500/30 ring-2 ring-purple-400 z-20'
                                  : block.type.startsWith('heading')
                                  ? 'border-blue-500/50 bg-blue-500/10'
                                  : 'border-emerald-500/40 bg-emerald-500/5'
                              }`}
                              style={{
                                left: `${block.bbox.x0 * scaleX}%`,
                                top: `${block.bbox.y0 * scaleY}%`,
                                width: `${Math.max(2, (block.bbox.x1 - block.bbox.x0) * scaleX)}%`,
                                height: `${Math.max(2, (block.bbox.y1 - block.bbox.y0) * scaleY)}%`,
                              }}
                              title={`[${block.type.toUpperCase()}] ${block.text.slice(0, 80)}...`}
                            />
                          );
                        })}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">Page rendering not available</span>
                  )}
                </div>

                {/* Page Stats */}
                {currentInspectorPage && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                    <span>
                      Method: <strong className="text-slate-300 font-mono">{currentInspectorPage.methodUsed}</strong>
                    </span>
                    <span>
                      {currentInspectorPage.wordCount} words • {currentInspectorPage.characterCount} chars
                    </span>
                  </div>
                )}
              </div>

              {/* Right Pane: Extracted Text, Markdown & JSON Inspector */}
              <div className="flex flex-col bg-slate-900 p-4 space-y-3 min-h-0">
                {/* Search & Tabs */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  {/* Tabs */}
                  <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                    <button
                      onClick={() => setInspectorTab('markdown')}
                      className={`px-3 py-1 rounded-lg font-medium transition-all ${
                        inspectorTab === 'markdown'
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Markdown
                    </button>
                    <button
                      onClick={() => setInspectorTab('text')}
                      className={`px-3 py-1 rounded-lg font-medium transition-all ${
                        inspectorTab === 'text'
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Plain Text
                    </button>
                    <button
                      onClick={() => setInspectorTab('json')}
                      className={`px-3 py-1 rounded-lg font-medium transition-all ${
                        inspectorTab === 'json'
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Structured JSON
                    </button>
                  </div>

                  {/* Search inside extracted text */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Find in text..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 w-full sm:w-48"
                    />
                    {searchQuery && (
                      <span className="absolute right-2.5 top-2 text-[10px] text-purple-400 font-mono font-bold">
                        {searchMatchesCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Text Content Area */}
                <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-xs overflow-y-auto leading-relaxed text-slate-200 select-text">
                  {inspectorTab === 'markdown' && (
                    <div className="space-y-3 whitespace-pre-wrap font-sans text-xs">
                      {currentInspectorPage?.markdown || activeInspectorDoc.fullMarkdown}
                    </div>
                  )}

                  {inspectorTab === 'text' && (
                    <div className="whitespace-pre-wrap font-mono text-xs text-slate-300">
                      {currentInspectorPage?.text || activeInspectorDoc.fullText}
                    </div>
                  )}

                  {inspectorTab === 'json' && (
                    <pre className="text-purple-300 text-[11px] whitespace-pre-wrap font-mono">
                      {JSON.stringify(
                        {
                          page: currentInspectorPage?.pageNumber,
                          confidence: currentInspectorPage?.confidence,
                          method: currentInspectorPage?.methodUsed,
                          blocks: currentInspectorPage?.blocks,
                        },
                        null,
                        2
                      )}
                    </pre>
                  )}
                </div>

                {/* Export & Copy Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() =>
                      handleCopyText(
                        inspectorTab === 'markdown'
                          ? activeInspectorDoc.fullMarkdown
                          : activeInspectorDoc.fullText
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {copiedText ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-purple-400" />
                        <span>Copy Full Document</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => exportAsPlainText(activeInspectorDoc)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                      title="Download as .txt"
                    >
                      .TXT
                    </button>
                    <button
                      onClick={() => exportAsMarkdown(activeInspectorDoc)}
                      className="px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-medium transition-colors"
                      title="Download as .md"
                    >
                      .MD
                    </button>
                    <button
                      onClick={() => exportAsJson(activeInspectorDoc)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                      title="Download structured JSON"
                    >
                      .JSON
                    </button>
                    <button
                      onClick={() => exportAsSearchablePdf(activeInspectorDoc)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white text-xs font-semibold shadow-md shadow-purple-500/20 transition-all cursor-pointer"
                      title="Searchable PDF with invisible text layer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Searchable PDF</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
