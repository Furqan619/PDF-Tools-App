import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  Upload,
  FileCode,
  Sparkles,
  Download,
  Eye,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Code,
  Layout,
  Globe,
  FileText
} from 'lucide-react';
import {
  HtmlToPdfConfig,
  DEFAULT_HTML_CONFIG,
  HTML_TEMPLATES,
  convertHtmlToPdfBlob
} from '../services/htmlToPdfEngine';
import { ThemeToggle } from './ThemeToggle';
import { saveAs } from 'file-saver';

interface HtmlToPdfToolProps {
  onNavigateToDashboard: () => void;
}

export const HtmlToPdfTool: React.FC<HtmlToPdfToolProps> = ({ onNavigateToDashboard }) => {
  const [htmlCode, setHtmlCode] = useState<string>(HTML_TEMPLATES[0].html);
  const [config, setConfig] = useState<HtmlToPdfConfig>(DEFAULT_HTML_CONFIG);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [outputResult, setOutputResult] = useState<{ blob: Blob; url: string; size: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setHtmlCode(content);
        setOutputResult(null);
      }
    };
    reader.readAsText(file);
  };

  const handleConvert = async () => {
    try {
      setIsProcessing(true);
      setOutputResult(null);

      const blob = await convertHtmlToPdfBlob(htmlCode, config, (pct, msg) => {
        setProgressMsg(msg);
      });

      const url = URL.createObjectURL(blob);
      setOutputResult({
        blob,
        url,
        size: blob.size,
      });
      setIsProcessing(false);
    } catch (err: any) {
      console.error('Error converting HTML to PDF:', err);
      alert('Failed to convert HTML to PDF. Please check your HTML syntax.');
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!outputResult) return;
    saveAs(outputResult.blob, 'document_from_html.pdf');
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
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm">
                <Code className="w-4 h-4" />
              </div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                HTML to PDF
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Controls & Code Editor */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700/60">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileCode className="w-4 h-4 text-emerald-500" />
                <span>HTML Source & Templates</span>
              </h2>
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm,.txt"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload HTML</span>
              </button>
            </div>

            {/* Template Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                Quick HTML Presets
              </label>
              <div className="grid grid-cols-2 gap-2">
                {HTML_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setHtmlCode(t.html);
                      setOutputResult(null);
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-700/50 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition text-left"
                  >
                    📄 {t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* HTML Editor Textarea */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  HTML & CSS Markup
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {htmlCode.length} chars
                </span>
              </div>
              <textarea
                value={htmlCode}
                onChange={(e) => {
                  setHtmlCode(e.target.value);
                  setOutputResult(null);
                }}
                rows={10}
                className="w-full font-mono text-xs p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-900 text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
              />
            </div>

            {/* Page Settings */}
            <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-700/60">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                PDF Layout Settings
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400 mb-1 block">Page Size</label>
                  <select
                    value={config.pageSize}
                    onChange={(e) => setConfig({ ...config, pageSize: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  >
                    <option value="A4">A4 (Standard)</option>
                    <option value="Letter">US Letter</option>
                    <option value="Legal">US Legal</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400 mb-1 block">Orientation</label>
                  <select
                    value={config.orientation}
                    onChange={(e) => setConfig({ ...config, orientation: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Convert & Download Action */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60">
              {!outputResult ? (
                <button
                  onClick={handleConvert}
                  disabled={isProcessing}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md shadow-emerald-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{progressMsg || 'Generating PDF...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Convert HTML to PDF</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                        PDF Generated Successfully!
                      </p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        {formatBytes(outputResult.size)} • High Fidelity Render
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
                    onClick={() => setOutputResult(null)}
                    className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-medium text-xs transition"
                  >
                    Edit HTML / Convert Again
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Live Preview Panel */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700/60 mb-6">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                  Live HTML Preview
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{config.pageSize} • {config.orientation}</span>
              </div>
            </div>

            {/* Rendered HTML Preview Box */}
            <div className="flex-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-auto p-6 flex justify-center min-h-[550px]">
              <div
                className="bg-white shadow-xl rounded-lg w-full max-w-[700px] min-h-[700px] overflow-hidden"
                dangerouslySetInnerHTML={{ __html: htmlCode }}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
