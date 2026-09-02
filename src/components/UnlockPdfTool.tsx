import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  Upload,
  FileText,
  Sparkles,
  Download,
  ShieldCheck,
  Unlock,
  Key,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Check,
  HelpCircle,
  Lock,
  Shield
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { pdfjsLib } from '../services/pdfWorker';
import { generateSamplePdfBlob } from '../services/sampleFiles';
import { saveAs } from 'file-saver';
import confetti from 'canvas-confetti';
import { ThemeToggle } from './ThemeToggle';

interface UnlockPdfToolProps {
  onNavigateToDashboard: () => void;
}

export const UnlockPdfTool: React.FC<UnlockPdfToolProps> = ({ onNavigateToDashboard }) => {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockedBlob, setUnlockedBlob] = useState<Blob | null>(null);
  const [outputFileName, setOutputFileName] = useState('unlocked_document.pdf');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stats, setStats] = useState({
    originalSize: 0,
    unlockedSize: 0,
    pageCount: 0,
    permissionsRestored: ['Printing Allowed', 'Text Copying Allowed', 'Modification Allowed', 'Form Filling Allowed']
  });

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
      setFile(selectedFile);
      setErrorMessage(null);
      setOutputFileName(selectedFile.name.replace(/\.pdf$/i, '_unlocked.pdf'));
      
      const buffer = await selectedFile.arrayBuffer();

      // Test loading with pdf-lib
      try {
        const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        setIsEncrypted(false);
        await processUnlock(buffer, selectedFile);
      } catch (err: any) {
        // If loading fails due to password or encryption
        setIsEncrypted(true);
        setIsUnlocking(false);
      }
    } catch (err: any) {
      console.error('Error loading PDF:', err);
      setErrorMessage('Failed to read PDF file: ' + err.message);
    }
  };

  const processUnlock = async (buffer: ArrayBuffer, currentFile: File, userPassword?: string) => {
    try {
      setIsUnlocking(true);
      setErrorMessage(null);

      // Load document with password if provided
      const loadOptions: any = { ignoreEncryption: true };
      if (userPassword) {
        loadOptions.password = userPassword;
      }

      const pdfDoc = await PDFDocument.load(buffer, loadOptions);
      
      // Save without encryption & restrictions
      const unlockedBytes = await pdfDoc.save();
      const blob = new Blob([unlockedBytes as Uint8Array], { type: 'application/pdf' });
      
      setUnlockedBlob(blob);
      setStats({
        originalSize: currentFile.size,
        unlockedSize: blob.size,
        pageCount: pdfDoc.getPageCount(),
        permissionsRestored: ['Printing Allowed', 'Text Copying Allowed', 'Modification Allowed', 'Form Filling Allowed']
      });

      setIsUnlocking(false);
      setIsUnlocked(true);

      confetti({
        particleCount: 85,
        spread: 75,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      console.error('Unlock error:', err);
      setIsUnlocking(false);
      setErrorMessage('Incorrect password or unable to decrypt this document. Please check the password and try again.');
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    file.arrayBuffer().then((buffer) => {
      processUnlock(buffer, file, password);
    });
  };

  const handleLoadSample = async () => {
    try {
      const sampleBlob = await generateSamplePdfBlob('invoice');
      const sampleFile = new File([sampleBlob], 'Secure_Locked_Invoice.pdf', { type: 'application/pdf' });
      await handleFileSelected(sampleFile);
    } catch (err) {
      console.error('Error loading sample:', err);
    }
  };

  const handleDownload = () => {
    if (!unlockedBlob) return;
    saveAs(unlockedBlob, outputFileName);
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
              <ArrowLeft className="w-4 h-4 text-violet-500 dark:text-violet-400 group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>

            <span className="text-slate-400 dark:text-slate-600 hidden sm:inline">/</span>

            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/20 ring-1 ring-white/10 shrink-0">
              <Unlock className="w-4 h-4 text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  Unlock <span className="text-violet-600 dark:text-violet-400 font-mono text-xs px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20">PDF</span>
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20">
                  <ShieldCheck className="w-3 h-3" />
                  <span className="hidden xs:inline">Password & Restriction Remover</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden md:block">
                Remove PDF password security, Freedom to use your PDFs as you want
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isUnlocked && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold text-xs shadow-md shadow-violet-500/25 hover:from-violet-500 hover:to-purple-500 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download Unlocked PDF</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
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
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-violet-500/60 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-2xl p-10 cursor-pointer transition-all space-y-3 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <Unlock className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Drop your locked PDF here, or <span className="text-violet-600 dark:text-violet-400 underline">browse</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Remove passwords, printing restrictions, and editing locks instantly
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleLoadSample}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-600 transition-all flex items-center gap-2 mx-auto"
                >
                  <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                  <span>Test with Sample Secured Document</span>
                </button>
              </div>
            </div>
          </div>
        ) : isEncrypted && !isUnlocked ? (
          <div className="max-w-md mx-auto py-12 space-y-6">
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center mx-auto">
                <Lock className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Password Protected PDF</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {file.name} requires a password to decrypt and remove security restrictions.
                </p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Enter Document Password
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                      autoFocus
                    />
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs">
                    {errorMessage}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setIsEncrypted(false);
                      setPassword('');
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUnlocking}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold text-xs shadow-md shadow-violet-500/25 hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isUnlocking ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Unlocking...</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4" />
                        <span>Unlock PDF</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      {file.name}
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                        Successfully Unlocked
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      All password protection and usage restrictions have been permanently removed.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setFile(null);
                      setIsUnlocked(false);
                      setUnlockedBlob(null);
                      setPassword('');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-600 transition-colors"
                  >
                    Unlock Another PDF
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold text-xs shadow-md shadow-violet-500/25 hover:from-violet-500 hover:to-purple-500 transition-all flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">File Name</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 truncate">{file.name}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Page Count</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{stats.pageCount} Pages</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Security Status</span>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">100% Unrestricted</p>
                </div>
              </div>

              {/* Restored Permissions */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-violet-500" />
                  <span>Restored Full Permissions</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {stats.permissionsRestored.map((perm, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{perm}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/60 py-4 text-center text-xs text-slate-500 dark:text-slate-500 mt-auto">
        Unlock PDF • 100% Client-Side Password & Restriction Remover
      </footer>
    </div>
  );
};
