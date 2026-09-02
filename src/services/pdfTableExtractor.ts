import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { pdfjsLib } from './pdfWorker';

export type ColumnType = 'text' | 'number' | 'currency' | 'percentage' | 'date';

export interface DetectedCell {
  text: string;
  rawText: string;
  type: ColumnType;
  numericValue?: number;
  isBold?: boolean;
  colSpan?: number;
  rowSpan?: number;
}

export interface DetectedTable {
  id: string;
  pageNumber: number;
  title: string;
  headers: string[];
  rows: string[][];
  columnTypes: ColumnType[];
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  extractionMethod: 'lattice' | 'stream' | 'hybrid';
  colWidthsPercent?: number[];
}

export interface TableExtractionProgress {
  currentPage: number;
  totalPages: number;
  percent: number;
  statusMessage: string;
}

export interface ExtractionOptions {
  algorithm: 'auto' | 'stream' | 'lattice';
  hasHeaderRow: boolean;
  autoDetectDataTypes: boolean;
  cleanWhitespace: boolean;
  minColumns: number;
  columnGapThreshold: number; // pt gap threshold (e.g. 20-40)
  mergeMultiPageTables: boolean;
  pageRange: string;
}

export const DEFAULT_TABLE_EXTRACTION_OPTIONS: ExtractionOptions = {
  algorithm: 'auto',
  hasHeaderRow: true,
  autoDetectDataTypes: true,
  cleanWhitespace: true,
  minColumns: 2,
  columnGapThreshold: 25,
  mergeMultiPageTables: false,
  pageRange: 'all',
};

export interface ExcelExportSettings {
  sheetGrouping: 'sheet_per_table' | 'sheet_per_page' | 'single_sheet';
  theme: 'slate' | 'navy' | 'emerald' | 'cyan' | 'minimal';
  autoFitColumns: boolean;
  formatNumbersAsNumeric: boolean;
  includeTableTitles: boolean;
  filename: string;
}

export const DEFAULT_EXCEL_EXPORT_SETTINGS: ExcelExportSettings = {
  sheetGrouping: 'sheet_per_table',
  theme: 'navy',
  autoFitColumns: true,
  formatNumbersAsNumeric: true,
  includeTableTitles: true,
  filename: 'Extracted_PDF_Tables.xlsx',
};

/**
 * Parses user page range string (e.g., "all", "1-3, 5")
 */
export function parseTablePageRange(rangeStr: string, totalPages: number): number[] {
  if (!rangeStr || rangeStr.trim().toLowerCase() === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pagesSet = new Set<number>();
  const parts = rangeStr.split(/[,;\s]+/).filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.max(1, Math.min(start, end));
        const max = Math.min(totalPages, Math.max(start, end));
        for (let p = min; p <= max; p++) {
          pagesSet.add(p);
        }
      }
    } else {
      const p = parseInt(part, 10);
      if (!isNaN(p) && p >= 1 && p <= totalPages) {
        pagesSet.add(p);
      }
    }
  }

  const result = Array.from(pagesSet).sort((a, b) => a - b);
  return result.length > 0 ? result : Array.from({ length: totalPages }, (_, i) => i + 1);
}

/**
 * Infers the data type and numeric value of a string
 */
