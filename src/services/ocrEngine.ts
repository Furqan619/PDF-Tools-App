import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { pdfjsLib } from './pdfWorker';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import confetti from 'canvas-confetti';
import { createWorker, Worker } from 'tesseract.js';

export type OcrLanguage =
  | 'eng'
  | 'spa'
  | 'fra'
  | 'deu'
  | 'ita'
  | 'por'
  | 'chi_sim'
  | 'jpn'
  | 'rus'
  | 'ara'
  | 'hin';

export const SUPPORTED_OCR_LANGUAGES: { code: OcrLanguage; name: string; nativeName: string; flag: string }[] = [
  { code: 'eng', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'spa', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fra', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'deu', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'ita', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'por', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'chi_sim', name: 'Chinese (Simplified)', nativeName: '简体中文', flag: '🇨🇳' },
  { code: 'jpn', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'rus', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'ara', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'hin', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
];

export type OcrEngineMode = 'auto' | 'tesseract' | 'native';

export interface PreprocessingSettings {
  binarize: boolean;
  enhanceContrast: boolean;
  denoise: boolean;
  grayscale: boolean;
  invert: boolean;
}

export interface OcrSettings {
  language: OcrLanguage;
  mode: OcrEngineMode;
  preprocessing: PreprocessingSettings;
  detectTables: boolean;
  detectHeadings: boolean;
  preserveLineBreaks: boolean;
  scaleDpi: number; // 1.5 - 2.5
}

export const DEFAULT_OCR_SETTINGS: OcrSettings = {
  language: 'eng',
  mode: 'auto',
  preprocessing: {
    binarize: false,
    enhanceContrast: true,
    denoise: false,
    grayscale: true,
    invert: false,
  },
  detectTables: true,
  detectHeadings: true,
  preserveLineBreaks: true,
  scaleDpi: 2.0,
};

export interface OcrBoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrLine {
  text: string;
  confidence: number;
  bbox: OcrBoundingBox;
}

export interface OcrBlock {
  id: string;
  type: 'heading_1' | 'heading_2' | 'heading_3' | 'paragraph' | 'table' | 'list_item' | 'code';
  text: string;
  confidence: number;
  bbox: OcrBoundingBox;
  lines: OcrLine[];
  tableData?: string[][];
}

export interface OcrPageResult {
  pageNumber: number;
  width: number;
  height: number;
  text: string;
  markdown: string;
  confidence: number;
  blocks: OcrBlock[];
  previewImageUrl: string;
  preprocessedImageUrl?: string;
  wordCount: number;
  characterCount: number;
  isScanned: boolean;
  methodUsed: 'native-pdf-text' | 'neural-tesseract' | 'hybrid';
}

export interface OcrDocumentItem {
  id: string;
  file: File;
  name: string;
  size: number;
  totalPages: number;
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress: number;
  statusText?: string;
  error?: string;
  durationMs?: number;
  pages: OcrPageResult[];
  fullText: string;
  fullMarkdown: string;
  overallConfidence: number;
  totalWords: number;
  totalCharacters: number;
  languageUsed: OcrLanguage;
  settingsUsed: OcrSettings;
}

// Global cached Tesseract worker to reuse across runs
let cachedWorker: Worker | null = null;
let cachedWorkerLang = '';

export async function getTesseractWorker(lang: string, onProgress?: (p: number, status: string) => void): Promise<Worker> {
  if (cachedWorker && cachedWorkerLang === lang) {
    return cachedWorker;
  }

  if (cachedWorker) {
    try {
      await cachedWorker.terminate();
    } catch (_) {}
    cachedWorker = null;
  }

  if (onProgress) onProgress(15, `Loading OCR neural models for ${lang.toUpperCase()}...`);

  const worker = await createWorker(lang, 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        const pct = Math.round(30 + m.progress * 60);
        onProgress(pct, `Recognizing text (${Math.round(m.progress * 100)}%)...`);
      }
    },
  });

  cachedWorker = worker;
  cachedWorkerLang = lang;
  return worker;
}

/**
 * Apply image preprocessing filters to canvas
 */
