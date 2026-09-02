import * as XLSX from 'xlsx';
import { PDFDocument, rgb } from 'pdf-lib';
import confetti from 'canvas-confetti';

export interface ExcelToPdfConfig {
  pageSize: 'A4' | 'Letter' | 'Legal';
  orientation: 'landscape' | 'portrait';
  theme: 'clean' | 'corporate' | 'dark';
  includeGridlines: boolean;
}

export const DEFAULT_EXCEL_CONFIG: ExcelToPdfConfig = {
  pageSize: 'A4',
  orientation: 'landscape',
  theme: 'corporate',
  includeGridlines: true,
};

export interface SheetData {
  name: string;
  rows: any[][];
}

export interface ExcelWorkbookData {
  sheets: SheetData[];
  activeSheetIndex: number;
}

export async function generateSampleExcelBlob(): Promise<Blob> {
  const wb = XLSX.utils.book_new();

  const financialData = [
    ['Q3 Financial Ledger', '', '', '', ''],
    ['Month', 'Revenue ($)', 'Expenses ($)', 'Net Profit ($)', 'Growth (%)'],
    ['July 2026', 145000, 82000, 63000, '14.2%'],
    ['August 2026', 162000, 89000, 73000, '11.7%'],
    ['September 2026', 198000, 94000, 104000, '22.2%'],
    ['Total Q3', 505000, 265000, 240000, '16.0%'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(financialData);
  XLSX.utils.book_append_sheet(wb, ws, 'Q3 Financials');

  const inventoryData = [
    ['Cloud Infrastructure Assets', '', '', ''],
    ['Asset ID', 'Server Region', 'Instance Type', 'Status'],
    ['SRV-01', 'us-east-1', 'c6i.4xlarge', 'Active'],
    ['SRV-02', 'us-west-2', 'm6i.8xlarge', 'Active'],
    ['SRV-03', 'eu-central-1', 'r6i.2xlarge', 'Maintenance'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(inventoryData);
  XLSX.utils.book_append_sheet(wb, ws2, 'Infrastructure');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function parseExcelFile(
  fileBytes: ArrayBuffer,
  onProgress?: (progress: number, msg: string) => void
): Promise<ExcelWorkbookData> {
  onProgress?.(20, 'Reading spreadsheet workbook...');
  const workbook = XLSX.read(fileBytes, { type: 'array' });

  const sheets: SheetData[] = [];
  const sheetNames = workbook.SheetNames;

  for (let i = 0; i < sheetNames.length; i++) {
    const name = sheetNames[i];
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    sheets.push({
      name,
      rows: rows.filter((r) => r && r.length > 0),
    });
  }

  onProgress?.(70, `Parsed ${sheets.length} sheets successfully.`);
  return {
    sheets,
    activeSheetIndex: 0,
  };
}

export async function convertExcelToPdf(
  sheetData: SheetData,
  config: ExcelToPdfConfig,
  onProgress?: (progress: number, msg: string) => void
): Promise<Blob> {
  onProgress?.(80, 'Generating PDF document from spreadsheet...');
  const pdfDoc = await PDFDocument.create();

  // Dimensions
  let width = 841.89; // Landscape A4 default
  let height = 595.28;

  if (config.pageSize === 'Letter') {
    width = config.orientation === 'landscape' ? 792 : 612;
    height = config.orientation === 'landscape' ? 612 : 792;
  } else if (config.pageSize === 'Legal') {
    width = config.orientation === 'landscape' ? 1008 : 612;
    height = config.orientation === 'landscape' ? 612 : 1008;
  } else {
    width = config.orientation === 'landscape' ? 841.89 : 595.28;
    height = config.orientation === 'landscape' ? 595.28 : 841.89;
  }

  const page = pdfDoc.addPage([width, height]);

  // Background
  if (config.theme === 'dark') {
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.06, 0.09, 0.16) });
  } else if (config.theme === 'corporate') {
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.98, 0.99, 1) });
  } else {
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
  }

  // Sheet Title
  const titleColor = config.theme === 'dark' ? rgb(1, 1, 1) : rgb(0.12, 0.16, 0.22);
  page.drawText(`Sheet: ${sheetData.name}`, {
    x: 40,
    y: height - 40,
    size: 20,
    color: titleColor,
  });

  // Table rendering coordinates
  let startY = height - 80;
  const startX = 40;
  const rowHeight = 26;
  const colWidth = 130;

  const headerBg = config.theme === 'dark' ? rgb(0.15, 0.2, 0.3) : config.theme === 'corporate' ? rgb(0.15, 0.35, 0.85) : rgb(0.9, 0.9, 0.9);
  const headerText = config.theme === 'dark' ? rgb(1, 1, 1) : config.theme === 'corporate' ? rgb(1, 1, 1) : rgb(0.1, 0.1, 0.1);
  const cellText = config.theme === 'dark' ? rgb(0.85, 0.9, 0.95) : rgb(0.2, 0.25, 0.3);

  const rows = sheetData.rows.slice(0, 20); // render up to 20 rows per page

  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    if (startY < 40) break;

    const isHeader = rIdx === 0;
    if (isHeader) {
      page.drawRectangle({
        x: startX,
        y: startY - rowHeight + 6,
        width: Math.min(row.length * colWidth, width - 80),
        height: rowHeight,
        color: headerBg,
      });
    }

    for (let cIdx = 0; cIdx < row.length; cIdx++) {
      if (cIdx * colWidth + startX > width - 40) break;
      const cellVal = String(row[cIdx] !== undefined && row[cIdx] !== null ? row[cIdx] : '');

      page.drawText(cellVal.slice(0, 18), {
        x: startX + cIdx * colWidth + 8,
        y: startY,
        size: isHeader ? 12 : 10,
        color: isHeader ? headerText : cellText,
      });
    }

    if (config.includeGridlines && !isHeader) {
      page.drawLine({
        start: { x: startX, y: startY - 6 },
        end: { x: startX + row.length * colWidth, y: startY - 6 },
        thickness: 0.5,
        color: rgb(0.8, 0.82, 0.85),
      });
    }

    startY -= rowHeight;
  }

  onProgress?.(95, 'Finalizing PDF...');
  const pdfBytes = await pdfDoc.save();

  onProgress?.(100, 'Excel to PDF conversion complete!');
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
  });

  return new Blob([pdfBytes as any], { type: 'application/pdf' });
}
