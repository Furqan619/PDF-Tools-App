import { PDFDocument, degrees } from 'pdf-lib';
import { pdfjsLib } from './pdfWorker';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import confetti from 'canvas-confetti';

export interface MergeDocumentItem {
  id: string;
  file: File;
  name: string;
  size: number;
  totalPages: number;
  pages: {
    pageNumber: number; // 1-indexed
    rotation: number; // 0, 90, 180, 270
    selected: boolean;
    thumbnailUrl?: string;
  }[];
  isExpanded?: boolean;
}

export interface SplitPageItem {
  pageNumber: number;
  rotation: number;
  selected: boolean;
  thumbnailUrl?: string;
}

export interface SplitConfig {
  mode: 'extract-selected' | 'all-individual' | 'chunks' | 'custom-range';
  customRange: string;
  chunkSize: number;
  mergeSelectedIntoOne: boolean;
}

/**
 * Loads a PDF file and renders thumbnail previews for all or selected pages using PDF.js.
 */
export async function generatePageThumbnails(
  file: File,
  maxPagesToPreview = 100,
  onProgress?: (loaded: number, total: number) => void
): Promise<{ pageNumber: number; thumbnailUrl: string; width: number; height: number }[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/cmaps/',
    cMapPacked: true,
  });

  const pdf = await loadingTask.promise;
  const total = pdf.numPages;
  const count = Math.min(total, maxPagesToPreview);
  const thumbnails: { pageNumber: number; thumbnailUrl: string; width: number; height: number }[] = [];

  for (let i = 1; i <= count; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 0.4 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(80, Math.floor(viewport.width));
    canvas.height = Math.max(100, Math.floor(viewport.height));
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // White background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await (page as any).render({
        canvasContext: ctx,
        viewport,
        canvas,
      }).promise;

      const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.85);
      thumbnails.push({
        pageNumber: i,
        thumbnailUrl,
        width: viewport.width,
        height: viewport.height,
      });
    }

    canvas.width = 0;
    canvas.height = 0;

    if (onProgress) {
      onProgress(i, total);
    }
  }

  return thumbnails;
}

/**
 * Merges multiple PDF documents with custom page selections and rotations into a single PDF.
 */
export async function mergePdfDocuments(
  items: MergeDocumentItem[],
  outputName: string = 'merged_document.pdf',
  onProgress?: (progress: number, status: string) => void
): Promise<Uint8Array> {
  const mergedDoc = await PDFDocument.create();
  mergedDoc.setTitle(outputName.replace(/\.pdf$/i, ''));
  mergedDoc.setCreator('Document Tools Hub - PDF Merger');
  mergedDoc.setProducer('pdf-lib (In-Browser)');

  const totalFiles = items.length;

  for (let fileIdx = 0; fileIdx < totalFiles; fileIdx++) {
    const item = items[fileIdx];
    if (onProgress) {
      onProgress(Math.round(((fileIdx) / totalFiles) * 80), `Reading ${item.name}...`);
    }

    const arrayBuffer = await item.file.arrayBuffer();
    const sourceDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

    // Determine which pages to copy
    const selectedPages = item.pages.filter((p) => p.selected);
    if (selectedPages.length === 0) continue;

    // 0-indexed page numbers for pdf-lib
    const pageIndices = selectedPages.map((p) => p.pageNumber - 1);
    const copiedPages = await mergedDoc.copyPages(sourceDoc, pageIndices);

    // Apply rotations
    for (let i = 0; i < copiedPages.length; i++) {
      const pageInfo = selectedPages[i];
      const page = copiedPages[i];
      if (pageInfo.rotation !== 0) {
        const currentRotation = page.getRotation().angle;
        page.setRotation(degrees((currentRotation + pageInfo.rotation) % 360));
      }
      mergedDoc.addPage(page);
    }
  }

  if (onProgress) {
    onProgress(90, 'Optimizing and assembling final PDF...');
  }

  const mergedPdfBytes = await mergedDoc.save();

  if (onProgress) {
    onProgress(100, 'Complete!');
  }

  return mergedPdfBytes;
}

