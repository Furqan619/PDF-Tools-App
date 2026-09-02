import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import confetti from 'canvas-confetti';
import { 
  QueueItem, 
  ConversionSettings, 
  ConvertedDocumentResult,
  ProcessingMetrics 
} from '../types';
import { extractPdfDocument } from './pdfExtractor';
import { generateDocxFromExtractedPages } from './docxGenerator';

export const DEFAULT_SETTINGS: ConversionSettings = {
  mode: 'high-fidelity',
  imageHandling: 'compress',
  detectTables: true,
  preservePageBreaks: true,
  pageRange: 'all',
  fontFamily: 'Calibri',
  baseFontSizePt: 11,
  lineSpacingRatio: 1.15,
  extractImagesMaxResolution: 1200,
};

/**
 * Converts a single QueueItem with real-time progress and cancellation support
 */
export async function convertSingleFile(
  item: QueueItem,
  onUpdate: (updated: Partial<QueueItem>) => void
): Promise<ConvertedDocumentResult> {
  const abortController = new AbortController();
  const startTime = Date.now();

  onUpdate({
    status: 'reading',
    progress: 5,
    currentStepMessage: 'Loading PDF data...',
    startedAt: startTime,
    abortController,
    error: undefined,
  });

  try {
    // 1. Extract PDF contents
    const extractedPages = await extractPdfDocument(
      item.file,
      item.settings,
      (p) => {
        onUpdate({
          status: 'extracting',
          progress: p.percent,
          currentPage: p.currentPage,
          totalPages: p.totalPages,
          currentStepMessage: p.message,
        });
      },
      abortController.signal
    );

    // 2. Generate DOCX Blob
    onUpdate({
      status: 'generating',
      progress: 75,
      currentStepMessage: 'Synthesizing Microsoft Word OpenXML structure...',
    });

    const docxBlob = await generateDocxFromExtractedPages(
      extractedPages,
      item.settings,
      (p) => {
        onUpdate({
          progress: p.percent,
          currentStepMessage: p.message,
        });
      },
      abortController.signal
    );

    const endTime = Date.now();
    const durationMs = endTime - startTime;
    const baseName = item.name.replace(/\.[^/.]+$/, '');
    const outFileName = `${baseName}.docx`;

    const result: ConvertedDocumentResult = {
      docxBlob,
      fileName: outFileName,
      pageCount: extractedPages.length,
      fileSizeBytes: docxBlob.size,
      durationMs,
      extractedPages,
    };

    onUpdate({
      status: 'completed',
      progress: 100,
      currentStepMessage: 'Conversion completed successfully!',
      completedAt: endTime,
      result,
      currentPage: extractedPages.length,
      totalPages: extractedPages.length,
    });

    // Subtle celebration
    try {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch {
      // ignore
    }

    return result;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      onUpdate({
        status: 'cancelled',
        progress: 0,
        currentStepMessage: 'Conversion cancelled',
      });
      throw err;
    }

    const errorMessage = err instanceof Error ? err.message : 'Unknown error during conversion';
    onUpdate({
      status: 'error',
      progress: 0,
      currentStepMessage: `Failed: ${errorMessage}`,
      error: errorMessage,
    });
    throw err;
  }
}

/**
 * Downloads a single converted DOCX file
 */
export function downloadDocxResult(result: ConvertedDocumentResult) {
  saveAs(result.docxBlob, result.fileName);
}

/**
 * Zips and downloads all completed files in the queue
 */
export async function downloadAllCompletedAsZip(items: QueueItem[], zipFileName = 'converted_word_documents.zip') {
  const completedItems = items.filter(i => i.status === 'completed' && i.result);
  if (completedItems.length === 0) return;

  if (completedItems.length === 1) {
    downloadDocxResult(completedItems[0].result!);
    return;
  }

  const zip = new JSZip();
  completedItems.forEach((item) => {
    if (item.result) {
      zip.file(item.result.fileName, item.result.docxBlob);
    }
  });

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, zipFileName);
}

/**
 * Helper to calculate aggregate metrics
 */
export function calculateMetrics(items: QueueItem[]): ProcessingMetrics {
  const totalFiles = items.length;
  const completed = items.filter(i => i.status === 'completed' && i.result);
  const completedFiles = completed.length;
  
  let totalBytesProcessed = 0;
  let totalPagesProcessed = 0;
  let totalDurationSec = 0;

  for (const item of completed) {
    if (item.result) {
      totalBytesProcessed += item.file.size;
      totalPagesProcessed += item.result.pageCount;
      totalDurationSec += (item.result.durationMs / 1000);
    }
  }

  const averageSpeedPagesPerSec = totalDurationSec > 0 
    ? Number((totalPagesProcessed / totalDurationSec).toFixed(1)) 
    : 0;

  return {
    totalFiles,
    completedFiles,
    totalBytesProcessed,
    totalPagesProcessed,
    averageSpeedPagesPerSec,
  };
}

/**
 * Format bytes into human readable format (KB, MB, GB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Format duration in seconds/ms
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = (ms / 1000).toFixed(1);
  return `${sec}s`;
}
