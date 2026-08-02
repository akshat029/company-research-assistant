import { useState, useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import { ResearchRequest, ResearchResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface UseResearchReturn {
  data: ResearchResponse | null;
  loading: boolean;
  error: string | null;
  progress: string;
  research: (request: ResearchRequest) => Promise<void>;
  reset: () => void;
}

const PROGRESS_MESSAGES: Record<string, string[]> = {
  quick: [
    'Initializing research agent...',
    'Searching for company overview...',
    'Finding products & services...',
    'Gathering recent news...',
    'Compiling results...',
  ],
  standard: [
    'Initializing research agent...',
    'Searching for company overview...',
    'Finding products & services...',
    'Researching leadership team...',
    'Gathering recent news...',
    'Analyzing funding & financials...',
    'Mapping competitors...',
    'Compiling comprehensive report...',
  ],
  deep: [
    'Initializing deep research agent...',
    'Searching for company overview...',
    'Finding products & services...',
    'Researching leadership team...',
    'Gathering recent news...',
    'Analyzing funding & financials...',
    'Mapping competitors & market...',
    'Analyzing tech stack...',
    'Checking social media & culture...',
    'Scraping company website...',
    'Generating SWOT analysis...',
    'Compiling exhaustive report...',
  ],
};

export function useResearch(): UseResearchReturn {
  const [data, setData] = useState<ResearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  const research = useCallback(async (request: ResearchRequest) => {
    setLoading(true);
    setError(null);
    setData(null);
    setProgress('');

    const messages = PROGRESS_MESSAGES[request.depth] || PROGRESS_MESSAGES.standard;
    let messageIndex = 0;

    // Simulate progress messages
    const interval = setInterval(() => {
      if (messageIndex < messages.length) {
        setProgress(messages[messageIndex]);
        messageIndex++;
      }
    }, 3000);

    try {
      const response = await axios.post<ResearchResponse>(
        `${API_BASE}/research`,
        request,
        {
          timeout: 180000, // 3 minute timeout
          headers: { 'Content-Type': 'application/json' },
        }
      );

      clearInterval(interval);
      setProgress('Research complete!');

      if (response.data.status === 'failed') {
        setError(response.data.error || 'Research failed. Please try again.');
      } else {
        setData(response.data);
      }
    } catch (err) {
      clearInterval(interval);
      const axiosError = err as AxiosError<{ detail: string }>;
      if (axiosError.response) {
        setError(axiosError.response.data?.detail || `Server error: ${axiosError.response.status}`);
      } else if (axiosError.code === 'ECONNABORTED') {
        setError('Research timed out. Try a "quick" depth or check your connection.');
      } else if (axiosError.code === 'ERR_NETWORK') {
        setError('Cannot connect to the API server. Make sure the backend is running on port 8000.');
      } else {
        setError(`Unexpected error: ${axiosError.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setProgress('');
    setLoading(false);
  }, []);

  return { data, loading, error, progress, research, reset };
}