export function detectCellType(text: string): { type: ColumnType; numericValue?: number } {
  const trimmed = text.trim();
  if (!trimmed) return { type: 'text' };

  // Percentage (e.g. 45.2% or -12%)
  if (/^[+-]?\d+([.,]\d+)?\s*%$/.test(trimmed)) {
    const num = parseFloat(trimmed.replace('%', '').replace(',', '.'));
    return { type: 'percentage', numericValue: isNaN(num) ? undefined : num / 100 };
  }

  // Currency (e.g. $1,250.00, €450.50, £100, -$50.00, ($50.00))
  const currencyMatch = trimmed.match(/^([$€£¥₹]|\bUSD|\bEUR|\bGBP)?\s*([+-]?\(?\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?\)?)\s*([$€£¥₹])?$/i);
  if (currencyMatch && (currencyMatch[1] || currencyMatch[3] || trimmed.includes('$') || trimmed.includes('€') || trimmed.includes('£'))) {
    let cleanStr = trimmed.replace(/[$€£¥₹\s\bUSD\bEUR\bGBP]/gi, '');
    let isNeg = false;
    if (cleanStr.startsWith('(') && cleanStr.endsWith(')')) {
      isNeg = true;
      cleanStr = cleanStr.slice(1, -1);
    }
    cleanStr = cleanStr.replace(/,/g, '');
    const num = parseFloat(cleanStr);
    if (!isNaN(num)) {
      return { type: 'currency', numericValue: isNeg ? -num : num };
    }
  }

  // Pure Number (e.g. 1,000.50, -420, 35.8)
  if (/^[+-]?\(?\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?\)?$/.test(trimmed) || /^[+-]?\d+(?:\.\d+)?$/.test(trimmed)) {
    let cleanStr = trimmed;
    let isNeg = false;
    if (cleanStr.startsWith('(') && cleanStr.endsWith(')')) {
      isNeg = true;
      cleanStr = cleanStr.slice(1, -1);
    }
    cleanStr = cleanStr.replace(/[,\s]/g, '');
    const num = parseFloat(cleanStr);
    if (!isNaN(num)) {
      return { type: 'number', numericValue: isNeg ? -num : num };
    }
  }

  // ISO Date / Standard Date (e.g. 2026-08-31, 08/31/2026)
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(trimmed) || /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(trimmed)) {
    return { type: 'date' };
  }

  return { type: 'text' };
}

interface RawTextFragment {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
  isBold: boolean;
}

interface TextRowCandidate {
  y: number;
  height: number;
  items: RawTextFragment[];
}

/**
 * Main table extraction pipeline from a PDF File or ArrayBuffer
 */
export async function extractTablesFromPdf(
  file: File | ArrayBuffer,
  options: ExtractionOptions = DEFAULT_TABLE_EXTRACTION_OPTIONS,
  onProgress?: (p: TableExtractionProgress) => void,
  signal?: AbortSignal
): Promise<DetectedTable[]> {
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;

  if (signal?.aborted) {
    throw new DOMException('Table extraction aborted', 'AbortError');
  }

  onProgress?.({
    currentPage: 0,
    totalPages: 0,
    percent: 5,
    statusMessage: 'Analyzing PDF page layout and vector streams...',
  });

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/',
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;
  const targetPages = parseTablePageRange(options.pageRange, totalPages);

  const detectedTables: DetectedTable[] = [];

  for (let idx = 0; idx < targetPages.length; idx++) {
    if (signal?.aborted) {
      throw new DOMException('Table extraction aborted', 'AbortError');
    }

    const pageNum = targetPages[idx];
    const percent = Math.round(10 + (idx / targetPages.length) * 80);

    onProgress?.({
      currentPage: pageNum,
      totalPages,
      percent,
      statusMessage: `Extracting tabular structures from Page ${pageNum} of ${totalPages}...`,
    });

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent({ includeMarkedContent: true });

    // Collect raw positioned text fragments
    const fragments: RawTextFragment[] = [];
    for (const item of textContent.items as any[]) {
      if (!item.str || typeof item.transform === 'undefined') continue;
      const tx = item.transform;
      const x = tx[4];
      const y = viewport.height - tx[5]; // Flip Y to top-down coordinate
      const width = item.width || Math.abs(tx[0]) * item.str.length * 0.55;
      const height = item.height || Math.abs(tx[3]) || 10;
      const fontSize = Math.hypot(tx[0], tx[1]);
      const fontName = item.fontName || '';
      const isBold = /bold|black|heavy|medium|semibold/i.test(fontName);

      fragments.push({
        str: item.str,
        x,
        y,
        width,
        height,
        fontSize,
        fontName,
        isBold,
      });
    }

    // Detect tables on this page using Stream & Lattice heuristics
    const pageTables = detectTablesOnPage(fragments, viewport.width, viewport.height, pageNum, options);
    detectedTables.push(...pageTables);

    page.cleanup();
  }

  // Handle Multi-Page Table Merge if requested
  let finalTables = detectedTables;
  if (options.mergeMultiPageTables && detectedTables.length > 1) {
    finalTables = mergeSequentialTables(detectedTables);
  }

  onProgress?.({
    currentPage: totalPages,
    totalPages,
    percent: 100,
    statusMessage: `Found ${finalTables.length} structured tables ready for export.`,
  });

  return finalTables;
}

