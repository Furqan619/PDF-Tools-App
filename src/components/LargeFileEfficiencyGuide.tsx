import React, { useState } from 'react';
import { 
  Cpu, 
  Layers, 
  ShieldCheck, 
  Zap, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle,
  FileCheck
} from 'lucide-react';

export const LargeFileEfficiencyGuide: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850/50 p-5 sm:p-6 text-slate-700 dark:text-slate-300 shadow-xs dark:shadow-none transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
              Large File & High Throughput Architecture
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                Active Engine
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Designed for processing 50MB+ and 100+ page PDF documents without browser memory exhaustion
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 shadow-xs dark:shadow-none transition-colors self-start sm:self-auto"
        >
          <span>{isExpanded ? 'Hide Architecture Details' : 'View Performance Pillars'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-200">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-xs mb-2">
              <Layers className="w-4 h-4" />
              <span>Streaming Page Chunking</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Documents are processed in decoupled page chunks rather than all-at-once memory buffers. Each page yields control to the browser loop to prevent freezing.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs mb-2">
              <Zap className="w-4 h-4" />
              <span>Canvas & Context Recycling</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Rendering contexts and memory allocations are cleaned up page-by-page. Downscaled image encoding reduces the resulting Word document size significantly.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>100% Client-Side Privacy</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Conversion runs purely inside your browser using WebAssembly & OpenXML serializers. Zero bytes are uploaded to any external server.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
