import { PDFDocument } from 'pdf-lib';
import { pdfjsLib } from './pdfWorker';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import confetti from 'canvas-confetti';

export type CompressionPreset = 'extreme' | 'recommended' | 'low' | 'custom';

export interface CompressionSettings {
  preset: CompressionPreset;
  scale: number; // 0.6 to 2.0 (DPI scale multiplier)
  quality: number; // 0.2 to 0.95 (JPEG compression quality)
  grayscale: boolean;
  stripMetadata: boolean;
  maxDimension: number; // 0 for unlimited, or e.g. 1600
}

export interface CompressFileItem {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  compressedSize?: number;
  compressedData?: Uint8Array;
  totalPages: number;
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress: number;
  statusText?: string;
  error?: string;
  durationMs?: number;
  previewOriginalUrl?: string;
  previewCompressedUrl?: string;
}

export const PRESET_CONFIGS: Record<Exclude<CompressionPreset, 'custom'>, CompressionSettings> = {
  extreme: {
    preset: 'extreme',
    scale: 0.9,
    quality: 0.48,
    grayscale: false,
    stripMetadata: true,
    maxDimension: 1200,
  },
  recommended: {
    preset: 'recommended',
    scale: 1.35,
    quality: 0.72,
    grayscale: false,
    stripMetadata: true,
    maxDimension: 1800,
  },
  low: {
    preset: 'low',
    scale: 1.8,
    quality: 0.88,
    grayscale: false,
    stripMetadata: false,
    maxDimension: 2600,
  },
};

/**
 * Renders page to canvas, optimizes image encoding, and embeds into fresh PDFDocument.
 */
export async function compressPdfDocument(
  file: File,
  settings: CompressionSettings,
  onProgress?: (progress: number, status: string) => void
): Promise<{ data: Uint8Array; originalSize: number; compressedSize: number; durationMs: number; previewUrls?: { original: string; compressed: string } }> {
  const startTime = performance.now();
  const originalSize = file.size;

  if (onProgress) onProgress(5, 'Loading and parsing PDF...');
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/cmaps/',
    cMapPacked: true,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  const outputDoc = await PDFDocument.create();

  if (!settings.stripMetadata) {
    outputDoc.setTitle(file.name.replace(/\.pdf$/i, ''));
    outputDoc.setCreator('Document Tools Hub - PDF Compressor');
  }

  let previewOriginalUrl = '';
  let previewCompressedUrl = '';

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const pagePercent = Math.round(10 + ((pageNum - 1) / numPages) * 80);
    if (onProgress) {
      onProgress(pagePercent, `Optimizing page ${pageNum} of ${numPages}...`);
    }

    const page = await pdf.getPage(pageNum);
    const unscaledViewport = page.getViewport({ scale: 1.0 });

    // Determine scale factor
    let scale = settings.scale;
    if (settings.maxDimension > 0) {
      const maxDim = Math.max(unscaledViewport.width, unscaledViewport.height);
      if (maxDim * scale > settings.maxDimension) {
        scale = settings.maxDimension / maxDim;
      }
    }

    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      throw new Error('Failed to acquire canvas rendering context');
    }

    // Fill white background for PDF rendering
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await (page as any).render({
      canvasContext: ctx,
      viewport,
      canvas,
    }).promise;

    // Optional Grayscale conversion
    if (settings.grayscale) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        // Luminance formula
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // Convert canvas to optimized JPEG byte stream
    const dataUrl = canvas.toDataURL('image/jpeg', settings.quality);
    
    // Grab preview for page 1
    if (pageNum === 1) {
      previewCompressedUrl = dataUrl;
      // Get small original preview if not already grabbed
      const origCanvas = document.createElement('canvas');
      const origVp = page.getViewport({ scale: 0.6 });
      origCanvas.width = origVp.width;
      origCanvas.height = origVp.height;
      const origCtx = origCanvas.getContext('2d');
      if (origCtx) {
        origCtx.fillStyle = '#FFFFFF';
        origCtx.fillRect(0, 0, origCanvas.width, origCanvas.height);
        await (page as any).render({
          canvasContext: origCtx,
          viewport: origVp,
          canvas: origCanvas,
        }).promise;
        previewOriginalUrl = origCanvas.toDataURL('image/jpeg', 0.9);
      }
      origCanvas.width = 0;
      origCanvas.height = 0;
    }

    // Extract JPEG binary
    const base64Data = dataUrl.split(',')[1];
    const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    const embeddedImage = await outputDoc.embedJpg(imageBytes);

    // Maintain exact original PDF page dimensions in points
    const newPage = outputDoc.addPage([unscaledViewport.width, unscaledViewport.height]);
    newPage.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: unscaledViewport.width,
      height: unscaledViewport.height,
    });

    // Clean up canvas
    canvas.width = 0;
    canvas.height = 0;
  }

  if (onProgress) onProgress(93, 'Applying stream compression & finalizing...');

  const compressedData = await outputDoc.save({ useObjectStreams: true });
  const compressedSize = compressedData.byteLength;
  const durationMs = Math.round(performance.now() - startTime);

  if (onProgress) onProgress(100, 'Optimization completed!');

  return {
    data: compressedData,
    originalSize,
    compressedSize,
    durationMs,
    previewUrls: previewOriginalUrl ? { original: previewOriginalUrl, compressed: previewCompressedUrl } : undefined,
  };
}

/**
 * Downloads a compressed file and triggers confetti animation.
 */
export function downloadCompressedPdf(data: Uint8Array, filename: string) {
  try {
    confetti({
      particleCount: 55,
      spread: 65,
      origin: { y: 0.85 },
      colors: ['#f59e0b', '#d97706', '#10b981', '#3b82f6'],
    });
  } catch (_) {}

  const blob = new Blob([data as any], { type: 'application/pdf' });
  saveAs(blob, filename);
}

/**
 * Packages all compressed files into a single ZIP archive.
 */
export async function downloadAllCompressedZip(items: CompressFileItem[], zipName = 'compressed_pdfs.zip') {
  const completedItems = items.filter((it) => it.status === 'completed' && it.compressedData);
  if (completedItems.length === 0) return;

  const zip = new JSZip();
  const folder = zip.folder('optimized_pdfs') || zip;

  for (const item of completedItems) {
    const outName = item.name.replace(/\.pdf$/i, '_optimized.pdf');
    folder.file(outName, item.compressedData!);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  saveAs(zipBlob, zipName);
}
