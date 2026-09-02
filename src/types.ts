export type ConversionMode = 'high-fidelity' | 'editable-text' | 'text-only';
export type ImageHandlingMode = 'compress' | 'original' | 'none';
export type OrientationSetting = 'auto' | 'portrait' | 'landscape';

export interface ConversionSettings {
  mode: ConversionMode;
  imageHandling: ImageHandlingMode;
  detectTables: boolean;
  preservePageBreaks: boolean;
  pageRange: string; // e.g. "all" or "1-5, 8, 10-12"
  fontFamily: string; // 'Calibri' | 'Arial' | 'Times New Roman' | 'Aptos'
  baseFontSizePt: number;
  lineSpacingRatio: number;
  extractImagesMaxResolution: number; // max width/height in px
}

export type FileStatus = 
  | 'idle'
  | 'reading'
  | 'extracting'
  | 'generating'
  | 'completed'
  | 'error'
  | 'cancelled';

export interface ExtractedTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  isBold: boolean;
  isItalic: boolean;
  color?: string;
  hasEOL?: boolean;
}

export interface ExtractedLine {
  items: ExtractedTextItem[];
  text: string;
  y: number;
  x: number;
  height: number;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  isHeading?: boolean;
  headingLevel?: 1 | 2 | 3 | 4;
  isBullet?: boolean;
  bulletText?: string;
  alignment: 'left' | 'center' | 'right' | 'justify';
}

export interface ExtractedTable {
  rows: string[][];
  y: number;
  x: number;
  width: number;
  height: number;
  colCount: number;
  rowCount: number;
}

export interface ExtractedImage {
  dataUrl: string;
  blob?: Blob;
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface ExtractedPage {
  pageNumber: number;
  width: number;
  height: number;
  lines: ExtractedLine[];
  tables: ExtractedTable[];
  images: ExtractedImage[];
  rawText: string;
  thumbnailUrl?: string;
}

export interface ConvertedDocumentResult {
  docxBlob: Blob;
  fileName: string;
  pageCount: number;
  fileSizeBytes: number;
  durationMs: number;
  extractedPages: ExtractedPage[];
}

export interface QueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: FileStatus;
  progress: number; // 0 to 100
  currentStepMessage: string;
  currentPage: number;
  totalPages: number;
  error?: string;
  settings: ConversionSettings;
  result?: ConvertedDocumentResult;
  addedAt: number;
  startedAt?: number;
  completedAt?: number;
  abortController?: AbortController;
  previewPageNumber?: number;
}

export interface ProcessingMetrics {
  totalFiles: number;
  completedFiles: number;
  totalBytesProcessed: number;
  totalPagesProcessed: number;
  averageSpeedPagesPerSec: number;
}

export type AppCategory = 'all' | 'converters' | 'organization' | 'optimization' | 'security_ocr';

export interface AppCardItem {
  id: string;
  title: string;
  shortName: string;
  description: string;
  category: AppCategory;
  status: 'active' | 'beta' | 'coming_soon';
  badge?: string;
  iconName: string;
  accentGradient: string;
  glowColor: string;
  borderHover: string;
  features: string[];
  supportedFormats: string[];
  popular?: boolean;
}
