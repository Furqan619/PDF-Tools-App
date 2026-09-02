/**
 * Generates test PDF files with text, tables, and embedded graphics/images.
 */

export interface SampleDocPreset {
  id: string;
  name: string;
  description: string;
  pages: number;
  sizeLabel: string;
  category: 'report' | 'invoice' | 'large-doc' | 'resume' | 'ocr-sample';
}

export const SAMPLE_PRESETS: SampleDocPreset[] = [
  {
    id: 'financial-report',
    name: 'Quarterly_Financial_Report.pdf',
    description: '3-page corporate report with Executive Summary, Headings, 4-column Revenue Table, Bullet Lists, and Corporate Logo.',
    pages: 3,
    sizeLabel: '240 KB',
    category: 'report',
  },
  {
    id: 'scanned-invoice',
    name: 'Scanned_Commercial_Invoice.pdf',
    description: 'Scanned billing document with header metadata, line items table, subtotal/tax calculations, and stamp.',
    pages: 2,
    sizeLabel: '190 KB',
    category: 'ocr-sample',
  },
  {
    id: 'project-proposal',
    name: 'AI_Platform_Architecture_Spec.pdf',
    description: 'Multi-section technical specification with system architecture, data models, benchmarks, and Architecture Diagram.',
    pages: 5,
    sizeLabel: '450 KB',
    category: 'large-doc',
  },
  {
    id: 'executive-resume',
    name: 'Senior_Software_Architect_Resume.pdf',
    description: '2-page clean executive resume with skills grid, job accomplishments, profile graphic, and bullet items.',
    pages: 2,
    sizeLabel: '180 KB',
    category: 'resume',
  },
];

/**
 * Creates a valid PDF binary file with real text, tables, and embedded images.
 */
export function generateSamplePdfBlob(presetId: string): File {
  const isInvoice = presetId === 'financial-report';
  const isScanned = presetId === 'scanned-invoice';
  const isLarge = presetId === 'project-proposal';
  const fileName = isInvoice 
    ? 'Quarterly_Financial_Report.pdf' 
    : isScanned
      ? 'Scanned_Commercial_Invoice.pdf'
      : isLarge 
        ? 'AI_Platform_Architecture_Spec.pdf' 
        : 'Senior_Software_Architect_Resume.pdf';

  const pagesContent = isInvoice 
    ? getFinancialReportPages() 
    : isScanned
      ? getScannedInvoicePages()
      : isLarge 
        ? getTechSpecPages() 
        : getResumePages();

  const pdfBinary = buildPdfDocument(pagesContent, isInvoice || isScanned ? 'report' : isLarge ? 'diagram' : 'profile');
  return new File([pdfBinary], fileName, { type: 'application/pdf' });
}

interface PageStream {
  textStream: string;
  hasImage?: boolean;
}

