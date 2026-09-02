import { PDFDocument, degrees } from 'pdf-lib';
import confetti from 'canvas-confetti';

export type CropMode = 'all' | 'odd' | 'even' | 'custom';

export interface CropConfig {
  marginTopPt: number;
  marginBottomPt: number;
  marginLeftPt: number;
  marginRightPt: number;
  mode: CropMode;
  customPages: string; // e.g. "1-5, 8"
  unit: 'points' | 'inches' | 'mm' | 'percent';
}

export const DEFAULT_CROP_CONFIG: CropConfig = {
  marginTopPt: 36, // 0.5 inch / ~12mm
  marginBottomPt: 36,
  marginLeftPt: 36,
  marginRightPt: 36,
  mode: 'all',
  customPages: '1',
  unit: 'points',
};

// Helper to parse page ranges like "1-3, 5, 7-10"
export function parsePageRange(rangeStr: string, totalPages: number): Set<number> {
  const pages = new Set<number>();
  if (!rangeStr.trim()) return pages;

  const parts = rangeStr.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
          if (i >= 1 && i <= totalPages) {
            pages.add(i);
          }
        }
      }
    } else {
      const p = parseInt(trimmed, 10);
      if (!isNaN(p) && p >= 1 && p <= totalPages) {
        pages.add(p);
      }
    }
  }
  return pages;
}

export async function applyCropToPdf(
  fileBytes: Uint8Array,
  config: CropConfig,
  onProgress?: (progress: number, msg: string) => void
): Promise<{ blob: Blob; pageCount: number }> {
  onProgress?.(10, 'Loading PDF document...');
  const pdfDoc = await PDFDocument.load(fileBytes);
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;

  const customSet = config.mode === 'custom' ? parsePageRange(config.customPages, totalPages) : new Set<number>();

  onProgress?.(30, 'Calculating crop bounding boxes...');

  for (let i = 0; i < totalPages; i++) {
    const pageNum = i + 1;
    let shouldCrop = false;

    if (config.mode === 'all') {
      shouldCrop = true;
    } else if (config.mode === 'odd' && pageNum % 2 !== 0) {
      shouldCrop = true;
    } else if (config.mode === 'even' && pageNum % 2 === 0) {
      shouldCrop = true;
    } else if (config.mode === 'custom' && customSet.has(pageNum)) {
      shouldCrop = true;
    }

    if (shouldCrop) {
      const page = pages[i];
      const { width, height } = page.getSize();

      let top = config.marginTopPt;
      let bottom = config.marginBottomPt;
      let left = config.marginLeftPt;
      let right = config.marginRightPt;

      if (config.unit === 'percent') {
        left = (width * config.marginLeftPt) / 100;
        right = (width * config.marginRightPt) / 100;
        top = (height * config.marginTopPt) / 100;
        bottom = (height * config.marginBottomPt) / 100;
      }

      const newX = Math.max(0, left);
      const newY = Math.max(0, bottom);
      const newWidth = Math.max(50, width - left - right);
      const newHeight = Math.max(50, height - top - bottom);

      // Set crop box and media box
      page.setCropBox(newX, newY, newWidth, newHeight);
      page.setMediaBox(newX, newY, newWidth, newHeight);
    }
  }

  onProgress?.(80, 'Optimizing and saving cropped PDF...');
  const pdfBytes = await pdfDoc.save();
  
  onProgress?.(100, 'Crop completed successfully!');
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
  });

  const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
  return { blob, pageCount: totalPages };
}
