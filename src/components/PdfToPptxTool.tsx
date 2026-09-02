import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  Upload,
  Presentation,
  Sparkles,
  Download,
  Eye,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Layers,
  ChevronLeft,
  ChevronRight,
  FileText,
  Monitor
} from 'lucide-react';
import {
  PptxExportConfig,
  DEFAULT_PPTX_CONFIG,
  PdfSlideInfo,
  extractPdfPagesForPptx,
  generateAndSavePptx
} from '../services/pdfToPptxEngine';
import { generateSamplePdfBlob } from '../services/sampleFiles';
import { ThemeToggle } from './ThemeToggle';
import { saveAs } from 'file-saver';

interface PdfToPptxToolProps {
  onNavigateToDashboard: () => void;
}

export const PdfToPptxTool: React.FC<PdfToPptxToolProps> = ({ onNavigateToDashboard }) => {
  const [file, setFile] = useState<File | null>(null);
  const [slides, setSlides] = useState<PdfSlideInfo[]>([]);
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [config, setConfig] = useState<PptxExportConfig>(DEFAULT_PPTX_CONFIG);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressInfo, setProgressInfo] = useState<{ percent: number; message: string }>({ percent: 0, message: '' });
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setOutputBlob(null);

      const arrayBuffer = await selectedFile.arrayBuffer();
      const result = await extractPdfPagesForPptx(new Uint8Array(arrayBuffer), (pct, msg) => {
        setProgressInfo({ percent: pct, message: msg });
      });

      setSlides(result.slides);
      setCurrentSlideIdx(0);
      setIsLoadingPdf(false);
    } catch (err: any) {
      console.error('Error loading PDF for PPTX:', err);
      alert('Failed to process PDF pages. Please check the file.');
      setIsLoadingPdf(false);
    }
  };

  const loadSamplePdf = async (presetId: string) => {
    try {
      setIsLoadingPdf(true);
      const sampleBlob = await generateSamplePdfBlob(presetId);
      const sampleFile = new File([sampleBlob], `${presetId}_presentation.pdf`, { type: 'application/pdf' });
      await handleLoadPdf(sampleFile);
    } catch (err) {
      console.error('Error loading sample:', err);
      setIsLoadingPdf(false);
    }
  };

  const handleGeneratePptx = async () => {
    if (slides.length === 0 || !file) return;

    try {
      setIsProcessing(true);
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const blob = await generateAndSavePptx(slides, config, `${baseName}.pptx`, (pct, msg) => {
        setProgressInfo({ percent: pct, message: msg });
      });

      setOutputBlob(blob);
      setIsProcessing(false);
    } catch (err: any) {
      console.error('Error generating PowerPoint:', err);
      alert('Failed to generate PowerPoint presentation.');
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!outputBlob || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    saveAs(outputBlob, `${baseName}_presentation.pptx`);
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
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-sm">
                <Presentation className="w-4 h-4" />
              </div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                PDF to PowerPoint
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
        {slides.length === 0 ? (
          /* Upload State */
          <div className="max-w-2xl mx-auto">
            <div
              className="border-2 border-dashed rounded-2xl p-10 text-center border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400 transition"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) {
                  handleLoadPdf(e.dataTransfer.files?.[0]);
                }
              }}
            >
              <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
                <Presentation className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                Convert PDF to PowerPoint Presentation (.pptx)
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
                Transform multi-page PDF documents and reports into clean slide decks ready for Microsoft PowerPoint or Google Slides.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleLoadPdf(e.target.files?.[0])}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoadingPdf}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm shadow-md shadow-amber-500/20 transition disabled:opacity-50"
              >
                {isLoadingPdf ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{progressInfo.message || 'Extracting Slides...'}</span>
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
                  Or Test with Sample Document:
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => loadSamplePdf('report')}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-slate-700 transition"
                  >
                    📊 Sample Executive Report PDF
                  </button>
                  <button
                    onClick={() => loadSamplePdf('invoice')}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-slate-700 transition"
                  >
                    📄 Sample Invoice PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Slide Decks Workspace */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Configuration & Thumbnails */}
            <div className="lg:col-span-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700/60">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                    {file?.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {slides.length} Slides Extracted • {file ? formatBytes(file.size) : ''}
                  </p>
                </div>
                <button
                  onClick={() => setSlides([])}
                  className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline"
                >
                  New File
                </button>
              </div>

              {/* Presentation Format Options */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                    Slide Layout Aspect Ratio
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setConfig({ ...config, layout: 'LAYOUT_16X9' })}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border text-center transition ${
                        config.layout === 'LAYOUT_16X9'
                          ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-500/50 text-amber-700 dark:text-amber-300'
                          : 'bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      16:9 Widescreen
                    </button>
                    <button
                      onClick={() => setConfig({ ...config, layout: 'LAYOUT_4X3' })}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border text-center transition ${
                        config.layout === 'LAYOUT_4X3'
                          ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-500/50 text-amber-700 dark:text-amber-300'
                          : 'bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      4:3 Standard
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                    Slide Export Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setConfig({ ...config, exportMode: 'images' })}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border text-center transition ${
                        config.exportMode === 'images'
                          ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-500/50 text-amber-700 dark:text-amber-300'
                          : 'bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      High-Res Images
                    </button>
                    <button
                      onClick={() => setConfig({ ...config, exportMode: 'text_and_images' })}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border text-center transition ${
                        config.exportMode === 'text_and_images'
                          ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-500/50 text-amber-700 dark:text-amber-300'
                          : 'bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      Text & Image Split
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60">
                {!outputBlob ? (
                  <button
                    onClick={handleGeneratePptx}
                    disabled={isProcessing}
                    className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{progressInfo.message || 'Generating PPTX...'}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Generate PowerPoint (.pptx)</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                          PowerPoint Ready!
                        </p>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                          {slides.length} slides packaged successfully
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleDownload}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md shadow-emerald-500/20 transition flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download PowerPoint (.pptx)</span>
                    </button>
                    <button
                      onClick={() => setOutputBlob(null)}
                      className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-medium text-xs transition"
                    >
                      Reconfigure & Export Again
                    </button>
                  </div>
                )}
              </div>

              {/* Slide Thumbnails Scroller */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3 block">
                  Slides Navigator ({slides.length})
                </label>
                <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                  {slides.map((s, idx) => (
                    <div
                      key={s.pageNumber}
                      onClick={() => setCurrentSlideIdx(idx)}
                      className={`flex items-center gap-3 p-2 rounded-xl border cursor-pointer transition ${
                        currentSlideIdx === idx
                          ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-400 dark:border-amber-500/50'
                          : 'bg-slate-50 dark:bg-slate-700/40 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <img src={s.imageUrl} alt={`Slide ${s.pageNumber}`} className="w-14 h-10 object-cover rounded shadow-sm border border-slate-200 dark:border-slate-600" />
                      <div className="flex-1 truncate">
                        <p className="text-xs font-bold text-slate-800 dark:text-white">
                          Slide {s.pageNumber}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {s.textContent ? s.textContent.slice(0, 30) + '...' : 'Visual Slide'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Main Slide Viewer */}
            <div className="lg:col-span-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex flex-col items-center">
              <div className="w-full flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700/60 mb-6">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                    Slide Preview ({currentSlideIdx + 1} of {slides.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentSlideIdx((i) => Math.max(0, i - 1))}
                    disabled={currentSlideIdx === 0}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 disabled:opacity-40 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
                    {currentSlideIdx + 1} / {slides.length}
                  </span>
                  <button
                    onClick={() => setCurrentSlideIdx((i) => Math.min(slides.length - 1, i + 1))}
                    disabled={currentSlideIdx === slides.length - 1}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 disabled:opacity-40 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Current Slide Display Canvas / Image */}
              <div className="w-full bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-700 flex items-center justify-center p-4 min-h-[480px]">
                {slides[currentSlideIdx] && (
                  <img
                    src={slides[currentSlideIdx].imageUrl}
                    alt={`Slide ${slides[currentSlideIdx].pageNumber}`}
                    className="max-h-[460px] object-contain rounded shadow-lg"
                  />
                )}
              </div>

              {/* Extracted Text Debug / Preview */}
              {slides[currentSlideIdx]?.textContent && (
                <div className="w-full mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
                  <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Extracted Text Content:</p>
                  <p className="font-mono text-[11px] line-clamp-2">{slides[currentSlideIdx].textContent}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
