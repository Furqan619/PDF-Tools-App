import { pdfjsLib } from './pdfWorker';
import pptxgen from 'pptxgenjs';
import confetti from 'canvas-confetti';

export interface PptxExportConfig {
  layout: 'LAYOUT_16X9' | 'LAYOUT_4X3';
  exportMode: 'images' | 'text_and_images';
  slideBackground: string;
}

export const DEFAULT_PPTX_CONFIG: PptxExportConfig = {
  layout: 'LAYOUT_16X9',
  exportMode: 'images',
  slideBackground: '#FFFFFF',
};

export interface PdfSlideInfo {
  pageNumber: number;
  imageUrl: string;
  width: number;
  height: number;
  textContent: string;
}

export async function extractPdfPagesForPptx(
  fileBytes: Uint8Array,
  onProgress?: (progress: number, msg: string) => void
): Promise<{ slides: PdfSlideInfo[]; numPages: number }> {
  onProgress?.(10, 'Loading PDF document...');
  const loadingTask = pdfjsLib.getDocument({ data: fileBytes });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  const slides: PdfSlideInfo[] = [];

  for (let i = 1; i <= numPages; i++) {
    onProgress?.(
      Math.round(10 + (i / numPages) * 50),
      `Rendering page ${i} of ${numPages} for presentation...`
    );

    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 }); // High resolution render for crisp slides

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (context) {
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas,
      }).promise;
    }

    const imageUrl = canvas.toDataURL('image/jpeg', 0.92);

    // Extract text content for text-based slide mode
    let textContent = '';
    try {
      const textObj = await page.getTextContent();
      textContent = textObj.items
        .map((item: any) => item.str)
        .filter((str) => str.trim().length > 0)
        .join(' ');
    } catch (e) {
      // ignore
    }

    slides.push({
      pageNumber: i,
      imageUrl,
      width: viewport.width,
      height: viewport.height,
      textContent,
    });
  }

  onProgress?.(70, 'Preparing PowerPoint presentation...');
  return { slides, numPages };
}

export async function generateAndSavePptx(
  slides: PdfSlideInfo[],
  config: PptxExportConfig,
  fileName: string,
  onProgress?: (progress: number, msg: string) => void
): Promise<Blob> {
  onProgress?.(80, 'Building PowerPoint slides with pptxgenjs...');
  const pptx = new pptxgen();
  pptx.layout = config.layout;

  for (let i = 0; i < slides.length; i++) {
    const slideInfo = slides[i];
    const slide = pptx.addSlide();
    slide.background = { color: config.slideBackground };

    if (config.exportMode === 'images') {
      // Add full-bleed image slide
      slide.addImage({
        data: slideInfo.imageUrl,
        x: 0,
        y: 0,
        w: '100%',
        h: '100%',
      });
    } else {
      // Text and image layout: left side title/text, right side image preview
      const titleText = `Page ${slideInfo.pageNumber}`;
      slide.addText(titleText, {
        x: 0.5,
        y: 0.5,
        w: '45%',
        h: 0.8,
        fontSize: 24,
        bold: true,
        color: '363636',
      });

      const bodyText = slideInfo.textContent
        ? slideInfo.textContent.slice(0, 400) + (slideInfo.textContent.length > 400 ? '...' : '')
        : 'No text extracted from this page.';

      slide.addText(bodyText, {
        x: 0.5,
        y: 1.5,
        w: '45%',
        h: 4.5,
        fontSize: 14,
        color: '666666',
      });

      slide.addImage({
        data: slideInfo.imageUrl,
        x: 5.2,
        y: 0.5,
        w: '4.3%',
        h: '90%',
      });
    }
  }

  onProgress?.(95, 'Exporting .pptx file...');
  const pptxBlob = (await pptx.write({ outputType: 'blob' })) as Blob;

  onProgress?.(100, 'PowerPoint presentation generated successfully!');
  confetti({
    particleCount: 90,
    spread: 70,
    origin: { y: 0.6 },
  });

  return pptxBlob;
}
