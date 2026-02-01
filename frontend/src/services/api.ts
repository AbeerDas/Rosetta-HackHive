/**
 * API Service for FastAPI ML Backend
 * 
 * This file contains API calls to the FastAPI backend for ML services:
 * - Translation (WebSocket streaming, question translation, TTS)
 * - RAG pipeline (citations, embeddings)
 * - Note generation (LLM-powered)
 * - Document processing (PDF text extraction, chunking)
 * 
 * CRUD operations for folders, sessions, documents, and notes
 * are now handled by Convex. See /convex/*.ts for those.
 * 
 * Cold Start Handling:
 * The backend runs on Render's free tier which sleeps after ~15 min of inactivity.
 * This file includes retry logic and longer timeouts to handle cold starts gracefully.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  LanguageInfo,
  QuestionTranslation,
  TranslateQuestionRequest,
} from '../types';

export const API_BASE_URL = import.meta.env.VITE_FASTAPI_URL || import.meta.env.VITE_API_URL || 'http://localhost:8001';

// Timeouts for different scenarios
const STANDARD_TIMEOUT = 30000; // 30 seconds for normal operations
const COLD_START_TIMEOUT = 90000; // 90 seconds for cold start scenarios
const LONG_OPERATION_TIMEOUT = 180000; // 3 minutes for ML-heavy operations

// Create axios instance for FastAPI ML services
const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: STANDARD_TIMEOUT,
});

/**
 * Check if an error is likely due to a cold start (timeout or connection refused)
 */
export function isColdStartError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    // Timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return true;
    }
    // Connection refused (service not yet up)
    if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
      return true;
    }
    // 502/503/504 errors (service starting up)
    if (error.response?.status && [502, 503, 504].includes(error.response.status)) {
      return true;
    }
  }
  return false;
}

/**
 * Retry a request with exponential backoff
 * Useful for cold start scenarios where the first request may fail
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 3, initialDelay = 2000, maxDelay = 10000, onRetry } = options;
  
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries && isColdStartError(error)) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
        onRetry?.(attempt + 1, error);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  
  throw lastError;
}

// Error handler
const handleApiError = (error: AxiosError) => {
  if (error.response?.data) {
    const data = error.response.data as { detail?: { message?: string; code?: string } | string };
    if (typeof data.detail === 'object' && data.detail?.message) {
      throw new Error(data.detail.message);
    }
    if (typeof data.detail === 'string') {
      throw new Error(data.detail);
    }
  }
  
  // Provide helpful error messages for cold start scenarios
  if (isColdStartError(error)) {
    throw new Error('The server is waking up. Please try again in a moment.');
  }
  
  throw error;
};

/**
 * Check backend health - returns true if healthy, false otherwise
 * Uses a short timeout to quickly detect if server is down
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await api.get('/health', { timeout: 10000 });
    return response.status === 200;
  } catch {
    return false;
  }
}

/**
 * Warmup the backend by calling the warmup endpoint
 * This pre-loads ML models to avoid delays on first real request
 */
export async function warmupBackend(): Promise<{
  status: string;
  message: string;
  warmup_time_ms: number;
  models_loaded: string[];
}> {
  const response = await api.get('/health/warmup', { timeout: COLD_START_TIMEOUT });
  return response.data;
}