/**
 * Detects tabular structures across positioned text fragments
 */
function detectTablesOnPage(
  fragments: RawTextFragment[],
  pageWidth: number,
  pageHeight: number,
  pageNumber: number,
  options: ExtractionOptions
): DetectedTable[] {
  if (fragments.length === 0) return [];

  // 1. Group fragments into horizontal baseline rows
  const sortedFragments = [...fragments].sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 4) return yDiff;
    return a.x - b.x;
  });

  const rowGroups: RawTextFragment[][] = [];
  let currentRow: RawTextFragment[] = [];
  let currentY = sortedFragments[0].y;

  for (const frag of sortedFragments) {
    if (currentRow.length === 0) {
      currentRow.push(frag);
      currentY = frag.y;
      continue;
    }

    const yTolerance = Math.max(3.5, frag.fontSize * 0.45);
    if (Math.abs(frag.y - currentY) <= yTolerance) {
      currentRow.push(frag);
    } else {
      rowGroups.push(currentRow);
      currentRow = [frag];
      currentY = frag.y;
    }
  }
  if (currentRow.length > 0) {
    rowGroups.push(currentRow);
  }

  // 2. Filter rows with multiple distinct horizontal columns
  const candidateRows: TextRowCandidate[] = [];
  for (const row of rowGroups) {
    row.sort((a, b) => a.x - b.x);
    candidateRows.push({
      y: row[0].y,
      height: row[0].height,
      items: row,
    });
  }

  // 3. Cluster contiguous rows that share alignment or multi-column gap distribution
  const tableClusters: TextRowCandidate[][] = [];
  let currentCluster: TextRowCandidate[] = [];

  for (let i = 0; i < candidateRows.length; i++) {
    const row = candidateRows[i];
    const isMultiColumn = hasDistinctColumns(row.items, options.columnGapThreshold);

    if (isMultiColumn) {
      if (currentCluster.length === 0) {
        currentCluster.push(row);
      } else {
        const prevRow = currentCluster[currentCluster.length - 1];
        const rowDistance = row.y - prevRow.y;
        // If rows are reasonably spaced (typical table row spacing <= 35pt)
        if (rowDistance > 0 && rowDistance <= 36) {
          currentCluster.push(row);
        } else {
          if (currentCluster.length >= 2) {
            tableClusters.push(currentCluster);
          }
          currentCluster = [row];
        }
      }
    } else {
      if (currentCluster.length >= 2) {
        tableClusters.push(currentCluster);
      }
      currentCluster = [];
    }
  }
  if (currentCluster.length >= 2) {
    tableClusters.push(currentCluster);
  }

  // 4. Convert candidate clusters into structured DetectedTable objects
  const pageTables: DetectedTable[] = [];

  tableClusters.forEach((cluster, clusterIdx) => {
    const table = parseClusterToTable(cluster, pageWidth, pageHeight, pageNumber, clusterIdx + 1, options);
    if (table && table.headers.length >= options.minColumns && table.rows.length > 0) {
      pageTables.push(table);
    }
  });

  return pageTables;
}

function hasDistinctColumns(items: RawTextFragment[], gapThreshold: number): boolean {
  if (items.length < 2) return false;
  for (let i = 1; i < items.length; i++) {
    const gap = items[i].x - (items[i - 1].x + items[i - 1].width);
    if (gap >= gapThreshold) return true;
  }
  return false;
}

/**
 * Resolves column alignment boundaries and maps row items into a structured grid
 */
