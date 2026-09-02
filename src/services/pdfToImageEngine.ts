import { pdfjsLib } from './pdfWorker';
import JSZip from 'jszip';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export type ImageFormat = 'png' | 'jpeg' | 'webp';
export type DpiPreset = 72 | 150 | 300 | 600 | 'custom';
export type ColorMode = 'color' | 'grayscale' | 'bw_binarized' | 'inverted';

export interface PdfToImageConfig {
  format: ImageFormat;
  dpi: number; // 72, 150, 300, 600
  scale: number; // e.g. 1.0 for 72dpi, 2.083 for 150dpi, 4.166 for 300dpi, 8.333 for 600dpi
  jpegQuality: number; // 0.1 to 1.0
  colorMode: ColorMode;
  backgroundColor: string; // '#ffffff' or 'transparent'
  brightness: number; // 0.5 to 1.5 (default 1.0)
  contrast: number; // 0.5 to 1.5 (default 1.0)
  rotation: 0 | 90 | 180 | 270;
  namingPattern: string; // e.g. '[name]_page_[page]'
  selectedPageNumbers: number[]; // 1-indexed
  outputZipName: string;
}

export interface RenderedPageImageResult {
  pageNumber: number;
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
  fileSizeBytes: number;
  fileName: string;
}

export const DEFAULT_PDF_TO_IMAGE_CONFIG: PdfToImageConfig = {
  format: 'png',
  dpi: 150,
  scale: 2.083, // 150 / 72
  jpegQuality: 0.92,
  colorMode: 'color',
  backgroundColor: '#ffffff',
  brightness: 1.0,
  contrast: 1.0,
  rotation: 0,
  namingPattern: '[name]_page_[page]',
  selectedPageNumbers: [],
  outputZipName: 'Extracted_Images.zip',
};

/**
 * Calculates scale multiplier from target DPI
 */
export function getScaleFromDpi(dpi: number): number {
  return dpi / 72;
}

/**
 * Parses user entered page selection string like "1, 3, 5-10, odd"
 */
export function parseSelectedPages(input: string, totalPages: number): number[] {
  if (!input || input.trim().toLowerCase() === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (input.trim().toLowerCase() === 'first') return [1];
  if (input.trim().toLowerCase() === 'last') return [totalPages];
  if (input.trim().toLowerCase() === 'odd') {
    return Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 1);
  }
  if (input.trim().toLowerCase() === 'even') {
    return Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 0);
  }

  const pagesSet = new Set<number>();
  const parts = input.split(/[,;\s]+/).filter(Boolean);

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

  const res = Array.from(pagesSet).sort((a, b) => a - b);
  return res.length > 0 ? res : Array.from({ length: totalPages }, (_, i) => i + 1);
}

/**
 * Renders a single PDF.js page onto an HTML Canvas with custom scaling, rotation, and color filters
 */
