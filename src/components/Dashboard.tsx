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
  Smartphone,
  Camera,
  ArrowRight, 
  Search, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  PlusCircle, 
  Cpu, 
  Lock, 
  HelpCircle,
  LayoutGrid,
  Wrench,
  Unlock,
  QrCode,
  BookOpen,
  Download,
  ExternalLink
} from 'lucide-react';
import { AppCardItem, AppCategory } from '../types';
import { APP_CATALOG, APP_CATEGORIES } from '../services/appCatalog';
import { ThemeToggle } from './ThemeToggle';
import { saveAs } from 'file-saver';
import confetti from 'canvas-confetti';

interface DashboardProps {
  onSelectApp: (appId: string) => void;
  activeQueueCount: number;
}

type MainDashboardTab = 'converters' | 'library' | 'softwares';

export const Dashboard: React.FC<DashboardProps> = ({ onSelectApp, activeQueueCount }) => {
  const [activeTab, setActiveTab] = useState<MainDashboardTab>('converters');
  const [selectedCategory, setSelectedCategory] = useState<AppCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [infoModalApp, setInfoModalApp] = useState<AppCardItem | null>(null);

  // Digital Library sample items
  const digitalLibraryItems = [
    {
      id: 'lib-1',
      title: 'Python & JavaScript Programming Cheatsheet',
      category: 'Programming',
      format: 'PDF (24 Pages)',
      size: '2.4 MB',
      description: 'Comprehensive syntax reference guide covering modern ES6+ features, Python data structures, algorithms, and standard libraries.',
    },
    {
      id: 'lib-2',
      title: 'Data Structures & Algorithms Handbook',
      category: 'Computer Science',
      format: 'PDF (180 Pages)',
      size: '12.8 MB',
      description: 'Illustrated guide to trees, graphs, sorting algorithms, dynamic programming, and interview preparation patterns.',
    },
    {
      id: 'lib-3',
      title: 'Modern Web Design & Tailwind Handbook',
      category: 'Web Development',
      format: 'PDF (96 Pages)',
      size: '8.1 MB',
      description: 'Design systems, typography scaling, responsive grid architecture, and production-ready Tailwind CSS patterns.',
    },
    {
      id: 'lib-4',
      title: 'Open Source Public Domain Literature Classics',
      category: 'Literature',
      format: 'ZIP (EPUB / PDF)',
      size: '45.2 MB',
      description: 'A curated collection of timeless masterpieces from world literature in unencrypted open formats.',
    },
  ];

  // Free Softwares & Tools items
  const freeSoftwaresItems = [
    {
      id: 'qr-code-generator',
      title: 'QR Code Generator',
      category: 'Utility',
      description: 'Generate high-resolution custom QR codes for URLs, Wi-Fi, text, and contacts instantly.',
      badge: 'Interactive Tool',
      actionId: 'qr-code-generator',
    },
    {
      id: 'json-formatter',
      title: 'JSON Formatter & Validator',
      category: 'Developer',
      description: 'Format, validate, minify, and inspect JSON payloads with syntax tree view and error highlighting.',
      badge: 'Web Tool',
    },
    {
      id: 'password-generator',
      title: 'Secure Password Generator',
      category: 'Security',
      description: 'Generate cryptographically secure random passwords and passphrases with custom character sets.',
      badge: 'Utility',
    },
    {
      id: 'markdown-editor',
      title: 'Markdown Live Previewer',
      category: 'Productivity',
      description: 'Write markdown documents with live split-screen HTML preview and instant export.',
      badge: 'Editor',
    },
  ];

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
      case 'Smartphone':
        return <Smartphone className={className} />;
      case 'Camera':
        return <Camera className={className} />;
      case 'LayoutGrid':
        return <LayoutGrid className={className} />;
      case 'Wrench':
        return <Wrench className={className} />;
      case 'Unlock':
        return <Unlock className={className} />;
      case 'QrCode':
        return <QrCode className={className} />;
      default:
        return <FileText className={className} />;
    }
  };

  const handleDownloadLibraryItem = (itemTitle: string) => {
    const content = `Sample download content for: ${itemTitle}\nGenerated by Document Studio & Free Digital Library.\n100% Secure Client-Side Access.`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `${itemTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}.txt`);
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
  };

  return (
    <div className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Top Navigation Bar */}
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
                Secure Client-Side Document & PDF Tools Hub
              </p>
            </div>
          </div>

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
            <ThemeToggle variant="button" />
          </div>
        </div>
      </header>

      {/* Main Content Area: 70% Left Suite & 3 Cards, 30% Right Ads */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row items-start gap-8">
          
          {/* LEFT 70% SECTION */}
          <div className="w-full lg:w-[70%] space-y-6">
            
            {/* 3 Main Dashboard Cards from left to right */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Card 1: Doc Converter Tools */}
              <button
                onClick={() => setActiveTab('converters')}
                className={`text-left p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between group relative overflow-hidden ${
                  activeTab === 'converters'
                    ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-blue-600 shadow-lg shadow-blue-500/25 ring-2 ring-blue-500/20'
                    : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-blue-500/50 hover:shadow-md'
                }`}
              >
                <div className="space-y-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
                    activeTab === 'converters' ? 'bg-white/20 text-white' : 'bg-blue-600 text-white'
                  }`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${activeTab === 'converters' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                      Doc Converter Tools
                    </h3>
                    <p className={`text-xs mt-1 leading-relaxed ${activeTab === 'converters' ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                      All document tools & converters suite for PDF, Word, Excel, images, OCR & security.
                    </p>
                  </div>
                </div>
                <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs font-semibold ${
                  activeTab === 'converters' ? 'border-white/20 text-white' : 'border-slate-100 dark:border-slate-700 text-blue-600 dark:text-blue-400'
                }`}>
                  <span>{APP_CATALOG.length} Tools Available</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              {/* Card 2: Free Digital Library */}
              <button
                onClick={() => setActiveTab('library')}
                className={`text-left p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between group relative overflow-hidden ${
                  activeTab === 'library'
                    ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white border-emerald-600 shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-500/20'
                    : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-emerald-500/50 hover:shadow-md'
                }`}
              >
                <div className="space-y-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
                    activeTab === 'library' ? 'bg-white/20 text-white' : 'bg-emerald-600 text-white'
                  }`}>
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${activeTab === 'library' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                      Free Digital Library
                    </h3>
                    <p className={`text-xs mt-1 leading-relaxed ${activeTab === 'library' ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400'}`}>
                      Explore free programming guides, computer science books, study notes, and public domain literature.
                    </p>
                  </div>
                </div>
                <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs font-semibold ${
                  activeTab === 'library' ? 'border-white/20 text-white' : 'border-slate-100 dark:border-slate-700 text-emerald-600 dark:text-emerald-400'
                }`}>
                  <span>{digitalLibraryItems.length} Resources</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              {/* Card 3: Free Softwares/Tools */}
              <button
                onClick={() => setActiveTab('softwares')}
                className={`text-left p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between group relative overflow-hidden ${
                  activeTab === 'softwares'
                    ? 'bg-gradient-to-br from-violet-600 to-purple-600 text-white border-violet-600 shadow-lg shadow-violet-500/25 ring-2 ring-violet-500/20'
                    : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-violet-500/50 hover:shadow-md'
                }`}
              >
                <div className="space-y-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
                    activeTab === 'softwares' ? 'bg-white/20 text-white' : 'bg-violet-600 text-white'
                  }`}>
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${activeTab === 'softwares' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                      Free Softwares/Tools
                    </h3>
                    <p className={`text-xs mt-1 leading-relaxed ${activeTab === 'softwares' ? 'text-violet-100' : 'text-slate-500 dark:text-slate-400'}`}>
                      Free web developer utilities, QR code generator, JSON formatters, and password tools.
                    </p>
                  </div>
                </div>
                <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs font-semibold ${
                  activeTab === 'softwares' ? 'border-white/20 text-white' : 'border-slate-100 dark:border-slate-700 text-violet-600 dark:text-violet-400'
                }`}>
                  <span>{freeSoftwaresItems.length} Utilities</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            </div>

            {/* Content Switcher based on Active Tab */}
            {activeTab === 'converters' && (
              <div className="space-y-6 pt-2">
                {/* Search & Category Filter Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-thin">
                    {APP_CATEGORIES.map((cat) => {
                      const isSelected = selectedCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search document tools..."
                      className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Converters Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                        className="group relative rounded-xl border p-4 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-blue-500/60 hover:shadow-lg transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer"
                      >
                        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${app.accentGradient} opacity-70 group-hover:opacity-100 transition-opacity`} />
                        <div className="space-y-3">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${app.accentGradient} flex items-center justify-center shadow-md shadow-black/20 group-hover:scale-105 transition-transform shrink-0`}>
                            {renderAppIcon(app.iconName, 'w-5 h-5 text-white')}
                          </div>
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
            )}

            {activeTab === 'library' && (
              <div className="space-y-4">
                <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">Free Digital Library & Resources</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Download open access study guides, cheat sheets, and technical handbooks.</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                      Open Access
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    {digitalLibraryItems.map((item) => (
                      <div key={item.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col justify-between space-y-3 hover:border-emerald-500/50 transition-colors">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                              {item.category}
                            </span>
                            <span className="text-[11px] text-slate-400">{item.format} • {item.size}</span>
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</h3>
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{item.description}</p>
                        </div>
                        <button
                          onClick={() => handleDownloadLibraryItem(item.title)}
                          className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Instant Download</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'softwares' && (
              <div className="space-y-4">
                <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">Free Softwares & Web Utilities</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Handy web utilities and tools for developers and creators.</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20">
                      100% Free
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    {freeSoftwaresItems.map((sw) => (
                      <div key={sw.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col justify-between space-y-3 hover:border-violet-500/50 transition-colors">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300">
                              {sw.category}
                            </span>
                            <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400">{sw.badge}</span>
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{sw.title}</h3>
                          <p className="text-xs text-slate-600 dark:text-slate-300">{sw.description}</p>
                        </div>
                        <button
                          onClick={() => {
                            if (sw.actionId) {
                              onSelectApp(sw.actionId);
                            } else {
                              confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
                            }
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md shadow-violet-600/20 transition-all flex items-center justify-center gap-2"
                        >
                          <span>Launch Utility</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* RIGHT 30% SECTION: Advertisements & Sponsor Space */}
          <aside className="w-full lg:w-[30%] space-y-6 shrink-0">
            {/* Ad Banner 1 */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-3 shadow-sm relative overflow-hidden transition-colors">
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-semibold">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                  Sponsored
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  Ad
                </span>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-indigo-50/90 via-blue-50/60 to-purple-50/50 dark:from-indigo-900/60 dark:via-slate-800 dark:to-purple-900/40 p-4 border border-indigo-200 dark:border-indigo-500/20 space-y-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/30">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Cloud Enterprise PDF Engine</h4>
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
              <div className="text-[10px] text-slate-400 text-center">Ads by Google AdSense</div>
            </div>

            {/* Ad Banner 2 */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-3 shadow-sm relative overflow-hidden transition-colors">
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-semibold">
                <span>Advertisement</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  Ad • 300×250
                </span>
              </div>
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/60 p-5 flex flex-col items-center justify-center text-center space-y-3 min-h-[220px]">
                <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-slate-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-slate-700">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Zero-Trust Security Suite</div>
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

            {/* Ad Banner 3 */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 space-y-3 shadow-sm transition-colors">
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-semibold">
                <span>Promoted Partner</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  Sponsored
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
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

      {/* Info Modal */}
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
                Open Converter
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

