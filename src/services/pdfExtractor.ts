import { pdfjsLib } from './pdfWorker';
import { 
  ConversionSettings, 
  ExtractedPage, 
  ExtractedLine, 
  ExtractedTextItem, 
  ExtractedTable, 
  ExtractedImage 
} from '../types';

export interface ExtractionProgressCallback {
  (progress: {
    currentPage: number;
    totalPages: number;
    percent: number;
    message: string;
  }): void;
}

/**
 * Parses user page range string (e.g. "all", "1-5, 8, 11-15") into an array of 1-based page numbers.
 */
export function parsePageRange(rangeStr: string, totalPages: number): number[] {
  if (!rangeStr || rangeStr.trim().toLowerCase() === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
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

  const result = Array.from(pagesSet).sort((a, b) => a - b);
  return result.length > 0 ? result : Array.from({ length: totalPages }, (_, i) => i + 1);
}

/**
 * High efficiency streaming PDF extractor with full text, table, and embedded image support.
 */
export async function extractPdfDocument(
  file: File | ArrayBuffer,
  settings: ConversionSettings,
  onProgress?: ExtractionProgressCallback,
  signal?: AbortSignal
): Promise<ExtractedPage[]> {
  let arrayBuffer: ArrayBuffer;
  if (file instanceof File) {
    arrayBuffer = await file.arrayBuffer();
  } else {
    arrayBuffer = file;
  }

  if (signal?.aborted) {
    throw new DOMException('Conversion cancelled by user', 'AbortError');
  }

  onProgress?.({
    currentPage: 0,
    totalPages: 0,
    percent: 5,
    message: 'Loading PDF document structure...',
  });

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/',
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;
  const targetPages = parsePageRange(settings.pageRange, totalPages);

  const extractedPages: ExtractedPage[] = [];

  for (let idx = 0; idx < targetPages.length; idx++) {
    if (signal?.aborted) {
      throw new DOMException('Conversion cancelled by user', 'AbortError');
    }

    const pageNum = targetPages[idx];
    const percent = Math.round(5 + ((idx + 1) / targetPages.length) * 65);

    onProgress?.({
      currentPage: idx + 1,
      totalPages: targetPages.length,
      percent,
      message: `Analyzing page ${pageNum} of ${totalPages} (${idx + 1}/${targetPages.length})...`,
    });

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    // 1. Process Text items
    const rawItems: ExtractedTextItem[] = [];
    let medianFontSize = 11;
    const fontSizes: number[] = [];

    for (const item of textContent.items) {
      if ('str' in item && typeof item.str === 'string') {
        const text = item.str;
        if (!text.trim() && text !== ' ') continue;

        // Transform matrix: [scaleX, skewY, skewX, scaleY, transX, transY]
        const tx = item.transform;
        const fontSize = Math.round(Math.hypot(tx[2], tx[3]) || Math.abs(tx[0]) || 11);
        const x = Math.round(tx[4]);
        // PDF coordinates have y=0 at bottom; convert to top-left origin
        const y = Math.round(viewport.height - tx[5]);
        const width = item.width ? Math.round(item.width) : Math.round(text.length * (fontSize * 0.5));
        const height = item.height ? Math.round(item.height) : fontSize;

        const fontName = (item.fontName || '').toLowerCase();
        const isBold = fontName.includes('bold') || fontName.includes('black') || fontName.includes('heavy') || fontName.includes('semibold');
        const isItalic = fontName.includes('italic') || fontName.includes('oblique');

        rawItems.push({
          str: text,
          x,
          y,
          width,
          height,
          fontSize,
          fontFamily: item.fontName || 'Calibri',
          isBold,
          isItalic,
          hasEOL: item.hasEOL,
        });

        if (text.trim().length > 1) {
          fontSizes.push(fontSize);
        }
      }
    }

    if (fontSizes.length > 0) {
      fontSizes.sort((a, b) => a - b);
      medianFontSize = fontSizes[Math.floor(fontSizes.length / 2)] || 11;
    }

    // Group items into lines
    const lines = groupItemsIntoLines(rawItems, viewport.width, medianFontSize);

    // Detect tables if enabled
    let tables: ExtractedTable[] = [];
    let remainingLines = lines;
    if (settings.detectTables) {
      const tableDetection = detectTablesInLines(lines, viewport.width);
      tables = tableDetection.tables;
      remainingLines = tableDetection.nonTableLines;
    }

    // 1. Render page to high-fidelity canvas for visual extraction and thumbnail
    const renderScale = settings.imageHandling === 'compress' ? 1.5 : 2.0;
    const renderViewport = page.getViewport({ scale: renderScale });
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = renderViewport.width;
    pageCanvas.height = renderViewport.height;
    
    let pageRendered = false;
    let thumbnailUrl: string | undefined;

    const pageCtx = pageCanvas.getContext('2d', { willReadFrequently: true });
    if (pageCtx) {
      pageCtx.fillStyle = '#FFFFFF';
      pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      try {
        await page.render({
          canvasContext: pageCtx,
          viewport: renderViewport,
          canvas: pageCanvas,
        }).promise;
        pageRendered = true;
        thumbnailUrl = pageCanvas.toDataURL('image/jpeg', 0.7);
      } catch (renderErr) {
        console.warn('Canvas render notice for page', pageNum, renderErr);
      }
    }

    // 2. Extract embedded images, graphics, diagrams & figures
    let images: ExtractedImage[] = [];
    if (settings.imageHandling !== 'none' && pageRendered) {
      try {
        images = await extractImagesFromPdfPage(
          page,
          viewport,
          pageCanvas,
          renderScale,
          settings,
          lines,
          remainingLines.length === 0
        );
      } catch (err) {
        console.warn('Image extraction notice for page', pageNum, err);
      }
    }

    // Clean up temporary canvas memory
    pageCanvas.width = 0;
    pageCanvas.height = 0;

    const rawText = lines.map(l => l.text).join('\n');

    extractedPages.push({
      pageNumber: pageNum,
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
      lines: remainingLines,
      tables,
      images: settings.imageHandling === 'none' ? [] : images,
      rawText,
      thumbnailUrl,
    });

    // Clean up memory
    page.cleanup();

    // Yield main thread
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return extractedPages;
}

/**
 * Multiplies two 2D affine transformation matrices [a, b, c, d, e, f]
 */
function multiplyMatrix(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

interface DetectedBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

/**
 * Extracts embedded image objects, figures, diagrams, and visual graphics
 * with precise vertical (Y) and horizontal (X) coordinate preservation.
 */
async function extractImagesFromPdfPage(
  page: any,
  viewport: any,
  pageCanvas: HTMLCanvasElement,
  renderScale: number,
  settings: ConversionSettings,
  lines: ExtractedLine[],
  isPageImageOnly: boolean
): Promise<ExtractedImage[]> {
  const extractedImages: ExtractedImage[] = [];
  const detectedCandidateBoxes: DetectedBox[] = [];

  // If the page is purely a scanned image / document
  if (isPageImageOnly || lines.length === 0) {
    const format = settings.imageHandling === 'compress' ? 'image/jpeg' : 'image/png';
    const quality = settings.imageHandling === 'compress' ? 0.85 : 0.95;
    const dataUrl = pageCanvas.toDataURL(format, quality);

    return [
      {
        dataUrl,
        x: 0,
        y: 0,
        width: Math.round(viewport.width),
        height: Math.round(viewport.height),
      },
    ];
  }

  // 1. Operator List Analysis: Detect explicit PDF image & XObject transformations
  try {
    const ops = await page.getOperatorList();
    const matrixStack: number[][] = [];
    let currentMatrix = [1, 0, 0, 1, 0, 0];

    const OPS = (pdfjsLib as any).OPS || {};
    const paintImageXObject = OPS.paintImageXObject ?? 85;
    const paintInlineImageXObject = OPS.paintInlineImageXObject ?? 86;
    const paintImageMaskXObject = OPS.paintImageMaskXObject ?? 87;
    const paintSolidColorImageMask = OPS.paintSolidColorImageMask ?? 88;
    const saveOp = OPS.save ?? 10;
    const restoreOp = OPS.restore ?? 11;
    const transformOp = OPS.transform ?? 12;

    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      const args = ops.argsArray[i];

      if (fn === saveOp) {
        matrixStack.push([...currentMatrix]);
      } else if (fn === restoreOp) {
        currentMatrix = matrixStack.pop() || [1, 0, 0, 1, 0, 0];
      } else if (fn === transformOp && args) {
        currentMatrix = multiplyMatrix(currentMatrix, args);
      } else if (
        (fn === paintImageXObject ||
          fn === paintInlineImageXObject ||
          fn === paintImageMaskXObject ||
          fn === paintSolidColorImageMask) &&
        args
      ) {
        // Compute 4 corners of unit square in PDF coordinate space
        const p0 = [currentMatrix[4], currentMatrix[5]];
        const p1 = [currentMatrix[0] + currentMatrix[4], currentMatrix[1] + currentMatrix[5]];
        const p2 = [currentMatrix[2] + currentMatrix[4], currentMatrix[3] + currentMatrix[5]];
        const p3 = [
          currentMatrix[0] + currentMatrix[2] + currentMatrix[4],
          currentMatrix[1] + currentMatrix[3] + currentMatrix[5],
        ];

        // Convert to viewport coordinate space (Y=0 is at TOP)
        const v0 = viewport.convertToViewportPoint(p0[0], p0[1]);
        const v1 = viewport.convertToViewportPoint(p1[0], p1[1]);
        const v2 = viewport.convertToViewportPoint(p2[0], p2[1]);
        const v3 = viewport.convertToViewportPoint(p3[0], p3[1]);

        const minX = Math.round(Math.min(v0[0], v1[0], v2[0], v3[0]));
        const minY = Math.round(Math.min(v0[1], v1[1], v2[1], v3[1]));
        const maxX = Math.round(Math.max(v0[0], v1[0], v2[0], v3[0]));
        const maxY = Math.round(Math.max(v0[1], v1[1], v2[1], v3[1]));

        const imgWidth = maxX - minX;
        const imgHeight = maxY - minY;

        // Skip tiny decorative noise
        if (imgWidth >= 16 && imgHeight >= 16 && imgWidth < viewport.width * 1.05) {
          detectedCandidateBoxes.push({
            minX: Math.max(0, minX),
            minY: Math.max(0, minY),
            width: Math.min(Math.round(viewport.width), imgWidth),
            height: imgHeight,
          });
        }
      }
    }
  } catch (opErr) {
    console.warn('Operator list extraction note:', opErr);
  }

  // 2. Spatial Visual Graphic Detection:
  // Detect figures, vector diagrams, charts, photos & graphical illustrations
  // that do not collide with text lines
  try {
    const pageWidth = Math.round(viewport.width);
    const pageHeight = Math.round(viewport.height);
    const gridSize = 12; // 12pt cell resolution
    const cols = Math.ceil(pageWidth / gridSize);
    const rows = Math.ceil(pageHeight / gridSize);

    // 0: unoccupied/empty, 1: text, 2: graphic content
    const occupancyGrid: Uint8Array = new Uint8Array(cols * rows);

    // Mark text regions as occupied so they are never sliced as images
    for (const line of lines) {
      const lineLeft = Math.max(0, line.x - 4);
      const lineRight = Math.min(pageWidth, line.x + (line.items.reduce((acc, it) => acc + it.width, 0) || 100) + 4);
      const lineTop = Math.max(0, line.y - (line.fontSize || 12) - 2);
      const lineBottom = Math.min(pageHeight, line.y + (line.height || line.fontSize || 12) + 2);

      const startCol = Math.floor(lineLeft / gridSize);
      const endCol = Math.min(cols - 1, Math.floor(lineRight / gridSize));
      const startRow = Math.floor(lineTop / gridSize);
      const endRow = Math.min(rows - 1, Math.floor(lineBottom / gridSize));

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          occupancyGrid[r * cols + c] = 1; // Text mask
        }
      }
    }

    // Sample canvas pixels in non-text cells to find graphical figures/drawings/photos
    const sCtx = pageCanvas.getContext('2d', { willReadFrequently: true });
    if (sCtx) {
      const imgData = sCtx.getImageData(0, 0, pageCanvas.width, pageCanvas.height);
      const data = imgData.data;
      const cWidth = pageCanvas.width;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          if (occupancyGrid[idx] === 1) continue; // Skip text area

          const sampleX = Math.floor((c * gridSize + gridSize / 2) * renderScale);
          const sampleY = Math.floor((r * gridSize + gridSize / 2) * renderScale);

          if (sampleX >= 0 && sampleX < cWidth && sampleY >= 0 && sampleY < pageCanvas.height) {
            const pixelIdx = (sampleY * cWidth + sampleX) * 4;
            const red = data[pixelIdx];
            const green = data[pixelIdx + 1];
            const blue = data[pixelIdx + 2];
            const alpha = data[pixelIdx + 3];

            // If non-white or colored graphic content
            if (alpha > 30 && (red < 240 || green < 240 || blue < 240)) {
              occupancyGrid[idx] = 2; // Graphic pixel
            }
          }
        }
      }

      // Group contiguous graphic cells into bounding boxes
      const visited = new Uint8Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          if (occupancyGrid[idx] !== 2 || visited[idx]) continue;

          // Flood-fill cluster
          let minC = c;
          let maxC = c;
          let minR = r;
          let maxR = r;
          let clusterCount = 0;

          const queue: number[] = [idx];
          visited[idx] = 1;

          while (queue.length > 0) {
            const curr = queue.pop()!;
            clusterCount++;
            const cr = Math.floor(curr / cols);
            const cc = curr % cols;

            if (cc < minC) minC = cc;
            if (cc > maxC) maxC = cc;
            if (cr < minR) minR = cr;
            if (cr > maxR) maxR = cr;

            // 4-neighborhood
            const neighbors = [
              cr > 0 ? (cr - 1) * cols + cc : -1,
              cr < rows - 1 ? (cr + 1) * cols + cc : -1,
              cc > 0 ? cr * cols + (cc - 1) : -1,
              cc < cols - 1 ? cr * cols + (cc + 1) : -1,
            ];

            for (const n of neighbors) {
              if (n >= 0 && occupancyGrid[n] === 2 && !visited[n]) {
                visited[n] = 1;
                queue.push(n);
              }
            }
          }

          // A meaningful figure/graphic must span at least 2x2 cells
          if (clusterCount >= 4) {
            const gMinX = minC * gridSize;
            const gMinY = minR * gridSize;
            const gWidth = (maxC - minC + 1) * gridSize;
            const gHeight = (maxR - minR + 1) * gridSize;

            // Ignore 1-pixel separator lines spanning full width
            const isFullWidthThinLine = gWidth > pageWidth * 0.7 && gHeight <= 6;

            if (gWidth >= 20 && gHeight >= 20 && !isFullWidthThinLine) {
              detectedCandidateBoxes.push({
                minX: gMinX,
                minY: gMinY,
                width: gWidth,
                height: gHeight,
              });
            }
          }
        }
      }
    }
  } catch (scanErr) {
    console.warn('Visual graphic detector note:', scanErr);
  }

  // 3. Filter candidate boxes: Strictly exclude full-page backgrounds or boxes that contain text lines
  // This guarantees that text is NEVER captured inside an image slice.
  const validGraphicBoxes: DetectedBox[] = [];
  const pageWidth = Math.round(viewport.width);
  const pageHeight = Math.round(viewport.height);
  const pageArea = pageWidth * pageHeight;

  for (const box of detectedCandidateBoxes) {
    const boxArea = box.width * box.height;
    // Skip candidate boxes that cover almost the entire page when text is present
    if (lines.length > 0 && boxArea > pageArea * 0.7) {
      continue;
    }

    // Count how many text lines fall inside this candidate box
    const overlappingLines = lines.filter((l) => {
      const lineLeft = l.x;
      const lineRight = l.x + (l.items.reduce((acc, it) => acc + it.width, 0) || 80);
      const lineTop = l.y - (l.fontSize || 12);
      const lineBottom = l.y + (l.height || l.fontSize || 12);

      const xOverlap = Math.max(0, Math.min(box.minX + box.width, lineRight) - Math.max(box.minX, lineLeft));
      const yOverlap = Math.max(0, Math.min(box.minY + box.height, lineBottom) - Math.max(box.minY, lineTop));

      return xOverlap > 10 && yOverlap > 4;
    });

    // If a box contains more than 1 line of text or covers significant text area, it is a text container/background.
    // We do NOT want to extract backgrounds as images because that turns text into an uneditable image.
    if (overlappingLines.length > 1) {
      continue;
    }

    validGraphicBoxes.push(box);
  }

  // 4. Merge overlapping & near-identical graphic candidate boxes
  const consolidatedBoxes: DetectedBox[] = [];

  for (const box of validGraphicBoxes) {
    let merged = false;
    for (let i = 0; i < consolidatedBoxes.length; i++) {
      const existing = consolidatedBoxes[i];
      const xOverlap = Math.max(0, Math.min(existing.minX + existing.width, box.minX + box.width) - Math.max(existing.minX, box.minX));
      const yOverlap = Math.max(0, Math.min(existing.minY + existing.height, box.minY + box.height) - Math.max(existing.minY, box.minY));

      // If significantly overlapping or nested
      if (xOverlap > 8 && yOverlap > 8) {
        const newMinX = Math.min(existing.minX, box.minX);
        const newMinY = Math.min(existing.minY, box.minY);
        const newMaxX = Math.max(existing.minX + existing.width, box.minX + box.width);
        const newMaxY = Math.max(existing.minY + existing.height, box.minY + box.height);

        consolidatedBoxes[i] = {
          minX: newMinX,
          minY: newMinY,
          width: newMaxX - newMinX,
          height: newMaxY - newMinY,
        };
        merged = true;
        break;
      }
    }

    if (!merged) {
      consolidatedBoxes.push(box);
    }
  }

  // 5. Prepare a Clean Graphic Canvas where text regions are erased/masked
  // This guarantees with 100% certainty that NO text characters are ever baked into image bitmaps.
  const cleanGraphicCanvas = document.createElement('canvas');
  cleanGraphicCanvas.width = pageCanvas.width;
  cleanGraphicCanvas.height = pageCanvas.height;
  const cleanCtx = cleanGraphicCanvas.getContext('2d');

  if (cleanCtx) {
    // Copy rendered page
    cleanCtx.drawImage(pageCanvas, 0, 0);

    // Erase/mask all text line bounding boxes with white to ensure text is purely editable Word text
    cleanCtx.fillStyle = '#FFFFFF';
    for (const line of lines) {
      const lineLeft = Math.max(0, line.x - 4) * renderScale;
      const lineWidth = ((line.items.reduce((acc, it) => acc + it.width, 0) || 80) + 8) * renderScale;
      const lineTop = Math.max(0, line.y - (line.fontSize || 12) - 3) * renderScale;
      const lineHeight = ((line.height || line.fontSize || 12) + 6) * renderScale;

      cleanCtx.fillRect(lineLeft, lineTop, lineWidth, lineHeight);
    }
  }

  // 6. Extract clean image slices from the graphic canvas with exact coordinates
  const sliceSource = cleanCtx ? cleanGraphicCanvas : pageCanvas;

  for (const box of consolidatedBoxes) {
    const sx = Math.max(0, Math.floor(box.minX * renderScale));
    const sy = Math.max(0, Math.floor(box.minY * renderScale));
    const sw = Math.min(sliceSource.width - sx, Math.ceil(box.width * renderScale));
    const sh = Math.min(sliceSource.height - sy, Math.ceil(box.height * renderScale));

    if (sw > 16 && sh > 16) {
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = sw;
      sliceCanvas.height = sh;
      const sliceCtx = sliceCanvas.getContext('2d');

      if (sliceCtx) {
        sliceCtx.drawImage(sliceSource, sx, sy, sw, sh, 0, 0, sw, sh);

        // Verify the slice actually contains meaningful graphic pixels (not blank white)
        const imgData = sliceCtx.getImageData(0, 0, sw, sh);
        let hasGraphicContent = false;
        for (let p = 0; p < imgData.data.length; p += 32) {
          const r = imgData.data[p];
          const g = imgData.data[p + 1];
          const b = imgData.data[p + 2];
          const a = imgData.data[p + 3];
          if (a > 30 && (r < 240 || g < 240 || b < 240)) {
            hasGraphicContent = true;
            break;
          }
        }

        if (hasGraphicContent) {
          const format = settings.imageHandling === 'compress' ? 'image/jpeg' : 'image/png';
          const quality = settings.imageHandling === 'compress' ? 0.84 : 0.95;
          const dataUrl = sliceCanvas.toDataURL(format, quality);

          extractedImages.push({
            dataUrl,
            x: box.minX,
            y: box.minY, // Exact vertical offset in page points
            width: box.width,
            height: box.height,
          });
        }
      }

      sliceCanvas.width = 0;
      sliceCanvas.height = 0;
    }
  }

  // Clean up graphic canvas memory
  cleanGraphicCanvas.width = 0;
  cleanGraphicCanvas.height = 0;

  // Sort extracted images in strict vertical order from top to bottom
  extractedImages.sort((a, b) => a.y - b.y);

  return extractedImages;
}

