import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Upload,
  FileText,
  Trash2,
  Download,
  Eye,
  Sliders,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  PenTool,
  Type,
  Image as ImageIcon,
  Eraser,
  Lock,
  Stamp,
  Layers,
  Palette,
  RotateCw,
  Grid,
  FileDown,
  Check,
  Copy,
  Info,
  Shield,
  EyeOff,
  HelpCircle,
  Move
} from 'lucide-react';
import {
  SecurityProcessingConfig,
  DEFAULT_SECURITY_CONFIG,
  applySecurityAndWatermarkToPdf,
  generateGraphicStampDataUrl,
  generateCalligraphicSignature,
  removeWhiteBackgroundFromImage,
  generateSampleSecurityPdf,
  StampType,
  WatermarkMode,
  RedactionBox
} from '../services/pdfSecurityEngine';
import { pdfjsLib } from '../services/pdfWorker';
import { saveAs } from 'file-saver';
import confetti from 'canvas-confetti';
import { ThemeToggle } from './ThemeToggle';

interface PdfSecuritySignerProps {
  onNavigateToDashboard: () => void;
}

const PRESET_WATERMARK_TEXTS = [
  'CONFIDENTIAL',
  'DO NOT COPY',
  'DRAFT',
  'TOP SECRET',
  'FOR AUDIT ONLY',
  'INTERNAL USE ONLY',
  'SAMPLE',
  'COPYRIGHT PROTECTED'
];

const PRESET_COLORS = [
  { name: 'Crimson Red', hex: '#ef4444' },
  { name: 'Ocean Blue', hex: '#3b82f6' },
  { name: 'Slate Gray', hex: '#64748b' },
  { name: 'Amber Gold', hex: '#f59e0b' },
  { name: 'Emerald Green', hex: '#10b981' },
  { name: 'Royal Purple', hex: '#8b5cf6' },
  { name: 'Dark Ink', hex: '#0f172a' }
];

const STAMP_PRESETS: { type: StampType; label: string; color: string; desc: string }[] = [
  { type: 'confidential', label: 'CONFIDENTIAL', color: '#dc2626', desc: 'Strictly Proprietary' },
  { type: 'approved', label: 'APPROVED', color: '#16a34a', desc: 'Passed Legal & Compliance' },
  { type: 'rejected', label: 'REJECTED', color: '#b91c1c', desc: 'Do Not Execute' },
  { type: 'paid', label: 'PAID IN FULL', color: '#2563eb', desc: 'Transaction Complete' },
  { type: 'verified', label: 'VERIFIED', color: '#059669', desc: 'Identity Confirmed' },
  { type: 'urgent', label: 'URGENT', color: '#d97706', desc: 'Immediate Action' },
  { type: 'official', label: 'OFFICIAL SEAL', color: '#7c3aed', desc: 'Authorized Repository' }
];

