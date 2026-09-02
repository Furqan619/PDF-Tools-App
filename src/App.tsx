/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Header 
} from './components/Header';
import { 
  Dashboard 
} from './components/Dashboard';
import { 
  PdfMergerSplitter 
} from './components/PdfMergerSplitter';
import { 
  PdfCompressor 
} from './components/PdfCompressor';
import { 
  PdfOcrExtractor 
} from './components/PdfOcrExtractor';
import { 
  ImageToPdfPackager 
} from './components/ImageToPdfPackager';
import { 
  PdfToExcelConverter 
} from './components/PdfToExcelConverter';
import { 
  PdfSecuritySigner 
} from './components/PdfSecuritySigner';
import { 
  PdfToImageConverter 
} from './components/PdfToImageConverter';
import { 
  PdfPageNumbersTool 
} from './components/PdfPageNumbersTool';
import { 
  PdfCropperTool 
} from './components/PdfCropperTool';
import { 
  HtmlToPdfTool 
} from './components/HtmlToPdfTool';
import { 
  PdfToPptxTool 
} from './components/PdfToPptxTool';
import { 
  PptxToPdfTool 
} from './components/PptxToPdfTool';
import { 
  ExcelToPdfTool 
} from './components/ExcelToPdfTool';
import { 
  PdfEditorTool 
} from './components/PdfEditorTool';
import { 
  ScanToPdfTool 
} from './components/ScanToPdfTool';
import { 
  OrganizePdfTool 
} from './components/OrganizePdfTool';
import { 
  RepairPdfTool 
} from './components/RepairPdfTool';
import { 
  UnlockPdfTool 
} from './components/UnlockPdfTool';
import { 
  DropZone 
} from './components/DropZone';
import { 
  FileQueue 
} from './components/FileQueue';
import { 
  StatsBar 
} from './components/StatsBar';
import { 
  LargeFileEfficiencyGuide 
} from './components/LargeFileEfficiencyGuide';
import { 
  ConversionSettingsModal 
} from './components/ConversionSettingsModal';
import { 
  DocumentPreviewModal 
} from './components/DocumentPreviewModal';
import { 
  QueueItem, 
  ConversionSettings 
} from './types';
import { 
  DEFAULT_SETTINGS, 
  convertSingleFile, 
  downloadDocxResult, 
  downloadAllCompletedAsZip,
  calculateMetrics 
} from './services/converterEngine';

