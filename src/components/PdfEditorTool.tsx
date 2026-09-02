import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Upload,
  Edit3,
  Sparkles,
  Download,
  Eye,
  CheckCircle2,
  RefreshCw,
  Plus,
  Trash2,
  Type,
  Highlighter,
  Stamp,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { pdfjsLib } from '../services/pdfWorker';
import { PdfAnnotation, addAnnotationsToPdf } from '../services/pdfEditorEngine';
import { generateSamplePdfBlob } from '../services/sampleFiles';
import { ThemeToggle } from './ThemeToggle';
import { saveAs } from 'file-saver';

interface PdfEditorToolProps {
  onNavigateToDashboard: () => void;
}

export const PdfEditorTool: React.FC<PdfEditorToolProps> = ({ onNavigateToDashboard }) => {
  const [file, setFile] = useState<File | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageImageUrl, setPageImageUrl] = useState<string>('');
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const [activeTool, setActiveTool] = useState<'text' | 'highlight' | 'stamp'>('text');
  const [inputText, setInputText] = useState('Approved - Q3 Review');
  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleLoadFile = async (selectedFile: File) => {
    if (!selectedFile) return;

    try {
      setIsLoading(true);
      setFile(selectedFile);
      setOutputBlob(null);
      setAnnotations([]);

      const buffer = await selectedFile.arrayBuffer();
      setArrayBuffer(buffer);

      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      const pdfDoc = await loadingTask.promise;
      setNumPages(pdfDoc.numPages);
      setCurrentPage(1);

      await renderPage(pdfDoc, 1);
      setIsLoading(false);
    } catch (err: any) {
      console.error('Error loading PDF for editing:', err);
      alert('Failed to load PDF document.');
      setIsLoading(false);
    }
  };

  const renderPage = async (pdfDoc: any, pageNum: number) => {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (context) {
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas,
      }).promise;
    }

    setPageImageUrl(canvas.toDataURL('image/jpeg', 0.92));
  };

  const handlePageChange = async (newPage: number) => {
    if (!arrayBuffer || newPage < 1 || newPage > numPages) return;
    setCurrentPage(newPage);
    try {
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdfDoc = await loadingTask.promise;
      await renderPage(pdfDoc, newPage);
    } catch (e) {
      console.error(e);
    }
  };

  const loadSample = async () => {
    try {
      setIsLoading(true);
      const sampleFile = generateSamplePdfBlob('financial-report');
      await handleLoadFile(sampleFile);
    } catch (err) {
      console.error('Error loading sample pdf:', err);
      setIsLoading(false);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newAnnotation: PdfAnnotation = {
      id: Math.random().toString(36).substring(2, 9),
      pageNumber: currentPage,
      type: activeTool,
      x: Math.round(x),
      y: Math.round(y),
      text: inputText || (activeTool === 'stamp' ? 'CONFIDENTIAL' : 'New Annotation'),
      color: '#2563eb',
      fontSize: 14,
    };

    setAnnotations([...annotations, newAnnotation]);
  };

  const handleSaveAndExport = async () => {
    if (!arrayBuffer) return;

    try {
      setIsProcessing(true);
      const blob = await addAnnotationsToPdf(arrayBuffer, annotations, (pct, msg) => {
        setProgressMsg(msg);
      });

      setOutputBlob(blob);
      setIsProcessing(false);
    } catch (err: any) {
      console.error('Error exporting edited PDF:', err);
      alert('Failed to export edited PDF.');
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!outputBlob || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    saveAs(outputBlob, `${baseName}_edited.pdf`);
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
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-sm">
                <Edit3 className="w-4 h-4" />
              </div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Edit PDF & Annotate
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
        {!arrayBuffer ? (
          /* Upload State */
          <div className="max-w-2xl mx-auto">
            <div
              className="border-2 border-dashed rounded-2xl p-10 text-center border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400 transition"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) {
                  handleLoadFile(e.dataTransfer.files[0]);
                }
              }}
            >
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
                <Edit3 className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                Edit & Annotate PDF Documents
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
                Add text stamps, highlights, and annotations directly onto PDF pages securely in your browser.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleLoadFile(e.target.files[0])}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md shadow-indigo-500/20 transition disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Loading PDF...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Select PDF File</span>
                  </>
                )}
              </button>

              {/* Sample Preset */}
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700/60">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  Or Test with Sample PDF Document:
                </p>
                <button
                  onClick={loadSample}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 transition inline-flex items-center gap-2"
                >
                  📄 Quarterly Financial Report.pdf
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Editor Workspace */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Toolbar & Annotations List */}
            <div className="lg:col-span-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700/60">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                    {file?.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {numPages} Pages • {file ? formatBytes(file.size) : ''}
                  </p>
                </div>
                <button
                  onClick={() => setArrayBuffer(null)}
                  className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline"
                >
                  New File
                </button>
              </div>

              {/* Annotation Tools */}
              <div className="space-y-4">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Select Tool & Stamp Text
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setActiveTool('text')}
                    className={`p-2.5 rounded-xl text-xs font-medium border flex flex-col items-center gap-1 transition ${
                      activeTool === 'text'
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-400 text-indigo-700 dark:text-indigo-300'
                        : 'bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Type className="w-4 h-4" />
                    <span>Text Stamp</span>
                  </button>
                  <button
                    onClick={() => setActiveTool('highlight')}
                    className={`p-2.5 rounded-xl text-xs font-medium border flex flex-col items-center gap-1 transition ${
                      activeTool === 'highlight'
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-400 text-indigo-700 dark:text-indigo-300'
                        : 'bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Highlighter className="w-4 h-4" />
                    <span>Highlight</span>
                  </button>
                  <button
                    onClick={() => setActiveTool('stamp')}
                    className={`p-2.5 rounded-xl text-xs font-medium border flex flex-col items-center gap-1 transition ${
                      activeTool === 'stamp'
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-400 text-indigo-700 dark:text-indigo-300'
                        : 'bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Stamp className="w-4 h-4" />
                    <span>Badge Stamp</span>
                  </button>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 block">
                    Text Content to Stamp:
                  </label>
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                    placeholder="Enter annotation text..."
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Click anywhere on the PDF page preview to place the annotation.
                  </p>
                </div>
              </div>

              {/* Export Action */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60">
                {!outputBlob ? (
                  <button
                    onClick={handleSaveAndExport}
                    disabled={isProcessing}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md shadow-indigo-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{progressMsg || 'Saving PDF...'}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Save & Export Edited PDF</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                          PDF Edited Successfully!
                        </p>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                          {annotations.length} annotations applied
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleDownload}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md shadow-emerald-500/20 transition flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Edited PDF</span>
                    </button>
                    <button
                      onClick={() => setOutputBlob(null)}
                      className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-medium text-xs transition"
                    >
                      Continue Editing
                    </button>
                  </div>
                )}
              </div>

              {/* Annotations List */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3 block">
                  Active Annotations ({annotations.length})
                </label>
                <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1">
                  {annotations.map((ann) => (
                    <div
                      key={ann.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                    >
                      <div>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">P.{ann.pageNumber}:</span>{' '}
                        <span className="text-slate-700 dark:text-slate-300 truncate max-w-[120px] inline-block align-bottom">{ann.text}</span>
                      </div>
                      <button
                        onClick={() => setAnnotations(annotations.filter((a) => a.id !== ann.id))}
                        className="text-rose-500 hover:text-rose-700 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {annotations.length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-2">No annotations added yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Interactive Canvas Preview */}
            <div className="lg:col-span-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex flex-col items-center">
              <div className="w-full flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700/60 mb-6">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                    Page Preview & Annotation Canvas ({currentPage} of {numPages})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 disabled:opacity-40 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
                    {currentPage} / {numPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === numPages}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 disabled:opacity-40 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Clickable Canvas Container */}
              <div
                onClick={handleCanvasClick}
                className="relative bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-700 cursor-crosshair max-h-[520px] flex items-center justify-center p-2"
              >
                {pageImageUrl && (
                  <img src={pageImageUrl} alt={`PDF Page ${currentPage}`} className="max-h-[500px] object-contain rounded" />
                )}

                {/* Render current page annotations overlay */}
                {annotations
                  .filter((ann) => ann.pageNumber === currentPage)
                  .map((ann) => (
                    <div
                      key={ann.id}
                      style={{ left: ann.x, top: ann.y }}
                      className="absolute px-2 py-1 bg-indigo-600/90 text-white rounded text-[11px] font-semibold shadow-md pointer-events-none transform -translate-x-2 -translate-y-2 border border-white/20"
                    >
                      {ann.text}
                    </div>
                  ))}
              </div>
              <p className="text-xs text-slate-400 mt-3 text-center">
                💡 Click anywhere on the preview canvas above to place your selected "{activeTool}" stamp.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
