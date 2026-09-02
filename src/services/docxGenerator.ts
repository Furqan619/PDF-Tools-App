import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  ShadingType,
  convertInchesToTwip,
  IParagraphOptions,
} from 'docx';
import { ConversionSettings, ExtractedPage, ExtractedLine, ExtractedTable, ExtractedImage } from '../types';

export interface DocxGenerationProgressCallback {
  (progress: {
    percent: number;
    message: string;
  }): void;
}

type FlowElement = 
  | { type: 'line'; item: ExtractedLine; y: number }
  | { type: 'table'; item: ExtractedTable; y: number }
  | { type: 'image'; item: ExtractedImage; y: number };

/**
 * Converts extracted PDF pages into a standard, fully formatted Microsoft Word (.docx) Document
 * with interleaved text, tables, and images preserved in their natural vertical order.
 */
export async function generateDocxFromExtractedPages(
  extractedPages: ExtractedPage[],
  settings: ConversionSettings,
  onProgress?: DocxGenerationProgressCallback,
  signal?: AbortSignal
): Promise<Blob> {
  if (signal?.aborted) {
    throw new DOMException('Conversion cancelled', 'AbortError');
  }

  onProgress?.({
    percent: 75,
    message: 'Compiling structured Microsoft Word paragraphs, tables & images...',
  });

  const docChildren: (Paragraph | Table)[] = [];
  const totalPages = extractedPages.length;

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (signal?.aborted) {
      throw new DOMException('Conversion cancelled', 'AbortError');
    }

    const page = extractedPages[pageIdx];
    const isFirstPage = pageIdx === 0;

    // Insert page break between pages if preservePageBreaks is true
    if (!isFirstPage && settings.preservePageBreaks) {
      docChildren.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );
    }

    // Interleave lines, tables, and images based on vertical Y position
    const flowElements: FlowElement[] = [
      ...(page.lines || []).map((l) => ({ type: 'line' as const, item: l, y: l.y })),
      ...(page.tables || []).map((t) => ({ type: 'table' as const, item: t, y: t.y })),
      ...(settings.imageHandling !== 'none' ? (page.images || []) : []).map((img) => ({
        type: 'image' as const,
        item: img,
        y: img.y,
      })),
    ].sort((a, b) => a.y - b.y);

    if (flowElements.length > 0) {
      let pendingLines: ExtractedLine[] = [];

      const flushLines = () => {
        if (pendingLines.length === 0) return;

        if (settings.mode === 'editable-text') {
          const fluidParagraphs = groupLinesIntoFluidParagraphs(pendingLines, settings);
          docChildren.push(...fluidParagraphs);
        } else {
          for (const line of pendingLines) {
            docChildren.push(buildDocxParagraphFromLine(line, settings));
          }
        }
        pendingLines = [];
      };

      for (const el of flowElements) {
        if (el.type === 'line') {
          pendingLines.push(el.item);
        } else if (el.type === 'table') {
          flushLines();
          const docxTable = buildDocxTable(el.item, settings);
          docChildren.push(docxTable);
          docChildren.push(new Paragraph({ text: '', spacing: { after: 120 } }));
        } else if (el.type === 'image') {
          flushLines();
          const imageRun = await createImageRun(el.item);
          if (imageRun) {
            // Determine alignment from horizontal position
            let alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.CENTER;
            const pageWidth = page.width || 612;
            if (el.item.width < pageWidth * 0.5) {
              if (el.item.x > pageWidth * 0.55) {
                alignment = AlignmentType.RIGHT;
              } else if (el.item.x < pageWidth * 0.25) {
                alignment = AlignmentType.LEFT;
              }
            }

            docChildren.push(
              new Paragraph({
                children: [imageRun],
                alignment,
                spacing: {
                  before: 140,
                  after: 180,
                },
              })
            );
          }
        }
      }
      flushLines();
    } else if (page.rawText) {
      // Fallback plain lines
      const splitLines = page.rawText.split('\n');
      for (const rawLine of splitLines) {
        if (rawLine.trim()) {
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: rawLine,
                  font: settings.fontFamily,
                  size: settings.baseFontSizePt * 2,
                }),
              ],
              spacing: { after: 100 },
            })
          );
        }
      }
    }

    // Update progress
    const progressPercent = Math.round(75 + ((pageIdx + 1) / totalPages) * 15);
    onProgress?.({
      percent: progressPercent,
      message: `Assembling Word structure for page ${page.pageNumber}...`,
    });
  }

  // Build the complete docx Document
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: settings.fontFamily || 'Calibri',
            size: (settings.baseFontSizePt || 11) * 2,
            color: '1E293B',
          },
          paragraph: {
            spacing: {
              line: Math.round((settings.lineSpacingRatio || 1.15) * 240),
              after: 120,
            },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.8),
              right: convertInchesToTwip(0.8),
              bottom: convertInchesToTwip(0.8),
              left: convertInchesToTwip(0.8),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'Converted with PDF to Word Converter',
                    font: 'Calibri',
                    size: 16, // 8pt
                    color: '94A3B8',
                    italics: true,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES],
                    font: 'Calibri',
                    size: 18,
                    color: '64748B',
                  }),
                ],
              }),
            ],
          }),
        },
        children: docChildren.length > 0 ? docChildren : [
          new Paragraph({
            children: [new TextRun({ text: 'Empty Document', font: 'Calibri' })],
          }),
        ],
      },
    ],
  });

  onProgress?.({
    percent: 92,
    message: 'Compressing and generating .docx package binary...',
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}

function buildDocxParagraphFromLine(line: ExtractedLine, settings: ConversionSettings): Paragraph {
  let alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT;
  if (line.alignment === 'center') alignment = AlignmentType.CENTER;
  if (line.alignment === 'right') alignment = AlignmentType.RIGHT;
  if (line.alignment === 'justify') alignment = AlignmentType.JUSTIFIED;

  let heading: typeof HeadingLevel[keyof typeof HeadingLevel] | undefined;
  if (line.isHeading && line.headingLevel) {
    if (line.headingLevel === 1) heading = HeadingLevel.HEADING_1;
    else if (line.headingLevel === 2) heading = HeadingLevel.HEADING_2;
    else if (line.headingLevel === 3) heading = HeadingLevel.HEADING_3;
    else heading = HeadingLevel.HEADING_4;
  }

  const runs: TextRun[] = [];

  if (line.items && line.items.length > 0) {
    for (let i = 0; i < line.items.length; i++) {
      const item = line.items[i];
      if (i > 0) {
        const prev = line.items[i - 1];
        const gap = item.x - (prev.x + prev.width);
        if (gap > 4) {
          runs.push(new TextRun({ text: ' ', font: settings.fontFamily }));
        }
      }

      const fontSize = Math.max(9, Math.min(36, item.fontSize || settings.baseFontSizePt));
      runs.push(
        new TextRun({
          text: item.str,
          font: settings.fontFamily,
          size: Math.round(fontSize * 2), // Word uses half-points
          bold: item.isBold,
          italics: item.isItalic,
          color: item.isBold && line.isHeading ? '0F172A' : '1E293B',
        })
      );
    }
  } else {
    runs.push(
      new TextRun({
        text: line.text,
        font: settings.fontFamily,
        size: Math.round((line.fontSize || settings.baseFontSizePt) * 2),
        bold: line.isBold,
        italics: line.isItalic,
      })
    );
  }

  const pOptions: IParagraphOptions = {
    children: runs,
    alignment,
    heading,
    bullet: line.isBullet ? { level: 0 } : undefined,
    spacing: {
      after: line.isHeading ? 160 : 80,
      before: line.isHeading ? 200 : 0,
      line: Math.round(settings.lineSpacingRatio * 240),
    },
  };

  return new Paragraph(pOptions);
}

function groupLinesIntoFluidParagraphs(lines: ExtractedLine[], settings: ConversionSettings): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  let currentRuns: TextRun[] = [];
  let currentAlignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT;

  const flushParagraph = () => {
    if (currentRuns.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: currentRuns,
          alignment: currentAlignment,
          spacing: { after: 120, line: Math.round(settings.lineSpacingRatio * 240) },
        })
      );
      currentRuns = [];
    }
  };

  for (const line of lines) {
    if (line.isHeading || line.isBullet || line.alignment !== 'left') {
      flushParagraph();
      paragraphs.push(buildDocxParagraphFromLine(line, settings));
    } else {
      if (currentRuns.length > 0) {
        currentRuns.push(new TextRun({ text: ' ', font: settings.fontFamily }));
      }
      for (const item of line.items) {
        currentRuns.push(
          new TextRun({
            text: item.str,
            font: settings.fontFamily,
            size: Math.round((item.fontSize || settings.baseFontSizePt) * 2),
            bold: item.isBold,
            italics: item.isItalic,
          })
        );
      }
    }
  }
  flushParagraph();
  return paragraphs;
}