export function applyPreprocessingToCanvas(
  canvas: HTMLCanvasElement,
  settings: PreprocessingSettings
): HTMLCanvasElement {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const len = data.length;

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Grayscale
    if (settings.grayscale || settings.binarize || settings.enhanceContrast) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray;
      g = gray;
      b = gray;
    }

    // Enhance contrast
    if (settings.enhanceContrast) {
      // Contrast factor 1.4
      const factor = (259 * (1.4 * 255 + 255)) / (255 * (259 - 1.4 * 255));
      r = Math.min(255, Math.max(0, factor * (r - 128) + 128));
      g = Math.min(255, Math.max(0, factor * (g - 128) + 128));
      b = Math.min(255, Math.max(0, factor * (b - 128) + 128));
    }

    // Binarize (Adaptive thresholding approximation)
    if (settings.binarize) {
      const val = r > 140 ? 255 : 0;
      r = val;
      g = val;
      b = val;
    }

    // Invert
    if (settings.invert) {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Parses native PDF text items and organizes them into spatial layout blocks
 */
export function organizeNativePdfText(
  items: any[],
  viewportWidth: number,
  viewportHeight: number
): { blocks: OcrBlock[]; text: string; markdown: string } {
  if (items.length === 0) {
    return { blocks: [], text: '', markdown: '' };
  }

  // Sort items top-to-bottom, left-to-right
  const sortedItems = [...items].sort((a, b) => {
    const yA = viewportHeight - a.transform[5];
    const yB = viewportHeight - b.transform[5];
    if (Math.abs(yA - yB) > 4) {
      return yA - yB;
    }
    return a.transform[4] - b.transform[4];
  });

  // Group into lines
  interface LineGroup {
    y: number;
    height: number;
    items: any[];
    text: string;
    bbox: OcrBoundingBox;
  }

  const lines: LineGroup[] = [];
  let currentLine: LineGroup | null = null;

  for (const item of sortedItems) {
    const str = item.str || '';
    if (!str.trim()) continue;

    const x = item.transform[4];
    const y = viewportHeight - item.transform[5];
    const fontSize = Math.hypot(item.transform[0], item.transform[1]) || 12;
    const itemWidth = item.width || str.length * (fontSize * 0.5);

    if (!currentLine || Math.abs(currentLine.y - y) > fontSize * 0.45) {
      if (currentLine) lines.push(currentLine);
      currentLine = {
        y,
        height: fontSize,
        items: [item],
        text: str,
        bbox: { x0: x, y0: y - fontSize, x1: x + itemWidth, y1: y },
      };
    } else {
      currentLine.items.push(item);
      currentLine.text += (currentLine.text.endsWith(' ') || str.startsWith(' ') ? '' : ' ') + str;
      currentLine.bbox.x1 = Math.max(currentLine.bbox.x1, x + itemWidth);
      currentLine.height = Math.max(currentLine.height, fontSize);
    }
  }
  if (currentLine) lines.push(currentLine);

  // Group lines into semantic blocks (headings, paragraphs, tables, lists)
  const blocks: OcrBlock[] = [];
  let currentBlockLines: LineGroup[] = [];

  const flushBlock = () => {
    if (currentBlockLines.length === 0) return;

    const firstLine = currentBlockLines[0];
    const avgHeight =
      currentBlockLines.reduce((acc, l) => acc + l.height, 0) / currentBlockLines.length;

    let blockType: OcrBlock['type'] = 'paragraph';
    if (currentBlockLines.length === 1 && avgHeight > 18) {
      blockType = 'heading_1';
    } else if (currentBlockLines.length === 1 && avgHeight > 14) {
      blockType = 'heading_2';
    } else if (currentBlockLines.length === 1 && avgHeight > 12.5) {
      blockType = 'heading_3';
    } else if (firstLine.text.trim().startsWith('- ') || firstLine.text.trim().startsWith('• ') || /^\d+\.\s/.test(firstLine.text.trim())) {
      blockType = 'list_item';
    }

    const minX = Math.min(...currentBlockLines.map((l) => l.bbox.x0));
    const minY = Math.min(...currentBlockLines.map((l) => l.bbox.y0));
    const maxX = Math.max(...currentBlockLines.map((l) => l.bbox.x1));
    const maxY = Math.max(...currentBlockLines.map((l) => l.bbox.y1));

    const blockText = currentBlockLines.map((l) => l.text).join('\n');

    blocks.push({
      id: `block-${Math.random().toString(36).slice(2, 9)}`,
      type: blockType,
      text: blockText,
      confidence: 99.5,
      bbox: { x0: minX, y0: minY, x1: maxX, y1: maxY },
      lines: currentBlockLines.map((l) => ({
        text: l.text,
        confidence: 99.5,
        bbox: l.bbox,
      })),
    });

    currentBlockLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (currentBlockLines.length === 0) {
      currentBlockLines.push(line);
      continue;
    }

    const prevLine = currentBlockLines[currentBlockLines.length - 1];
    const yDist = line.y - prevLine.y;
    const isHeading = line.height > 14;

    if (yDist > line.height * 2.2 || isHeading) {
      flushBlock();
      currentBlockLines.push(line);
    } else {
      currentBlockLines.push(line);
    }
  }
  flushBlock();

  // Generate plain text and formatted Markdown
  const fullText = blocks.map((b) => b.text).join('\n\n');
  const markdownParts: string[] = [];

  for (const block of blocks) {
    if (block.type === 'heading_1') {
      markdownParts.push(`# ${block.text}`);
    } else if (block.type === 'heading_2') {
      markdownParts.push(`## ${block.text}`);
    } else if (block.type === 'heading_3') {
      markdownParts.push(`### ${block.text}`);
    } else if (block.type === 'list_item') {
      markdownParts.push(block.text);
    } else {
      markdownParts.push(block.text);
    }
  }

  const markdown = markdownParts.join('\n\n');
  return { blocks, text: fullText, markdown };
}

/**
 * Main function: Process single document (PDF or Image)
 */
export async function processDocumentOcr(
  file: File,
  settings: OcrSettings,
  onProgress?: (progress: number, statusText: string) => void
): Promise<OcrDocumentItem> {
  const startTime = performance.now();
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (onProgress) onProgress(5, `Analyzing file ${file.name}...`);

  const pages: OcrPageResult[] = [];

  if (isPdf) {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/cmaps/',
      cMapPacked: true,
    });

    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pageBasePct = Math.round(10 + ((pageNum - 1) / totalPages) * 80);
      if (onProgress) onProgress(pageBasePct, `Rendering Page ${pageNum} of ${totalPages}...`);

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: settings.scaleDpi });
      const unscaledViewport = page.getViewport({ scale: 1.0 });

      // Render page to canvas
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Unable to create canvas rendering context');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await (page as any).render({
        canvasContext: ctx,
        viewport,
        canvas,
      }).promise;

      const previewImageUrl = canvas.toDataURL('image/jpeg', 0.85);

      // Check native text content
      const textContent = await page.getTextContent();
      const hasNativeText = textContent.items.length > 5;

      let pageResult: OcrPageResult;

      if (settings.mode === 'native' || (settings.mode === 'auto' && hasNativeText)) {
        // High fidelity native text parsing
        if (onProgress) onProgress(pageBasePct + 5, `Extracting layout vectors for page ${pageNum}...`);
        const { blocks, text, markdown } = organizeNativePdfText(
          textContent.items,
          unscaledViewport.width,
          unscaledViewport.height
        );

        const words = text.trim().split(/\s+/).filter(Boolean);

        pageResult = {
          pageNumber: pageNum,
          width: unscaledViewport.width,
          height: unscaledViewport.height,
          text,
          markdown,
          confidence: 99.2,
          blocks,
          previewImageUrl,
          wordCount: words.length,
          characterCount: text.length,
          isScanned: false,
          methodUsed: 'native-pdf-text',
        };
      } else {
        // Scanned document or neural mode requested: Run Tesseract
        if (onProgress) onProgress(pageBasePct + 5, `Running Neural OCR on scanned page ${pageNum}...`);

        // Apply image preprocessing
        const preprocessedCanvas = document.createElement('canvas');
        preprocessedCanvas.width = canvas.width;
        preprocessedCanvas.height = canvas.height;
        const pCtx = preprocessedCanvas.getContext('2d', { willReadFrequently: true });
        if (pCtx) {
          pCtx.drawImage(canvas, 0, 0);
          applyPreprocessingToCanvas(preprocessedCanvas, settings.preprocessing);
        }

        const preprocessedImageUrl = preprocessedCanvas.toDataURL('image/jpeg', 0.85);

        const worker = await getTesseractWorker(settings.language, (p, status) => {
          if (onProgress) onProgress(pageBasePct + Math.round((p / 100) * 20), `Page ${pageNum}: ${status}`);
        });

        const ocrResult = await worker.recognize(preprocessedCanvas);
        const ocrData = ocrResult.data;

        // Parse blocks from tesseract
        const blocks: OcrBlock[] = [];
        const rawParagraphs = (ocrData as any).paragraphs || (ocrData as any).lines || [];
        if (rawParagraphs && rawParagraphs.length > 0) {
          for (let pIdx = 0; pIdx < rawParagraphs.length; pIdx++) {
            const p = rawParagraphs[pIdx];
            const pText = (p.text || '').trim();
            if (!pText) continue;

            // Scale bounding box back to unscaled PDF points
            const scaleX = unscaledViewport.width / canvas.width;
            const scaleY = unscaledViewport.height / canvas.height;

            const bbox: OcrBoundingBox = {
              x0: (p.bbox?.x0 || 0) * scaleX,
              y0: (p.bbox?.y0 || 0) * scaleY,
              x1: (p.bbox?.x1 || canvas.width) * scaleX,
              y1: (p.bbox?.y1 || canvas.height) * scaleY,
            };

            const pLines = p.lines || [p];
            const isHeading = pLines.length === 1 && ((p.bbox?.y1 || 0) - (p.bbox?.y0 || 0)) > 36;
            const isListItem = pText.startsWith('-') || pText.startsWith('•') || /^\d+\./.test(pText);

            blocks.push({
              id: `p-${pIdx}-${Math.random().toString(36).slice(2, 6)}`,
              type: isHeading ? 'heading_2' : isListItem ? 'list_item' : 'paragraph',
              text: pText,
              confidence: p.confidence || 85,
              bbox,
              lines: pLines.map((l: any) => ({
                text: l.text || '',
                confidence: l.confidence || 85,
                bbox: {
                  x0: (l.bbox?.x0 || 0) * scaleX,
                  y0: (l.bbox?.y0 || 0) * scaleY,
                  x1: (l.bbox?.x1 || canvas.width) * scaleX,
                  y1: (l.bbox?.y1 || canvas.height) * scaleY,
                },
              })),
            });
          }
        }

        const rawText = ocrData.text || '';
        const markdown = blocks.map((b) => (b.type === 'heading_2' ? `## ${b.text}` : b.text)).join('\n\n');
        const words = rawText.trim().split(/\s+/).filter(Boolean);

        pageResult = {
          pageNumber: pageNum,
          width: unscaledViewport.width,
          height: unscaledViewport.height,
          text: rawText,
          markdown,
          confidence: Math.round(ocrData.confidence || 85),
          blocks,
          previewImageUrl,
          preprocessedImageUrl,
          wordCount: words.length,
          characterCount: rawText.length,
          isScanned: true,
          methodUsed: 'neural-tesseract',
        };

        preprocessedCanvas.width = 0;
        preprocessedCanvas.height = 0;
      }

      pages.push(pageResult);
      canvas.width = 0;
      canvas.height = 0;
    }
  } else {
    // Single image file (PNG, JPG, WebP)
    if (onProgress) onProgress(15, 'Loading image for neural optical recognition...');

    const img = new Image();
    const url = URL.createObjectURL(file);
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D context error');

    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    const previewImageUrl = canvas.toDataURL('image/jpeg', 0.85);

    // Apply preprocessing
    const pCanvas = document.createElement('canvas');
    pCanvas.width = canvas.width;
    pCanvas.height = canvas.height;
    const pCtx = pCanvas.getContext('2d', { willReadFrequently: true });
    if (pCtx) {
      pCtx.drawImage(canvas, 0, 0);
      applyPreprocessingToCanvas(pCanvas, settings.preprocessing);
    }
    const preprocessedImageUrl = pCanvas.toDataURL('image/jpeg', 0.85);

    if (onProgress) onProgress(35, 'Recognizing characters and analyzing layout...');

    const worker = await getTesseractWorker(settings.language, (p, status) => {
      if (onProgress) onProgress(35 + Math.round((p / 100) * 55), status);
    });

    const ocrResult = await worker.recognize(pCanvas);
    const ocrData = ocrResult.data;

    const blocks: OcrBlock[] = [];
    const rawParagraphs = (ocrData as any).paragraphs || (ocrData as any).lines || [];
    if (rawParagraphs && rawParagraphs.length > 0) {
      for (let pIdx = 0; pIdx < rawParagraphs.length; pIdx++) {
        const p = rawParagraphs[pIdx];
        const pText = (p.text || '').trim();
        if (!pText) continue;

        const pLines = p.lines || [p];
        const isHeading = pLines.length === 1 && ((p.bbox?.y1 || 0) - (p.bbox?.y0 || 0)) > 40;
        const isListItem = pText.startsWith('-') || pText.startsWith('•') || /^\d+\./.test(pText);

        blocks.push({
          id: `p-${pIdx}`,
          type: isHeading ? 'heading_2' : isListItem ? 'list_item' : 'paragraph',
          text: pText,
          confidence: p.confidence || 85,
          bbox: {
            x0: p.bbox?.x0 || 0,
            y0: p.bbox?.y0 || 0,
            x1: p.bbox?.x1 || canvas.width,
            y1: p.bbox?.y1 || canvas.height,
          },
          lines: pLines.map((l: any) => ({
            text: l.text || '',
            confidence: l.confidence || 85,
            bbox: {
              x0: l.bbox?.x0 || 0,
              y0: l.bbox?.y0 || 0,
              x1: l.bbox?.x1 || canvas.width,
              y1: l.bbox?.y1 || canvas.height,
            },
          })),
        });
      }
    }

    const rawText = ocrData.text || '';
    const markdown = blocks.map((b) => (b.type === 'heading_2' ? `## ${b.text}` : b.text)).join('\n\n');
    const words = rawText.trim().split(/\s+/).filter(Boolean);

    pages.push({
      pageNumber: 1,
      width: canvas.width,
      height: canvas.height,
      text: rawText,
      markdown,
      confidence: Math.round(ocrData.confidence || 85),
      blocks,
      previewImageUrl,
      preprocessedImageUrl,
      wordCount: words.length,
      characterCount: rawText.length,
      isScanned: true,
      methodUsed: 'neural-tesseract',
    });

    canvas.width = 0;
    canvas.height = 0;
    pCanvas.width = 0;
    pCanvas.height = 0;
  }

  if (onProgress) onProgress(95, 'Synthesizing layout structure & metadata...');

  const fullText = pages.map((p) => p.text).join('\n\n--- Page Break ---\n\n');
  const fullMarkdown = pages
    .map((p, i) => `<!-- Page ${i + 1} -->\n${p.markdown}`)
    .join('\n\n---\n\n');

  const totalWords = pages.reduce((acc, p) => acc + p.wordCount, 0);
  const totalCharacters = pages.reduce((acc, p) => acc + p.characterCount, 0);
  const overallConfidence =
    pages.length > 0
      ? Math.round(pages.reduce((acc, p) => acc + p.confidence, 0) / pages.length)
      : 95;

  const durationMs = Math.round(performance.now() - startTime);

  if (onProgress) onProgress(100, 'OCR extraction complete!');

  return {
    id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    file,
    name: file.name,
    size: file.size,
    totalPages: pages.length,
    status: 'completed',
    progress: 100,
    statusText: 'Completed',
    durationMs,
    pages,
    fullText,
    fullMarkdown,
    overallConfidence,
    totalWords,
    totalCharacters,
    languageUsed: settings.language,
    settingsUsed: settings,
  };
}

