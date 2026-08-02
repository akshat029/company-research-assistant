import React from 'react';
import { Search, Newspaper, Users, TrendingUp, Code2, Globe } from 'lucide-react';

interface LoadingStateProps {
  progress: string;
  query: string;
}

const STEPS = [
  { icon: Search, label: 'Company Overview', color: 'text-blue-500 bg-blue-50' },
  { icon: Globe, label: 'Products & Services', color: 'text-purple-500 bg-purple-50' },
  { icon: Users, label: 'Leadership Team', color: 'text-green-500 bg-green-50' },
  { icon: Newspaper, label: 'Recent News', color: 'text-orange-500 bg-orange-50' },
  { icon: TrendingUp, label: 'Financials & Funding', color: 'text-pink-500 bg-pink-50' },
  { icon: Code2, label: 'Tech Stack & Culture', color: 'text-indigo-500 bg-indigo-50' },
];

export function LoadingState({ progress, query }: LoadingStateProps) {
  return (
    <div className="w-full max-w-3xl mx-auto py-12 px-4">
      {/* Main spinner */}
      <div className="flex flex-col items-center mb-12">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full border-4 border-blue-100" />
          <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-transparent border-t-blue-600 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Search size={24} className="text-blue-600" />
          </div>
        </div>

        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Researching <span className="text-blue-600">"{query}"</span>
        </h2>
        <p className="text-gray-500 text-sm text-center max-w-sm">
          Our AI agent is gathering comprehensive information from multiple sources.
        </p>
      </div>

      {/* Progress message */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-soft p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-sm text-gray-600 font-medium">
            {progress || 'Initializing research agent...'}
          </span>
        </div>

        {/* Research steps */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {STEPS.map((step, index) => (
            <div
              key={step.label}
              className="flex items-center gap-2.5 p-3 rounded-lg bg-gray-50 border border-surface-100 animate-pulse-slow"
              style={{ animationDelay: `${index * 200}ms` }}
            >
              <div className={`p-1.5 rounded-md ${step.color.split(' ')[1]}`}>
                <step.icon size={14} className={step.color.split(' ')[0]} />
              </div>
              <span className="text-xs text-gray-600 font-medium">{step.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Skeleton cards */}
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="bg-white rounded-xl border border-surface-200 p-5">
            <div className="shimmer h-4 w-32 rounded mb-4" />
            <div className="space-y-2">
              <div className="shimmer h-3 w-full rounded" />
              <div className="shimmer h-3 w-4/5 rounded" />
              <div className="shimmer h-3 w-3/5 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
