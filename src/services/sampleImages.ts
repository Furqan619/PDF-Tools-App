/**
 * Helper to generate high quality sample image files (Receipt, Photo, Diagram, Invoice, Note)
 * using HTML Canvas in-memory so users can test Image-to-PDF packaging immediately.
 */

export interface SampleImagePreset {
  id: string;
  name: string;
  type: string;
  category: string;
  width: number;
  height: number;
}

export function createSampleReceiptImage(): File {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 900;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#FAFAFA';
  ctx.fillRect(0, 0, 600, 900);

  // Border & Shadow simulation
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 580, 880);

  // Receipt Header
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('METRO CAFE & BISTRO', 300, 65);

  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.fillText('1042 Market Street, San Francisco, CA', 300, 95);
  ctx.fillText('Tel: (415) 555-0199 | Store #882', 300, 120);

  // Divider dashed line
  ctx.beginPath();
  ctx.setLineDash([6, 6]);
  ctx.moveTo(30, 145);
  ctx.lineTo(570, 145);
  ctx.strokeStyle = '#CBD5E1';
  ctx.stroke();
  ctx.setLineDash([]);

  // Transaction details
  ctx.textAlign = 'left';
  ctx.font = '14px monospace';
  ctx.fillStyle = '#334155';
  ctx.fillText('Date: 2026-08-31 12:44 PM', 40, 180);
  ctx.fillText('Cashier: Alex M.    Order #4190', 40, 205);
  ctx.fillText('Table: Patio 04     Dine-In', 40, 230);

  // Items table
  ctx.font = 'bold 14px monospace';
  ctx.fillText('ITEM                     QTY    PRICE', 40, 275);
  ctx.beginPath();
  ctx.moveTo(40, 285);
  ctx.lineTo(560, 285);
  ctx.strokeStyle = '#94A3B8';
  ctx.stroke();

  ctx.font = '14px monospace';
  ctx.fillStyle = '#1E293B';
  const items = [
    { name: 'Avocado Tartine Toast', qty: '1', price: '$14.50' },
    { name: 'Oat Milk Flat White (L)', qty: '2', price: '$12.00' },
    { name: 'Smoked Salmon Benedict', qty: '1', price: '$18.75' },
    { name: 'Fresh Orange Mimosa', qty: '2', price: '$16.00' },
    { name: 'Matcha Chia Pudding', qty: '1', price: '$8.50' },
  ];

  let y = 315;
  for (const item of items) {
    ctx.fillText(item.name.padEnd(25, ' '), 40, y);
    ctx.fillText(item.qty.padEnd(6, ' '), 370, y);
    ctx.fillText(item.price.padStart(10, ' '), 460, y);
    y += 32;
  }

  // Subtotal & Total
  ctx.beginPath();
  ctx.moveTo(40, y + 10);
  ctx.lineTo(560, y + 10);
  ctx.strokeStyle = '#CBD5E1';
  ctx.stroke();

  y += 40;
  ctx.fillText('Subtotal:                              $69.75', 40, y);
  y += 26;
  ctx.fillText('City Tax (8.5%):                        $5.93', 40, y);
  y += 26;
  ctx.fillText('Gratuity Tip (18%):                    $12.55', 40, y);
  y += 36;
  ctx.font = 'bold 20px monospace';
  ctx.fillText('TOTAL DUE:                             $88.23', 40, y);

  // Barcode simulation
  y += 70;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0F172A';
  for (let i = 80; i < 520; i += 6) {
    const width = (i % 12 === 0 || i % 18 === 0) ? 4 : 2;
    ctx.fillRect(i, y, width, 55);
  }
  ctx.font = '12px monospace';
  ctx.fillStyle = '#64748B';
  ctx.fillText('* 9 8 4 1 0 2 8 4 7 1 9 3 0 2 *', 300, y + 75);

  // Stamp badge
  ctx.save();
  ctx.translate(450, 780);
  ctx.rotate(-0.15);
  ctx.strokeStyle = '#059669';
  ctx.lineWidth = 3;
  ctx.strokeRect(-80, -25, 160, 50);
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#059669';
  ctx.fillText('PAID - VISA', 0, 7);
  ctx.restore();

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  return dataUrlToFile(dataUrl, '1_Business_Lunch_Receipt.jpg', 'image/jpeg');
}

export function createSampleWhiteboardDiagram(): File {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 640;
  const ctx = canvas.getContext('2d')!;

  // Whiteboard background with subtle grid
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, 960, 640);

  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = 1;
  for (let x = 0; x < 960; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 640);
    ctx.stroke();
  }
  for (let y = 0; y < 640; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(960, y);
    ctx.stroke();
  }

  // Header Title
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#1E293B';
  ctx.fillText('Microservices Architecture Flowchart (Q3)', 60, 60);

  // Node 1: Client Gateway
  drawBox(ctx, 60, 160, 200, 110, '#3B82F6', '#EFF6FF', 'API Gateway', 'Reverse Proxy & Auth');
  // Node 2: App Engine Service
  drawBox(ctx, 380, 160, 200, 110, '#10B981', '#ECFDF5', 'PDF Engine', 'Vite & WASM Pipeline');
  // Node 3: Storage Bucket
  drawBox(ctx, 700, 160, 200, 110, '#8B5CF6', '#F5F3FF', 'Document Store', 'Encrypted Cache');
  // Node 4: OCR Neural Cluster
  drawBox(ctx, 380, 380, 200, 110, '#F59E0B', '#FFFBEB', 'Neural OCR', 'Tesseract & Spatial Box');

  // Connecting arrows
  drawArrow(ctx, 260, 215, 380, 215, '#64748B');
  drawArrow(ctx, 580, 215, 700, 215, '#64748B');
  drawArrow(ctx, 480, 270, 480, 380, '#64748B');

  // Annotation stamp
  ctx.font = 'italic 14px sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.fillText('Author: Platform Lead | Status: Approved for Production 2026', 60, 580);

  const dataUrl = canvas.toDataURL('image/png');
  return dataUrlToFile(dataUrl, '2_System_Architecture_Diagram.png', 'image/png');
}

