import React from 'react';
import { AlertCircle, RefreshCw, WifiOff, Key } from 'lucide-react';

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const isConnectionError = error.includes('connect') || error.includes('network') || error.includes('ECONNABORTED');
  const isApiKeyError = error.includes('API key') || error.includes('Configuration') || error.includes('api_key');

  const Icon = isConnectionError ? WifiOff : isApiKeyError ? Key : AlertCircle;
  const iconColor = isConnectionError ? 'text-orange-500' : 'text-red-500';
  const bgColor = isConnectionError ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200';

  return (
    <div className="w-full max-w-2xl mx-auto py-12 px-4 animate-fade-in">
      <div className={`rounded-2xl border p-8 ${bgColor}`}>
        <div className="flex flex-col items-center text-center">
          <div className={`p-4 rounded-full bg-white mb-4 shadow-soft`}>
            <Icon size={32} className={iconColor} />
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {isConnectionError ? 'Connection Failed' : isApiKeyError ? 'Configuration Error' : 'Research Failed'}
          </h3>

          <p className="text-gray-600 text-sm mb-6 max-w-md">
            {error}
          </p>

          {isConnectionError && (
            <div className="bg-white rounded-lg p-4 text-left text-sm text-gray-600 mb-6 w-full max-w-md border border-orange-100">
              <p className="font-medium mb-2">Make sure the backend is running:</p>
              <code className="block bg-gray-100 rounded px-3 py-2 text-xs font-mono">
                cd backend && uvicorn app.main:app --reload
              </code>
            </div>
          )}

          {isApiKeyError && (
            <div className="bg-white rounded-lg p-4 text-left text-sm text-gray-600 mb-6 w-full max-w-md border border-red-100">
              <p className="font-medium mb-2">Check your .env file:</p>
              <code className="block bg-gray-100 rounded px-3 py-2 text-xs font-mono">
                OPENAI_API_KEY=sk-...<br />
                TAVILY_API_KEY=tvly-...
              </code>
            </div>
          )}

          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
          >
            <RefreshCw size={16} />
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