export async function renderPdfPageToCanvas(
  pdfPage: any,
  config: {
    scale: number;
    rotation: number;
    backgroundColor: string;
    colorMode: ColorMode;
    brightness: number;
    contrast: number;
  }
): Promise<HTMLCanvasElement> {
  const effectiveRotation = (pdfPage.rotate + config.rotation) % 360;
  const viewport = pdfPage.getViewport({ scale: config.scale, rotation: effectiveRotation });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not obtain canvas 2D context');

  // Fill background
  if (config.backgroundColor !== 'transparent') {
    ctx.fillStyle = config.backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Render PDF contents
  const renderContext = {
    canvasContext: ctx,
    viewport,
    canvas,
    background: config.backgroundColor === 'transparent' ? 'rgba(0,0,0,0)' : (config.backgroundColor || '#ffffff'),
  };

  await (pdfPage.render as any)(renderContext).promise;

  // Apply post-processing color adjustments if needed
  if (
    config.colorMode !== 'color' ||
    config.brightness !== 1.0 ||
    config.contrast !== 1.0
  ) {
    applyCanvasFilters(ctx, canvas.width, canvas.height, config);
  }

  return canvas;
}

/**
 * Pixel manipulation for Grayscale, Binarization, Inversion, Brightness & Contrast
 */
function applyCanvasFilters(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: {
    colorMode: ColorMode;
    brightness: number;
    contrast: number;
  }
) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const len = data.length;

  const bright = config.brightness;
  const cont = config.contrast;
  const contFactor = (259 * (cont * 255 + 255)) / (255 * (259 - cont * 255));

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Brightness adjustment
    if (bright !== 1.0) {
      r = Math.min(255, Math.max(0, r * bright));
      g = Math.min(255, Math.max(0, g * bright));
      b = Math.min(255, Math.max(0, b * bright));
    }

    // Contrast adjustment
    if (cont !== 1.0) {
      r = Math.min(255, Math.max(0, contFactor * (r - 128) + 128));
      g = Math.min(255, Math.max(0, contFactor * (g - 128) + 128));
      b = Math.min(255, Math.max(0, contFactor * (b - 128) + 128));
    }

    // Color mode
    if (config.colorMode === 'grayscale') {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    } else if (config.colorMode === 'bw_binarized') {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const binarized = gray > 140 ? 255 : 0;
      data[i] = binarized;
      data[i + 1] = binarized;
      data[i + 2] = binarized;
    } else if (config.colorMode === 'inverted') {
      data[i] = 255 - r;
      data[i + 1] = 255 - g;
      data[i + 2] = 255 - b;
    } else {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Converts canvas to high quality Blob with mime-type
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: ImageFormat,
  quality: number = 0.92
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    let mimeType = 'image/png';
    if (format === 'jpeg') mimeType = 'image/jpeg';
    if (format === 'webp') mimeType = 'image/webp';

    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error(`Failed to convert canvas to ${mimeType}`));
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * Converts canvas to Data URL
 */
export function canvasToDataUrl(
  canvas: HTMLCanvasElement,
  format: ImageFormat,
  quality: number = 0.92
): string {
  let mimeType = 'image/png';
  if (format === 'jpeg') mimeType = 'image/jpeg';
  if (format === 'webp') mimeType = 'image/webp';
  return canvas.toDataURL(mimeType, quality);
}

/**
 * Formats output filename based on naming pattern
 */
export function formatOutputFilename(
  docName: string,
  pageNum: number,
  format: ImageFormat,
  pattern: string = '[name]_page_[page]'
): string {
  const baseName = docName.replace(/\.pdf$/i, '');
  const pageStr = String(pageNum).padStart(3, '0');
  const ext = format === 'jpeg' ? 'jpg' : format;

  let name = pattern
    .replace(/\[name\]/g, baseName)
    .replace(/\[page\]/g, pageStr)
    .replace(/\[raw_page\]/g, String(pageNum));

  if (!name.toLowerCase().endsWith(`.${ext}`)) {
    name = `${name}.${ext}`;
  }

  return name;
}

/**
 * Batch renders selected PDF pages into images with progress reporting
 */
export async function renderAllSelectedPages(
  pdfDoc: any,
  docName: string,
  config: PdfToImageConfig,
  onProgress?: (percent: number, current: number, total: number, message: string) => void
): Promise<RenderedPageImageResult[]> {
  const totalDocPages = pdfDoc.numPages;
  const targetPages = config.selectedPageNumbers.length > 0
    ? config.selectedPageNumbers.filter((p) => p >= 1 && p <= totalDocPages)
    : Array.from({ length: totalDocPages }, (_, i) => i + 1);

  const results: RenderedPageImageResult[] = [];
  const total = targetPages.length;

  for (let i = 0; i < total; i++) {
    const pageNum = targetPages[i];
    const percent = Math.round(((i) / total) * 100);
    onProgress?.(percent, i + 1, total, `Rendering Page ${pageNum} of ${totalDocPages} at ${config.dpi} DPI...`);

    const page = await pdfDoc.getPage(pageNum);
    const canvas = await renderPdfPageToCanvas(page, {
      scale: config.scale,
      rotation: config.rotation,
      backgroundColor: config.backgroundColor,
      colorMode: config.colorMode,
      brightness: config.brightness,
      contrast: config.contrast,
    });

    const blob = await canvasToBlob(canvas, config.format, config.jpegQuality);
    const dataUrl = canvasToDataUrl(canvas, config.format, config.jpegQuality);
    const fileName = formatOutputFilename(docName, pageNum, config.format, config.namingPattern);

    results.push({
      pageNumber: pageNum,
      dataUrl,
      blob,
      width: canvas.width,
      height: canvas.height,
      fileSizeBytes: blob.size,
      fileName,
    });
  }

  onProgress?.(100, total, total, 'Image rendering completed!');
  return results;
}

/**
 * Creates a ZIP file containing all exported page images
 */
export async function exportImagesAsZip(
  results: RenderedPageImageResult[],
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const zip = new JSZip();

  for (const item of results) {
    zip.file(item.fileName, item.blob);
  }

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      onProgress?.(Math.round(metadata.percent));
    }
  );

  return zipBlob;
}

/**
 * Generates sample rich PDF documents for testing PDF to Image converter
 */