export function createSampleNaturePhoto(): File {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext('2d')!;

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 400);
  skyGrad.addColorStop(0, '#0284C7');
  skyGrad.addColorStop(0.6, '#38BDF8');
  skyGrad.addColorStop(1, '#BAE6FD');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 800, 400);

  // Sun
  ctx.beginPath();
  ctx.arc(650, 120, 50, 0, Math.PI * 2);
  ctx.fillStyle = '#FDE047';
  ctx.fill();

  // Mountain layer 1 (distant)
  ctx.beginPath();
  ctx.moveTo(0, 320);
  ctx.lineTo(200, 180);
  ctx.lineTo(420, 340);
  ctx.lineTo(620, 190);
  ctx.lineTo(800, 300);
  ctx.lineTo(800, 400);
  ctx.lineTo(0, 400);
  ctx.fillStyle = '#64748B';
  ctx.fill();

  // Mountain layer 2 (front)
  ctx.beginPath();
  ctx.moveTo(0, 380);
  ctx.lineTo(280, 240);
  ctx.lineTo(520, 400);
  ctx.lineTo(800, 350);
  ctx.lineTo(800, 420);
  ctx.lineTo(0, 420);
  ctx.fillStyle = '#334155';
  ctx.fill();

  // Lake reflection
  const waterGrad = ctx.createLinearGradient(0, 400, 0, 600);
  waterGrad.addColorStop(0, '#0284C7');
  waterGrad.addColorStop(1, '#0C4A6E');
  ctx.fillStyle = waterGrad;
  ctx.fillRect(0, 400, 800, 200);

  // Foreground hills & Pine trees
  ctx.fillStyle = '#064E3B';
  for (let x = 30; x < 800; x += 60) {
    const h = 40 + (x % 30) * 2;
    ctx.beginPath();
    ctx.moveTo(x, 460);
    ctx.lineTo(x + 15, 460 - h);
    ctx.lineTo(x + 30, 460);
    ctx.fill();
  }

  // Photo Caption overlay
  ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
  ctx.fillRect(30, 520, 740, 50);
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#F8FAFC';
  ctx.fillText('Alpine Lake Wilderness Panorama • Shot on 35mm Lens', 50, 552);

  const dataUrl = canvas.toDataURL('image/webp', 0.9);
  return dataUrlToFile(dataUrl, '3_Alpine_Wilderness_Landscape.webp', 'image/webp');
}

export function createSampleBusinessCard(): File {
  const canvas = document.createElement('canvas');
  canvas.width = 700;
  canvas.height = 420;
  const ctx = canvas.getContext('2d')!;

  // Dark modern slate card
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, 700, 420);

  // Gradient accent strip
  const grad = ctx.createLinearGradient(0, 0, 700, 0);
  grad.addColorStop(0, '#EC4899');
  grad.addColorStop(0.5, '#8B5CF6');
  grad.addColorStop(1, '#3B82F6');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 700, 8);

  // Logo geometric icon
  ctx.fillStyle = '#EC4899';
  ctx.beginPath();
  ctx.arc(80, 80, 24, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#8B5CF6';
  ctx.beginPath();
  ctx.arc(105, 80, 20, 0, Math.PI * 2);
  ctx.fill();

  // Name and Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('SARAH CHEN', 60, 160);

  ctx.fillStyle = '#38BDF8';
  ctx.font = '14px sans-serif';
  ctx.fillText('VP of Engineering & Product Experience', 60, 190);

  // Contact Info
  ctx.fillStyle = '#94A3B8';
  ctx.font = '13px monospace';
  ctx.fillText('Email:  sarah.chen@novatech-labs.io', 60, 260);
  ctx.fillText('Phone:  +1 (555) 392-8819', 60, 290);
  ctx.fillText('Web:    https://novatech-labs.io', 60, 320);
  ctx.fillText('Office: 500 Howard St, Fl 14, San Francisco', 60, 350);

  // QR Code placeholder
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(540, 240, 100, 100);
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(550, 250, 80, 80);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(560, 260, 60, 60);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  return dataUrlToFile(dataUrl, '4_Executive_Business_Card.jpg', 'image/jpeg');
}

/**
 * Returns complete bundle of sample images
 */
export function generateSampleImagesGallery(): File[] {
  return [
    createSampleReceiptImage(),
    createSampleWhiteboardDiagram(),
    createSampleNaturePhoto(),
    createSampleBusinessCard(),
  ];
}

function drawBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  borderColor: string,
  bgColor: string,
  title: string,
  sub: string
) {
  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(title, x + 16, y + 42);

  ctx.fillStyle = '#64748B';
  ctx.font = '12px sans-serif';
  ctx.fillText(sub, x + 16, y + 72);
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  // Arrow head
  const headlen = 8;
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
  ctx.fillStyle = color;
  ctx.fill();
}

function dataUrlToFile(dataUrl: string, filename: string, mimeType: string): File {
  const arr = dataUrl.split(',');
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mimeType });
}
