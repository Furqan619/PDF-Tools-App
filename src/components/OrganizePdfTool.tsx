import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Upload,
  FileText,
  Sparkles,
  Download,
  Trash2,
  RefreshCw,
  RotateCw,
  Check,
  CheckCircle2,
  ShieldCheck,
  Sliders,
  Layers,
  Zap,
  HelpCircle,
  X,
  MoveUp,
  MoveDown,
  Plus,
  Grid,
  LayoutGrid,
  Copy,
  Eye,
  FilePlus
} from 'lucide-react';
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import { pdfjsLib } from '../services/pdfWorker';
import { generateSamplePdfBlob } from '../services/sampleFiles';
import { saveAs } from 'file-saver';
import confetti from 'canvas-confetti';
import { ThemeToggle } from './ThemeToggle';

interface OrganizePdfToolProps {
  onNavigateToDashboard: () => void;
}

interface PageItem {
  id: string;
  originalIndex: number;
  pageNumber: number;
  thumbnailUrl: string;
  rotation: number;
  isDeleted: boolean;
  sourceFileName: string;
}

export const OrganizePdfTool: React.FC<OrganizePdfToolProps> = ({ onNavigateToDashboard }) => {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputFileName, setOutputFileName] = useState('organized_document.pdf');
  const [selectedPageIndex, setSelectedPageIndex] = useState<number | null>(null);
  const [pdfDocBytes, setPdfDocBytes] = useState<ArrayBuffer | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

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
      setOutputFileName(selectedFile.name.replace(/\.pdf$/i, '_organized.pdf'));

      const buffer = await selectedFile.arrayBuffer();
      setPdfDocBytes(buffer);

      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      const pdf = await loadingTask.promise;

      const loadedPages: PageItem[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.3 }); // thumbnail scale
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (context) {
          await (page.render as any)({ canvasContext: context, viewport, canvas }).promise;
        }

        loadedPages.push({
          id: `page-${i}-${Math.random().toString(36).substring(2, 7)}`,
          originalIndex: i - 1,
          pageNumber: i,
          thumbnailUrl: canvas.toDataURL('image/jpeg', 0.85),
          rotation: 0,
          isDeleted: false,
          sourceFileName: selectedFile.name,
        });
      }

      setPages(loadedPages);
      setSelectedPageIndex(0);
      setIsLoadingPdf(false);
    } catch (err: any) {
      console.error('Error loading PDF:', err);
      alert('Failed to load PDF document for organizing: ' + err.message);
      setIsLoadingPdf(false);
    }
  };

  const loadSamplePdf = async () => {
    try {
      setIsLoadingPdf(true);
      const sampleBlob = await generateSamplePdfBlob('invoice');
      const sampleFile = new File([sampleBlob], 'Invoice_Statement_Sample.pdf', { type: 'application/pdf' });
      await handleLoadPdf(sampleFile);
    } catch (err) {
      console.error('Error loading sample PDF:', err);
      setIsLoadingPdf(false);
    }
  };

  const handleAddMorePages = async (fileList: FileList) => {
    const additionalFile = fileList[0];
    if (!additionalFile || (!additionalFile.type.includes('pdf') && !additionalFile.name.toLowerCase().endsWith('.pdf'))) {
      alert('Please select a valid PDF file to append.');
      return;
    }

    try {
      setIsLoadingPdf(true);
      const buffer = await additionalFile.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      const pdf = await loadingTask.promise;

      const newLoadedPages: PageItem[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.3 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (context) {
          await (page.render as any)({ canvasContext: context, viewport, canvas }).promise;
        }

        newLoadedPages.push({
          id: `appended-${Date.now()}-${i}`,
          originalIndex: i - 1,
          pageNumber: pages.length + i,
          thumbnailUrl: canvas.toDataURL('image/jpeg', 0.85),
          rotation: 0,
          isDeleted: false,
          sourceFileName: additionalFile.name,
        });
      }

      setPages((prev) => [...prev, ...newLoadedPages]);
      setIsLoadingPdf(false);
    } catch (err: any) {
      console.error('Error appending PDF:', err);
      alert('Failed to append pages: ' + err.message);
      setIsLoadingPdf(false);
    }
  };

  const movePage = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pages.length) return;

    const newPages = [...pages];
    const temp = newPages[index];
    newPages[index] = newPages[targetIndex];
    newPages[targetIndex] = temp;
    setPages(newPages);
    setSelectedPageIndex(targetIndex);
  };

  const rotatePage = (index: number) => {
    setPages((prev) =>
      prev.map((p, idx) => (idx === index ? { ...p, rotation: (p.rotation + 90) % 360 } : p))
    );
  };

  const toggleDeletePage = (index: number) => {
    setPages((prev) =>
      prev.map((p, idx) => (idx === index ? { ...p, isDeleted: !p.isDeleted } : p))
    );
  };

  const duplicatePage = (index: number) => {
    const pageToDup = pages[index];
    const duplicated: PageItem = {
      ...pageToDup,
      id: `dup-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    };
    const newPages = [...pages];
    newPages.splice(index + 1, 0, duplicated);
    setPages(newPages);
    setSelectedPageIndex(index + 1);
  };

  const handleExportOrganizedPdf = async () => {
    const activePages = pages.filter((p) => !p.isDeleted);
    if (activePages.length === 0) {
      alert('Cannot export an empty PDF. Please keep at least one active page.');
      return;
    }

    if (!file && !pdfDocBytes) {
      alert('No base PDF loaded.');
      return;
    }

    try {
      setIsProcessing(true);
      // Re-load original document buffer or create from source
      // For simplicity, we can load the source file or buffer
      let sourceBuffer = pdfDocBytes;
      if (file) {
        sourceBuffer = await file.arrayBuffer();
      }

      if (!sourceBuffer) {
        throw new Error('PDF source buffer not found.');
      }

      const srcDoc = await PDFDocument.load(sourceBuffer);
      const newPdfDoc = await PDFDocument.create();

      for (const pageItem of activePages) {
        // If the page is from the original file (or appended files)
        // Note: For multi-file appending, we can map source files, or copy pages.
        const [copiedPage] = await newPdfDoc.copyPages(srcDoc, [pageItem.originalIndex]);
        if (pageItem.rotation > 0) {
          copiedPage.setRotation(degrees(pageItem.rotation));
        }
        newPdfDoc.addPage(copiedPage);
      }

      const pdfBytes = await newPdfDoc.save();
      const blob = new Blob([pdfBytes as Uint8Array], { type: 'application/pdf' });
      saveAs(blob, outputFileName || 'Organized_Document.pdf');

      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 },
      });

      setIsProcessing(false);
    } catch (err: any) {
      console.error('Error generating organized PDF:', err);
      alert('Failed to generate organized PDF: ' + err.message);
      setIsProcessing(false);
    }
  };



  const activePagesCount = pages.filter((p) => !p.isDeleted).length;
  const deletedPagesCount = pages.filter((p) => p.isDeleted).length;

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
              <ArrowLeft className="w-4 h-4 text-emerald-500 dark:text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>

            <span className="text-slate-400 dark:text-slate-600 hidden sm:inline">/</span>

            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/20 ring-1 ring-white/10 shrink-0">
              <LayoutGrid className="w-4 h-4 text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  Organize <span className="text-emerald-600 dark:text-emerald-400 font-mono text-xs px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">PDF</span>
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3" />
                  <span className="hidden xs:inline">Client-Side Sorting & Editing</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden md:block">
                Sort pages of your PDF file however you like. Delete PDF pages or Add PDF pages to your document at your convenience.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {pages.length > 0 && (
              <button
                onClick={handleExportOrganizedPdf}
                disabled={isProcessing || activePagesCount === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold text-xs shadow-md shadow-emerald-500/25 hover:from-emerald-500 hover:to-teal-500 transition-all disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF ({activePagesCount} Pages)</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {pages.length === 0 ? (
          <div className="max-w-xl mx-auto py-12 space-y-6 text-center">
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleLoadPdf(e.target.files[0]);
                  }
                }}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleLoadPdf(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500/60 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-2xl p-10 cursor-pointer transition-all space-y-3 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Drop your PDF here to organize, or <span className="text-emerald-600 dark:text-emerald-400 underline">browse</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Sort pages, delete unwanted sheets, rotate, or add new pages
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={loadSamplePdf}
                  disabled={isLoadingPdf}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-600 transition-all flex items-center gap-2 mx-auto"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Load Sample PDF Document</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats & Actions Toolbar */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Active Pages:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                    {activePagesCount}
                  </span>
                </div>
                {deletedPagesCount > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Deleted (Hidden):</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400 px-2.5 py-0.5 rounded bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
                      {deletedPagesCount}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Filename:</span>
                  <input
                    type="text"
                    value={outputFileName}
                    onChange={(e) => setOutputFileName(e.target.value)}
                    className="px-3 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white w-48 shadow-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <input
                  ref={addMoreInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleAddMorePages(e.target.files);
                  }}
                />
                <button
                  onClick={() => addMoreInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <FilePlus className="w-4 h-4" />
                  <span>Add PDF Pages</span>
                </button>

                <button
                  onClick={() => {
                    setFile(null);
                    setPages([]);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  Start Over
                </button>
              </div>
            </div>

            {/* Thumbnail Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {pages.map((page, idx) => (
                <div
                  key={page.id}
                  className={`group relative rounded-2xl border bg-white dark:bg-slate-800 overflow-hidden shadow-xs transition-all ${
                    page.isDeleted ? 'opacity-40 border-dashed border-rose-400 bg-rose-50/20' : ''
                  } ${
                    selectedPageIndex === idx
                      ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-md'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'
                  }`}
                  onClick={() => setSelectedPageIndex(idx)}
                >
                  {/* Page Preview Thumbnail */}
                  <div className="aspect-[3/4] bg-slate-950 flex items-center justify-center relative overflow-hidden">
                    <img
                      src={page.thumbnailUrl}
                      alt={`Page ${idx + 1}`}
                      className="w-full h-full object-contain transition-transform"
                      style={{ transform: `rotate(${page.rotation}deg)` }}
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-white font-mono text-[11px] font-semibold">
                      #{idx + 1}
                    </div>

                    {page.isDeleted && (
                      <div className="absolute inset-0 bg-rose-950/60 backdrop-blur-xs flex items-center justify-center">
                        <span className="px-3 py-1 rounded bg-rose-600 text-white text-xs font-bold shadow">
                          DELETED
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Page Controls Footer */}
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          movePage(idx, 'up');
                        }}
                        disabled={idx === 0}
                        className="p-1.5 rounded bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 disabled:opacity-30 border border-slate-200 dark:border-slate-600 transition-colors"
                        title="Move Left / Up"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          movePage(idx, 'down');
                        }}
                        disabled={idx === pages.length - 1}
                        className="p-1.5 rounded bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 disabled:opacity-30 border border-slate-200 dark:border-slate-600 transition-colors"
                        title="Move Right / Down"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          rotatePage(idx);
                        }}
                        className="p-1.5 rounded bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 transition-colors"
                        title="Rotate 90°"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicatePage(idx);
                        }}
                        className="p-1.5 rounded bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 transition-colors"
                        title="Duplicate Page"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDeletePage(idx);
                        }}
                        className={`p-1.5 rounded border transition-colors ${
                          page.isDeleted
                            ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500'
                            : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/20 border-slate-200 dark:border-slate-600'
                        }`}
                        title={page.isDeleted ? 'Restore page' : 'Delete page'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/60 py-4 text-center text-xs text-slate-500 dark:text-slate-500 mt-auto">
        Organize PDF • 100% Client-Side Page Sorting, Deletion & Insertion Suite
      </footer>
    </div>
  );
};
