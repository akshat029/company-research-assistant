import React, { useState, KeyboardEvent } from 'react';
import { Search, Zap, ChevronDown } from 'lucide-react';
import { DepthOption } from '../types';
import clsx from 'clsx';

interface SearchBarProps {
  onSearch: (query: string, depth: DepthOption) => void;
  loading: boolean;
}

const DEPTH_OPTIONS: { value: DepthOption; label: string; desc: string; time: string }[] = [
  { value: 'quick', label: 'Quick', desc: 'Fast overview', time: '~30s' },
  { value: 'standard', label: 'Standard', desc: 'Thorough research', time: '~90s' },
  { value: 'deep', label: 'Deep', desc: 'Exhaustive dive', time: '~3m' },
];

const EXAMPLE_QUERIES = [
  'OpenAI', 'Stripe', 'Figma', 'Anthropic', 'Vercel',
  'https://linear.app', 'Notion', 'Hugging Face',
];

export function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [depth, setDepth] = useState<DepthOption>('standard');
  const [showDepth, setShowDepth] = useState(false);

  const handleSearch = () => {
    const trimmed = query.trim();
    if (!trimmed || loading) return;
    onSearch(trimmed, depth);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
    if (e.key === 'Escape') setQuery('');
  };

  const selectedDepth = DEPTH_OPTIONS.find(d => d.value === depth)!;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      {/* Main search input */}
      <div className="relative">
        <div className="flex items-stretch bg-white rounded-2xl shadow-card border border-surface-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all duration-200">
          {/* Search icon */}
          <div className="flex items-center pl-5 pr-3 text-gray-400">
            <Search size={22} />
          </div>

          {/* Input */}
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter company name or website URL..."
            disabled={loading}
            className="flex-1 py-4 text-base text-gray-900 placeholder-gray-400 bg-transparent outline-none disabled:opacity-60"
            autoFocus
          />

          {/* Depth selector */}
          <div className="relative flex items-center px-3 border-l border-surface-200">
            <button
              onClick={() => setShowDepth(!showDepth)}
              disabled={loading}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-50"
            >
              <span>{selectedDepth.label}</span>
              <span className="text-xs text-gray-400">{selectedDepth.time}</span>
              <ChevronDown size={14} className={clsx('transition-transform', showDepth && 'rotate-180')} />
            </button>

            {showDepth && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-surface-200 py-1.5 z-50">
                {DEPTH_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setDepth(opt.value); setShowDepth(false); }}
                    className={clsx(
                      'w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors',
                      depth === opt.value ? 'text-blue-600 font-medium' : 'text-gray-700'
                    )}
                  >
                    <div className="text-left">
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                    </div>
                    <span className={clsx(
                      'text-xs px-2 py-0.5 rounded-full',
                      depth === opt.value ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                    )}>{opt.time}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search button */}
          <button
            onClick={handleSearch}
            disabled={!query.trim() || loading}
            className="flex items-center gap-2 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm transition-colors duration-200"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Zap size={18} />
            )}
            {loading ? 'Researching...' : 'Research'}
          </button>
        </div>
      </div>

      {/* Example queries */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-400 mr-1">Try:</span>
        {EXAMPLE_QUERIES.map(example => (
          <button
            key={example}
            onClick={() => {
              setQuery(example);
              onSearch(example, depth);
            }}
            disabled={loading}
            className="text-xs px-3 py-1 bg-white border border-surface-200 hover:border-blue-300 hover:text-blue-600 text-gray-600 rounded-full transition-colors disabled:opacity-50 shadow-soft"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