// Translation API (FastAPI - ML services)
export const translationApi = {
  getLanguages: async (): Promise<LanguageInfo[]> => {
    try {
      const response = await withRetry(
        () => api.get<{ languages: LanguageInfo[] }>('/translate/languages', {
          timeout: COLD_START_TIMEOUT,
        }),
        { maxRetries: 2 }
      );
      return response.data.languages;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  translateQuestion: async (data: TranslateQuestionRequest): Promise<QuestionTranslation> => {
    try {
      const response = await withRetry(
        () => api.post<QuestionTranslation>('/translate/question', data, {
          timeout: LONG_OPERATION_TIMEOUT,
        }),
        { maxRetries: 2 }
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  speak: async (text: string, voiceId?: string | null): Promise<Blob> => {
    try {
      const response = await withRetry(
        () => api.post(
          '/translate/tts/speak',
          { text, voice_id: voiceId },
          {
            responseType: 'blob',
            timeout: LONG_OPERATION_TIMEOUT,
          }
        ),
        { maxRetries: 2 }
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },
};

// RAG API (FastAPI - ML services)
export const ragApi = {
  query: async (sessionId: string, queryText: string): Promise<{
    citations: Array<{
      documentId: string;
      documentName: string;
      pageNumber: number;
      chunkText: string;
      relevanceScore: number;
    }>;
  }> => {
    try {
      const response = await withRetry(
        () => api.post('/rag/query', {
          session_id: sessionId,
          query_text: queryText,
        }, { timeout: LONG_OPERATION_TIMEOUT }),
        { maxRetries: 2 }
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },
};

// Notes Generation API (FastAPI - ML services for generating notes from transcripts)
export const notesApi = {
  // Generate notes from transcript (ML service)
  generate: async (sessionId: string, options?: {
    forceRegenerate?: boolean;
    outputLanguage?: string;
  }): Promise<{
    content_markdown: string;
    generated_at: string;
  }> => {
    try {
      // Note generation can take a while, use long timeout and retry
      const response = await withRetry(
        () => api.post(`/sessions/${sessionId}/notes/generate`, {
          force_regenerate: options?.forceRegenerate ?? false,
          output_language: options?.outputLanguage,
        }, { timeout: LONG_OPERATION_TIMEOUT }),
        { maxRetries: 2 }
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  // Get note generation status (for polling during generation)
  getStatus: async (sessionId: string): Promise<{
    status: 'not_generated' | 'generating' | 'ready' | 'error';
    progress: number;
    error_message?: string;
  }> => {
    try {
      const response = await api.get(`/sessions/${sessionId}/notes/status`, {
        timeout: STANDARD_TIMEOUT,
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  // Export notes as PDF
  exportPdf: async (sessionId: string): Promise<Blob> => {
    try {
      const response = await withRetry(
        () => api.get(`/sessions/${sessionId}/notes/export`, {
          responseType: 'blob',
          timeout: LONG_OPERATION_TIMEOUT,
        }),
        { maxRetries: 2 }
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  // Export notes as Markdown
  exportMarkdown: async (sessionId: string): Promise<Blob> => {
    try {
      const response = await api.get(`/sessions/${sessionId}/notes/export-markdown`, {
        responseType: 'blob',
        timeout: STANDARD_TIMEOUT,
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },
};

// Document Processing API (FastAPI - ML services)
export const documentProcessingApi = {
  /**
   * Process a document that's stored in Convex.
   * Called after uploading to Convex file storage.
   * Uses long timeout as this involves PDF parsing + embedding generation.
   */
  process: async (
    documentId: string,
    fileUrl: string,
    fileName: string,
    sessionId?: string
  ): Promise<{
    status: string;
    page_count: number;
    chunk_count: number;
    error?: string;
  }> => {
    try {
      const response = await withRetry(
        () => api.post('/documents/process-convex', {
          document_id: documentId,
          file_url: fileUrl,
          file_name: fileName,
          session_id: sessionId,
        }, { timeout: LONG_OPERATION_TIMEOUT }),
        { maxRetries: 2 }
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },
};

// Health API with cold start awareness
export const healthApi = {
  check: async (): Promise<{ status: string; message: string }> => {
    try {
      const response = await api.get('/health', { timeout: 10000 });
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  warmup: async (): Promise<{
    status: string;
    message: string;
    warmup_time_ms: number;
    models_loaded: string[];
  }> => {
    try {
      const response = await api.get('/health/warmup', { timeout: COLD_START_TIMEOUT });
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },
};

// Session ML operations (note generation trigger)
// Session CRUD is in Convex, but ML operations stay in FastAPI
export const sessionApi = {
  // End session and optionally trigger note generation (ML service)
  end: async (sessionId: string, data: { generate_notes: boolean }) => {
    try {
      const response = await withRetry(
        () => api.post(`/sessions/${sessionId}/end`, data, {
          timeout: LONG_OPERATION_TIMEOUT,
        }),
        { maxRetries: 2 }
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },
};

export default api;
