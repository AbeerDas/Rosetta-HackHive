import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Slider,
  Select,
  MenuItem,
  Chip,
  Tooltip,
  alpha,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import { useTranslationStore } from '../../stores/translationStore';
import { useTranscriptionStore } from '../../stores/transcriptionStore';

interface AudioControlsProps {
  sessionId: string;
  targetLanguage: string;
  isActive: boolean;
}

const languages = [
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
];

export function AudioControls({ sessionId, targetLanguage, isActive }: AudioControlsProps) {
  const {
    status,
    volume,
    isMuted,
    setStatus,
    setTargetLanguage,
    setVolume,
    toggleMute,
  } = useTranslationStore();

  const { isTranscribing, setTranscribing } = useTranscriptionStore();

  const [selectedLanguage, setSelectedLanguage] = useState(targetLanguage);

  const handleStart = () => {
    setStatus('connecting');
    setTranscribing(true);
    // In production, this would establish WebSocket connections
    setTimeout(() => setStatus('live'), 1000);
  };

  const handleStop = () => {
    setStatus('ready');
    setTranscribing(false);
  };

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    setTargetLanguage(lang);
  };

  const getStatusColor = () => {
    switch (status) {
      case 'live':
        return 'success';
      case 'connecting':
      case 'reconnecting':
        return 'warning';
      case 'muted':
        return 'default';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'live':
        return 'Live';
      case 'connecting':
        return 'Connecting...';
      case 'reconnecting':
        return 'Reconnecting...';
      case 'muted':
        return 'Muted';
      case 'error':
        return 'Error';
      default:
        return 'Ready';
    }
  };

  const isPlaying = status === 'live' || status === 'muted';

  return (
    <Paper
      sx={{
        mt: 2,
        p: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 3,
      }}
    >
      {/* Translation Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
          Translation:
        </Typography>
        <Select
          value={selectedLanguage}
          onChange={(e) => handleLanguageChange(e.target.value)}
          size="small"
          disabled={isPlaying}
          sx={{ minWidth: 150 }}
        >
          {languages.map((lang) => (
            <MenuItem key={lang.code} value={lang.code}>
              {lang.name} - {lang.nativeName}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {/* Divider */}
      <Box sx={{ height: 32, width: 1, bgcolor: 'divider' }} />

      {/* Play/Stop Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {!isPlaying ? (
          <Tooltip title="Start Translation">
            <IconButton
              color="primary"
              onClick={handleStart}
              disabled={!isActive}
              sx={{
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                '&:hover': {
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
                },
              }}
            >
              <PlayArrowIcon />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title="Stop Translation">
            <IconButton
              color="error"
              onClick={handleStop}
              sx={{
                bgcolor: (theme) => alpha(theme.palette.error.main, 0.1),
                '&:hover': {
                  bgcolor: (theme) => alpha(theme.palette.error.main, 0.2),
                },
              }}
            >
              <StopIcon />
            </IconButton>
          </Tooltip>
        )}

        <Chip
          label={getStatusLabel()}
          color={getStatusColor()}
          size="small"
          icon={
            status === 'live' ? (
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
            ) : undefined
          }
        />
      </Box>

      {/* Divider */}
      <Box sx={{ height: 32, width: 1, bgcolor: 'divider' }} />

      {/* Volume Control */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 200 }}>
        <Tooltip title={isMuted ? 'Unmute' : 'Mute'}>
          <IconButton onClick={toggleMute} size="small">
            {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
          </IconButton>
        </Tooltip>
        <Slider
          value={isMuted ? 0 : volume}
          onChange={(_, value) => setVolume(value as number)}
          size="small"
          sx={{ width: 120 }}
          disabled={isMuted}
        />
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 32 }}>
          {isMuted ? 0 : volume}%
        </Typography>
      </Box>

      {/* Divider */}
      <Box sx={{ height: 32, width: 1, bgcolor: 'divider' }} />

      {/* Microphone Status */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title={isTranscribing ? 'Microphone Active' : 'Microphone Off'}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              bgcolor: isTranscribing
                ? (theme) => alpha(theme.palette.success.main, 0.1)
                : 'transparent',
            }}
          >
            {isTranscribing ? (
              <MicIcon sx={{ fontSize: 20, color: 'success.main' }} />
            ) : (
              <MicOffIcon sx={{ fontSize: 20, color: 'text.disabled' }} />
            )}
            <Typography
              variant="caption"
              color={isTranscribing ? 'success.main' : 'text.disabled'}
            >
              {isTranscribing ? 'Listening' : 'Idle'}
            </Typography>
          </Box>
        </Tooltip>
      </Box>

      {/* Spacer */}
      <Box sx={{ flex: 1 }} />

      {/* Session Duration */}
      {isPlaying && (
        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
          00:00:00
        </Typography>
      )}
    </Paper>
  );
}
