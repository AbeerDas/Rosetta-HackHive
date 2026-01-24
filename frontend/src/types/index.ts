// API Response Types

export interface Folder {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  session_count: number;
}

export interface SessionSummary {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'archived';
  source_language: string;
  target_language: string;
  started_at: string;
  ended_at: string | null;
  has_notes: boolean;
  document_count: number;
}

export interface FolderDetail extends Omit<Folder, 'session_count'> {
  sessions: SessionSummary[];
}

export interface Session {
  id: string;
  folder_id: string;
  name: string;
  status: 'active' | 'completed' | 'archived';
  source_language: string;
  target_language: string;
  started_at: string;
  ended_at: string | null;
  documents: DocumentSummary[];
  has_notes: boolean;
}

export interface DocumentSummary {
  id: string;
  name: string;
  page_count: number;
  status: 'pending' | 'processing' | 'ready' | 'error';
}

export interface Document {
  id: string;
  name: string;
  file_size: number;
  page_count: number;
  chunk_count: number;
  status: 'pending' | 'processing' | 'ready' | 'error';
  processing_progress: number;
  error_message: string | null;
  uploaded_at: string;
  processed_at: string | null;
}

export interface Citation {
  rank: number;
  document_name: string;
  page_number: number;
  snippet: string;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  translated_text?: string;
  start_time: number;
  end_time: number;
  confidence: number;
  citations: Citation[];
}

export interface Transcript {
  segments: TranscriptSegment[];
  total_duration: number;
  word_count: number;
}

export interface Note {
  id: string;
  session_id: string;
  content_markdown: string;
  generated_at: string;
  last_edited_at: string;
  version: number;
  word_count: number;
  citation_count: number;
}

export interface NoteStatus {
  status: 'not_generated' | 'generating' | 'ready' | 'error';
  progress: number;
  error_message: string | null;
}

export interface LanguageInfo {
  code: string;
  name: string;
  native_name: string;
  available: boolean;
}

export interface QuestionTranslation {
  original_text: string;
  translated_text: string;
  detected_language: string;
  detected_language_name: string;
  confidence: number;
}

// WebSocket Message Types

export interface TranscriptSegmentMessage {
  type: 'segment';
  segment: {
    text: string;
    start_time: number;
    end_time: number;
    confidence: number;
  };
}

export interface CitationsMessage {
  type: 'citations';
  window_index: number;
  segment_id: string;
  citations: Citation[];
}

export interface SegmentSavedMessage {
  type: 'segment_saved';
  segment_id: string;
}

export interface TranslationStatusMessage {
  type: 'status';
  status: 'live' | 'muted' | 'reconnecting';
}

// API Request Types

export interface CreateFolderRequest {
  name: string;
}

export interface UpdateFolderRequest {
  name: string;
}

export interface CreateSessionRequest {
  name: string;
  source_language?: string;
  target_language: string;
}

export interface UpdateSessionRequest {
  name?: string;
}

export interface EndSessionRequest {
  generate_notes?: boolean;
}

export interface TranslateQuestionRequest {
  text: string;
  source_language?: string;
  session_id?: string;
}

export interface GenerateNotesRequest {
  force_regenerate?: boolean;
  output_language?: string;
}

export interface UpdateNotesRequest {
  content_markdown: string;
}
