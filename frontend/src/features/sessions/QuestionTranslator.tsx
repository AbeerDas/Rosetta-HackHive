import { useState, useRef } from 'react';
import {
  Box,
  Drawer,
  Typography,
  TextField,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Tooltip,
  Alert,
  alpha,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import DeleteIcon from '@mui/icons-material/Delete';
import { useMutation } from '@tanstack/react-query';

import { translationApi } from '../../services/api';
import { useQuestionStore } from '../../stores/questionStore';

interface QuestionTranslatorProps {
  open: boolean;
  onClose: () => void;
}

export function QuestionTranslator({ open, onClose }: QuestionTranslatorProps) {
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { history, addTranslation, clearHistory, isLoading, error, setLoading, setError } =
    useQuestionStore();

  // Translation mutation
  const translateMutation = useMutation({
    mutationFn: (text: string) => translationApi.translateQuestion({ text }),
    onSuccess: (result) => {
      setTranslatedText(result.translated_text);
      setDetectedLanguage(result.detected_language_name);
      addTranslation({
        originalText: inputText,
        translatedText: result.translated_text,
        detectedLanguage: result.detected_language_name,
      });
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  // TTS mutation
  const speakMutation = useMutation({
    mutationFn: (text: string) => translationApi.speak(text),
    onSuccess: (audioBlob) => {
      const url = URL.createObjectURL(audioBlob);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
        setIsPlaying(true);
      }
    },
  });

  const handleTranslate = () => {
    if (inputText.trim()) {
      translateMutation.mutate(inputText.trim());
    }
  };

  const handleSpeak = (text: string) => {
    speakMutation.mutate(text);
  };

  const handleCopy = async (text: string, id?: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id || 'current');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    return date.toLocaleTimeString();
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: 400, p: 0 },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6">Question Translation</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Input Section */}
        <Box sx={{ p: 2 }}>
          <TextField
            fullWidth
            multiline
            rows={3}
            placeholder="Type your question in your language..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            variant="outlined"
            helperText={`${inputText.length}/1000`}
            error={inputText.length > 1000}
          />
          {detectedLanguage && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              Detected: {detectedLanguage}
            </Typography>
          )}
          <Button
            fullWidth
            variant="contained"
            onClick={handleTranslate}
            disabled={!inputText.trim() || inputText.length > 1000 || translateMutation.isPending}
            sx={{ mt: 2 }}
          >
            {translateMutation.isPending ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              'Translate'
            )}
          </Button>
        </Box>

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ mx: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Translation Result */}
        {translatedText && (
          <Box sx={{ px: 2, pb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Translation:
            </Typography>
            <Box
              sx={{
                p: 2,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                borderRadius: 2,
                border: 1,
                borderColor: 'primary.main',
              }}
            >
              <Typography variant="body1" sx={{ mb: 2 }}>
                {translatedText}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Speak aloud">
                  <Button
                    size="small"
                    startIcon={
                      speakMutation.isPending || isPlaying ? (
                        <CircularProgress size={16} />
                      ) : (
                        <VolumeUpIcon />
                      )
                    }
                    onClick={() => handleSpeak(translatedText)}
                    disabled={speakMutation.isPending || isPlaying}
                  >
                    Speak
                  </Button>
                </Tooltip>
                <Tooltip title="Copy to clipboard">
                  <Button
                    size="small"
                    startIcon={copiedId === 'current' ? <CheckIcon /> : <ContentCopyIcon />}
                    onClick={() => handleCopy(translatedText)}
                  >
                    {copiedId === 'current' ? 'Copied!' : 'Copy'}
                  </Button>
                </Tooltip>
              </Box>
            </Box>
          </Box>
        )}

        <Divider />

        {/* History Section */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <Box
            sx={{
              px: 2,
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="subtitle2" color="text.secondary">
              History
            </Typography>
            {history.length > 0 && (
              <Button size="small" color="error" onClick={clearHistory}>
                Clear
              </Button>
            )}
          </Box>

          {history.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No translations yet
              </Typography>
            </Box>
          ) : (
            <List dense>
              {history.map((item) => (
                <ListItem
                  key={item.id}
                  sx={{
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      {item.detectedLanguage}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      {formatTime(item.timestamp)}
                    </Typography>
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mb: 0.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.originalText}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {item.translatedText}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Speak">
                      <IconButton
                        size="small"
                        onClick={() => handleSpeak(item.translatedText)}
                      >
                        <VolumeUpIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Copy">
                      <IconButton
                        size="small"
                        onClick={() => handleCopy(item.translatedText, item.id)}
                      >
                        {copiedId === item.id ? (
                          <CheckIcon fontSize="small" />
                        ) : (
                          <ContentCopyIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </Box>

        {/* Hidden audio element */}
        <audio ref={audioRef} onEnded={handleAudioEnded} style={{ display: 'none' }} />
      </Box>
    </Drawer>
  );
}
