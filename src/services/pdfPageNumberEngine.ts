import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import { saveAs } from 'file-saver';
import confetti from 'canvas-confetti';
import { pdfjsLib } from './pdfWorker';

export type PositionAnchor = 
  | 'top-left' 
  | 'top-center' 
  | 'top-right' 
  | 'bottom-left' 
  | 'bottom-center' 
  | 'bottom-right' 
  | 'outer-edge' 
  | 'inner-edge';

export type NumberFormatPreset = 
  | 'number' 
  | 'page-x-of-y' 
  | 'x-of-y' 
  | 'x-slash-y' 
  | 'hyphen' 
  | 'page-x' 
  | 'roman-lower' 
  | 'roman-upper' 
  | 'alpha-lower' 
  | 'alpha-upper' 
  | 'custom';

export type PageRangeMode = 
  | 'all' 
  | 'exclude-first' 
  | 'exclude-last' 
  | 'exclude-first-last' 
  | 'custom';

export interface PageNumberConfig {
  // Positioning
  position: PositionAnchor;
  marginX: number; // points (e.g. 36pt = 0.5 in)
  marginY: number; // points (e.g. 36pt = 0.5 in)

  // Format
  format: NumberFormatPreset;
  customTemplate: string; // e.g. "Page {page} of {total}"
  prefix: string; // e.g. "Page "
  suffix: string; // e.g. ""

  // Numbering Calculation
  startAtNumber: number; // default 1 (the number assigned to first numbered page)
  firstPageToNumber: number; // default 1 (1-indexed physical page where numbering begins)
  pageRangeMode: PageRangeMode;
  customRange: string; // e.g. "2-5, 8"

  // Typography & Style
  fontFamily: 'Helvetica' | 'HelveticaBold' | 'TimesRoman' | 'TimesRomanBold' | 'Courier' | 'CourierBold';
  fontSize: number; // 8 to 24 pt (default 10)
  color: string; // hex e.g. '#1e293b'
  opacity: number; // 0.2 to 1.0 (default 1.0)
  
  // Visual Enhancements
  showBadgePill: boolean; // subtle background pill for high contrast
  badgePillColor: 'light' | 'dark' | 'glass';
  showDividerLine: boolean; // thin header/footer horizontal line
  dividerLineColor: string; // hex
}

export const DEFAULT_PAGE_NUMBER_CONFIG: PageNumberConfig = {
  position: 'bottom-center',
  marginX: 36,
  marginY: 36,
  format: 'page-x-of-y',
  customTemplate: 'Page {page} of {total}',
  prefix: '',
  suffix: '',
  startAtNumber: 1,
  firstPageToNumber: 1,
  pageRangeMode: 'all',
  customRange: '',
  fontFamily: 'Helvetica',
  fontSize: 10,
  color: '#334155',
  opacity: 1.0,
  showBadgePill: false,
  badgePillColor: 'light',
  showDividerLine: false,
  dividerLineColor: '#cbd5e1',
};

/**
 * Converts integer to Roman numerals.
 */
export function toRoman(num: number, uppercase = true): string {
  if (num <= 0 || num > 3999) return String(num);
  const romanMap: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];

  let result = '';
  let n = num;
  for (const [val, roman] of romanMap) {
    while (n >= val) {
      result += roman;
      n -= val;
    }
  }
  return uppercase ? result : result.toLowerCase();
}

/**
 * Converts integer to alphabetic format (1 -> A, 2 -> B, ..., 27 -> AA)
 */
export function toAlpha(num: number, uppercase = true): string {
  if (num <= 0) return String(num);
  let result = '';
  let n = num;
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return uppercase ? result : result.toLowerCase();
}

/**
 * Parses user custom page range syntax like "1-3, 5, 7-10" into a Set of 1-indexed numbers.
 */
export function parseCustomPageRange(rangeStr: string, totalPages: number): Set<number> {
  const pages = new Set<number>();
  if (!rangeStr.trim()) {
    for (let i = 1; i <= totalPages; i++) pages.add(i);
    return pages;
  }

  const parts = rangeStr.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.max(1, Math.min(start, end));
        const max = Math.min(totalPages, Math.max(start, end));
        for (let p = min; p <= max; p++) pages.add(p);
      }
    } else {
      const p = parseInt(part, 10);
      if (!isNaN(p) && p >= 1 && p <= totalPages) {
        pages.add(p);
      }
    }
  }

  return pages;
}

/**
 * Checks if a specific 1-indexed page number should receive a page number.
 */
export function isPageNumbered(
  pageNumber: number,
  totalPages: number,
  config: PageNumberConfig
): boolean {
  // Check if it precedes firstPageToNumber
  if (pageNumber < config.firstPageToNumber) {
    return false;
  }

  switch (config.pageRangeMode) {
    case 'all':
      return true;
    case 'exclude-first':
      return pageNumber > 1;
    case 'exclude-last':
      return pageNumber < totalPages;
    case 'exclude-first-last':
      return pageNumber > 1 && pageNumber < totalPages;
    case 'custom': {
      const included = parseCustomPageRange(config.customRange, totalPages);
      return included.has(pageNumber);
    }
    default:
      return true;
  }
}