function buildDocxTable(tableData: ExtractedTable, settings: ConversionSettings): Table {
  const tableRows: TableRow[] = [];

  for (let rIdx = 0; rIdx < tableData.rows.length; rIdx++) {
    const row = tableData.rows[rIdx];
    const isHeader = rIdx === 0;
    const cells: TableCell[] = [];

    for (const cellText of row) {
      cells.push(
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: cellText || ' ',
                  bold: isHeader,
                  font: settings.fontFamily,
                  size: (settings.baseFontSizePt - 1) * 2,
                  color: isHeader ? '0F172A' : '334155',
                }),
              ],
              spacing: { after: 40, before: 40 },
            }),
          ],
          shading: isHeader
            ? {
                fill: 'E2E8F0',
                type: ShadingType.CLEAR,
                color: 'auto',
              }
            : undefined,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
            left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
            right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
          },
          margins: {
            top: 100,
            bottom: 100,
            left: 140,
            right: 140,
          },
        })
      );
    }

    tableRows.push(
      new TableRow({
        children: cells,
        tableHeader: isHeader,
      })
    );
  }

  return new Table({
    rows: tableRows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
  });
}

async function createImageRun(img: ExtractedImage): Promise<ImageRun | null> {
  try {
    const parts = img.dataUrl.split(',');
    if (parts.length < 2) return null;
    const base64Data = parts[1];
    if (!base64Data) return null;

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const mimeMatch = img.dataUrl.match(/data:image\/(png|jpeg|jpg|gif|bmp);/i);
    let imageType: 'png' | 'jpg' | 'gif' | 'bmp' = 'jpg';
    if (mimeMatch && mimeMatch[1]) {
      const ext = mimeMatch[1].toLowerCase();
      if (ext === 'png') imageType = 'png';
      else if (ext === 'gif') imageType = 'gif';
      else if (ext === 'bmp') imageType = 'bmp';
      else imageType = 'jpg';
    }

    // Scale to fit standard Word printable margins (~480pt)
    const maxWidth = 480;
    const originalWidth = img.width || 200;
    const originalHeight = img.height || 150;

    let w = Math.min(originalWidth, maxWidth);
    let h = (originalHeight / originalWidth) * w;
    if (h > 580) {
      h = 580;
      w = (originalWidth / originalHeight) * h;
    }

    return new ImageRun({
      data: bytes,
      type: imageType,
      transformation: {
        width: Math.max(20, Math.round(w)),
        height: Math.max(20, Math.round(h)),
      },
    });
  } catch (err) {
    console.warn('Could not embed image run in DOCX:', err);
    return null;
  }
}
