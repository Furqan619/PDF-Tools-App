import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  Upload,
  FileText,
  Sparkles,
  Download,
  Code,
  Eye,
  Copy,
  Check,
  RefreshCw,
  Globe,
  FileCode,
  ShieldCheck
} from 'lucide-react';
import { convertPdfToHtml } from '../services/pdfToHtmlEngine';
import { generateSamplePdfBlob } from '../services/sampleFiles';
import { ThemeToggle } from './ThemeToggle';
import { saveAs } from 'file-saver';
import confetti from 'canvas-confetti';

interface PdfToHtmlToolProps {
  onNavigateToDashboard: () => void;
}

export const PdfToHtmlTool: React.FC<PdfToHtmlToolProps> = ({ onNavigateToDashboard }) => {
  const [file, setFile] = useState<File | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [themeStyle, setThemeStyle] = useState<'modern' | 'invoice' | 'article' | 'raw'>('modern');
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);
  const [outputFileName, setOutputFileName] = useState('converted_webpage.html');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleFileSelected = async (selectedFile: File) => {
    if (!selectedFile || (!selectedFile.type.includes('pdf') && !selectedFile.name.toLowerCase().endsWith('.pdf'))) {
      alert('Please select a valid PDF document.');
      return;
    }

    try {
      setIsLoading(true);
      setFile(selectedFile);
      setOutputFileName(selectedFile.name.replace(/\.pdf$/i, '') + '.html');

      const buffer = await selectedFile.arrayBuffer();
      const html = await convertPdfToHtml(
        buffer,
        {
          themeStyle,
          includeStyles: true,
          extractImages: true,
        },
        (pct, msg) => {
          setProgressMsg(msg);
        }
      );

      setHtmlContent(html);
      setIsLoading(false);

      confetti({
        particleCount: 75,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      console.error('Conversion error:', err);
      alert('Failed to convert PDF to HTML: ' + err.message);
      setIsLoading(false);
    }
  };

  const handleLoadSample = async () => {
    try {
      setIsLoading(true);
      setProgressMsg('Generating sample invoice PDF...');
      const sampleBlob = await generateSamplePdfBlob('invoice');
      const sampleFile = new File([sampleBlob], 'Sample_Invoice_Report.pdf', { type: 'application/pdf' });
      await handleFileSelected(sampleFile);
    } catch (err: any) {
      console.error('Error loading sample:', err);
      setIsLoading(false);
    }
  };

  const handleThemeChange = async (newTheme: 'modern' | 'invoice' | 'article' | 'raw') => {
    setThemeStyle(newTheme);
    if (file) {
      try {
        setIsLoading(true);
        setProgressMsg('Applying new webpage theme...');
        const buffer = await file.arrayBuffer();
        const html = await convertPdfToHtml(buffer, {
          themeStyle: newTheme,
          includeStyles: true,
          extractImages: true,
        });
        setHtmlContent(html);
        setIsLoading(false);
      } catch (err) {
        setIsLoading(false);
      }
    }
  };

  const handleDownload = () => {
    if (!htmlContent) return;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    saveAs(blob, outputFileName);
  };

  const handleCopyCode = () => {
    if (!htmlContent) return;
    navigator.clipboard.writeText(htmlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
              <ArrowLeft className="w-4 h-4 text-teal-500 dark:text-teal-400 group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>

            <span className="text-slate-400 dark:text-slate-600 hidden sm:inline">/</span>

            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-600 flex items-center justify-center shadow-md shadow-teal-500/20 ring-1 ring-white/10 shrink-0">
              <Globe className="w-4 h-4 text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  PDF to <span className="text-teal-600 dark:text-teal-400 font-mono text-xs px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20">HTML</span>
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-500/20">
                  <ShieldCheck className="w-3 h-3" />
                  <span className="hidden xs:inline">Webpage Exporter</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden md:block">
                Convert PDF to HTML, web pages, invoices, reports, into Webpages
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {htmlContent && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-semibold text-xs shadow-md shadow-teal-500/25 hover:from-teal-500 hover:to-emerald-500 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download HTML Webpage</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {!file ? (
          <div className="max-w-xl mx-auto py-12 space-y-6 text-center">
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelected(e.target.files[0]);
                  }
                }}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileSelected(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-500/60 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-2xl p-10 cursor-pointer transition-all space-y-3 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-500/20 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <Globe className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Drop your PDF here to convert to HTML, or <span className="text-teal-600 dark:text-teal-400 underline">browse</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Convert PDF to HTML, web pages, invoices, reports, into Webpages
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleLoadSample}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-600 transition-all flex items-center gap-2 mx-auto"
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-500" />
                  <span>Test with Sample Invoice PDF</span>
                </button>
              </div>
            </div>
          </div>
        ) : isLoading ? (
          <div className="max-w-md mx-auto py-20 text-center space-y-4">
            <RefreshCw className="w-10 h-10 animate-spin text-teal-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Converting PDF to Webpage HTML...</h3>
            <p className="text-xs text-slate-500">{progressMsg}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Controls */}
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/10 text-teal-600 flex items-center justify-center border border-teal-200 dark:border-teal-500/20">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[140px]">{file.name}</h3>
                      <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setFile(null);
                      setHtmlContent('');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-xs text-slate-700 dark:text-slate-200 font-medium"
                  >
                    Change
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Webpage Theme Style</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleThemeChange('modern')}
                      className={`p-2.5 rounded-xl text-xs font-semibold border text-left transition-all ${
                        themeStyle === 'modern'
                          ? 'bg-teal-50 dark:bg-teal-500/10 border-teal-300 dark:border-teal-500/50 text-teal-700 dark:text-teal-300'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Modern Dark
                    </button>
                    <button
                      onClick={() => handleThemeChange('invoice')}
                      className={`p-2.5 rounded-xl text-xs font-semibold border text-left transition-all ${
                        themeStyle === 'invoice'
                          ? 'bg-teal-50 dark:bg-teal-500/10 border-teal-300 dark:border-teal-500/50 text-teal-700 dark:text-teal-300'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Corporate Invoice
                    </button>
                    <button
                      onClick={() => handleThemeChange('article')}
                      className={`p-2.5 rounded-xl text-xs font-semibold border text-left transition-all ${
                        themeStyle === 'article'
                          ? 'bg-teal-50 dark:bg-teal-500/10 border-teal-300 dark:border-teal-500/50 text-teal-700 dark:text-teal-300'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Clean Article
                    </button>
                    <button
                      onClick={() => handleThemeChange('raw')}
                      className={`p-2.5 rounded-xl text-xs font-semibold border text-left transition-all ${
                        themeStyle === 'raw'
                          ? 'bg-teal-50 dark:bg-teal-500/10 border-teal-300 dark:border-teal-500/50 text-teal-700 dark:text-teal-300'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Raw Markup
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                  <button
                    onClick={handleDownload}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-semibold text-xs shadow-md shadow-teal-500/25 hover:from-teal-500 hover:to-emerald-500 transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download HTML Webpage</span>
                  </button>

                  <button
                    onClick={handleCopyCode}
                    className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-xs border border-slate-200 dark:border-slate-600 transition-all flex items-center justify-center gap-2"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied HTML!' : 'Copy HTML Code'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Preview / Code Window */}
            <div className="lg:col-span-3 space-y-4">
              <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('preview')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'preview'
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Visual Webpage Preview</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('code')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'code'
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    <Code className="w-3.5 h-3.5" />
                    <span>HTML Source Code</span>
                  </button>
                </div>

                <span className="text-xs text-slate-500 font-mono hidden sm:inline">Output: {outputFileName}</span>
              </div>

              {activeTab === 'preview' ? (
                <div className="w-full h-[650px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white overflow-hidden shadow-sm">
                  <iframe
                    srcDoc={htmlContent}
                    title="Webpage Preview"
                    className="w-full h-full border-0"
                  />
                </div>
              ) : (
                <div className="w-full h-[650px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-950 p-4 overflow-auto font-mono text-xs text-emerald-400 shadow-sm">
                  <pre className="whitespace-pre-wrap">{htmlContent}</pre>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/60 py-4 text-center text-xs text-slate-500 dark:text-slate-500 mt-auto">
        PDF to HTML Pro • 100% Client-Side PDF to Webpage Exporter
      </footer>
    </div>
  );
};