/**
 * Generates the formatted text string for a given page.
 */
export function formatPageNumberText(
  pageNumber: number,
  totalPages: number,
  config: PageNumberConfig,
  fileName = 'Document'
): string {
  // Calculate relative number value
  // Offset by startAtNumber and relative to firstPageToNumber
  const offset = config.startAtNumber - 1;
  const pageIndexRel = pageNumber - config.firstPageToNumber + 1;
  const currentNum = Math.max(1, pageIndexRel + offset);
  
  // Total pages count for format calculation (adjusted or full)
  const effectiveTotal = Math.max(1, totalPages - config.firstPageToNumber + 1 + offset);

  let formattedNum = String(currentNum);
  if (config.format === 'roman-lower') {
    formattedNum = toRoman(currentNum, false);
  } else if (config.format === 'roman-upper') {
    formattedNum = toRoman(currentNum, true);
  } else if (config.format === 'alpha-lower') {
    formattedNum = toAlpha(currentNum, false);
  } else if (config.format === 'alpha-upper') {
    formattedNum = toAlpha(currentNum, true);
  }

  let text = '';
  switch (config.format) {
    case 'number':
      text = formattedNum;
      break;
    case 'page-x-of-y':
      text = `Page ${formattedNum} of ${effectiveTotal}`;
      break;
    case 'x-of-y':
      text = `${formattedNum} of ${effectiveTotal}`;
      break;
    case 'x-slash-y':
      text = `${formattedNum} / ${effectiveTotal}`;
      break;
    case 'hyphen':
      text = `- ${formattedNum} -`;
      break;
    case 'page-x':
      text = `Page ${formattedNum}`;
      break;
    case 'roman-lower':
    case 'roman-upper':
    case 'alpha-lower':
    case 'alpha-upper':
      text = formattedNum;
      break;
    case 'custom': {
      const today = new Date();
      const dateStr = today.toLocaleDateString();
      const timeStr = today.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      text = (config.customTemplate || '{page}')
        .replace(/{page}/g, formattedNum)
        .replace(/{total}/g, String(effectiveTotal))
        .replace(/{raw_page}/g, String(pageNumber))
        .replace(/{raw_total}/g, String(totalPages))
        .replace(/{file}/g, fileName.replace(/\.[^/.]+$/, ''))
        .replace(/{date}/g, dateStr)
        .replace(/{time}/g, timeStr)
        .replace(/{roman}/g, toRoman(currentNum, false))
        .replace(/{ROMAN}/g, toRoman(currentNum, true));
      break;
    }
    default:
      text = formattedNum;
  }

  return `${config.prefix || ''}${text}${config.suffix || ''}`;
}

/**
 * Parses Hex color code into RGB components [0..1]
 */
export function parseHexColor(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length !== 6) {
    return { r: 0.2, g: 0.2, b: 0.2 };
  }
  const r = parseInt(clean.substring(0, 2), 16) / 255 || 0;
  const g = parseInt(clean.substring(2, 4), 16) / 255 || 0;
  const b = parseInt(clean.substring(4, 6), 16) / 255 || 0;
  return { r, g, b };
}

/**
 * Resolves effective horizontal alignment for a page considering outer-edge / inner-edge settings.
 */
export function resolveHorizontalAlignment(
  position: PositionAnchor,
  pageNumber: number
): 'left' | 'center' | 'right' {
  if (position.includes('left')) return 'left';
  if (position.includes('center')) return 'center';
  if (position.includes('right')) return 'right';

  const isOdd = pageNumber % 2 !== 0;
  if (position === 'outer-edge') {
    // Odd pages: right edge, Even pages: left edge
    return isOdd ? 'right' : 'left';
  }
  if (position === 'inner-edge') {
    // Odd pages: left edge, Even pages: right edge
    return isOdd ? 'left' : 'right';
  }

  return 'center';
}

/**
 * Resolves vertical position: 'top' or 'bottom'
 */
export function resolveVerticalPosition(position: PositionAnchor): 'top' | 'bottom' {
  if (position.startsWith('top')) return 'top';
  return 'bottom';
}

/**
 * Applies page numbers across a PDF file using pdf-lib in pure WebAssembly/TypeScript.
 */