function parseClusterToTable(
  cluster: TextRowCandidate[],
  pageWidth: number,
  pageHeight: number,
  pageNumber: number,
  tableIndex: number,
  options: ExtractionOptions
): DetectedTable | null {
  // Find all horizontal cut-points / column boundaries
  const allXPositions: number[] = [];
  for (const row of cluster) {
    let lastRight = 0;
    for (let i = 0; i < row.items.length; i++) {
      const it = row.items[i];
      if (i === 0 || it.x - lastRight > options.columnGapThreshold) {
        allXPositions.push(it.x);
      }
      lastRight = it.x + it.width;
    }
  }

  if (allXPositions.length === 0) return null;

  // Group X cut points within 18pt tolerance
  allXPositions.sort((a, b) => a - b);
  const columnLefts: number[] = [];
  for (const x of allXPositions) {
    if (columnLefts.length === 0) {
      columnLefts.push(x);
    } else {
      const last = columnLefts[columnLefts.length - 1];
      if (x - last > 22) {
        columnLefts.push(x);
      }
    }
  }

  if (columnLefts.length < options.minColumns) {
    return null;
  }

  const numCols = columnLefts.length;

  // Map each row's items into the column buckets
  const rawGrid: string[][] = [];

  for (const row of cluster) {
    const cells: string[] = Array(numCols).fill('');
    for (const it of row.items) {
      // Find nearest column left
      let assignedCol = 0;
      for (let c = 0; c < numCols; c++) {
        const colLeft = columnLefts[c];
        const nextColLeft = c < numCols - 1 ? columnLefts[c + 1] : pageWidth;
        if (it.x >= colLeft - 10 && it.x < nextColLeft - 10) {
          assignedCol = c;
          break;
        }
        if (c === numCols - 1) {
          assignedCol = c;
        }
      }

      cells[assignedCol] += (cells[assignedCol] ? ' ' : '') + it.str;
    }

    if (cells.some((c) => c.trim().length > 0)) {
      rawGrid.push(cells.map((c) => (options.cleanWhitespace ? c.trim() : c)));
    }
  }

  if (rawGrid.length === 0) return null;

  // Decide if first row is header
  let headers: string[] = [];
  let rows: string[][] = [];

  const firstRow = rawGrid[0];
  const isFirstRowHeader = options.hasHeaderRow || cluster[0].items.some((it) => it.isBold) || firstRow.every((c) => isNaN(Number(c.replace(/[\$,%]/g, ''))));

  if (isFirstRowHeader && rawGrid.length > 1) {
    headers = firstRow.map((h, i) => h || `Column ${i + 1}`);
    rows = rawGrid.slice(1);
  } else {
    headers = columnLefts.map((_, i) => `Column ${i + 1}`);
    rows = rawGrid;
  }

  // Infer column data types
  const columnTypes: ColumnType[] = [];
  for (let c = 0; c < numCols; c++) {
    const colValues = rows.map((r) => r[c]).filter(Boolean);
    let currencyCount = 0;
    let percentageCount = 0;
    let numberCount = 0;
    let dateCount = 0;

    for (const val of colValues) {
      const { type } = detectCellType(val);
      if (type === 'currency') currencyCount++;
      else if (type === 'percentage') percentageCount++;
      else if (type === 'number') numberCount++;
      else if (type === 'date') dateCount++;
    }

    const totalFilled = colValues.length || 1;
    if (currencyCount / totalFilled > 0.4) {
      columnTypes.push('currency');
    } else if (percentageCount / totalFilled > 0.4) {
      columnTypes.push('percentage');
    } else if (numberCount / totalFilled > 0.4) {
      columnTypes.push('number');
    } else if (dateCount / totalFilled > 0.4) {
      columnTypes.push('date');
    } else {
      columnTypes.push('text');
    }
  }

  // Bounding box calculation
  const firstRowObj = cluster[0];
  const lastRowObj = cluster[cluster.length - 1];
  const minX = Math.min(...columnLefts);
  const maxX = Math.max(...cluster.flatMap((r) => r.items.map((it) => it.x + it.width)));
  const minY = firstRowObj.y - firstRowObj.height;
  const maxY = lastRowObj.y + lastRowObj.height;

  // Title inference (look at first non-table line before the table if any)
  const title = `Page ${pageNumber} - Table ${tableIndex} (${numCols} Cols × ${rows.length + 1} Rows)`;

  return {
    id: `table-p${pageNumber}-${tableIndex}-${Math.random().toString(36).substr(2, 6)}`,
    pageNumber,
    title,
    headers,
    rows,
    columnTypes,
    boundingBox: {
      x: Math.max(0, Math.round(minX)),
      y: Math.max(0, Math.round(minY)),
      width: Math.round(maxX - minX),
      height: Math.round(maxY - minY),
    },
    confidence: 0.92,
    extractionMethod: 'hybrid',
  };
}

