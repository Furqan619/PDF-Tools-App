import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FilePlus2, 
  Sparkles, 
  Cpu, 
  TableProperties, 
  Layers, 
  FileCheck2,
  FileCode2,
  ArrowRight
} from 'lucide-react';
import { SAMPLE_PRESETS, SampleDocPreset, generateSamplePdfBlob } from '../services/sampleFiles';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  isQueueEmpty: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({ onFilesSelected, isQueueEmpty }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCount, setDragCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCount((prev) => prev + 1);
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCount((prev) => {
      const next = prev - 1;
      if (next <= 0) {
        setIsDragOver(false);
        return 0;
      }
      return next;
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragCount(0);

    const droppedFiles: File[] = [];
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const f = e.dataTransfer.files[i];
        if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
          droppedFiles.push(f);
        }
      }
    }

    if (droppedFiles.length > 0) {
      onFilesSelected(droppedFiles);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = (Array.from(e.target.files) as File[]).filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
      );
      if (selectedFiles.length > 0) {
        onFilesSelected(selectedFiles);
      }
      // Reset input value so same file can be re-selected if needed
      e.target.value = '';
    }
  };

  const handleSampleSelect = (preset: SampleDocPreset) => {
    const sampleFile = generateSamplePdfBlob(preset.id);
    onFilesSelected([sampleFile]);
  };

  return (
    <div className="w-full">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        id="pdf-file-input"
        accept=".pdf,application/pdf"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Main Drag and Drop Box */}
      <div
        id="dropzone-container"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative group cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 p-6 sm:p-10 text-center ${
          isDragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 scale-[1.005] shadow-2xl shadow-blue-500/10'
            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/70 shadow-xs dark:shadow-none'
        }`}
      >
        <div className="flex flex-col items-center justify-center max-w-xl mx-auto pointer-events-none">
          {/* Animated Icon */}
          <div
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 ${
              isDragOver
                ? 'bg-blue-600 text-white scale-110 shadow-lg shadow-blue-500/40 animate-pulse'
                : 'bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-700 text-blue-600 dark:text-blue-400 group-hover:scale-105 group-hover:border-blue-400 dark:group-hover:border-blue-500/40'
            }`}
          >
            {isDragOver ? (
              <FilePlus2 className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            ) : (
              <UploadCloud className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600 dark:text-blue-400" />
            )}
          </div>

          {/* Heading */}
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-1.5">
            {isDragOver ? 'Drop your PDF files here' : 'Drag & drop your PDF documents here'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6">
            or <span className="text-blue-600 dark:text-blue-400 font-semibold underline underline-offset-2">browse files</span> from your computer
          </p>

          {/* Feature Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full text-left">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
              <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="truncate">
                <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">Large File Streaming</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Page-by-page chunks</div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
              <TableProperties className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <div className="truncate">
                <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">Table Detection</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Word grid tables</div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
              <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="truncate">
                <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">Format Retention</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Fonts, styles, bullets</div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
              <FileCheck2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <div className="truncate">
                <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">Batch Processing</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Multi-file zip download</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sample Files Drawer if queue is empty */}
      {isQueueEmpty && (
        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>No PDF on hand? Try our instant sample documents:</span>
            </div>
            <span className="text-[11px] text-slate-500">1-click test</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SAMPLE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                id={`btn-sample-${preset.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSampleSelect(preset);
                }}
                className="group/btn text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs dark:shadow-none transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover/btn:text-blue-600 dark:group-hover/btn:text-blue-400 transition-colors truncate">
                      {preset.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400 font-mono">
                      {preset.pages} pgs
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {preset.description}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-blue-600 dark:text-blue-400 font-medium pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <span>Load Sample</span>
                  <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-0.5 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
