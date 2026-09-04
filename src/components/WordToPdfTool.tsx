import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  Upload,
  FileText,
  Sparkles,
  Download,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Layers,
  Eye,
  FileCheck,
  Check
} from 'lucide-react';
import {
  ParsedWordDocument,
  parseWordDocument,
  convertWordToPdf,
  generateSampleWordBlob
} from '../services/wordToPdfEngine';
import { ThemeToggle } from './ThemeToggle';
import { saveAs } from 'file-saver';
import confetti from 'canvas-confetti';

interface WordToPdfToolProps {
  onNavigateToDashboard: () => void;
}

export const WordToPdfTool: React.FC<WordToPdfToolProps> = ({ onNavigateToDashboard }) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedDoc, setParsedDoc] = useState<ParsedWordDocument | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [fontSize, setFontSize] = useState<number>(11);
  const [lineSpacing, setLineSpacing] = useState<number>(1.4);
  const [includeHeaderFooter, setIncludeHeaderFooter] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputFileName, setOutputFileName] = useState('converted_document.pdf');
  const [activeTab, setActiveTab] = useState<'preview' | 'settings'>('preview');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleFileSelected = async (selectedFile: File) => {
    if (!selectedFile || (!selectedFile.name.toLowerCase().endsWith('.docx') && !selectedFile.name.toLowerCase().endsWith('.doc'))) {
      alert('Please upload a valid Word document (.docx).');
      return;
    }

    try {
      setIsLoading(true);
      setFile(selectedFile);
      setOutputBlob(null);
      setOutputFileName(selectedFile.name.replace(/\.[^/.]+$/, '') + '.pdf');

      const buffer = await selectedFile.arrayBuffer();
      const doc = await parseWordDocument(buffer, (pct, msg) => {
        setProgressMsg(msg);
      });

      setParsedDoc(doc);
      setIsLoading(false);

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      console.error('Error parsing Word doc:', err);
      alert('Failed to parse Word document: ' + err.message);
      setIsLoading(false);
    }
  };

  const handleLoadSample = async () => {
    try {
      setIsLoading(true);
      setProgressMsg('Generating sample Word document...');
      const sampleBlob = await generateSampleWordBlob();
      const sampleFile = new File([sampleBlob], 'Executive_Business_Proposal.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      await handleFileSelected(sampleFile);
    } catch (err: any) {
      console.error('Error loading sample:', err);
      setIsLoading(false);
    }
  };

  const handleConvert = async () => {
    if (!parsedDoc) return;

    try {
      setIsProcessing(true);
      setProgressMsg('Converting Word document to PDF...');

      const blob = await convertWordToPdf(
        parsedDoc,
        {
          fontSize,
          lineSpacing,
          includeHeaderFooter,
        },
        (pct, msg) => {
          setProgressMsg(msg);
        }
      );

      setOutputBlob(blob);
      setIsProcessing(false);

      confetti({
        particleCount: 85,
        spread: 75,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      console.error('Conversion error:', err);
      alert('Failed to convert Word document to PDF: ' + err.message);
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!outputBlob) return;
    saveAs(outputBlob, outputFileName);
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
              <ArrowLeft className="w-4 h-4 text-blue-500 dark:text-blue-400 group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>

            <span className="text-slate-400 dark:text-slate-600 hidden sm:inline">/</span>

            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 ring-1 ring-white/10 shrink-0">
              <FileText className="w-4 h-4 text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  Word to <span className="text-blue-600 dark:text-blue-400 font-mono text-xs px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">PDF</span>
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                  <ShieldCheck className="w-3 h-3" />
                  <span className="hidden xs:inline">DOCX to PDF Converter</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden md:block">
                Make word document and DOCX files easy to read by converting them to PDF
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {outputBlob && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-xs shadow-md shadow-blue-500/25 hover:from-blue-500 hover:to-indigo-500 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {!file ? (
          <div className="max-w-xl mx-auto py-12 space-y-6 text-center">
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500/60 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-2xl p-10 cursor-pointer transition-all space-y-3 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <FileText className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Drop your Word (.docx) file here, or <span className="text-blue-600 dark:text-blue-400 underline">browse</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Make Word documents easy to read and share by converting them to PDF
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleLoadSample}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-600 transition-all flex items-center gap-2 mx-auto"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                  <span>Test with Sample Business Proposal (.docx)</span>
                </button>
              </div>
            </div>
          </div>
        ) : isLoading ? (
          <div className="max-w-md mx-auto py-20 text-center space-y-4">
            <RefreshCw className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Processing Word Document...</h3>
            <p className="text-xs text-slate-500">{progressMsg}</p>
          </div>
        ) : parsedDoc ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Settings & Actions */}
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center border border-blue-200 dark:border-blue-500/20">
                      <FileCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[180px]">{file.name}</h3>
                      <p className="text-xs text-slate-500">{parsedDoc.wordCount} words • {parsedDoc.paragraphCount} paragraphs</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setFile(null);
                      setParsedDoc(null);
                      setOutputBlob(null);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-xs text-slate-700 dark:text-slate-200 font-medium"
                  >
                    Change
                  </button>
                </div>

                {/* PDF Options */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">PDF Styling Options</h4>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Body Font Size ({fontSize} pt)
                    </label>
                    <input
                      type="range"
                      min={9}
                      max={14}
                      step={1}
                      value={fontSize}
                      onChange={(e) => setFontSize(parseInt(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Line Spacing ({lineSpacing}x)
                    </label>
                    <input
                      type="range"
                      min={1.1}
                      max={2.0}
                      step={0.1}
                      value={lineSpacing}
                      onChange={(e) => setLineSpacing(parseFloat(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </div>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={includeHeaderFooter}
                      onChange={(e) => setIncludeHeaderFooter(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>Include professional header & page numbers</span>
                  </label>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                  <button
                    onClick={handleConvert}
                    disabled={isProcessing}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-xs shadow-md shadow-blue-500/25 hover:from-blue-500 hover:to-indigo-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Converting Document...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Convert to PDF Now</span>
                      </>
                    )}
                  </button>

                  {outputBlob && (
                    <button
                      onClick={handleDownload}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Converted PDF</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Document Content Preview */}
            <div className="lg:col-span-2 space-y-6">
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Eye className="w-4 h-4 text-blue-500" />
                    <span>Document Content Preview ({parsedDoc.paragraphs.length} paragraphs)</span>
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">Title: {parsedDoc.title}</span>
                </div>

                <div className="max-h-[550px] overflow-y-auto space-y-3 pr-2 font-serif text-sm bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                  {parsedDoc.paragraphs.map((p, idx) => (
                    <div
                      key={idx}
                      className={`${
                        p.isHeading
                          ? 'font-bold text-lg text-slate-900 dark:text-white pt-3 pb-1 border-b border-slate-200 dark:border-slate-800 font-sans'
                          : 'text-slate-700 dark:text-slate-300 leading-relaxed'
                      }`}
                    >
                      {p.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/60 py-4 text-center text-xs text-slate-500 dark:text-slate-500 mt-auto">
        Word to PDF Pro • 100% Client-Side DOCX Converter & Reader
      </footer>
    </div>
  );
};
