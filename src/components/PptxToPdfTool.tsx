import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  Upload,
  Sparkles,
  Download,
  Eye,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Layers,
  ChevronLeft,
  ChevronRight,
  Presentation,
  FileText
} from 'lucide-react';
import {
  PptxToPdfConfig,
  DEFAULT_PPTX_TO_PDF_CONFIG,
  ParsedSlide,
  parsePptxFile,
  convertSlidesToPdf,
  generateSamplePptxBlob
} from '../services/pptxToPdfEngine';
import { ThemeToggle } from './ThemeToggle';
import { saveAs } from 'file-saver';

interface PptxToPdfToolProps {
  onNavigateToDashboard: () => void;
}

export const PptxToPdfTool: React.FC<PptxToPdfToolProps> = ({ onNavigateToDashboard }) => {
  const [file, setFile] = useState<File | null>(null);
  const [slides, setSlides] = useState<ParsedSlide[]>([]);
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [config, setConfig] = useState<PptxToPdfConfig>(DEFAULT_PPTX_TO_PDF_CONFIG);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleLoadFile = async (selectedFile: File) => {
    if (!selectedFile || (!selectedFile.name.toLowerCase().endsWith('.pptx') && !selectedFile.name.toLowerCase().endsWith('.ppt'))) {
      alert('Please upload a valid PowerPoint (.pptx) file.');
      return;
    }

    try {
      setIsLoading(true);
      setFile(selectedFile);
      setOutputBlob(null);

      const buffer = await selectedFile.arrayBuffer();
      const parsed = await parsePptxFile(buffer, (pct, msg) => {
        setProgressMsg(msg);
      });

      setSlides(parsed);
      setCurrentSlideIdx(0);
      setIsLoading(false);
    } catch (err: any) {
      console.error('Error parsing PowerPoint:', err);
      alert('Failed to parse PowerPoint presentation. Please check the file format.');
      setIsLoading(false);
    }
  };

  const loadSample = async (preset: 'executive' | 'sales') => {
    try {
      setIsLoading(true);
      const sampleBlob = await generateSamplePptxBlob(preset);
      const sampleFile = new File([sampleBlob], `${preset}_presentation.pptx`, {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
      await handleLoadFile(sampleFile);
    } catch (err) {
      console.error('Error loading sample pptx:', err);
      setIsLoading(false);
    }
  };

  const handleConvert = async () => {
    if (slides.length === 0 || !file) return;

    try {
      setIsProcessing(true);
      const blob = await convertSlidesToPdf(slides, config, (pct, msg) => {
        setProgressMsg(msg);
      });

      setOutputBlob(blob);
      setIsProcessing(false);
    } catch (err: any) {
      console.error('Error converting slides to PDF:', err);
      alert('Failed to convert presentation to PDF.');
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!outputBlob || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    saveAs(outputBlob, `${baseName}_converted.pdf`);
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
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-sm">
                <Presentation className="w-4 h-4" />
              </div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                PowerPoint to PDF
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
                  handleLoadFile(e.dataTransfer.files[0]);
                }
              }}
            >
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
                <Presentation className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                Convert PowerPoint (.pptx) to PDF
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
                Transform PowerPoint slide decks into clean, professional PDF documents ready for printing or distribution.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation"
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
                    <span>{progressMsg || 'Parsing Presentation...'}</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Select PowerPoint File</span>
                  </>
                )}
              </button>

              {/* Sample Presets */}
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700/60">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  Or Test with Sample Presentation:
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => loadSample('executive')}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 transition"
                  >
                    📊 Executive Strategy Review
                  </button>
                  <button
                    onClick={() => loadSample('sales')}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 transition"
                  >
                    🚀 Product Launch Deck
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Workspace */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Options */}
            <div className="lg:col-span-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700/60">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                    {file?.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {slides.length} Slides • {file ? formatBytes(file.size) : ''}
                  </p>
                </div>
                <button
                  onClick={() => setSlides([])}
                  className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline"
                >
                  New File
                </button>
              </div>

              {/* Theme & Layout Settings */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                    Slide Theme
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'corporate', label: 'Corporate' },
                      { id: 'clean', label: 'Clean Light' },
                      { id: 'dark', label: 'Dark Mode' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setConfig({ ...config, slideTheme: t.id as any })}
                        className={`px-2 py-2 rounded-xl text-xs font-medium border text-center transition ${
                          config.slideTheme === t.id
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-500/50 text-indigo-700 dark:text-indigo-300'
                            : 'bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                    Page Size & Layout
                  </label>
                  <select
                    value={config.pageSize}
                    onChange={(e) => setConfig({ ...config, pageSize: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  >
                    <option value="Presentation_16X9">Widescreen (16:9)</option>
                    <option value="Letter">US Letter</option>
                  </select>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Include Slide Numbers
                  </label>
                  <input
                    type="checkbox"
                    checked={config.includeSlideNumbers}
                    onChange={(e) => setConfig({ ...config, includeSlideNumbers: e.target.checked })}
                    className="w-4 h-4 accent-indigo-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Convert Action */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60">
                {!outputBlob ? (
                  <button
                    onClick={handleConvert}
                    disabled={isProcessing}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md shadow-indigo-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{progressMsg || 'Converting to PDF...'}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Convert to PDF</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                          PDF Conversion Successful!
                        </p>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                          {slides.length} slides compiled into PDF
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleDownload}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md shadow-emerald-500/20 transition flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download PDF</span>
                    </button>
                    <button
                      onClick={() => setOutputBlob(null)}
                      className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-medium text-xs transition"
                    >
                      Change Settings
                    </button>
                  </div>
                )}
              </div>

              {/* Slide Navigator List */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3 block">
                  Slides Navigator ({slides.length})
                </label>
                <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                  {slides.map((s, idx) => (
                    <div
                      key={s.slideNumber}
                      onClick={() => setCurrentSlideIdx(idx)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition ${
                        currentSlideIdx === idx
                          ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-400 dark:border-indigo-500/50'
                          : 'bg-slate-50 dark:bg-slate-700/40 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                        {s.slideNumber}. {s.title}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Slide Preview */}
            <div className="lg:col-span-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex flex-col items-center">
              <div className="w-full flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700/60 mb-6">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-500" />
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

              {/* Slide Card Simulation */}
              <div className={`w-full rounded-2xl p-8 shadow-xl border flex flex-col justify-between min-h-[420px] transition-colors ${
                config.slideTheme === 'dark'
                  ? 'bg-slate-950 text-white border-slate-800'
                  : config.slideTheme === 'corporate'
                  ? 'bg-slate-50 text-slate-900 border-indigo-200'
                  : 'bg-white text-slate-900 border-slate-200'
              }`}>
                {slides[currentSlideIdx] && (
                  <>
                    <div>
                      {config.slideTheme === 'corporate' && (
                        <div className="w-full bg-indigo-600 text-white py-3 px-4 rounded-xl mb-6 shadow-sm">
                          <h3 className="text-lg font-bold truncate">
                            {slides[currentSlideIdx].title}
                          </h3>
                        </div>
                      )}
                      {config.slideTheme !== 'corporate' && (
                        <h3 className="text-2xl font-bold mb-6 text-indigo-600 dark:text-indigo-400">
                          {slides[currentSlideIdx].title}
                        </h3>
                      )}
                      <ul className="space-y-3">
                        {slides[currentSlideIdx].bullets.map((b, bIdx) => (
                          <li key={bIdx} className="text-sm opacity-90 flex items-start gap-2">
                            <span className="text-indigo-500 font-bold">•</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs opacity-60">
                      <span>{file?.name}</span>
                      {config.includeSlideNumbers && (
                        <span>Slide {currentSlideIdx + 1} of {slides.length}</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
