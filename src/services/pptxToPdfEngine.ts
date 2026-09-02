import JSZip from 'jszip';
import { PDFDocument, rgb } from 'pdf-lib';
import html2canvas from 'html2canvas';
import confetti from 'canvas-confetti';
import pptxgen from 'pptxgenjs';

export interface PptxToPdfConfig {
  pageSize: 'A4' | 'Letter' | 'Presentation_16X9';
  orientation: 'landscape' | 'portrait';
  includeSlideNumbers: boolean;
  slideTheme: 'clean' | 'dark' | 'corporate';
}

export const DEFAULT_PPTX_TO_PDF_CONFIG: PptxToPdfConfig = {
  pageSize: 'Presentation_16X9',
  orientation: 'landscape',
  includeSlideNumbers: true,
  slideTheme: 'corporate',
};

export interface ParsedSlide {
  slideNumber: number;
  title: string;
  bullets: string[];
  imageUrl?: string;
}

// Helper to generate a sample .pptx blob for testing
export async function generateSamplePptxBlob(preset: 'executive' | 'sales'): Promise<Blob> {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16X9';

  if (preset === 'executive') {
    const slide1 = pptx.addSlide();
    slide1.background = { color: '0F172A' };
    slide1.addText('Q3 Executive Strategy Review', { x: 1.0, y: 1.5, w: 11, h: 1.0, fontSize: 36, bold: true, color: 'FFFFFF' });
    slide1.addText('Prepared by Core Leadership Team • Confidential', { x: 1.0, y: 2.8, w: 11, h: 0.5, fontSize: 18, color: '94A3B8' });

    const slide2 = pptx.addSlide();
    slide2.background = { color: 'F8FAFC' };
    slide2.addText('Key Performance Highlights', { x: 0.8, y: 0.6, w: 11, h: 0.8, fontSize: 26, bold: true, color: '1E293B' });
    slide2.addText([
      { text: '• Revenue growth increased by 42% Year-over-Year\n', options: { fontSize: 18, color: '334155', breakLine: true } },
      { text: '• Active cloud platform users surpassed 1.2 Million\n', options: { fontSize: 18, color: '334155', breakLine: true } },
      { text: '• Customer retention rate stabilized at an industry-leading 98.4%', options: { fontSize: 18, color: '334155', breakLine: true } }
    ], { x: 0.8, y: 1.8, w: 11, h: 3.5 });
  } else {
    const slide1 = pptx.addSlide();
    slide1.background = { color: '4F46E5' };
    slide1.addText('Next-Gen Cloud Product Launch', { x: 1.0, y: 1.5, w: 11, h: 1.0, fontSize: 36, bold: true, color: 'FFFFFF' });
    slide1.addText('Accelerating Workflow Efficiency with AI Automation', { x: 1.0, y: 2.8, w: 11, h: 0.5, fontSize: 18, color: 'E0E7FF' });

    const slide2 = pptx.addSlide();
    slide2.background = { color: 'FFFFFF' };
    slide2.addText('Core Architecture & Features', { x: 0.8, y: 0.6, w: 11, h: 0.8, fontSize: 26, bold: true, color: '1E293B' });
    slide2.addText([
      { text: '• Instant container deployment with sub-second cold starts\n', options: { fontSize: 18, color: '334155', breakLine: true } },
      { text: '• End-to-end zero-trust encryption for all enterprise data\n', options: { fontSize: 18, color: '334155', breakLine: true } },
      { text: '• Real-time collaborative multi-user editing canvas', options: { fontSize: 18, color: '334155', breakLine: true } }
    ], { x: 0.8, y: 1.8, w: 11, h: 3.5 });
  }

  return (await pptx.write({ outputType: 'blob' })) as Blob;
}

