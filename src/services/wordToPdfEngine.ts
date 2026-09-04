import JSZip from 'jszip';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { saveAs } from 'file-saver';

export interface WordParagraph {
  text: string;
  isHeading: boolean;
  headingLevel?: number;
}

export interface ParsedWordDocument {
  title: string;
  paragraphs: WordParagraph[];
  wordCount: number;
  paragraphCount: number;
}

/**
 * Parses a Word (.docx) file buffer and extracts paragraphs and headings.
 */
export async function parseWordDocument(
  arrayBuffer: ArrayBuffer,
  onProgress?: (percent: number, message: string) => void
): Promise<ParsedWordDocument> {
  if (onProgress) onProgress(15, 'Unzipping Word document OpenXML archive...');
  const zip = new JSZip();
  const zipContent = await zip.loadAsync(arrayBuffer);

  if (!zipContent.files['word/document.xml']) {
    throw new Error('Invalid Word document (.docx): missing word/document.xml');
  }

  if (onProgress) onProgress(45, 'Parsing document XML structure...');
  const documentXml = await zipContent.files['word/document.xml'].async('text');
  
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(documentXml, 'text/xml');

  const pNodes = xmlDoc.getElementsByTagName('w:p');
  const paragraphs: WordParagraph[] = [];
  let wordCount = 0;
  let detectedTitle = 'Converted Word Document';

  for (let i = 0; i < pNodes.length; i++) {
    const pNode = pNodes[i];
    const rNodes = pNode.getElementsByTagName('w:r');
    let pText = '';

    for (let j = 0; j < rNodes.length; j++) {
      const tNodes = rNodes[j].getElementsByTagName('w:t');
      for (let k = 0; k < tNodes.length; k++) {
        pText += tNodes[k].textContent || '';
      }
    }

    const trimmed = pText.trim();
    if (trimmed) {
      // Check if heading style or large bold
      const pPr = pNode.getElementsByTagName('w:pPr')[0];
      let isHeading = false;
      let headingLevel = 0;

      if (pPr) {
        const pStyle = pPr.getElementsByTagName('w:pStyle')[0];
        if (pStyle) {
          const val = pStyle.getAttribute('w:val') || '';
          if (val.toLowerCase().includes('heading1') || val === '1') {
            isHeading = true;
            headingLevel = 1;
          } else if (val.toLowerCase().includes('heading2') || val === '2') {
            isHeading = true;
            headingLevel = 2;
          } else if (val.toLowerCase().includes('title')) {
            isHeading = true;
            headingLevel = 1;
            detectedTitle = trimmed;
          }
        }
      }

      // Heuristic for heading if short and first paragraph
      if (!isHeading && i < 3 && trimmed.length < 80 && !trimmed.endsWith('.')) {
        if (i === 0) {
          isHeading = true;
          headingLevel = 1;
          detectedTitle = trimmed;
        }
      }

      paragraphs.push({
        text: trimmed,
        isHeading,
        headingLevel,
      });

      wordCount += trimmed.split(/\s+/).filter(Boolean).length;
    }
  }

  if (paragraphs.length === 0) {
    paragraphs.push({
      text: 'No readable text content found in this document.',
      isHeading: false,
    });
  }

  if (onProgress) onProgress(100, 'Word document parsed successfully!');

  return {
    title: detectedTitle,
    paragraphs,
    wordCount,
    paragraphCount: paragraphs.length,
  };
}

/**
 * Converts parsed Word document into a professional PDF blob using pdf-lib.
 */
