import html2canvas from 'html2canvas';
import { PDFDocument } from 'pdf-lib';
import confetti from 'canvas-confetti';

export interface HtmlToPdfConfig {
  pageSize: 'A4' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  marginMm: number;
  scale: number;
}

export const DEFAULT_HTML_CONFIG: HtmlToPdfConfig = {
  pageSize: 'A4',
  orientation: 'portrait',
  marginMm: 10,
  scale: 2,
};

export const HTML_TEMPLATES = [
  {
    id: 'invoice',
    name: 'Professional Invoice',
    html: `<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; background: #fff;">
  <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px;">
    <div>
      <h1 style="color: #4f46e5; margin: 0 0 5px 0; font-size: 28px;">INVOICE</h1>
      <p style="margin: 0; color: #666; font-size: 14px;">INV-2026-0849</p>
    </div>
    <div style="text-align: right;">
      <h3 style="margin: 0 0 5px 0; color: #1e293b;">Acme Corp Global</h3>
      <p style="margin: 0; color: #666; font-size: 13px;">100 Innovation Way, Silicon Valley, CA</p>
      <p style="margin: 0; color: #666; font-size: 13px;">billing@acmeglobal.com</p>
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
    <div>
      <h4 style="margin: 0 0 8px 0; color: #475569; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">Billed To:</h4>
      <p style="margin: 0 0 3px 0; font-weight: bold; color: #1e293b;">Globex Enterprises</p>
      <p style="margin: 0 0 3px 0; color: #666; font-size: 13px;">452 Industrial Parkway</p>
      <p style="margin: 0; color: #666; font-size: 13px;">New York, NY 10001</p>
    </div>
    <div style="text-align: right;">
      <p style="margin: 0 0 5px 0; font-size: 13px;"><strong style="color: #475569;">Issue Date:</strong> September 1, 2026</p>
      <p style="margin: 0; font-size: 13px;"><strong style="color: #475569;">Due Date:</strong> October 1, 2026</p>
    </div>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
    <thead>
      <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
        <th style="padding: 12px; text-align: left; font-size: 12px; color: #475569; text-transform: uppercase;">Description</th>
        <th style="padding: 12px; text-align: center; font-size: 12px; color: #475569; text-transform: uppercase;">Hours / Qty</th>
        <th style="padding: 12px; text-align: right; font-size: 12px; color: #475569; text-transform: uppercase;">Rate</th>
        <th style="padding: 12px; text-align: right; font-size: 12px; color: #475569; text-transform: uppercase;">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 14px 12px; font-size: 14px; color: #1e293b;">Cloud Architecture & API Integration</td>
        <td style="padding: 14px 12px; text-align: center; font-size: 14px; color: #666;">40</td>
        <td style="padding: 14px 12px; text-align: right; font-size: 14px; color: #666;">$150.00</td>
        <td style="padding: 14px 12px; text-align: right; font-size: 14px; color: #1e293b; font-weight: 500;">$6,000.00</td>
      </tr>
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 14px 12px; font-size: 14px; color: #1e293b;">Security Audit & Penetration Testing</td>
        <td style="padding: 14px 12px; text-align: center; font-size: 14px; color: #666;">15</td>
        <td style="padding: 14px 12px; text-align: right; font-size: 14px; color: #666;">$200.00</td>
        <td style="padding: 14px 12px; text-align: right; font-size: 14px; color: #1e293b; font-weight: 500;">$3,000.00</td>
      </tr>
    </tbody>
  </table>

  <div style="display: flex; justify-content: flex-end; margin-bottom: 40px;">
    <div style="width: 260px;">
      <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #666;">
        <span>Subtotal:</span>
        <span>$9,000.00</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #666;">
        <span>Tax (8%):</span>
        <span>$720.00</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 12px 0; font-size: 16px; font-weight: bold; color: #1e293b;">
        <span>Total Due:</span>
        <span style="color: #4f46e5;">$9,720.00</span>
      </div>
    </div>
  </div>

  <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
    <p style="margin: 0 0 5px 0;">Thank you for your business! Please remit payment within 30 days.</p>
    <p style="margin: 0;">Acme Corp Global • Tax ID: US-987654321</p>
  </div>
</div>`,
  },
  {
    id: 'report',
    name: 'Executive Project Report',
    html: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; background: #fff;">
  <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
    <span style="background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; text-transform: uppercase;">Q3 Status Report</span>
    <h1 style="margin: 15px 0 10px 0; font-size: 26px;">Neural PDF Engine Upgrade & Migration</h1>
    <p style="margin: 0; opacity: 0.9; font-size: 14px;">Prepared by Engineering Core Team • Confidential</p>
  </div>

  <h2 style="font-size: 18px; color: #334155; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 30px;">1. Executive Summary</h2>
  <p style="font-size: 14px; line-height: 1.6; color: #475569;">
    During Q3 2026, the document processing pipeline underwent significant optimization. Throughput increased by 340%, memory overhead decreased by 45%, and accuracy on complex OCR tasks reached 99.4%.
  </p>

  <h2 style="font-size: 18px; color: #334155; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 30px;">2. Key Performance Indicators</h2>
  <div style="display: flex; gap: 15px; margin-top: 15px; margin-bottom: 25px;">
    <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; text-align: center;">
      <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase;">Speedup</p>
      <p style="margin: 5px 0 0 0; font-size: 22px; font-weight: bold; color: #4f46e5;">3.4x</p>
    </div>
    <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; text-align: center;">
      <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase;">Accuracy</p>
      <p style="margin: 5px 0 0 0; font-size: 22px; font-weight: bold; color: #10b981;">99.4%</p>
    </div>
    <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; text-align: center;">
      <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase;">Uptime</p>
      <p style="margin: 5px 0 0 0; font-size: 22px; font-weight: bold; color: #3b82f6;">99.99%</p>
    </div>
  </div>

  <h2 style="font-size: 18px; color: #334155; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 30px;">3. Next Steps</h2>
  <ul style="font-size: 14px; line-height: 1.6; color: #475569; padding-left: 20px;">
    <li>Roll out WebAssembly OCR worker acceleration to all client instances.</li>
    <li>Complete SOC2 compliance certification review by end of month.</li>
    <li>Initiate beta testing for multi-user real-time PDF annotation.</li>
  </ul>
</div>`,
  },
];

export async function convertHtmlToPdfBlob(
  htmlContent: string,
  config: HtmlToPdfConfig,
  onProgress?: (progress: number, msg: string) => void
): Promise<Blob> {
  onProgress?.(15, 'Preparing container and styles...');
  
  // Create temporary container
  const container = document.createElement('div');
  container.innerHTML = htmlContent;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = config.orientation === 'portrait' ? '794px' : '1123px'; // A4 dimensions at 96 DPI
  container.style.backgroundColor = '#ffffff';
  container.style.boxSizing = 'border-box';
  document.body.appendChild(container);

  onProgress?.(40, 'Rendering HTML element to high-res canvas...');
  const canvas = await html2canvas(container, {
    scale: config.scale,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  document.body.removeChild(container);

  onProgress?.(70, 'Building PDF document...');
  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  const pdfDoc = await PDFDocument.create();
  
  // Page dimensions in points
  // A4: 595.28 x 841.89 points
  // Letter: 612 x 792 points
  // Legal: 612 x 1008 points
  let pageWidth = 595.28;
  let pageHeight = 841.89;
  if (config.pageSize === 'Letter') {
    pageWidth = 612;
    pageHeight = 792;
  } else if (config.pageSize === 'Legal') {
    pageWidth = 612;
    pageHeight = 1008;
  }

  if (config.orientation === 'landscape') {
    const temp = pageWidth;
    pageWidth = pageHeight;
    pageHeight = temp;
  }

  const imgBytes = Uint8Array.from(atob(imgData.split(',')[1]), (c) => c.charCodeAt(0));
  const embeddedImg = await pdfDoc.embedJpg(imgBytes);

  // Calculate scaling to fit page width while preserving aspect ratio across pages if multi-page
  const imgWidth = pageWidth - config.marginMm * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let remainingHeight = imgHeight;
  let sourceY = 0;
  const printableHeight = pageHeight - config.marginMm * 2;

  while (remainingHeight > 0) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const currentSliceHeight = Math.min(printableHeight, remainingHeight);

    // Draw image slice
    page.drawImage(embeddedImg, {
      x: config.marginMm,
      y: pageHeight - config.marginMm - currentSliceHeight,
      width: imgWidth,
      height: imgHeight,
    });

    remainingHeight -= printableHeight;
    sourceY += printableHeight;
  }

  onProgress?.(95, 'Finalizing PDF...');
  const pdfBytes = await pdfDoc.save();

  onProgress?.(100, 'Conversion complete!');
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
  });

  return new Blob([pdfBytes as any], { type: 'application/pdf' });
}
