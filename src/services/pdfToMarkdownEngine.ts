import { pdfjsLib } from './pdfWorker';

export interface PdfToMarkdownOptions {
  includePageBreaks?: boolean;
  detectHeadings?: boolean;
  includePageNumbers?: boolean;
}

/**
 * Converts a PDF file into clean Markdown (.md) text.
 */
export async function convertPdfToMarkdown(
  file: File | ArrayBuffer,
  options: PdfToMarkdownOptions = { includePageBreaks: true, detectHeadings: true, includePageNumbers: true },
  onProgress?: (percent: number, message: string) => void
): Promise<string> {
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;

  if (onProgress) onProgress(10, 'Loading PDF document...');
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  let markdownOutput = `# Converted Markdown Document\n\n`;
  markdownOutput += `> Generated from PDF via PDF to Markdown Pro\n\n--- \n\n`;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const progress = Math.round(15 + (pageNum / totalPages) * 75);
    if (onProgress) onProgress(progress, `Parsing page ${pageNum} of ${totalPages}...`);

    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    let textItems: Array<{ str: string; x: number; y: number; fontSize: number; fontName: string }> = [];

    for (const item of textContent.items as any[]) {
      if ('str' in item && item.str.trim()) {
        const tx = item.transform;
        const x = tx ? tx[4] : 0;
        const y = tx ? tx[5] : 0;
        const fontSize = tx ? Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]) : 12;
        const fontName = item.fontName || '';
        textItems.push({
          str: item.str,
          x,
          y,
          fontSize,
          fontName,
        });
      }
    }

    // Sort top-to-bottom (descending y)
    textItems.sort((a, b) => {
      if (Math.abs(b.y - a.y) > 4) {
        return b.y - a.y;
      }
      return a.x - b.x;
    });

    if (options.includePageBreaks && pageNum > 1) {
      markdownOutput += `\n\n---\n\n`;
    }

    if (options.includePageNumbers) {
      markdownOutput += `*--- Page ${pageNum} ---*\n\n`;
    }

    let lastY: number | null = null;
    let currentLine = '';
    let maxFontSizeOnLine = 12;

    for (const item of textItems) {
      if (lastY === null || Math.abs(item.y - lastY) > 5) {
        if (currentLine) {
          markdownOutput += formatLineToMarkdown(currentLine, maxFontSizeOnLine, options.detectHeadings) + '\n';
        }
        currentLine = item.str;
        maxFontSizeOnLine = item.fontSize;
        lastY = item.y;
      } else {
        currentLine += (currentLine.endsWith(' ') || item.str.startsWith(' ') ? '' : ' ') + item.str;
        if (item.fontSize > maxFontSizeOnLine) {
          maxFontSizeOnLine = item.fontSize;
        }
      }
    }

    if (currentLine) {
      markdownOutput += formatLineToMarkdown(currentLine, maxFontSizeOnLine, options.detectHeadings) + '\n';
    }
  }

  if (onProgress) onProgress(100, 'Markdown conversion complete!');
  return markdownOutput;
}

function formatLineToMarkdown(text: string, fontSize: number, detectHeadings: boolean): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  if (detectHeadings) {
    if (fontSize > 18 || (trimmed.length < 60 && fontSize > 15 && !trimmed.endsWith('.'))) {
      return `\n## ${trimmed}\n`;
    } else if (fontSize > 14 || (trimmed.length < 50 && fontSize > 12 && !trimmed.endsWith('.'))) {
      return `\n### ${trimmed}\n`;
    }
  }

  // Check if bullet point
  if (/^[\u2022\*\-\–]\s+/.test(trimmed)) {
    return `- ${trimmed.replace(/^[\u2022\*\-\–]\s+/, '')}`;
  }

  // Check if numbered list
  if (/^\d+[\.\)]\s+/.test(trimmed)) {
    return `${trimmed}`;
  }

  return `${trimmed}\n`;
}