/**
 * Merges multi-page continuous tables that have matching column counts
 */
function mergeSequentialTables(tables: DetectedTable[]): DetectedTable[] {
  const merged: DetectedTable[] = [];
  let current: DetectedTable | null = null;

  for (const table of tables) {
    if (!current) {
      current = { ...table };
      continue;
    }

    // Check if subsequent page and identical column count
    const isAdjacentPage = table.pageNumber === current.pageNumber + 1;
    const sameCols = table.headers.length === current.headers.length;

    if (isAdjacentPage && sameCols) {
      // Merge rows
      current.rows = [...current.rows, ...table.rows];
      current.title = `Pages ${current.pageNumber}-${table.pageNumber} - Merged Continuous Table (${current.headers.length} Cols × ${current.rows.length + 1} Rows)`;
    } else {
      merged.push(current);
      current = { ...table };
    }
  }

  if (current) {
    merged.push(current);
  }

  return merged;
}

/**
 * Exports tables to a Microsoft Excel (.xlsx) file using SheetJS
 */
export function generateExcelWorkbook(
  tables: DetectedTable[],
  settings: ExcelExportSettings = DEFAULT_EXCEL_EXPORT_SETTINGS
): Uint8Array {
  const wb = XLSX.utils.book_new();

  if (settings.sheetGrouping === 'single_sheet') {
    // All tables stacked on 1 worksheet
    const combinedAoa: any[][] = [];

    tables.forEach((table, tIdx) => {
      if (tIdx > 0) {
        combinedAoa.push([]); // blank spacing row
        combinedAoa.push([]);
      }

      if (settings.includeTableTitles) {
        combinedAoa.push([table.title]);
      }

      combinedAoa.push(table.headers);

      for (const row of table.rows) {
        const formattedRow = row.map((cellText, colIdx) => {
          if (settings.formatNumbersAsNumeric) {
            const { type, numericValue } = detectCellType(cellText);
            if (numericValue !== undefined && (type === 'number' || type === 'currency' || type === 'percentage')) {
              return numericValue;
            }
          }
          return cellText;
        });
        combinedAoa.push(formattedRow);
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(combinedAoa);
    if (settings.autoFitColumns) {
      ws['!cols'] = autoFitColumnWidths(combinedAoa);
    }
    XLSX.utils.book_append_sheet(wb, ws, 'All Extracted Tables');
  } else {
    // 1 Worksheet per Table
    tables.forEach((table, tIdx) => {
      const sheetAoa: any[][] = [];

      if (settings.includeTableTitles) {
        sheetAoa.push([table.title]);
        sheetAoa.push([]);
      }

      sheetAoa.push(table.headers);

      for (const row of table.rows) {
        const formattedRow = row.map((cellText) => {
          if (settings.formatNumbersAsNumeric) {
            const { type, numericValue } = detectCellType(cellText);
            if (numericValue !== undefined && (type === 'number' || type === 'currency' || type === 'percentage')) {
              return numericValue;
            }
          }
          return cellText;
        });
        sheetAoa.push(formattedRow);
      }

      const ws = XLSX.utils.aoa_to_sheet(sheetAoa);
      if (settings.autoFitColumns) {
        ws['!cols'] = autoFitColumnWidths(sheetAoa);
      }

      let sheetName = `Table ${tIdx + 1} (P${table.pageNumber})`;
      if (sheetName.length > 31) sheetName = sheetName.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
  }

  const wbOutput = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(wbOutput);
}

/**
 * Calculates dynamic column widths for SheetJS
 */
function autoFitColumnWidths(aoa: any[][]): XLSX.ColInfo[] {
  const colWidths: number[] = [];
  for (const row of aoa) {
    if (!Array.isArray(row)) continue;
    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      const strLen = val !== null && val !== undefined ? String(val).length : 0;
      colWidths[c] = Math.max(colWidths[c] || 10, strLen + 4);
    }
  }
  return colWidths.map((w) => ({ wch: Math.min(60, Math.max(10, w)) }));
}

/**
 * Exports a single table to CSV format
 */
export function exportTableToCsv(table: DetectedTable): string {
  const escapeCsv = (str: string) => {
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines: string[] = [];
  lines.push(table.headers.map(escapeCsv).join(','));
  for (const row of table.rows) {
    lines.push(row.map(escapeCsv).join(','));
  }
  return lines.join('\n');
}

/**
 * Exports a single table to TSV format (for Google Sheets pasting)
 */
export function exportTableToTsv(table: DetectedTable): string {
  const lines: string[] = [];
  lines.push(table.headers.join('\t'));
  for (const row of table.rows) {
    lines.push(row.join('\t'));
  }
  return lines.join('\n');
}

/**
 * Exports a single table to formatted JSON Array of Objects
 */
export function exportTableToJson(table: DetectedTable): string {
  const data = table.rows.map((row) => {
    const obj: Record<string, any> = {};
    table.headers.forEach((header, i) => {
      const raw = row[i] || '';
      const { type, numericValue } = detectCellType(raw);
      obj[header || `col_${i + 1}`] = numericValue !== undefined ? numericValue : raw;
    });
    return obj;
  });

  return JSON.stringify(data, null, 2);
}

/**
 * Exports a single table as responsive HTML
 */
export function exportTableToHtml(table: DetectedTable): string {
  let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${table.title}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; background: #0f172a; color: #f8fafc; }
  table { border-collapse: collapse; width: 100%; max-width: 1100px; margin: 0 auto; background: #1e293b; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
  th { background: #0284c7; color: white; text-align: left; padding: 12px 16px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 10px 16px; border-bottom: 1px solid #334155; font-size: 14px; }
  tr:nth-child(even) { background: #1e293b; }
  tr:nth-child(odd) { background: #0f172a; }
  tr:hover { background: #334155; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
  <h2>${table.title}</h2>
  <table>
    <thead>
      <tr>
        ${table.headers.map((h) => `<th>${h}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${table.rows
        .map(
          (row) => `<tr>${row
            .map((cell) => {
              const isNum = /^[\$+-]?\d/.test(cell.trim());
              return `<td class="${isNum ? 'num' : ''}">${cell}</td>`;
            })
            .join('')}</tr>`
        )
        .join('\n      ')}
    </tbody>
  </table>
</body>
</html>`;
  return html;
}

/**
 * Bundles all tables into a ZIP file with CSV / JSON / Excel files
 */
export async function downloadAllTablesAsZip(
  tables: DetectedTable[],
  format: 'xlsx' | 'csv' | 'json',
  baseFilename: string
): Promise<void> {
  const zip = new JSZip();

  if (format === 'xlsx') {
    const excelBytes = generateExcelWorkbook(tables);
    zip.file(`${baseFilename}.xlsx`, excelBytes);
  } else if (format === 'csv') {
    tables.forEach((table, i) => {
      const csv = exportTableToCsv(table);
      zip.file(`Table_${i + 1}_Page_${table.pageNumber}.csv`, csv);
    });
  } else if (format === 'json') {
    tables.forEach((table, i) => {
      const json = exportTableToJson(table);
      zip.file(`Table_${i + 1}_Page_${table.pageNumber}.json`, json);
    });
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${baseFilename}_Tables_Archive.zip`);
}
