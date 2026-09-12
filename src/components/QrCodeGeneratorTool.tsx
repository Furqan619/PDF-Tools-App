import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  QrCode,
  Download,
  Copy,
  Check,
  Sparkles,
  Link,
  Mail,
  Phone,
  Wifi,
  FileText,
  Palette,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import QRCode from 'qrcode';
import { saveAs } from 'file-saver';
import confetti from 'canvas-confetti';
import { ThemeToggle } from './ThemeToggle';

interface QrCodeGeneratorToolProps {
  onNavigateToDashboard: () => void;
}

type QrType = 'url' | 'text' | 'wifi' | 'email' | 'phone';

export const QrCodeGeneratorTool: React.FC<QrCodeGeneratorToolProps> = ({ onNavigateToDashboard }) => {
  const [qrType, setQrType] = useState<QrType>('url');
  const [inputText, setInputText] = useState('https://ai.studio');
  
  // Specific fields for types
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiEncryption, setWifiEncryption] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');

  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const [phoneNum, setPhoneNum] = useState('');

  // Styling options
  const [fgColor, setFgColor] = useState('#0f172a'); // slate-900
  const [bgColor, setBgColor] = useState('#ffffff');
  const [errorCorrection, setErrorCorrection] = useState<'L' | 'M' | 'Q' | 'H'>('M');
  const [qrSize, setQrSize] = useState<number>(300);

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [svgString, setSvgString] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);

  // Compute final payload string based on qrType
  const getPayloadString = () => {
    switch (qrType) {
      case 'url':
      case 'text':
        return inputText || 'https://ai.studio';
      case 'wifi':
        return `WIFI:S:${wifiSsid};T:${wifiEncryption};P:${wifiPassword};;`;
      case 'email':
        return `mailto:${emailTo}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
      case 'phone':
        return `tel:${phoneNum}`;
      default:
        return inputText;
    }
  };

  useEffect(() => {
    generateQr();
  }, [qrType, inputText, wifiSsid, wifiPassword, wifiEncryption, emailTo, emailSubject, emailBody, phoneNum, fgColor, bgColor, errorCorrection, qrSize]);

  const generateQr = async () => {
    try {
      setIsGenerating(true);
      const payload = getPayloadString();

      // Generate PNG data URL
      const dataUrl = await QRCode.toDataURL(payload, {
        width: qrSize,
        margin: 2,
        color: {
          dark: fgColor,
          light: bgColor,
        },
        errorCorrectionLevel: errorCorrection,
      });
      setQrDataUrl(dataUrl);

      // Generate SVG string
      const svg = await QRCode.toString(payload, {
        type: 'svg',
        margin: 2,
        color: {
          dark: fgColor,
          light: bgColor,
        },
        errorCorrectionLevel: errorCorrection,
      });
      setSvgString(svg);

      setIsGenerating(false);
    } catch (err) {
      console.error('QR generation error:', err);
      setIsGenerating(false);
    }
  };

  const handleDownloadPng = () => {
    if (!qrDataUrl) return;
    saveAs(qrDataUrl, 'qrcode.png');
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
  };

  const handleDownloadSvg = () => {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    saveAs(blob, 'qrcode.svg');
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
  };

  const handleCopyImage = async () => {
    if (!qrDataUrl) return;
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy QR code image:', err);
      // Fallback to copying text payload
      navigator.clipboard.writeText(getPayloadString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
              <ArrowLeft className="w-4 h-4 text-violet-500 dark:text-violet-400 group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>

            <span className="text-slate-400 dark:text-slate-600 hidden sm:inline">/</span>

            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-md shadow-violet-500/20 ring-1 ring-white/10 shrink-0">
              <QrCode className="w-4 h-4 text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  QR Code <span className="text-violet-600 dark:text-violet-400 font-mono text-xs px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20">Generator</span>
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20">
                  <ShieldCheck className="w-3 h-3" />
                  <span className="hidden xs:inline">100% Secure</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden md:block">
                Generate high-resolution custom QR codes for URLs, text, Wi-Fi, and contacts instantly
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={handleDownloadPng}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-xs shadow-md shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download PNG</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Configuration Pane */}
          <div className="lg:col-span-7 space-y-6">
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500" />
                <span>Select Content Type</span>
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { id: 'url', label: 'URL / Link', icon: Link },
                  { id: 'text', label: 'Plain Text', icon: FileText },
                  { id: 'wifi', label: 'Wi-Fi', icon: Wifi },
                  { id: 'email', label: 'Email', icon: Mail },
                  { id: 'phone', label: 'Phone', icon: Phone },
                ].map((item) => {
                  const IconComp = item.icon;
                  const isActive = qrType === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setQrType(item.id as QrType)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all gap-1.5 ${
                        isActive
                          ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-500/20'
                          : 'bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Form inputs */}
              <div className="space-y-4 pt-2">
                {qrType === 'url' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Website URL</label>
                    <input
                      type="url"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-violet-500 outline-none"
                    />
                  </div>
                )}

                {qrType === 'text' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Text Content</label>
                    <textarea
                      rows={3}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Enter text or message..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-violet-500 outline-none"
                    />
                  </div>
                )}

                {qrType === 'wifi' && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Network SSID (Name)</label>
                      <input
                        type="text"
                        value={wifiSsid}
                        onChange={(e) => setWifiSsid(e.target.value)}
                        placeholder="MyHomeWiFi"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-violet-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Password</label>
                      <input
                        type="text"
                        value={wifiPassword}
                        onChange={(e) => setWifiPassword(e.target.value)}
                        placeholder="Network password"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-violet-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Encryption Type</label>
                      <select
                        value={wifiEncryption}
                        onChange={(e) => setWifiEncryption(e.target.value as any)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-violet-500 outline-none"
                      >
                        <option value="WPA">WPA / WPA2</option>
                        <option value="WEP">WEP</option>
                        <option value="nopass">No Password (Open)</option>
                      </select>
                    </div>
                  </div>
                )}

                {qrType === 'email' && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Recipient Email</label>
                      <input
                        type="email"
                        value={emailTo}
                        onChange={(e) => setEmailTo(e.target.value)}
                        placeholder="hello@example.com"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-violet-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Subject</label>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="Inquiry regarding..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-violet-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Message Body</label>
                      <textarea
                        rows={2}
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        placeholder="Write your message..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-violet-500 outline-none"
                      />
                    </div>
                  </div>
                )}

                {qrType === 'phone' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Phone Number</label>
                    <input
                      type="tel"
                      value={phoneNum}
                      onChange={(e) => setPhoneNum(e.target.value)}
                      placeholder="+1 (555) 019-2834"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-violet-500 outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Customization Options */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-violet-500" />
                  <span>Customization & Styling</span>
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">QR Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={fgColor}
                        onChange={(e) => setFgColor(e.target.value)}
                        className="w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer bg-transparent"
                      />
                      <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{fgColor}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Background Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer bg-transparent"
                      />
                      <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{bgColor}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Error Correction</label>
                    <select
                      value={errorCorrection}
                      onChange={(e) => setErrorCorrection(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none"
                    >
                      <option value="L">Low (~7%)</option>
                      <option value="M">Medium (~15%)</option>
                      <option value="Q">Quartile (~25%)</option>
                      <option value="H">High (~30%)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Image Resolution</label>
                    <select
                      value={qrSize}
                      onChange={(e) => setQrSize(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none"
                    >
                      <option value={200}>200 x 200 px (Compact)</option>
                      <option value={300}>300 x 300 px (Standard)</option>
                      <option value={500}>500 x 500 px (HD)</option>
                      <option value={1000}>1000 x 1000 px (Ultra HD)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Preview Pane */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center text-center space-y-6 sticky top-24">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Live QR Code Preview</h3>

              <div className="p-4 rounded-2xl bg-white shadow-md border border-slate-100 dark:border-slate-700 inline-block">
                {isGenerating ? (
                  <div className="w-[240px] h-[240px] flex items-center justify-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-violet-600" />
                  </div>
                ) : qrDataUrl ? (
                  <img src={qrDataUrl} alt="Generated QR Code" className="w-[240px] h-[240px] object-contain rounded-lg" />
                ) : (
                  <div className="w-[240px] h-[240px] flex items-center justify-center text-xs text-slate-400">
                    Enter valid data to generate
                  </div>
                )}
              </div>

              <div className="w-full space-y-3 pt-2">
                <button
                  onClick={handleDownloadPng}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-xs shadow-md shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download High-Res PNG</span>
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleDownloadSvg}
                    className="py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-xs border border-slate-200 dark:border-slate-600 transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download SVG</span>
                  </button>

                  <button
                    onClick={handleCopyImage}
                    className="py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-xs border border-slate-200 dark:border-slate-600 transition-all flex items-center justify-center gap-2"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy Image'}</span>
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Generated 100% locally in your browser. No data is stored or transmitted.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/60 py-4 text-center text-xs text-slate-500 dark:text-slate-500 mt-auto">
        QR Code Generator Pro • 100% Client-Side QR Codes for Web & Print
      </footer>
    </div>
  );
};
