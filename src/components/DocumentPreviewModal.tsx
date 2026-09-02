import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Table as TableIcon, 
  Image as ImageIcon,
  FileCode, 
  ZoomIn, 
  ZoomOut,
  Maximize2
} from 'lucide-react';
import { QueueItem, ExtractedPage, ExtractedLine, ExtractedTable, ExtractedImage } from '../types';
import { downloadDocxResult, formatBytes } from '../services/converterEngine';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: QueueItem | null;
}

type PreviewElement = 
  | { type: 'line'; item: ExtractedLine; y: number }
  | { type: 'table'; item: ExtractedTable; y: number }
  | { type: 'image'; item: ExtractedImage; y: number };

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  item,
}) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'word' | 'pdf'>('split');

  if (!isOpen || !item || !item.result) return null;

  const pages = item.result.extractedPages;
  const currentPage: ExtractedPage | undefined = pages[currentPageIndex];

  const handlePrevPage = () => {
    setCurrentPageIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPageIndex((prev) => Math.min(pages.length - 1, prev + 1));
  };

  const handleCopyText = async () => {
    if (!item.result) return;
    const fullText = item.result.extractedPages.map((p) => p.rawText).join('\n\n--- Page Break ---\n\n');
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownload = () => {
    if (item.result) {
      downloadDocxResult(item.result);
    }
  };

  // Build sorted flow elements for the current page to preview natural layout
  const flowElements: PreviewElement[] = currentPage ? [
    ...(currentPage.lines || []).map((l) => ({ type: 'line' as const, item: l, y: l.y })),
    ...(currentPage.tables || []).map((t) => ({ type: 'table' as const, item: t, y: t.y })),
    ...(currentPage.images || []).map((img) => ({ type: 'image' as const, item: img, y: img.y })),
  ].sort((a, b) => a.y - b.y) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        id="preview-modal-container"
        className="w-full max-w-6xl h-[92vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Modal Top Bar */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate" title={item.name}>
                {item.name}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{pages.length} {pages.length === 1 ? 'page' : 'pages'}</span>
                <span>•</span>
                <span>Word Output: {formatBytes(item.result.fileSizeBytes)}</span>
              </div>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-800 border border-slate-700/80 text-xs">
            <button
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors hidden md:block ${
                viewMode === 'split' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Side-by-Side
            </button>
            <button
              onClick={() => setViewMode('word')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                viewMode === 'word' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Word Document Preview
            </button>
            <button
              onClick={() => setViewMode('pdf')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                viewMode === 'pdf' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Original PDF
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              id="btn-copy-extracted-text"
              onClick={handleCopyText}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-xs font-medium"
              title="Copy extracted plain text"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Copy Text</span>
                </>
              )}
            </button>

            <button
              id="btn-preview-download-docx"
              onClick={handleDownload}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span> .DOCX
            </button>

            <button
              id="btn-close-preview"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {/* Left: Original PDF Page Thumbnail / Rendering */}
          {(viewMode === 'split' || viewMode === 'pdf') && (
            <div className={`flex flex-col h-full bg-slate-950/60 overflow-hidden ${viewMode === 'pdf' ? 'col-span-2' : ''}`}>
              <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  Original PDF Page {currentPageIndex + 1}
                </span>
                {currentPage && (
                  <span className="font-mono text-[11px] text-slate-500">
                    {currentPage.width} x {currentPage.height} pt
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-slate-950">
                {currentPage?.thumbnailUrl ? (
                  <div className="shadow-2xl rounded-sm border border-slate-700 bg-white max-h-full max-w-full overflow-hidden">
                    <img
                      src={currentPage.thumbnailUrl}
                      alt={`Page ${currentPageIndex + 1}`}
                      className="max-h-[68vh] object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="text-center p-8 text-slate-500 text-xs">
                    No visual preview available for this page
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Right: Converted Word Document Simulated Layout */}
          {(viewMode === 'split' || viewMode === 'word') && (
            <div className={`flex flex-col h-full bg-slate-900/40 overflow-hidden ${viewMode === 'word' ? 'col-span-2' : ''}`}>
              <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Microsoft Word (.docx) Structure Preview
                </span>
                <span className="text-[11px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                  {item.settings.fontFamily} • {item.settings.baseFontSizePt}pt
                </span>
              </div>

              <div className="flex-1 overflow-auto p-4 sm:p-8 bg-slate-950 flex justify-center">
                {/* Simulated Word Page Sheet */}
                <div 
                  className="w-full max-w-2xl bg-white text-slate-800 rounded-sm shadow-2xl p-8 sm:p-12 min-h-[60vh] border border-slate-200 space-y-4"
                  style={{ fontFamily: item.settings.fontFamily || 'Calibri, sans-serif' }}
                >
                  {/* Header watermark */}
                  <div className="text-[10px] text-slate-400 text-right italic border-b border-slate-100 pb-2 mb-4">
                    Converted with PDF to Word Converter
                  </div>

                  {/* Interleaved elements in natural reading order */}
                  {flowElements.length > 0 ? (
                    flowElements.map((el, idx) => {
                      if (el.type === 'line') {
                        const line = el.item;
                        let Tag: 'h1' | 'h2' | 'h3' | 'p' = 'p';
                        let className = 'text-slate-800 leading-relaxed';

                        if (line.isHeading) {
                          if (line.headingLevel === 1) {
                            Tag = 'h1';
                            className = 'text-xl font-bold text-slate-950 mt-4 mb-2';
                          } else if (line.headingLevel === 2) {
                            Tag = 'h2';
                            className = 'text-lg font-bold text-slate-900 mt-3 mb-1.5';
                          } else {
                            Tag = 'h3';
                            className = 'text-base font-semibold text-slate-900 mt-2 mb-1';
                          }
                        } else if (line.isBullet) {
                          className = 'text-sm text-slate-800 pl-4 list-disc';
                        } else {
                          className = 'text-sm text-slate-800';
                        }

                        if (line.alignment === 'center') className += ' text-center';
                        if (line.alignment === 'right') className += ' text-right';

                        return (
                          <Tag key={`line-${idx}`} className={className}>
                            {line.isBullet && <span className="inline-block mr-2 font-bold text-blue-600">•</span>}
                            <span className={`${line.isBold ? 'font-bold' : ''} ${line.isItalic ? 'italic' : ''}`}>
                              {line.text}
                            </span>
                          </Tag>
                        );
                      }

                      if (el.type === 'table') {
                        const tbl = el.item;
                        return (
                          <div key={`table-${idx}`} className="my-4 overflow-x-auto rounded border border-slate-300">
                            <table className="w-full text-xs text-left border-collapse">
                              <tbody>
                                {tbl.rows.map((row, rIdx) => (
                                  <tr
                                    key={rIdx}
                                    className={rIdx === 0 ? 'bg-slate-100 font-bold text-slate-900 border-b border-slate-300' : 'border-b border-slate-200'}
                                  >
                                    {row.map((cell, cIdx) => (
                                      <td key={cIdx} className="p-2 border-r border-slate-200 last:border-r-0">
                                        {cell || '—'}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      }

                      if (el.type === 'image') {
                        const img = el.item;
                        let alignClass = 'justify-center';
                        const pWidth = currentPage?.width || 612;
                        if (img.width < pWidth * 0.5) {
                          if (img.x > pWidth * 0.55) {
                            alignClass = 'justify-end';
                          } else if (img.x < pWidth * 0.25) {
                            alignClass = 'justify-start';
                          }
                        }

                        return (
                          <div key={`img-${idx}`} className={`my-3 flex ${alignClass}`}>
                            <div className="p-1 rounded bg-slate-50 border border-slate-200 inline-block shadow-sm">
                              <img
                                src={img.dataUrl}
                                alt="Embedded document graphic"
                                className="max-h-56 max-w-full object-contain rounded"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          </div>
                        );
                      }

                      return null;
                    })
                  ) : (
                    <div className="text-slate-400 text-xs italic text-center py-12">
                      (No content extracted for this page)
                    </div>
                  )}

                  {/* Footer Page Number */}
                  <div className="text-[11px] text-slate-400 text-center pt-8 border-t border-slate-100 mt-8">
                    Page {currentPageIndex + 1} of {pages.length}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Pagination Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              id="btn-prev-page"
              onClick={handlePrevPage}
              disabled={currentPageIndex === 0}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-slate-300">
              Page {currentPageIndex + 1} of {pages.length}
            </span>
            <button
              id="btn-next-page"
              onClick={handleNextPage}
              disabled={currentPageIndex >= pages.length - 1}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="text-xs text-slate-400 hidden sm:flex items-center gap-2 font-mono">
            <span>{currentPage?.lines.length || 0} lines</span>
            <span>•</span>
            <span>{currentPage?.tables.length || 0} tables</span>
            <span>•</span>
            <span className={currentPage?.images && currentPage.images.length > 0 ? 'text-emerald-400 font-medium' : ''}>
              {currentPage?.images?.length || 0} images
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-medium transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
