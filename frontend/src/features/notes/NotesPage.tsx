import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  CircularProgress,
  Menu,
  MenuItem,
  Divider,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DescriptionIcon from '@mui/icons-material/Description';
import { useQuery as useConvexQuery, useMutation as useConvexMutation } from 'convex/react';

import { api } from '../../../convex/_generated/api';
import { notesApi } from '../../services/api';
import { useLanguageStore } from '../../stores';
import { customColors } from '../../theme';
import { TipTapEditor } from './TipTapEditor';

// Auto-save debounce time in milliseconds
const AUTO_SAVE_DELAY = 5000;

export function NotesPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, language } = useLanguageStore();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [content, setContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = useState(false);

  // Ref for auto-save timer
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track current sessionId to detect changes
  const currentSessionIdRef = useRef<string | undefined>(sessionId);

  // Reset state when sessionId changes (e.g., navigating between sessions)
  useEffect(() => {
    if (currentSessionIdRef.current !== sessionId) {
      console.log('[NotesPage] Session changed from', currentSessionIdRef.current, 'to', sessionId);
      currentSessionIdRef.current = sessionId;

      // Reset all state for new session
      setContent('');
      setHasChanges(false);
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

  // Fetch session details from Convex
  const session = useConvexQuery(api.sessions.get, sessionId ? { id: sessionId as any } : 'skip');
  const sessionLoading = session === undefined;

  // Fetch existing note
  const {
    data: note,
    isLoading: noteLoading,
    isError: noteError,
  } = useQuery({
    queryKey: ['note', sessionId],
    queryFn: () => notesApi.get(sessionId!),
    enabled: !!sessionId,
    retry: false,
    staleTime: 0, // Always refetch when sessionId changes
  });

  // Poll generation status when generating
  const { data: noteStatus } = useQuery({
    queryKey: ['noteStatus', sessionId],
    queryFn: () => notesApi.getStatus(sessionId!),
    enabled: isGenerating,
    refetchInterval: isGenerating ? 1000 : false,
  });

  // Update progress from status
  useEffect(() => {
    if (noteStatus) {
      setGenerationProgress(noteStatus.progress);
      if (noteStatus.status === 'ready') {
        setIsGenerating(false);
        queryClient.invalidateQueries({ queryKey: ['note', sessionId] });
      } else if (noteStatus.status === 'error') {
        setIsGenerating(false);
      }
    }
  }, [noteStatus, sessionId, queryClient]);

  // Set content when note is loaded, or clear when no note exists
  useEffect(() => {
    if (note?.content_markdown) {
      console.log(
        '[NotesPage] Note loaded for session:',
        sessionId,
        'length:',
        note.content_markdown.length
      );
      setContent(note.content_markdown);
      setHasChanges(false);
    } else if (!noteLoading && (noteError || !note)) {
      // No note exists for this session - clear content
      console.log('[NotesPage] No note found for session:', sessionId, 'clearing content');
      setContent('');
      setHasChanges(false);
    }
  }, [note, noteLoading, noteError, sessionId]);

  // Auto-save functionality
  const saveNotes = useCallback(
    async (contentToSave: string) => {
      if (!contentToSave || !note) return;

      try {
        await notesApi.update(sessionId!, { content_markdown: contentToSave });
        setHasChanges(false);
        setLastSavedAt(new Date());
        queryClient.invalidateQueries({ queryKey: ['note', sessionId] });
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    },
    [sessionId, note, queryClient]
  );

  // Debounced auto-save
  useEffect(() => {
    if (hasChanges && content && note) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

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

  // Save on navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasChanges && content && note) {
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
    mutationFn: (forceRegenerate: boolean = false) =>
      notesApi.generate(sessionId!, {
        forceRegenerate: forceRegenerate,
        outputLanguage: language,
      }),
    onMutate: () => {
      setIsGenerating(true);
      setGenerationProgress(0);
    },
    onSuccess: (generatedNote: { content_markdown: string; generated_at: string }) => {
      setContent(generatedNote.content_markdown);
      setHasChanges(false);
      setIsGenerating(false);
      setGenerationProgress(100);
      queryClient.invalidateQueries({ queryKey: ['note', sessionId] });
    },
    onError: (error: Error) => {
      setIsGenerating(false);
      console.error('Note generation failed:', error);
      alert(`Note generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  // Export PDF mutation
  const exportMutation = useMutation({
    mutationFn: () => notesApi.exportPdf(sessionId!),
    onSuccess: (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${session?.name || 'notes'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    onError: (error: Error) => {
      console.error('PDF export failed:', error);
      // Offer Markdown export as fallback
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (
        errorMsg.includes('PDF_DEPS_MISSING') ||
        errorMsg.includes('PDF_UNAVAILABLE') ||
        errorMsg.includes('503')
      ) {
        if (
          confirm(
            'PDF export requires additional system libraries. Would you like to download as Markdown instead?'
          )
        ) {
          exportMarkdownMutation.mutate();
        }
      } else {
        alert(`PDF export failed: ${errorMsg}`);
      }
    },
  });

  // Export Markdown mutation (fallback)
  const exportMarkdownMutation = useMutation({
    mutationFn: () => notesApi.exportMarkdown(sessionId!),
    onSuccess: (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${session?.name || 'notes'}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    onError: (error: Error) => {
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

  const isLoading = sessionLoading || noteLoading;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!session) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h5" color="text.secondary">
          Session not found
        </Typography>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          Go Back
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
      {/* Header */}
      <Paper
        sx={{
          p: 2,
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate(`/session/${sessionId}`)}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {session.name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DescriptionIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {t.lectureNotes}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Save status */}
          {hasChanges ? (
            <Typography variant="caption" color="warning.main" sx={{ mr: 1 }}>
              Unsaved changes
            </Typography>
          ) : lastSavedAt ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 1 }}>
              <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
              <Typography variant="caption" color="text.secondary">
                Saved {formatLastSaved()}
              </Typography>
            </Box>
          ) : null}

          {/* View Transcript Toggle Button */}
          <Button
            size="small"
            variant="outlined"
            onClick={() => navigate(`/session/${sessionId}`)}
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
          <Button
            variant="contained"
            startIcon={saveMutation.isPending ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
          >
            Save
          </Button>
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <MoreVertIcon />
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <MenuItem onClick={handleGenerate} disabled={generateMutation.isPending}>
              <AutoAwesomeIcon sx={{ mr: 1, fontSize: 20 }} />
              {note?.content_markdown ? 'Regenerate Notes' : 'Generate from Transcripts'}
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleExport} disabled={!content || exportMutation.isPending}>
              <DownloadIcon sx={{ mr: 1, fontSize: 20 }} />
              {exportMutation.isPending ? 'Exporting...' : 'Export as PDF'}
            </MenuItem>
            <MenuItem
              onClick={() => {
                exportMarkdownMutation.mutate();
                setAnchorEl(null);
              }}
              disabled={!content || exportMarkdownMutation.isPending}
            >
              <DownloadIcon sx={{ mr: 1, fontSize: 20 }} />
              {exportMarkdownMutation.isPending ? 'Exporting...' : 'Export as Markdown'}
            </MenuItem>
          </Menu>
        </Box>
      </Paper>

      {/* Regenerate Confirmation Dialog */}
      <Dialog open={confirmRegenerateOpen} onClose={() => setConfirmRegenerateOpen(false)}>
        <DialogTitle>Regenerate Notes?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will replace your current notes with a fresh generation from the transcript. Your
            edits will be lost.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRegenerateOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmRegenerate} variant="contained" color="primary">
            Regenerate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Editor */}
      <Paper
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {isGenerating || generateMutation.isPending ? (
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
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: 'center', maxWidth: 400 }}
            >
              {generationProgress < 30 && 'Collecting transcript segments...'}
              {generationProgress >= 30 && generationProgress < 50 && 'Gathering citations...'}
              {generationProgress >= 50 &&
                generationProgress < 90 &&
                'AI is analyzing and structuring your notes...'}
              {generationProgress >= 90 && 'Finalizing notes...'}
            </Typography>
            <Box sx={{ width: '100%', maxWidth: 300, mt: 3 }}>
              <LinearProgress variant="determinate" value={generationProgress} />
            </Box>
          </Box>
        ) : content ? (
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
      </Paper>
    </Box>
  );
}
