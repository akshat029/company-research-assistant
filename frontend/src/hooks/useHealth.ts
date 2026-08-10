import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { HealthResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

type Status = 'checking' | 'online' | 'offline';

/**
 * Lightweight liveness probe for the API.
 *
 * The most common failure in this project is simply “the backend is not
 * running”, which previously only surfaced after a full failed research run.
 * Surfacing it in the header turns a confusing dead end into an obvious fix.
 */
export function useHealth(pollMs = 30000) {
  const [status, setStatus] = useState<Status>('checking');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const mounted = useRef(true);

  const check = useCallback(async () => {
    try {
      const res = await axios.get<HealthResponse>(`${API_BASE}/health`, { timeout: 6000 });
      if (!mounted.current) return;
      setHealth(res.data);
      setStatus('online');
    } catch {
      if (!mounted.current) return;
      setHealth(null);
      setStatus('offline');
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void check();
    const id = window.setInterval(() => void check(), pollMs);
    return () => {
      mounted.current = false;
      window.clearInterval(id);
    };
  }, [check, pollMs]);

  return { status, health, recheck: check };
}
