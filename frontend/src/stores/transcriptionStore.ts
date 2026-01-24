import { create } from 'zustand';
import type { TranscriptSegment, Citation } from '../types';

interface TranscriptionState {
  // Transcript data
  segments: TranscriptSegment[];
  currentSegment: string;
  
  // UI state
  isTranscribing: boolean;
  isPaused: boolean;
  autoScroll: boolean;
  fontSize: number;
  highContrast: boolean;
  highlightedCitationKey: string | null;  // For highlighting clicked citations
  
  // Actions
  addSegment: (segment: TranscriptSegment) => void;
  updateCurrentSegment: (text: string) => void;
  updateSegmentId: (frontendId: string, backendId: string) => void;
  updateSegmentText: (segmentId: string, translatedText: string) => void;
  attachCitations: (segmentId: string, citations: Citation[]) => void;
  clearSegments: () => void;
  setTranscribing: (value: boolean) => void;
  togglePause: () => void;
  setAutoScroll: (enabled: boolean) => void;
  setFontSize: (size: number) => void;
  toggleHighContrast: () => void;
  highlightCitation: (key: string | null) => void;
}

export const useTranscriptionStore = create<TranscriptionState>((set) => ({
  // Initial state
  segments: [],
  currentSegment: '',
  isTranscribing: false,
  isPaused: false,
  autoScroll: true,
  fontSize: 16,
  highContrast: false,
  highlightedCitationKey: null,

  // Actions
  addSegment: (segment) =>
    set((state) => ({
      segments: [...state.segments, segment],
      currentSegment: '',
    })),

  updateCurrentSegment: (text) => set({ currentSegment: text }),

  updateSegmentId: (frontendId, backendId) =>
    set((state) => ({
      segments: state.segments.map((seg) =>
        seg.id === frontendId ? { ...seg, id: backendId } : seg
      ),
    })),

  updateSegmentText: (segmentId, translatedText) =>
    set((state) => ({
      segments: state.segments.map((seg) =>
        seg.id === segmentId ? { ...seg, text: translatedText } : seg
      ),
    })),

  attachCitations: (segmentId, citations) =>
    set((state) => ({
      segments: state.segments.map((seg) =>
        seg.id === segmentId ? { ...seg, citations } : seg
      ),
    })),

  clearSegments: () =>
    set({
      segments: [],
      currentSegment: '',
    }),

  setTranscribing: (value) => set({ isTranscribing: value }),

  togglePause: () =>
    set((state) => ({
      isPaused: !state.isPaused,
    })),

  setAutoScroll: (enabled) => set({ autoScroll: enabled }),

  setFontSize: (size) => set({ fontSize: size }),

  toggleHighContrast: () =>
    set((state) => ({
      highContrast: !state.highContrast,
    })),

  highlightCitation: (key) => {
    set({ highlightedCitationKey: key });
    // Clear highlight after animation
    if (key) {
      setTimeout(() => set({ highlightedCitationKey: null }), 2000);
    }
  },
}));