export async function generateSamplePdfForImageConverter(
  preset: 'infographic' | 'presentation' | 'magazine'
): Promise<File> {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

  if (preset === 'infographic') {
    // Page 1: Infographic Dashboard Overview
    const page1 = pdfDoc.addPage([612, 792]);
    const { width: w1, height: h1 } = page1.getSize();

    // Top Header Banner
    page1.drawRectangle({
      x: 0,
      y: h1 - 100,
      width: w1,
      height: 100,
      color: rgb(0.08, 0.18, 0.36),
    });

    page1.drawText('GLOBAL AI & CLOUD INFRASTRUCTURE 2026', {
      x: 36,
      y: h1 - 45,
      size: 16,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page1.drawText('Executive Annual Report - Visual Architecture & Data Metrics', {
      x: 36,
      y: h1 - 70,
      size: 9.5,
      font: fontReg,
      color: rgb(0.65, 0.8, 1),
    });

    // 3 Metric Stat Cards
    const cards = [
      { title: 'COMPUTE CLUSTERS', val: '14,280 H100s', col: rgb(0.12, 0.53, 0.9) },
      { title: 'LATENCY (P99)', val: '18.4 ms', col: rgb(0.06, 0.65, 0.45) },
      { title: 'GLOBAL AVAILABILITY', val: '99.995%', col: rgb(0.55, 0.25, 0.85) },
    ];

    for (let c = 0; c < cards.length; c++) {
      const cardX = 36 + c * 185;
      page1.drawRectangle({
        x: cardX,
        y: h1 - 185,
        width: 170,
        height: 65,
        color: rgb(0.96, 0.97, 0.99),
        borderColor: rgb(0.85, 0.88, 0.94),
        borderWidth: 1,
      });

      page1.drawRectangle({
        x: cardX,
        y: h1 - 185,
        width: 4,
        height: 65,
        color: cards[c].col,
      });

      page1.drawText(cards[c].title, {
        x: cardX + 14,
        y: h1 - 145,
        size: 7.5,
        font: fontBold,
        color: rgb(0.4, 0.45, 0.55),
      });

      page1.drawText(cards[c].val, {
        x: cardX + 14,
        y: h1 - 172,
        size: 14,
        font: fontBold,
        color: rgb(0.1, 0.15, 0.25),
      });
    }

    // Main Chart Box Simulation
    page1.drawRectangle({
      x: 36,
      y: h1 - 440,
      width: 540,
      height: 230,
      color: rgb(0.98, 0.99, 1),
      borderColor: rgb(0.85, 0.88, 0.94),
      borderWidth: 1,
    });

    page1.drawText('QUARTERLY REGIONAL THROUGHPUT DISTRIBUTION (PETABYTES)', {
      x: 52,
      y: h1 - 235,
      size: 9.5,
      font: fontBold,
      color: rgb(0.15, 0.2, 0.3),
    });

    // Bar Chart Visual Elements
    const bars = [
      { label: 'Q1 N.America', height: 110, color: rgb(0.2, 0.5, 0.9) },
      { label: 'Q2 N.America', height: 140, color: rgb(0.2, 0.5, 0.9) },
      { label: 'Q1 Europe', height: 85, color: rgb(0.1, 0.7, 0.5) },
      { label: 'Q2 Europe', height: 115, color: rgb(0.1, 0.7, 0.5) },
      { label: 'Q1 Asia-Pac', height: 95, color: rgb(0.6, 0.3, 0.85) },
      { label: 'Q2 Asia-Pac', height: 155, color: rgb(0.6, 0.3, 0.85) },
    ];

    for (let b = 0; b < bars.length; b++) {
      const barX = 65 + b * 76;
      const barH = bars[b].height;
      page1.drawRectangle({
        x: barX,
        y: h1 - 410,
        width: 48,
        height: barH,
        color: bars[b].color,
      });

      page1.drawText(bars[b].label, {
        x: barX,
        y: h1 - 425,
        size: 6.5,
        font: fontReg,
        color: rgb(0.35, 0.4, 0.5),
      });
    }

    // Bottom Paragraph
    page1.drawText('KEY STRATEGIC TAKEAWAYS:', {
      x: 36,
      y: h1 - 470,
      size: 9.5,
      font: fontBold,
      color: rgb(0.1, 0.15, 0.25),
    });

    const notes = [
      '• Cross-region fiber connectivity reduced inter-datacenter replication lag by 42%.',
      '• Automated failover protocols maintained 100% uptime during tier-1 network provider outages.',
      '• Green energy contracts now power 88% of all Northern hemisphere compute zones.',
    ];
    let noteY = h1 - 490;
    for (const n of notes) {
      page1.drawText(n, { x: 36, y: noteY, size: 8.5, font: fontReg, color: rgb(0.25, 0.3, 0.4) });
      noteY -= 18;
    }

    // Page 2: System Architecture Diagram
    const page2 = pdfDoc.addPage([612, 792]);
    const { width: w2, height: h2 } = page2.getSize();

    page2.drawRectangle({
      x: 0,
      y: h2 - 80,
      width: w2,
      height: 80,
      color: rgb(0.1, 0.12, 0.18),
    });

    page2.drawText('PAGE 2: ZERO-TRUST CLOUD FABRIC ARCHITECTURE', {
      x: 36,
      y: h2 - 45,
      size: 14,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page2.drawRectangle({
      x: 36,
      y: 50,
      width: 540,
      height: h2 - 150,
      color: rgb(0.97, 0.98, 0.99),
      borderColor: rgb(0.8, 0.85, 0.9),
      borderWidth: 1,
    });

    page2.drawText('DETAILED TOPOLOGY & DATA FLOW PIPELINE', {
      x: 50,
      y: h2 - 120,
      size: 11,
      font: fontBold,
      color: rgb(0.15, 0.2, 0.3),
    });

    const flowSteps = [
      '1. Edge Ingress: CloudFlare Anycast + WAF + TLS 1.3 Termination',
      '2. Gateway: Envoy Proxy with mTLS service mesh verification',
      '3. Microservices: Kubernetes multi-tenant worker nodes with gRPC streaming',
      '4. Storage: High-speed NVMe Spanner clusters + Multi-region Object Store',
      '5. Telemetry: Distributed OpenTelemetry tracing & Prometheus alerts',
    ];

    let flowY = h2 - 160;
    for (const step of flowSteps) {
      page2.drawRectangle({
        x: 50,
        y: flowY - 28,
        width: 510,
        height: 38,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.85, 0.88, 0.94),
        borderWidth: 1,
      });
      page2.drawText(step, { x: 65, y: flowY - 14, size: 8.5, font: fontBold, color: rgb(0.2, 0.3, 0.45) });
      flowY -= 50;
    }

    const pdfBytes = await pdfDoc.save();
    return new File([pdfBytes], 'AI_Cloud_Architecture_Infographic.pdf', { type: 'application/pdf' });
  }

  // Preset: Presentation Slide Deck
  const page1 = pdfDoc.addPage([792, 612]); // Landscape
  const { width: w, height: h } = page1.getSize();

  page1.drawRectangle({
    x: 0,
    y: 0,
    width: w,
    height: h,
    color: rgb(0.07, 0.1, 0.16),
  });

  page1.drawText('PROJECT APEX: QUANTUM COMPUTE ROADMAP', {
    x: 60,
    y: h - 140,
    size: 26,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page1.drawText('Next-Generation Fault-Tolerant Topological Qubit Systems', {
    x: 60,
    y: h - 180,
    size: 13,
    font: fontReg,
    color: rgb(0.4, 0.75, 1),
  });

  page1.drawRectangle({
    x: 60,
    y: 100,
    width: 672,
    height: 240,
    color: rgb(0.12, 0.16, 0.25),
    borderColor: rgb(0.25, 0.35, 0.5),
    borderWidth: 1,
  });

  page1.drawText('KEY TECHNICAL MILESTONES (2026 - 2028):', {
    x: 85,
    y: 300,
    size: 12,
    font: fontBold,
    color: rgb(0.9, 0.95, 1),
  });

  page1.drawText('• Logical Qubit Error Suppression Ratio: 10^-6 per gate operation', {
    x: 85,
    y: 265,
    size: 10,
    font: fontReg,
    color: rgb(0.7, 0.8, 0.95),
  });
  page1.drawText('• Cryogenic CMOS Control Interconnects operating at 15 milliKelvin', {
    x: 85,
    y: 235,
    size: 10,
    font: fontReg,
    color: rgb(0.7, 0.8, 0.95),
  });
  page1.drawText('• Real-time Quantum Error Correction ASIC co-processor integrated in package', {
    x: 85,
    y: 205,
    size: 10,
    font: fontReg,
    color: rgb(0.7, 0.8, 0.95),
  });

  // Slide 2
  const page2 = pdfDoc.addPage([792, 612]);
  page2.drawRectangle({
    x: 0,
    y: 0,
    width: w,
    height: h,
    color: rgb(0.96, 0.97, 0.99),
  });

  page2.drawText('HARDWARE INTEGRATION & SCALING TIMELINE', {
    x: 60,
    y: h - 90,
    size: 20,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  const pdfBytes = await pdfDoc.save();
  return new File([pdfBytes], 'Quantum_Roadmap_SlideDeck.pdf', { type: 'application/pdf' });
}
