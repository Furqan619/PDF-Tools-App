import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Upload,
  FileText,
  Sparkles,
  Download,
  Eye,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  Layers,
  ShieldCheck,
  Type,
  Maximize2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Hash,
  Palette,
  LayoutTemplate,
  FileSpreadsheet,
  Check,
  Zap,
  Info,
  RotateCcw
} from 'lucide-react';
import {
  PageNumberConfig,
  PositionAnchor,
  NumberFormatPreset,
  PageRangeMode,
  DEFAULT_PAGE_NUMBER_CONFIG,
  applyPageNumbersToPdf,
  formatPageNumberText,
  isPageNumbered,
  resolveHorizontalAlignment,
  resolveVerticalPosition,
  fireCelebrationConfetti
} from '../services/pdfPageNumberEngine';
import { pdfjsLib } from '../services/pdfWorker';
import { generateSamplePdfBlob, SAMPLE_PRESETS } from '../services/sampleFiles';
import { ThemeToggle } from './ThemeToggle';
import { saveAs } from 'file-saver';

interface PdfPageNumbersToolProps {
  onNavigateToDashboard: () => void;
}

export const PdfPageNumbersTool: React.FC<PdfPageNumbersToolProps> = ({ onNavigateToDashboard }) => {
  // File state
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPagePreview, setCurrentPagePreview] = useState<number>(1);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Configuration state
  const [config, setConfig] = useState<PageNumberConfig>(DEFAULT_PAGE_NUMBER_CONFIG);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<{ percent: number; message: string }>({
    percent: 0,
    message: '',
  });
  const [processedResult, setProcessedResult] = useState<{
    blob: Blob;
    fileName: string;
    totalPages: number;
    fileSizeBytes: number;
    url: string;
  } | null>(null);

  // Canvas preview ref & scale
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewScale, setPreviewScale] = useState<number>(0.9);
  const [pdfDocumentInstance, setPdfDocumentInstance] = useState<any>(null);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({ width: 595, height: 842 });

  // Format file size
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Load PDF file into memory & PDF.js
  const handleLoadPdf = async (selectedFile: File) => {
    if (!selectedFile || (!selectedFile.type.includes('pdf') && !selectedFile.name.toLowerCase().endsWith('.pdf'))) {
      alert('Please upload a valid PDF document.');
      return;
    }

    try {
      setIsLoadingPdf(true);
      setProcessedResult(null);
      setFile(selectedFile);

      const arrayBuffer = await selectedFile.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/cmaps/',
        cMapPacked: true,
      });

      const pdf = await loadingTask.promise;
      setPdfDocumentInstance(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPagePreview(1);

      // Get page 1 dimensions
      const page1 = await pdf.getPage(1);
      const viewport = page1.getViewport({ scale: 1.0 });
      setPageDimensions({ width: viewport.width, height: viewport.height });
    } catch (err) {
      console.error('Error parsing PDF file:', err);
      alert('Could not read PDF document. The file may be corrupt or encrypted.');
    } finally {
      setIsLoadingPdf(false);
    }
  };

  // Render current preview page onto canvas
  const renderCurrentPage = useCallback(async () => {
    if (!pdfDocumentInstance || !canvasRef.current) return;

    try {
      const page = await pdfDocumentInstance.getPage(currentPagePreview);
      const viewport = page.getViewport({ scale: previewScale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Update page dimensions in points
      const origViewport = page.getViewport({ scale: 1.0 });
      setPageDimensions({ width: origViewport.width, height: origViewport.height });

      const renderContext = {
        canvasContext: ctx,
        viewport,
      };

      await page.render(renderContext).promise;
    } catch (err) {
      console.error('Error rendering preview canvas:', err);
    }
  }, [pdfDocumentInstance, currentPagePreview, previewScale]);

  useEffect(() => {
    if (pdfDocumentInstance) {
      renderCurrentPage();
    }
  }, [pdfDocumentInstance, currentPagePreview, previewScale, renderCurrentPage]);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleLoadPdf(e.dataTransfer.files[0]);
    }
  };

  // Sample document quick select
  const handleSelectSample = (presetId: string) => {
    const sampleBlob = generateSamplePdfBlob(presetId);
    handleLoadPdf(sampleBlob);
  };

  // Execute Page Numbering
  const handleApplyPageNumbers = async () => {
    if (!file) return;

    try {
      setIsProcessing(true);
      setProcessingProgress({ percent: 10, message: 'Initializing PDF processor...' });

      const result = await applyPageNumbersToPdf(file, config, (progress, message) => {
        setProcessingProgress({ percent: progress, message });
      });

      const url = URL.createObjectURL(result.blob);
      setProcessedResult({
        ...result,
        url,
      });

      fireCelebrationConfetti();
    } catch (err) {
      console.error('Error applying page numbers:', err);
      alert('Failed to apply page numbers. Please check your page range settings and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Direct Download
  const handleDownload = () => {
    if (!processedResult) return;
    saveAs(processedResult.blob, processedResult.fileName);
  };

  // Quick Preset Configurations
  const applyPreset = (presetName: string) => {
    switch (presetName) {
      case 'standard-footer':
        setConfig((prev) => ({
          ...prev,
          position: 'bottom-center',
          format: 'page-x-of-y',
          fontSize: 10,
          fontFamily: 'Helvetica',
          color: '#334155',
          pageRangeMode: 'all',
          showDividerLine: false,
          showBadgePill: false,
        }));
        break;
      case 'classic-header':
        setConfig((prev) => ({
          ...prev,
          position: 'top-right',
          format: 'page-x',
          fontSize: 9,
          fontFamily: 'TimesRoman',
          color: '#1e293b',
          pageRangeMode: 'exclude-first',
          showDividerLine: true,
          showBadgePill: false,
        }));
        break;
      case 'booklet-alternating':
        setConfig((prev) => ({
          ...prev,
          position: 'outer-edge',
          format: 'number',
          fontSize: 10,
          fontFamily: 'HelveticaBold',
          color: '#0f172a',
          pageRangeMode: 'exclude-first',
          showDividerLine: false,
          showBadgePill: false,
        }));
        break;
      case 'modern-badge':
        setConfig((prev) => ({
          ...prev,
          position: 'bottom-right',
          format: 'x-of-y',
          fontSize: 9,
          fontFamily: 'HelveticaBold',
          color: '#ffffff',
          showBadgePill: true,
          badgePillColor: 'dark',
          pageRangeMode: 'all',
        }));
        break;
    }
  };

  // Compute live preview overlay parameters
  const isCurrentPageNumbered = isPageNumbered(currentPagePreview, totalPages, config);
  const currentPageText = formatPageNumberText(currentPagePreview, totalPages, config, file?.name || 'Document');
  const horizAlign = resolveHorizontalAlignment(config.position, currentPagePreview);
  const vertAlign = resolveVerticalPosition(config.position);

  // Position anchors definition for 3x2 matrix
  const POSITION_OPTIONS: { id: PositionAnchor; label: string; tooltip: string }[] = [
    { id: 'top-left', label: 'Top Left', tooltip: 'Header left aligned' },
    { id: 'top-center', label: 'Top Center', tooltip: 'Header center aligned' },
    { id: 'top-right', label: 'Top Right', tooltip: 'Header right aligned' },
    { id: 'bottom-left', label: 'Bottom Left', tooltip: 'Footer left aligned' },
    { id: 'bottom-center', label: 'Bottom Center', tooltip: 'Footer center aligned' },
    { id: 'bottom-right', label: 'Bottom Right', tooltip: 'Footer right aligned' },
  ];

  const FORMAT_OPTIONS: { id: NumberFormatPreset; label: string; sample: string }[] = [
    { id: 'page-x-of-y', label: 'Page X of Y', sample: 'Page 1 of 12' },
    { id: 'x-of-y', label: 'X of Y', sample: '1 of 12' },
    { id: 'number', label: 'Simple Number', sample: '1, 2, 3...' },
    { id: 'hyphen', label: 'Hyphenated', sample: '- 1 -' },
    { id: 'page-x', label: 'Prefix Page', sample: 'Page 1' },
    { id: 'x-slash-y', label: 'Slash X/Y', sample: '1 / 12' },
    { id: 'roman-lower', label: 'Roman (lower)', sample: 'i, ii, iii...' },
    { id: 'roman-upper', label: 'Roman (UPPER)', sample: 'I, II, III...' },
    { id: 'alpha-lower', label: 'Alpha (lower)', sample: 'a, b, c...' },
    { id: 'alpha-upper', label: 'Alpha (UPPER)', sample: 'A, B, C...' },
    { id: 'custom', label: 'Custom Template', sample: '{page} | {total}' },
  ];

  const COLOR_PALETTE = [
    { name: 'Dark Slate', hex: '#1e293b' },
    { name: 'Pure Black', hex: '#000000' },
    { name: 'Muted Gray', hex: '#64748b' },
    { name: 'Royal Blue', hex: '#2563eb' },
    { name: 'Crimson Red', hex: '#dc2626' },
    { name: 'Forest Emerald', hex: '#059669' },
    { name: 'Pure White', hex: '#ffffff' },
  ];

  return (
    <div className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200 pb-16">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleLoadPdf(e.target.files[0]);
          }
        }}
      />

      {/* Top Application Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-xs dark:shadow-lg dark:shadow-black/20 transition-colors">
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateToDashboard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Document Studio Hub</span>
          </button>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-blue-500/20">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                PDF Page Numbers
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20">
                  Headers & Footers
                </span>
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {file && (
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">{file.name}</span>
              <span>•</span>
              <span>{totalPages} {totalPages === 1 ? 'page' : 'pages'}</span>
              <span>•</span>
              <span>{formatBytes(file.size)}</span>
            </div>
          )}

          {file && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-medium border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Change PDF</span>
            </button>
          )}

          <ThemeToggle />
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 flex-1 w-full">
        {!file ? (
          /* ==================== EMPTY STATE: DROPZONE & SAMPLES ==================== */
          <div className="max-w-3xl mx-auto space-y-6 pt-4">
            {/* Header Description */}
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Add Page Numbers into Any PDF
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
                Customize headers, footers, page counts, Roman numerals, and alternating booklet positions with real-time visual alignment.
              </p>
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
                isDragOver
                  ? 'border-sky-500 bg-sky-50 dark:bg-sky-500/10 scale-[1.005] shadow-xl'
                  : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/70 shadow-xs'
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-sky-50 dark:bg-slate-800 border border-sky-100 dark:border-slate-700 flex items-center justify-center mx-auto mb-4 text-sky-600 dark:text-sky-400 group-hover:scale-105 transition-transform shadow-xs">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1">
                Drop your PDF file here, or <span className="text-sky-600 dark:text-sky-400 underline underline-offset-2">browse files</span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6">
                Supports single-page & multi-page PDF documents of any size.
              </p>

              {/* Feature Highlights Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-2xl mx-auto text-left">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 mb-0.5">
                    <Sliders className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    <span>6-Point Anchor</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Header & footer margins</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 mb-0.5">
                    <Type className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>Rich Formats</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Page X of Y, Roman, Alpha</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 mb-0.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Cover Exclusion</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Skip first page / range</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 mb-0.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>100% Client-Side</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Zero data leaves device</p>
                </div>
              </div>
            </div>

            {/* Instant Sample Documents Bar */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Instant Test Presets
                  </span>
                </div>
                <span className="text-xs text-slate-500">No upload required</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SAMPLE_PRESETS.filter((p) => p.category !== 'ocr-sample').map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectSample(preset.id)}
                    className="text-left p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-sky-300 dark:hover:border-sky-500/50 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors truncate">
                          {preset.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 dark:bg-slate-700 text-sky-700 dark:text-slate-300 font-mono">
                          {preset.pages} pgs
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-sky-600 dark:text-sky-400 font-semibold">
                      <span>Load Sample</span>
                      <span>→</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ==================== LOADED WORKSPACE: 2 COLUMNS ==================== */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: Controls & Settings (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Quick Template Presets Bar */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Quick Presets:</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => applyPreset('standard-footer')}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    Footer Center (Page X of Y)
                  </button>
                  <button
                    onClick={() => applyPreset('classic-header')}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    Header Right + Rule
                  </button>
                  <button
                    onClick={() => applyPreset('booklet-alternating')}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    Booklet Outer Edges
                  </button>
                  <button
                    onClick={() => applyPreset('modern-badge')}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    Dark Badge Pill
                  </button>
                </div>
              </div>

              {/* CARD 1: Positioning & Alignment */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <LayoutTemplate className="w-4 h-4 text-sky-500" />
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      1. Position & Margin Offsets
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {config.position}
                  </span>
                </div>

                {/* 3x2 Matrix Visual Position Picker */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Position on Page
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {POSITION_OPTIONS.map((pos) => {
                      const isSelected = config.position === pos.id;
                      return (
                        <button
                          key={pos.id}
                          onClick={() => setConfig((prev) => ({ ...prev, position: pos.id }))}
                          className={`p-2.5 rounded-xl border text-xs font-medium transition-all flex flex-col items-center justify-center gap-1 text-center ${
                            isSelected
                              ? 'border-sky-500 bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 font-bold shadow-xs'
                              : 'border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            {isSelected && <Check className="w-3 h-3 text-sky-600 dark:text-sky-400" />}
                            <span>{pos.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Alternating Booklet Options */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => setConfig((prev) => ({ ...prev, position: 'outer-edge' }))}
                    className={`p-2.5 rounded-xl border text-xs font-medium text-left transition-all ${
                      config.position === 'outer-edge'
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 font-bold'
                        : 'border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-semibold mb-0.5">Booklet Outer Margins</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Odd pages right, Even pages left</div>
                  </button>

                  <button
                    onClick={() => setConfig((prev) => ({ ...prev, position: 'inner-edge' }))}
                    className={`p-2.5 rounded-xl border text-xs font-medium text-left transition-all ${
                      config.position === 'inner-edge'
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 font-bold'
                        : 'border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-semibold mb-0.5">Booklet Inner Margins</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Odd pages left, Even pages right</div>
                  </button>
                </div>

                {/* Margin Sliders */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      <span>Horizontal Margin (X)</span>
                      <span className="font-mono text-sky-600 dark:text-sky-400">{config.marginX} pt</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={120}
                      step={2}
                      value={config.marginX}
                      onChange={(e) => setConfig((prev) => ({ ...prev, marginX: parseInt(e.target.value, 10) }))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>Edge (10pt)</span>
                      <span>Deep (120pt)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      <span>Vertical Margin (Y)</span>
                      <span className="font-mono text-sky-600 dark:text-sky-400">{config.marginY} pt</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={120}
                      step={2}
                      value={config.marginY}
                      onChange={(e) => setConfig((prev) => ({ ...prev, marginY: parseInt(e.target.value, 10) }))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>Edge (10pt)</span>
                      <span>Deep (120pt)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 2: Format & Custom Text Template */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-indigo-500" />
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      2. Numbering Format & Text Template
                    </h3>
                  </div>
                </div>

                {/* Format Presets Chips */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Number Format
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {FORMAT_OPTIONS.map((fmt) => {
                      const isSelected = config.format === fmt.id;
                      return (
                        <button
                          key={fmt.id}
                          onClick={() => setConfig((prev) => ({ ...prev, format: fmt.id }))}
                          className={`p-2 rounded-xl border text-xs text-left transition-all ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs'
                              : 'border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="truncate font-medium">{fmt.label}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">{fmt.sample}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Template Input when Custom is selected */}
                {config.format === 'custom' && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Custom String Template
                    </label>
                    <input
                      type="text"
                      value={config.customTemplate}
                      onChange={(e) => setConfig((prev) => ({ ...prev, customTemplate: e.target.value }))}
                      placeholder="e.g. Confidential Report | Page {page} of {total}"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-500">Insert tag:</span>
                      {['{page}', '{total}', '{file}', '{date}', '{roman}', '{ROMAN}'].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, customTemplate: prev.customTemplate + ' ' + tag }))}
                          className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[10px] font-mono hover:bg-indigo-100 dark:hover:bg-indigo-500/30"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prefix & Suffix (if not custom) */}
                {config.format !== 'custom' && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Prefix Text
                      </label>
                      <input
                        type="text"
                        value={config.prefix}
                        onChange={(e) => setConfig((prev) => ({ ...prev, prefix: e.target.value }))}
                        placeholder="e.g. Doc - "
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Suffix Text
                      </label>
                      <input
                        type="text"
                        value={config.suffix}
                        onChange={(e) => setConfig((prev) => ({ ...prev, suffix: e.target.value }))}
                        placeholder="e.g.  (Final)"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* CARD 3: Page Range & Sequence Offset */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-500" />
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      3. Page Range & Sequences
                    </h3>
                  </div>
                </div>

                {/* Range Mode Selection */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'all', label: 'All Pages' },
                    { id: 'exclude-first', label: 'Skip Cover Page (P. 1)' },
                    { id: 'exclude-last', label: 'Skip Last Page' },
                    { id: 'exclude-first-last', label: 'Skip First & Last' },
                    { id: 'custom', label: 'Custom Range...' },
                  ].map((mode) => {
                    const isSelected = config.pageRangeMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => setConfig((prev) => ({ ...prev, pageRangeMode: mode.id as PageRangeMode }))}
                        className={`p-2.5 rounded-xl border text-xs font-medium text-left transition-all ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs'
                            : 'border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Range Syntax Input */}
                {config.pageRangeMode === 'custom' && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Enter Page Numbers or Ranges (e.g. 1-3, 5, 8-12)
                    </label>
                    <input
                      type="text"
                      value={config.customRange}
                      onChange={(e) => setConfig((prev) => ({ ...prev, customRange: e.target.value }))}
                      placeholder="e.g. 2-5, 8"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}

                {/* Number Offsets */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Start Numbering with Number:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={9999}
                        value={config.startAtNumber}
                        onChange={(e) => setConfig((prev) => ({ ...prev, startAtNumber: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                        className="w-24 px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                      <span className="text-[11px] text-slate-500">First numbered page becomes #{config.startAtNumber}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Start Numbering from Physical Page:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={totalPages || 999}
                        value={config.firstPageToNumber}
                        onChange={(e) => setConfig((prev) => ({ ...prev, firstPageToNumber: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                        className="w-24 px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                      <span className="text-[11px] text-slate-500">Pages before #{config.firstPageToNumber} are skipped</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 4: Typography & Styling */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-purple-500" />
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      4. Typography & Visual Styling
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Font Family */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Font Family
                    </label>
                    <select
                      value={config.fontFamily}
                      onChange={(e) => setConfig((prev) => ({ ...prev, fontFamily: e.target.value as any }))}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="Helvetica">Helvetica (Standard Sans)</option>
                      <option value="HelveticaBold">Helvetica Bold</option>
                      <option value="TimesRoman">Times New Roman (Serif)</option>
                      <option value="TimesRomanBold">Times New Roman Bold</option>
                      <option value="Courier">Courier (Monospace)</option>
                      <option value="CourierBold">Courier Bold</option>
                    </select>
                  </div>

                  {/* Font Size */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      <span>Font Size</span>
                      <span className="font-mono text-purple-600 dark:text-purple-400">{config.fontSize} pt</span>
                    </div>
                    <input
                      type="range"
                      min={8}
                      max={24}
                      step={1}
                      value={config.fontSize}
                      onChange={(e) => setConfig((prev) => ({ ...prev, fontSize: parseInt(e.target.value, 10) }))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>
                </div>

                {/* Color Palette & Custom Hex */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Text Color
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {COLOR_PALETTE.map((c) => {
                      const isSelected = config.color.toLowerCase() === c.hex.toLowerCase();
                      return (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, color: c.hex }))}
                          title={c.name}
                          className={`w-7 h-7 rounded-full border flex items-center justify-center transition-transform ${
                            isSelected ? 'scale-110 ring-2 ring-purple-500 ring-offset-2 dark:ring-offset-slate-900 border-white' : 'border-slate-300 dark:border-slate-600'
                          }`}
                          style={{ backgroundColor: c.hex }}
                        >
                          {isSelected && (
                            <Check className={`w-3.5 h-3.5 ${c.hex === '#ffffff' ? 'text-black' : 'text-white'}`} />
                          )}
                        </button>
                      );
                    })}

                    <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-700">
                      <input
                        type="color"
                        value={config.color}
                        onChange={(e) => setConfig((prev) => ({ ...prev, color: e.target.value }))}
                        className="w-7 h-7 rounded cursor-pointer border border-slate-300 dark:border-slate-700 bg-transparent"
                      />
                      <span className="text-[11px] font-mono text-slate-500">{config.color}</span>
                    </div>
                  </div>
                </div>

                {/* Contrast Badge Pill & Divider Line */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40">
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={config.showBadgePill}
                        onChange={(e) => setConfig((prev) => ({ ...prev, showBadgePill: e.target.checked }))}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Contrast Background Pill
                      </span>
                    </label>
                    {config.showBadgePill && (
                      <div className="flex items-center gap-1.5 pt-1">
                        {(['light', 'dark', 'glass'] as const).map((style) => (
                          <button
                            key={style}
                            type="button"
                            onClick={() => setConfig((prev) => ({ ...prev, badgePillColor: style }))}
                            className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize transition-colors ${
                              config.badgePillColor === style
                                ? 'bg-purple-600 text-white'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {style}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showDividerLine}
                        onChange={(e) => setConfig((prev) => ({ ...prev, showDividerLine: e.target.checked }))}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Header / Footer Divider Line
                      </span>
                    </label>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      Draws a thin aesthetic rule separating headers or footers from body text.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Interactive Live Canvas & Process Action (5 cols) */}
            <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-20">
              {/* Process Action Bar */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Apply Numbering Engine
                    </h3>
                    <p className="text-xs text-slate-500">
                      Numbers all eligible pages in seconds
                    </p>
                  </div>
                  <span className="text-xs font-mono text-sky-600 dark:text-sky-400 font-bold bg-sky-50 dark:bg-sky-500/10 px-2 py-1 rounded-lg border border-sky-200 dark:border-sky-500/20">
                    {totalPages} Pages
                  </span>
                </div>

                {isProcessing ? (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-500" />
                        {processingProgress.message}
                      </span>
                      <span className="font-bold text-sky-600 dark:text-sky-400">{processingProgress.percent}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-sky-500 to-blue-600 transition-all duration-200"
                        style={{ width: `${processingProgress.percent}%` }}
                      />
                    </div>
                  </div>
                ) : processedResult ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>PDF Numbered Successfully!</span>
                      </div>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                        {formatBytes(processedResult.fileSizeBytes)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={handleDownload}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Numbered PDF</span>
                      </button>
                      <button
                        onClick={() => window.open(processedResult.url, '_blank')}
                        className="py-2 px-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1 transition-colors"
                        title="Open in new browser tab"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleApplyPageNumbers}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold text-xs shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition-all transform active:scale-[0.99]"
                  >
                    <Hash className="w-4 h-4" />
                    <span>Process & Apply Page Numbers</span>
                  </button>
                )}
              </div>

              {/* LIVE VISUAL PREVIEW CARD */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                {/* Preview Toolbar */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-sky-500" />
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                      Live Document Preview
                    </h4>
                  </div>

                  {/* Zoom Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPreviewScale((s) => Math.max(0.4, s - 0.15))}
                      className="p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Zoom out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-mono text-slate-400 w-9 text-center">
                      {Math.round(previewScale * 100)}%
                    </span>
                    <button
                      onClick={() => setPreviewScale((s) => Math.min(1.6, s + 0.15))}
                      className="p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Zoom in"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Page Flip Navigation */}
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <button
                    disabled={currentPagePreview <= 1}
                    onClick={() => setCurrentPagePreview((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <span>Page</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={currentPagePreview}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 1 && val <= totalPages) {
                          setCurrentPagePreview(val);
                        }
                      }}
                      className="w-12 text-center py-0.5 text-xs font-mono rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                    />
                    <span>of {totalPages}</span>
                  </div>

                  <button
                    disabled={currentPagePreview >= totalPages}
                    onClick={() => setCurrentPagePreview((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Status indicator on current page */}
                <div className="flex items-center justify-between text-[11px] px-1">
                  <span className="text-slate-500">Numbering status on Page {currentPagePreview}:</span>
                  {isCurrentPageNumbered ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                      <Check className="w-3 h-3" />
                      Numbered ({currentPageText})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                      <Info className="w-3 h-3" />
                      Excluded by Page Range rule
                    </span>
                  )}
                </div>

                {/* Canvas Container with Overlaid Interactive Marker */}
                <div className="relative border border-slate-200 dark:border-slate-700 rounded-xl overflow-auto max-h-[480px] bg-slate-200/50 dark:bg-slate-950 flex items-center justify-center p-4">
                  <div className="relative shadow-xl rounded-sm overflow-hidden bg-white">
                    <canvas ref={canvasRef} className="block mx-auto" />

                    {/* LIVE OVERLAY MARKER */}
                    {isCurrentPageNumbered && (
                      <div
                        className="absolute pointer-events-none transition-all duration-150"
                        style={{
                          left:
                            horizAlign === 'left'
                              ? `${config.marginX * previewScale}px`
                              : horizAlign === 'center'
                              ? '50%'
                              : 'auto',
                          right:
                            horizAlign === 'right'
                              ? `${config.marginX * previewScale}px`
                              : 'auto',
                          transform:
                            horizAlign === 'center' ? 'translateX(-50%)' : 'none',
                          top:
                            vertAlign === 'top'
                              ? `${config.marginY * previewScale}px`
                              : 'auto',
                          bottom:
                            vertAlign === 'bottom'
                              ? `${config.marginY * previewScale}px`
                              : 'auto',
                        }}
                      >
                        <div
                          className={`inline-block px-1.5 py-0.5 rounded text-center whitespace-nowrap ring-1 ring-sky-400/80 animate-pulse ${
                            config.showBadgePill
                              ? config.badgePillColor === 'dark'
                                ? 'bg-slate-900 text-white'
                                : 'bg-white text-slate-900 border border-slate-200'
                              : 'bg-sky-500/20 backdrop-blur-[1px]'
                          }`}
                          style={{
                            fontSize: `${Math.max(8, config.fontSize * previewScale)}px`,
                            color: config.color,
                            opacity: config.opacity,
                            fontFamily: config.fontFamily.includes('Times')
                              ? 'serif'
                              : config.fontFamily.includes('Courier')
                              ? 'monospace'
                              : 'sans-serif',
                            fontWeight: config.fontFamily.includes('Bold') ? 'bold' : 'normal',
                          }}
                        >
                          {currentPageText}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-center text-[11px] text-slate-400">
                  Real-time preview reflects exact page typography, margins, and numbering logic.
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
