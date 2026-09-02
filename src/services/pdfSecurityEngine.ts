import { PDFDocument, rgb, degrees, StandardFonts, PDFPage, PDFImage } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { pdfjsLib } from './pdfWorker';

export type WatermarkMode = 'diagonal_center' | 'tiled_grid' | 'header_footer' | 'custom_pos';
export type WatermarkLayer = 'above' | 'below';
export type StampType = 'approved' | 'confidential' | 'rejected' | 'verified' | 'paid' | 'urgent' | 'official' | 'custom';
export type SignatureType = 'draw' | 'type' | 'upload';

export interface TextWatermarkConfig {
  enabled: boolean;
  text: string;
  fontFamily: 'HelveticaBold' | 'TimesRomanBold' | 'CourierBold';
  fontSize: number;
  color: string; // hex color e.g. '#ef4444'
  opacity: number; // 0.05 to 0.95
  rotation: number; // degrees e.g. 45
  mode: WatermarkMode;
  layer: WatermarkLayer;
  pageRange: string; // 'all', '1', '1-3', etc.
  tileSpacingX?: number;
  tileSpacingY?: number;
}

export interface StampWatermarkConfig {
  enabled: boolean;
  type: StampType;
  customText?: string;
  customImageFile?: File | null;
  customImageDataUrl?: string | null;
  color: string;
  opacity: number;
  scale: number; // 0.5 to 2.0
  rotation: number;
  position: 'top-right' | 'bottom-right' | 'center' | 'bottom-left' | 'top-left' | 'custom';
  posXPercent?: number; // 0-100
  posYPercent?: number; // 0-100
  pageRange: string;
  layer: WatermarkLayer;
}

export interface SignatureConfig {
  enabled: boolean;
  type: SignatureType;
  dataUrl: string | null; // PNG data URL from canvas or upload
  signerName: string;
  includeDate: boolean;
  dateString: string;
  includeSignerInfo: boolean;
  reason: string;
  targetPage: number; // 1-indexed
  posXPercent: number; // 0-100
  posYPercent: number; // 0-100
  width: number; // width in points
  height: number;
  inkColor: string;
}

export interface RedactionBox {
  id: string;
  pageNumber: number;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  label?: string;
}

export interface MetadataSanitationConfig {
  stripMetadata: boolean;
  customTitle?: string;
  customAuthor?: string;
  customSubject?: string;
  customKeywords?: string;
}

export interface SecurityProcessingConfig {
  textWatermark: TextWatermarkConfig;
  stampWatermark: StampWatermarkConfig;
  signature: SignatureConfig;
  redactions: RedactionBox[];
  metadata: MetadataSanitationConfig;
  outputFilename: string;
}

export const DEFAULT_TEXT_WATERMARK: TextWatermarkConfig = {
  enabled: true,
  text: 'CONFIDENTIAL',
  fontFamily: 'HelveticaBold',
  fontSize: 54,
  color: '#ef4444',
  opacity: 0.28,
  rotation: 45,
  mode: 'diagonal_center',
  layer: 'above',
  pageRange: 'all',
  tileSpacingX: 200,
  tileSpacingY: 160,
};

export const DEFAULT_STAMP_WATERMARK: StampWatermarkConfig = {
  enabled: false,
  type: 'confidential',
  customText: 'CONFIDENTIAL',
  customImageFile: null,
  customImageDataUrl: null,
  color: '#dc2626',
  opacity: 0.85,
  scale: 1.0,
  rotation: -12,
  position: 'top-right',
  posXPercent: 78,
  posYPercent: 12,
  pageRange: 'all',
  layer: 'above',
};

export const DEFAULT_SIGNATURE: SignatureConfig = {
  enabled: false,
  type: 'type',
  dataUrl: null,
  signerName: 'Alexander Vance',
  includeDate: true,
  dateString: new Date().toISOString().split('T')[0],
  includeSignerInfo: true,
  reason: 'Approved & Formally Verified',
  targetPage: 1,
  posXPercent: 62,
  posYPercent: 78,
  width: 170,
  height: 65,
  inkColor: '#1e40af',
};

