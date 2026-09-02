import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, 
  Upload, 
  Image as ImageIcon, 
  FileText, 
  Trash2, 
  RotateCw, 
  ArrowUp, 
  ArrowDown, 
  Download, 
  Sparkles, 
  Eye, 
  Check, 
  RefreshCw, 
  Sliders, 
  Settings2, 
  Layers, 
  Grid, 
  List, 
  Plus, 
  Info,
  Maximize2,
  X,
  FileCheck,
  CheckCircle2,
  MoveHorizontal,
  ChevronRight
} from 'lucide-react';
import {
  ImageItem,
  PdfPackageSettings,
  DEFAULT_PACKAGE_SETTINGS,
  PAGE_DIMENSIONS,
  MARGIN_VALUES,
  loadImageFile,
  generatePdfFromImages,
  downloadPackagedPdf,
  ImagePageSize,
  ImageOrientation,
  ImageMargin,
  ImageFitMode,
  ImageLayoutMode,
  ImageCompression,
} from '../services/imageToPdfPackager';
import { generateSampleImagesGallery } from '../services/sampleImages';

interface ImageToPdfPackagerProps {
  onNavigateToDashboard: () => void;
}

export function ImageToPdfPackager({ onNavigateToDashboard }: ImageToPdfPackagerProps) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [settings, setSettings] = useState<PdfPackageSettings>(DEFAULT_PACKAGE_SETTINGS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<ImageItem | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      if (previewPdfUrl) {
        URL.revokeObjectURL(previewPdfUrl);
      }
    };
  }, []);

  // Handle files upload
  const handleFilesAdded = async (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter((file) => 
      file.type.startsWith('image/') || /\.(jpe?g|png|webp|bmp|gif|svg)$/i.test(file.name)
    );

    if (validFiles.length === 0) return;

    try {
      const loadedItems: ImageItem[] = [];
      for (const file of validFiles) {
        const item = await loadImageFile(file);
        loadedItems.push(item);
      }

      setImages((prev) => [...prev, ...loadedItems]);
    } catch (err: any) {
      console.error('Error loading images:', err);
    }
  };

  // Load sample gallery
  const handleLoadSampleGallery = async () => {
    const sampleFiles = generateSampleImagesGallery();
    await handleFilesAdded(sampleFiles);
  };

  // Remove single image
  const handleRemoveImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
  };

  // Clear all images
  const handleClearAll = () => {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
  };

  // Rotate single image
  const handleRotateImage = (id: string, delta: number = 90) => {
    setImages((prev) =>
      prev.map((img) => {
        if (img.id === id) {
          const newRot = (img.rotation + delta) % 360;
          return {
            ...img,
            rotation: newRot,
            aspectRatio: (newRot === 90 || newRot === 270) ? 1 / (img.width / img.height) : img.width / img.height,
          };
        }
        return img;
      })
    );
  };

  // Rotate all images
  const handleRotateAll = () => {
    setImages((prev) =>
      prev.map((img) => {
        const newRot = (img.rotation + 90) % 360;
        return {
          ...img,
          rotation: newRot,
          aspectRatio: (newRot === 90 || newRot === 270) ? 1 / (img.width / img.height) : img.width / img.height,
        };
      })
    );
  };

  // Move item in order
  const handleMoveImage = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= images.length) return;

    setImages((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  // Sort images
  const handleSortImages = (type: 'name' | 'size' | 'reverse') => {
    setImages((prev) => {
      const copy = [...prev];
      if (type === 'name') {
        copy.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      } else if (type === 'size') {
        copy.sort((a, b) => b.size - a.size);
      } else if (type === 'reverse') {
        copy.reverse();
      }
      return copy;
    });
  };

  // Calculate estimated total pages
  const itemsPerPage = settings.layoutMode === '4-up' ? 4 : settings.layoutMode === '2-up' ? 2 : 1;
  const estimatedPages = Math.ceil(images.length / itemsPerPage);
  const totalInputSize = images.reduce((acc, curr) => acc + curr.size, 0);

  // Generate & Download PDF
  const handlePackageAndDownload = async () => {
    if (images.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setProgress(5);
    setStatusText('Preparing images for PDF compilation...');

    try {
      const result = await generatePdfFromImages(images, settings, (p, status) => {
        setProgress(p);
        setStatusText(status);
      });

      downloadPackagedPdf(result.pdfBytes, settings.outputFilename);
    } catch (err: any) {
      console.error('Packaging failed:', err);
      alert(`Packaging error: ${err?.message || 'Failed to package images.'}`);
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setStatusText('');
    }
  };

  // Generate Live PDF Preview
  const handleGeneratePreview = async () => {
    if (images.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setProgress(10);
    setStatusText('Rendering Live PDF preview...');

    try {
      const result = await generatePdfFromImages(images, settings, (p, status) => {
        setProgress(p);
        setStatusText(status);
      });

      if (previewPdfUrl) {
        URL.revokeObjectURL(previewPdfUrl);
      }
      const blob = new Blob([result.pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPreviewPdfUrl(url);
      setIsPreviewModalOpen(true);
    } catch (err: any) {
      console.error('Preview failed:', err);
      alert(`Preview error: ${err?.message || 'Failed to render PDF preview.'}`);
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setStatusText('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-rose-500/30">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            id="back-to-dashboard-btn"
            onClick={onNavigateToDashboard}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Suite Dashboard</span>
          </button>

          <div className="h-4 w-px bg-slate-800" />

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-600 to-pink-600 flex items-center justify-center text-white shadow-md shadow-rose-600/20">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-white tracking-tight">
                  Images to PDF Packager (JPG, PNG, WebP)
                </h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  Ready to Package
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Lossless packaging & layout arrangement for photos, scans, and graphic documents
              </p>
            </div>
          </div>
        </div>

        {/* Top Right Quick Actions */}
        <div className="flex items-center gap-2.5">
          {images.length > 0 && (
            <button
              type="button"
              onClick={handleGeneratePreview}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"
            >
              <Eye className="w-3.5 h-3.5 text-rose-400" />
              <span>Preview PDF</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleLoadSampleGallery}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium border border-rose-500/30 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            <span>Load Sample Gallery</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Images</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png, image/jpeg, image/webp, image/bmp, image/gif"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFilesAdded(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Center: Image Workspace (8 Cols) */}
        <section className="lg:col-span-8 flex flex-col space-y-4">
          {/* Dropzone or Empty State */}
          {images.length === 0 ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files) handleFilesAdded(e.dataTransfer.files);
              }}
              className={`rounded-2xl border-2 border-dashed p-10 flex flex-col items-center justify-center text-center transition-all min-h-[480px] ${
                isDragOver
                  ? 'border-rose-500 bg-rose-500/10 scale-[0.99]'
                  : 'border-slate-700 bg-slate-800/40 hover:border-slate-600 hover:bg-slate-800/60'
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-xl">
                <Upload className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-white mb-1">
                Drop your JPG, PNG, WebP, or BMP images here
              </h2>
              <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
                Reorder, rotate, and combine receipts, photos, and scanned documents into a single clean PDF with customizable margins and page layouts.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:brightness-110 text-white font-semibold text-xs shadow-lg shadow-rose-600/20 transition-all flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Choose Images from Device</span>
                </button>
                <button
                  type="button"
                  onClick={handleLoadSampleGallery}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-colors flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-rose-400" />
                  <span>Try Sample Gallery (4 Items)</span>
                </button>
              </div>

              <div className="mt-8 flex items-center gap-4 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 100% Client-Side Privacy
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> No Upload Size Limits
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Multi-Image Grid Layouts
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Workspace Toolbar */}
              <div className="bg-slate-800/80 backdrop-blur border border-slate-700/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
                {/* Summary Info */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-white">
                    {images.length} {images.length === 1 ? 'Image' : 'Images'}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({(totalInputSize / (1024 * 1024)).toFixed(2)} MB total)
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 text-rose-300 border border-slate-700">
                    ≈ {estimatedPages} PDF {estimatedPages === 1 ? 'Page' : 'Pages'}
                  </span>
                </div>

                {/* Toolbar Actions */}
                <div className="flex items-center gap-2">
                  {/* Sorting dropdown */}
                  <div className="flex items-center rounded-lg bg-slate-900 border border-slate-700 p-0.5">
                    <button
                      type="button"
                      title="Sort by Name (A-Z)"
                      onClick={() => handleSortImages('name')}
                      className="px-2 py-1 text-[11px] text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
                    >
                      A-Z
                    </button>
                    <button
                      type="button"
                      title="Sort by File Size"
                      onClick={() => handleSortImages('size')}
                      className="px-2 py-1 text-[11px] text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
                    >
                      Size
                    </button>
                    <button
                      type="button"
                      title="Reverse Order"
                      onClick={() => handleSortImages('reverse')}
                      className="px-2 py-1 text-[11px] text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
                    >
                      Flip
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleRotateAll}
                    title="Rotate all images 90° clockwise"
                    className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
                  >
                    <RotateCw className="w-3 h-3 text-rose-400" />
                    <span>Rotate All</span>
                  </button>

                  <div className="flex items-center rounded-lg bg-slate-900 border border-slate-700 p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={`p-1 rounded ${viewMode === 'grid' ? 'bg-slate-800 text-rose-400' : 'text-slate-400 hover:text-slate-200'}`}
                      title="Grid View"
                    >
                      <Grid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={`p-1 rounded ${viewMode === 'list' ? 'bg-slate-800 text-rose-400' : 'text-slate-400 hover:text-slate-200'}`}
                      title="List View"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearAll}
                    title="Clear all images"
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              {/* Grid or List Rendering */}
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {images.map((item, index) => {
                    const pageNum = Math.floor(index / itemsPerPage) + 1;

                    return (
                      <div
                        key={item.id}
                        className="group relative bg-slate-800/90 border border-slate-700/80 rounded-xl overflow-hidden shadow-lg flex flex-col justify-between hover:border-rose-500/50 hover:shadow-rose-500/10 transition-all"
                      >
                        {/* Top Image Card Header */}
                        <div className="px-3 py-2 bg-slate-900/80 border-b border-slate-700/60 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
                              #{index + 1}
                            </span>
                            <span className="text-xs font-medium text-slate-200 truncate" title={item.name}>
                              {item.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleRotateImage(item.id)}
                              title="Rotate 90°"
                              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(item.id)}
                              title="Delete Image"
                              className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Image Preview Canvas Box */}
                        <div
                          onClick={() => setSelectedPreviewImage(item)}
                          className="relative h-44 bg-slate-950/60 flex items-center justify-center p-2 cursor-pointer overflow-hidden group/img"
                        >
                          <img
                            src={item.previewUrl}
                            alt={item.name}
                            style={{
                              transform: `rotate(${item.rotation}deg)`,
                              maxHeight: '100%',
                              maxWidth: '100%',
                              objectFit: 'contain',
                            }}
                            className="transition-transform duration-200 drop-shadow-md"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="flex items-center gap-1 text-[11px] font-medium text-white px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-700">
                              <Eye className="w-3 h-3 text-rose-400" /> Click to Zoom
                            </span>
                          </div>
                        </div>

                        {/* Card Bottom Details & Reorder controls */}
                        <div className="px-3 py-2 bg-slate-900/60 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
                          <div className="flex items-center gap-2">
                            <span>{item.width}×{item.height}px</span>
                            <span>•</span>
                            <span>{(item.size / 1024).toFixed(0)} KB</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMoveImage(index, 'up')}
                              title="Move Left/Earlier"
                              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-20 transition-colors"
                            >
                              <ArrowUp className="w-3 h-3 rotate-[-90deg]" />
                            </button>
                            <button
                              type="button"
                              disabled={index === images.length - 1}
                              onClick={() => handleMoveImage(index, 'down')}
                              title="Move Right/Later"
                              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-20 transition-colors"
                            >
                              <ArrowDown className="w-3 h-3 rotate-[-90deg]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {images.map((item, index) => (
                    <div
                      key={item.id}
                      className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-slate-600 transition-all"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          #{index + 1}
                        </span>
                        <div className="w-12 h-12 rounded-lg bg-slate-950 flex items-center justify-center overflow-hidden shrink-0 border border-slate-700">
                          <img
                            src={item.previewUrl}
                            alt={item.name}
                            style={{ transform: `rotate(${item.rotation}deg)` }}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-semibold text-white truncate">{item.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {item.width}×{item.height}px • {(item.size / 1024).toFixed(0)} KB • {item.type.replace('image/', '').toUpperCase()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRotateImage(item.id)}
                          title="Rotate 90°"
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                        >
                          <RotateCw className="w-3.5 h-3.5 text-rose-400" />
                        </button>
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMoveImage(index, 'up')}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-20 transition-colors"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === images.length - 1}
                          onClick={() => handleMoveImage(index, 'down')}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-20 transition-colors"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(item.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right: PDF Packaging Settings & Action Bar (4 Cols) */}
        <section className="lg:col-span-4 flex flex-col space-y-4">
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-xl space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-700/60 pb-3">
              <Sliders className="w-4 h-4 text-rose-400" />
              <h2 className="text-sm font-bold text-white tracking-wide">
                PDF Packaging Configuration
              </h2>
            </div>

            {/* Page Size Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Page Format</span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {settings.pageSize === 'fit' ? 'Auto Dynamic' : PAGE_DIMENSIONS[settings.pageSize as keyof typeof PAGE_DIMENSIONS]?.name}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'a4', label: 'A4 Standard' },
                  { id: 'letter', label: 'US Letter' },
                  { id: 'legal', label: 'US Legal' },
                  { id: 'fit', label: 'Fit to Image' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, pageSize: opt.id as ImagePageSize }))}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all text-left ${
                      settings.pageSize === opt.id
                        ? 'bg-rose-500/20 border-rose-500 text-white font-bold ring-1 ring-rose-500/50'
                        : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Orientation Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Page Orientation
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'auto', label: 'Auto' },
                  { id: 'portrait', label: 'Portrait' },
                  { id: 'landscape', label: 'Landscape' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, orientation: opt.id as ImageOrientation }))}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                      settings.orientation === opt.id
                        ? 'bg-rose-500/20 border-rose-500 text-white font-bold ring-1 ring-rose-500/50'
                        : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Margins Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Page Margins
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'none', label: 'None (0)' },
                  { id: 'small', label: 'Small' },
                  { id: 'medium', label: 'Medium' },
                  { id: 'large', label: 'Large' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, margin: opt.id as ImageMargin }))}
                    className={`py-1.5 px-1.5 rounded-lg text-[11px] font-medium border text-center transition-all ${
                      settings.margin === opt.id
                        ? 'bg-rose-500/20 border-rose-500 text-white font-bold ring-1 ring-rose-500/50'
                        : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Layout Mode (Images per Page) */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Layout Mode</span>
                <span className="text-[11px] text-slate-400">
                  {settings.layoutMode === '1-up' ? '1 Image / Page' : settings.layoutMode === '2-up' ? '2 Images / Page' : '4-up Grid'}
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: '1-up', label: '1 / Page' },
                  { id: '2-up', label: '2 / Page' },
                  { id: '4-up', label: '4-Grid' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, layoutMode: opt.id as ImageLayoutMode }))}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                      settings.layoutMode === opt.id
                        ? 'bg-rose-500/20 border-rose-500 text-white font-bold ring-1 ring-rose-500/50'
                        : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality & Compression */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Quality & File Size
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'high', label: 'High (90%)' },
                  { id: 'medium', label: 'Balanced' },
                  { id: 'web', label: 'Compact' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, compression: opt.id as ImageCompression }))}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                      settings.compression === opt.id
                        ? 'bg-rose-500/20 border-rose-500 text-white font-bold ring-1 ring-rose-500/50'
                        : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Document Metadata Options */}
            <div className="space-y-3 pt-2 border-t border-slate-700/60">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Output Filename
                </label>
                <input
                  type="text"
                  value={settings.outputFilename}
                  onChange={(e) => setSettings((s) => ({ ...s, outputFilename: e.target.value }))}
                  placeholder="Packaged_Images.pdf"
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-300 font-medium">
                  Add Page Numbers
                </span>
                <input
                  type="checkbox"
                  checked={settings.addPageNumbers}
                  onChange={(e) => setSettings((s) => ({ ...s, addPageNumbers: e.target.checked }))}
                  className="w-4 h-4 text-rose-600 rounded bg-slate-900 border-slate-700 focus:ring-rose-500"
                />
              </div>
            </div>

            {/* Packaging Progress Status */}
            {isProcessing && (
              <div className="p-3 bg-slate-900/80 rounded-xl border border-rose-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-rose-300">{statusText}</span>
                  <span className="font-mono text-slate-400">{progress}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-rose-500 to-pink-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Primary Action Button */}
            <div className="pt-2">
              <button
                type="button"
                id="package-and-download-btn"
                disabled={images.length === 0 || isProcessing}
                onClick={handlePackageAndDownload}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:brightness-110 text-white font-bold text-sm shadow-xl shadow-rose-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Packaging PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Package & Download PDF ({estimatedPages} {estimatedPages === 1 ? 'Page' : 'Pages'})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Image Zoom / Detail Lightbox Modal */}
      {selectedPreviewImage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-5 space-y-4 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="truncate">
                <h3 className="text-sm font-bold text-white truncate">{selectedPreviewImage.name}</h3>
                <p className="text-xs text-slate-400">
                  {selectedPreviewImage.width}×{selectedPreviewImage.height}px • {(selectedPreviewImage.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreviewImage(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 flex items-center justify-center overflow-auto p-4 bg-slate-950/60 rounded-xl">
              <img
                src={selectedPreviewImage.previewUrl}
                alt={selectedPreviewImage.name}
                style={{ transform: `rotate(${selectedPreviewImage.rotation}deg)` }}
                className="max-h-[60vh] max-w-full object-contain rounded drop-shadow-xl"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => handleRotateImage(selectedPreviewImage.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
              >
                <RotateCw className="w-4 h-4 text-rose-400" />
                <span>Rotate 90°</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPreviewImage(null)}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Live Preview Modal */}
      {isPreviewModalOpen && previewPdfUrl && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-5xl w-full h-[88vh] p-5 flex flex-col space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm font-bold text-white">Live PDF Preview</h3>
                <span className="text-xs text-slate-400">({settings.outputFilename})</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = previewPdfUrl;
                    a.download = settings.outputFilename;
                    a.click();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/20"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
              <iframe
                src={previewPdfUrl}
                title="Packaged PDF Preview"
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
