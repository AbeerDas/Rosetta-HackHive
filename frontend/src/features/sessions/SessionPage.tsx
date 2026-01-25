import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { sessionApi } from '../../services/api';
import { useTranscriptionStore, useLanguageStore } from '../../stores';
import { TranscriptionPanel } from './TranscriptionPanel';
import { CitationPanel } from './CitationPanel';
import { DocumentPanel } from './DocumentPanel';
import { AudioControls, AudioControlsHandle } from './AudioControls';
import { QuestionTranslator } from './QuestionTranslator';
import { NotesPanel } from './NotesPanel';
import { customColors } from '../../theme';

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLanguageStore();
  
  const [questionPanelOpen, setQuestionPanelOpen] = useState(false);
  const [endSessionDialogOpen, setEndSessionDialogOpen] = useState(false);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [autoGenerateNotes, setAutoGenerateNotes] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(true);
  const [citationsOpen, setCitationsOpen] = useState(true);
  const audioControlsRef = useRef<AudioControlsHandle | null>(null);
  
  // Track current sessionId to detect changes
  const currentSessionIdRef = useRef<string | undefined>(sessionId);

  const isTranscribing = useTranscriptionStore((s) => s.isTranscribing);
  const setTranscribing = useTranscriptionStore((s) => s.setTranscribing);
  const clearSegments = useTranscriptionStore((s) => s.clearSegments);

  // Reset UI state when sessionId changes (switching between sessions)
  useEffect(() => {
    const previousSessionId = currentSessionIdRef.current;
    
    if (previousSessionId && previousSessionId !== sessionId) {
      console.log('[SessionPage] Session changed from', previousSessionId, 'to', sessionId);
      
      setShowNotesPanel(false);
      setAutoGenerateNotes(false);
      setQuestionPanelOpen(false);
      setEndSessionDialogOpen(false);
      clearSegments();
    }
    
    currentSessionIdRef.current = sessionId;
  }, [sessionId, clearSegments]);

  // End session mutation
  const endSessionMutation = useMutation({
    mutationFn: (generateNotes: boolean) =>
      sessionApi.end(sessionId!, { generate_notes: generateNotes }),
    onSuccess: async (_, generateNotes) => {
      setTranscribing(false);
      setEndSessionDialogOpen(false);
      
      await queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
      await queryClient.refetchQueries({ queryKey: ['session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['transcript', sessionId] });
      
      if (generateNotes) {
        setAutoGenerateNotes(true);
        setShowNotesPanel(true);
      }
    },
    onError: async () => {
      // If end fails (e.g., session already ended), refetch session to get current state
      // This ensures the UI reflects the actual session status and shows "View Notes" button
      setEndSessionDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
      await queryClient.refetchQueries({ queryKey: ['session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });

  const handleEndSession = (generateNotes: boolean) => {
    if (audioControlsRef.current) {
      audioControlsRef.current.stop();
    }
    setTranscribing(false);
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
    en: t.english,
    zh: t.chinese,
    hi: t.hindi,
    es: t.spanish,
    fr: t.french,
    bn: t.bengali,
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
      {/* Session Header */}
      <Box
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 500 }}>
            {session.name}
          </Typography>
          
          <Chip
            label={isActive ? t.active : t.sessionEnded}
            size="small"
            sx={{
              bgcolor: isActive ? customColors.activePill.background : 'grey.200',
              color: isActive ? customColors.activePill.text : 'text.secondary',
              fontWeight: 500,
            }}
          />

          {/* Language Display */}
          <Typography variant="body2" color="text.secondary">
            {languageNames[session.source_language]} → {languageNames[session.target_language]}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Question Translation Button */}
          <Tooltip title={t.questionTranslation}>
            <IconButton 
              onClick={() => setQuestionPanelOpen(true)}
              sx={{ p: 1 }}
            >
              <Box
                component="img"
                src="/icons/questionbutton.svg"
                alt="Question"
                sx={{ width: 24, height: 24 }}
              />
            </IconButton>
          </Tooltip>

          {isActive ? (
            <Button
              variant="contained"
              size="small"
              onClick={() => setEndSessionDialogOpen(true)}
              sx={{
                bgcolor: customColors.endSession.background,
                color: customColors.endSession.text,
                textTransform: 'none',
                '&:hover': {
                  bgcolor: '#8A1F04',
                },
              }}
            >
              {t.endSession}
            </Button>
          ) : (
            <IconButton
              size="small"
              onClick={() => navigate('/')}
              sx={{
                color: 'text.secondary',
              }}
            >
              <ArrowBackIcon />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* End Session Confirmation Dialog */}
      <Dialog
        open={endSessionDialogOpen}
        onClose={() => !endSessionMutation.isPending && setEndSessionDialogOpen(false)}
      >
        <DialogTitle sx={{ color: 'warning.main' }}>⚠️ {t.endSessionConfirm}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>Warning:</strong> {t.endSessionWarning}
          </DialogContentText>
          <DialogContentText>
            {t.generateNotesQuestion}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setEndSessionDialogOpen(false)}
            disabled={endSessionMutation.isPending}
          >
            {t.cancel}
          </Button>
          <Button
            onClick={() => handleEndSession(false)}
            disabled={endSessionMutation.isPending}
            color="inherit"
          >
            {endSessionMutation.isPending ? 'Ending...' : t.saveTranscriptOnly}
          </Button>
          <Button
            onClick={() => handleEndSession(true)}
            variant="contained"
            disabled={endSessionMutation.isPending}
            sx={{
              bgcolor: customColors.brandGreen,
              '&:hover': { bgcolor: '#005F54' },
            }}
          >
            {endSessionMutation.isPending ? 'Ending...' : t.endAndGenerateNotes}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Main Content - Three Column Layout */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Panel - Documents */}
        {documentsOpen && !showNotesPanel && (
          <>
            <Box
              sx={{
                width: 280,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                borderRight: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ 
                p: 1.5, 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                  {t.documents}
                </Typography>
                <IconButton 
                  size="small" 
                  onClick={() => setDocumentsOpen(false)}
                >
                  <Box
                    component="img"
                    src="/icons/material-symbols_left-panel-close.svg"
                    alt="Close"
                    sx={{ width: 20, height: 20 }}
                  />
                </IconButton>
              </Box>
              <DocumentPanel sessionId={sessionId!} />
            </Box>
          </>
        )}

        {/* Toggle button when documents panel is closed */}
        {!documentsOpen && !showNotesPanel && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              pt: 2,
              px: 2,
              borderRight: '1px solid',
              borderColor: 'divider',
            }}
          >
            <IconButton 
              size="small" 
              onClick={() => setDocumentsOpen(true)}
            >
              <Box
                component="img"
                src="/icons/material-symbols_left-panel-open.svg"
                alt="Open"
                sx={{ width: 20, height: 20 }}
              />
            </IconButton>
          </Box>
        )}

        {/* Center Panel - Transcription or Notes */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          {/* Header - only show when viewing transcription (NotesPanel has its own header) */}
          {!showNotesPanel && (
            <Box
              sx={{
                p: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                {t.liveTranscription}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {/* Only show View Notes button when viewing transcript (not notes) */}
                {!isActive && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setShowNotesPanel(true)}
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
                    {t.viewNotes}
                  </Button>
                )}
                {isTranscribing && (
                  <Chip
                    label={t.transcribing}
                    size="small"
                    sx={{
                      bgcolor: customColors.activePill.background,
                      color: customColors.activePill.text,
                    }}
                    icon={
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: customColors.activePill.text,
                          animation: 'pulse 1.5s infinite',
                          ml: 1,
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
          )}
          {showNotesPanel ? (
            <NotesPanel
              sessionId={sessionId!}
              sessionName={session.name}
              autoGenerate={autoGenerateNotes}
              onViewTranscript={() => setShowNotesPanel(false)}
            />
          ) : (
            <TranscriptionPanel sessionId={sessionId!} isActive={isActive} />
          )}
        </Box>

        {/* Toggle button when citations panel is closed */}
        {!citationsOpen && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              pt: 2,
              px: 2,
              borderLeft: '1px solid',
              borderColor: 'divider',
            }}
          >
            <IconButton 
              size="small" 
              onClick={() => setCitationsOpen(true)}
            >
              <Box
                component="img"
                src="/icons/material-symbols_right-panel-open.svg"
                alt="Open"
                sx={{ width: 20, height: 20 }}
              />
            </IconButton>
          </Box>
        )}

        {/* Right Panel - Citations */}
        {citationsOpen && (
          <Box
            sx={{
              width: 300,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderLeft: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ 
              p: 1.5, 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                {t.citations}
              </Typography>
              <IconButton 
                size="small" 
                onClick={() => setCitationsOpen(false)}
              >
                <Box
                  component="img"
                  src="/icons/material-symbols_right-panel-close.svg"
                  alt="Close"
                  sx={{ width: 20, height: 20 }}
                />
              </IconButton>
            </Box>
            <CitationPanel sessionId={sessionId!} />
          </Box>
        )}
      </Box>

      {/* Bottom Audio Controls */}
      <AudioControls
        ref={audioControlsRef}
        sessionId={sessionId!}
        sourceLanguage={session.source_language}
        targetLanguage={session.target_language}
        isActive={isActive}
      />

      {/* Question Translation Drawer - No navbar highlight */}
      <QuestionTranslator
        open={questionPanelOpen}
        onClose={() => setQuestionPanelOpen(false)}
      />
    </Box>
  );
}