export const DEFAULT_METADATA_CONFIG: MetadataSanitationConfig = {
  stripMetadata: true,
  customTitle: '',
  customAuthor: '',
  customSubject: '',
  customKeywords: '',
};

export const DEFAULT_SECURITY_CONFIG: SecurityProcessingConfig = {
  textWatermark: DEFAULT_TEXT_WATERMARK,
  stampWatermark: DEFAULT_STAMP_WATERMARK,
  signature: DEFAULT_SIGNATURE,
  redactions: [],
  metadata: DEFAULT_METADATA_CONFIG,
  outputFilename: 'Secured_Document.pdf',
};

/**
 * Converts Hex string to PDFLib RGB object
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return { r, g, b };
}

/**
 * Parses user-entered page ranges like "all", "1, 3, 5-7"
 */
export function parseTargetPages(rangeStr: string, totalPages: number): number[] {
  if (!rangeStr || rangeStr.trim().toLowerCase() === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (rangeStr.trim().toLowerCase() === 'first') return [1];
  if (rangeStr.trim().toLowerCase() === 'last') return [totalPages];
  if (rangeStr.trim().toLowerCase() === 'odd') {
    return Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 1);
  }
  if (rangeStr.trim().toLowerCase() === 'even') {
    return Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 0);
  }

  const pagesSet = new Set<number>();
  const parts = rangeStr.split(/[,;\s]+/).filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.max(1, Math.min(start, end));
        const max = Math.min(totalPages, Math.max(start, end));
        for (let p = min; p <= max; p++) {
          pagesSet.add(p);
        }
      }
    } else {
      const p = parseInt(part, 10);
      if (!isNaN(p) && p >= 1 && p <= totalPages) {
        pagesSet.add(p);
      }
    }
  }

  const res = Array.from(pagesSet).sort((a, b) => a - b);
  return res.length > 0 ? res : Array.from({ length: totalPages }, (_, i) => i + 1);
}

/**
 * Renders an official graphic stamp onto an HTML canvas and returns a PNG Data URL
 */
