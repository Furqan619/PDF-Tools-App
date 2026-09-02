import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { pdfjsLib } from './pdfWorker';
import confetti from 'canvas-confetti';

export interface PdfAnnotation {
  id: string;
  pageNumber: number;
  type: 'text' | 'highlight' | 'stamp';
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

export async function addAnnotationsToPdf(
  originalPdfBytes: ArrayBuffer,
  annotations: PdfAnnotation[],
  onProgress?: (progress: number, msg: string) => void
): Promise<Blob> {
  onProgress?.(30, 'Loading PDF document for editing...');
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  onProgress?.(60, 'Applying edits and annotations...');

  for (const ann of annotations) {
    const pageIndex = ann.pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page = pages[pageIndex];
    const { height } = page.getSize();

    // Convert screen coordinates to PDF coordinate system (bottom-left origin)
    const pdfY = height - ann.y;

    if (ann.type === 'text' || ann.type === 'stamp') {
      page.drawText(ann.text, {
        x: ann.x,
        y: pdfY,
        size: ann.fontSize || 14,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
    } else if (ann.type === 'highlight') {
      page.drawRectangle({
        x: ann.x,
        y: pdfY - 10,
        width: Math.max(80, ann.text.length * 7),
        height: 16,
        color: rgb(1, 0.9, 0.3),
        opacity: 0.5,
      });
      page.drawText(ann.text, {
        x: ann.x + 2,
        y: pdfY - 8,
        size: 11,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
    }
  }

  onProgress?.(90, 'Saving modified PDF document...');
  const pdfBytes = await pdfDoc.save();

  onProgress?.(100, 'PDF edited successfully!');
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
  });

  return new Blob([pdfBytes as any], { type: 'application/pdf' });
}
