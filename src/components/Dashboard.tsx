import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Layers, 
  Minimize2, 
  ScanText, 
  Image as ImageIcon, 
  Table, 
  ShieldCheck, 
  FileImage,
  Hash,
  Crop,
  Code,
  Presentation,
  FileSpreadsheet,
  Edit3,
  ArrowRight, 
  Search, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  PlusCircle, 
  Cpu, 
  Lock, 
  HelpCircle,
  LayoutGrid
} from 'lucide-react';
import { AppCardItem, AppCategory } from '../types';
import { APP_CATALOG, APP_CATEGORIES } from '../services/appCatalog';
import { ThemeToggle } from './ThemeToggle';

interface DashboardProps {
  onSelectApp: (appId: string) => void;
  activeQueueCount: number;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectApp, activeQueueCount }) => {
  const [selectedCategory, setSelectedCategory] = useState<AppCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [infoModalApp, setInfoModalApp] = useState<AppCardItem | null>(null);

  // Filter apps based on category and search query
  const filteredApps = useMemo(() => {
    return APP_CATALOG.filter((app) => {
      const matchesCategory = selectedCategory === 'all' || app.category === selectedCategory;
      const matchesSearch = 
        searchQuery.trim() === '' ||
        app.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.supportedFormats.some((fmt) => fmt.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  // Dynamic icon resolver
  const renderAppIcon = (iconName: string, className: string = 'w-6 h-6 text-white') => {
    switch (iconName) {
      case 'FileText':
        return <FileText className={className} />;
      case 'Layers':
        return <Layers className={className} />;
      case 'Minimize2':
        return <Minimize2 className={className} />;
      case 'ScanText':
        return <ScanText className={className} />;
      case 'Image':
        return <ImageIcon className={className} />;
      case 'Table':
        return <Table className={className} />;
      case 'ShieldCheck':
        return <ShieldCheck className={className} />;
      case 'FileImage':
        return <FileImage className={className} />;
      case 'Hash':
        return <Hash className={className} />;
      case 'Crop':
        return <Crop className={className} />;
      case 'Code':
        return <Code className={className} />;
      case 'Presentation':
        return <Presentation className={className} />;
      case 'FileSpreadsheet':
        return <FileSpreadsheet className={className} />;
      case 'Edit3':
        return <Edit3 className={className} />;
      default:
        return <FileText className={className} />;
    }
  };

  return (
    <div className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Top Navigation Bar with Brand & Top-Right Dark/Light Mode Toggle */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur sticky top-0 z-30 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 ring-1 ring-white/10 shrink-0">
              <LayoutGrid className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                  Document Studio
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3" />
                  <span>100% In-Browser</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                Secure Client-Side Document & PDF Tools
              </p>
            </div>
          </div>

          {/* Top Right Controls: Theme Toggle & Active Queue Link */}
          <div className="flex items-center gap-3">
            {activeQueueCount > 0 && (
              <button
                onClick={() => onSelectApp('pdf-to-docx')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-xs font-semibold transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span>Resume Active ({activeQueueCount})</span>
              </button>
            )}

            {/* Dark and Light Mode Toggle Button */}
            <ThemeToggle variant="button" />
          </div>
        </div>
      </header>

      {/* Hero Header Section */}
      <section className="relative border-b border-slate-200 dark:border-slate-800 bg-gradient-to-b from-blue-50/60 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 pt-8 pb-10 px-4 sm:px-6 lg:px-8 transition-colors">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Document Workspace Hub</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Document Tools & Converters Suite
              </h1>
              <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                A modular suite of client-side document utilities. Convert, organize, and process PDFs and office formats directly inside your browser with zero data leaving your device.
              </p>
            </div>

            {/* Privacy & Engine Stats Pill */}
            <div className="flex flex-wrap md:flex-col gap-3 shrink-0">
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 backdrop-blur flex items-center gap-3 shadow-xs dark:shadow-none">
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">100% In-Browser Privacy</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Zero cloud uploads or external API leaks</div>
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 backdrop-blur flex items-center gap-3 shadow-xs dark:shadow-none">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">Native WebAssembly & Canvas</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">High-speed streaming & spatial layout engine</div>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Category Filter Bar */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-thin">
              {APP_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700/60 shadow-xs dark:shadow-none'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tools or formats..."
                className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-xs dark:shadow-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area: 70% Cards on Left, 30% Advertisements on Right */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row items-start gap-8">
          {/* LEFT 70% SECTION: Tools & Application Cards */}
          <div className="w-full lg:w-[70%] space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Document Tools
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                  {filteredApps.length} {filteredApps.length === 1 ? 'tool' : 'tools'}
                </span>
              </div>

              {activeQueueCount > 0 && (
                <button
                  onClick={() => onSelectApp('pdf-to-docx')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-xs font-medium transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span>Resume Word ({activeQueueCount} active)</span>
                </button>
              )}
            </div>

            {/* Compact Cards Grid (Logo, Title, Description Only) - 3 Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
              {filteredApps.map((app) => {
                const isActive = app.status === 'active';

                return (
                  <div
                    key={app.id}
                    id={`app-card-${app.id}`}
                    onClick={() => {
                      if (isActive) {
                        onSelectApp(app.id);
                      } else {
                        setInfoModalApp(app);
                      }
                    }}
                    className={`group relative rounded-xl border p-4 sm:p-5 transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer ${
                      isActive
                        ? app.id === 'pdf-merge-split'
                          ? 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-emerald-500/60 hover:bg-emerald-50/20 dark:hover:bg-slate-800 hover:shadow-lg hover:shadow-emerald-500/5 dark:hover:shadow-emerald-500/10 shadow-xs dark:shadow-none'
                          : app.id === 'pdf-compress'
                          ? 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-amber-500/60 hover:bg-amber-50/20 dark:hover:bg-slate-800 hover:shadow-lg hover:shadow-amber-500/5 dark:hover:shadow-amber-500/10 shadow-xs dark:shadow-none'
                          : app.id === 'pdf-ocr-extract'
                          ? 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-purple-500/60 hover:bg-purple-50/20 dark:hover:bg-slate-800 hover:shadow-lg hover:shadow-purple-500/5 dark:hover:shadow-purple-500/10 shadow-xs dark:shadow-none'
                          : app.id === 'image-to-pdf'
                          ? 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-rose-500/60 hover:bg-rose-50/20 dark:hover:bg-slate-800 hover:shadow-lg hover:shadow-rose-500/5 dark:hover:shadow-rose-500/10 shadow-xs dark:shadow-none'
                          : app.id === 'pdf-to-excel'
                          ? 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-cyan-500/60 hover:bg-cyan-50/20 dark:hover:bg-slate-800 hover:shadow-lg hover:shadow-cyan-500/5 dark:hover:shadow-cyan-500/10 shadow-xs dark:shadow-none'
                          : app.id === 'pdf-protect-watermark'
                          ? 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-sky-500/60 hover:bg-sky-50/20 dark:hover:bg-slate-800 hover:shadow-lg hover:shadow-sky-500/5 dark:hover:shadow-sky-500/10 shadow-xs dark:shadow-none'
                          : app.id === 'pdf-to-image'
                          ? 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-teal-500/60 hover:bg-teal-50/20 dark:hover:bg-slate-800 hover:shadow-lg hover:shadow-teal-500/5 dark:hover:shadow-teal-500/10 shadow-xs dark:shadow-none'
                          : app.id === 'pdf-page-numbers'
                          ? 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-sky-500/60 hover:bg-sky-50/20 dark:hover:bg-slate-800 hover:shadow-lg hover:shadow-sky-500/5 dark:hover:shadow-sky-500/10 shadow-xs dark:shadow-none'
                          : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-blue-500/60 hover:bg-blue-50/20 dark:hover:bg-slate-800 hover:shadow-lg hover:shadow-blue-500/5 dark:hover:shadow-blue-500/10 shadow-xs dark:shadow-none'
                        : 'bg-slate-100/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/40 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {/* Top Subtle Accent Stripe */}
                    <div
                      className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${app.accentGradient} opacity-70 group-hover:opacity-100 transition-opacity`}
                    />

                    <div className="space-y-3">
                      {/* Logo (App Icon) */}
                      <div
                        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${app.accentGradient} flex items-center justify-center shadow-md shadow-black/20 group-hover:scale-105 transition-transform shrink-0`}
                      >
                        {renderAppIcon(app.iconName, 'w-5 h-5 text-white')}
                      </div>

                      {/* Title & Description Only */}
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors leading-snug">
                          {app.title}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed line-clamp-3">
                          {app.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT 30% SECTION: Advertisements & Sponsor Space */}
          <aside className="w-full lg:w-[30%] space-y-6 shrink-0">
            {/* Ad Banner 1: Sponsored Cloud / Pro Ad */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-3 shadow-sm dark:shadow-xl relative overflow-hidden transition-colors">
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-semibold">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                  Sponsored
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  Ad
                </span>
              </div>

              {/* Ad Creative Box */}
              <div className="rounded-xl bg-gradient-to-br from-indigo-50/90 via-blue-50/60 to-purple-50/50 dark:from-indigo-900/60 dark:via-slate-800 dark:to-purple-900/40 p-4 border border-indigo-200 dark:border-indigo-500/20 space-y-3 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/30">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Cloud Enterprise PDF Engine
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    Scale high-throughput automated PDF generation, OCR pipelines, and batch form processing with 99.99% SLA.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => window.open('https://cloud.google.com', '_blank', 'noopener,noreferrer')}
                  className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all text-center"
                >
                  Explore Enterprise API →
                </button>
              </div>
              <div className="text-[10px] text-slate-400 text-center">
                Ads by Google AdSense • <span className="hover:underline cursor-pointer">Why this ad?</span>
              </div>
            </div>

            {/* Ad Banner 2: Skyscraper / Standard Display Ad (300x250 slot) */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-3 shadow-sm dark:shadow-xl relative overflow-hidden transition-colors">
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-semibold">
                <span>Advertisement</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  Ad • 300×250
                </span>
              </div>

              {/* Display Creative */}
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/60 p-5 flex flex-col items-center justify-center text-center space-y-3 min-h-[220px] transition-colors">
                <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-slate-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-slate-700">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Zero-Trust Security Suite
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[200px] leading-relaxed">
                    End-to-end encrypted document collaboration for modern remote teams.
                  </p>
                </div>
                <button
                  type="button"
                  className="px-3.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-medium transition-colors shadow-xs"
                >
                  Learn More
                </button>
              </div>
            </div>

            {/* Ad Banner 3: Developer Tools / Partner Slot */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 space-y-3 shadow-sm transition-colors">
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-semibold">
                <span>Promoted Partner</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  Sponsored
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 flex items-center justify-center text-xs font-bold">
                    AI
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-200">DocuAI Assistant Pro</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Automate contract analysis and table extraction with state-of-the-art vision models.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Info / Planned Tool Details Modal */}
      {infoModalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${infoModalApp.accentGradient} flex items-center justify-center`}>
                  {renderAppIcon(infoModalApp.iconName, 'w-5 h-5 text-white')}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{infoModalApp.title}</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{infoModalApp.supportedFormats.join(', ')}</span>
                </div>
              </div>
              <button
                onClick={() => setInfoModalApp(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {infoModalApp.description}
            </p>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                Planned Engine Capabilities
              </h4>
              <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60">
                {infoModalApp.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
              <HelpCircle className="w-4 h-4 shrink-0" />
              <span>
                Want to use the active converter right now? Try the <strong>PDF to Word (.docx) Converter</strong>.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setInfoModalApp(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setInfoModalApp(null);
                  onSelectApp('pdf-to-docx');
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
              >
                Open PDF to Word
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/60 py-6 text-center text-xs text-slate-500 transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Document Studio • Client-Side Modular Architecture</span>
          <span>Zero Server Uploads • 100% In-Browser Privacy</span>
        </div>
      </footer>
    </div>
  );
};

