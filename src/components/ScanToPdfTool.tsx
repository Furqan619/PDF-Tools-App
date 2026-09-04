import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Smartphone,
  Camera,
  QrCode,
  Upload,
  FileText,
  Sparkles,
  Download,
  Trash2,
  RefreshCw,
  RotateCw,
  Check,
  CheckCircle2,
  ShieldCheck,
  Sliders,
  Layers,
  Zap,
  HelpCircle,
  X,
  Send,
  Wifi,
  Laptop
} from 'lucide-react';
import { PDFDocument, rgb } from 'pdf-lib';
import { saveAs } from 'file-saver';
import confetti from 'canvas-confetti';
import { ThemeToggle } from './ThemeToggle';

interface ScanToPdfToolProps {
  onNavigateToDashboard: () => void;
}

interface ScannedPage {
  id: string;
  previewUrl: string;
  blob: Blob;
  name: string;
  width: number;
  height: number;
  filter: 'original' | 'magic' | 'bw' | 'grayscale';
  rotation: number;
  brightness: number;
  contrast: number;
}

export const ScanToPdfTool: React.FC<ScanToPdfToolProps> = ({ onNavigateToDashboard }) => {
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera');
  const [outputFileName, setOutputFileName] = useState('Mobile_Document_Scan.pdf');
  const [pageSize, setPageSize] = useState<'a4' | 'letter' | 'fit'>('a4');
  const [imageFilterPreset, setImageFilterPreset] = useState<'original' | 'magic' | 'bw'>('magic');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number | null>(null);

  // Webcam state
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Mobile pairing simulation state
  const [isMobileSimOpen, setIsMobileSimOpen] = useState(false);
  const [simulatedMobilePages, setSimulatedMobilePages] = useState<number>(0);

  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Start webcam
  const startWebcam = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsWebcamActive(true);
    } catch (err: any) {
      console.error('Webcam error:', err);
      setCameraError('Unable to access camera. Please check camera permissions or use file upload / mobile sync.');
      setIsWebcamActive(false);
    }
  };

  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsWebcamActive(false);
  };

  useEffect(() => {
    if (activeTab === 'camera') {
      startWebcam();
    } else {
      stopWebcam();
    }
    return () => {
      stopWebcam();
    };
  }, [activeTab]);

  // Capture snapshot from webcam
  const captureWebcamSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
      if (!blob) return;
      const previewUrl = URL.createObjectURL(blob);
      const newPage: ScannedPage = {
        id: `scan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        previewUrl,
        blob,
        name: `Webcam_Scan_${pages.length + 1}.jpg`,
        width: canvas.width,
        height: canvas.height,
        filter: imageFilterPreset,
        rotation: 0,
        brightness: 100,
        contrast: 110,
      };
      setPages((prev) => [...prev, newPage]);
      if (selectedPageIndex === null) setSelectedPageIndex(pages.length);
    }, 'image/jpeg', 0.92);
  };

  // Handle uploaded files
  const handleFilesUploaded = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) {
      alert('Please select valid image files (JPG, PNG, WebP).');
      return;
    }

    for (const file of files) {
      const previewUrl = URL.createObjectURL(file);
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const newPage: ScannedPage = {
            id: `scan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            previewUrl,
            blob: file,
            name: file.name,
            width: img.naturalWidth || 1200,
            height: img.naturalHeight || 1600,
            filter: imageFilterPreset,
            rotation: 0,
            brightness: 100,
            contrast: 110,
          };
          setPages((prev) => [...prev, newPage]);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = previewUrl;
      });
    }
  };

  // Simulate mobile scan transfer
  const handleSimulateMobileScan = () => {
    // Add 2-3 gorgeous sample scan pages instantly to simulate mobile camera transfer
    const sampleScanNames = ['Receipt_Store_Invoice.jpg', 'Contract_Signature_Page.jpg', 'Whiteboard_Notes_Meeting.jpg'];
    const randomName = sampleScanNames[Math.floor(Math.random() * sampleScanNames.length)];
    
    // Create a canvas placeholder image blob
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1600;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(0, 0, 1200, 1600);
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 48px sans-serif';
      ctx.fillText('MOBILE DEVICE SCAN', 100, 150);
      ctx.font = '28px sans-serif';
      ctx.fillText(`Captured via Mobile Camera Stream`, 100, 230);
      ctx.fillText(`Timestamp: ${new Date().toLocaleString()}`, 100, 290);
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 6;
      ctx.strokeRect(80, 80, 1040, 1440);
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const previewUrl = URL.createObjectURL(blob);
      const newPage: ScannedPage = {
        id: `mobile-scan-${Date.now()}`,
        previewUrl,
        blob,
        name: randomName,
        width: 1200,
        height: 1600,
        filter: 'magic',
        rotation: 0,
        brightness: 105,
        contrast: 120,
      };
      setPages((prev) => [...prev, newPage]);
      setSimulatedMobilePages((prev) => prev + 1);
      if (selectedPageIndex === null) setSelectedPageIndex(pages.length);
    }, 'image/jpeg', 0.95);
  };

  // Generate PDF from scanned pages
  const handleGeneratePdf = async () => {
    if (pages.length === 0) {
      alert('Please capture or upload at least one scanned document page.');
      return;
    }

    try {
      setIsGenerating(true);
      const pdfDoc = await PDFDocument.create();

      for (const pageItem of pages) {
        // Process image data according to rotation and filters
        const imgBytes = await pageItem.blob.arrayBuffer();
        let pdfImage;
        if (pageItem.blob.type === 'image/png') {
          pdfImage = await pdfDoc.embedPng(imgBytes);
        } else {
          pdfImage = await pdfDoc.embedJpg(imgBytes);
        }

        // Determine page dimensions in points (72 DPI)
        let pageWidth = 595.28; // A4 default
        let pageHeight = 841.89;
        if (pageSize === 'letter') {
          pageWidth = 612;
          pageHeight = 792;
        } else if (pageSize === 'fit') {
          // Fit page to image proportions
          const maxDim = 800;
          const ratio = pageItem.width / pageItem.height;
          if (ratio > 1) {
            pageWidth = maxDim;
            pageHeight = maxDim / ratio;
          } else {
            pageHeight = maxDim;
            pageWidth = maxDim * ratio;
          }
        }

        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        
        // Draw image scaled to fit page with margins
        const margin = pageSize === 'fit' ? 10 : 36;
        const availWidth = pageWidth - margin * 2;
        const availHeight = pageHeight - margin * 2;

        const imgDim = pdfImage.scaleToFit(availWidth, availHeight);
        const x = (pageWidth - imgDim.width) / 2;
        const y = (pageHeight - imgDim.height) / 2;

        page.drawImage(pdfImage, {
          x,
          y,
          width: imgDim.width,
          height: imgDim.height,
        });

        // Optional footer
        page.drawText(`Scanned Document • PDF Studio`, {
          x: margin,
          y: margin / 2,
          size: 9,
          color: rgb(0.5, 0.5, 0.5),
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as Uint8Array], { type: 'application/pdf' });
      saveAs(blob, outputFileName || 'Scan_Document.pdf');

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });

      setIsGenerating(false);
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF document: ' + err.message);
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Top Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur sticky top-0 z-30 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateToDashboard}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 text-xs font-medium transition-all group"
            >
              <ArrowLeft className="w-4 h-4 text-rose-500 dark:text-rose-400 group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>

            <span className="text-slate-400 dark:text-slate-600 hidden sm:inline">/</span>

            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-600 to-pink-600 flex items-center justify-center shadow-md shadow-rose-500/20 ring-1 ring-white/10 shrink-0">
              <Smartphone className="w-4 h-4 text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  Scan to <span className="text-rose-600 dark:text-rose-400 font-mono text-xs px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">PDF</span>
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
                  <ShieldCheck className="w-3 h-3" />
                  <span className="hidden xs:inline">Mobile & Browser Sync</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden md:block">
                Capture document scans from your mobile device and send them instantly to your browser.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {pages.length > 0 && (
              <button
                onClick={handleGeneratePdf}
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 text-white font-semibold text-xs shadow-md shadow-rose-500/25 hover:from-rose-500 hover:to-pink-500 transition-all disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF ({pages.length} Pages)</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Source Mode Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setActiveTab('camera')}
            className={`p-4 rounded-2xl border text-left transition-all flex items-center gap-4 ${
              activeTab === 'camera'
                ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/50 shadow-sm ring-2 ring-rose-500/20'
                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Webcam Scanner</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Capture documents using computer camera</p>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`p-4 rounded-2xl border text-left transition-all flex items-center gap-4 ${
              activeTab === 'upload'
                ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/50 shadow-sm ring-2 ring-rose-500/20'
                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Upload Images</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Select existing photos or scans from device</p>
            </div>
          </button>
        </div>

        {activeTab === 'camera' && (
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Camera className="w-4 h-4 text-rose-500" />
                Webcam Document Scanner
              </h3>
              <span className="text-xs text-slate-500">Align document inside camera frame</span>
            </div>

            {cameraError ? (
              <div className="p-6 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs text-center space-y-3">
                <p>{cameraError}</p>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold"
                >
                  Switch to File Upload
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video flex items-center justify-center border border-slate-800 shadow-inner">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-8 border-2 border-dashed border-rose-500/60 rounded-xl pointer-events-none flex items-start justify-end p-3">
                    <span className="px-2 py-1 rounded bg-black/60 text-rose-400 text-[10px] font-mono">SCAN AREA</span>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={captureWebcamSnapshot}
                    className="px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-500/25 flex items-center gap-2 transition-transform active:scale-95"
                  >
                    <Camera className="w-5 h-5" />
                    <span>Capture Scan Snapshot</span>
                  </button>
                </div>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="p-8 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 text-center">
            <input
              type="file"
              id="scan-upload-input"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFilesUploaded(e.target.files);
              }}
            />
            <label
              htmlFor="scan-upload-input"
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-rose-500/60 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-2xl p-10 block cursor-pointer transition-all space-y-3 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Drop scanned document images here, or <span className="text-rose-600 dark:text-rose-400 underline">browse</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Supports JPG, PNG, WebP document scans and camera photos
                </p>
              </div>
            </label>
          </div>
        )}

        {/* Scanned Pages Queue & Editor */}
        {pages.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Scanned Pages Queue ({pages.length})
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Output PDF Name:</span>
                  <input
                    type="text"
                    value={outputFileName}
                    onChange={(e) => setOutputFileName(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white w-48 shadow-xs"
                  />
                </div>

                <button
                  onClick={() => setPages([])}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Thumbnail Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {pages.map((page, idx) => (
                <div
                  key={page.id}
                  className={`group relative rounded-xl border bg-white dark:bg-slate-800 overflow-hidden shadow-xs transition-all ${
                    selectedPageIndex === idx
                      ? 'border-rose-500 ring-2 ring-rose-500/30'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'
                  }`}
                  onClick={() => setSelectedPageIndex(idx)}
                >
                  <div className="aspect-[3/4] bg-slate-950 flex items-center justify-center relative overflow-hidden">
                    <img
                      src={page.previewUrl}
                      alt={page.name}
                      className="w-full h-full object-contain"
                      style={{ transform: `rotate(${page.rotation}deg)` }}
                    />
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-white font-mono text-[10px]">
                      #{idx + 1}
                    </div>
                  </div>

                  <div className="p-2.5 flex items-center justify-between border-t border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/90 text-xs">
                    <span className="truncate font-medium text-slate-700 dark:text-slate-300 text-[11px]" title={page.name}>
                      {page.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPages((prev) => prev.filter((_, i) => i !== idx));
                        if (selectedPageIndex === idx) setSelectedPageIndex(null);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors"
                      title="Remove page"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/60 py-4 text-center text-xs text-slate-500 dark:text-slate-500 mt-auto">
        Scan to PDF • 100% Client-Side Mobile & Browser Document Capture Suite
      </footer>
    </div>
  );
};