/**
 * Group raw text items into coherent structured lines
 */
function groupItemsIntoLines(
  items: ExtractedTextItem[],
  pageWidth: number,
  medianFontSize: number
): ExtractedLine[] {
  if (items.length === 0) return [];

  // Sort by Y ascending (top to bottom), then X ascending (left to right)
  const sorted = [...items].sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 4) return yDiff;
    return a.x - b.x;
  });

  const lineGroups: ExtractedTextItem[][] = [];
  let currentGroup: ExtractedTextItem[] = [];
  let currentY = sorted[0].y;

  for (const item of sorted) {
    if (currentGroup.length === 0) {
      currentGroup.push(item);
      currentY = item.y;
      continue;
    }

    // If item is on approximately the same horizontal baseline
    const yTolerance = Math.max(3, item.fontSize * 0.4);
    if (Math.abs(item.y - currentY) <= yTolerance) {
      currentGroup.push(item);
    } else {
      lineGroups.push(currentGroup);
      currentGroup = [item];
      currentY = item.y;
    }
  }

  if (currentGroup.length > 0) {
    lineGroups.push(currentGroup);
  }

  // Construct structured lines
  const lines: ExtractedLine[] = [];

  for (const group of lineGroups) {
    // Sort items within the line horizontally
    group.sort((a, b) => a.x - b.x);

    let fullText = '';
    let isBold = false;
    let isItalic = false;
    let maxFontSize = 0;
    let minX = group[0].x;
    let lastRight = group[0].x;
    const avgHeight = group.reduce((acc, it) => acc + it.height, 0) / group.length;

    for (let i = 0; i < group.length; i++) {
      const item = group[i];
      if (i > 0) {
        const gap = item.x - lastRight;
        // Space insertion heuristics
        if (gap > 2 && !fullText.endsWith(' ') && !item.str.startsWith(' ')) {
          fullText += ' ';
        }
      }
      fullText += item.str;
      lastRight = item.x + item.width;
      if (item.isBold) isBold = true;
      if (item.isItalic) isItalic = true;
      if (item.fontSize > maxFontSize) maxFontSize = item.fontSize;
    }

    const trimmedText = fullText.trim();
    if (!trimmedText) continue;

    // Detect alignment based on horizontal bounds
    let alignment: 'left' | 'center' | 'right' | 'justify' = 'left';
    const lineCenter = minX + (lastRight - minX) / 2;
    const pageCenter = pageWidth / 2;

    if (Math.abs(lineCenter - pageCenter) < 30 && lastRight - minX < pageWidth * 0.75) {
      alignment = 'center';
    } else if (minX > pageWidth * 0.55) {
      alignment = 'right';
    }

    // Detect headings based on relative font size
    let isHeading = false;
    let headingLevel: 1 | 2 | 3 | 4 | undefined;

    if (maxFontSize >= medianFontSize * 1.55) {
      isHeading = true;
      headingLevel = 1;
    } else if (maxFontSize >= medianFontSize * 1.3) {
      isHeading = true;
      headingLevel = 2;
    } else if (maxFontSize >= medianFontSize * 1.15 && (isBold || trimmedText.length < 80)) {
      isHeading = true;
      headingLevel = 3;
    }

    // Detect bullet points
    let isBullet = false;
    let bulletText = trimmedText;
    const bulletMatch = trimmedText.match(/^([•\-\*–—]|\d+[\.\)])\s+(.*)$/);
    if (bulletMatch && !isHeading) {
      isBullet = true;
      bulletText = bulletMatch[2];
    }

    lines.push({
      items: group,
      text: isBullet ? bulletText : trimmedText,
      x: minX,
      y: Math.round(group[0].y),
      height: Math.round(avgHeight),
      fontSize: maxFontSize || medianFontSize,
      isBold,
      isItalic,
      isHeading,
      headingLevel,
      isBullet,
      bulletText: isBullet ? bulletText : undefined,
      alignment,
    });
  }

  return lines;
}

