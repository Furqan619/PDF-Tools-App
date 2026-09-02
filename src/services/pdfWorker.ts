import * as pdfjsLib from 'pdfjs-dist';

// In Vite, we can directly import the worker as a URL or use new URL()
// so it matches the exact pdfjs-dist version bundled with the app
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch (e) {
  // Fallback to unpkg/jsdelivr with matching version and .mjs extension
  const ver = pdfjsLib.version || '4.0.379';
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${ver}/build/pdf.worker.min.mjs`;
}

export function initPdfWorker() {
  if (typeof window === 'undefined') return;
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    const ver = pdfjsLib.version || '4.0.379';
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${ver}/build/pdf.worker.min.mjs`;
  }
}

export { pdfjsLib };