export default function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'pdf-to-docx' | 'pdf-merge-split' | 'pdf-compress' | 'pdf-ocr-extract' | 'image-to-pdf' | 'pdf-to-excel' | 'pdf-protect-watermark' | 'pdf-to-image' | 'pdf-page-numbers' | 'pdf-crop' | 'html-to-pdf' | 'pdf-to-pptx' | 'powerpoint-to-pdf' | 'excel-to-pdf' | 'edit-pdf' | 'scan-to-pdf' | 'organize-pdf' | 'repair-pdf' | 'unlock-pdf'>('dashboard');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [globalSettings, setGlobalSettings] = useState<ConversionSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<QueueItem | null>(null);
  const [previewItem, setPreviewItem] = useState<QueueItem | null>(null);
  const [isConvertingAny, setIsConvertingAny] = useState(false);

  // Handle files added via drop or file dialog
  const handleFilesSelected = useCallback((files: File[]) => {
    const newItems: QueueItem[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      file,
      name: file.name,
      size: file.size,
      status: 'idle',
      progress: 0,
      currentStepMessage: 'Ready to convert',
      currentPage: 0,
      totalPages: 0,
      settings: { ...globalSettings },
      addedAt: Date.now(),
    }));

    setQueue((prev) => [...prev, ...newItems]);
    // Automatically switch to converter view if files are dropped
    setCurrentView('pdf-to-docx');
  }, [globalSettings]);

  // Support pasting PDF files from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        const pdfFiles = Array.from(e.clipboardData.files).filter(
          (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
        );
        if (pdfFiles.length > 0) {
          handleFilesSelected(pdfFiles);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFilesSelected]);

  // Convert a single file by id
  const handleConvertFile = async (id: string) => {
    const item = queue.find((i) => i.id === id);
    if (!item) return;

    setIsConvertingAny(true);

    try {
      await convertSingleFile(item, (updated) => {
        setQueue((prev) =>
          prev.map((q) => (q.id === id ? { ...q, ...updated } : q))
        );
      });
    } catch {
      // Error is caught & reflected in queue item state
    } finally {
      // Check if any other files are currently converting
      setQueue((prev) => {
        const stillConverting = prev.some(
          (i) => i.status === 'reading' || i.status === 'extracting' || i.status === 'generating'
        );
        setIsConvertingAny(stillConverting);
        return prev;
      });
    }
  };

  // Convert all idle/error files in sequence
  const handleConvertAll = async () => {
    const pendingItems = queue.filter(
      (i) => i.status === 'idle' || i.status === 'error' || i.status === 'cancelled'
    );
    if (pendingItems.length === 0) return;

    setIsConvertingAny(true);

    for (const item of pendingItems) {
      try {
        await convertSingleFile(item, (updated) => {
          setQueue((prev) =>
            prev.map((q) => (q.id === item.id ? { ...q, ...updated } : q))
          );
        });
      } catch {
        // Proceed to next file in queue
      }
    }

    setIsConvertingAny(false);
  };

  // Cancel ongoing conversion
  const handleCancelFile = (id: string) => {
    const item = queue.find((i) => i.id === id);
    if (item?.abortController) {
      item.abortController.abort();
    }
  };

  // Remove file from queue
  const handleRemoveFile = (id: string) => {
    setQueue((prev) => prev.filter((i) => i.id !== id));
  };

  // Clear entire queue
  const handleClearQueue = () => {
    setQueue([]);
  };

  // Download single DOCX
  const handleDownloadFile = (item: QueueItem) => {
    if (item.result) {
      downloadDocxResult(item.result);
    }
  };

  // Download all completed as ZIP
  const handleDownloadAllZip = () => {
    downloadAllCompletedAsZip(queue);
  };

  // Open settings modal
  const handleOpenGlobalSettings = () => {
    setEditingItem(null);
    setIsSettingsOpen(true);
  };

  const handleOpenFileSettings = (item: QueueItem) => {
    setEditingItem(item);
    setIsSettingsOpen(true);
  };

  // Save settings
  const handleSaveSettings = (newSettings: ConversionSettings, applyToAll: boolean) => {
    if (editingItem && !applyToAll) {
      // Apply only to this item
      setQueue((prev) =>
        prev.map((q) => (q.id === editingItem.id ? { ...q, settings: newSettings } : q))
      );
    } else {
      // Apply globally and to all queued items
      setGlobalSettings(newSettings);
      setQueue((prev) =>
        prev.map((q) => ({ ...q, settings: newSettings }))
      );
    }
  };

  // Open Preview Modal
  const handlePreviewFile = (item: QueueItem) => {
    setPreviewItem(item);
  };

  const metrics = calculateMetrics(queue);

  // If in Dashboard view, show the full multi-app dashboard
  if (currentView === 'dashboard') {
    return (
      <Dashboard
        onSelectApp={(appId) => {
          if (appId === 'pdf-to-docx') {
            setCurrentView('pdf-to-docx');
          } else if (appId === 'pdf-merge-split') {
            setCurrentView('pdf-merge-split');
          } else if (appId === 'pdf-compress') {
            setCurrentView('pdf-compress');
          } else if (appId === 'pdf-ocr-extract') {
            setCurrentView('pdf-ocr-extract');
          } else if (appId === 'image-to-pdf') {
            setCurrentView('image-to-pdf');
          } else if (appId === 'pdf-to-excel') {
            setCurrentView('pdf-to-excel');
          } else if (appId === 'pdf-protect-watermark') {
            setCurrentView('pdf-protect-watermark');
          } else if (appId === 'pdf-to-image') {
            setCurrentView('pdf-to-image');
          } else if (appId === 'pdf-page-numbers') {
            setCurrentView('pdf-page-numbers');
          } else if (appId === 'pdf-crop') {
            setCurrentView('pdf-crop');
          } else if (appId === 'html-to-pdf') {
            setCurrentView('html-to-pdf');
          } else if (appId === 'pdf-to-pptx') {
            setCurrentView('pdf-to-pptx');
          } else if (appId === 'powerpoint-to-pdf') {
            setCurrentView('powerpoint-to-pdf');
          } else if (appId === 'excel-to-pdf') {
            setCurrentView('excel-to-pdf');
          } else if (appId === 'edit-pdf') {
            setCurrentView('edit-pdf');
          } else if (appId === 'scan-to-pdf') {
            setCurrentView('scan-to-pdf');
          } else if (appId === 'organize-pdf') {
            setCurrentView('organize-pdf');
          } else if (appId === 'repair-pdf') {
            setCurrentView('repair-pdf');
          } else if (appId === 'unlock-pdf') {
            setCurrentView('unlock-pdf');
          }
        }}
        activeQueueCount={queue.length}
      />
    );
  }

  // If in PDF to Image converter view
  if (currentView === 'pdf-to-image') {
    return (
      <PdfToImageConverter
        onNavigateToDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  // If in PDF Merger & Splitter view
  if (currentView === 'pdf-merge-split') {
    return (
      <PdfMergerSplitter
        onNavigateToDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  // If in PDF Compressor view
  if (currentView === 'pdf-compress') {
    return (
      <PdfCompressor
        onNavigateToDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  // If in OCR Text & Layout Extractor view
  if (currentView === 'pdf-ocr-extract') {
    return (
      <PdfOcrExtractor
        onNavigateToDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  // If in Images to PDF Packager view
  if (currentView === 'image-to-pdf') {
    return (
      <ImageToPdfPackager
        onNavigateToDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  // If in PDF Tables to Excel view
  if (currentView === 'pdf-to-excel') {
    return (
      <PdfToExcelConverter
        onNavigateToDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  // If in PDF Security, Watermark & Sign view
  if (currentView === 'pdf-protect-watermark') {
    return (
      <PdfSecuritySigner
        onNavigateToDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  // If in PDF Page Numbers view
  if (currentView === 'pdf-page-numbers') {
    return (
      <PdfPageNumbersTool
        onNavigateToDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  // If in Crop PDF view
  if (currentView === 'pdf-crop') {
    return (
      <PdfCropperTool
        onNavigateToDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  // If in Scan to PDF view
  if (currentView === 'scan-to-pdf') {
    return (
      <ScanToPdfTool
        onNavigateToDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  // If in Organize PDF view
  if (currentView === 'organize-pdf') {
    return (
      <OrganizePdfTool
        onNavigateToDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  // If in Repair PDF view
  if (currentView === 'repair-pdf') {
    return (
      <RepairPdfTool
        onNavigateToDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  // If in Unlock PDF view
  if (currentView === 'unlock-pdf') {
    return (
      <UnlockPdfTool
        onNavigateToDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  // If in HTML to PDF view
  if (currentView === 'html-to-pdf') {
    return (
      <HtmlToPdfTool
        onNavigateToDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  // If in PDF to PowerPoint view
  if (currentView === 'pdf-to-pptx') {
    return (
      <PdfToPptxTool
        onNavigateToDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  // If in PowerPoint to PDF view
  if (currentView === 'powerpoint-to-pdf') {
    return (
      <PptxToPdfTool
        onNavigateToDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  // If in Excel to PDF view
  if (currentView === 'excel-to-pdf') {
    return (
      <ExcelToPdfTool
        onNavigateToDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  // If in Edit PDF view
  if (currentView === 'edit-pdf') {
    return (
      <PdfEditorTool
        onNavigateToDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  return (
    <div className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Top App Header with Dashboard Navigation */}
      <Header
        queue={queue}
        onOpenSettings={handleOpenGlobalSettings}
        onConvertAll={handleConvertAll}
        onDownloadAllZip={handleDownloadAllZip}
        onClearQueue={handleClearQueue}
        isConvertingAny={isConvertingAny}
        onNavigateToDashboard={() => setCurrentView('dashboard')}
      />

      {/* Main Workspace Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Performance Metrics Stats Bar */}
        <StatsBar metrics={metrics} />

        {/* Drag & Drop Area */}
        <DropZone
          onFilesSelected={handleFilesSelected}
          isQueueEmpty={queue.length === 0}
        />

        {/* File Queue & Conversion Table */}
        <FileQueue
          queue={queue}
          onConvert={handleConvertFile}
          onCancel={handleCancelFile}
          onRemove={handleRemoveFile}
          onDownload={handleDownloadFile}
          onPreview={handlePreviewFile}
          onOpenSettings={handleOpenFileSettings}
          onDownloadAllZip={handleDownloadAllZip}
        />

        {/* Architecture & Large File Performance Guide */}
        <LargeFileEfficiencyGuide />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/60 py-6 text-center text-xs text-slate-500 transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Client-Side PDF to Word (.docx) Converter • Zero Data Leaves Your Device</span>
          <span>ECMA-376 OpenXML Standard Compliant</span>
        </div>
      </footer>

      {/* Conversion Settings Modal */}
      <ConversionSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialSettings={editingItem ? editingItem.settings : globalSettings}
        targetItem={editingItem}
        onSave={handleSaveSettings}
      />

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={!!previewItem}
        onClose={() => setPreviewItem(null)}
        item={previewItem}
      />
    </div>
  );
}