export function generateGraphicStampDataUrl(
  type: StampType,
  customText: string = '',
  colorHex: string = '#dc2626'
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let mainText = 'CONFIDENTIAL';
  let subText = 'VERIFIED DOCUMENT';

  switch (type) {
    case 'approved':
      mainText = 'APPROVED';
      subText = 'PASSED COMPLIANCE & LEGAL';
      break;
    case 'rejected':
      mainText = 'REJECTED';
      subText = 'DO NOT EXECUTE';
      break;
    case 'paid':
      mainText = 'PAID IN FULL';
      subText = 'TRANSACTION COMPLETED';
      break;
    case 'urgent':
      mainText = 'URGENT';
      subText = 'PRIORITY ACTION REQUIRED';
      break;
    case 'official':
      mainText = 'OFFICIAL SEAL';
      subText = 'AUTHORIZED REPOSITORY';
      break;
    case 'verified':
      mainText = 'VERIFIED';
      subText = 'IDENTITY & CERTIFICATE CONFIRMED';
      break;
    case 'custom':
      mainText = customText.toUpperCase() || 'STAMP';
      subText = 'OFFICIAL AUDIT';
      break;
    case 'confidential':
    default:
      mainText = 'CONFIDENTIAL';
      subText = 'STRICTLY PROPRIETARY';
      break;
  }

  // Draw double rounded stamp rectangle
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 6;
  roundRect(ctx, 10, 10, 380, 140, 16);
  ctx.stroke();

  ctx.lineWidth = 2;
  roundRect(ctx, 20, 20, 360, 120, 10);
  ctx.stroke();

  // Primary Text
  ctx.fillStyle = colorHex;
  ctx.font = 'bold 38px "Impact", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '3px';
  ctx.fillText(mainText, 200, 70);

  // Subtitle
  ctx.font = 'bold 12px "Arial", sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText(`★ ${subText} ★`, 200, 114);

  return canvas.toDataURL('image/png');
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Generates cursive signature onto a transparent canvas
 */
export function generateCalligraphicSignature(
  name: string,
  inkColor: string = '#1e40af',
  fontStyle: string = 'Brush Script MT, cursive'
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 450;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = inkColor;
  ctx.font = `italic 46px "Segoe Script", "Brush Script MT", "Caveat", cursive, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Add subtle handwriting rotation
  ctx.save();
  ctx.translate(225, 75);
  ctx.rotate(-0.06);
  ctx.fillText(name || 'Signature', 0, 0);

  // Underline stroke flourish
  ctx.beginPath();
  ctx.moveTo(-160, 28);
  ctx.bezierCurveTo(-60, 36, 60, 20, 170, 32);
  ctx.strokeStyle = inkColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.restore();

  return canvas.toDataURL('image/png');
}

/**
 * Removes white background from uploaded signature image, making it clean PNG
 */
export function removeWhiteBackgroundFromImage(
  imgElement: HTMLImageElement,
  threshold: number = 225
): string {
  const canvas = document.createElement('canvas');
  canvas.width = imgElement.naturalWidth || imgElement.width || 400;
  canvas.height = imgElement.naturalHeight || imgElement.height || 200;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.drawImage(imgElement, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (r + g + b) / 3;

    if (brightness > threshold) {
      data[i + 3] = 0; // Transparent
    } else {
      // Darken handwriting strokes for clarity
      const factor = (255 - brightness) / 255;
      data[i + 3] = Math.min(255, Math.round(data[i + 3] * (factor + 0.3)));
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Main PDF Security, Watermark & Sign Execution Pipeline
 */
export async function applySecurityAndWatermarkToPdf(
  file: File | ArrayBuffer,
  config: SecurityProcessingConfig,
  onProgress?: (percent: number, msg: string) => void
): Promise<Uint8Array> {
  onProgress?.(10, 'Loading PDF binary streams and encryption headers...');

  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

  const totalPages = pdfDoc.getPageCount();
  onProgress?.(25, `Preparing typography and assets across ${totalPages} pages...`);

  // Embed Fonts
  let watermarkFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  if (config.textWatermark.fontFamily === 'TimesRomanBold') {
    watermarkFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  } else if (config.textWatermark.fontFamily === 'CourierBold') {
    watermarkFont = await pdfDoc.embedFont(StandardFonts.CourierBold);
  }

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Prepare Stamp Image if enabled
  let embeddedStampImage: PDFImage | null = null;
  if (config.stampWatermark.enabled) {
    let stampDataUrl = config.stampWatermark.customImageDataUrl;
    if (!stampDataUrl) {
      stampDataUrl = generateGraphicStampDataUrl(
        config.stampWatermark.type,
        config.stampWatermark.customText,
        config.stampWatermark.color
      );
    }
    if (stampDataUrl) {
      const stampBytes = await fetch(stampDataUrl).then((res) => res.arrayBuffer());
      embeddedStampImage = await pdfDoc.embedPng(stampBytes);
    }
  }

  // Prepare Signature Image if enabled
  let embeddedSigImage: PDFImage | null = null;
  if (config.signature.enabled && config.signature.dataUrl) {
    try {
      const sigBytes = await fetch(config.signature.dataUrl).then((res) => res.arrayBuffer());
      embeddedSigImage = await pdfDoc.embedPng(sigBytes);
    } catch (e) {
      console.warn('Could not embed signature PNG:', e);
    }
  }

  const targetWatermarkPages = parseTargetPages(config.textWatermark.pageRange, totalPages);
  const targetStampPages = parseTargetPages(config.stampWatermark.pageRange, totalPages);

  // Process Each Page
  for (let p = 0; p < totalPages; p++) {
    const pageNum = p + 1;
    const page = pdfDoc.getPage(p);
    const { width, height } = page.getSize();

    const progressP = Math.round(30 + (p / totalPages) * 55);
    onProgress?.(progressP, `Securing and watermarking Page ${pageNum} of ${totalPages}...`);

    // 1. TEXT WATERMARK
    if (config.textWatermark.enabled && targetWatermarkPages.includes(pageNum)) {
      applyTextWatermarkToPage(page, watermarkFont, config.textWatermark, width, height);
    }

    // 2. STAMP WATERMARK
    if (config.stampWatermark.enabled && embeddedStampImage && targetStampPages.includes(pageNum)) {
      applyStampToPage(page, embeddedStampImage, config.stampWatermark, width, height);
    }

    // 3. DIGITAL SIGNATURE
    if (
      config.signature.enabled &&
      embeddedSigImage &&
      (config.signature.targetPage === pageNum || config.signature.targetPage === 0)
    ) {
      applySignatureToPage(page, embeddedSigImage, regularFont, boldFont, config.signature, width, height);
    }

    // 4. REDACTIONS (Blackout boxes on this page)
    const pageRedactions = config.redactions.filter((r) => r.pageNumber === pageNum);
    for (const red of pageRedactions) {
      const boxX = (red.xPercent / 100) * width;
      const boxY = (1 - red.yPercent / 100 - red.heightPercent / 100) * height;
      const boxW = (red.widthPercent / 100) * width;
      const boxH = (red.heightPercent / 100) * height;

      page.drawRectangle({
        x: boxX,
        y: boxY,
        width: boxW,
        height: boxH,
        color: rgb(0.05, 0.05, 0.05),
      });

      if (red.label) {
        page.drawText(red.label, {
          x: boxX + 4,
          y: boxY + boxH / 2 - 3,
          size: Math.max(6, Math.min(9, boxH * 0.5)),
          font: boldFont,
          color: rgb(1, 1, 1),
        });
      }
    }
  }

  // 5. METADATA SANITATION / PRIVACY SHIELD
  if (config.metadata.stripMetadata) {
    onProgress?.(90, 'Sanitizing document metadata for security compliance...');
    pdfDoc.setTitle(config.metadata.customTitle || '');
    pdfDoc.setAuthor(config.metadata.customAuthor || '');
    pdfDoc.setSubject(config.metadata.customSubject || '');
    pdfDoc.setKeywords(config.metadata.customKeywords ? config.metadata.customKeywords.split(',') : []);
    pdfDoc.setProducer('PDF Security Suite Engine');
    pdfDoc.setCreator('PDF Security Suite');
    pdfDoc.setCreationDate(new Date());
    pdfDoc.setModificationDate(new Date());
  }

  onProgress?.(96, 'Compressing and finalizing secured PDF...');
  const securedPdfBytes = await pdfDoc.save();

  onProgress?.(100, 'Security processing complete.');
  return securedPdfBytes;
}

function applyTextWatermarkToPage(
  page: PDFPage,
  font: any,
  config: TextWatermarkConfig,
  width: number,
  height: number
) {
  const { r, g, b } = hexToRgb(config.color);
  const pdfColor = rgb(r, g, b);
  const text = config.text || 'CONFIDENTIAL';
  const fontSize = config.fontSize;

  if (config.mode === 'diagonal_center') {
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    // Center coordinates
    const centerX = width / 2;
    const centerY = height / 2;
    const rad = (config.rotation * Math.PI) / 180;

    // Offset calculation for centered rotated text
    const offsetX = (textWidth / 2) * Math.cos(rad) - (textHeight / 2) * Math.sin(rad);
    const offsetY = (textWidth / 2) * Math.sin(rad) + (textHeight / 2) * Math.cos(rad);

    page.drawText(text, {
      x: centerX - offsetX,
      y: centerY - offsetY,
      size: fontSize,
      font,
      color: pdfColor,
      opacity: config.opacity,
      rotate: degrees(config.rotation),
    });
  } else if (config.mode === 'tiled_grid') {
    const spacingX = config.tileSpacingX || 220;
    const spacingY = config.tileSpacingY || 160;
    const tileFontSize = Math.max(16, fontSize * 0.55);

    for (let x = -50; x < width + 100; x += spacingX) {
      for (let y = -50; y < height + 100; y += spacingY) {
        page.drawText(text, {
          x,
          y,
          size: tileFontSize,
          font,
          color: pdfColor,
          opacity: config.opacity * 0.8,
          rotate: degrees(config.rotation),
        });
      }
    }
  } else if (config.mode === 'header_footer') {
    const bannerSize = Math.max(10, fontSize * 0.3);
    const bannerTextWidth = font.widthOfTextAtSize(text, bannerSize);

    // Top Header Banner
    page.drawRectangle({
      x: 0,
      y: height - 24,
      width,
      height: 24,
      color: pdfColor,
      opacity: config.opacity * 0.4,
    });
    page.drawText(text, {
      x: (width - bannerTextWidth) / 2,
      y: height - 16,
      size: bannerSize,
      font,
      color: pdfColor,
      opacity: Math.min(1, config.opacity + 0.3),
    });

    // Bottom Footer Banner
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height: 24,
      color: pdfColor,
      opacity: config.opacity * 0.4,
    });
    page.drawText(text, {
      x: (width - bannerTextWidth) / 2,
      y: 8,
      size: bannerSize,
      font,
      color: pdfColor,
      opacity: Math.min(1, config.opacity + 0.3),
    });
  }
}

function applyStampToPage(
  page: PDFPage,
  stampImg: PDFImage,
  config: StampWatermarkConfig,
  width: number,
  height: number
) {
  const imgDims = stampImg.scale(config.scale * 0.4);
  let x = width - imgDims.width - 36;
  let y = height - imgDims.height - 36;

  switch (config.position) {
    case 'top-right':
      x = width - imgDims.width - 36;
      y = height - imgDims.height - 36;
      break;
    case 'top-left':
      x = 36;
      y = height - imgDims.height - 36;
      break;
    case 'bottom-right':
      x = width - imgDims.width - 36;
      y = 36;
      break;
    case 'bottom-left':
      x = 36;
      y = 36;
      break;
    case 'center':
      x = (width - imgDims.width) / 2;
      y = (height - imgDims.height) / 2;
      break;
    case 'custom':
      x = ((config.posXPercent ?? 75) / 100) * width;
      y = (1 - (config.posYPercent ?? 20) / 100) * height - imgDims.height;
      break;
  }

  page.drawImage(stampImg, {
    x,
    y,
    width: imgDims.width,
    height: imgDims.height,
    opacity: config.opacity,
    rotate: degrees(config.rotation),
  });
}

function applySignatureToPage(
  page: PDFPage,
  sigImg: PDFImage,
  regFont: any,
  boldFont: any,
  config: SignatureConfig,
  width: number,
  height: number
) {
  const sigX = (config.posXPercent / 100) * width;
  // Flip Y because PDF coordinates origin is bottom-left
  const sigY = (1 - config.posYPercent / 100) * height - config.height;

  // Draw signature image
  page.drawImage(sigImg, {
    x: sigX,
    y: sigY,
    width: config.width,
    height: config.height,
    opacity: 0.95,
  });

  // Optional Signer Information Metadata Line
  if (config.includeSignerInfo) {
    const infoY = sigY - 14;

    page.drawText(`Digitally Signed by: ${config.signerName || 'Authorized Signer'}`, {
      x: sigX,
      y: infoY,
      size: 7.5,
      font: boldFont,
      color: rgb(0.12, 0.16, 0.24),
    });

    if (config.includeDate) {
      page.drawText(`Date: ${config.dateString} | Reason: ${config.reason || 'Verified'}`, {
        x: sigX,
        y: infoY - 9,
        size: 6.5,
        font: regFont,
        color: rgb(0.4, 0.45, 0.55),
      });
    }
  }
}

/**
 * Creates sample test agreement PDF for testing security/watermarks
 */
export async function generateSampleSecurityPdf(preset: 'nda' | 'contract' | 'medical'): Promise<File> {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

  if (preset === 'nda') {
    const page = pdfDoc.addPage([612, 792]);
    const { height } = page.getSize();

    page.drawRectangle({
      x: 36,
      y: height - 85,
      width: 540,
      height: 48,
      color: rgb(0.08, 0.15, 0.28),
    });

    page.drawText('MUTUAL NON-DISCLOSURE & CONFIDENTIALITY AGREEMENT', {
      x: 50,
      y: height - 60,
      size: 13,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page.drawText('STRICTLY PROPRIETARY - EXECUTED FOR STRATEGIC EVALUATION', {
      x: 50,
      y: height - 74,
      size: 8.5,
      font: fontReg,
      color: rgb(0.6, 0.75, 0.9),
    });

    const lines = [
      'This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of August 2026, by and between',
      'NovaTech Systems Inc. ("Disclosing Party") and Apex Global Capital Partners ("Receiving Party").',
      '',
      '1. PURPOSE OF DISCLOSURE',
      'The parties wish to explore a potential strategic business acquisition and integration, and in connection',
      'therewith, Disclosing Party will provide confidential proprietary source code, algorithms, and financials.',
      '',
      '2. DEFINITION OF CONFIDENTIAL INFORMATION',
      '"Confidential Information" encompasses all non-public trade secrets, customer rosters, unreleased AI models,',
      'financial projections, server architecture designs, and intellectual property marked as proprietary.',
      '',
      '3. OBLIGATIONS & NON-USE',
      'Receiving Party agrees to maintain strict secrecy using no less than a high standard of commercial care.',
      'Receiving Party shall not copy, decompile, reverse engineer, or transmit the data to unauthorized third parties.',
      '',
      '4. TERM & SURVIVAL',
      'The confidentiality obligations under this Agreement shall survive for a period of five (5) years from disclosure.',
      '',
      'IN WITNESS WHEREOF, the parties hereto have executed this Agreement by their authorized officers.',
    ];

    let textY = height - 115;
    for (const l of lines) {
      if (l.startsWith('1.') || l.startsWith('2.') || l.startsWith('3.') || l.startsWith('4.') || l.startsWith('IN WITNESS')) {
        page.drawText(l, { x: 45, y: textY, size: 9.5, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
      } else {
        page.drawText(l, { x: 45, y: textY, size: 8.5, font: fontReg, color: rgb(0.2, 0.25, 0.35) });
      }
      textY -= 17;
    }

    // Signature Block Layout
    page.drawRectangle({
      x: 45,
      y: textY - 80,
      width: 240,
      height: 70,
      borderColor: rgb(0.7, 0.75, 0.85),
      borderWidth: 1,
      color: rgb(0.97, 0.98, 1),
    });
    page.drawText('AUTHORIZED SIGNATURE (DISCLOSING PARTY):', {
      x: 55,
      y: textY - 22,
      size: 7.5,
      font: fontBold,
      color: rgb(0.2, 0.25, 0.35),
    });

    const pdfBytes = await pdfDoc.save();
    return new File([pdfBytes], 'Mutual_Non_Disclosure_Agreement.pdf', { type: 'application/pdf' });
  }

  // Default: Master Contract
  const page = pdfDoc.addPage([612, 792]);
  const { height } = page.getSize();

  page.drawRectangle({
    x: 36,
    y: height - 85,
    width: 540,
    height: 48,
    color: rgb(0.06, 0.28, 0.24),
  });

  page.drawText('MASTER SERVICES CONTRACT & SERVICE LEVEL AGREEMENT', {
    x: 50,
    y: height - 60,
    size: 13,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText('ENTERPRISE SLA TIER 1 - 99.99% GUARANTEED HIGH-AVAILABILITY CLOUD', {
    x: 50,
    y: height - 74,
    size: 8.5,
    font: fontReg,
    color: rgb(0.7, 0.9, 0.85),
  });

  const contractLines = [
    'This Master Services Contract ("Contract") defines terms of service delivery, liability, and payment.',
    '',
    '1. SCOPE OF SERVICES & DELIVERABLES',
    'Provider shall furnish dedicated high-throughput compute infrastructure, database clustering, and security.',
    '',
    '2. PAYMENT TERMS & COMPENSATION',
    'Client shall pay the agreed monthly recurring commitment within thirty (30) calendar days of electronic invoice.',
    '',
    '3. DATA PRIVACY & COMPLIANCE',
    'Provider guarantees full compliance with SOC2 Type II, ISO 27001, and HIPAA data residency regulations.',
    '',
    'SIGNATURE & ACKNOWLEDGMENT:',
  ];

  let textY = height - 120;
  for (const l of contractLines) {
    if (l.startsWith('1.') || l.startsWith('2.') || l.startsWith('3.') || l.startsWith('SIGNATURE')) {
      page.drawText(l, { x: 45, y: textY, size: 9.5, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
    } else {
      page.drawText(l, { x: 45, y: textY, size: 8.5, font: fontReg, color: rgb(0.2, 0.25, 0.35) });
    }
    textY -= 20;
  }

  const pdfBytes = await pdfDoc.save();
  return new File([pdfBytes], 'Master_Services_Contract.pdf', { type: 'application/pdf' });
}