export async function convertWordToPdf(
  docData: ParsedWordDocument,
  options: {
    fontSize?: number;
    lineSpacing?: number;
    includeHeaderFooter?: boolean;
    primaryColorHex?: string;
  },
  onProgress?: (percent: number, message: string) => void
): Promise<Blob> {
  if (onProgress) onProgress(10, 'Initializing PDF document layout...');
  
  const pdfDoc = await PDFDocument.create();
  const timesFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const fontSize = options.fontSize || 11;
  const lineSpacing = options.lineSpacing || 1.4;
  const includeHeaderFooter = options.includeHeaderFooter ?? true;

  let page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const margin = 54; // 0.75 in
  const contentWidth = width - margin * 2;
  
  let y = height - margin;
  let pageNum = 1;

  const drawHeaderFooter = (p: typeof page, pNum: number) => {
    if (!includeHeaderFooter) return;
    // Header
    p.drawText(docData.title.substring(0, 50), {
      x: margin,
      y: height - 30,
      size: 8,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });
    p.drawLine({
      start: { x: margin, y: height - 36 },
      end: { x: width - margin, y: height - 36 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });

    // Footer
    p.drawLine({
      start: { x: margin, y: 40 },
      end: { x: width - margin, y: 40 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    p.drawText(`Page ${pNum}`, {
      x: width - margin - 30,
      y: 25,
      size: 9,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });
    p.drawText('Converted via Word to PDF Pro', {
      x: margin,
      y: 25,
      size: 9,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });
  };

  drawHeaderFooter(page, pageNum);
  y -= 20; // Header offset

  if (onProgress) onProgress(40, 'Rendering paragraphs and headings into PDF...');

  for (let idx = 0; idx < docData.paragraphs.length; idx++) {
    const p = docData.paragraphs[idx];
    const isHead = p.isHeading;
    const font = isHead ? helveticaBold : timesFont;
    const fSize = isHead ? (p.headingLevel === 1 ? 18 : 14) : fontSize;
    const lineHeight = fSize * lineSpacing;

    // Word wrap text
    const words = p.text.split(' ');
    let currentLine = '';
    const lines: string[] = [];

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const textWidth = font.widthOfTextAtSize(testLine, fSize);
      if (textWidth > contentWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    // Check space on page
    const totalBlockHeight = lines.length * lineHeight + (isHead ? 16 : 10);
    if (y - totalBlockHeight < margin + 40) {
      page = pdfDoc.addPage([595.28, 841.89]);
      pageNum++;
      drawHeaderFooter(page, pageNum);
      y = height - margin - 20;
    }

    if (isHead) {
      y -= 12;
    }

    for (const line of lines) {
      page.drawText(line, {
        x: margin,
        y,
        size: fSize,
        font,
        color: isHead ? rgb(0.1, 0.1, 0.1) : rgb(0.2, 0.2, 0.2),
      });
      y -= lineHeight;
    }

    y -= isHead ? 8 : 6; // paragraph spacing
  }

  if (onProgress) onProgress(90, 'Finalizing PDF document...');
  const pdfBytes = await pdfDoc.save();
  if (onProgress) onProgress(100, 'PDF generation complete!');

  return new Blob([pdfBytes as Uint8Array], { type: 'application/pdf' });
}

/**
 * Generates a sample Word (.docx) blob for testing.
 */
export async function generateSampleWordBlob(): Promise<Blob> {
  const zip = new JSZip();
  
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Executive Business Proposal &amp; Q3 Strategy</w:t></w:r></w:p>
    <w:p><w:r><w:t>This official executive document outlines the primary strategic initiatives, milestone deliverables, and projected financial growth targets for the upcoming fiscal quarter.</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>1. Core Objectives &amp; Key Results</w:t></w:r></w:p>
    <w:p><w:r><w:t>Our primary objective is to accelerate cloud infrastructure resilience while optimizing client onboarding latency across enterprise tiers. Team leads are expected to enforce strict code review standards and automated CI/CD pipeline checks.</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>2. Budget Allocation &amp; Resource Planning</w:t></w:r></w:p>
    <w:p><w:r><w:t>Budget distribution will prioritize security hardening, automated compliance auditing, and developer tooling licenses. All department heads must submit itemized expenditure forecasts by Friday close of business.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Confidentiality Notice: This document contains proprietary corporate data intended solely for authorized personnel and executive board members.</w:t></w:r></w:p>
  </w:body>
</w:document>`;

  zip.file('word/document.xml', documentXml);
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');

  const content = await zip.generateAsync({ type: 'blob' });
  return content;
}