/**
 * Parses user range strings like "1-3, 5, 8-10" into 1-based page numbers.
 */
export function parseRangeString(rangeStr: string, totalPages: number): number[] {
  if (!rangeStr || rangeStr.trim().toLowerCase() === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const result = new Set<number>();
  const segments = rangeStr.split(/[,;\s]+/).filter(Boolean);

  for (const seg of segments) {
    if (seg.includes('-')) {
      const [startStr, endStr] = seg.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.max(1, Math.min(start, end));
        const max = Math.min(totalPages, Math.max(start, end));
        for (let p = min; p <= max; p++) {
          result.add(p);
        }
      }
    } else {
      const p = parseInt(seg, 10);
      if (!isNaN(p) && p >= 1 && p <= totalPages) {
        result.add(p);
      }
    }
  }

  return Array.from(result).sort((a, b) => a - b);
}

/**
 * Splits or extracts pages from a single PDF document based on split configuration.
 */
export async function splitPdfDocument(
  file: File,
  pages: SplitPageItem[],
  config: SplitConfig,
  onProgress?: (percent: number, status: string) => void
): Promise<{ type: 'pdf' | 'zip'; data: Uint8Array | Blob; filename: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const sourceDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = sourceDoc.getPageCount();
  const baseName = file.name.replace(/\.pdf$/i, '');

  if (onProgress) onProgress(10, 'Analyzing PDF page structure...');

  // Mode 1: Extract Selected or Custom Range into a single consolidated PDF
  if (
    config.mode === 'extract-selected' || 
    (config.mode === 'custom-range' && config.mergeSelectedIntoOne)
  ) {
    let targetPageNumbers: number[] = [];
    if (config.mode === 'custom-range') {
      targetPageNumbers = parseRangeString(config.customRange, totalPages);
    } else {
      targetPageNumbers = pages.filter((p) => p.selected).map((p) => p.pageNumber);
    }

    if (targetPageNumbers.length === 0) {
      throw new Error('No pages were selected for extraction.');
    }

    const newDoc = await PDFDocument.create();
    newDoc.setTitle(`${baseName} (Extracted)`);
    newDoc.setCreator('Document Tools Hub - PDF Splitter');

    const pageIndices = targetPageNumbers.map((p) => p - 1);
    const copiedPages = await newDoc.copyPages(sourceDoc, pageIndices);

    for (let i = 0; i < copiedPages.length; i++) {
      const pNum = targetPageNumbers[i];
      const pageMeta = pages.find((p) => p.pageNumber === pNum);
      const page = copiedPages[i];
      if (pageMeta && pageMeta.rotation !== 0) {
        const curAngle = page.getRotation().angle;
        page.setRotation(degrees((curAngle + pageMeta.rotation) % 360));
      }
      newDoc.addPage(page);
    }

    const pdfBytes = await newDoc.save();
    return {
      type: 'pdf',
      data: pdfBytes,
      filename: `${baseName}_extracted_${targetPageNumbers.length}_pages.pdf`,
    };
  }

  // Mode 2: Split into all individual 1-page PDFs (packaged as ZIP)
  if (config.mode === 'all-individual') {
    const zip = new JSZip();
    const folder = zip.folder(`${baseName}_split_pages`) || zip;

    for (let i = 0; i < totalPages; i++) {
      if (onProgress) {
        onProgress(Math.round(15 + (i / totalPages) * 75), `Generating page ${i + 1} of ${totalPages}...`);
      }

      const singleDoc = await PDFDocument.create();
      const [copiedPage] = await singleDoc.copyPages(sourceDoc, [i]);
      
      const pageMeta = pages[i];
      if (pageMeta && pageMeta.rotation !== 0) {
        const curAngle = copiedPage.getRotation().angle;
        copiedPage.setRotation(degrees((curAngle + pageMeta.rotation) % 360));
      }
      singleDoc.addPage(copiedPage);

      const singleBytes = await singleDoc.save();
      const paddedNum = String(i + 1).padStart(String(totalPages).length, '0');
      folder.file(`${baseName}_page_${paddedNum}.pdf`, singleBytes);
    }

    if (onProgress) onProgress(92, 'Packaging ZIP archive...');
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

    return {
      type: 'zip',
      data: zipBlob,
      filename: `${baseName}_split_individual_pages.zip`,
    };
  }

  // Mode 3: Split into chunks of N pages each (packaged as ZIP)
  if (config.mode === 'chunks') {
    const chunkSize = Math.max(1, config.chunkSize || 2);
    const zip = new JSZip();
    const folder = zip.folder(`${baseName}_chunks_of_${chunkSize}`) || zip;
    const totalChunks = Math.ceil(totalPages / chunkSize);

    for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
      const startPage = chunkIdx * chunkSize;
      const endPage = Math.min(totalPages, startPage + chunkSize);
      const chunkPageIndices = Array.from({ length: endPage - startPage }, (_, k) => startPage + k);

      if (onProgress) {
        onProgress(Math.round(15 + (chunkIdx / totalChunks) * 75), `Exporting chunk ${chunkIdx + 1} of ${totalChunks}...`);
      }

      const chunkDoc = await PDFDocument.create();
      const copiedPages = await chunkDoc.copyPages(sourceDoc, chunkPageIndices);

      for (let i = 0; i < copiedPages.length; i++) {
        const origPageNum = startPage + i + 1;
        const pageMeta = pages.find((p) => p.pageNumber === origPageNum);
        const page = copiedPages[i];
        if (pageMeta && pageMeta.rotation !== 0) {
          const curAngle = page.getRotation().angle;
          page.setRotation(degrees((curAngle + pageMeta.rotation) % 360));
        }
        chunkDoc.addPage(page);
      }

      const chunkBytes = await chunkDoc.save();
      folder.file(`${baseName}_part_${chunkIdx + 1}_(pages_${startPage + 1}-${endPage}).pdf`, chunkBytes);
    }

    if (onProgress) onProgress(92, 'Packaging ZIP archive...');
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

    return {
      type: 'zip',
      data: zipBlob,
      filename: `${baseName}_split_into_${totalChunks}_parts.zip`,
    };
  }

  // Mode 4: Custom Range split into separate files (ZIP)
  const targetPageNumbers = parseRangeString(config.customRange, totalPages);
  const zip = new JSZip();
  const folder = zip.folder(`${baseName}_extracted_ranges`) || zip;

  for (const pNum of targetPageNumbers) {
    const singleDoc = await PDFDocument.create();
    const [copiedPage] = await singleDoc.copyPages(sourceDoc, [pNum - 1]);
    const pageMeta = pages.find((p) => p.pageNumber === pNum);
    if (pageMeta && pageMeta.rotation !== 0) {
      const curAngle = copiedPage.getRotation().angle;
      copiedPage.setRotation(degrees((curAngle + pageMeta.rotation) % 360));
    }
    singleDoc.addPage(copiedPage);
    const bytes = await singleDoc.save();
    folder.file(`${baseName}_page_${pNum}.pdf`, bytes);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return {
    type: 'zip',
    data: zipBlob,
    filename: `${baseName}_selected_pages.zip`,
  };
}

/**
 * Fires celebratory confetti and initiates immediate browser file download.
 */
export function downloadResultFile(data: Uint8Array | Blob, filename: string) {
  try {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.85 },
      colors: ['#3b82f6', '#10b981', '#6366f1', '#f59e0b'],
    });
  } catch (_) {
    // Ignore confetti failure in environments without canvas
  }

  const blob = data instanceof Blob ? data : new Blob([data as any], { type: 'application/pdf' });
  saveAs(blob, filename);
}
