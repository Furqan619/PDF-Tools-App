import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../services/themeContext';

interface ThemeToggleProps {
  variant?: 'button' | 'pill' | 'icon';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'button', className = '' }) => {
  const { theme, isDark, toggleTheme } = useTheme();

  if (variant === 'icon') {
    return (
      <button
        id="btn-theme-toggle-icon"
        type="button"
        onClick={toggleTheme}
        className={`p-2 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center ${
          isDark
            ? 'bg-slate-800/90 hover:bg-slate-700 text-amber-300 border-slate-700 hover:border-slate-600 shadow-sm shadow-black/20'
            : 'bg-white hover:bg-slate-100 text-indigo-600 border-slate-200 hover:border-slate-300 shadow-sm shadow-slate-200'
        } ${className}`}
        title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
        aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
      >
        {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
      </button>
    );
  }

  if (variant === 'pill') {
    return (
      <button
        id="btn-theme-toggle-pill"
        type="button"
        onClick={toggleTheme}
        className={`relative inline-flex items-center h-8 w-16 rounded-full p-1 transition-colors cursor-pointer border ${
          isDark
            ? 'bg-slate-800 border-slate-700'
            : 'bg-slate-200 border-slate-300'
        } ${className}`}
        title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
        aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
      >
        <span
          className={`inline-flex items-center justify-center w-6 h-6 rounded-full transform transition-transform duration-200 shadow-md ${
            isDark
              ? 'translate-x-8 bg-slate-900 text-amber-400'
              : 'translate-x-0 bg-white text-indigo-600'
          }`}
        >
          {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </span>
      </button>
    );
  }

  // Default 'button' variant with icon + label
  return (
    <button
      id="btn-theme-toggle"
      type="button"
      onClick={toggleTheme}
      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all duration-200 cursor-pointer shadow-sm ${
        isDark
          ? 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700 hover:border-slate-600 hover:text-white shadow-black/20'
          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 hover:text-slate-900 shadow-slate-200/50'
      } ${className}`}
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
      aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
    >
      <div className={`p-1 rounded-lg ${isDark ? 'bg-amber-400/10 text-amber-400' : 'bg-indigo-50 text-indigo-600'}`}>
        {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      </div>
      <span className="hidden sm:inline font-medium">
        {isDark ? 'Light Mode' : 'Dark Mode'}
      </span>
    </button>
  );
};
