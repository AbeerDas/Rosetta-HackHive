import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import StopIcon from '@mui/icons-material/Stop';
import SettingsIcon from '@mui/icons-material/Settings';
import TranslateIcon from '@mui/icons-material/Translate';
import DescriptionIcon from '@mui/icons-material/Description';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { sessionApi } from '../../services/api';
import { useTranscriptionStore } from '../../stores/transcriptionStore';
import { TranscriptionPanel } from './TranscriptionPanel';
import { CitationPanel } from './CitationPanel';
import { DocumentPanel } from './DocumentPanel';
import { AudioControls, AudioControlsHandle } from './AudioControls';
import { QuestionTranslator } from './QuestionTranslator';
import { NotesPanel } from './NotesPanel';

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [questionPanelOpen, setQuestionPanelOpen] = useState(false);
  const [endSessionDialogOpen, setEndSessionDialogOpen] = useState(false);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [autoGenerateNotes, setAutoGenerateNotes] = useState(false);
  const audioControlsRef = useRef<AudioControlsHandle | null>(null);
  
  // Track current sessionId to detect changes
  const currentSessionIdRef = useRef<string | undefined>(sessionId);

  const isTranscribing = useTranscriptionStore((s) => s.isTranscribing);
  const setTranscribing = useTranscriptionStore((s) => s.setTranscribing);
  const clearSegments = useTranscriptionStore((s) => s.clearSegments);

  // Reset UI state when sessionId changes (switching between sessions)
  useEffect(() => {
    const previousSessionId = currentSessionIdRef.current;
    
    // Only clear and reset if we're switching to a DIFFERENT session
    if (previousSessionId && previousSessionId !== sessionId) {
      console.log('[SessionPage] Session changed from', previousSessionId, 'to', sessionId);
      
      // Reset UI state for new session
      setShowNotesPanel(false);
      setAutoGenerateNotes(false);
      setQuestionPanelOpen(false);
      setEndSessionDialogOpen(false);
      
      // Clear live transcription data when switching sessions
      clearSegments();
    }
    
    // Always update the ref to current sessionId
    currentSessionIdRef.current = sessionId;
  }, [sessionId, clearSegments]);

  // End session mutation
  const endSessionMutation = useMutation({
    mutationFn: (generateNotes: boolean) =>
      sessionApi.end(sessionId!, { generate_notes: generateNotes }),
    onSuccess: async (_, generateNotes) => {
      // Stop transcribing
      setTranscribing(false);
      
      // Close dialog
      setEndSessionDialogOpen(false);
      
      // Invalidate and refetch session to update isActive status
      // This will cause TranscriptionPanel to switch from live to saved mode
      await queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
      await queryClient.refetchQueries({ queryKey: ['session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      
      // Invalidate transcript cache so TranscriptionPanel fetches fresh data
      queryClient.invalidateQueries({ queryKey: ['transcript', sessionId] });
      
      // Show notes panel if generating notes
      if (generateNotes) {
        setAutoGenerateNotes(true);
        setShowNotesPanel(true);
      }
    },
  });

  const handleEndSession = (generateNotes: boolean) => {
    // Stop transcription if active
    if (audioControlsRef.current) {
      audioControlsRef.current.stop();
    }
    setTranscribing(false);
    
    // Call the API
    endSessionMutation.mutate(generateNotes);
  };

  // Fetch session details
  const { data: session, isLoading } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => sessionApi.get(sessionId!),
    enabled: !!sessionId,
  });

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
      </Box>
    );
  }

  const isActive = session.status === 'active';
  const languageNames: Record<string, string> = {
    en: 'English',
    zh: 'Chinese',
    hi: 'Hindi',
    es: 'Spanish',
    fr: 'French',
    bn: 'Bengali',
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
      {/* Session Header */}
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
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {session.name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Chip
                label={isActive ? 'Active' : 'Session Ended'}
                color={isActive ? 'success' : 'info'}
                size="small"
              />
              <Typography variant="caption" color="text.secondary">
                {languageNames[session.source_language]} → {languageNames[session.target_language]}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Question Translation">
            <IconButton onClick={() => setQuestionPanelOpen(true)}>
              <TranslateIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings">
            <IconButton>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
          {isActive ? (
            <Button
              variant="contained"
              color="error"
              size="small"
              startIcon={<StopIcon />}
              onClick={() => setEndSessionDialogOpen(true)}
            >
              End Session
            </Button>
          ) : (
            <Button
              variant="outlined"
              size="small"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/')}
            >
              Back to Sessions
            </Button>
          )}
        </Box>
      </Paper>

      {/* End Session Confirmation Dialog */}
      <Dialog
        open={endSessionDialogOpen}
        onClose={() => !endSessionMutation.isPending && setEndSessionDialogOpen(false)}
      >
        <DialogTitle sx={{ color: 'warning.main' }}>⚠️ End Session?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>Warning:</strong> Once you end the session, you will no longer be able to record 
            new transcriptions. This action cannot be undone.
          </DialogContentText>
          <DialogContentText>
            Would you like to generate structured notes from the transcription, or save the transcript only?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setEndSessionDialogOpen(false)}
            disabled={endSessionMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => handleEndSession(false)}
            disabled={endSessionMutation.isPending}
            color="inherit"
          >
            {endSessionMutation.isPending ? 'Ending...' : 'Save Transcript Only'}
          </Button>
          <Button
            onClick={() => handleEndSession(true)}
            variant="contained"
            disabled={endSessionMutation.isPending}
          >
            {endSessionMutation.isPending ? 'Ending...' : 'End & Generate Notes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Main Content - Two/Three Panel Layout */}
      <Box sx={{ display: 'flex', flex: 1, gap: 2, overflow: 'hidden' }}>
        {/* Left Panel - Documents (hidden when showing notes) */}
        {!showNotesPanel && (
          <Paper
            sx={{
              width: 300,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Documents
              </Typography>
            </Box>
            <DocumentPanel sessionId={sessionId!} />
          </Paper>
        )}

        {/* Center Panel - Transcription or Notes */}
        <Paper
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              p: 2,
              borderBottom: 1,
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {showNotesPanel ? (
                <DescriptionIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
              ) : null}
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {showNotesPanel ? 'Lecture Notes' : 'Live Transcription'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {/* Toggle between Notes and Transcription when session is completed */}
              {!isActive && (
                <>
                  <Button
                    size="small"
                    variant={showNotesPanel ? 'outlined' : 'contained'}
                    onClick={() => setShowNotesPanel(!showNotesPanel)}
                  >
                    {showNotesPanel ? 'View Transcript' : 'View Notes'}
                  </Button>
                  {showNotesPanel && (
                    <Tooltip title="Open in full-page editor">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/session/${sessionId}/notes`)}
                      >
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </>
              )}
              {isTranscribing && !showNotesPanel && (
                <Chip
                  label="Transcribing"
                  color="success"
                  size="small"
                  sx={{
                    '& .MuiChip-label': {
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                    },
                  }}
                  icon={
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: 'success.main',
                        animation: 'pulse 1.5s infinite',
                        '@keyframes pulse': {
                          '0%': { opacity: 1 },
                          '50%': { opacity: 0.4 },
                          '100%': { opacity: 1 },
                        },
                      }}
                    />
                  }
                />
              )}
            </Box>
          </Box>
          {showNotesPanel ? (
            <NotesPanel
              sessionId={sessionId!}
              sessionName={session.name}
              autoGenerate={autoGenerateNotes}
            />
          ) : (
            <TranscriptionPanel sessionId={sessionId!} isActive={isActive} />
          )}
        </Paper>

        {/* Right Panel - Citations */}
        <Paper
          sx={{
            width: 320,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Citations
            </Typography>
          </Box>
          <CitationPanel sessionId={sessionId!} />
        </Paper>
      </Box>

      {/* Bottom Audio Controls */}
      <AudioControls
        ref={audioControlsRef}
        sessionId={sessionId!}
        sourceLanguage={session.source_language}
        targetLanguage={session.target_language}
        isActive={isActive}
      />

      {/* Question Translation Modal */}
      <QuestionTranslator
        open={questionPanelOpen}
        onClose={() => setQuestionPanelOpen(false)}
      />
    </Box>
  );
}
