import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  FileImage,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Copy,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sliders,
  RotateCw,
  Image as ImageIcon,
  CheckSquare,
  Square,
  Eye,
  ArrowLeft,
  X,
  FileCheck,
  Package,
  Cpu,
  Info,
  Check,
  Filter,
  Palette
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { saveAs } from 'file-saver';
import { pdfjsLib, initPdfWorker } from '../services/pdfWorker';
import { ThemeToggle } from './ThemeToggle';
import {
  PdfToImageConfig,
  DEFAULT_PDF_TO_IMAGE_CONFIG,
  ImageFormat,
  DpiPreset,
  ColorMode,
  getScaleFromDpi,
  parseSelectedPages,
  renderAllSelectedPages,
  exportImagesAsZip,
  RenderedPageImageResult,
  generateSamplePdfForImageConverter,
  renderPdfPageToCanvas,
  canvasToBlob,
  canvasToDataUrl,
  formatOutputFilename
} from '../services/pdfToImageEngine';

interface PdfToImageConverterProps {
  onNavigateToDashboard: () => void;
}

interface PageThumbnailInfo {
  pageNumber: number;
  thumbnailUrl: string;
  widthPt: number;
  heightPt: number;
  aspectRatio: number;
  selected: boolean;
}

export const PdfToImageConverter: React.FC<PdfToImageConverterProps> = ({
  onNavigateToDashboard,
}) => {
  useEffect(() => {
    initPdfWorker();
  }, []);

  // Document State
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [pdfDocument, setPdfDocument] = useState<any | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [pageThumbnails, setPageThumbnails] = useState<PageThumbnailInfo[]>([]);
  const [isLoadingDoc, setIsLoadingDoc] = useState<boolean>(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');

  // Configuration State
  const [config, setConfig] = useState<PdfToImageConfig>({
    ...DEFAULT_PDF_TO_IMAGE_CONFIG,
  });
  const [customRangeInput, setCustomRangeInput] = useState<string>('all');
  const [customDpiInput, setCustomDpiInput] = useState<number>(150);
  const [selectedDpiPreset, setSelectedDpiPreset] = useState<DpiPreset>(150);

  // Conversion Execution & Results
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [convertProgress, setConvertProgress] = useState<{ percent: number; current: number; total: number; message: string }>({
    percent: 0,
    current: 0,
    total: 0,
    message: '',
  });
  const [renderedResults, setRenderedResults] = useState<RenderedPageImageResult[]>([]);
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);

  // UI Interactive States
  const [activeTab, setActiveTab] = useState<'configure' | 'preview_grid' | 'results'>('configure');
  const [inspectModalImage, setInspectModalImage] = useState<RenderedPageImageResult | null>(null);
  const [inspectZoom, setInspectZoom] = useState<number>(100);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Loading PDF
  const loadPdfFile = async (file: File) => {
    setIsLoadingDoc(true);
    setErrorMessage(null);
    setLoadingStatus('Reading document data...');
    setRenderedResults([]);

    try {
      const buffer = await file.arrayBuffer();
      setLoadingStatus('Parsing PDF structure...');
      const loadingTask = pdfjsLib.getDocument({ data: buffer });
      const pdf = await loadingTask.promise;

      setPdfDocument(pdf);
      setTotalPages(pdf.numPages);
      setCurrentFile(file);
      setConfig((prev) => ({
        ...prev,
        outputZipName: `${file.name.replace(/\.pdf$/i, '')}_Images.zip`,
      }));

      // Generate visual page thumbnails
      setLoadingStatus(`Rendering ${pdf.numPages} page thumbnails...`);
      const thumbs: PageThumbnailInfo[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.25 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await (page.render as any)({
            canvasContext: ctx,
            viewport,
          }).promise;
        }

        thumbs.push({
          pageNumber: i,
          thumbnailUrl: canvas.toDataURL('image/jpeg', 0.8),
          widthPt: Math.round(page.view[2] - page.view[0]),
          heightPt: Math.round(page.view[3] - page.view[1]),
          aspectRatio: viewport.width / viewport.height,
          selected: true, // select all by default
        });
      }

      setPageThumbnails(thumbs);
      setConfig((prev) => ({
        ...prev,
        selectedPageNumbers: thumbs.map((t) => t.pageNumber),
      }));

      setActiveTab('configure');
    } catch (err: any) {
      console.error('Failed to load PDF:', err);
      setErrorMessage(err.message || 'Failed to load PDF file.');
    } finally {
      setIsLoadingDoc(false);
      setLoadingStatus('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadPdfFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') {
      loadPdfFile(file);
    }
  };

  const handleLoadSample = async (preset: 'infographic' | 'presentation') => {
    setIsLoadingDoc(true);
    setLoadingStatus('Generating high-res vector sample document...');
    try {
      const sampleFile = await generateSamplePdfForImageConverter(preset);
      await loadPdfFile(sampleFile);
    } catch (err: any) {
      setErrorMessage('Failed to generate sample PDF: ' + err.message);
      setIsLoadingDoc(false);
    }
  };

  // Toggle Page Selection
  const togglePageSelection = (pageNum: number) => {
    setPageThumbnails((prev) =>
      prev.map((item) =>
        item.pageNumber === pageNum ? { ...item, selected: !item.selected } : item
      )
    );
  };

  // Sync selected page numbers to config
  useEffect(() => {
    const selected = pageThumbnails.filter((t) => t.selected).map((t) => t.pageNumber);
    setConfig((prev) => ({
      ...prev,
      selectedPageNumbers: selected,
    }));
  }, [pageThumbnails]);

  // Bulk Selection Helpers
  const selectAllPages = () => {
    setPageThumbnails((prev) => prev.map((item) => ({ ...item, selected: true })));
    setCustomRangeInput('all');
  };

  const deselectAllPages = () => {
    setPageThumbnails((prev) => prev.map((item) => ({ ...item, selected: false })));
  };

  const applyCustomRange = (rangeStr: string) => {
    setCustomRangeInput(rangeStr);
    if (!totalPages) return;
    const selectedList = parseSelectedPages(rangeStr, totalPages);
    setPageThumbnails((prev) =>
      prev.map((item) => ({
        ...item,
        selected: selectedList.includes(item.pageNumber),
      }))
    );
  };

  // DPI Preset Selection
  const handleSelectDpiPreset = (dpi: DpiPreset) => {
    setSelectedDpiPreset(dpi);
    if (dpi !== 'custom') {
      const scale = getScaleFromDpi(dpi);
      setConfig((prev) => ({ ...prev, dpi, scale }));
      setCustomDpiInput(dpi);
    }
  };

  const handleCustomDpiChange = (val: number) => {
    const clamped = Math.max(50, Math.min(600, val));
    setCustomDpiInput(clamped);
    setSelectedDpiPreset('custom');
    const scale = getScaleFromDpi(clamped);
    setConfig((prev) => ({ ...prev, dpi: clamped, scale }));
  };

  // Execute Conversion
  const handleStartConversion = async () => {
    if (!pdfDocument || !currentFile) return;

    const targetPages = config.selectedPageNumbers;
    if (targetPages.length === 0) {
      setErrorMessage('Please select at least one page to convert.');
      return;
    }

    setIsConverting(true);
    setErrorMessage(null);
    setConvertProgress({ percent: 0, current: 0, total: targetPages.length, message: 'Initializing canvas renderer...' });

    try {
      const results = await renderAllSelectedPages(
        pdfDocument,
        currentFile.name,
        config,
        (percent, current, total, message) => {
          setConvertProgress({ percent, current, total, message });
        }
      );

      setRenderedResults(results);
      setActiveTab('results');

      // Trigger Celebration Confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // ignore confetti errors
      }
    } catch (err: any) {
      console.error('Conversion failed:', err);
      setErrorMessage(err.message || 'Image rendering failed.');
    } finally {
      setIsConverting(false);
    }
  };

  // Download Individual Image
  const handleDownloadSingleImage = (item: RenderedPageImageResult) => {
    saveAs(item.blob, item.fileName);
  };

  // Copy Image to Clipboard
  const handleCopyImageToClipboard = async (item: RenderedPageImageResult) => {
    try {
      // Browsers support clipboard item for image/png
      let pngBlob = item.blob;
      if (config.format !== 'png') {
        // Convert to png blob on the fly for clipboard compatibility
        const img = new Image();
        img.src = item.dataUrl;
        await new Promise((res) => (img.onload = res));
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        pngBlob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
      }

      if (navigator.clipboard && (window as any).ClipboardItem) {
        await navigator.clipboard.write([
          new (window as any).ClipboardItem({
            'image/png': pngBlob,
          }),
        ]);
        setCopiedId(item.pageNumber);
        setTimeout(() => setCopiedId(null), 2500);
      } else {
        throw new Error('Clipboard API not supported in this browser context');
      }
    } catch (err) {
      console.warn('Could not copy image to clipboard:', err);
      // Fallback: download the file
      handleDownloadSingleImage(item);
    }
  };

  // Download All as ZIP
  const handleDownloadZip = async () => {
    if (renderedResults.length === 0) return;
    setIsExportingZip(true);
    try {
      const zipBlob = await exportImagesAsZip(renderedResults);
      const zipName = config.outputZipName.endsWith('.zip')
        ? config.outputZipName
        : `${config.outputZipName}.zip`;
      saveAs(zipBlob, zipName);
    } catch (err: any) {
      setErrorMessage('Failed to generate ZIP archive: ' + err.message);
    } finally {
      setIsExportingZip(false);
    }
  };

  // Calculated dimension estimation for preview
  const estimatedDimensions = useMemo(() => {
    if (!pageThumbnails.length) return { w: 0, h: 0, mp: 0 };
    const first = pageThumbnails[0];
    const w = Math.round((first.widthPt * config.dpi) / 72);
    const h = Math.round((first.heightPt * config.dpi) / 72);
    const mp = ((w * h) / 1000000).toFixed(1);
    return { w, h, mp };
  }, [pageThumbnails, config.dpi]);

  // Selected Count
  const selectedCount = config.selectedPageNumbers.length;

  return (
    <div className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans pb-16 transition-colors duration-200">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-xs dark:shadow-lg dark:shadow-black/20 transition-colors">
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateToDashboard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Document Tools Hub</span>
          </button>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20">
              <FileImage className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                PDF to Image Converter
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                  Ultra-HD DPI
                </span>
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentFile && (
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">{currentFile.name}</span>
              <span className="text-slate-400 dark:text-slate-500">•</span>
              <span>{totalPages} {totalPages === 1 ? 'page' : 'pages'}</span>
              <span className="text-slate-400 dark:text-slate-500">•</span>
              <span>{(currentFile.size / (1024 * 1024)).toFixed(2)} MB</span>
            </div>
          )}
          {currentFile && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-medium border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Change File</span>
            </button>
          )}
          <ThemeToggle variant="icon" />
        </div>
      </header>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="p-1 hover:bg-rose-500/20 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* State 1: Upload / Drop Zone when no document is loaded */}
        {!currentFile && !isLoadingDoc && (
          <div className="max-w-3xl mx-auto space-y-6 pt-6">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="group cursor-pointer rounded-2xl border-2 border-dashed border-slate-700 hover:border-emerald-500/60 bg-slate-900/60 hover:bg-slate-900/90 p-10 sm:p-14 text-center transition-all duration-300 relative overflow-hidden shadow-2xl"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />
              <div className="max-w-md mx-auto space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-300">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                    Upload PDF Document to Convert
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Drag and drop your PDF here, or click to browse from your device
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 text-xs border border-slate-700">
                  <span>Extract PNG, JPG, or WebP at up to 600 DPI</span>
                </div>
              </div>
            </div>

            {/* Instant Sample PDF Buttons */}
            <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Or test immediately with built-in rich sample PDFs:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handleLoadSample('infographic')}
                  className="p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/40 text-left transition-all group flex items-start gap-3"
                >
                  <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 group-hover:scale-110 transition-transform">
                    <FileImage className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-teal-300">
                      Cloud Architecture Infographic
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      2-Page vector layout with stat cards, bar charts & flow pipelines
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleLoadSample('presentation')}
                  className="p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500/40 text-left transition-all group flex items-start gap-3"
                >
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-indigo-300">
                      Quantum Compute Slide Deck
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Landscape presentation slides with high-contrast typography
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Feature Highlights Bento */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2">
                <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Lossless & High-DPI</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Support for 72 to 600 DPI rendering ensures crisp vector text and razor-sharp diagrams for print or Retina displays.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2">
                <div className="text-xs font-semibold text-teal-400 flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  <span>Selective Extraction</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Visual thumbnail grid lets you click to select specific pages or enter custom syntax ranges like 1, 3, 5-8.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2">
                <div className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
                  <Package className="w-4 h-4" />
                  <span>ZIP Batch Packaging</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Package all converted images with customizable sequential naming patterns into an organized ZIP archive.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {isLoadingDoc && (
          <div className="py-24 flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
            <div className="text-sm font-semibold text-white">{loadingStatus || 'Processing Document...'}</div>
            <div className="text-xs text-slate-400">Rendering high-speed visual tiles</div>
          </div>
        )}

        {/* State 2: Document Loaded & Configuration Stage */}
        {currentFile && !isLoadingDoc && (
          <div className="space-y-6">
            {/* View Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('configure')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    activeTab === 'configure'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Conversion Settings</span>
                </button>

                <button
                  onClick={() => setActiveTab('preview_grid')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    activeTab === 'preview_grid'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Page Selector ({selectedCount}/{totalPages})</span>
                </button>

                {renderedResults.length > 0 && (
                  <button
                    onClick={() => setActiveTab('results')}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                      activeTab === 'results'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Converted Images ({renderedResults.length})</span>
                  </button>
                )}
              </div>

              {/* Conversion Trigger Button */}
              <button
                onClick={handleStartConversion}
                disabled={isConverting || selectedCount === 0}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:brightness-110 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {isConverting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Converting {convertProgress.current}/{convertProgress.total}...</span>
                  </>
                ) : (
                  <>
                    <FileImage className="w-4 h-4" />
                    <span>Convert {selectedCount} {selectedCount === 1 ? 'Page' : 'Pages'} to {config.format.toUpperCase()}</span>
                  </>
                )}
              </button>
            </div>

            {/* Converting Progress Bar */}
            {isConverting && (
              <div className="p-5 rounded-2xl bg-slate-900 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-400">{convertProgress.message}</span>
                  <span className="font-mono font-bold text-white">{convertProgress.percent}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-teal-500 to-emerald-500 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${convertProgress.percent}%` }}
                  />
                </div>
              </div>
            )}

            {/* TAB 1: CONFIGURE SETTINGS */}
            {activeTab === 'configure' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Format & Resolution Controls */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Format Selector */}
                  <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-emerald-400" />
                        Target Image Format
                      </label>
                      <span className="text-[11px] text-slate-400">Choose compression & quality profile</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* PNG */}
                      <button
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, format: 'png' }))}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                          config.format === 'png'
                            ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-md shadow-emerald-500/10'
                            : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm">PNG</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                            Lossless
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                          Pixel-perfect clarity, razor-sharp text & transparency support. Ideal for diagrams & presentations.
                        </p>
                      </button>

                      {/* JPEG */}
                      <button
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, format: 'jpeg' }))}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                          config.format === 'jpeg'
                            ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-md shadow-emerald-500/10'
                            : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm">JPEG / JPG</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
                            Compact
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                          Small file sizes with adjustable lossy compression. Best for photos, scans, and web sharing.
                        </p>
                      </button>

                      {/* WebP */}
                      <button
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, format: 'webp' }))}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                          config.format === 'webp'
                            ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-md shadow-emerald-500/10'
                            : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm">WebP</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 font-semibold">
                            Modern Web
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                          Next-gen web format offering 30% higher compression efficiency than standard JPEG with crisp edges.
                        </p>
                      </button>
                    </div>

                    {/* JPEG / WebP Quality Slider */}
                    {(config.format === 'jpeg' || config.format === 'webp') && (
                      <div className="pt-3 border-t border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300 font-medium">Quality Compression Ratio</span>
                          <span className="font-mono text-emerald-400 font-bold">
                            {Math.round(config.jpegQuality * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.05"
                          value={config.jpegQuality}
                          onChange={(e) =>
                            setConfig((prev) => ({ ...prev, jpegQuality: parseFloat(e.target.value) }))
                          }
                          className="w-full accent-emerald-500 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>

                  {/* Resolution & DPI Scaling */}
                  <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-teal-400" />
                        Rendering Resolution (DPI)
                      </label>
                      <span className="text-[11px] text-slate-400">Higher DPI yields sharper detail & larger files</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { dpi: 72, label: '72 DPI', desc: 'Web Preview (1.0x)' },
                        { dpi: 150, label: '150 DPI', desc: 'Screen / Slides (2.08x)' },
                        { dpi: 300, label: '300 DPI', desc: 'High-Res Print (4.16x)' },
                        { dpi: 600, label: '600 DPI', desc: 'Ultra Archival (8.33x)' },
                      ].map((item) => (
                        <button
                          key={item.dpi}
                          type="button"
                          onClick={() => handleSelectDpiPreset(item.dpi as DpiPreset)}
                          className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                            selectedDpiPreset === item.dpi
                              ? 'bg-teal-500/10 border-teal-500 text-white'
                              : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="font-bold text-xs text-white">{item.label}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                        </button>
                      ))}
                    </div>

                    {/* Custom DPI Slider */}
                    <div className="pt-3 border-t border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium">Custom DPI Multiplier</span>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span className="text-teal-400 font-bold">{config.dpi} DPI</span>
                          <span className="text-slate-500">({(config.scale).toFixed(2)}x scale)</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="600"
                        step="25"
                        value={customDpiInput}
                        onChange={(e) => handleCustomDpiChange(parseInt(e.target.value, 10))}
                        className="w-full accent-teal-500 cursor-pointer"
                      />
                    </div>

                    {/* Dimension Estimate Banner */}
                    <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Info className="w-4 h-4 text-teal-400 shrink-0" />
                        <span>Estimated page dimensions at {config.dpi} DPI:</span>
                      </div>
                      <div className="font-mono font-bold text-white">
                        {estimatedDimensions.w} × {estimatedDimensions.h} px ({estimatedDimensions.mp} MP)
                      </div>
                    </div>
                  </div>

                  {/* Color Mode & Filters */}
                  <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                    <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Palette className="w-4 h-4 text-emerald-400" />
                      Color Processing & Adjustments
                    </label>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { id: 'color', label: 'Full Color', desc: 'Original RGB palette' },
                        { id: 'grayscale', label: 'Grayscale', desc: 'Clean monochrome' },
                        { id: 'bw_binarized', label: 'Document B&W', desc: 'High contrast text' },
                        { id: 'inverted', label: 'Inverted Dark', desc: 'White on black' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, colorMode: item.id as ColorMode }))}
                          className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                            config.colorMode === item.id
                              ? 'bg-emerald-500/10 border-emerald-500 text-white'
                              : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="font-bold text-xs text-white">{item.label}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                        </button>
                      ))}
                    </div>

                    {/* Sliders: Brightness, Contrast & Rotation */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-800">
                      {/* Brightness */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Brightness</span>
                          <span className="font-mono text-slate-200">{Math.round(config.brightness * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="1.5"
                          step="0.05"
                          value={config.brightness}
                          onChange={(e) => setConfig((prev) => ({ ...prev, brightness: parseFloat(e.target.value) }))}
                          className="w-full accent-emerald-500 cursor-pointer"
                        />
                      </div>

                      {/* Contrast */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Contrast</span>
                          <span className="font-mono text-slate-200">{Math.round(config.contrast * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="1.5"
                          step="0.05"
                          value={config.contrast}
                          onChange={(e) => setConfig((prev) => ({ ...prev, contrast: parseFloat(e.target.value) }))}
                          className="w-full accent-emerald-500 cursor-pointer"
                        />
                      </div>

                      {/* Rotation */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Page Rotation</span>
                          <span className="font-mono text-slate-200">{config.rotation}°</span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setConfig((prev) => ({
                              ...prev,
                              rotation: ((prev.rotation + 90) % 360) as 0 | 90 | 180 | 270,
                            }))
                          }
                          className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                        >
                          <RotateCw className="w-3.5 h-3.5 text-teal-400" />
                          <span>Rotate +90°</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Output File Naming & Page Scope Summary */}
                <div className="space-y-6">
                  {/* Scope & Naming Card */}
                  <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                    <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Package className="w-4 h-4 text-emerald-400" />
                      Output File Settings
                    </label>

                    {/* File Naming Pattern */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-300 font-medium">Image File Naming Pattern</label>
                      <input
                        type="text"
                        value={config.namingPattern}
                        onChange={(e) => setConfig((prev) => ({ ...prev, namingPattern: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                        placeholder="[name]_page_[page]"
                      />
                      <p className="text-[10px] text-slate-500">
                        Variables: <code className="text-emerald-400">[name]</code>, <code className="text-emerald-400">[page]</code> (001), <code className="text-emerald-400">[raw_page]</code> (1)
                      </p>
                    </div>

                    {/* Sample Filename Live Preview */}
                    <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Live Preview Name:</span>
                      <div className="font-mono text-emerald-300 truncate">
                        {currentFile
                          ? formatOutputFilename(currentFile.name, 1, config.format, config.namingPattern)
                          : 'Sample_page_001.png'}
                      </div>
                    </div>

                    {/* Output ZIP File Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-300 font-medium">ZIP Archive Name</label>
                      <input
                        type="text"
                        value={config.outputZipName}
                        onChange={(e) => setConfig((prev) => ({ ...prev, outputZipName: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                        placeholder="Extracted_Images.zip"
                      />
                    </div>
                  </div>

                  {/* Page Selection Quick Bar */}
                  <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Layers className="w-4 h-4 text-teal-400" />
                        Selected Pages
                      </label>
                      <span className="text-xs font-bold text-emerald-400">
                        {selectedCount} of {totalPages} selected
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={selectAllPages}
                        className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Select All ({totalPages})</span>
                      </button>
                      <button
                        type="button"
                        onClick={deselectAllPages}
                        className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
                      >
                        <Square className="w-3.5 h-3.5 text-slate-400" />
                        <span>Deselect All</span>
                      </button>
                    </div>

                    {/* Quick Syntax Preset Buttons */}
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Odd Pages', val: 'odd' },
                        { label: 'Even Pages', val: 'even' },
                        { label: 'First Page', val: 'first' },
                        { label: 'Last Page', val: 'last' },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => applyCustomRange(preset.val)}
                          className="px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700/60"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    {/* Custom Range Input */}
                    <div className="space-y-1.5 pt-2">
                      <label className="text-xs text-slate-300 font-medium">Custom Page Syntax Range</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={customRangeInput}
                          onChange={(e) => setCustomRangeInput(e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                          placeholder="e.g. 1, 3, 5-8"
                        />
                        <button
                          type="button"
                          onClick={() => applyCustomRange(customRangeInput)}
                          className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                        >
                          Apply
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('preview_grid')}
                      className="w-full py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center justify-center gap-2 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Open Visual Page Selector Grid</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: VISUAL PAGE SELECTOR GRID */}
            {activeTab === 'preview_grid' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Click any thumbnail to toggle selection
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                      {selectedCount} Selected
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllPages}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllPages}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>

                {/* Thumbnails Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {pageThumbnails.map((thumb) => (
                    <div
                      key={thumb.pageNumber}
                      onClick={() => togglePageSelection(thumb.pageNumber)}
                      className={`group relative rounded-xl p-2.5 border transition-all cursor-pointer flex flex-col justify-between ${
                        thumb.selected
                          ? 'bg-emerald-500/10 border-emerald-500 shadow-lg shadow-emerald-500/10'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 opacity-60 hover:opacity-100'
                      }`}
                    >
                      {/* Checkbox Badge */}
                      <div className="absolute top-4 right-4 z-10">
                        {thumb.selected ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-slate-500 bg-slate-800/80 group-hover:border-slate-300" />
                        )}
                      </div>

                      {/* Page Thumbnail Image */}
                      <div className="w-full aspect-[1/1.3] bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center p-1 border border-slate-800">
                        <img
                          src={thumb.thumbnailUrl}
                          alt={`Page ${thumb.pageNumber}`}
                          className="max-h-full max-w-full object-contain rounded shadow-sm group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>

                      {/* Footer Info */}
                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-200">Page {thumb.pageNumber}</span>
                        <span className="text-slate-500 font-mono">{thumb.widthPt}×{thumb.heightPt}pt</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: CONVERTED IMAGES RESULTS GALLERY */}
            {activeTab === 'results' && renderedResults.length > 0 && (
              <div className="space-y-6">
                {/* Results Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-850 border border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-emerald-400" />
                      Successfully Rendered {renderedResults.length} Images ({config.format.toUpperCase()} • {config.dpi} DPI)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ready for immediate individual download, clipboard copy, or all-in-one ZIP archive export.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleDownloadZip}
                      disabled={isExportingZip}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:brightness-110 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
                    >
                      {isExportingZip ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Generating ZIP...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Download All as ZIP (.zip)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Images Results Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {renderedResults.map((item) => (
                    <div
                      key={item.pageNumber}
                      className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 flex flex-col justify-between group hover:border-emerald-500/40 transition-colors shadow-lg"
                    >
                      {/* Image Preview Canvas Card */}
                      <div
                        onClick={() => {
                          setInspectModalImage(item);
                          setInspectZoom(100);
                        }}
                        className="relative aspect-[1/1.3] bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center p-2 border border-slate-800/80 cursor-pointer group-hover:border-slate-700"
                      >
                        <img
                          src={item.dataUrl}
                          alt={item.fileName}
                          className="max-h-full max-w-full object-contain rounded shadow"
                        />
                        {/* Hover Overlay Zoom Icon */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <div className="p-2.5 rounded-full bg-slate-900/90 text-emerald-400 border border-emerald-500/30">
                            <Maximize2 className="w-4 h-4" />
                          </div>
                        </div>
                        {/* Top Left Page Badge */}
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-900/90 text-emerald-400 font-bold text-[10px] border border-slate-700">
                          Page {item.pageNumber}
                        </div>
                      </div>

                      {/* Meta Info */}
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-white truncate font-mono" title={item.fileName}>
                          {item.fileName}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                          <span>{item.width} × {item.height} px</span>
                          <span>{(item.fileSizeBytes / 1024).toFixed(1)} KB</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleCopyImageToClipboard(item)}
                          className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
                        >
                          {copiedId === item.pageNumber ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400 text-[11px]">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-[11px]">Copy</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadSingleImage(item)}
                          className="py-1.5 px-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-emerald-500/30 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span className="text-[11px]">Save</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Inspect Modal Dialog for High-Res Zoom */}
      {inspectModalImage && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col p-4 sm:p-6 animate-in fade-in duration-200">
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs">
                Page {inspectModalImage.pageNumber} Inspector
              </span>
              <span className="text-xs font-mono text-slate-300 hidden sm:inline">{inspectModalImage.fileName}</span>
              <span className="text-xs font-mono text-slate-400">
                ({inspectModalImage.width} × {inspectModalImage.height} px • {(inspectModalImage.fileSizeBytes / 1024).toFixed(1)} KB)
              </span>
            </div>

            {/* Zoom Controls & Close */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setInspectZoom((z) => Math.max(25, z - 25))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono font-bold text-white px-2">{inspectZoom}%</span>
              <button
                onClick={() => setInspectZoom((z) => Math.min(300, z + 25))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setInspectZoom(100)}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                100%
              </button>
              <div className="h-4 w-px bg-slate-800 mx-1" />
              <button
                onClick={() => handleDownloadSingleImage(inspectModalImage)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
              <button
                onClick={() => setInspectModalImage(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Image Viewer Area */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-slate-950/60 rounded-2xl my-4 border border-slate-800">
            <img
              src={inspectModalImage.dataUrl}
              alt={inspectModalImage.fileName}
              style={{ width: `${inspectZoom}%`, maxWidth: 'none' }}
              className="rounded shadow-2xl transition-all duration-150"
            />
          </div>
        </div>
      )}
    </div>
  );
};
