import { create } from 'zustand';

type GenerationStatus = 'idle' | 'generating' | 'ready' | 'error';

interface NoteEditorState {
  // Content
  content: string;
  
  // Editor state
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  
  // Generation state
  generationStatus: GenerationStatus;
  generationProgress: number;
  generationError: string | null;
  
  // Actions
  setContent: (content: string) => void;
  markClean: () => void;
  setSaving: (saving: boolean) => void;
  setLastSavedAt: (date: Date) => void;
  setGenerationStatus: (status: GenerationStatus) => void;
  setGenerationProgress: (progress: number) => void;
  setGenerationError: (error: string | null) => void;
  reset: () => void;
}

export const useNoteStore = create<NoteEditorState>((set) => ({
  // Initial state
  content: '',
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  generationStatus: 'idle',
  generationProgress: 0,
  generationError: null,

  // Actions
  setContent: (content) =>
    set((state) => ({
      content,
      isDirty: content !== state.content,
    })),

  markClean: () => set({ isDirty: false }),

  setSaving: (saving) => set({ isSaving: saving }),

  setLastSavedAt: (date) =>
    set({
      lastSavedAt: date,
      isDirty: false,
    }),

  setGenerationStatus: (status) => set({ generationStatus: status }),

  setGenerationProgress: (progress) => set({ generationProgress: progress }),

  setGenerationError: (error) =>
    set({
      generationError: error,
      generationStatus: error ? 'error' : 'idle',
    }),

  reset: () =>
    set({
      content: '',
      isDirty: false,
      isSaving: false,
      lastSavedAt: null,
      generationStatus: 'idle',
      generationProgress: 0,
      generationError: null,
    }),
}));
