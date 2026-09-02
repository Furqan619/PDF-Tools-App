import React, { useState, useEffect, useRef } from 'react';
import {
  FileSpreadsheet,
  ArrowLeft,
  Upload,
  Sparkles,
  Download,
  Copy,
  Check,
  RefreshCw,
  Table as TableIcon,
  Plus,
  Trash2,
  Settings,
  Eye,
  FileText,
  Layers,
  ChevronRight,
  ChevronDown,
  Hash,
  DollarSign,
  Percent,
  Calendar,
  Type,
  FileCode,
  FileArchive,
  Info,
  Sliders,
  CheckCircle2,
  Maximize2,
  Edit3
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { saveAs } from 'file-saver';
import { ThemeToggle } from './ThemeToggle';
import {
  DetectedTable,
  ExtractionOptions,
  DEFAULT_TABLE_EXTRACTION_OPTIONS,
  ExcelExportSettings,
  DEFAULT_EXCEL_EXPORT_SETTINGS,
  extractTablesFromPdf,
  generateExcelWorkbook,
  exportTableToCsv,
  exportTableToTsv,
  exportTableToJson,
  exportTableToHtml,
  downloadAllTablesAsZip,
  detectCellType,
  ColumnType
} from '../services/pdfTableExtractor';
import {
  SAMPLE_TABLE_PRESETS,
  generateSampleTablePdf
} from '../services/sampleTablePdfs';
import { pdfjsLib } from '../services/pdfWorker';

interface PdfToExcelConverterProps {
  onNavigateToDashboard: () => void;
}

export function PdfToExcelConverter({ onNavigateToDashboard }: PdfToExcelConverterProps) {
  // Document State
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  // Extracted Tables
  const [tables, setTables] = useState<DetectedTable[]>([]);
  const [selectedTableIndex, setSelectedTableIndex] = useState<number>(0);
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; colIdx: number } | null>(null);
  const [editingHeaderIdx, setEditingHeaderIdx] = useState<number | null>(null);

  // Options & Settings
  const [options, setOptions] = useState<ExtractionOptions>(DEFAULT_TABLE_EXTRACTION_OPTIONS);
  const [exportSettings, setExportSettings] = useState<ExcelExportSettings>(DEFAULT_EXCEL_EXPORT_SETTINGS);
  const [showOptionsPanel, setShowOptionsPanel] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPdfVisualizer, setShowPdfVisualizer] = useState(false);
  const [pdfPageImages, setPdfPageImages] = useState<string[]>([]);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeTable = tables[selectedTableIndex] || null;

  // Render PDF pages for live visual overlay
  const renderPdfThumbnails = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
      const images: string[] = [];

      for (let p = 1; p <= Math.min(pdf.numPages, 10); p++) {
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 1.2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await (page.render as any)({ canvasContext: ctx, viewport, canvas }).promise;
          images.push(canvas.toDataURL('image/jpeg', 0.85));
        }
      }
      setPdfPageImages(images);
    } catch (e) {
      console.warn('Could not generate PDF page preview:', e);
    }
  };

  // Run Table Extraction Pipeline
  const processFile = async (file: File, opts: ExtractionOptions = options) => {
    setIsProcessing(true);
    setProgressPercent(10);
    setProgressMsg('Reading PDF document structure...');
    setCurrentFile(file);

    abortControllerRef.current?.abort();
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    try {
      // Async render preview images
      renderPdfThumbnails(file);

      const detected = await extractTablesFromPdf(
        file,
        opts,
        (p) => {
          setProgressPercent(p.percent);
          setProgressMsg(p.statusMessage);
        },
        abortCtrl.signal
      );

      setTables(detected);
      setSelectedTableIndex(0);
      setExportSettings((prev) => ({
        ...prev,
        filename: file.name.replace(/\.pdf$/i, '') + '_Tables.xlsx',
      }));

      if (detected.length > 0) {
        confetti({
          particleCount: 45,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#06b6d4', '#3b82f6', '#10b981', '#6366f1'],
        });
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Table extraction failed:', err);
        alert('Failed to extract tables from this PDF. Please check if the document contains readable text/tables.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      processFile(file);
    }
  };

  const loadSamplePreset = async (presetId: string) => {
    setIsProcessing(true);
    setProgressMsg('Generating high-fidelity sample PDF with structured tables...');
    try {
      const file = await generateSampleTablePdf(presetId);
      await processFile(file);
    } catch (err) {
      console.error(err);
    }
  };

  // Table Cell Editing Helpers
  const updateCellValue = (rowIdx: number, colIdx: number, value: string) => {
    if (!activeTable) return;
    const newRows = activeTable.rows.map((r, rI) => {
      if (rI !== rowIdx) return r;
      const newRow = [...r];
      newRow[colIdx] = value;
      return newRow;
    });

    const updatedTable: DetectedTable = {
      ...activeTable,
      rows: newRows,
    };

    setTables((prev) => prev.map((t, idx) => (idx === selectedTableIndex ? updatedTable : t)));
  };

  const updateHeaderValue = (colIdx: number, value: string) => {
    if (!activeTable) return;
    const newHeaders = [...activeTable.headers];
    newHeaders[colIdx] = value;

    const updatedTable: DetectedTable = {
      ...activeTable,
      headers: newHeaders,
    };

    setTables((prev) => prev.map((t, idx) => (idx === selectedTableIndex ? updatedTable : t)));
  };

  const addRow = () => {
    if (!activeTable) return;
    const emptyRow = Array(activeTable.headers.length).fill('');
    const updatedTable: DetectedTable = {
      ...activeTable,
      rows: [...activeTable.rows, emptyRow],
    };
    setTables((prev) => prev.map((t, idx) => (idx === selectedTableIndex ? updatedTable : t)));
  };

  const deleteRow = (rowIdx: number) => {
    if (!activeTable || activeTable.rows.length <= 1) return;
    const updatedRows = activeTable.rows.filter((_, idx) => idx !== rowIdx);
    const updatedTable: DetectedTable = {
      ...activeTable,
      rows: updatedRows,
    };
    setTables((prev) => prev.map((t, idx) => (idx === selectedTableIndex ? updatedTable : t)));
  };

  const addColumn = () => {
    if (!activeTable) return;
    const newHeaders = [...activeTable.headers, `Col ${activeTable.headers.length + 1}`];
    const newRows = activeTable.rows.map((r) => [...r, '']);
    const newColTypes: ColumnType[] = [...activeTable.columnTypes, 'text'];

    const updatedTable: DetectedTable = {
      ...activeTable,
      headers: newHeaders,
      rows: newRows,
      columnTypes: newColTypes,
    };
    setTables((prev) => prev.map((t, idx) => (idx === selectedTableIndex ? updatedTable : t)));
  };

  const deleteColumn = (colIdx: number) => {
    if (!activeTable || activeTable.headers.length <= 1) return;
    const newHeaders = activeTable.headers.filter((_, idx) => idx !== colIdx);
    const newRows = activeTable.rows.map((r) => r.filter((_, idx) => idx !== colIdx));
    const newColTypes = activeTable.columnTypes.filter((_, idx) => idx !== colIdx);

    const updatedTable: DetectedTable = {
      ...activeTable,
      headers: newHeaders,
      rows: newRows,
      columnTypes: newColTypes,
    };
    setTables((prev) => prev.map((t, idx) => (idx === selectedTableIndex ? updatedTable : t)));
  };

  // Export actions
  const handleExportExcel = () => {
    if (tables.length === 0) return;
    const excelBytes = generateExcelWorkbook(tables, exportSettings);
    const blob = new Blob([excelBytes as unknown as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, exportSettings.filename || 'Extracted_Tables.xlsx');
    setShowExportModal(false);
  };

  const handleCopyTsv = async () => {
    if (!activeTable) return;
    const tsv = exportTableToTsv(activeTable);
    await navigator.clipboard.writeText(tsv);
    setCopiedFormat('tsv');
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  const handleDownloadCsv = () => {
    if (!activeTable) return;
    const csv = exportTableToCsv(activeTable);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${activeTable.title.replace(/[^a-z0-9]/gi, '_')}.csv`);
  };

  const handleDownloadJson = () => {
    if (!activeTable) return;
    const json = exportTableToJson(activeTable);
    const blob = new Blob([json], { type: 'application/json' });
    saveAs(blob, `${activeTable.title.replace(/[^a-z0-9]/gi, '_')}.json`);
  };

  // Calculate table stats
  const calculateTableStats = (table: DetectedTable | null) => {
    if (!table) return { rowCount: 0, colCount: 0, numericCount: 0, sum: 0, avg: 0 };
    let numericCount = 0;
    let sum = 0;

    for (const row of table.rows) {
      for (const cell of row) {
        const { numericValue } = detectCellType(cell);
        if (numericValue !== undefined && !isNaN(numericValue)) {
          numericCount++;
          sum += numericValue;
        }
      }
    }

    return {
      rowCount: table.rows.length,
      colCount: table.headers.length,
      numericCount,
      sum: Math.round(sum * 100) / 100,
      avg: numericCount > 0 ? Math.round((sum / numericCount) * 100) / 100 : 0,
    };
  };

  const stats = calculateTableStats(activeTable);

  const getColTypeIcon = (type: ColumnType) => {
    switch (type) {
      case 'currency':
        return <DollarSign className="w-3 h-3 text-emerald-400" />;
      case 'number':
        return <Hash className="w-3 h-3 text-cyan-400" />;
      case 'percentage':
        return <Percent className="w-3 h-3 text-amber-400" />;
      case 'date':
        return <Calendar className="w-3 h-3 text-purple-400" />;
      default:
        return <Type className="w-3 h-3 text-slate-400" />;
    }
  };

  return (
    <div className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Top Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur sticky top-0 z-30 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateToDashboard}
            className="flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs font-medium border border-slate-200 dark:border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Suite Dashboard</span>
          </button>
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  PDF Tables to Excel (.xlsx)
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase rounded-full bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30">
                  Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Extract structured tabular data, balance sheets & rosters into Microsoft Excel
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {tables.length > 0 && (
            <>
              <button
                onClick={() => setShowPdfVisualizer(!showPdfVisualizer)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  showPdfVisualizer
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title="Toggle PDF document preview overlay"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden md:inline">PDF Preview</span>
              </button>

              <button
                onClick={() => setShowOptionsPanel(!showOptionsPanel)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-colors"
                title="Extraction settings"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Settings</span>
              </button>

              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 shadow-md shadow-cyan-500/25 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Excel ({tables.length})</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col p-4 sm:p-6 max-w-7xl mx-auto w-full gap-5">
        {/* Upload & Preset Dropzone when no tables or switching files */}
        {tables.length === 0 && !isProcessing && (
          <div className="flex flex-col gap-6">
            {/* Drag & Drop Hero Box */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="group relative border-2 border-dashed border-slate-700 hover:border-cyan-500/70 bg-slate-900/50 hover:bg-slate-900/80 rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 shadow-lg hover:shadow-cyan-500/10"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileUpload}
              />
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-200 shadow-inner">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-medium text-white mb-1.5">
                Drop your PDF report here or <span className="text-cyan-400 underline decoration-cyan-400/40 underline-offset-4">browse files</span>
              </h3>
              <p className="text-sm text-slate-400 max-w-md mb-4">
                Extract multi-column financial statements, invoices, employee payroll, pricing catalogs, and data tables into clean Excel spreadsheets (.xlsx).
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500 font-mono">
                <span className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
                  <Check className="w-3 h-3 text-emerald-400" /> Multi-Page Table Stitching
                </span>
                <span className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
                  <Check className="w-3 h-3 text-cyan-400" /> Currency & Number Formatting
                </span>
                <span className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
                  <Check className="w-3 h-3 text-blue-400" /> Native .xlsx Workbook Output
                </span>
              </div>
            </div>

            {/* Built-in Sample Datasets */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-sm font-semibold text-white">Try Sample Financial & Inventory Reports</h4>
                </div>
                <span className="text-xs text-slate-400">Click to instantly extract tables without uploading</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {SAMPLE_TABLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => loadSamplePreset(preset.id)}
                    className="flex flex-col text-left p-3.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/70 hover:border-cyan-500/40 transition-all group"
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <span className="text-xs font-semibold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50">
                        {preset.category}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {preset.pageCount} {preset.pageCount === 1 ? 'Page' : 'Pages'}
                      </span>
                    </div>
                    <div className="font-medium text-slate-200 text-xs mb-1 group-hover:text-cyan-300 transition-colors">
                      {preset.name}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {preset.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-10 flex flex-col items-center justify-center text-center shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-4 relative">
              <RefreshCw className="w-7 h-7 text-cyan-400 animate-spin" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">
              Detecting & Structuring PDF Tables
            </h3>
            <p className="text-xs text-slate-400 mb-5 max-w-md">
              {progressMsg || 'Analyzing baseline geometry, columns and cell data types...'}
            </p>
            <div className="w-full max-w-md bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-400 font-mono mt-2">{progressPercent}%</span>
          </div>
        )}

        {/* Extraction Settings Drawer / Panel */}
        {showOptionsPanel && tables.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <h4 className="text-sm font-semibold text-white">Table Extraction Settings</h4>
              </div>
              <button
                onClick={() => setShowOptionsPanel(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Algorithm */}
              <div>
                <label className="text-slate-300 font-medium block mb-1">Extraction Method</label>
                <select
                  value={options.algorithm}
                  onChange={(e) => setOptions({ ...options, algorithm: e.target.value as any })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="auto">Auto (Hybrid Vector & Stream)</option>
                  <option value="stream">Stream (Whitespace & Gap clustering)</option>
                  <option value="lattice">Lattice (Explicit Ruled Lines)</option>
                </select>
              </div>

              {/* Column Gap */}
              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Column Separation Gap: <span className="font-mono text-cyan-400">{options.columnGapThreshold} pt</span>
                </label>
                <input
                  type="range"
                  min="15"
                  max="50"
                  step="5"
                  value={options.columnGapThreshold}
                  onChange={(e) => setOptions({ ...options, columnGapThreshold: Number(e.target.value) })}
                  className="w-full accent-cyan-500"
                />
              </div>

              {/* Checkbox Toggles */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.hasHeaderRow}
                    onChange={(e) => setOptions({ ...options, hasHeaderRow: e.target.checked })}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>First row as column headers</span>
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.autoDetectDataTypes}
                    onChange={(e) => setOptions({ ...options, autoDetectDataTypes: e.target.checked })}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>Format numbers & currency</span>
                </label>
              </div>

              {/* Multi-page merge & re-extract */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.mergeMultiPageTables}
                    onChange={(e) => setOptions({ ...options, mergeMultiPageTables: e.target.checked })}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>Merge multi-page continuous tables</span>
                </label>
                <button
                  onClick={() => currentFile && processFile(currentFile, options)}
                  className="w-full flex items-center justify-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg py-1.5 font-medium transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Re-extract Tables
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tables Explorer Workspace */}
        {tables.length > 0 && !isProcessing && (
          <div className="flex flex-col lg:flex-row gap-5 flex-1 items-start">
            {/* Left Sidebar: Detected Tables List */}
            <div className="w-full lg:w-72 bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <TableIcon className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-slate-200">
                    Detected Tables ({tables.length})
                  </span>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium"
                >
                  Change PDF
                </button>
              </div>

              <div className="flex flex-col gap-1.5 max-h-[420px] overflow-y-auto pr-1">
                {tables.map((table, idx) => {
                  const isSelected = idx === selectedTableIndex;
                  return (
                    <button
                      key={table.id}
                      onClick={() => setSelectedTableIndex(idx)}
                      className={`flex flex-col text-left p-2.5 rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-cyan-950/40 border-cyan-500/50 text-white shadow-sm'
                          : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-xs font-medium truncate text-cyan-200">
                          Table {idx + 1}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          Page {table.pageNumber}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center justify-between">
                        <span>{table.headers.length} Cols × {table.rows.length} Rows</span>
                        <span className="text-[10px] text-cyan-400 font-mono">
                          {Math.round(table.confidence * 100)}% Match
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Quick Summary Metrics */}
              <div className="mt-auto pt-3 border-t border-slate-800/80 flex flex-col gap-1 text-[11px] text-slate-400">
                <div className="flex justify-between">
                  <span>Total Tables:</span>
                  <span className="font-mono text-slate-200 font-medium">{tables.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Extracted Rows:</span>
                  <span className="font-mono text-slate-200 font-medium">
                    {tables.reduce((acc, t) => acc + t.rows.length, 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Document Source:</span>
                  <span className="truncate max-w-[120px] text-slate-300">{currentFile?.name}</span>
                </div>
              </div>
            </div>

            {/* Center: Live Interactive Spreadsheet Grid */}
            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-lg w-full">
              {/* Table Toolbar */}
              <div className="p-3.5 border-b border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <h3 className="text-sm font-semibold text-white">
                    {activeTable?.title || 'Table Preview'}
                  </h3>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                  <button
                    onClick={addRow}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
                  >
                    <Plus className="w-3 h-3 text-cyan-400" /> Row
                  </button>
                  <button
                    onClick={addColumn}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
                  >
                    <Plus className="w-3 h-3 text-cyan-400" /> Col
                  </button>
                  <div className="h-4 w-px bg-slate-800" />
                  <button
                    onClick={handleCopyTsv}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
                    title="Copy table to clipboard for pasting into Google Sheets or Excel"
                  >
                    {copiedFormat === 'tsv' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-300">Copied TSV!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy TSV</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDownloadCsv}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
                    title="Download this single table as CSV"
                  >
                    <FileText className="w-3 h-3 text-slate-400" />
                    <span>CSV</span>
                  </button>
                  <button
                    onClick={handleDownloadJson}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
                    title="Download this table as JSON records"
                  >
                    <FileCode className="w-3 h-3 text-slate-400" />
                    <span>JSON</span>
                  </button>
                </div>
              </div>

              {/* Data Table Grid Container */}
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                {activeTable ? (
                  <table className="w-full text-left border-collapse text-xs">
                    {/* Header Row */}
                    <thead>
                      <tr className="bg-slate-950/80 border-b border-slate-800 sticky top-0 z-10">
                        <th className="w-10 p-2 text-center text-slate-600 font-mono text-[10px] bg-slate-950/90 border-r border-slate-800/80 select-none">
                          #
                        </th>
                        {activeTable.headers.map((header, colIdx) => (
                          <th
                            key={colIdx}
                            className="p-2.5 font-semibold text-slate-200 border-r border-slate-800/80 bg-slate-950/90 min-w-[120px] group"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              {editingHeaderIdx === colIdx ? (
                                <input
                                  type="text"
                                  autoFocus
                                  defaultValue={header}
                                  onBlur={(e) => {
                                    updateHeaderValue(colIdx, e.target.value);
                                    setEditingHeaderIdx(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      updateHeaderValue(colIdx, (e.target as HTMLInputElement).value);
                                      setEditingHeaderIdx(null);
                                    }
                                  }}
                                  className="w-full bg-slate-800 text-cyan-300 font-semibold px-1.5 py-0.5 rounded border border-cyan-500 text-xs focus:outline-none"
                                />
                              ) : (
                                <span
                                  onClick={() => setEditingHeaderIdx(colIdx)}
                                  className="truncate cursor-pointer hover:text-cyan-300 flex items-center gap-1"
                                  title="Click to edit column header"
                                >
                                  {header}
                                  <Edit3 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-slate-500" />
                                </span>
                              )}
                              <div className="flex items-center gap-1">
                                <span title={`Column Data Type: ${activeTable.columnTypes[colIdx] || 'text'}`}>
                                  {getColTypeIcon(activeTable.columnTypes[colIdx] || 'text')}
                                </span>
                                <button
                                  onClick={() => deleteColumn(colIdx)}
                                  className="text-slate-600 hover:text-rose-400 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Delete Column"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                          </th>
                        ))}
                        <th className="w-10 p-2 text-center text-slate-600 bg-slate-950/90"></th>
                      </tr>
                    </thead>

                    {/* Data Rows */}
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {activeTable.rows.map((row, rowIdx) => (
                        <tr
                          key={rowIdx}
                          className="hover:bg-slate-800/40 group transition-colors"
                        >
                          <td className="w-10 p-2 text-center text-slate-600 font-mono text-[10px] bg-slate-950/40 border-r border-slate-800/80 select-none">
                            {rowIdx + 1}
                          </td>
                          {row.map((cell, colIdx) => {
                            const isEditing =
                              editingCell?.rowIdx === rowIdx && editingCell?.colIdx === colIdx;
                            const isNumeric = /^[\$+-]?\d/.test(cell.trim());

                            return (
                              <td
                                key={colIdx}
                                className={`p-2 border-r border-slate-800/60 text-slate-300 ${
                                  isNumeric ? 'text-right font-mono' : ''
                                }`}
                              >
                                {isEditing ? (
                                  <input
                                    type="text"
                                    autoFocus
                                    defaultValue={cell}
                                    onBlur={(e) => {
                                      updateCellValue(rowIdx, colIdx, e.target.value);
                                      setEditingCell(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        updateCellValue(rowIdx, colIdx, (e.target as HTMLInputElement).value);
                                        setEditingCell(null);
                                      }
                                    }}
                                    className="w-full bg-slate-800 text-white px-1.5 py-0.5 rounded border border-cyan-500 text-xs focus:outline-none"
                                  />
                                ) : (
                                  <div
                                    onClick={() => setEditingCell({ rowIdx, colIdx })}
                                    className="cursor-pointer min-h-[18px] hover:text-cyan-200 transition-colors"
                                    title="Click to edit cell"
                                  >
                                    {cell || <span className="text-slate-600 italic">empty</span>}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td className="w-10 p-1.5 text-center">
                            <button
                              onClick={() => deleteRow(rowIdx)}
                              className="text-slate-600 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete Row"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No table selected.
                  </div>
                )}
              </div>

              {/* Bottom Quick Calc & Stats Bar */}
              <div className="p-3 bg-slate-950/70 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-3">
                <div className="flex items-center gap-4">
                  <span>
                    Rows: <strong className="text-slate-200 font-mono">{stats.rowCount}</strong>
                  </span>
                  <span>
                    Cols: <strong className="text-slate-200 font-mono">{stats.colCount}</strong>
                  </span>
                  <span>
                    Numeric Cells: <strong className="text-cyan-300 font-mono">{stats.numericCount}</strong>
                  </span>
                </div>
                {stats.numericCount > 0 && (
                  <div className="flex items-center gap-4 font-mono text-[11px]">
                    <span>
                      Sum: <strong className="text-emerald-400 font-semibold">{stats.sum.toLocaleString()}</strong>
                    </span>
                    <span>
                      Avg: <strong className="text-slate-300 font-semibold">{stats.avg.toLocaleString()}</strong>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Live PDF Page Visualizer Overlay Modal/View */}
        {showPdfVisualizer && pdfPageImages.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <h4 className="text-sm font-semibold text-white">Original PDF Document Preview</h4>
              </div>
              <button
                onClick={() => setShowPdfVisualizer(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Hide Preview
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[450px] overflow-y-auto p-1">
              {pdfPageImages.map((imgUrl, pageIdx) => {
                const pageNum = pageIdx + 1;
                const pageTables = tables.filter((t) => t.pageNumber === pageNum);

                return (
                  <div
                    key={pageIdx}
                    className="relative bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex flex-col group shadow-md"
                  >
                    <div className="relative">
                      <img
                        src={imgUrl}
                        alt={`Page ${pageNum}`}
                        className="w-full h-auto object-contain"
                        referrerPolicy="no-referrer"
                      />
                      {/* Bounding Box Highlights for Extracted Tables */}
                      {pageTables.map((t, tIdx) => (
                        <div
                          key={t.id}
                          className="absolute border-2 border-cyan-400 bg-cyan-400/15 rounded pointer-events-none"
                          style={{
                            left: `${Math.min(90, Math.max(5, (t.boundingBox.x / 612) * 100))}%`,
                            top: `${Math.min(90, Math.max(5, (t.boundingBox.y / 792) * 100))}%`,
                            width: `${Math.min(90, Math.max(20, (t.boundingBox.width / 612) * 100))}%`,
                            height: `${Math.min(90, Math.max(10, (t.boundingBox.height / 792) * 100))}%`,
                          }}
                        >
                          <span className="absolute -top-4 left-0 bg-cyan-500 text-slate-950 font-bold text-[9px] px-1 py-0.2 rounded shadow">
                            Table {tIdx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="p-2 bg-slate-900 border-t border-slate-800 text-center text-xs text-slate-300 font-mono flex items-center justify-between">
                      <span>Page {pageNum}</span>
                      <span className="text-[10px] text-cyan-400">
                        {pageTables.length} {pageTables.length === 1 ? 'Table' : 'Tables'} Extracted
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Export to Excel Configuration & Download Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Export to Microsoft Excel</h3>
                  <p className="text-xs text-slate-400">Configure worksheet structure and formatting options</p>
                </div>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-4 text-xs">
              {/* Filename */}
              <div>
                <label className="text-slate-300 font-medium block mb-1">Excel Filename</label>
                <input
                  type="text"
                  value={exportSettings.filename}
                  onChange={(e) => setExportSettings({ ...exportSettings, filename: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              {/* Sheet Grouping Mode */}
              <div>
                <label className="text-slate-300 font-medium block mb-1.5">Worksheet Structure</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setExportSettings({ ...exportSettings, sheetGrouping: 'sheet_per_table' })}
                    className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                      exportSettings.sheetGrouping === 'sheet_per_table'
                        ? 'bg-cyan-950/40 border-cyan-500 text-white'
                        : 'bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-semibold text-xs text-cyan-300">Separate Sheets</span>
                    <span className="text-[11px] text-slate-400">One worksheet tab per detected table</span>
                  </button>

                  <button
                    onClick={() => setExportSettings({ ...exportSettings, sheetGrouping: 'single_sheet' })}
                    className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                      exportSettings.sheetGrouping === 'single_sheet'
                        ? 'bg-cyan-950/40 border-cyan-500 text-white'
                        : 'bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-semibold text-xs text-cyan-300">Single Consolidated Sheet</span>
                    <span className="text-[11px] text-slate-400">All tables stacked on one worksheet</span>
                  </button>
                </div>
              </div>

              {/* Formatting Toggles */}
              <div className="flex flex-col gap-2.5 p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportSettings.autoFitColumns}
                    onChange={(e) => setExportSettings({ ...exportSettings, autoFitColumns: e.target.checked })}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>Auto-fit column widths to contents</span>
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportSettings.formatNumbersAsNumeric}
                    onChange={(e) => setExportSettings({ ...exportSettings, formatNumbersAsNumeric: e.target.checked })}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>Store numeric and currency values as numbers (enables formulas)</span>
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportSettings.includeTableTitles}
                    onChange={(e) => setExportSettings({ ...exportSettings, includeTableTitles: e.target.checked })}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>Include table titles and header banners</span>
                </label>
              </div>

              {/* Alternative Zip Download for CSV / JSON */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => downloadAllTablesAsZip(tables, 'csv', currentFile?.name.replace(/\.pdf$/i, '') || 'Tables')}
                  className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1"
                >
                  <FileArchive className="w-3.5 h-3.5" /> Download All as CSV ZIP
                </button>
                <button
                  onClick={() => downloadAllTablesAsZip(tables, 'json', currentFile?.name.replace(/\.pdf$/i, '') || 'Tables')}
                  className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1"
                >
                  <FileCode className="w-3.5 h-3.5" /> Download All as JSON ZIP
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Download .xlsx Workbook
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
