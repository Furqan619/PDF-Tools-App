import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Layers,
  Scissors,
  Upload,
  FileText,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCw,
  CheckCircle2,
  Download,
  Eye,
  AlertCircle,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  Sliders,
  CheckSquare,
  Square,
  Sparkles,
  Package,
  FilePlus,
  RefreshCw,
  Lock,
  X
} from 'lucide-react';
import { 
  MergeDocumentItem, 
  SplitPageItem, 
  SplitConfig, 
  generatePageThumbnails, 
  mergePdfDocuments, 
  splitPdfDocument, 
  downloadResultFile,
  parseRangeString
} from '../services/pdfMergerSplitter';
import { pdfjsLib } from '../services/pdfWorker';
import { ThemeToggle } from './ThemeToggle';

interface PdfMergerSplitterProps {
  onNavigateToDashboard: () => void;
}

export const PdfMergerSplitter: React.FC<PdfMergerSplitterProps> = ({ onNavigateToDashboard }) => {
  // Mode: 'merge' or 'split'
  const [activeTab, setActiveTab] = useState<'merge' | 'split'>('merge');

  // ================= MERGE STATE =================
  const [mergeItems, setMergeItems] = useState<MergeDocumentItem[]>([]);
  const [mergedOutputName, setMergedOutputName] = useState('merged_document.pdf');
  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState({ percent: 0, status: '' });
  const [loadingThumbnailsFor, setLoadingThumbnailsFor] = useState<string | null>(null);

  // ================= SPLIT STATE =================
  const [splitFile, setSplitFile] = useState<File | null>(null);
  const [splitPages, setSplitPages] = useState<SplitPageItem[]>([]);
  const [isLoadingSplitPages, setIsLoadingSplitPages] = useState(false);
  const [splitProgress, setSplitProgress] = useState({ percent: 0, status: '' });
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitConfig, setSplitConfig] = useState<SplitConfig>({
    mode: 'extract-selected',
    customRange: '1-3',
    chunkSize: 2,
    mergeSelectedIntoOne: true,
  });

  // Zoom preview modal state
  const [zoomPage, setZoomPage] = useState<{ url: string; pageNumber: number } | null>(null);

  const mergeFileInputRef = useRef<HTMLInputElement>(null);
  const splitFileInputRef = useRef<HTMLInputElement>(null);

  // Format file size
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // ================= MERGE HANDLERS =================
  const handleMergeFilesSelected = async (files: FileList | File[]) => {
    const pdfFiles = Array.from(files).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );

    if (pdfFiles.length === 0) return;

    const newItems: MergeDocumentItem[] = [];

    for (const file of pdfFiles) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        const totalPages = pdf.numPages;

        const pages = Array.from({ length: totalPages }, (_, i) => ({
          pageNumber: i + 1,
          rotation: 0,
          selected: true,
        }));

        newItems.push({
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          name: file.name,
          size: file.size,
          totalPages,
          pages,
          isExpanded: false,
        });
      } catch (err) {
        console.error('Error reading PDF file structure:', err);
      }
    }

    setMergeItems((prev) => [...prev, ...newItems]);
  };

  const handleToggleExpandMergeItem = async (itemId: string) => {
    const targetItem = mergeItems.find((item) => item.id === itemId);
    if (!targetItem) return;

    const willExpand = !targetItem.isExpanded;

    setMergeItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, isExpanded: willExpand } : item))
    );

    // If expanding and thumbnails haven't been loaded yet, load them
    if (willExpand && !targetItem.pages[0]?.thumbnailUrl) {
      setLoadingThumbnailsFor(itemId);
      try {
        const thumbs = await generatePageThumbnails(targetItem.file, 50);
        setMergeItems((prev) =>
          prev.map((item) => {
            if (item.id === itemId) {
              const updatedPages = item.pages.map((p) => {
                const found = thumbs.find((t) => t.pageNumber === p.pageNumber);
                return found ? { ...p, thumbnailUrl: found.thumbnailUrl } : p;
              });
              return { ...item, pages: updatedPages };
            }
            return item;
          })
        );
      } catch (err) {
        console.error('Error generating thumbnails:', err);
      } finally {
        setLoadingThumbnailsFor(null);
      }
    }
  };

  const handleMoveMergeItem = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === mergeItems.length - 1)
    ) {
      return;
    }

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newItems = [...mergeItems];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;
    setMergeItems(newItems);
  };

  const handleRemoveMergeItem = (itemId: string) => {
    setMergeItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleRotateMergePage = (itemId: string, pageNumber: number) => {
    setMergeItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const updatedPages = item.pages.map((p) =>
            p.pageNumber === pageNumber ? { ...p, rotation: (p.rotation + 90) % 360 } : p
          );
          return { ...item, pages: updatedPages };
        }
        return item;
      })
    );
  };

  const handleToggleMergePageSelect = (itemId: string, pageNumber: number) => {
    setMergeItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const updatedPages = item.pages.map((p) =>
            p.pageNumber === pageNumber ? { ...p, selected: !p.selected } : p
          );
          return { ...item, pages: updatedPages };
        }
        return item;
      })
    );
  };

  const handleExecuteMerge = async () => {
    if (mergeItems.length < 1) return;

    try {
      setIsMerging(true);
      setMergeProgress({ percent: 10, status: 'Initializing merger...' });

      const finalName = mergedOutputName.trim().endsWith('.pdf')
        ? mergedOutputName.trim()
        : `${mergedOutputName.trim()}.pdf`;

      const mergedBytes = await mergePdfDocuments(mergeItems, finalName, (pct, status) => {
        setMergeProgress({ percent: pct, status });
      });

      downloadResultFile(mergedBytes, finalName);
    } catch (err: any) {
      alert(`Merge failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsMerging(false);
      setMergeProgress({ percent: 0, status: '' });
    }
  };

  // Total pages across all merge items
  const totalMergePages = useMemo(() => {
    return mergeItems.reduce((acc, it) => acc + it.pages.filter((p) => p.selected).length, 0);
  }, [mergeItems]);

  const totalMergeSize = useMemo(() => {
    return mergeItems.reduce((acc, it) => acc + it.size, 0);
  }, [mergeItems]);

  // ================= SPLIT HANDLERS =================
  const handleSplitFileSelected = async (file: File) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) return;

    setSplitFile(file);
    setIsLoadingSplitPages(true);

    try {
      const thumbs = await generatePageThumbnails(file, 100, (loaded, total) => {
        setSplitProgress({
          percent: Math.round((loaded / total) * 100),
          status: `Rendering page thumbnails (${loaded}/${total})...`,
        });
      });

      const pages: SplitPageItem[] = thumbs.map((t) => ({
        pageNumber: t.pageNumber,
        rotation: 0,
        selected: true,
        thumbnailUrl: t.thumbnailUrl,
      }));

      setSplitPages(pages);
      setSplitConfig((prev) => ({
        ...prev,
        customRange: pages.length > 3 ? `1-${Math.min(3, pages.length)}` : '1',
      }));
    } catch (err: any) {
      alert(`Failed to parse PDF pages: ${err.message}`);
      setSplitFile(null);
    } finally {
      setIsLoadingSplitPages(false);
      setSplitProgress({ percent: 0, status: '' });
    }
  };

  const handleToggleSplitPageSelect = (pageNumber: number) => {
    setSplitPages((prev) =>
      prev.map((p) => (p.pageNumber === pageNumber ? { ...p, selected: !p.selected } : p))
    );
  };

  const handleRotateSplitPage = (pageNumber: number) => {
    setSplitPages((prev) =>
      prev.map((p) =>
        p.pageNumber === pageNumber ? { ...p, rotation: (p.rotation + 90) % 360 } : p
      )
    );
  };

  const handleBulkSelectSplitPages = (action: 'all' | 'none' | 'invert' | 'odd' | 'even') => {
    setSplitPages((prev) =>
      prev.map((p) => {
        if (action === 'all') return { ...p, selected: true };
        if (action === 'none') return { ...p, selected: false };
        if (action === 'invert') return { ...p, selected: !p.selected };
        if (action === 'odd') return { ...p, selected: p.pageNumber % 2 !== 0 };
        if (action === 'even') return { ...p, selected: p.pageNumber % 2 === 0 };
        return p;
      })
    );
  };

  const handleExecuteSplit = async () => {
    if (!splitFile || splitPages.length === 0) return;

    try {
      setIsSplitting(true);
      setSplitProgress({ percent: 10, status: 'Initializing page splitter...' });

      const result = await splitPdfDocument(splitFile, splitPages, splitConfig, (pct, status) => {
        setSplitProgress({ percent: pct, status });
      });

      downloadResultFile(result.data, result.filename);
    } catch (err: any) {
      alert(`Split failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSplitting(false);
      setSplitProgress({ percent: 0, status: '' });
    }
  };

  const selectedSplitPagesCount = useMemo(() => {
    if (splitConfig.mode === 'custom-range') {
      return parseRangeString(splitConfig.customRange, splitPages.length).length;
    }
    return splitPages.filter((p) => p.selected).length;
  }, [splitPages, splitConfig.mode, splitConfig.customRange]);

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
              <LayoutGrid className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>

            <span className="text-slate-600 hidden sm:inline">/</span>

            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/20 ring-1 ring-white/10 shrink-0">
              <Layers className="w-4 h-4 text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                  PDF <span className="text-emerald-400 font-mono text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">Merger & Splitter</span>
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Lock className="w-3 h-3" />
                  <span className="hidden xs:inline">100% In-Browser</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden md:block">
                Lossless vector merging, visual page rearrangement, rotation, and multi-mode splitting
              </p>
            </div>
          </div>

          {/* Right Header Actions: Mode Switcher & Theme Toggle */}
          <div className="flex items-center gap-2.5">
            {/* Mode Switcher Tabs */}
            <div className="flex items-center p-1 rounded-xl bg-slate-800/90 border border-slate-700/80">
              <button
                onClick={() => setActiveTab('merge')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'merge'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Merge PDFs</span>
                {mergeItems.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-700 text-[10px] text-white">
                    {mergeItems.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('split')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'split'
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Split & Extract</span>
                {splitPages.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-teal-700 text-[10px] text-white">
                    {splitPages.length}p
                  </span>
                )}
              </button>
            </div>

            {/* Theme Toggle */}
            <ThemeToggle variant="icon" />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ================= MERGE VIEW ================= */}
        {activeTab === 'merge' && (
          <div className="space-y-6">
            {/* Action & Stats Bar if items exist */}
            {mergeItems.length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-black/20">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Documents:</span>
                    <span className="font-semibold text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
                      {mergeItems.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Total Pages to Merge:</span>
                    <span className="font-semibold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                      {totalMergePages} pages
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Combined Size:</span>
                    <span className="font-semibold text-slate-300 px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
                      {formatBytes(totalMergeSize)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={mergedOutputName}
                      onChange={(e) => setMergedOutputName(e.target.value)}
                      placeholder="output_filename.pdf"
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-48 sm:w-56"
                    />
                  </div>

                  <button
                    onClick={() => setMergeItems([])}
                    className="p-2 rounded-lg bg-slate-700/60 hover:bg-red-500/20 hover:text-red-400 text-slate-400 border border-slate-600/40 text-xs transition-colors"
                    title="Clear all documents"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleExecuteMerge}
                    disabled={isMerging || totalMergePages === 0}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                  >
                    {isMerging ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Merging ({mergeProgress.percent}%)...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Merge & Download PDF</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Merge Drop Zone */}
            <div
              onClick={() => mergeFileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleMergeFilesSelected(e.dataTransfer.files);
                }
              }}
              className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 bg-slate-800/40 hover:bg-slate-800/70 rounded-2xl p-8 text-center cursor-pointer transition-all space-y-3 group"
            >
              <input
                ref={mergeFileInputRef}
                type="file"
                multiple
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleMergeFilesSelected(e.target.files);
                }}
              />
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                <FilePlus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Drop PDF documents here to merge, or <span className="text-emerald-400 underline">browse</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Upload 2 or more PDFs. You can re-order files, rotate pages, or remove specific pages before merging.
                </p>
              </div>
            </div>

            {/* Merge Items List */}
            {mergeItems.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Document Merge Sequence (Top to Bottom)
                  </h3>
                  <span className="text-xs text-slate-400">
                    Use Up/Down arrows to re-order files in the merge output
                  </span>
                </div>

                <div className="space-y-3">
                  {mergeItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-700/80 bg-slate-800/80 overflow-hidden shadow-sm"
                    >
                      {/* Document Item Header */}
                      <div className="p-3.5 flex items-center justify-between gap-3 bg-slate-800">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Order Number Badge */}
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                            #{index + 1}
                          </div>

                          <FileText className="w-5 h-5 text-emerald-400 shrink-0" />

                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{item.name}</div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>{item.totalPages} pages</span>
                              <span>•</span>
                              <span>{formatBytes(item.size)}</span>
                              <span>•</span>
                              <span className="text-emerald-400 font-medium">
                                {item.pages.filter((p) => p.selected).length} included
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Move Up */}
                          <button
                            onClick={() => handleMoveMergeItem(index, 'up')}
                            disabled={index === 0}
                            className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 disabled:opacity-30 text-xs transition-colors"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>

                          {/* Move Down */}
                          <button
                            onClick={() => handleMoveMergeItem(index, 'down')}
                            disabled={index === mergeItems.length - 1}
                            className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 disabled:opacity-30 text-xs transition-colors"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>

                          {/* Expand/Collapse Pages */}
                          <button
                            onClick={() => handleToggleExpandMergeItem(item.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                          >
                            <span>{item.isExpanded ? 'Hide Pages' : 'Inspect Pages'}</span>
                            {item.isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Remove */}
                          <button
                            onClick={() => handleRemoveMergeItem(item.id)}
                            className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-red-500/20 hover:text-red-400 text-slate-400 transition-colors"
                            title="Remove document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded Page Grid */}
                      {item.isExpanded && (
                        <div className="p-4 bg-slate-900/60 border-t border-slate-700/60 space-y-3">
                          {loadingThumbnailsFor === item.id ? (
                            <div className="flex items-center justify-center py-6 gap-2 text-xs text-slate-400">
                              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                              <span>Generating page thumbnail previews...</span>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                                <span>Click thumbnail to toggle page inclusion. Click rotate to adjust orientation.</span>
                                <span>{item.pages.filter((p) => p.selected).length} of {item.totalPages} selected</span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                                {item.pages.map((p) => (
                                  <div
                                    key={p.pageNumber}
                                    className={`relative group rounded-lg border overflow-hidden transition-all flex flex-col justify-between ${
                                      p.selected
                                        ? 'bg-slate-800 border-emerald-500/50 ring-1 ring-emerald-500/30'
                                        : 'bg-slate-900 border-slate-700/40 opacity-40 hover:opacity-75'
                                    }`}
                                  >
                                    {/* Thumbnail Image Container */}
                                    <div
                                      onClick={() => handleToggleMergePageSelect(item.id, p.pageNumber)}
                                      className="p-2 flex items-center justify-center aspect-[3/4] cursor-pointer bg-slate-950/40"
                                    >
                                      {p.thumbnailUrl ? (
                                        <img
                                          src={p.thumbnailUrl}
                                          alt={`Page ${p.pageNumber}`}
                                          style={{ transform: `rotate(${p.rotation}deg)` }}
                                          className="max-h-full max-w-full object-contain rounded shadow-sm transition-transform duration-200"
                                        />
                                      ) : (
                                        <div className="text-[11px] text-slate-500">Page {p.pageNumber}</div>
                                      )}
                                    </div>

                                    {/* Footer with Page Num & Rotate */}
                                    <div className="px-2 py-1 bg-slate-800/90 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                                      <span className="font-semibold text-slate-300">p.{p.pageNumber}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRotateMergePage(item.id, p.pageNumber);
                                        }}
                                        className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-colors"
                                        title="Rotate 90° clockwise"
                                      >
                                        <RotateCw className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= SPLIT VIEW ================= */}
        {activeTab === 'split' && (
          <div className="space-y-6">
            {!splitFile ? (
              /* Single PDF Drop Zone */
              <div
                onClick={() => splitFileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleSplitFileSelected(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-slate-700 hover:border-teal-500/60 bg-slate-800/40 hover:bg-slate-800/70 rounded-2xl p-12 text-center cursor-pointer transition-all space-y-4 group"
              >
                <input
                  ref={splitFileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) handleSplitFileSelected(e.target.files[0]);
                  }}
                />
                <div className="w-14 h-14 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <Scissors className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Select a multi-page PDF document to split, or <span className="text-teal-400 underline">browse</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    Extract specific pages, split into individual single-page documents, partition into equal page chunks, or enter custom page ranges.
                  </p>
                </div>
              </div>
            ) : (
              /* Active Split Workspace */
              <div className="space-y-6">
                {/* Active Document Top Bar */}
                <div className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-black/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{splitFile.name}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{splitPages.length} total pages</span>
                        <span>•</span>
                        <span>{formatBytes(splitFile.size)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSplitFile(null);
                        setSplitPages([]);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                    >
                      Choose Different PDF
                    </button>

                    <button
                      onClick={handleExecuteSplit}
                      disabled={isSplitting || selectedSplitPagesCount === 0}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all cursor-pointer"
                    >
                      {isSplitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Splitting ({splitProgress.percent}%)...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>
                            {splitConfig.mode === 'all-individual'
                              ? 'Split All to ZIP'
                              : splitConfig.mode === 'chunks'
                              ? `Split into Chunks of ${splitConfig.chunkSize} (ZIP)`
                              : `Extract ${selectedSplitPagesCount} Pages`}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Split Configuration Box */}
                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                    <Sliders className="w-4 h-4 text-teal-400" />
                    <span>Split & Extraction Method</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Method 1: Extract Selected */}
                    <div
                      onClick={() => setSplitConfig((prev) => ({ ...prev, mode: 'extract-selected' }))}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                        splitConfig.mode === 'extract-selected'
                          ? 'bg-teal-500/10 border-teal-500/60 ring-1 ring-teal-500/30'
                          : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-white flex items-center justify-between">
                          <span>Visual Page Select</span>
                          <CheckSquare className="w-3.5 h-3.5 text-teal-400" />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Click page thumbnails in the grid below to extract chosen pages into 1 consolidated PDF.
                        </p>
                      </div>
                    </div>

                    {/* Method 2: All Individual Pages (ZIP) */}
                    <div
                      onClick={() => setSplitConfig((prev) => ({ ...prev, mode: 'all-individual' }))}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                        splitConfig.mode === 'all-individual'
                          ? 'bg-teal-500/10 border-teal-500/60 ring-1 ring-teal-500/30'
                          : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-white flex items-center justify-between">
                          <span>Extract All Pages (ZIP)</span>
                          <Package className="w-3.5 h-3.5 text-teal-400" />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Split every single page into its own individual PDF file and download as a ZIP archive.
                        </p>
                      </div>
                    </div>

                    {/* Method 3: Equal Chunks */}
                    <div
                      onClick={() => setSplitConfig((prev) => ({ ...prev, mode: 'chunks' }))}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                        splitConfig.mode === 'chunks'
                          ? 'bg-teal-500/10 border-teal-500/60 ring-1 ring-teal-500/30'
                          : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-white flex items-center justify-between">
                          <span>Split into Chunks</span>
                          <Layers className="w-3.5 h-3.5 text-teal-400" />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Partition PDF into multi-page parts (e.g. 2 pages per document).
                        </p>
                      </div>
                      {splitConfig.mode === 'chunks' && (
                        <div className="pt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[11px] text-slate-300">Pages per part:</span>
                          <input
                            type="number"
                            min="1"
                            max={splitPages.length}
                            value={splitConfig.chunkSize}
                            onChange={(e) =>
                              setSplitConfig((prev) => ({
                                ...prev,
                                chunkSize: Math.max(1, parseInt(e.target.value, 10) || 1),
                              }))
                            }
                            className="w-16 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-xs text-white"
                          />
                        </div>
                      )}
                    </div>

                    {/* Method 4: Custom Range Expression */}
                    <div
                      onClick={() => setSplitConfig((prev) => ({ ...prev, mode: 'custom-range' }))}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                        splitConfig.mode === 'custom-range'
                          ? 'bg-teal-500/10 border-teal-500/60 ring-1 ring-teal-500/30'
                          : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-white flex items-center justify-between">
                          <span>Custom Range Syntax</span>
                          <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Specify page ranges (e.g. <code className="text-teal-300">1-3, 5, 8-10</code>).
                        </p>
                      </div>
                      {splitConfig.mode === 'custom-range' && (
                        <div className="pt-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={splitConfig.customRange}
                            onChange={(e) =>
                              setSplitConfig((prev) => ({ ...prev, customRange: e.target.value }))
                            }
                            placeholder="e.g. 1-3, 5, 8"
                            className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-white"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Thumbnail Grid & Multi-Select Toolbar */}
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Interactive Page Matrix ({splitPages.length} pages)
                      </h3>
                      <span className="text-xs px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 font-medium">
                        {selectedSplitPagesCount} selected
                      </span>
                    </div>

                    {/* Quick Selection Buttons */}
                    <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                      <button
                        onClick={() => handleBulkSelectSplitPages('all')}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => handleBulkSelectSplitPages('none')}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                      >
                        Deselect All
                      </button>
                      <button
                        onClick={() => handleBulkSelectSplitPages('invert')}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                      >
                        Invert
                      </button>
                      <button
                        onClick={() => handleBulkSelectSplitPages('odd')}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                      >
                        Odd Pages
                      </button>
                      <button
                        onClick={() => handleBulkSelectSplitPages('even')}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                      >
                        Even Pages
                      </button>
                    </div>
                  </div>

                  {/* Thumbnail Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                    {splitPages.map((page) => {
                      const isRangeMatch =
                        splitConfig.mode === 'custom-range'
                          ? parseRangeString(splitConfig.customRange, splitPages.length).includes(
                              page.pageNumber
                            )
                          : page.selected;

                      return (
                        <div
                          key={page.pageNumber}
                          className={`relative group rounded-xl border overflow-hidden transition-all flex flex-col justify-between ${
                            isRangeMatch
                              ? 'bg-slate-800 border-teal-500/60 ring-2 ring-teal-500/30 shadow-md shadow-teal-500/10'
                              : 'bg-slate-900/60 border-slate-700/40 opacity-40 hover:opacity-75'
                          }`}
                        >
                          {/* Selection Checkbox Badge */}
                          <div className="absolute top-2 left-2 z-10">
                            <div
                              onClick={() => handleToggleSplitPageSelect(page.pageNumber)}
                              className={`w-5 h-5 rounded-md flex items-center justify-center cursor-pointer transition-all ${
                                isRangeMatch
                                  ? 'bg-teal-500 text-white shadow-sm'
                                  : 'bg-slate-800/80 border border-slate-600 text-transparent hover:border-teal-400'
                              }`}
                            >
                              <CheckSquare className="w-3.5 h-3.5" />
                            </div>
                          </div>

                          {/* Zoom Preview Trigger */}
                          {page.thumbnailUrl && (
                            <button
                              onClick={() =>
                                setZoomPage({
                                  url: page.thumbnailUrl!,
                                  pageNumber: page.pageNumber,
                                })
                              }
                              className="absolute top-2 right-2 z-10 p-1 rounded-md bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Zoom Preview"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                          )}

                          {/* Image Box */}
                          <div
                            onClick={() => handleToggleSplitPageSelect(page.pageNumber)}
                            className="p-3 flex items-center justify-center aspect-[3/4] cursor-pointer bg-slate-950/40"
                          >
                            {page.thumbnailUrl ? (
                              <img
                                src={page.thumbnailUrl}
                                alt={`Page ${page.pageNumber}`}
                                style={{ transform: `rotate(${page.rotation}deg)` }}
                                className="max-h-full max-w-full object-contain rounded shadow transition-transform duration-200"
                              />
                            ) : (
                              <div className="text-xs text-slate-500">Page {page.pageNumber}</div>
                            )}
                          </div>

                          {/* Footer Info & Rotate */}
                          <div className="px-2.5 py-1.5 bg-slate-800 border-t border-slate-700/60 flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-300">Page {page.pageNumber}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRotateSplitPage(page.pageNumber);
                              }}
                              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-teal-400 transition-colors"
                              title="Rotate 90°"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Zoom Modal */}
      {zoomPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-4 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="text-sm font-bold text-white">
                Page {zoomPage.pageNumber} Preview
              </div>
              <button
                onClick={() => setZoomPage(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-center max-h-[70vh] overflow-auto bg-slate-950 p-4 rounded-xl">
              <img
                src={zoomPage.url}
                alt={`Page ${zoomPage.pageNumber}`}
                className="max-h-[60vh] object-contain rounded shadow-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950/60 py-4 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <span>PDF Merger & Page Splitter • Client-Side Native Engine</span>
          <span>100% In-Browser Lossless Processing</span>
        </div>
      </footer>
    </div>
  );
};