function buildPdfDocument(pages: PageStream[], imageTheme: 'report' | 'diagram' | 'profile'): Uint8Array {
  const objects: string[] = [];
  const objOffsets: number[] = [];

  let currentOffset = 0;
  const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  currentOffset += header.length;

  // Obj 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Obj 2: Pages
  const kids = pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ');
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`);

  // Font object
  const fontObjIndex = 3 + pages.length * 2;
  // Image object
  const imageObjIndex = fontObjIndex + 1;

  // Generate a sample RGB image (50x50 pixels)
  const imgWidth = 60;
  const imgHeight = 50;
  const rgbBytes = new Uint8Array(imgWidth * imgHeight * 3);
  for (let y = 0; y < imgHeight; y++) {
    for (let x = 0; x < imgWidth; x++) {
      const idx = (y * imgWidth + x) * 3;
      if (imageTheme === 'report') {
        // Corporate blue & emerald gradient badge
        rgbBytes[idx] = Math.round(20 + (x / imgWidth) * 30);
        rgbBytes[idx + 1] = Math.round(100 + (y / imgHeight) * 120);
        rgbBytes[idx + 2] = Math.round(210 + (x / imgWidth) * 40);
      } else if (imageTheme === 'diagram') {
        // High-tech indigo architecture icon
        const isBorder = x < 3 || x >= imgWidth - 3 || y < 3 || y >= imgHeight - 3;
        const isCenter = Math.abs(x - imgWidth / 2) < 12 && Math.abs(y - imgHeight / 2) < 10;
        if (isBorder || isCenter) {
          rgbBytes[idx] = 99;
          rgbBytes[idx + 1] = 102;
          rgbBytes[idx + 2] = 241;
        } else {
          rgbBytes[idx] = 238;
          rgbBytes[idx + 1] = 242;
          rgbBytes[idx + 2] = 255;
        }
      } else {
        // Profile badge
        const dx = x - imgWidth / 2;
        const dy = y - imgHeight / 2;
        if (Math.hypot(dx, dy) < imgHeight * 0.4) {
          rgbBytes[idx] = 14;
          rgbBytes[idx + 1] = 165;
          rgbBytes[idx + 2] = 233;
        } else {
          rgbBytes[idx] = 241;
          rgbBytes[idx + 1] = 245;
          rgbBytes[idx + 2] = 249;
        }
      }
    }
  }

  let binaryImgStr = '';
  for (let i = 0; i < rgbBytes.length; i++) {
    binaryImgStr += String.fromCharCode(rgbBytes[i]);
  }

  // Add pages and their stream objects
  pages.forEach((page, i) => {
    const pageObjIdx = 3 + i * 2;
    const contentsObjIdx = 4 + i * 2;
    
    // Page Obj with Resources (Font + optional Image XObject)
    const resourceStr = page.hasImage
      ? `<< /Font << /F1 ${fontObjIndex} 0 R >> /XObject << /Im1 ${imageObjIndex} 0 R >> >>`
      : `<< /Font << /F1 ${fontObjIndex} 0 R >> >>`;

    objects.push(
      `${pageObjIdx} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources ${resourceStr} /Contents ${contentsObjIdx} 0 R >>\nendobj\n`
    );

    // Contents Stream Obj
    const streamData = page.textStream;
    const streamLength = streamData.length;
    objects.push(
      `${contentsObjIdx} 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamData}\nendstream\nendobj\n`
    );
  });

  // Font Obj
  objects.push(
    `${fontObjIndex} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`
  );

  // Image XObject
  objects.push(
    `${imageObjIndex} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgWidth} /Height ${imgHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${rgbBytes.length} >>\nstream\n${binaryImgStr}\nendstream\nendobj\n`
  );

  let body = header;
  for (const obj of objects) {
    objOffsets.push(body.length);
    body += obj;
  }

  const xrefOffset = body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of objOffsets) {
    xref += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  const fullPdfStr = body + xref + trailer;

  const buffer = new Uint8Array(fullPdfStr.length);
  for (let i = 0; i < fullPdfStr.length; i++) {
    buffer[i] = fullPdfStr.charCodeAt(i) & 0xff;
  }

  return buffer;
}

function getFinancialReportPages(): PageStream[] {
  return [
    {
      hasImage: true,
      textStream: `
q
100 0 0 50 50 645 cm
/Im1 Do
Q
BT
/F1 20 Tf
50 720 Td
(QUARTERLY FINANCIAL PERFORMANCE REPORT) Tj
/F1 11 Tf
0 -25 Td
(Fiscal Year 2026 - Q3 Performance Summary & Projections) Tj
/F1 14 Tf
0 -80 Td
(1. Executive Overview) Tj
/F1 10 Tf
0 -20 Td
(The company delivered strong revenue growth across all cloud software divisions during Q3.) Tj
0 -16 Td
(Operating margins improved by 420 basis points driven by streaming processing automation.) Tj
0 -16 Td
(Customer retention hit a record high of 98.4% with recurring enterprise revenue up 34% YoY.) Tj
/F1 14 Tf
0 -35 Td
(2. Key Business Metrics) Tj
/F1 10 Tf
0 -20 Td
(Quarterly Revenue:                    $48,500,000      +28.4% YoY) Tj
0 -18 Td
(Net Operating Income:                 $14,200,000      +36.1% YoY) Tj
0 -18 Td
(Enterprise Customers:                 2,480 accounts   +410 accounts) Tj
0 -18 Td
(Research & Development Investment:   $9,600,000       20.0% of Revenue) Tj
/F1 14 Tf
0 -35 Td
(3. Divisional Breakdown Table) Tj
/F1 10 Tf
0 -20 Td
(Division                 Q3 Revenue     Q2 Revenue     Growth Rate) Tj
0 -16 Td
(Cloud Infrastructure    $22,400,000    $18,900,000    +18.5%) Tj
0 -16 Td
(Enterprise AI Tools     $16,800,000    $11,200,000    +50.0%) Tj
0 -16 Td
(Developer APIs          $6,100,000     $5,300,000     +15.1%) Tj
0 -16 Td
(Professional Services   $3,200,000     $3,100,000     +3.2%) Tj
ET
      `.trim(),
    },
    {
      textStream: `
BT
/F1 18 Tf
50 720 Td
(4. Strategic Growth Initiatives) Tj
/F1 10 Tf
0 -25 Td
(Our key investment pillars for the upcoming fiscal quarter focus on three core areas:) Tj
/F1 11 Tf
0 -25 Td
(- Global Cloud Expansion: Deploying 4 new low-latency availability zones across APAC and EMEA.) Tj
0 -20 Td
(- Client-Side Document Processing: Accelerating streaming conversion for high-volume users.) Tj
0 -20 Td
(- Enterprise Security Compliance: SOC-2 Type II, ISO 27001, and HIPAA certifications renewed.) Tj
/F1 14 Tf
0 -40 Td
(5. Cost Optimization & Operational Efficiency) Tj
/F1 10 Tf
0 -20 Td
(Through automated resource scaling and memory-efficient client processing pipelines,) Tj
0 -16 Td
(infrastructure costs per active user decreased by 22% quarter-over-quarter.) Tj
0 -16 Td
(All server-side compute workloads have been optimized for high-throughput batching.) Tj
ET
      `.trim(),
    },
    {
      textStream: `
BT
/F1 18 Tf
50 720 Td
(6. Fiscal Guidance & Risk Assessment) Tj
/F1 10 Tf
0 -25 Td
(The management team projects full-year gross revenues between $195M and $205M.) Tj
0 -18 Td
(Capital expenditures are budgeted at $24M to support ongoing network infrastructure scaling.) Tj
/F1 12 Tf
0 -35 Td
(Audit Committee Sign-off:) Tj
/F1 10 Tf
0 -20 Td
(Chief Executive Officer: Elena Vance, Ph.D.) Tj
0 -18 Td
(Chief Financial Officer: Marcus Sterling, CPA) Tj
0 -18 Td
(Date of Publication: August 2026) Tj
ET
      `.trim(),
    },
  ];
}

function getTechSpecPages(): PageStream[] {
  return [
    {
      hasImage: true,
      textStream: `
q
120 0 0 60 50 635 cm
/Im1 Do
Q
BT
/F1 20 Tf
50 720 Td
(AI PLATFORM ARCHITECTURE SPECIFICATION) Tj
/F1 11 Tf
0 -25 Td
(Document Version 4.2 - High Throughput Document Conversion Engine) Tj
/F1 14 Tf
0 -90 Td
(1. System Requirements & Goals) Tj
/F1 10 Tf
0 -20 Td
(- Zero Server Latency: In-browser streaming client conversion using WebAssembly & Workers.) Tj
0 -18 Td
(- Complete Privacy: 100% client-side document processing with zero external data transmission.) Tj
0 -18 Td
(- Scalability: Seamless handling of 100MB+ multi-page enterprise documents without memory leaks.) Tj
0 -18 Td
(- High Fidelity: Retaining tables, font weights, lists, headings, and margins in Microsoft Word format.) Tj
ET
      `.trim(),
    },
    {
      textStream: `
BT
/F1 18 Tf
50 720 Td
(2. Data Pipeline Architecture) Tj
/F1 10 Tf
0 -25 Td
(The document ingestion pipeline processes input files through four decoupled stages:) Tj
0 -20 Td
(Stage 1: Binary parsing and stream viewport coordinate normalization) Tj
0 -18 Td
(Stage 2: Spatial clustering and typographical hierarchy detection) Tj
0 -18 Td
(Stage 3: Table grid reconstruction and image bounding extraction) Tj
0 -18 Td
(Stage 4: OpenXML DOCX paragraph, table, and header assembly) Tj
ET
      `.trim(),
    },
    {
      textStream: `
BT
/F1 18 Tf
50 720 Td
(3. Memory Management & Streaming Benchmarks) Tj
/F1 10 Tf
0 -25 Td
(Page Range          Processing Time     Peak RAM Usage     DOCX Output Size) Tj
0 -18 Td
(1 - 10 pages        0.8 seconds         24 MB              140 KB) Tj
0 -18 Td
(10 - 50 pages       2.9 seconds         42 MB              620 KB) Tj
0 -18 Td
(50 - 200 pages      8.4 seconds         68 MB              2.1 MB) Tj
ET
      `.trim(),
    },
    {
      textStream: `
BT
/F1 18 Tf
50 720 Td
(4. Security & Compliance Protocols) Tj
/F1 10 Tf
0 -25 Td
(Because documents are processed in-memory via sandboxed client execution contexts,) Tj
0 -18 Td
(no confidential information or personal identifiable data (PII) is stored or transferred.) Tj
0 -18 Td
(All allocated Canvas and ArrayBuffer objects are immediately freed via explicit garbage collection hints.) Tj
ET
      `.trim(),
    },
    {
      textStream: `
BT
/F1 18 Tf
50 720 Td
(5. Deployment & Release Verification) Tj
/F1 10 Tf
0 -25 Td
(Automated end-to-end regression tests verify standard ECMA-376 OpenXML compliance) Tj
0 -18 Td
(across Microsoft Word 2016+, Office 365, Google Docs, LibreOffice, and Apple Pages.) Tj
ET
      `.trim(),
    },
  ];
}

function getResumePages(): PageStream[] {
  return [
    {
      hasImage: true,
      textStream: `
q
60 0 0 60 490 670 cm
/Im1 Do
Q
BT
/F1 22 Tf
50 720 Td
(ALEXANDER CHEN) Tj
/F1 11 Tf
0 -22 Td
(Principal Cloud Architect & Full-Stack Systems Engineer) Tj
0 -16 Td
(San Francisco, CA  |  alex.chen@example.com  |  linkedin.com/in/alexchen) Tj
/F1 14 Tf
0 -35 Td
(PROFESSIONAL SUMMARY) Tj
/F1 10 Tf
0 -20 Td
(Results-driven Principal Engineer with 12+ years designing resilient high-throughput cloud architectures,) Tj
0 -16 Td
(distributed microservices, and high-performance WebAssembly document processing engines.) Tj
/F1 14 Tf
0 -35 Td
(CORE COMPETENCIES) Tj
/F1 10 Tf
0 -20 Td
(- Languages: TypeScript, JavaScript, Rust, Go, Python, C++, SQL) Tj
0 -18 Td
(- Frameworks & Cloud: React, Node.js, Express, Google Cloud, Docker, Kubernetes, WebAssembly) Tj
0 -18 Td
(- Document Engineering: PDF 1.7 / 2.0 Specifications, OpenXML DOCX, Font Metrics, Canvas Rendering) Tj
/F1 14 Tf
0 -35 Td
(WORK EXPERIENCE) Tj
/F1 12 Tf
0 -22 Td
(Principal Systems Architect - CloudScale Systems (2021 - Present)) Tj
/F1 10 Tf
0 -18 Td
(- Architected real-time client-side conversion pipelines supporting 50M+ document transformations/month.) Tj
0 -16 Td
(- Reduced client memory overhead by 65% through streaming page chunking and canvas context recycling.) Tj
0 -16 Td
(- Led an engineering team of 14 senior engineers building enterprise collaboration tools.) Tj
ET
      `.trim(),
    },
    {
      textStream: `
BT
/F1 12 Tf
50 720 Td
(Senior Software Engineer - Apex Document Technologies (2017 - 2021)) Tj
/F1 10 Tf
0 -20 Td
(- Developed automated table recognition algorithms achieving 99.2% cell boundary precision.) Tj
0 -16 Td
(- Optimized OpenXML DOCX serializer to generate valid Office documents at 10,000 paragraphs/second.) Tj
/F1 14 Tf
0 -35 Td
(EDUCATION & CERTIFICATIONS) Tj
/F1 10 Tf
0 -20 Td
(B.S. in Computer Science - University of California, Berkeley (2015)) Tj
0 -18 Td
(Google Cloud Certified Professional Cloud Architect) Tj
0 -18 Td
(AWS Certified Solutions Architect - Professional) Tj
ET
      `.trim(),
    },
  ];
}

function getScannedInvoicePages(): PageStream[] {
  return [
    {
      hasImage: true,
      textStream: `
q
120 0 0 50 50 645 cm
/Im1 Do
Q
BT
/F1 22 Tf
50 720 Td
(COMMERCIAL TAX INVOICE) Tj
/F1 11 Tf
0 -24 Td
(Invoice Number: INV-2026-89412  |  Issue Date: August 28, 2026) Tj
/F1 12 Tf
0 -40 Td
(BILL TO / CUSTOMER INFORMATION:) Tj
/F1 10 Tf
0 -18 Td
(Client Name: Apex Global Logistics Inc.) Tj
0 -16 Td
(Tax ID / VAT: US-948291048  |  Account ID: ACC-55209) Tj
0 -16 Td
(Address: 742 Evergreen Terrace, Suite 400, Austin, TX 78701) Tj
/F1 14 Tf
0 -35 Td
(ORDER SUMMARY & LINE ITEMS) Tj
/F1 10 Tf
0 -20 Td
(Item Description           Quantity     Unit Price     Total Amount) Tj
0 -16 Td
(Cloud Compute Cluster        4 units      $1,250.00      $5,000.00) Tj
0 -16 Td
(OCR Layout Engine License    1 annual     $3,400.00      $3,400.00) Tj
0 -16 Td
(Dedicated Support Tier       12 months    $450.00        $5,400.00) Tj
0 -16 Td
(Data Migration Consulting   20 hours     $175.00        $3,500.00) Tj
/F1 12 Tf
0 -30 Td
(PAYMENT CALCULATION:) Tj
/F1 10 Tf
0 -18 Td
(Subtotal:                                                $17,300.00) Tj
0 -16 Td
(State Sales Tax (8.25%):                                 $1,427.25) Tj
/F1 12 Tf
0 -20 Td
(TOTAL BALANCE DUE:                                       $18,727.25) Tj
/F1 10 Tf
0 -25 Td
(Payment Terms: Net 30 Days  |  Wire Transfer / ACH Accepted) Tj
0 -16 Td
(Authorized Signature: Verification Officer - Department of Billing) Tj
ET
      `.trim(),
    },
    {
      textStream: `
BT
/F1 16 Tf
50 720 Td
(TERMS, CONDITIONS & AUDIT DISCLOSURE) Tj
/F1 10 Tf
0 -25 Td
(1. All software licensing and consulting fees are governed by the Master Service Agreement.) Tj
0 -18 Td
(2. Unpaid balances past 30 days are subject to a 1.5% compounding late administration surcharge.) Tj
0 -18 Td
(3. For billing questions or electronic remittance receipts, please contact billing@apex-logistics.io.) Tj
/F1 12 Tf
0 -35 Td
(Security & Compliance Assurance:) Tj
/F1 10 Tf
0 -20 Td
(This invoice has been digitally generated and cryptographically stamped for audit trail integrity.) Tj
0 -16 Td
(Document Hash: sha256:4f9a2b8c7e1d5a6f8b9c0d2e3f4a5b6c) Tj
ET
      `.trim(),
    },
  ];
}