/**
 * Downloads plain text file
 */
export function exportAsPlainText(doc: OcrDocumentItem) {
  triggerConfetti();
  const blob = new Blob([doc.fullText], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, doc.name.replace(/\.[^/.]+$/, '') + '_extracted.txt');
}

/**
 * Downloads structured Markdown file
 */
export function exportAsMarkdown(doc: OcrDocumentItem) {
  triggerConfetti();
  const header = `# OCR Text & Layout Extraction: ${doc.name}\n\n` +
    `* Extracted on: ${new Date().toLocaleString()}\n` +
    `* Total Pages: ${doc.totalPages}\n` +
    `* Overall Confidence: ${doc.overallConfidence}%\n` +
    `* Words: ${doc.totalWords} | Characters: ${doc.totalCharacters}\n\n---\n\n`;

  const blob = new Blob([header + doc.fullMarkdown], { type: 'text/markdown;charset=utf-8' });
  saveAs(blob, doc.name.replace(/\.[^/.]+$/, '') + '_extracted.md');
}

/**
 * Downloads structured JSON payload
 */
export function exportAsJson(doc: OcrDocumentItem) {
  triggerConfetti();
  const payload = {
    documentName: doc.name,
    extractedAt: new Date().toISOString(),
    overallConfidence: doc.overallConfidence,
    totalPages: doc.totalPages,
    totalWords: doc.totalWords,
    totalCharacters: doc.totalCharacters,
    language: doc.languageUsed,
    pages: doc.pages.map((p) => ({
      pageNumber: p.pageNumber,
      dimensions: { width: p.width, height: p.height },
      confidence: p.confidence,
      wordCount: p.wordCount,
      characterCount: p.characterCount,
      method: p.methodUsed,
      blocks: p.blocks,
    })),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  saveAs(blob, doc.name.replace(/\.[^/.]+$/, '') + '_structure.json');
}

/**
 * Generates Searchable PDF Blob with transparent OCR text overlay
 */
export async function generateSearchablePdfBlob(doc: OcrDocumentItem): Promise<Blob> {
  const outputDoc = await PDFDocument.create();
  const helveticaFont = await outputDoc.embedFont(StandardFonts.Helvetica);

  for (const pageResult of doc.pages) {
    const page = outputDoc.addPage([pageResult.width || 612, pageResult.height || 792]);

    // Embed visual preview image
    if (pageResult.previewImageUrl) {
      const base64Data = pageResult.previewImageUrl.split(',')[1];
      const imgBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const embeddedImg = await outputDoc.embedJpg(imgBytes);

      page.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: pageResult.width,
        height: pageResult.height,
      });
    }

    // Embed invisible selectable text layer matching detected coordinates
    for (const block of pageResult.blocks) {
      for (const line of block.lines) {
        if (!line.text.trim()) continue;
        const fontHeight = Math.max(7, Math.min(36, line.bbox.y1 - line.bbox.y0));
        const yPos = pageResult.height - line.bbox.y1;

        try {
          page.drawText(line.text, {
            x: Math.max(0, line.bbox.x0),
            y: Math.max(0, yPos),
            size: Math.max(6, fontHeight * 0.8),
            font: helveticaFont,
            color: rgb(0, 0, 0),
            opacity: 0.01, // Near-invisible selectable text layer for search & select
          });
        } catch (_) {}
      }
    }
  }

  const pdfBytes = await outputDoc.save();
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
}

