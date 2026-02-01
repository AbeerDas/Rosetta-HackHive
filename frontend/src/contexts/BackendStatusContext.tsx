/**
 * Backend Status Context
 * 
 * Tracks the availability of the FastAPI backend and handles cold start scenarios.
 * On Render's free tier, the backend may spin down after ~15 minutes of inactivity.
 * When a user makes a request after this period, the backend needs ~20-30 seconds
 * to "wake up" and load ML models.
 * 
 * This context:
 * 1. Checks backend health on app load
 * 2. Shows a "warming up" indicator during cold starts
 * 3. Caches status to avoid repeated checks
 * 4. Provides hooks for components to trigger warmup
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_FASTAPI_URL || import.meta.env.VITE_API_URL || 'http://localhost:8001';

export type BackendStatus = 'unknown' | 'checking' | 'warming' | 'ready' | 'error';

interface WarmupProgress {
  phase: string;
  modelsLoaded: string[];
  estimatedTimeRemaining: number;
}

interface BackendStatusContextType {
  status: BackendStatus;
  warmupProgress: WarmupProgress | null;
  error: string | null;
  lastChecked: Date | null;
  checkHealth: () => Promise<boolean>;
  warmup: () => Promise<boolean>;
  isWarmingUp: boolean;
}

const BackendStatusContext = createContext<BackendStatusContextType | null>(null);

// Cache duration - don't re-check if backend was healthy recently
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function BackendStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<BackendStatus>('unknown');
  const [warmupProgress, setWarmupProgress] = useState<WarmupProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const warmupInProgress = useRef(false);

  const checkHealth = useCallback(async (): Promise<boolean> => {
    // If we checked recently and it was healthy, skip
    if (
      status === 'ready' &&
      lastChecked &&
      Date.now() - lastChecked.getTime() < CACHE_DURATION_MS
    ) {
      return true;
    }

    setStatus('checking');
    setError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${API_BASE_URL}/api/v1/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        setStatus('ready');
        setLastChecked(new Date());
        return true;
      } else {
        setStatus('error');
        setError(`Backend returned status ${response.status}`);
        return false;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Timeout likely means cold start
        setStatus('warming');
        return false;
      }
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to connect to backend');
      return false;
    }
  }, [status, lastChecked]);

  const warmup = useCallback(async (): Promise<boolean> => {
    // Prevent concurrent warmups
    if (warmupInProgress.current) {
      return false;
    }

    warmupInProgress.current = true;
    setStatus('warming');
    setWarmupProgress({
      phase: 'Connecting to server...',
      modelsLoaded: [],
      estimatedTimeRemaining: 30,
    });

    try {
      // First, do a simple health check with a long timeout
      // This wakes up the container
      const healthController = new AbortController();
      const healthTimeout = setTimeout(() => healthController.abort(), 60000); // 60 second timeout

      setWarmupProgress({
        phase: 'Waking up server...',
        modelsLoaded: [],
        estimatedTimeRemaining: 25,
      });

      try {
        await fetch(`${API_BASE_URL}/api/v1/health`, {
          signal: healthController.signal,
        });
        clearTimeout(healthTimeout);
      } catch {
        clearTimeout(healthTimeout);
        // Container might still be starting, continue to warmup
      }

      // Now call the warmup endpoint to load ML models
      setWarmupProgress({
        phase: 'Loading ML models...',
        modelsLoaded: [],
        estimatedTimeRemaining: 20,
      });

      const warmupController = new AbortController();
      const warmupTimeout = setTimeout(() => warmupController.abort(), 120000); // 2 minute timeout

      const response = await fetch(`${API_BASE_URL}/api/v1/health/warmup`, {
        signal: warmupController.signal,
      });
      clearTimeout(warmupTimeout);

      if (response.ok) {
        const data = await response.json();
        setWarmupProgress({
          phase: 'Ready!',
          modelsLoaded: data.models_loaded || [],
          estimatedTimeRemaining: 0,
        });
        setStatus('ready');
        setLastChecked(new Date());
        warmupInProgress.current = false;
        return true;
      } else {
        throw new Error(`Warmup failed with status ${response.status}`);
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Warmup failed');
      warmupInProgress.current = false;
      return false;
    }
  }, []);

  // Check health on mount
  useEffect(() => {
    const initCheck = async () => {
      const healthy = await checkHealth();
      if (!healthy && status !== 'error') {
        // Backend might be cold, trigger warmup
        warmup();
      }
    };
    initCheck();
  }, []); // Only run on mount

  const isWarmingUp = status === 'warming' || status === 'checking';

  return (
    <BackendStatusContext.Provider
      value={{
        status,
        warmupProgress,
        error,
        lastChecked,
        checkHealth,
        warmup,
        isWarmingUp,
      }}
    >
      {children}
    </BackendStatusContext.Provider>
  );
}

export function useBackendStatus() {
  const context = useContext(BackendStatusContext);
  if (!context) {
    throw new Error('useBackendStatus must be used within a BackendStatusProvider');
  }
  return context;
}
