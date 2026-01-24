import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  CircularProgress,
  Button,
} from '@mui/material';
import StopIcon from '@mui/icons-material/Stop';
import SettingsIcon from '@mui/icons-material/Settings';
import TranslateIcon from '@mui/icons-material/Translate';
import { useQuery } from '@tanstack/react-query';

import { sessionApi } from '../../services/api';
import { useTranscriptionStore } from '../../stores/transcriptionStore';
import { TranscriptionPanel } from './TranscriptionPanel';
import { CitationPanel } from './CitationPanel';
import { DocumentPanel } from './DocumentPanel';
import { AudioControls } from './AudioControls';
import { QuestionTranslator } from './QuestionTranslator';

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [questionPanelOpen, setQuestionPanelOpen] = useState(false);

  const isTranscribing = useTranscriptionStore((s) => s.isTranscribing);

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
                label={isActive ? 'Active' : session.status}
                color={isActive ? 'success' : 'default'}
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
          {isActive && (
            <Button
              variant="contained"
              color="error"
              size="small"
              startIcon={<StopIcon />}
            >
              End Session
            </Button>
          )}
        </Box>
      </Paper>

      {/* Main Content - Three Panel Layout */}
      <Box sx={{ display: 'flex', flex: 1, gap: 2, overflow: 'hidden' }}>
        {/* Left Panel - Documents */}
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

        {/* Center Panel - Transcription */}
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
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Live Transcription
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isTranscribing && (
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
          <TranscriptionPanel />
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
