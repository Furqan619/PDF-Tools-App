import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Generates sample PDF documents containing high-density financial tables,
 * multi-column balance sheets, and inventory data for testing Table-to-Excel extraction.
 */

export interface SampleTablePreset {
  id: string;
  name: string;
  category: string;
  description: string;
  pageCount: number;
}

export const SAMPLE_TABLE_PRESETS: SampleTablePreset[] = [
  {
    id: 'financial-quarterly',
    name: 'Q3_Corporate_Financial_Statement.pdf',
    category: 'Financial',
    description: 'Quarterly Income Statement with Revenue breakdown, Operating Expenses, Net Margins, and Tax provision table.',
    pageCount: 2,
  },
  {
    id: 'payroll-roster',
    name: 'Engineering_Payroll_and_Compensation.pdf',
    category: 'Human Resources',
    description: 'Staff compensation matrix with Employee ID, Department, Role, Base Salary, Bonus %, and Net Total.',
    pageCount: 1,
  },
  {
    id: 'inventory-logistics',
    name: 'Warehouse_Inventory_and_Pricing_Matrix.pdf',
    category: 'Operations',
    description: 'Product catalog with SKU codes, Stock levels, Unit wholesale cost, Retail MSRP, and Profit margin %.',
    pageCount: 1,
  },
];

