import { pdfjsLib } from './pdfWorker';
import { parsePageRange } from './pdfExtractor';
import { ConversionSettings } from '../types';

export interface PdfToHtmlOptions {
  themeStyle: 'modern' | 'invoice' | 'article' | 'raw';
  includeStyles: boolean;
  extractImages: boolean;
}

/**
 * Converts a PDF file buffer into clean HTML markup.
 */
export async function convertPdfToHtml(
  file: File | ArrayBuffer,
  options: PdfToHtmlOptions,
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

  let allPagesHtml = '';

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const progress = Math.round(15 + (pageNum / totalPages) * 75);
    if (onProgress) onProgress(progress, `Extracting text and structure from page ${pageNum} of ${totalPages}...`);

    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    let pageTextBlocks: Array<{ str: string; y: number; x: number; fontSize: number }> = [];

    for (const item of textContent.items as any[]) {
      if ('str' in item && item.str.trim()) {
        const tx = item.transform;
        // tx[4] is x, tx[5] is y
        const x = tx ? tx[4] : 0;
        const y = tx ? tx[5] : 0;
        const fontSize = tx ? Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]) : 12;
        pageTextBlocks.push({
          str: item.str,
          x,
          y,
          fontSize,
        });
      }
    }

    // Sort blocks top-to-bottom (descending y in PDF coordinates, or group by lines)
    pageTextBlocks.sort((a, b) => {
      if (Math.abs(b.y - a.y) > 5) {
        return b.y - a.y; // higher y first
      }
      return a.x - b.x; // left to right
    });

    // Group into lines or paragraphs
    let pageHtml = `<div class="pdf-page" data-page="${pageNum}" style="margin-bottom: 40px; padding: 40px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-radius: 8px;">\n`;
    pageHtml += `  <div class="page-header" style="font-size: 11px; color: #64748b; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Page ${pageNum} of ${totalPages}</div>\n`;

    let lastY = null;
    let currentLineText = '';

    for (const block of pageTextBlocks) {
      if (lastY === null || Math.abs(block.y - lastY) > 6) {
        if (currentLineText) {
          const isHeading = currentLineText.length < 80 && !currentLineText.endsWith('.');
          if (isHeading && currentLineText.length < 50) {
            pageHtml += `  <h3 style="margin: 16px 0 8px 0; font-size: 18px; font-weight: bold; color: #1e293b;">${escapeHtml(currentLineText)}</h3>\n`;
          } else {
            pageHtml += `  <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.6; color: #334155;">${escapeHtml(currentLineText)}</p>\n`;
          }
        }
        currentLineText = block.str;
        lastY = block.y;
      } else {
        currentLineText += (currentLineText.endsWith(' ') || block.str.startsWith(' ') ? '' : ' ') + block.str;
      }
    }

    if (currentLineText) {
      pageHtml += `  <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.6; color: #334155;">${escapeHtml(currentLineText)}</p>\n`;
    }

    pageHtml += `</div>\n`;
    allPagesHtml += pageHtml;
  }

  if (onProgress) onProgress(95, 'Assembling complete HTML document...');

  const fullHtml = generateFullHtmlWrapper(allPagesHtml, options.themeStyle);
  if (onProgress) onProgress(100, 'PDF successfully converted to HTML!');

  return fullHtml;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateFullHtmlWrapper(bodyContent: string, theme: string): string {
  let themeCss = '';
  if (theme === 'invoice') {
    themeCss = `
      body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; padding: 40px; }
      .container { max-width: 800px; margin: 0 auto; }
      .pdf-page { border: 1px solid #cbd5e1; border-radius: 12px; background: #ffffff !important; }
    `;
  } else if (theme === 'article') {
    themeCss = `
      body { font-family: Georgia, serif; background: #fefefe; color: #111827; padding: 40px; line-height: 1.8; }
      .container { max-width: 700px; margin: 0 auto; }
      .pdf-page { border: 1px solid #e5e7eb; border-radius: 4px; background: #ffffff !important; box-shadow: none !important; }
    `;
  } else {
    // modern
    themeCss = `
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; }
      .container { max-width: 900px; margin: 0 auto; }
      .pdf-page { background: #ffffff !important; color: #1e293b !important; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); }
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Converted PDF Webpage</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; }
    ${themeCss}
  </style>
</head>
<body>
  <div class="container">
    <header style="margin-bottom: 30px; text-align: center;">
      <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 8px;">Converted Webpage Document</h1>
      <p style="font-size: 13px; opacity: 0.8;">Generated via PDF to HTML Pro • Responsive Web Layout</p>
    </header>
    ${bodyContent}
  </div>
</body>
</html>`;
}
