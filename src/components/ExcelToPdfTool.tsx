import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Sparkles,
  Download,
  Eye,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Table
} from 'lucide-react';
import {
  ExcelToPdfConfig,
  DEFAULT_EXCEL_CONFIG,
  ExcelWorkbookData,
  parseExcelFile,
  convertExcelToPdf,
  generateSampleExcelBlob
} from '../services/excelToPdfEngine';
import { ThemeToggle } from './ThemeToggle';
import { saveAs } from 'file-saver';

interface ExcelToPdfToolProps {
  onNavigateToDashboard: () => void;
}

export const ExcelToPdfTool: React.FC<ExcelToPdfToolProps> = ({ onNavigateToDashboard }) => {
  const [file, setFile] = useState<File | null>(null);
  const [workbookData, setWorkbookData] = useState<ExcelWorkbookData | null>(null);
  const [config, setConfig] = useState<ExcelToPdfConfig>(DEFAULT_EXCEL_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
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
    if (!selectedFile) return;

    try {
      setIsLoading(true);
      setFile(selectedFile);
      setOutputBlob(null);

      const buffer = await selectedFile.arrayBuffer();
      const parsed = await parseExcelFile(buffer, (pct, msg) => {
        setProgressMsg(msg);
      });

      setWorkbookData(parsed);
      setIsLoading(false);
    } catch (err: any) {
      console.error('Error parsing Excel spreadsheet:', err);
      alert('Failed to parse Excel file. Please ensure it is a valid .xlsx or .csv spreadsheet.');
      setIsLoading(false);
    }
  };

  const loadSample = async () => {
    try {
      setIsLoading(true);
      const blob = await generateSampleExcelBlob();
      const sampleFile = new File([blob], 'Q3_Financial_Ledger.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      await handleLoadFile(sampleFile);
    } catch (err) {
      console.error('Error loading sample excel:', err);
      setIsLoading(false);
    }
  };

  const handleConvert = async () => {
    if (!workbookData || !file) return;

    try {
      setIsProcessing(true);
      const activeSheet = workbookData.sheets[workbookData.activeSheetIndex] || workbookData.sheets[0];
      const blob = await convertExcelToPdf(activeSheet, config, (pct, msg) => {
        setProgressMsg(msg);
      });

      setOutputBlob(blob);
      setIsProcessing(false);
    } catch (err: any) {
      console.error('Error converting Excel to PDF:', err);
      alert('Failed to convert Excel to PDF.');
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!outputBlob || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    saveAs(outputBlob, `${baseName}_converted.pdf`);
  };

  const activeSheet = workbookData?.sheets[workbookData.activeSheetIndex] || workbookData?.sheets[0];

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
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-sm">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Excel to PDF
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
        {!workbookData ? (
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
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                Convert Excel Spreadsheets to PDF (.xlsx, .xls, .csv)
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
                Transform spreadsheets, financial ledgers, and data tables into crisp, printable PDF documents.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleLoadFile(e.target.files[0])}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md shadow-emerald-500/20 transition disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{progressMsg || 'Parsing Spreadsheet...'}</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Select Excel File</span>
                  </>
                )}
              </button>

              {/* Sample Preset */}
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700/60">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  Or Test with Sample Financial Spreadsheet:
                </p>
                <button
                  onClick={loadSample}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-slate-700 transition inline-flex items-center gap-2"
                >
                  <Table className="w-4 h-4 text-emerald-600" />
                  <span>Q3 Financial Ledger & Inventory Spreadsheet</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Workspace */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Controls */}
            <div className="lg:col-span-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700/60">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                    {file?.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {workbookData.sheets.length} Sheets • {file ? formatBytes(file.size) : ''}
                  </p>
                </div>
                <button
                  onClick={() => setWorkbookData(null)}
                  className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline"
                >
                  New File
                </button>
              </div>

              {/* Sheet Selector */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                  Select Worksheet
                </label>
                <select
                  value={workbookData.activeSheetIndex}
                  onChange={(e) => setWorkbookData({ ...workbookData, activeSheetIndex: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                >
                  {workbookData.sheets.map((s, idx) => (
                    <option key={idx} value={idx}>
                      {s.name} ({s.rows.length} rows)
                    </option>
                  ))}
                </select>
              </div>

              {/* PDF Formatting Options */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                    Table Theme
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'corporate', label: 'Corporate' },
                      { id: 'clean', label: 'Clean Light' },
                      { id: 'dark', label: 'Dark Mode' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setConfig({ ...config, theme: t.id as any })}
                        className={`px-2 py-2 rounded-xl text-xs font-medium border text-center transition ${
                          config.theme === t.id
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400 mb-1 block">Page Size</label>
                    <select
                      value={config.pageSize}
                      onChange={(e) => setConfig({ ...config, pageSize: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                    >
                      <option value="A4">A4 Standard</option>
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
                      <option value="landscape">Landscape</option>
                      <option value="portrait">Portrait</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Include Gridlines
                  </label>
                  <input
                    type="checkbox"
                    checked={config.includeGridlines}
                    onChange={(e) => setConfig({ ...config, includeGridlines: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Convert Action */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60">
                {!outputBlob ? (
                  <button
                    onClick={handleConvert}
                    disabled={isProcessing}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md shadow-emerald-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
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
                          {activeSheet?.rows.length} spreadsheet rows compiled
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
            </div>

            {/* Right Spreadsheet Preview Table */}
            <div className="lg:col-span-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700/60 mb-6">
                <div className="flex items-center gap-2">
                  <Table className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                    Spreadsheet Preview: {activeSheet?.name}
                  </span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {activeSheet?.rows.length} rows total
                </span>
              </div>

              <div className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-auto p-4 max-h-[500px]">
                {activeSheet && activeSheet.rows.length > 0 ? (
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-emerald-600 text-white">
                        {activeSheet.rows[0].map((cell: any, cIdx: number) => (
                          <th key={cIdx} className="p-2.5 text-left font-semibold border border-emerald-700">
                            {String(cell !== undefined ? cell : '')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeSheet.rows.slice(1).map((row: any[], rIdx: number) => (
                        <tr key={rIdx} className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50">
                          {row.map((cell: any, cIdx: number) => (
                            <td key={cIdx} className="p-2.5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                              {String(cell !== undefined && cell !== null ? cell : '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-12">No data rows found in this sheet.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