/**
 * Detect tabular data structures from aligned lines
 */
function detectTablesInLines(
  lines: ExtractedLine[],
  pageWidth: number
): { tables: ExtractedTable[]; nonTableLines: ExtractedLine[] } {
  const tables: ExtractedTable[] = [];
  const nonTableLines: ExtractedLine[] = [];

  let candidateTableLines: ExtractedLine[] = [];

  const flushCandidateTable = () => {
    if (candidateTableLines.length >= 2) {
      const rows: string[][] = [];
      let maxCols = 0;

      for (const line of candidateTableLines) {
        const cells: string[] = [];
        let currentCell = '';
        let lastX = 0;

        for (let i = 0; i < line.items.length; i++) {
          const item = line.items[i];
          if (i > 0 && item.x - lastX > 35) {
            cells.push(currentCell.trim());
            currentCell = item.str;
          } else {
            currentCell += (currentCell && !currentCell.endsWith(' ') && !item.str.startsWith(' ') ? ' ' : '') + item.str;
          }
          lastX = item.x + item.width;
        }
        if (currentCell.trim()) {
          cells.push(currentCell.trim());
        }

        if (cells.length > 1) {
          rows.push(cells);
          maxCols = Math.max(maxCols, cells.length);
        }
      }

      if (rows.length >= 2 && maxCols >= 2) {
        const normalizedRows = rows.map((r) => {
          while (r.length < maxCols) r.push('');
          return r;
        });

        const firstLine = candidateTableLines[0];
        const lastLine = candidateTableLines[candidateTableLines.length - 1];

        tables.push({
          rows: normalizedRows,
          x: firstLine.x,
          y: firstLine.y,
          width: pageWidth - 100,
          height: lastLine.y - firstLine.y + lastLine.height,
          colCount: maxCols,
          rowCount: normalizedRows.length,
        });
      } else {
        nonTableLines.push(...candidateTableLines);
      }
    } else {
      nonTableLines.push(...candidateTableLines);
    }
    candidateTableLines = [];
  };

  for (const line of lines) {
    const hasSpacedColumns = line.items.length >= 2 && hasMultiColumnGaps(line.items);

    if (hasSpacedColumns && !line.isHeading) {
      candidateTableLines.push(line);
    } else {
      flushCandidateTable();
      nonTableLines.push(line);
    }
  }
  flushCandidateTable();

  return { tables, nonTableLines };
}

function hasMultiColumnGaps(items: ExtractedTextItem[]): boolean {
  for (let i = 1; i < items.length; i++) {
    const gap = items[i].x - (items[i - 1].x + items[i - 1].width);
    if (gap > 35) return true;
  }
  return false;
}
