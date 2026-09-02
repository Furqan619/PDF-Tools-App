import React, { useState } from 'react';
import { 
  X, 
  Settings2, 
  Sliders, 
  Image as ImageIcon, 
  TableProperties, 
  Type, 
  Layers, 
  Sparkles, 
  Check,
  FileSpreadsheet
} from 'lucide-react';
import { ConversionSettings, ConversionMode, ImageHandlingMode, QueueItem } from '../types';

interface ConversionSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSettings: ConversionSettings;
  targetItem?: QueueItem | null;
  onSave: (settings: ConversionSettings, applyToAll: boolean) => void;
}

export const ConversionSettingsModal: React.FC<ConversionSettingsModalProps> = ({
  isOpen,
  onClose,
  initialSettings,
  targetItem,
  onSave,
}) => {
  const [settings, setSettings] = useState<ConversionSettings>(initialSettings);
  const [applyToAll, setApplyToAll] = useState(true);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(settings, applyToAll);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        id="settings-modal-content"
        className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Conversion Settings</h3>
              <p className="text-xs text-slate-400">
                {targetItem ? `Configuring: ${targetItem.name}` : 'Default settings for new & queued files'}
              </p>
            </div>
          </div>
          <button
            id="btn-close-settings"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* Mode Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Conversion Fidelity Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  id: 'high-fidelity',
                  title: 'High Fidelity',
                  desc: 'Preserves exact layout, line spacing, and font sizes',
                },
                {
                  id: 'editable-text',
                  title: 'Fluid & Editable',
                  desc: 'Reflows text into clean editable Word paragraphs',
                },
                {
                  id: 'text-only',
                  title: 'Fast Plain Text',
                  desc: 'Strips heavy graphics for ultra-fast conversion',
                },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSettings({ ...settings, mode: m.id as ConversionMode })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    settings.mode === m.id
                      ? 'border-blue-500 bg-blue-500/10 text-white shadow-sm ring-1 ring-blue-500/30'
                      : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-semibold text-xs mb-1 flex items-center justify-between">
                    <span>{m.title}</span>
                    {settings.mode === m.id && <Check className="w-3.5 h-3.5 text-blue-400" />}
                  </div>
                  <div className="text-[11px] text-slate-400 leading-snug">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Image Extraction Options */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>Image & Graphics Handling</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  id: 'compress',
                  title: 'Compress Images',
                  badge: 'Recommended',
                  desc: 'Downscales & compresses images to reduce Word file size for large documents',
                },
                {
                  id: 'original',
                  title: 'High Resolution',
                  badge: 'Larger File',
                  desc: 'Embeds crisp high-dpi graphics (may increase .docx file size)',
                },
                {
                  id: 'none',
                  title: 'No Images',
                  badge: 'Fastest',
                  desc: 'Strips all images and graphics for pure text and tables',
                },
              ].map((imgOpt) => (
                <button
                  key={imgOpt.id}
                  type="button"
                  onClick={() => setSettings({ ...settings, imageHandling: imgOpt.id as ImageHandlingMode })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    settings.imageHandling === imgOpt.id
                      ? 'border-blue-500 bg-blue-500/10 text-white shadow-sm ring-1 ring-blue-500/30'
                      : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-semibold text-xs mb-1 flex items-center justify-between">
                    <span>{imgOpt.title}</span>
                    {settings.imageHandling === imgOpt.id && <Check className="w-3.5 h-3.5 text-blue-400" />}
                  </div>
                  <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300 mb-1.5">
                    {imgOpt.badge}
                  </span>
                  <div className="text-[11px] text-slate-400 leading-snug">{imgOpt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Table & Structure Toggles */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Document Structure & Layout
            </label>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="flex items-center gap-3">
                <TableProperties className="w-5 h-5 text-indigo-400" />
                <div>
                  <div className="font-medium text-slate-200 text-xs">Auto Table Reconstruction</div>
                  <div className="text-[11px] text-slate-400">Detect tabular grids and format as editable Word tables</div>
                </div>
              </div>
              <input
                type="checkbox"
                id="toggle-detect-tables"
                checked={settings.detectTables}
                onChange={(e) => setSettings({ ...settings, detectTables: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="flex items-center gap-3">
                <Layers className="w-5 h-5 text-sky-400" />
                <div>
                  <div className="font-medium text-slate-200 text-xs">Preserve Page Breaks</div>
                  <div className="text-[11px] text-slate-400">Insert Microsoft Word page breaks matching original PDF pagination</div>
                </div>
              </div>
              <input
                type="checkbox"
                id="toggle-preserve-page-breaks"
                checked={settings.preservePageBreaks}
                onChange={(e) => setSettings({ ...settings, preservePageBreaks: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
              />
            </div>
          </div>

          {/* Page Range Filter */}
          <div className="pt-2 border-t border-slate-800">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Page Range
            </label>
            <input
              type="text"
              id="input-page-range"
              value={settings.pageRange}
              onChange={(e) => setSettings({ ...settings, pageRange: e.target.value })}
              placeholder="e.g. all or 1-5, 8, 11-20"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-500 font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Use <code className="text-blue-400">all</code> for full document, or specify ranges like <code className="text-blue-400">1-10, 15, 20-30</code> to convert selective pages in large files.
            </p>
          </div>

          {/* Typography Settings */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Output Word Font
              </label>
              <select
                id="select-font-family"
                value={settings.fontFamily}
                onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="Calibri">Calibri (Standard)</option>
                <option value="Arial">Arial (Clean Sans)</option>
                <option value="Times New Roman">Times New Roman (Serif)</option>
                <option value="Aptos">Aptos (Modern Office)</option>
                <option value="Segoe UI">Segoe UI</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Base Font Size
              </label>
              <select
                id="select-font-size"
                value={settings.baseFontSizePt}
                onChange={(e) => setSettings({ ...settings, baseFontSizePt: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
              >
                <option value={10}>10 pt (Compact)</option>
                <option value={11}>11 pt (Standard Word)</option>
                <option value={12}>12 pt (Large / Formal)</option>
                <option value={14}>14 pt (Presentation)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="checkbox-apply-all"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="checkbox-apply-all" className="text-xs text-slate-300 cursor-pointer">
              Apply to all queued documents
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-cancel-settings"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              id="btn-save-settings"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-md shadow-blue-500/20 transition-all"
            >
              Apply Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