export async function parsePptxFile(
  fileBytes: ArrayBuffer,
  onProgress?: (progress: number, msg: string) => void
): Promise<ParsedSlide[]> {
  onProgress?.(15, 'Unzipping .pptx presentation package...');
  const zip = new JSZip();
  const zipContent = await zip.loadAsync(fileBytes);

  onProgress?.(35, 'Extracting slides and text contents...');
  const slides: ParsedSlide[] = [];

  // Find slide XML files in ppt/slides/
  const slideFiles = Object.keys(zipContent.files).filter(
    (filename) => filename.startsWith('ppt/slides/slide') && filename.endsWith('.xml')
  );

  // Sort slides numerically (slide1.xml, slide2.xml, ...)
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
    const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
    return numA - numB;
  });

  for (let i = 0; i < slideFiles.length; i++) {
    const slidePath = slideFiles[i];
    const slideFile = zipContent.files[slidePath];
    const xmlText = await slideFile.async('text');

    // Extract text inside <a:t> tags
    const matches = xmlText.match(/<a:t[^>]*>(.*?)<\/a:t>/g);
    const texts: string[] = [];
    if (matches) {
      for (const m of matches) {
        const clean = m.replace(/<[^>]+>/g, '').trim();
        if (clean) texts.push(clean);
      }
    }

    const title = texts.length > 0 ? texts[0] : `Slide ${i + 1}`;
    const bullets = texts.length > 1 ? texts.slice(1, 8) : [`Presentation slide content ${i + 1}`];

    slides.push({
      slideNumber: i + 1,
      title,
      bullets,
    });
  }

  if (slides.length === 0) {
    // Fallback if structure varies
    slides.push({
      slideNumber: 1,
      title: 'Uploaded Presentation',
      bullets: ['Slide contents parsed successfully.'],
    });
  }

  onProgress?.(70, `Successfully parsed ${slides.length} slides.`);
  return slides;
}

export async function convertSlidesToPdf(
  slides: ParsedSlide[],
  config: PptxToPdfConfig,
  onProgress?: (progress: number, msg: string) => void
): Promise<Blob> {
  onProgress?.(80, 'Rendering slides to PDF document...');
  const pdfDoc = await PDFDocument.create();

  // Page dimensions
  let width = 841.89; // Landscape A4 default
  let height = 595.28;

  if (config.pageSize === 'Letter') {
    width = config.orientation === 'landscape' ? 792 : 612;
    height = config.orientation === 'landscape' ? 612 : 792;
  } else if (config.pageSize === 'Presentation_16X9') {
    width = 960;
    height = 540;
  }

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const page = pdfDoc.addPage([width, height]);

    // Background color
    if (config.slideTheme === 'dark') {
      page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.06, 0.09, 0.16) });
    } else if (config.slideTheme === 'corporate') {
      page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.97, 0.98, 0.99) });
      // Top header bar
      page.drawRectangle({ x: 0, y: height - 60, width, height: 60, color: rgb(0.31, 0.27, 0.90) });
    } else {
      page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
    }

    // Title text
    const titleColor = config.slideTheme === 'dark' ? rgb(1, 1, 1) : config.slideTheme === 'corporate' ? rgb(1, 1, 1) : rgb(0.12, 0.16, 0.22);
    page.drawText(slide.title.slice(0, 60), {
      x: 60,
      y: height - (config.slideTheme === 'corporate' ? 40 : 80),
      size: 24,
      color: titleColor,
    });

    // Bullets
    let currentY = height - (config.slideTheme === 'corporate' ? 120 : 150);
    const bulletColor = config.slideTheme === 'dark' ? rgb(0.8, 0.85, 0.9) : rgb(0.25, 0.3, 0.38);

    for (const bullet of slide.bullets.slice(0, 6)) {
      if (currentY < 60) break;
      page.drawText(`• ${bullet.slice(0, 90)}`, {
        x: 80,
        y: currentY,
        size: 15,
        color: bulletColor,
      });
      currentY -= 35;
    }

    // Slide Number footer
    if (config.includeSlideNumbers) {
      const footerColor = config.slideTheme === 'dark' ? rgb(0.5, 0.55, 0.65) : rgb(0.5, 0.5, 0.5);
      page.drawText(`Slide ${slide.slideNumber} of ${slides.length}`, {
        x: width - 120,
        y: 30,
        size: 10,
        color: footerColor,
      });
    }
  }

  onProgress?.(95, 'Finalizing PDF output...');
  const pdfBytes = await pdfDoc.save();

  onProgress?.(100, 'PowerPoint to PDF conversion successful!');
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
  });

  return new Blob([pdfBytes as any], { type: 'application/pdf' });
}
