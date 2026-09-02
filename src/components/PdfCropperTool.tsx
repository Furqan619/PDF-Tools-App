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
  Crop,
  Layers,
  ShieldCheck,
  Maximize2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Check,
  RotateCcw,
  Info
} from 'lucide-react';
import {
  CropConfig,
  DEFAULT_CROP_CONFIG,
  applyCropToPdf
} from '../services/pdfCropEngine';
import { pdfjsLib } from '../services/pdfWorker';
import { generateSamplePdfBlob, SAMPLE_PRESETS } from '../services/sampleFiles';
import { ThemeToggle } from './ThemeToggle';
import { saveAs } from 'file-saver';

interface PdfCropperToolProps {
  onNavigateToDashboard: () => void;
}

export const PdfCropperTool: React.FC<PdfCropperToolProps> = ({ onNavigateToDashboard }) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileArrayBuffer, setFileArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPagePreview, setCurrentPagePreview] = useState<number>(1);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const [config, setConfig] = useState<CropConfig>(DEFAULT_CROP_CONFIG);

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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewScale, setPreviewScale] = useState<number>(0.9);
  const [pdfDocumentInstance, setPdfDocumentInstance] = useState<any>(null);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({ width: 595, height: 842 });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleLoadPdf = async (selectedFile: File) => {
    if (!selectedFile || (!selectedFile.type.includes('pdf') && !selectedFile.name.toLowerCase().endsWith('.pdf'))) {
      alert('Please upload a valid PDF document.');
      return;
    }

    try {
      setIsLoadingPdf(true);
      setFile(selectedFile);
      setProcessedResult(null);

      const buffer = await selectedFile.arrayBuffer();
      setFileArrayBuffer(buffer);

      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      const pdf = await loadingTask.promise;
      setPdfDocumentInstance(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPagePreview(1);

      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.0 });
      setPageDimensions({ width: viewport.width, height: viewport.height });

      setIsLoadingPdf(false);
    } catch (err: any) {
      console.error('Error loading PDF:', err);
      alert('Failed to load PDF document. Please check the file format.');
      setIsLoadingPdf(false);
    }
  };

  const loadSamplePdf = async (presetId: string) => {
    try {
      setIsLoadingPdf(true);
      const sampleBlob = await generateSamplePdfBlob(presetId);
      const sampleFile = new File([sampleBlob], `${presetId}_sample.pdf`, { type: 'application/pdf' });
      await handleLoadPdf(sampleFile);
    } catch (err) {
      console.error('Error loading sample:', err);
      setIsLoadingPdf(false);
    }
  };

  // Render preview page onto canvas with crop rectangle overlay
  const renderPreviewPage = useCallback(async () => {
    if (!pdfDocumentInstance || !canvasRef.current) return;

    try {
      const page = await pdfDocumentInstance.getPage(currentPagePreview);
      const viewport = page.getViewport({ scale: previewScale });
      setPageDimensions({ width: page.getViewport({ scale: 1.0 }).width, height: page.getViewport({ scale: 1.0 }).height });

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      // Draw Crop Box overlay
      const origWidth = page.getViewport({ scale: 1.0 }).width;
      const origHeight = page.getViewport({ scale: 1.0 }).height;

      let top = config.marginTopPt;
      let bottom = config.marginBottomPt;
      let left = config.marginLeftPt;
      let right = config.marginRightPt;

      if (config.unit === 'percent') {
        left = (origWidth * config.marginLeftPt) / 100;
        right = (origWidth * config.marginRightPt) / 100;
        top = (origHeight * config.marginTopPt) / 100;
        bottom = (origHeight * config.marginBottomPt) / 100;
      }

      const scaleX = viewport.width / origWidth;
      const scaleY = viewport.height / origHeight;

      const cropX = left * scaleX;
      const cropY = bottom * scaleY;
      const cropW = (origWidth - left - right) * scaleX;
      const cropH = (origHeight - top - bottom) * scaleY;

      // Darken outside crop area
      context.fillStyle = 'rgba(0, 0, 0, 0.4)';
      context.fillRect(0, 0, canvas.width, canvas.height);

      // Clear inside crop area
      context.clearRect(cropX, canvas.height - cropY - cropH, cropW, cropH);
      // Re-render the cropped region clearly or draw border
      context.save();
      context.beginPath();
      context.rect(cropX, canvas.height - cropY - cropH, cropW, cropH);
      context.clip();
      
      // Re-render underlying page inside crop region
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;
      context.restore();

      // Draw dashed crop outline
      context.strokeStyle = '#6366f1';
      context.lineWidth = 2;
      context.setLineDash([6, 6]);
      context.strokeRect(cropX, canvas.height - cropY - cropH, cropW, cropH);

      // Draw dimension labels
      context.font = '11px Inter, sans-serif';
      context.fillStyle = '#4f46e5';
      context.fillRect(cropX + 6, canvas.height - cropY - cropH + 6, 95, 22);
      context.fillStyle = '#ffffff';
      context.fillText(`Crop Active`, cropX + 14, canvas.height - cropY - cropH + 21);

    } catch (err) {
      console.error('Error rendering preview:', err);
    }
  }, [pdfDocumentInstance, currentPagePreview, previewScale, config]);

  useEffect(() => {
    renderPreviewPage();
  }, [renderPreviewPage]);

  const handleExecuteCrop = async () => {
    if (!fileArrayBuffer || !file) return;

    try {
      setIsProcessing(true);
      setProcessingProgress({ percent: 10, message: 'Initializing crop engine...' });

      const result = await applyCropToPdf(
        new Uint8Array(fileArrayBuffer),
        config,
        (percent, message) => {
          setProcessingProgress({ percent, message });
        }
      );

      const url = URL.createObjectURL(result.blob);
      const outputName = file.name.replace(/\.[^/.]+$/, '') + '_cropped.pdf';

      setProcessedResult({
        blob: result.blob,
        fileName: outputName,
        totalPages: result.pageCount,
        fileSizeBytes: result.blob.size,
        url,
      });

      setIsProcessing(false);
    } catch (err: any) {
      console.error('Error processing crop:', err);
      alert('Failed to crop PDF. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!processedResult) return;
    saveAs(processedResult.blob, processedResult.fileName);
  };

  return (
    <div className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur sticky top-0 z-30 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateToDashboard}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </button>
            <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-sm">
                <Crop className="w-4 h-4" />
              </div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Crop PDF
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!file ? (
          /* Upload State */
          <div className="max-w-2xl mx-auto">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files?.[0]) {
                  handleLoadPdf(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
                isDragOver
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400'
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
                <Crop className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                Upload PDF to Crop Margins & Bounding Box
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
                Remove unwanted white borders, trim margins, or crop specific page regions precisely.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleLoadPdf(e.target.files[0])}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoadingPdf}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md shadow-indigo-500/20 transition disabled:opacity-50"
              >
                {isLoadingPdf ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Loading Document...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Select PDF File</span>
                  </>
                )}
              </button>

              {/* Sample Presets */}
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700/60">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  Or Try Sample Document:
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => loadSamplePdf('invoice')}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 transition"
                  >
                    📄 Sample Invoice PDF
                  </button>
                  <button
                    onClick={() => loadSamplePdf('report')}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 transition"
                  >
                    📊 Sample Report PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Editor Workspace */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Configuration Panel */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700/60">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[220px]">
                    {file.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {totalPages} Pages • {formatBytes(file.size)}
                  </p>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline"
                >
                  Change File
                </button>
              </div>

              {/* Margin Presets */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                  Quick Crop Presets
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setConfig({ ...config, marginTopPt: 18, marginBottomPt: 18, marginLeftPt: 18, marginRightPt: 18 })}
                    className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-700/50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition text-center"
                  >
                    Light (0.25&quot;)
                  </button>
                  <button
                    onClick={() => setConfig({ ...config, marginTopPt: 36, marginBottomPt: 36, marginLeftPt: 36, marginRightPt: 36 })}
                    className="px-3 py-2 rounded-xl text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 transition text-center"
                  >
                    Normal (0.5&quot;)
                  </button>
                  <button
                    onClick={() => setConfig({ ...config, marginTopPt: 72, marginBottomPt: 72, marginLeftPt: 54, marginRightPt: 54 })}
                    className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-700/50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition text-center"
                  >
                    Heavy (1.0&quot;)
                  </button>
                </div>
              </div>

              {/* Margin Sliders */}
              <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Margin Trimming (Points)
                  </label>
                  <button
                    onClick={() => setConfig(DEFAULT_CROP_CONFIG)}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                      <span>Top Margin</span>
                      <span className="font-mono font-medium">{config.marginTopPt} pt</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="150"
                      step="2"
                      value={config.marginTopPt}
                      onChange={(e) => setConfig({ ...config, marginTopPt: Number(e.target.value) })}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                      <span>Bottom Margin</span>
                      <span className="font-mono font-medium">{config.marginBottomPt} pt</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="150"
                      step="2"
                      value={config.marginBottomPt}
                      onChange={(e) => setConfig({ ...config, marginBottomPt: Number(e.target.value) })}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                      <span>Left Margin</span>
                      <span className="font-mono font-medium">{config.marginLeftPt} pt</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="150"
                      step="2"
                      value={config.marginLeftPt}
                      onChange={(e) => setConfig({ ...config, marginLeftPt: Number(e.target.value) })}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                      <span>Right Margin</span>
                      <span className="font-mono font-medium">{config.marginRightPt} pt</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="150"
                      step="2"
                      value={config.marginRightPt}
                      onChange={(e) => setConfig({ ...config, marginRightPt: Number(e.target.value) })}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Page Scope Mode */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-3">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Apply Crop To
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'all', label: 'All Pages' },
                    { id: 'odd', label: 'Odd Pages Only' },
                    { id: 'even', label: 'Even Pages Only' },
                    { id: 'custom', label: 'Custom Range' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setConfig({ ...config, mode: m.id as any })}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border text-left transition ${
                        config.mode === m.id
                          ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-500/50 text-indigo-700 dark:text-indigo-300'
                          : 'bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {config.mode === 'custom' && (
                  <div className="mt-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                      Page Ranges (e.g. 1-3, 5, 8-10)
                    </label>
                    <input
                      type="text"
                      value={config.customPages}
                      onChange={(e) => setConfig({ ...config, customPages: e.target.value })}
                      placeholder="1-5, 8"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>

              {/* Execute / Download Action */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60">
                {!processedResult ? (
                  <button
                    onClick={handleExecuteCrop}
                    disabled={isProcessing}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md shadow-indigo-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{processingProgress.message}</span>
                      </>
                    ) : (
                      <>
                        <Crop className="w-4 h-4" />
                        <span>Process & Crop PDF</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                          Crop Successful!
                        </p>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                          {formatBytes(processedResult.fileSizeBytes)} • {processedResult.totalPages} pages cropped
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleDownload}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md shadow-emerald-500/20 transition flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Cropped PDF</span>
                    </button>
                    <button
                      onClick={() => setProcessedResult(null)}
                      className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-medium text-xs transition"
                    >
                      Adjust Crop Settings
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Preview Panel */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex flex-col items-center">
              <div className="w-full flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700/60 mb-6">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                    Live Crop Preview
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPagePreview((p) => Math.max(1, p - 1))}
                    disabled={currentPagePreview <= 1}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 disabled:opacity-40 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
                    Page {currentPagePreview} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPagePreview((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPagePreview >= totalPages}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 disabled:opacity-40 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Canvas Container */}
              <div className="relative overflow-auto max-h-[600px] w-full flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                <canvas ref={canvasRef} className="shadow-lg rounded" />
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Info className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>The shaded outer area represents margins that will be cropped out.</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