export async function applyPageNumbersToPdf(
  file: File,
  config: PageNumberConfig,
  onProgress?: (progress: number, message: string) => void
): Promise<{ blob: Blob; fileName: string; totalPages: number; fileSizeBytes: number }> {
  onProgress?.(10, 'Reading PDF document structure...');
  const arrayBuffer = await file.arrayBuffer();
  
  onProgress?.(25, 'Loading PDF document into memory engine...');
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

  // Embed Font
  let standardFontName = StandardFonts.Helvetica;
  switch (config.fontFamily) {
    case 'Helvetica':
      standardFontName = StandardFonts.Helvetica;
      break;
    case 'HelveticaBold':
      standardFontName = StandardFonts.HelveticaBold;
      break;
    case 'TimesRoman':
      standardFontName = StandardFonts.TimesRoman;
      break;
    case 'TimesRomanBold':
      standardFontName = StandardFonts.TimesRomanBold;
      break;
    case 'Courier':
      standardFontName = StandardFonts.Courier;
      break;
    case 'CourierBold':
      standardFontName = StandardFonts.CourierBold;
      break;
  }
  const embeddedFont = await pdfDoc.embedFont(standardFontName);

  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  const textColor = parseHexColor(config.color);
  const dividerColor = parseHexColor(config.dividerLineColor || '#cbd5e1');

  onProgress?.(40, `Numbering ${totalPages} document pages...`);

  for (let i = 0; i < totalPages; i++) {
    const pageNumber = i + 1; // 1-indexed
    const page = pages[i];
    const { width, height } = page.getSize();

    if (isPageNumbered(pageNumber, totalPages, config)) {
      const text = formatPageNumberText(pageNumber, totalPages, config, file.name);
      const textWidth = embeddedFont.widthOfTextAtSize(text, config.fontSize);
      const textHeight = embeddedFont.heightAtSize(config.fontSize);

      // Resolve Horizontal Position
      const horizAlign = resolveHorizontalAlignment(config.position, pageNumber);
      let x = config.marginX;
      if (horizAlign === 'center') {
        x = (width - textWidth) / 2;
      } else if (horizAlign === 'right') {
        x = width - config.marginX - textWidth;
      }

      // Resolve Vertical Position
      const vertAlign = resolveVerticalPosition(config.position);
      let y = config.marginY;
      if (vertAlign === 'top') {
        y = height - config.marginY - textHeight;
      }

      // Optional Divider Line
      if (config.showDividerLine) {
        const lineY = vertAlign === 'top' 
          ? height - config.marginY + 6 
          : config.marginY + textHeight + 6;
        
        page.drawLine({
          start: { x: config.marginX, y: lineY },
          end: { x: width - config.marginX, y: lineY },
          thickness: 0.75,
          color: rgb(dividerColor.r, dividerColor.g, dividerColor.b),
          opacity: 0.6,
        });
      }

      // Optional Background Badge Pill
      if (config.showBadgePill) {
        const paddingX = 8;
        const paddingY = 4;
        const pillX = x - paddingX;
        const pillY = y - paddingY;
        const pillW = textWidth + paddingX * 2;
        const pillH = textHeight + paddingY * 2;

        if (config.badgePillColor === 'dark') {
          page.drawRectangle({
            x: pillX,
            y: pillY,
            width: pillW,
            height: pillH,
            color: rgb(0.1, 0.14, 0.2),
            opacity: 0.85,
            borderColor: rgb(0.3, 0.35, 0.45),
            borderWidth: 0.5,
          });
        } else if (config.badgePillColor === 'light') {
          page.drawRectangle({
            x: pillX,
            y: pillY,
            width: pillW,
            height: pillH,
            color: rgb(0.97, 0.98, 1.0),
            opacity: 0.9,
            borderColor: rgb(0.8, 0.85, 0.9),
            borderWidth: 0.5,
          });
        } else {
          // Glass / Subtle
          page.drawRectangle({
            x: pillX,
            y: pillY,
            width: pillW,
            height: pillH,
            color: rgb(0.95, 0.95, 0.95),
            opacity: 0.5,
            borderColor: rgb(0.7, 0.7, 0.7),
            borderWidth: 0.5,
          });
        }
      }

      // Draw the Page Number Text
      page.drawText(text, {
        x,
        y,
        size: config.fontSize,
        font: embeddedFont,
        color: rgb(textColor.r, textColor.g, textColor.b),
        opacity: Math.max(0.1, Math.min(1.0, config.opacity)),
      });
    }

    if (i % 5 === 0 || i === totalPages - 1) {
      const percent = Math.round(40 + ((i + 1) / totalPages) * 45);
      onProgress?.(percent, `Processing page ${i + 1} of ${totalPages}...`);
    }
  }

  onProgress?.(90, 'Serializing updated PDF binary data...');
  const pdfBytes = await pdfDoc.save();

  onProgress?.(100, 'Page numbering completed successfully!');

  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const outFileName = `${baseName}_numbered.pdf`;
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });

  return {
    blob,
    fileName: outFileName,
    totalPages,
    fileSizeBytes: blob.size,
  };
}

/**
 * Triggers celebratory confetti animation on completion.
 */
export function fireCelebrationConfetti() {
  try {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });
  } catch (e) {
    // Ignore if not supported
  }
}
