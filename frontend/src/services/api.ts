import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  Folder,
  FolderDetail,
  Session,
  Document,
  Transcript,
  Note,
  NoteStatus,
  LanguageInfo,
  QuestionTranslation,
  CreateFolderRequest,
  UpdateFolderRequest,
  CreateSessionRequest,
  UpdateSessionRequest,
  EndSessionRequest,
  TranslateQuestionRequest,
  GenerateNotesRequest,
  UpdateNotesRequest,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8888';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  throw error;
};

// Folder API
export const folderApi = {
  list: async (): Promise<Folder[]> => {
    try {
      const response = await api.get<{ folders: Folder[] }>('/folders');
      return response.data.folders;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  get: async (folderId: string): Promise<FolderDetail> => {
    try {
      const response = await api.get<FolderDetail>(`/folders/${folderId}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  create: async (data: CreateFolderRequest): Promise<Folder> => {
    try {
      const response = await api.post<Folder>('/folders', data);
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  update: async (folderId: string, data: UpdateFolderRequest): Promise<Folder> => {
    try {
      const response = await api.put<Folder>(`/folders/${folderId}`, data);
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  delete: async (folderId: string): Promise<void> => {
    try {
      await api.delete(`/folders/${folderId}`);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },
};

// Session API
export const sessionApi = {
  get: async (sessionId: string): Promise<Session> => {
    try {
      const response = await api.get<Session>(`/sessions/${sessionId}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  create: async (folderId: string, data: CreateSessionRequest): Promise<Session> => {
    try {
      const response = await api.post<Session>(`/sessions/${folderId}/sessions`, data);
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  update: async (sessionId: string, data: UpdateSessionRequest): Promise<Session> => {
    try {
      const response = await api.put<Session>(`/sessions/${sessionId}`, data);
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  end: async (sessionId: string, data: EndSessionRequest = {}): Promise<void> => {
    try {
      await api.post(`/sessions/${sessionId}/end`, data);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  delete: async (sessionId: string): Promise<void> => {
    try {
      await api.delete(`/sessions/${sessionId}`);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },
};

// Document API
export const documentApi = {
  list: async (sessionId: string): Promise<Document[]> => {
    try {
      const response = await api.get<{ documents: Document[] }>(`/documents/sessions/${sessionId}/documents`);
      return response.data.documents;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  get: async (documentId: string): Promise<Document> => {
    try {
      const response = await api.get<Document>(`/documents/${documentId}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  upload: async (sessionId: string, file: File): Promise<Document> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post<Document>(
        `/documents/sessions/${sessionId}/documents`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  delete: async (documentId: string): Promise<void> => {
    try {
      await api.delete(`/documents/${documentId}`);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  retry: async (documentId: string): Promise<Document> => {
    try {
      const response = await api.post<Document>(`/documents/${documentId}/retry`);
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },
};

// Transcript API
export const transcriptApi = {
  get: async (sessionId: string): Promise<Transcript> => {
    try {
      const response = await api.get<Transcript>(`/transcribe/sessions/${sessionId}/transcript`);
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },
};

// Translation API
export const translationApi = {
  getLanguages: async (): Promise<LanguageInfo[]> => {
    try {
      const response = await api.get<{ languages: LanguageInfo[] }>('/translate/languages');
      return response.data.languages;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  translateQuestion: async (data: TranslateQuestionRequest): Promise<QuestionTranslation> => {
    try {
      const response = await api.post<QuestionTranslation>('/translate/question', data);
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  speak: async (text: string): Promise<Blob> => {
    try {
      const response = await api.post('/translate/tts/speak', { text }, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },
};

// Notes API
export const notesApi = {
  get: async (sessionId: string): Promise<Note> => {
    try {
      const response = await api.get<Note>(`/sessions/${sessionId}/notes`);
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  generate: async (sessionId: string, data: GenerateNotesRequest = {}): Promise<Note> => {
    try {
      const response = await api.post<Note>(`/sessions/${sessionId}/notes/generate`, data);
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  update: async (sessionId: string, data: UpdateNotesRequest): Promise<Note> => {
    try {
      const response = await api.put<Note>(`/sessions/${sessionId}/notes`, data);
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  getStatus: async (sessionId: string): Promise<NoteStatus> => {
    try {
      const response = await api.get<NoteStatus>(`/sessions/${sessionId}/notes/status`);
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },

  exportPdf: async (sessionId: string): Promise<Blob> => {
    try {
      const response = await api.get(`/sessions/${sessionId}/notes/export`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },
};

// Health API
export const healthApi = {
  check: async (): Promise<{ status: string; message: string }> => {
    try {
      const response = await api.get('/health');
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  },
};

export default api;