export async function generateSampleTablePdf(presetId: string): Promise<File> {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  if (presetId === 'payroll-roster') {
    // 1-Page Payroll Roster
    const page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();

    // Top Header Banner
    page.drawRectangle({
      x: 36,
      y: height - 90,
      width: width - 72,
      height: 54,
      color: rgb(0.06, 0.09, 0.16),
    });

    page.drawText('NOVATECH GLOBAL SYSTEMS - PAYROLL & COMPENSATION REPORT', {
      x: 50,
      y: height - 60,
      size: 13,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page.drawText('Period: Q3 FY2026 | Confidential - For HR & Executive Audit Only', {
      x: 50,
      y: height - 76,
      size: 9,
      font: fontRegular,
      color: rgb(0.58, 0.64, 0.72),
    });

    // Table Data
    const headers = ['EMP ID', 'EMPLOYEE NAME', 'DEPARTMENT', 'ROLE / TITLE', 'BASE SALARY', 'BONUS %', 'TOTAL COMP'];
    const rows = [
      ['EMP-10482', 'Elena Rostova', 'Engineering', 'Lead Distributed Systems', '$185,000.00', '15.0%', '$212,750.00'],
      ['EMP-10483', 'Marcus Chen', 'Product', 'Principal UX Architect', '$165,000.00', '12.5%', '$185,625.00'],
      ['EMP-10484', 'Aisha Patel', 'Data Science', 'Senior ML Research Eng', '$172,000.00', '14.0%', '$196,080.00'],
      ['EMP-10485', 'David Kim', 'Engineering', 'Fullstack Staff Engineer', '$158,000.00', '10.0%', '$173,800.00'],
      ['EMP-10486', 'Sophia Dubois', 'DevOps & SRE', 'Cloud Infrastructure Lead', '$168,000.00', '12.0%', '$188,160.00'],
      ['EMP-10487', 'Lucas Wright', 'Security', 'Chief Security Architect', '$192,000.00', '18.0%', '$226,560.00'],
      ['EMP-10488', 'Yuki Tanaka', 'Engineering', 'Mobile Core Specialist', '$148,000.00', '10.0%', '$162,800.00'],
      ['EMP-10489', 'Clara Mendez', 'Marketing', 'VP Global Growth', '$175,000.00', '15.0%', '$201,250.00'],
      ['EMP-10490', 'Liam O\'Connor', 'Finance', 'Financial Controller', '$160,000.00', '11.5%', '$178,400.00'],
      ['EMP-10491', 'Nadia Hassan', 'Product', 'Senior Product Manager', '$155,000.00', '10.0%', '$170,500.00'],
      ['EMP-10492', 'Oliver Schmidt', 'Engineering', 'Frontend Platform Lead', '$152,000.00', '10.0%', '$167,200.00'],
    ];

    drawStyledTable(page, fontBold, fontRegular, {
      startX: 36,
      startY: height - 120,
      colWidths: [62, 105, 78, 120, 72, 45, 58],
      headers,
      rows,
      title: 'Active Salaried Personnel & Compensation Breakdown',
      headerBgColor: rgb(0.12, 0.28, 0.49),
      altRowColor: rgb(0.96, 0.97, 0.99),
    });

    // Summary row
    page.drawRectangle({
      x: 36,
      y: height - 475,
      width: width - 72,
      height: 24,
      color: rgb(0.9, 0.94, 0.98),
      borderColor: rgb(0.7, 0.8, 0.9),
      borderWidth: 1,
    });
    page.drawText('TOTAL PAYROLL OBLIGATION (11 HEADCOUNT):', {
      x: 48,
      y: height - 460,
      size: 9,
      font: fontBold,
      color: rgb(0.06, 0.09, 0.16),
    });
    page.drawText('$1,830,000.00', {
      x: 405,
      y: height - 460,
      size: 9,
      font: fontBold,
      color: rgb(0.06, 0.09, 0.16),
    });
    page.drawText('$2,063,125.00', {
      x: 485,
      y: height - 460,
      size: 9,
      font: fontBold,
      color: rgb(0.08, 0.45, 0.2),
    });

    const pdfBytes = await pdfDoc.save();
    return new File([pdfBytes], 'Engineering_Payroll_and_Compensation.pdf', { type: 'application/pdf' });
  }

  if (presetId === 'inventory-logistics') {
    // 1-Page Inventory & Pricing Matrix
    const page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();

    // Top Header Banner
    page.drawRectangle({
      x: 36,
      y: height - 90,
      width: width - 72,
      height: 54,
      color: rgb(0.04, 0.35, 0.3),
    });

    page.drawText('GLOBAL LOGISTICS & WAREHOUSE INVENTORY MATRIX', {
      x: 50,
      y: height - 60,
      size: 13,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page.drawText('Automated Stock Tracking • Warehouse West-A4 • As of August 2026', {
      x: 50,
      y: height - 76,
      size: 9,
      font: fontRegular,
      color: rgb(0.75, 0.92, 0.88),
    });

    const headers = ['SKU CODE', 'PRODUCT ITEM NAME', 'CATEGORY', 'STOCK', 'UNIT COST', 'RETAIL MSRP', 'MARGIN %', 'STATUS'];
    const rows = [
      ['SKU-9921', 'Ultra-Slim 4K Monitor 27"', 'Electronics', '450', '$210.00', '$389.99', '46.2%', 'In Stock'],
      ['SKU-9922', 'Mechanical RGB Keyboard Pro', 'Accessories', '1,200', '$42.50', '$119.00', '64.3%', 'In Stock'],
      ['SKU-9923', 'Noise-Cancelling Headset Gen3', 'Audio', '850', '$78.00', '$199.50', '60.9%', 'In Stock'],
      ['SKU-9924', 'Thunderbolt 4 Docking Station', 'Hardware', '320', '$95.00', '$229.00', '58.5%', 'Low Stock'],
      ['SKU-9925', 'Ergonomic Standing Desk Frame', 'Furniture', '180', '$160.00', '$399.00', '59.9%', 'In Stock'],
      ['SKU-9926', 'Mesh Executive Task Chair', 'Furniture', '210', '$110.00', '$289.00', '61.9%', 'In Stock'],
      ['SKU-9927', 'USB-C 100W GaN Fast Charger', 'Power', '2,400', '$12.80', '$44.99', '71.5%', 'In Stock'],
      ['SKU-9928', '2TB NVMe PCIe 5.0 Solid Drive', 'Storage', '640', '$84.00', '$179.99', '53.3%', 'In Stock'],
      ['SKU-9929', 'Wireless Precision Mouse Dark', 'Accessories', '1,100', '$24.50', '$69.90', '64.9%', 'In Stock'],
      ['SKU-9930', '1080p 60fps HDR Webcam Pro', 'Video', '490', '$38.00', '$99.00', '61.6%', 'In Stock'],
    ];

    drawStyledTable(page, fontBold, fontRegular, {
      startX: 36,
      startY: height - 120,
      colWidths: [58, 125, 68, 38, 52, 60, 52, 54],
      headers,
      rows,
      title: 'Current Active Product Line Items & Warehouse Stock',
      headerBgColor: rgb(0.04, 0.45, 0.38),
      altRowColor: rgb(0.95, 0.98, 0.97),
    });

    const pdfBytes = await pdfDoc.save();
    return new File([pdfBytes], 'Warehouse_Inventory_and_Pricing_Matrix.pdf', { type: 'application/pdf' });
  }

  // Default: Financial Quarterly Statement (2 pages)
  const page1 = pdfDoc.addPage([612, 792]);
  const { width, height } = page1.getSize();

  // Page 1 Header
  page1.drawRectangle({
    x: 36,
    y: height - 85,
    width: width - 72,
    height: 50,
    color: rgb(0.08, 0.15, 0.28),
  });

  page1.drawText('APEX HOLDINGS INC. - CONSOLIDATED STATEMENT OF OPERATIONS', {
    x: 50,
    y: height - 58,
    size: 12,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page1.drawText('Three Months Ended June 30, 2026 and 2025 (in Thousands USD)', {
    x: 50,
    y: height - 73,
    size: 9,
    font: fontRegular,
    color: rgb(0.68, 0.78, 0.9),
  });

  // Table 1: Consolidated Revenue Stream
  const headers1 = ['REVENUE STREAM', 'Q3 2026', 'Q2 2026', 'Q3 2025', 'YOY GROWTH', '% OF TOTAL'];
  const rows1 = [
    ['Enterprise SaaS Subscription', '$42,850.00', '$39,200.00', '$33,500.00', '+27.9%', '54.2%'],
    ['Cloud Infrastructure Services', '$22,400.00', '$20,150.00', '$16,800.00', '+33.3%', '28.3%'],
    ['Professional Consulting & Setup', '$8,950.00', '$8,400.00', '$7,900.00', '+13.3%', '11.3%'],
    ['API Licensing & OEM Royalties', '$4,900.00', '$4,350.00', '$3,600.00', '+36.1%', '6.2%'],
    ['TOTAL CONSOLIDATED REVENUE', '$79,100.00', '$72,100.00', '$61,800.00', '+28.0%', '100.0%'],
  ];

  drawStyledTable(page1, fontBold, fontRegular, {
    startX: 36,
    startY: height - 110,
    colWidths: [160, 75, 75, 75, 75, 80],
    headers: headers1,
    rows: rows1,
    title: 'Table 1: Revenue by Category (USD in Thousands)',
    headerBgColor: rgb(0.12, 0.28, 0.49),
    altRowColor: rgb(0.96, 0.97, 0.99),
  });

  // Table 2: Operating Expenses & Margins
  const headers2 = ['EXPENSE CATEGORY', 'Q3 2026', 'Q2 2026', 'Q3 2025', 'VAR ($)', 'VAR (%)'];
  const rows2 = [
    ['Research & Development (R&D)', '$18,200.00', '$16,900.00', '$14,100.00', '+$4,100.00', '+29.1%'],
    ['Sales & Global Marketing', '$14,350.00', '$13,800.00', '$12,400.00', '+$1,950.00', '+15.7%'],
    ['General & Administrative (G&A)', '$6,100.00', '$5,950.00', '$5,400.00', '+$700.00', '+13.0%'],
    ['Customer Success & Support', '$3,850.00', '$3,600.00', '$3,200.00', '+$650.00', '+20.3%'],
    ['TOTAL OPERATING EXPENSES', '$42,500.00', '$40,250.00', '$35,100.00', '+$7,400.00', '+21.1%'],
  ];

  drawStyledTable(page1, fontBold, fontRegular, {
    startX: 36,
    startY: height - 320,
    colWidths: [160, 75, 75, 75, 75, 80],
    headers: headers2,
    rows: rows2,
    title: 'Table 2: Operating Expense Breakdown',
    headerBgColor: rgb(0.18, 0.22, 0.3),
    altRowColor: rgb(0.97, 0.97, 0.98),
  });

  // Table 3: Profitability Metrics
  const headers3 = ['PROFITABILITY METRIC', 'Q3 2026', 'Q2 2026', 'Q3 2025', 'TARGET', 'STATUS'];
  const rows3 = [
    ['Gross Profit Margin', '74.2%', '72.8%', '71.0%', '72.0%', 'Exceeded'],
    ['Operating Income (EBIT)', '$36,600.00', '$31,850.00', '$26,700.00', '$32,000.00', 'Exceeded'],
    ['Operating Margin %', '46.3%', '44.2%', '43.2%', '45.0%', 'Exceeded'],
    ['Net Income Before Tax', '$34,900.00', '$30,400.00', '$25,200.00', '$30,000.00', 'Exceeded'],
    ['Effective Income Tax Rate', '18.4%', '18.2%', '19.1%', '19.0%', 'Favorable'],
  ];

  drawStyledTable(page1, fontBold, fontRegular, {
    startX: 36,
    startY: height - 520,
    colWidths: [160, 75, 75, 75, 75, 80],
    headers: headers3,
    rows: rows3,
    title: 'Table 3: Net Operating Income & Profitability Summary',
    headerBgColor: rgb(0.08, 0.4, 0.3),
    altRowColor: rgb(0.95, 0.98, 0.96),
  });

  // Page 2: Balance Sheet Assets & Liabilities
  const page2 = pdfDoc.addPage([612, 792]);

  // Page 2 Header
  page2.drawRectangle({
    x: 36,
    y: height - 85,
    width: width - 72,
    height: 50,
    color: rgb(0.08, 0.15, 0.28),
  });

  page2.drawText('APEX HOLDINGS INC. - CONSOLIDATED BALANCE SHEET ASSETS', {
    x: 50,
    y: height - 58,
    size: 12,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page2.drawText('As of June 30, 2026 and December 31, 2025 (in Thousands USD)', {
    x: 50,
    y: height - 73,
    size: 9,
    font: fontRegular,
    color: rgb(0.68, 0.78, 0.9),
  });

  const headers4 = ['ASSET CATEGORY', 'JUNE 30, 2026', 'DEC 31, 2025', 'CHANGE ($)', 'CHANGE (%)'];
  const rows4 = [
    ['Cash and Cash Equivalents', '$142,500.00', '$118,200.00', '+$24,300.00', '+20.6%'],
    ['Short-term Marketable Securities', '$68,400.00', '$74,100.00', '-$5,700.00', '-7.7%'],
    ['Accounts Receivable, Net', '$38,900.00', '$32,600.00', '+$6,300.00', '+19.3%'],
    ['Prepaid Expenses & Other', '$12,400.00', '$11,100.00', '+$1,300.00', '+11.7%'],
    ['TOTAL CURRENT ASSETS', '$262,200.00', '$236,000.00', '+$26,200.00', '+11.1%'],
    ['Property, Plant and Equipment', '$45,800.00', '$41,200.00', '+$4,600.00', '+11.2%'],
    ['Operating Lease Right-of-Use', '$28,400.00', '$30,100.00', '-$1,700.00', '-5.6%'],
    ['Intangible Assets & Goodwill', '$89,600.00', '$89,600.00', '$0.00', '0.0%'],
    ['TOTAL CONSOLIDATED ASSETS', '$426,000.00', '$396,900.00', '+$29,100.00', '+7.3%'],
  ];

  drawStyledTable(page2, fontBold, fontRegular, {
    startX: 36,
    startY: height - 110,
    colWidths: [180, 90, 90, 90, 90],
    headers: headers4,
    rows: rows4,
    title: 'Table 4: Summary of Consolidated Assets',
    headerBgColor: rgb(0.12, 0.28, 0.49),
    altRowColor: rgb(0.96, 0.97, 0.99),
  });

  const pdfBytes = await pdfDoc.save();
  return new File([pdfBytes], 'Q3_Corporate_Financial_Statement.pdf', { type: 'application/pdf' });
}

function drawStyledTable(
  page: any,
  fontBold: any,
  fontRegular: any,
  config: {
    startX: number;
    startY: number;
    colWidths: number[];
    headers: string[];
    rows: string[][];
    title: string;
    headerBgColor: any;
    altRowColor: any;
  }
) {
  const rowHeight = 18;
  const totalWidth = config.colWidths.reduce((a, b) => a + b, 0);

  // Table Title
  page.drawText(config.title, {
    x: config.startX,
    y: config.startY,
    size: 10,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  let currentY = config.startY - 14;

  // Header Background
  page.drawRectangle({
    x: config.startX,
    y: currentY - rowHeight + 4,
    width: totalWidth,
    height: rowHeight,
    color: config.headerBgColor,
  });

  // Header Text
  let currX = config.startX;
  for (let i = 0; i < config.headers.length; i++) {
    const w = config.colWidths[i];
    const text = config.headers[i];
    page.drawText(text, {
      x: currX + 4,
      y: currentY - rowHeight + 9,
      size: 8,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    currX += w;
  }

  currentY -= rowHeight;

  // Rows
  for (let r = 0; r < config.rows.length; r++) {
    const row = config.rows[r];
    const isTotalRow = row[0].includes('TOTAL');

    // Row background
    if (isTotalRow) {
      page.drawRectangle({
        x: config.startX,
        y: currentY - rowHeight + 4,
        width: totalWidth,
        height: rowHeight,
        color: rgb(0.92, 0.95, 0.98),
        borderColor: rgb(0.6, 0.7, 0.85),
        borderWidth: 0.5,
      });
    } else if (r % 2 === 1) {
      page.drawRectangle({
        x: config.startX,
        y: currentY - rowHeight + 4,
        width: totalWidth,
        height: rowHeight,
        color: config.altRowColor,
      });
    }

    // Bottom border rule
    page.drawLine({
      start: { x: config.startX, y: currentY - rowHeight + 4 },
      end: { x: config.startX + totalWidth, y: currentY - rowHeight + 4 },
      thickness: isTotalRow ? 1 : 0.4,
      color: rgb(0.8, 0.85, 0.9),
    });

    let cellX = config.startX;
    for (let c = 0; c < row.length; c++) {
      const w = config.colWidths[c];
      const val = row[c] || '';
      const isNum = /^[\$+-]?\d/.test(val.trim());

      page.drawText(val, {
        x: isNum ? cellX + w - fontRegular.widthOfTextAtSize(val, 7.5) - 6 : cellX + 4,
        y: currentY - rowHeight + 9,
        size: 7.5,
        font: isTotalRow ? fontBold : fontRegular,
        color: isTotalRow ? rgb(0.05, 0.1, 0.2) : rgb(0.15, 0.2, 0.28),
      });

      cellX += w;
    }

    currentY -= rowHeight;
  }
}