/**
 * Downloads Searchable PDF with transparent OCR text overlay
 */
export async function exportAsSearchablePdf(doc: OcrDocumentItem) {
  triggerConfetti();
  const blob = await generateSearchablePdfBlob(doc);
  saveAs(blob, doc.name.replace(/\.[^/.]+$/, '') + '_searchable.pdf');
}

/**
 * Downloads batch ZIP containing all searchable PDF documents
 */
export async function downloadAllSearchablePdfsZip(docs: OcrDocumentItem[]) {
  const completed = docs.filter((d) => d.status === 'completed');
  if (completed.length === 0) return;

  const zip = new JSZip();
  for (const doc of completed) {
    const baseName = doc.name.replace(/\.[^/.]+$/, '');
    const blob = await generateSearchablePdfBlob(doc);
    zip.file(`${baseName}_searchable.pdf`, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  triggerConfetti();
  saveAs(zipBlob, 'searchable_ocr_documents.zip');
}

/**
 * Downloads batch ZIP of all results (Text, Markdown, JSON, and Searchable PDFs)
 */
export async function downloadAllOcrZip(docs: OcrDocumentItem[]) {
  const completed = docs.filter((d) => d.status === 'completed');
  if (completed.length === 0) return;

  const zip = new JSZip();
  const searchableFolder = zip.folder('searchable_pdfs') || zip;
  const txtFolder = zip.folder('text') || zip;
  const mdFolder = zip.folder('markdown') || zip;
  const jsonFolder = zip.folder('json') || zip;

  for (const doc of completed) {
    const baseName = doc.name.replace(/\.[^/.]+$/, '');
    const pdfBlob = await generateSearchablePdfBlob(doc);
    searchableFolder.file(`${baseName}_searchable.pdf`, pdfBlob);
    txtFolder.file(`${baseName}.txt`, doc.fullText);
    mdFolder.file(`${baseName}.md`, doc.fullMarkdown);
    jsonFolder.file(
      `${baseName}_structure.json`,
      JSON.stringify(
        {
          name: doc.name,
          confidence: doc.overallConfidence,
          pages: doc.pages,
        },
        null,
        2
      )
    );
  }

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  triggerConfetti();
  saveAs(zipBlob, 'ocr_extracted_documents_full_suite.zip');
}

function triggerConfetti() {
  try {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.85 },
      colors: ['#a855f7', '#8b5cf6', '#3b82f6', '#10b981'],
    });
  } catch (_) {}
}
