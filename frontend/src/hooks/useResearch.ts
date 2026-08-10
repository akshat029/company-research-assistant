import { useCallback, useEffect, useRef, useState } from 'react';
import axios, { AxiosError } from 'axios';
import { ResearchRequest, ResearchResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface ResearchPhase {
  label: string;
  hint: string;
}

interface UseResearchReturn {
  data: ResearchResponse | null;
  loading: boolean;
  error: string | null;
  progress: string;
  phases: ResearchPhase[];
  phaseIndex: number;
  elapsed: number;
  research: (request: ResearchRequest) => Promise<void>;
  reset: () => void;
  cancel: () => void;
}

const PHASES: Record<string, ResearchPhase[]> = {
  quick: [
    { label: 'Spinning up agent', hint: 'Loading tools and today\\u2019s date' },
    { label: 'Searching the live web', hint: 'Company overview and official site' },
    { label: 'Scanning recent news', hint: 'Filtered to a recency window' },
    { label: 'Verifying every link', hint: 'Dropping anything not retrieved' },
  ],
  standard: [
    { label: 'Spinning up agent', hint: 'Loading tools and today\\u2019s date' },
    { label: 'Searching the live web', hint: 'Company overview and official site' },
    { label: 'Products and positioning', hint: 'What they actually sell' },
    { label: 'Leadership and funding', hint: 'Named people, real rounds' },
    { label: 'Scanning recent news', hint: 'Filtered to a recency window' },
    { label: 'Mapping competitors', hint: 'Named rivals with live links' },
    { label: 'Verifying every link', hint: 'Dropping anything not retrieved' },
  ],
  deep: [
    { label: 'Spinning up agent', hint: 'Loading tools and today\\u2019s date' },
    { label: 'Searching the live web', hint: 'Company overview and official site' },
    { label: 'Reading the company site', hint: 'First-party copy, budgeted' },
    { label: 'Products and positioning', hint: 'What they actually sell' },
    { label: 'Leadership and funding', hint: 'Named people, real rounds' },
    { label: 'Scanning recent news', hint: 'Filtered to a recency window' },
    { label: 'Mapping competitors', hint: 'Named rivals with live links' },
    { label: 'Market and SWOT', hint: 'Grounded in retrieved evidence' },
    { label: 'Verifying every link', hint: 'Dropping anything not retrieved' },
  ],
};

// Roughly how long each depth tends to run, used only to pace the stepper.
const PHASE_MS: Record<string, number> = { quick: 2600, standard: 4200, deep: 6000 };

export function useResearch(): UseResearchReturn {
  const [data, setData] = useState<ResearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phases, setPhases] = useState<ResearchPhase[]>(PHASES.standard);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const phaseTimer = useRef<number | null>(null);
  const clockTimer = useRef<number | null>(null);
  const controller = useRef<AbortController | null>(null);

  const stopTimers = useCallback(() => {
    if (phaseTimer.current !== null) {
      window.clearInterval(phaseTimer.current);
      phaseTimer.current = null;
    }
    if (clockTimer.current !== null) {
      window.clearInterval(clockTimer.current);
      clockTimer.current = null;
    }
  }, []);

  // Never leave a timer or an in-flight request running after unmount.
  useEffect(() => {
    return () => {
      stopTimers();
      controller.current?.abort();
    };
  }, [stopTimers]);

  const research = useCallback(
    async (request: ResearchRequest) => {
      controller.current?.abort();
      stopTimers();

      const ac = new AbortController();
      controller.current = ac;

      // Stage 4 only runs when it was asked for, so the stepper must not
      // promise it. Analysis happens after verification, hence the append.
      const base = PHASES[request.depth] ?? PHASES.standard;
      const steps = request.include_analysis
        ? [
            ...base,
            {
              label: 'Writing the analyst read',
              hint: 'Thesis, risks and non-obvious signals',
            },
          ]
        : base;

      setPhases(steps);
      setPhaseIndex(0);
      setElapsed(0);
      setLoading(true);
      setError(null);
      setData(null);

      const startedAt = Date.now();
      clockTimer.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      }, 1000);

      // Advance the stepper but always hold the final step until the response
      // lands, so the UI never claims to be finished before the server is.
      phaseTimer.current = window.setInterval(() => {
        setPhaseIndex((i) => Math.min(i + 1, steps.length - 2));
      }, PHASE_MS[request.depth] ?? 4200);

      try {
        const response = await axios.post<ResearchResponse>(`${API_BASE}/research`, request, {
          timeout: 180000,
          signal: ac.signal,
          headers: { 'Content-Type': 'application/json' },
        });

        stopTimers();
        setPhaseIndex(steps.length - 1);

        if (response.data.status === 'failed') {
          setError(response.data.error || 'Research failed. Please try again.');
        } else {
          setData(response.data);
        }
      } catch (err) {
        stopTimers();
        if (axios.isCancel(err) || (err as Error)?.name === 'CanceledError') {
          setError(null);
          return;
        }
        const axiosError = err as AxiosError<{ detail: string }>;
        if (axiosError.response) {
          setError(
            axiosError.response.data?.detail || `Server error: ${axiosError.response.status}`,
          );
        } else if (axiosError.code === 'ECONNABORTED') {
          setError('Research timed out. Try \\u201cquick\\u201d depth, or check your connection.');
        } else if (axiosError.code === 'ERR_NETWORK') {
          setError(
            'Cannot reach the API. Start the backend with: python -m uvicorn app.main:app --reload --port 8000',
          );
        } else {
          setError(`Unexpected error: ${axiosError.message}`);
        }
      } finally {
        setLoading(false);
      }
    },
    [stopTimers],
  );

  const cancel = useCallback(() => {
    controller.current?.abort();
    stopTimers();
    setLoading(false);
  }, [stopTimers]);

  const reset = useCallback(() => {
    controller.current?.abort();
    stopTimers();
    setData(null);
    setError(null);
    setPhaseIndex(0);
    setElapsed(0);
    setLoading(false);
  }, [stopTimers]);

  const progress = phases[phaseIndex]?.label ?? '';

  return {
    data,
    loading,
    error,
    progress,
    phases,
    phaseIndex,
    elapsed,
    research,
    reset,
    cancel,
  };
}