export const PdfSecuritySigner: React.FC<PdfSecuritySignerProps> = ({ onNavigateToDashboard }) => {
  // Document State
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [pdfDocument, setPdfDocument] = useState<any | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPageNum, setCurrentPageNum] = useState<number>(1);
  const [renderedPageImage, setRenderedPageImage] = useState<string | null>(null);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({ width: 612, height: 792 });
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [isLoadingDoc, setIsLoadingDoc] = useState<boolean>(false);

  // Active Configuration
  const [config, setConfig] = useState<SecurityProcessingConfig>(DEFAULT_SECURITY_CONFIG);
  const [activeTab, setActiveTab] = useState<'watermark' | 'stamp' | 'signature' | 'security'>('watermark');

  // Signature Sub-State
  const [sigMode, setSigMode] = useState<'draw' | 'type' | 'upload'>('type');
  const [drawnSigData, setDrawnSigData] = useState<string | null>(null);
  const [typedSigName, setTypedSigName] = useState<string>('Alexander Vance');
  const [sigInkColor, setSigInkColor] = useState<string>('#1e40af');
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawHistory, setDrawHistory] = useState<string[]>([]);
  const [isPlacingSignature, setIsPlacingSignature] = useState<boolean>(false);
  const [isPlacingRedaction, setIsPlacingRedaction] = useState<boolean>(false);

  // Processing & Export State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [processedBlobUrl, setProcessedBlobUrl] = useState<string | null>(null);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // Canvas Refs
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sigFileInputRef = useRef<HTMLInputElement | null>(null);
  const stampFileInputRef = useRef<HTMLInputElement | null>(null);

  // Show status notification helper
  const notify = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => setStatusNotification(null), 4000);
  };

  // Load PDF Document
  const loadPdfFile = useCallback(async (file: File) => {
    try {
      setIsLoadingDoc(true);
      setCurrentFile(file);
      const buffer = await file.arrayBuffer();
      setFileBuffer(buffer);

      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      const pdf = await loadingTask.promise;
      setPdfDocument(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPageNum(1);
      setConfig((prev) => ({
        ...prev,
        outputFilename: file.name.replace(/\.pdf$/i, '_Secured.pdf'),
        signature: {
          ...prev.signature,
          targetPage: 1
        }
      }));
      notify(`Loaded "${file.name}" (${pdf.numPages} pages)`);
    } catch (err: any) {
      console.error('Error loading PDF:', err);
      notify('Failed to load PDF file. Please ensure it is a valid document.');
    } finally {
      setIsLoadingDoc(false);
    }
  }, []);

  // Render Current Page
  useEffect(() => {
    if (!pdfDocument || totalPages === 0) return;

    let isMounted = true;
    const renderPage = async () => {
      try {
        const page = await pdfDocument.getPage(currentPageNum);
        const viewport = page.getViewport({ scale: 1.5 });
        setPageDimensions({ width: viewport.width, height: viewport.height });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          await (page.render as any)({ canvasContext: ctx, viewport, canvas }).promise;
          if (isMounted) {
            setRenderedPageImage(canvas.toDataURL('image/jpeg', 0.9));
          }
        }
      } catch (err) {
        console.error('Error rendering page:', err);
      }
    };

    renderPage();
    return () => {
      isMounted = false;
    };
  }, [pdfDocument, currentPageNum]);

  // Initial Sample PDF Load
  useEffect(() => {
    if (!currentFile && !fileBuffer) {
      handleLoadSample('nda');
    }
  }, []);

  // Sync Signature Data URL
  useEffect(() => {
    if (sigMode === 'type') {
      const calligraphicDataUrl = generateCalligraphicSignature(typedSigName, sigInkColor);
      setConfig((prev) => ({
        ...prev,
        signature: {
          ...prev.signature,
          dataUrl: calligraphicDataUrl,
          signerName: typedSigName,
          inkColor: sigInkColor
        }
      }));
    } else if (sigMode === 'draw' && drawnSigData) {
      setConfig((prev) => ({
        ...prev,
        signature: {
          ...prev.signature,
          dataUrl: drawnSigData,
          signerName: typedSigName,
          inkColor: sigInkColor
        }
      }));
    }
  }, [sigMode, typedSigName, sigInkColor, drawnSigData]);

  // Handle Load Sample
  const handleLoadSample = async (preset: 'nda' | 'contract') => {
    try {
      setIsLoadingDoc(true);
      const sampleFile = await generateSampleSecurityPdf(preset);
      await loadPdfFile(sampleFile);
    } catch (err) {
      console.error('Error generating sample:', err);
    } finally {
      setIsLoadingDoc(false);
    }
  };

  // Drawing Pad Canvas Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = sigInkColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setDrawnSigData(dataUrl);
    setDrawHistory((prev) => [...prev, dataUrl]);
  };

  const clearDrawingPad = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDrawnSigData(null);
    setDrawHistory([]);
  };

  // Upload Signature Image Handler with Auto-transparency
  const handleUploadSignatureFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const transparentSig = removeWhiteBackgroundFromImage(img, 230);
        setConfig((prev) => ({
          ...prev,
          signature: {
            ...prev.signature,
            dataUrl: transparentSig,
            enabled: true
          }
        }));
        notify('Signature uploaded and transparent background applied!');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Upload Custom Stamp Image Handler
  const handleUploadStampImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setConfig((prev) => ({
        ...prev,
        stampWatermark: {
          ...prev.stampWatermark,
          enabled: true,
          type: 'custom',
          customImageDataUrl: dataUrl
        }
      }));
      notify('Custom stamp image attached!');
    };
    reader.readAsDataURL(file);
  };

  // Handle PDF Preview Click for Placing Signature or Redactions
  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const xPercent = Math.round((clickX / rect.width) * 100);
    const yPercent = Math.round((clickY / rect.height) * 100);

    if (isPlacingSignature) {
      setConfig((prev) => ({
        ...prev,
        signature: {
          ...prev.signature,
          enabled: true,
          targetPage: currentPageNum,
          posXPercent: Math.max(5, Math.min(80, xPercent - 15)),
          posYPercent: Math.max(5, Math.min(90, yPercent - 5))
        }
      }));
      setIsPlacingSignature(false);
      notify(`Signature placed on Page ${currentPageNum} at (${xPercent}%, ${yPercent}%)`);
    } else if (isPlacingRedaction) {
      const newRedaction: RedactionBox = {
        id: `red_${Date.now()}`,
        pageNumber: currentPageNum,
        xPercent: Math.max(0, Math.min(85, xPercent - 10)),
        yPercent: Math.max(0, Math.min(90, yPercent - 2)),
        widthPercent: 25,
        heightPercent: 4,
        label: 'CONFIDENTIAL / REDACTED'
      };
      setConfig((prev) => ({
        ...prev,
        redactions: [...prev.redactions, newRedaction]
      }));
      setIsPlacingRedaction(false);
      notify(`Blackout redaction placed on Page ${currentPageNum}`);
    }
  };

  // Execute Security & Watermark Export Pipeline
  const handleProcessAndExport = async () => {
    if (!fileBuffer && !currentFile) {
      notify('Please select or load a PDF document first.');
      return;
    }

    try {
      setIsProcessing(true);
      setProgressPercent(10);
      setProgressMessage('Initializing security cryptographic streams...');

      const bufferToProcess = fileBuffer || (await currentFile!.arrayBuffer());

      const securedBytes = await applySecurityAndWatermarkToPdf(
        bufferToProcess,
        config,
        (percent, msg) => {
          setProgressPercent(percent);
          setProgressMessage(msg);
        }
      );

      const blob = new Blob([securedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setProcessedBlobUrl(url);

      saveAs(blob, config.outputFilename || 'Secured_Document.pdf');

      confetti({
        particleCount: 80,
        spread: 65,
        origin: { y: 0.85 }
      });

      notify('Document secured, watermarked, and saved successfully!');
    } catch (err: any) {
      console.error('Error applying security:', err);
      notify('Failed to process document. ' + (err?.message || ''));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Top Header */}
      <header className="bg-white/95 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 px-4 py-3 sm:px-6 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateToDashboard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Suite</span>
            </button>
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 text-sky-600 dark:text-sky-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <span>PDF Security, Watermark & Sign</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-normal border border-sky-200 dark:border-sky-500/30">
                    AES-Ready
                  </span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                  Watermark stamping, digital calligraphy signatures, redactions & metadata protection
                </p>
              </div>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="hidden md:flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-lg">
              <button
                onClick={() => handleLoadSample('nda')}
                className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
              >
                Sample NDA
              </button>
              <button
                onClick={() => handleLoadSample('contract')}
                className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
              >
                Sample Contract
              </button>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span>Open PDF</span>
            </button>

            <button
              onClick={handleProcessAndExport}
              disabled={isProcessing || !fileBuffer}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-lg shadow-sky-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Securing ({progressPercent}%)...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Save & Download PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Status Notification Banner */}
      {statusNotification && (
        <div className="bg-sky-950/80 border-b border-sky-800/60 px-4 py-2 text-center text-xs font-medium text-sky-200 flex items-center justify-center gap-2 transition-all">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span>{statusNotification}</span>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) loadPdfFile(file);
        }}
      />
      <input
        ref={sigFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUploadSignatureFile}
      />
      <input
        ref={stampFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUploadStampImage}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Security & Customization Studio (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Module Tabs Header */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-1.5 grid grid-cols-4 gap-1">
            <button
              onClick={() => setActiveTab('watermark')}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'watermark'
                  ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Watermark</span>
            </button>
            <button
              onClick={() => setActiveTab('stamp')}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'stamp'
                  ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Stamp className="w-3.5 h-3.5" />
              <span>Stamps</span>
            </button>
            <button
              onClick={() => setActiveTab('signature')}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'signature'
                  ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Signature</span>
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'security'
                  ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Privacy</span>
            </button>
          </div>

          {/* Tab 1: TEXT WATERMARK CONTROLS */}
          {activeTab === 'watermark' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <h2 className="text-sm font-semibold text-white">Text Watermark Engine</h2>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.textWatermark.enabled}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        textWatermark: { ...prev.textWatermark, enabled: e.target.checked }
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                </label>
              </div>

              {/* Watermark Presets */}
              <div>
                <label className="text-xs font-medium text-slate-300 mb-2 block">Quick Text Presets</label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_WATERMARK_TEXTS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          textWatermark: { ...prev.textWatermark, text: preset, enabled: true }
                        }))
                      }
                      className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                        config.textWatermark.text === preset
                          ? 'bg-sky-600 text-white font-medium shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Text Input */}
              <div>
                <label className="text-xs font-medium text-slate-300 mb-1.5 block">Custom Watermark String</label>
                <input
                  type="text"
                  value={config.textWatermark.text}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      textWatermark: { ...prev.textWatermark, text: e.target.value }
                    }))
                  }
                  placeholder="e.g. STRICTLY CONFIDENTIAL - DO NOT DISTRIBUTE"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Layout Mode */}
              <div>
                <label className="text-xs font-medium text-slate-300 mb-1.5 block">Watermark Layout Pattern</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'diagonal_center', label: 'Diagonal Center', icon: RotateCw },
                    { id: 'tiled_grid', label: 'Repeating Grid', icon: Grid },
                    { id: 'header_footer', label: 'Header & Footer', icon: Layers }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          textWatermark: { ...prev.textWatermark, mode: mode.id as WatermarkMode }
                        }))
                      }
                      className={`p-2 rounded-lg border text-xs flex flex-col items-center gap-1.5 transition-all ${
                        config.textWatermark.mode === mode.id
                          ? 'bg-sky-950/40 border-sky-500 text-sky-400'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <mode.icon className="w-3.5 h-3.5" />
                      <span className="text-[11px]">{mode.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Family & Color Palette */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 mb-1.5 block">Font Typography</label>
                  <select
                    value={config.textWatermark.fontFamily}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        textWatermark: { ...prev.textWatermark, fontFamily: e.target.value as any }
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="HelveticaBold">Helvetica Bold</option>
                    <option value="TimesRomanBold">Times Roman Bold</option>
                    <option value="CourierBold">Courier Typewriter</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 mb-1.5 block">Watermark Color</label>
                  <div className="flex items-center gap-1.5">
                    {PRESET_COLORS.slice(0, 5).map((col) => (
                      <button
                        key={col.hex}
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            textWatermark: { ...prev.textWatermark, color: col.hex }
                          }))
                        }
                        style={{ backgroundColor: col.hex }}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          config.textWatermark.color === col.hex ? 'border-white scale-110' : 'border-transparent opacity-80 hover:opacity-100'
                        }`}
                        title={col.name}
                      />
                    ))}
                    <input
                      type="color"
                      value={config.textWatermark.color}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          textWatermark: { ...prev.textWatermark, color: e.target.value }
                        }))
                      }
                      className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Sliders: Opacity, Font Size, Rotation */}
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>Opacity: {Math.round(config.textWatermark.opacity * 100)}%</span>
                    <span className="text-slate-500">Subtle vs Prominent</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.9"
                    step="0.05"
                    value={config.textWatermark.opacity}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        textWatermark: { ...prev.textWatermark, opacity: parseFloat(e.target.value) }
                      }))
                    }
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>Font Size: {config.textWatermark.fontSize}pt</span>
                  </div>
                  <input
                    type="range"
                    min="18"
                    max="96"
                    step="2"
                    value={config.textWatermark.fontSize}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        textWatermark: { ...prev.textWatermark, fontSize: parseInt(e.target.value) }
                      }))
                    }
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>Rotation Angle: {config.textWatermark.rotation}°</span>
                  </div>
                  <input
                    type="range"
                    min="-90"
                    max="90"
                    step="5"
                    value={config.textWatermark.rotation}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        textWatermark: { ...prev.textWatermark, rotation: parseInt(e.target.value) }
                      }))
                    }
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 mb-1 block">Apply to Pages</label>
                  <select
                    value={config.textWatermark.pageRange}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        textWatermark: { ...prev.textWatermark, pageRange: e.target.value }
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="all">All Pages (1 to {totalPages || 1})</option>
                    <option value="first">First Page Only</option>
                    <option value="odd">Odd Pages Only</option>
                    <option value="even">Even Pages Only</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: STAMP WATERMARK CONTROLS */}
          {activeTab === 'stamp' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Stamp className="w-4 h-4 text-sky-400" />
                  <h2 className="text-sm font-semibold text-white">Official Rubber Stamps</h2>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.stampWatermark.enabled}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        stampWatermark: { ...prev.stampWatermark, enabled: e.target.checked }
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                </label>
              </div>

              {/* Rubber Stamp Presets */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {STAMP_PRESETS.map((st) => (
                  <button
                    key={st.type}
                    type="button"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        stampWatermark: {
                          ...prev.stampWatermark,
                          enabled: true,
                          type: st.type,
                          color: st.color,
                          customImageDataUrl: null
                        }
                      }))
                    }
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                      config.stampWatermark.type === st.type && !config.stampWatermark.customImageDataUrl
                        ? 'bg-slate-800/90 border-sky-500 shadow-md ring-1 ring-sky-500/50'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-bold" style={{ color: st.color }}>
                      {st.label}
                    </span>
                    <span className="text-[10px] text-slate-400">{st.desc}</span>
                  </button>
                ))}
              </div>

              {/* Custom Upload Stamp Option */}
              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => stampFileInputRef.current?.click()}
                  className="w-full py-2 px-3 border border-dashed border-slate-700 hover:border-sky-500 rounded-xl text-xs text-slate-300 flex items-center justify-center gap-2 hover:bg-slate-800/40 transition-colors"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                  <span>Upload Custom Stamp / Logo Image</span>
                </button>
              </div>

              {/* Stamp Placement Position */}
              <div>
                <label className="text-xs font-medium text-slate-300 mb-1.5 block">Stamp Page Placement</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'top-left', label: 'Top Left' },
                    { id: 'top-right', label: 'Top Right' },
                    { id: 'center', label: 'Page Center' },
                    { id: 'bottom-left', label: 'Bottom Left' },
                    { id: 'bottom-right', label: 'Bottom Right' }
                  ].map((pos) => (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          stampWatermark: { ...prev.stampWatermark, position: pos.id as any }
                        }))
                      }
                      className={`p-1.5 rounded-lg border text-xs text-center transition-all ${
                        config.stampWatermark.position === pos.id
                          ? 'bg-sky-950 border-sky-500 text-sky-400 font-medium'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stamp Scale & Angle Sliders */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>Stamp Size: {Math.round(config.stampWatermark.scale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.8"
                    step="0.05"
                    value={config.stampWatermark.scale}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        stampWatermark: { ...prev.stampWatermark, scale: parseFloat(e.target.value) }
                      }))
                    }
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>Stamp Tilt Angle: {config.stampWatermark.rotation}°</span>
                  </div>
                  <input
                    type="range"
                    min="-45"
                    max="45"
                    step="1"
                    value={config.stampWatermark.rotation}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        stampWatermark: { ...prev.stampWatermark, rotation: parseInt(e.target.value) }
                      }))
                    }
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: DIGITAL SIGNATURE WORKBENCH */}
          {activeTab === 'signature' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-sky-400" />
                  <h2 className="text-sm font-semibold text-white">Digital Signature Creator</h2>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.signature.enabled}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        signature: { ...prev.signature, enabled: e.target.checked }
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                </label>
              </div>

              {/* Mode Selection: Type, Draw, Upload */}
              <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setSigMode('type')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                    sigMode === 'type' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>Type Cursive</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSigMode('draw')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                    sigMode === 'draw' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>Draw Pad</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSigMode('upload')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                    sigMode === 'upload' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload</span>
                </button>
              </div>

              {/* Ink Color Picker */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">Ink Color</span>
                <div className="flex items-center gap-2">
                  {[
                    { name: 'Ink Blue', hex: '#1e40af' },
                    { name: 'Obsidian Black', hex: '#0f172a' },
                    { name: 'Dark Red', hex: '#991b1b' },
                    { name: 'Forest Green', hex: '#065f46' }
                  ].map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setSigInkColor(c.hex)}
                      style={{ backgroundColor: c.hex }}
                      className={`w-5 h-5 rounded-full border-2 transition-transform ${
                        sigInkColor === c.hex ? 'border-white scale-110' : 'border-transparent opacity-80'
                      }`}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              {/* Sub-Panel: Type Mode */}
              {sigMode === 'type' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1 block">Signer Full Name</label>
                    <input
                      type="text"
                      value={typedSigName}
                      onChange={(e) => setTypedSigName(e.target.value)}
                      placeholder="e.g. Alexander Vance"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  {/* Live Cursive Script Preview Box */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-center min-h-[90px] relative overflow-hidden">
                    <span
                      style={{
                        fontFamily: '"Brush Script MT", "Segoe Script", cursive, sans-serif',
                        fontSize: '32px',
                        color: sigInkColor,
                        transform: 'rotate(-2deg)'
                      }}
                      className="select-none"
                    >
                      {typedSigName || 'Your Signature'}
                    </span>
                    <span className="absolute bottom-1.5 right-2 text-[9px] text-slate-600">Auto Calligraphy</span>
                  </div>
                </div>
              )}

              {/* Sub-Panel: Draw Pad Mode */}
              {sigMode === 'draw' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Draw with mouse, stylus or touch</span>
                    <button
                      type="button"
                      onClick={clearDrawingPad}
                      className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300"
                    >
                      <Eraser className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  </div>
                  <canvas
                    ref={drawCanvasRef}
                    width={400}
                    height={120}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-28 bg-slate-950 border border-slate-800 rounded-xl cursor-crosshair touch-none"
                  />
                </div>
              )}

              {/* Sub-Panel: Upload Mode */}
              {sigMode === 'upload' && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => sigFileInputRef.current?.click()}
                    className="w-full py-4 border border-dashed border-slate-700 hover:border-sky-500 rounded-xl text-xs text-slate-300 flex flex-col items-center gap-1.5 hover:bg-slate-800/40 transition-colors"
                  >
                    <Upload className="w-4 h-4 text-sky-400" />
                    <span className="font-medium">Upload Scanned Signature Image</span>
                    <span className="text-[10px] text-slate-500">Auto-removes white background instantly</span>
                  </button>
                </div>
              )}

              {/* Signature Metadata & Placer */}
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Include Date & Legal Reason</span>
                  <input
                    type="checkbox"
                    checked={config.signature.includeSignerInfo}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        signature: { ...prev.signature, includeSignerInfo: e.target.checked }
                      }))
                    }
                    className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPlacingSignature(!isPlacingSignature)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      isPlacingSignature
                        ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                  >
                    <Move className="w-3.5 h-3.5 text-sky-400" />
                    <span>{isPlacingSignature ? 'Click PDF to Place Signature' : 'Click & Place on Document'}</span>
                  </button>

                  <select
                    value={config.signature.targetPage}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        signature: { ...prev.signature, targetPage: parseInt(e.target.value) }
                      }))
                    }
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-xs text-slate-200"
                  >
                    <option value={0}>All Pages</option>
                    {Array.from({ length: totalPages || 1 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        Page {i + 1}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: PRIVACY, METADATA & REDACTION CONTROLS */}
          {activeTab === 'security' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-sky-400" />
                  <h2 className="text-sm font-semibold text-white">Privacy & Metadata Protection</h2>
                </div>
              </div>

              {/* Metadata Sanitation Shield */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <EyeOff className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-white">Strip Document Metadata</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.metadata.stripMetadata}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        metadata: { ...prev.metadata, stripMetadata: e.target.checked }
                      }))
                    }
                    className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
                  />
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Removes author names, machine identifiers, revision histories, camera EXIF, and creation software tags.
                </p>
              </div>

              {/* Redaction Tool */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">Blackout Redaction Boxes ({config.redactions.length})</label>
                  <button
                    type="button"
                    onClick={() => setIsPlacingRedaction(!isPlacingRedaction)}
                    className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                      isPlacingRedaction
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                  >
                    <span>{isPlacingRedaction ? 'Click PDF to Blackout' : '+ Add Blackout Bar'}</span>
                  </button>
                </div>

                {config.redactions.length > 0 && (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {config.redactions.map((red, idx) => (
                      <div
                        key={red.id}
                        className="flex items-center justify-between bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-lg text-xs"
                      >
                        <span className="text-slate-300">
                          Pg {red.pageNumber} ({Math.round(red.xPercent)}%, {Math.round(red.yPercent)}%)
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setConfig((prev) => ({
                              ...prev,
                              redactions: prev.redactions.filter((r) => r.id !== red.id)
                            }))
                          }
                          className="text-rose-400 hover:text-rose-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Output File Name Configuration */}
              <div className="pt-2 border-t border-slate-800">
                <label className="text-xs font-medium text-slate-300 mb-1 block">Output Filename</label>
                <input
                  type="text"
                  value={config.outputFilename}
                  onChange={(e) => setConfig((prev) => ({ ...prev, outputFilename: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Side: High-Fidelity Live Interactive PDF Preview (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {/* Preview Navigation Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPageNum <= 1}
                onClick={() => setCurrentPageNum((p) => Math.max(1, p - 1))}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-300 font-medium">
                Page {currentPageNum} of {totalPages || 1}
              </span>
              <button
                type="button"
                disabled={currentPageNum >= totalPages}
                onClick={() => setCurrentPageNum((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Placement Mode Notice */}
            {(isPlacingSignature || isPlacingRedaction) && (
              <div className="animate-pulse flex items-center gap-1.5 text-xs text-amber-400 font-medium bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-500/40">
                <Move className="w-3 h-3" />
                <span>{isPlacingSignature ? 'Click PDF to place signature' : 'Click PDF to place blackout bar'}</span>
              </div>
            )}

            {/* Zoom Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.1))}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] text-slate-400 w-9 text-center font-mono">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(1.5, z + 0.1))}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Interactive Document Stage */}
          <div
            ref={previewContainerRef}
            className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 min-h-[560px] flex items-center justify-center overflow-auto shadow-inner relative"
          >
            {renderedPageImage ? (
              <div
                onClick={handlePreviewClick}
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.15s ease-out'
                }}
                className={`relative shadow-2xl rounded-sm overflow-hidden bg-white select-none transition-shadow ${
                  isPlacingSignature || isPlacingRedaction ? 'cursor-crosshair ring-2 ring-amber-400' : 'cursor-default'
                }`}
              >
                {/* PDF Page Underlying Render */}
                <img
                  src={renderedPageImage}
                  alt={`PDF Page ${currentPageNum}`}
                  className="max-w-full h-auto block pointer-events-none"
                />

                {/* 1. Live Text Watermark Overlay */}
                {config.textWatermark.enabled && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
                    {config.textWatermark.mode === 'diagonal_center' && (
                      <span
                        style={{
                          color: config.textWatermark.color,
                          opacity: config.textWatermark.opacity,
                          fontSize: `${config.textWatermark.fontSize * 1.2}px`,
                          transform: `rotate(${config.textWatermark.rotation}deg)`,
                          fontFamily: config.textWatermark.fontFamily.includes('Courier')
                            ? 'Courier New, monospace'
                            : config.textWatermark.fontFamily.includes('Times')
                            ? 'Times New Roman, serif'
                            : 'Impact, Arial Black, sans-serif'
                        }}
                        className="font-black whitespace-nowrap tracking-wider text-center"
                      >
                        {config.textWatermark.text || 'CONFIDENTIAL'}
                      </span>
                    )}

                    {config.textWatermark.mode === 'tiled_grid' && (
                      <div className="grid grid-cols-3 grid-rows-4 gap-12 w-full h-full p-4 items-center justify-items-center">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <span
                            key={i}
                            style={{
                              color: config.textWatermark.color,
                              opacity: config.textWatermark.opacity * 0.8,
                              fontSize: `${config.textWatermark.fontSize * 0.55}px`,
                              transform: `rotate(${config.textWatermark.rotation}deg)`
                            }}
                            className="font-bold whitespace-nowrap"
                          >
                            {config.textWatermark.text || 'CONFIDENTIAL'}
                          </span>
                        ))}
                      </div>
                    )}

                    {config.textWatermark.mode === 'header_footer' && (
                      <>
                        <div
                          style={{ backgroundColor: config.textWatermark.color, opacity: config.textWatermark.opacity * 0.4 }}
                          className="absolute top-0 inset-x-0 h-6 flex items-center justify-center"
                        >
                          <span
                            style={{ color: config.textWatermark.color, opacity: 1 }}
                            className="text-xs font-bold uppercase tracking-widest"
                          >
                            {config.textWatermark.text}
                          </span>
                        </div>
                        <div
                          style={{ backgroundColor: config.textWatermark.color, opacity: config.textWatermark.opacity * 0.4 }}
                          className="absolute bottom-0 inset-x-0 h-6 flex items-center justify-center"
                        >
                          <span
                            style={{ color: config.textWatermark.color, opacity: 1 }}
                            className="text-xs font-bold uppercase tracking-widest"
                          >
                            {config.textWatermark.text}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* 2. Live Rubber Stamp Overlay */}
                {config.stampWatermark.enabled && (
                  <div
                    style={{
                      position: 'absolute',
                      left:
                        config.stampWatermark.position === 'top-left' || config.stampWatermark.position === 'bottom-left'
                          ? '24px'
                          : config.stampWatermark.position === 'center'
                          ? '50%'
                          : 'auto',
                      right:
                        config.stampWatermark.position === 'top-right' || config.stampWatermark.position === 'bottom-right'
                          ? '24px'
                          : 'auto',
                      top:
                        config.stampWatermark.position === 'top-left' || config.stampWatermark.position === 'top-right'
                          ? '24px'
                          : config.stampWatermark.position === 'center'
                          ? '50%'
                          : 'auto',
                      bottom:
                        config.stampWatermark.position === 'bottom-left' || config.stampWatermark.position === 'bottom-right'
                          ? '24px'
                          : 'auto',
                      transform: `${
                        config.stampWatermark.position === 'center' ? 'translate(-50%, -50%) ' : ''
                      }rotate(${config.stampWatermark.rotation}deg) scale(${config.stampWatermark.scale})`,
                      opacity: config.stampWatermark.opacity
                    }}
                    className="pointer-events-none select-none"
                  >
                    <img
                      src={
                        config.stampWatermark.customImageDataUrl ||
                        generateGraphicStampDataUrl(
                          config.stampWatermark.type,
                          config.stampWatermark.customText,
                          config.stampWatermark.color
                        )
                      }
                      alt="Rubber Stamp"
                      className="w-48 h-auto drop-shadow-md"
                    />
                  </div>
                )}

                {/* 3. Live Digital Signature Overlay */}
                {config.signature.enabled &&
                  (config.signature.targetPage === currentPageNum || config.signature.targetPage === 0) &&
                  config.signature.dataUrl && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${config.signature.posXPercent}%`,
                        top: `${config.signature.posYPercent}%`,
                        width: `${config.signature.width * 1.2}px`
                      }}
                      className="pointer-events-none group select-none"
                    >
                      <img
                        src={config.signature.dataUrl}
                        alt="Digital Signature"
                        className="w-full h-auto drop-shadow-sm"
                      />
                      {config.signature.includeSignerInfo && (
                        <div className="mt-1 text-[9px] font-sans text-slate-800 leading-tight bg-white/70 px-1 py-0.5 rounded backdrop-blur-[1px]">
                          <p className="font-bold">Digitally Signed by: {config.signature.signerName}</p>
                          <p className="text-[8px] text-slate-600">
                            Date: {config.signature.dateString} | {config.signature.reason}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                {/* 4. Live Blackout Redaction Boxes Overlay */}
                {config.redactions
                  .filter((r) => r.pageNumber === currentPageNum)
                  .map((red) => (
                    <div
                      key={red.id}
                      style={{
                        position: 'absolute',
                        left: `${red.xPercent}%`,
                        top: `${red.yPercent}%`,
                        width: `${red.widthPercent}%`,
                        height: `${red.heightPercent}%`
                      }}
                      className="bg-black text-white text-[9px] font-bold flex items-center justify-center select-none shadow-md"
                    >
                      <span>{red.label || 'REDACTED'}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 text-slate-500 py-12">
                <FileText className="w-12 h-12 stroke-[1.5]" />
                <p className="text-sm">No PDF document loaded</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
