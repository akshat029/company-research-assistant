import React, { useState } from 'react';
import { SearchBar } from './components/SearchBar';
import { CompanyProfile } from './components/CompanyProfile';
import { LoadingState } from './components/LoadingState';
import { ErrorState } from './components/ErrorState';
import { useResearch } from './hooks/useResearch';
import { DepthOption } from './types';
import { Building2, Github, Zap, Search, Globe } from 'lucide-react';

export default function App() {
  const { data, loading, error, progress, research, reset } = useResearch();
  const [lastQuery, setLastQuery] = useState('');

  const handleSearch = async (query: string, depth: DepthOption) => {
    setLastQuery(query);
    await research({ query, depth });
  };

  const handleReset = () => {
    reset();
    setLastQuery('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-surface-200 sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <button onClick={handleReset} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
                <Search size={16} className="text-white" />
              </div>
              <span className="font-semibold text-gray-900">Company Research</span>
              <span className="hidden sm:inline text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">AI</span>
            </button>

            {/* Nav right */}
            <div className="flex items-center gap-4">
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500">
                <Zap size={12} className="text-blue-500" />
                Powered by LangChain + GPT-4o
              </span>
              <a
                href="http://localhost:8000/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-50 border border-surface-200"
              >
                API Docs
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Hero section — shown when idle */}
        {!data && !loading && !error && (
          <div className="py-20 flex flex-col items-center text-center">
            {/* Hero badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-full text-blue-700 text-sm font-medium mb-8">
              <Zap size={14} />
              AI-Powered Company Intelligence
            </div>

            <h1 className="text-5xl font-bold text-gray-900 mb-4 leading-tight">
              Research Any Company
              <br />
              <span className="text-blue-600">Instantly with AI</span>
            </h1>

            <p className="text-xl text-gray-500 mb-12 max-w-2xl">
              Enter a company name or website URL. Get a comprehensive research report 
              covering overview, products, leadership, news, financials, competitors, and more.
            </p>

            {/* Search bar */}
            <SearchBar onSearch={handleSearch} loading={loading} />

            {/* Feature highlights */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 w-full max-w-3xl">
              {[
                { icon: Building2, label: 'Company Overview', color: 'text-blue-500 bg-blue-50' },
                { icon: Globe, label: 'Products & News', color: 'text-purple-500 bg-purple-50' },
                { icon: Zap, label: 'Funding & Finance', color: 'text-yellow-500 bg-yellow-50' },
                { icon: Search, label: 'SWOT Analysis', color: 'text-green-500 bg-green-50' },
              ].map(({ icon: Icon, label, color }) => (
                <div key={label} className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-surface-200 shadow-soft">
                  <div className={`p-2.5 rounded-xl ${color.split(' ')[1]}`}>
                    <Icon size={18} className={color.split(' ')[0]} />
                  </div>
                  <span className="text-xs font-medium text-gray-600 text-center">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search bar — shown when there's data */}
        {(data || error) && !loading && (
          <div className="py-6">
            <SearchBar onSearch={handleSearch} loading={loading} />
          </div>
        )}

        {/* Loading state */}
        {loading && <LoadingState progress={progress} query={lastQuery} />}

        {/* Error state */}
        {error && !loading && (
          <ErrorState error={error} onRetry={() => handleSearch(lastQuery, 'standard')} />
        )}

        {/* Results */}
        {data && data.result && !loading && (
          <CompanyProfile
            result={data.result}
            query={data.query}
            duration={data.duration_seconds}
            cached={data.cached}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-24 border-t border-surface-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-blue-600 rounded-md flex items-center justify-center">
                <Search size={10} className="text-white" />
              </div>
              <span>Company Research Assistant</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Built with LangChain + FastAPI + React</span>
              <a href="http://localhost:8000/docs" target="_blank" rel="noopener noreferrer"
                className="hover:text-blue-600 transition-colors">API Docs</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
