import { useState, useRef, useCallback, useEffect } from 'react';
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
import HeadphonesIcon from '@mui/icons-material/Headphones';
import { useTranslationStore } from '../../stores/translationStore';
import { useTranscriptionStore } from '../../stores/transcriptionStore';
import { useTranscriptionSocket, useTranslationSocket, TranscriptionMessage, TranslationMessage } from '../../hooks/useWebSocket';
import { useAudioPlayback } from '../../hooks/useAudioCapture';

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface AudioControlsProps {
  sessionId: string;
  sourceLanguage: string;
  targetLanguage: string;
  isActive: boolean;
}

// Map language codes to Web Speech API locale codes
const speechRecognitionLocales: Record<string, string> = {
  en: 'en-US',
  zh: 'zh-CN',
  hi: 'hi-IN',
  es: 'es-ES',
  fr: 'fr-FR',
  bn: 'bn-IN',
};

const languages = [
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
];

export function AudioControls({ sessionId, sourceLanguage, targetLanguage, isActive }: AudioControlsProps) {
  const {
    status,
    volume,
    isMuted,
    setStatus,
    setTargetLanguage,
    setVolume,
    toggleMute,
  } = useTranslationStore();

  const { 
    isTranscribing,
    isPaused, 
    setTranscribing,
    updateCurrentSegment,
    addSegment,
    updateSegmentText,
    attachCitations,
    clearSegments,
  } = useTranscriptionStore();

  const [selectedLanguage, setSelectedLanguage] = useState(targetLanguage);
  const [translationConnected, setTranslationConnected] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const segmentCounterRef = useRef(0);
  const startTimeRef = useRef(0);
  const isActiveRef = useRef(false); // Track if transcription should be active (avoids stale closure)
  const sendTextForTranslationRef = useRef<((text: string, segmentId: string) => void) | null>(null);

  // Handle pause/resume for speech recognition per FRD-04
  useEffect(() => {
    if (!recognitionRef.current || !isActiveRef.current) return;
    
    if (isPaused) {
      // Pause transcription - stop recognition temporarily (but keep isActiveRef true for resume)
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    } else if (isTranscribing) {
      // Resume transcription - restart recognition
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Ignore if already started
      }
    }
  }, [isPaused, isTranscribing]);

  // Audio playback for translated audio
  const audioPlayback = useAudioPlayback();
  
  // Use refs to avoid callback changes causing WebSocket reconnection
  const isMutedRef = useRef(isMuted);
  const audioPlaybackRef = useRef(audioPlayback);
  
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);
  
  useEffect(() => {
    audioPlaybackRef.current = audioPlayback;
  }, [audioPlayback]);

  // Handle translated audio from WebSocket - use refs to avoid reconnection
  const handleTranslatedAudio = useCallback((audioData: ArrayBuffer) => {
    if (!isMutedRef.current) {
      audioPlaybackRef.current.playAudioChunk(audioData);
    }
  }, []); // No dependencies - uses refs

  // Use ref for updateSegmentText to avoid callback changes
  const updateSegmentTextRef = useRef(updateSegmentText);
  useEffect(() => { updateSegmentTextRef.current = updateSegmentText; }, [updateSegmentText]);

  // Handle translation status messages
  const handleTranslationStatus = useCallback((msg: TranslationMessage) => {
    if (msg.type === 'connected') {
      setTranslationConnected(true);
      console.log('Translation connected for language:', msg.language);
    } else if (msg.type === 'translated_text') {
      // Update the transcript segment with translated text
      if (msg.segment_id && msg.translated_text) {
        console.log('Received translation:', msg.original_text, '->', msg.translated_text);
        updateSegmentTextRef.current(msg.segment_id, msg.translated_text);
      }
    } else if (msg.type === 'status') {
      console.log('Translation status:', msg.status);
    } else if (msg.type === 'error') {
      console.error('Translation error:', msg.message);
    }
  }, []);

  // Translation WebSocket for audio streaming
  const translationSocket = useTranslationSocket(
    sessionId,
    selectedLanguage,
    handleTranslatedAudio,
    handleTranslationStatus
  );

  // Send transcribed text to translation WebSocket for translation + TTS
  const sendTextForTranslation = useCallback((text: string, segmentId: string) => {
    if (translationSocket.isConnected && !isMutedRef.current && text.trim()) {
      translationSocket.send({ type: 'translate', text: text.trim(), segment_id: segmentId });
    }
  }, [translationSocket]);

  // Keep the ref updated to avoid stale closure in speech recognition handler
  useEffect(() => {
    sendTextForTranslationRef.current = sendTextForTranslation;
  }, [sendTextForTranslation]);

  // Handle messages from transcription WebSocket
  const handleTranscriptionMessage = useCallback((msg: TranscriptionMessage) => {
    if (msg.type === 'segment_saved' && msg.segment_id) {
      // Backend confirmed segment was saved - we can update the local segment ID if needed
      console.log('Segment saved:', msg.segment_id);
    } else if (msg.type === 'citations' && msg.citations && msg.segment_id) {
      // Attach citations to the segment
      attachCitations(msg.segment_id, msg.citations);
    } else if (msg.type === 'error') {
      console.error('Transcription WebSocket error:', msg.message);
    }
  }, [attachCitations]);

  // Transcription WebSocket
  const transcriptionSocket = useTranscriptionSocket(sessionId, handleTranscriptionMessage);

  // Send segment to backend via WebSocket
  const sendSegmentToBackend = useCallback((segment: {
    id: string;
    text: string;
    start_time: number;
    end_time: number;
    confidence: number;
  }) => {
    if (transcriptionSocket.isConnected) {
      transcriptionSocket.send({
        type: 'segment',
        segment: {
          text: segment.text,
          start_time: segment.start_time,
          end_time: segment.end_time,
          confidence: segment.confidence,
        },
      });
    }
  }, [transcriptionSocket]);

  // Initialize speech recognition
  const initSpeechRecognition = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionAPI) {
      console.error('Speech recognition not supported in this browser');
      setStatus('error');
      return null;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechRecognitionLocales[sourceLanguage] || 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Update current segment with interim results (shows live typing)
      if (interimTranscript) {
        updateCurrentSegment(interimTranscript);
      }

      // When we get a final result, add it as a completed segment
      if (finalTranscript) {
        const currentTime = (Date.now() - startTimeRef.current) / 1000;
        segmentCounterRef.current += 1;
        const segmentId = `segment-${segmentCounterRef.current}`;
        
        const segment = {
          id: segmentId,
          text: finalTranscript.trim(),
          start_time: currentTime - 2, // Approximate
          end_time: currentTime,
          confidence: event.results[event.resultIndex][0].confidence || 0.9,
          citations: [],
        };
        
        // Add to local store
        addSegment(segment);
        
        // Send to backend for RAG processing
        sendSegmentToBackend(segment);
        
        // Send to translation WebSocket for translation + TTS audio output
        sendTextForTranslationRef.current?.(finalTranscript.trim(), segmentId);
        
        // Clear the current segment since it's now finalized
        updateCurrentSegment('');
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setStatus('error');
        setTranscribing(false);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be transcribing and not paused
      // Use ref to avoid stale closure issues with isTranscribing state
      if (isActiveRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // Ignore errors from rapid start/stop
        }
      }
    };

    return recognition;
  }, [addSegment, updateCurrentSegment, setStatus, setTranscribing, sendSegmentToBackend, sourceLanguage]);

  const handleStart = async () => {
    setStatus('connecting');
    clearSegments();
    startTimeRef.current = Date.now();
    segmentCounterRef.current = 0;
    isActiveRef.current = true; // Mark as active for auto-restart logic

    // Connect to transcription WebSocket for RAG
    transcriptionSocket.connect();

    // Connect to translation WebSocket for receiving translated audio
    translationSocket.connect();

    // Initialize and start speech recognition
    const recognition = initSpeechRecognition();
    if (recognition) {
      recognitionRef.current = recognition;
      try {
        recognition.start();
        setTranscribing(true);
        setStatus('live');
      } catch (e) {
        console.error('Failed to start speech recognition:', e);
        setStatus('error');
        isActiveRef.current = false;
      }
    } else {
      isActiveRef.current = false;
    }
  };

  const handleStop = () => {
    // Mark as inactive first to prevent any auto-restart attempts
    isActiveRef.current = false;
    
    // Stop speech recognition - clear all handlers and abort to cancel pending results
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null; // Prevent pending results from being processed
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null; // Prevent auto-restart
      try {
        recognitionRef.current.abort(); // abort() immediately stops, stop() waits for pending results
      } catch (e) {
        // Ignore if already stopped
      }
      recognitionRef.current = null;
    }
    
    // Stop audio playback
    audioPlayback.stop();
    
    // Disconnect WebSockets
    transcriptionSocket.disconnect();
    translationSocket.disconnect();
    setTranslationConnected(false);
    
    setStatus('ready');
    setTranscribing(false);
    updateCurrentSegment('');
  };

  // Sync volume with playback
  useEffect(() => {
    audioPlayback.updateVolume(volume);
  }, [volume, audioPlayback]);

  // Store socket refs for cleanup without causing effect re-runs
  const transcriptionSocketRef = useRef(transcriptionSocket);
  const translationSocketRef = useRef(translationSocket);
  
  useEffect(() => { transcriptionSocketRef.current = transcriptionSocket; }, [transcriptionSocket]);
  useEffect(() => { translationSocketRef.current = translationSocket; }, [translationSocket]);

  // Cleanup on unmount only - use refs to avoid effect re-running
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
      audioPlaybackRef.current.stop();
      transcriptionSocketRef.current.disconnect();
      translationSocketRef.current.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on unmount

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    setTargetLanguage(lang);
    
    // If actively translating, send language change message to backend
    if (translationSocket.isConnected) {
      translationSocket.send({ type: 'change_language', language: lang });
    }
  };

  // Handle mute toggle - send control message to backend
  const handleMuteToggle = () => {
    toggleMute();
    
    // Send mute/unmute control message to backend per FRD-03 protocol
    if (translationSocket.isConnected) {
      translationSocket.send({ type: isMuted ? 'unmute' : 'mute' });
    }
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
          disabled={status === 'connecting'} // Only disable during connection, allow mid-session changes per FRD-03
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
          <IconButton onClick={handleMuteToggle} size="small">
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

      {/* Divider */}
      <Box sx={{ height: 32, width: 1, bgcolor: 'divider' }} />

      {/* Translation Status */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title={translationConnected ? 'Translation Active' : 'Translation Off'}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              bgcolor: translationConnected
                ? (theme) => alpha(theme.palette.info.main, 0.1)
                : 'transparent',
            }}
          >
            <HeadphonesIcon 
              sx={{ 
                fontSize: 20, 
                color: translationConnected ? 'info.main' : 'text.disabled' 
              }} 
            />
            <Typography
              variant="caption"
              color={translationConnected ? 'info.main' : 'text.disabled'}
            >
              {translationConnected ? 'Translating' : 'Off'}
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
