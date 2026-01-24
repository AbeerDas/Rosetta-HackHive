import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Menu,
  MenuItem,
  Divider,
  IconButton,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tooltip } from '@mui/material';

import { notesApi } from '../../services/api';
import { useLanguageStore } from '../../stores';
import { customColors } from '../../theme';
import { TipTapEditor } from '../notes/TipTapEditor';

interface NotesPanelProps {
  readonly sessionId: string;
  readonly sessionName: string;
  readonly autoGenerate?: boolean;
  readonly onViewTranscript?: () => void;
  readonly onOpenFullPage?: () => void;
}

// Auto-save debounce time in milliseconds
const AUTO_SAVE_DELAY = 5000;

export function NotesPanel({ sessionId, sessionName, autoGenerate = false, onViewTranscript, onOpenFullPage }: NotesPanelProps) {
  const queryClient = useQueryClient();
  const { t, language } = useLanguageStore();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [content, setContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [hasTriggeredGenerate, setHasTriggeredGenerate] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = useState(false);
  
  // Ref for auto-save timer
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Track current sessionId to detect changes
  const currentSessionIdRef = useRef<string>(sessionId);

  // Reset state when sessionId changes
  useEffect(() => {
    if (currentSessionIdRef.current !== sessionId) {
      console.log('[NotesPanel] Session changed from', currentSessionIdRef.current, 'to', sessionId);
      currentSessionIdRef.current = sessionId;
      
      // Reset all state for new session
      setContent('');
      setHasChanges(false);
      setHasTriggeredGenerate(false);
      setLastSavedAt(null);
      setIsGenerating(false);
      setGenerationProgress(0);
      setConfirmRegenerateOpen(false);
      setAnchorEl(null);
      
      // Clear any pending auto-save timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    }
  }, [sessionId]);

  // Fetch existing note
  const { data: note, isLoading: noteLoading, isError: noteError } = useQuery({
    queryKey: ['note', sessionId],
    queryFn: () => notesApi.get(sessionId),
    enabled: !!sessionId,
    retry: false, // Don't retry if note doesn't exist
    staleTime: 0, // Always refetch when sessionId changes
  });

  // Poll generation status when generating
  const { data: noteStatus } = useQuery({
    queryKey: ['noteStatus', sessionId],
    queryFn: () => notesApi.getStatus(sessionId),
    enabled: isGenerating,
    refetchInterval: isGenerating ? 1000 : false, // Poll every second while generating
  });

  // Update progress from status
  useEffect(() => {
    if (noteStatus) {
      setGenerationProgress(noteStatus.progress);
      if (noteStatus.status === 'ready') {
        setIsGenerating(false);
        // Refetch the note
        queryClient.invalidateQueries({ queryKey: ['note', sessionId] });
      } else if (noteStatus.status === 'error') {
        setIsGenerating(false);
      }
    }
  }, [noteStatus, sessionId, queryClient]);

  // Set content when note is loaded, or clear when no note exists
  useEffect(() => {
    if (note?.content_markdown) {
      console.log('[NotesPanel] Note loaded for session:', sessionId, 'length:', note.content_markdown.length);
      setContent(note.content_markdown);
      setHasChanges(false);
    } else if (!noteLoading && (noteError || !note)) {
      // No note exists for this session - clear content
      console.log('[NotesPanel] No note found for session:', sessionId, 'clearing content');
      setContent('');
      setHasChanges(false);
    }
  }, [note, noteLoading, noteError, sessionId]);

  // Auto-save functionality
  const saveNotes = useCallback(async (contentToSave: string) => {
    if (!contentToSave || !note) return;
    
    try {
      await notesApi.update(sessionId, { content_markdown: contentToSave });
      setHasChanges(false);
      setLastSavedAt(new Date());
      queryClient.invalidateQueries({ queryKey: ['note', sessionId] });
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [sessionId, note, queryClient]);

  // Debounced auto-save
  useEffect(() => {
    if (hasChanges && content && note) {
      // Clear any existing timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      
      // Set new timer
      autoSaveTimerRef.current = setTimeout(() => {
        saveNotes(content);
      }, AUTO_SAVE_DELAY);
    }
    
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [content, hasChanges, note, saveNotes]);

  // Save on blur/navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasChanges && content && note) {
        // Attempt synchronous save (may not complete)
        navigator.sendBeacon?.(
          `/api/v1/sessions/${sessionId}/notes`,
          JSON.stringify({ content_markdown: content })
        );
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges, content, note, sessionId]);

  // Generate note mutation
  const generateMutation = useMutation({
    mutationFn: (forceRegenerate: boolean = false) => {
      console.log('[NotesPanel] Starting note generation for session:', sessionId, 'forceRegenerate:', forceRegenerate, 'language:', language);
      return notesApi.generate(sessionId, { force_regenerate: forceRegenerate, output_language: language });
    },
    onMutate: () => {
      console.log('[NotesPanel] Generation started, setting isGenerating=true');
      setIsGenerating(true);
      setGenerationProgress(0);
    },
    onSuccess: (generatedNote) => {
      console.log('[NotesPanel] Generation successful for session:', sessionId);
      setContent(generatedNote.content_markdown);
      setHasChanges(false);
      setIsGenerating(false);
      setGenerationProgress(100);
      queryClient.invalidateQueries({ queryKey: ['note', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
    },
    onError: (error) => {
      setIsGenerating(false);
      console.error('[NotesPanel] Note generation failed for session:', sessionId, error);
      // Show error to user
      alert(`Note generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  // Auto-generate on mount if requested and no note exists
  useEffect(() => {
    // Only auto-generate if:
    // 1. autoGenerate is enabled
    // 2. We haven't already triggered for THIS session
    // 3. Note loading is complete
    // 4. No existing note content
    if (autoGenerate && !hasTriggeredGenerate && !noteLoading && !note?.content_markdown) {
      console.log('[NotesPanel] Auto-generating notes for session:', sessionId);
      setHasTriggeredGenerate(true);
      generateMutation.mutate(false);
    }
  }, [autoGenerate, hasTriggeredGenerate, noteLoading, note, sessionId]);

  // Save note mutation (for manual save)
  const saveMutation = useMutation({
    mutationFn: (contentMarkdown: string) => notesApi.update(sessionId, { content_markdown: contentMarkdown }),
    onSuccess: () => {
      setHasChanges(false);
      setLastSavedAt(new Date());
      queryClient.invalidateQueries({ queryKey: ['note', sessionId] });
    },
  });

  // Export PDF mutation
  const exportMutation = useMutation({
    mutationFn: () => notesApi.exportPdf(sessionId),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sessionName || 'notes'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onError: (error) => {
      console.error('PDF export failed:', error);
      // Offer Markdown export as fallback
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (errorMsg.includes('PDF_DEPS_MISSING') || errorMsg.includes('PDF_UNAVAILABLE') || errorMsg.includes('503')) {
        if (confirm('PDF export requires additional system libraries. Would you like to download as Markdown instead?')) {
          exportMarkdownMutation.mutate();
        }
      } else {
        alert(`PDF export failed: ${errorMsg}`);
      }
    },
  });

  // Export Markdown mutation (fallback)
  const exportMarkdownMutation = useMutation({
    mutationFn: () => notesApi.exportMarkdown(sessionId),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sessionName || 'notes'}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onError: (error) => {
      console.error('Markdown export failed:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(content);
  };

  const handleExport = () => {
    exportMutation.mutate();
    setAnchorEl(null);
  };

  const handleGenerate = () => {
    // If note already exists, show confirmation
    if (note?.content_markdown) {
      setConfirmRegenerateOpen(true);
      setAnchorEl(null);
    } else {
      generateMutation.mutate(false);
      setAnchorEl(null);
    }
  };

  const handleConfirmRegenerate = () => {
    generateMutation.mutate(true);
    setConfirmRegenerateOpen(false);
  };

  // Format last saved time
  const formatLastSaved = () => {
    if (!lastSavedAt) return null;
    const seconds = Math.floor((Date.now() - lastSavedAt.getTime()) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  // Show loading state while generating
  if (isGenerating || generateMutation.isPending) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4,
        }}
      >
        <Box sx={{ position: 'relative', display: 'inline-flex', mb: 3 }}>
          <CircularProgress
            variant="determinate"
            value={generationProgress}
            size={80}
            thickness={4}
          />
          <Box
            sx={{
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              position: 'absolute',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="h6" component="div" color="text.secondary">
              {`${Math.round(generationProgress)}%`}
            </Typography>
          </Box>
        </Box>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
          Generating Notes...
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 400 }}>
          {generationProgress < 30 && 'Collecting transcript segments...'}
          {generationProgress >= 30 && generationProgress < 50 && 'Gathering citations...'}
          {generationProgress >= 50 && generationProgress < 90 && 'AI is analyzing and structuring your notes...'}
          {generationProgress >= 90 && 'Finalizing notes...'}
        </Typography>
        <Box sx={{ width: '100%', maxWidth: 300, mt: 3 }}>
          <LinearProgress variant="determinate" value={generationProgress} />
        </Box>
      </Box>
    );
  }

  // Show loading state while fetching existing note
  if (noteLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Toolbar */}
      <Box
        sx={{
          p: 1,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Left side - title and save status */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {t.lectureNotes}
          </Typography>
          {hasChanges ? (
            <Typography variant="caption" color="warning.main">
              Unsaved changes
            </Typography>
          ) : lastSavedAt ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
              <Typography variant="caption" color="text.secondary">
                Saved {formatLastSaved()}
              </Typography>
            </Box>
          ) : null}
        </Box>

        {/* Right side - actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* View Transcript button */}
          {onViewTranscript && (
            <Button
              size="small"
              variant="outlined"
              onClick={onViewTranscript}
              sx={{
                textTransform: 'none',
                borderColor: customColors.brandGreen,
                color: customColors.brandGreen,
                '&:hover': {
                  borderColor: '#005F54',
                  bgcolor: 'rgba(0, 126, 112, 0.04)',
                },
              }}
            >
              {t.viewTranscript}
            </Button>
          )}
          {/* Open in full page button */}
          {onOpenFullPage && (
            <Tooltip title="Open in full-page editor">
              <IconButton size="small" onClick={onOpenFullPage}>
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Button
            size="small"
            variant="contained"
            startIcon={saveMutation.isPending ? <CircularProgress size={14} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
          >
            Save
          </Button>
          <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
            <MoreVertIcon />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            <MenuItem
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
            >
              <AutoAwesomeIcon sx={{ mr: 1, fontSize: 20 }} />
              {note?.content_markdown ? 'Regenerate Notes' : 'Generate Notes'}
            </MenuItem>
            <Divider />
            <MenuItem
              onClick={handleExport}
              disabled={!content || exportMutation.isPending}
            >
              <DownloadIcon sx={{ mr: 1, fontSize: 20 }} />
              {exportMutation.isPending ? 'Exporting...' : 'Export as PDF'}
            </MenuItem>
            <MenuItem
              onClick={() => { exportMarkdownMutation.mutate(); setAnchorEl(null); }}
              disabled={!content || exportMarkdownMutation.isPending}
            >
              <DownloadIcon sx={{ mr: 1, fontSize: 20 }} />
              {exportMarkdownMutation.isPending ? 'Exporting...' : 'Export as Markdown'}
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Regenerate Confirmation Dialog */}
      <Dialog
        open={confirmRegenerateOpen}
        onClose={() => setConfirmRegenerateOpen(false)}
      >
        <DialogTitle>Regenerate Notes?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will replace your current notes with a fresh generation from the transcript.
            Your edits will be lost.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRegenerateOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmRegenerate} variant="contained" color="primary">
            Regenerate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Editor or Empty State */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {content ? (
          <TipTapEditor content={content} onChange={handleContentChange} />
        ) : (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              p: 4,
              minHeight: 300,
            }}
          >
            <AutoAwesomeIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              No notes yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
              Generate notes automatically from your lecture transcripts,
              <br />
              or start writing from scratch.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<AutoAwesomeIcon />}
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
              >
                Generate Notes
              </Button>
              <Button
                variant="outlined"
                onClick={() => setContent('# Notes\n\nStart writing your notes here...')}
              >
                Start from Scratch
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
