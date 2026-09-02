import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { saveAs } from 'file-saver';
import confetti from 'canvas-confetti';

export type ImagePageSize = 'a4' | 'letter' | 'legal' | 'fit' | 'square';
export type ImageOrientation = 'auto' | 'portrait' | 'landscape';
export type ImageMargin = 'none' | 'small' | 'medium' | 'large';
export type ImageFitMode = 'contain' | 'cover' | 'actual';
export type ImageLayoutMode = '1-up' | '2-up' | '4-up';
export type ImageCompression = 'original' | 'high' | 'medium' | 'web';

export interface ImageItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  previewUrl: string;
  width: number;
  height: number;
  rotation: number; // 0, 90, 180, 270
  aspectRatio: number;
}

export interface PdfPackageSettings {
  pageSize: ImagePageSize;
  orientation: ImageOrientation;
  margin: ImageMargin;
  fitMode: ImageFitMode;
  layoutMode: ImageLayoutMode;
  compression: ImageCompression;
  quality: number; // 0.5 - 1.0
  addPageNumbers: boolean;
  pageNumberPosition: 'bottom-center' | 'bottom-right' | 'top-right';
  documentTitle: string;
  author: string;
  outputFilename: string;
  backgroundColor: 'white' | 'black' | 'slate';
}

export const DEFAULT_PACKAGE_SETTINGS: PdfPackageSettings = {
  pageSize: 'a4',
  orientation: 'auto',
  margin: 'small',
  fitMode: 'contain',
  layoutMode: '1-up',
  compression: 'high',
  quality: 0.9,
  addPageNumbers: true,
  pageNumberPosition: 'bottom-center',
  documentTitle: 'Images Package Document',
  author: 'PDF Tools Suite',
  outputFilename: 'Packaged_Images.pdf',
  backgroundColor: 'white',
};

// Standard dimensions in PDF points (72 DPI)
export const PAGE_DIMENSIONS: Record<Exclude<ImagePageSize, 'fit'>, { width: number; height: number; name: string }> = {
  a4: { width: 595.28, height: 841.89, name: 'A4 (210 × 297 mm)' },
  letter: { width: 612.0, height: 792.0, name: 'US Letter (8.5 × 11 in)' },
  legal: { width: 612.0, height: 1008.0, name: 'US Legal (8.5 × 14 in)' },
  square: { width: 600.0, height: 600.0, name: 'Square (600 × 600 pt)' },
};

export const MARGIN_VALUES: Record<ImageMargin, number> = {
  none: 0,
  small: 18,   // ~6.35 mm
  medium: 36,  // 0.5 in / 12.7 mm
  large: 54,   // 0.75 in / 19 mm
};

/**
 * Loads an image File into an ImageItem with parsed dimensions & preview
 */
export async function loadImageFile(file: File): Promise<ImageItem> {
  const url = URL.createObjectURL(file);
  const img = new Image();

  return new Promise((resolve, reject) => {
    img.onload = () => {
      const width = img.naturalWidth || img.width || 800;
      const height = img.naturalHeight || img.height || 600;
      resolve({
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type || 'image/jpeg',
        previewUrl: url,
        width,
        height,
        rotation: 0,
        aspectRatio: width / height,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image: ${file.name}`));
    };
    img.src = url;
  });
}

/**
 * Renders an ImageItem to an HTML Canvas with applied rotation, compression, and format encoding
 */
export async function processImageCanvas(
  item: ImageItem,
  quality: number,
  compression: ImageCompression
): Promise<{ bytes: Uint8Array; isPng: boolean; width: number; height: number }> {
  const img = new Image();
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = item.previewUrl;
  });

  const loadedImg = await promise;

  // Determine rotated dimensions
  const rot = (item.rotation % 360 + 360) % 360;
  const is90or270 = rot === 90 || rot === 270;
  const targetW = is90or270 ? loadedImg.naturalHeight : loadedImg.naturalWidth;
  const targetH = is90or270 ? loadedImg.naturalWidth : loadedImg.naturalHeight;

  // Determine scaling based on compression settings
  let scale = 1.0;
  if (compression === 'web' && (targetW > 1600 || targetH > 1600)) {
    scale = Math.min(1600 / targetW, 1600 / targetH);
  } else if (compression === 'medium' && (targetW > 2400 || targetH > 2400)) {
    scale = Math.min(2400 / targetW, 2400 / targetH);
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(targetW * scale);
  canvas.height = Math.round(targetH * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context error');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rot * Math.PI) / 180);

  const drawW = (is90or270 ? targetH : targetW) * scale;
  const drawH = (is90or270 ? targetW : targetH) * scale;
  ctx.drawImage(loadedImg, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  // Determine output format
  const isPng = item.type === 'image/png' && compression === 'original';
  const mime = isPng ? 'image/png' : 'image/jpeg';
  const q = compression === 'web' ? 0.72 : compression === 'medium' ? 0.82 : quality;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas blob conversion error'))), mime, q);
  });

  const arrayBuffer = await blob.arrayBuffer();
  return {
    bytes: new Uint8Array(arrayBuffer),
    isPng,
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Calculates page dimensions for a specific image/group
 */
export function getPageDimensions(
  settings: PdfPackageSettings,
  imageAspect: number
): { width: number; height: number } {
  if (settings.pageSize === 'fit') {
    // Dynamic page size matching image aspect ratio (capped at standard height ~842pt)
    const baseHeight = 842;
    const baseWidth = Math.round(baseHeight * imageAspect);
    return { width: Math.max(300, Math.min(1600, baseWidth)), height: baseHeight };
  }

  const dim = PAGE_DIMENSIONS[settings.pageSize];
  let w = dim.width;
  let h = dim.height;

  if (settings.orientation === 'portrait') {
    return { width: Math.min(w, h), height: Math.max(w, h) };
  }
  if (settings.orientation === 'landscape') {
    return { width: Math.max(w, h), height: Math.min(w, h) };
  }

  // Auto orientation: match image aspect ratio
  if (imageAspect > 1.05) {
    return { width: Math.max(w, h), height: Math.min(w, h) }; // Landscape
  } else {
    return { width: Math.min(w, h), height: Math.max(w, h) }; // Portrait
  }
}

export interface PackageProgressCallback {
  (progress: number, statusText: string): void;
}

/**
 * Packages all provided image items into a single high-fidelity PDF document
 */
export async function generatePdfFromImages(
  items: ImageItem[],
  settings: PdfPackageSettings,
  onProgress?: PackageProgressCallback
): Promise<{ pdfBytes: Uint8Array; totalPages: number; fileSize: number }> {
  if (items.length === 0) {
    throw new Error('No images provided for packaging.');
  }

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(settings.documentTitle || 'Packaged Images');
  pdfDoc.setAuthor(settings.author || 'PDF Tools Suite');
  pdfDoc.setCreator('Document Tools Suite - Images to PDF Packager');
  pdfDoc.setProducer('pdf-lib');
  pdfDoc.setCreationDate(new Date());

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const marginPt = MARGIN_VALUES[settings.margin];

  // Group images based on layoutMode (1-up, 2-up, 4-up)
  const itemsPerPage = settings.layoutMode === '4-up' ? 4 : settings.layoutMode === '2-up' ? 2 : 1;
  const totalPages = Math.ceil(items.length / itemsPerPage);

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const pageNum = pageIdx + 1;
    const startIdx = pageIdx * itemsPerPage;
    const pageItems = items.slice(startIdx, startIdx + itemsPerPage);

    const progressPct = Math.round((pageIdx / totalPages) * 90);
    if (onProgress) {
      onProgress(progressPct, `Rendering Page ${pageNum} of ${totalPages}...`);
    }

    // Determine primary aspect for page dimension calculation
    const primaryAspect = pageItems[0].aspectRatio;
    const { width: pageWidth, height: pageHeight } = getPageDimensions(settings, primaryAspect);

    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Background color
    if (settings.backgroundColor === 'black') {
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        color: rgb(0.05, 0.05, 0.07),
      });
    } else if (settings.backgroundColor === 'slate') {
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        color: rgb(0.96, 0.97, 0.98),
      });
    }

    // Define cell slots based on layoutMode
    interface Slot {
      x: number;
      y: number;
      w: number;
      h: number;
    }

    const slots: Slot[] = [];
    const availableW = pageWidth - marginPt * 2;
    const availableH = pageHeight - marginPt * 2;

    if (itemsPerPage === 1) {
      slots.push({
        x: marginPt,
        y: marginPt,
        w: availableW,
        h: availableH,
      });
    } else if (itemsPerPage === 2) {
      const isLandscape = pageWidth > pageHeight;
      if (isLandscape) {
        // 2 columns side by side
        const cellW = (availableW - marginPt) / 2;
        slots.push({ x: marginPt, y: marginPt, w: cellW, h: availableH });
        slots.push({ x: marginPt + cellW + marginPt, y: marginPt, w: cellW, h: availableH });
      } else {
        // 2 rows stacked vertically
        const cellH = (availableH - marginPt) / 2;
        slots.push({ x: marginPt, y: marginPt + cellH + marginPt, w: availableW, h: cellH });
        slots.push({ x: marginPt, y: marginPt, w: availableW, h: cellH });
      }
    } else if (itemsPerPage === 4) {
      // 2x2 Grid
      const cellW = (availableW - marginPt) / 2;
      const cellH = (availableH - marginPt) / 2;
      // Top Left
      slots.push({ x: marginPt, y: marginPt + cellH + marginPt, w: cellW, h: cellH });
      // Top Right
      slots.push({ x: marginPt + cellW + marginPt, y: marginPt + cellH + marginPt, w: cellW, h: cellH });
      // Bottom Left
      slots.push({ x: marginPt, y: marginPt, w: cellW, h: cellH });
      // Bottom Right
      slots.push({ x: marginPt + cellW + marginPt, y: marginPt, w: cellW, h: cellH });
    }

    // Process & embed images in this page
    for (let i = 0; i < pageItems.length; i++) {
      const item = pageItems[i];
      const slot = slots[i];
      if (!slot) continue;

      const { bytes, isPng } = await processImageCanvas(item, settings.quality, settings.compression);
      const embeddedImage = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);

      const imgW = embeddedImage.width;
      const imgH = embeddedImage.height;
      const imgAspect = imgW / imgH;
      const slotAspect = slot.w / slot.h;

      let drawW = slot.w;
      let drawH = slot.h;
      let drawX = slot.x;
      let drawY = slot.y;

      if (settings.fitMode === 'contain') {
        if (imgAspect > slotAspect) {
          drawW = slot.w;
          drawH = slot.w / imgAspect;
          drawX = slot.x;
          drawY = slot.y + (slot.h - drawH) / 2;
        } else {
          drawH = slot.h;
          drawW = slot.h * imgAspect;
          drawX = slot.x + (slot.w - drawW) / 2;
          drawY = slot.y;
        }
      } else if (settings.fitMode === 'actual') {
        // Points conversion (assuming 72pt = 1 inch, scaled to standard point size)
        drawW = Math.min(imgW * 0.75, slot.w);
        drawH = Math.min(imgH * 0.75, slot.h);
        drawX = slot.x + (slot.w - drawW) / 2;
        drawY = slot.y + (slot.h - drawH) / 2;
      }

      page.drawImage(embeddedImage, {
        x: drawX,
        y: drawY,
        width: drawW,
        height: drawH,
      });
    }

    // Optional Page Numbering
    if (settings.addPageNumbers) {
      const pageText = `Page ${pageNum} of ${totalPages}`;
      const fontSize = 9;
      const textWidth = font.widthOfTextAtSize(pageText, fontSize);

      let textX = (pageWidth - textWidth) / 2;
      let textY = Math.max(8, marginPt / 2);

      if (settings.pageNumberPosition === 'bottom-right') {
        textX = pageWidth - marginPt - textWidth;
      } else if (settings.pageNumberPosition === 'top-right') {
        textY = pageHeight - Math.max(16, marginPt / 2);
        textX = pageWidth - marginPt - textWidth;
      }

      page.drawText(pageText, {
        x: textX,
        y: textY,
        size: fontSize,
        font,
        color: settings.backgroundColor === 'black' ? rgb(0.6, 0.6, 0.7) : rgb(0.4, 0.45, 0.5),
      });
    }
  }

  if (onProgress) {
    onProgress(96, 'Assembling & finalizing PDF binary structure...');
  }

  const pdfBytes = await pdfDoc.save();

  if (onProgress) {
    onProgress(100, 'PDF Packaged successfully!');
  }

  return {
    pdfBytes,
    totalPages,
    fileSize: pdfBytes.byteLength,
  };
}

/**
 * Initiates direct download of generated PDF
 */
export function downloadPackagedPdf(pdfBytes: Uint8Array, filename: string) {
  triggerCelebration();
  const finalFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
  saveAs(blob, finalFilename);
}

function triggerCelebration() {
  try {
    confetti({
      particleCount: 50,
      spread: 65,
      origin: { y: 0.85 },
      colors: ['#f43f5e', '#ec4899', '#8b5cf6', '#3b82f6'],
    });
  } catch (_) {}
}
