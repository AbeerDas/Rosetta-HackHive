import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Slider,
  Select,
  MenuItem,
  Chip,
  Tooltip,
  alpha,
} from '@mui/material';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import StopIcon from '@mui/icons-material/Stop';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import TranslateIcon from '@mui/icons-material/Translate';
import { useTranslationStore } from '../../stores/translationStore';
import { useTranscriptionStore, useLanguageStore, useVoiceStore } from '../../stores';
import { useTranscriptionSocket, useTranslationSocket, TranscriptionMessage, TranslationMessage } from '../../hooks/useWebSocket';
import { useAudioPlayback } from '../../hooks/useAudioCapture';
import { customColors } from '../../theme';
import { transcriptApi } from '../../services/api';

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

export interface AudioControlsHandle {
  stop: () => void;
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

// Echo detection constants
const ECHO_BUFFER_TTL_MS = 10000;
const ECHO_SIMILARITY_THRESHOLD = 0.6;

interface TTSBufferEntry {
  text: string;
  normalizedText: string;
  timestamp: number;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function textSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const getBigrams = (str: string): Set<string> => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);

  let intersection = 0;
  for (const bigram of bigramsA) {
    if (bigramsB.has(bigram)) intersection++;
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

function isLikelyEcho(transcript: string, ttsBuffer: TTSBufferEntry[]): boolean {
  const normalizedTranscript = normalizeText(transcript);
  
  if (normalizedTranscript.length < 3) return false;
  
  for (const entry of ttsBuffer) {
    const similarity = textSimilarity(normalizedTranscript, entry.normalizedText);
    if (similarity >= ECHO_SIMILARITY_THRESHOLD) {
      console.log(`[Echo Detection] Blocked echo: "${transcript}" matches TTS "${entry.text}" (similarity: ${similarity.toFixed(2)})`);
      return true;
    }
    
    if (entry.normalizedText.includes(normalizedTranscript) || 
        normalizedTranscript.includes(entry.normalizedText)) {
      const matchLength = Math.min(normalizedTranscript.length, entry.normalizedText.length);
      const maxLength = Math.max(normalizedTranscript.length, entry.normalizedText.length);
      if (matchLength / maxLength >= 0.5) {
        console.log(`[Echo Detection] Blocked partial echo: "${transcript}" contained in/contains TTS "${entry.text}"`);
        return true;
      }
    }
  }
  
  return false;
}

export const AudioControls = forwardRef<AudioControlsHandle, AudioControlsProps>(
  function AudioControls({ sessionId, sourceLanguage, targetLanguage, isActive }, ref) {
  const { t } = useLanguageStore();
  const { selectedVoiceId } = useVoiceStore();
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
    togglePause,
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
  const isActiveRef = useRef(false);
  const isPausedRef = useRef(false);
  const sendTextForTranslationRef = useRef<((text: string, segmentId: string) => void) | null>(null);
  
  const ttsBufferRef = useRef<TTSBufferEntry[]>([]);
  
  const addToTTSBuffer = useCallback((text: string) => {
    const normalizedText = normalizeText(text);
    if (normalizedText.length < 3) return;
    
    ttsBufferRef.current.push({
      text,
      normalizedText,
      timestamp: Date.now(),
    });
  }, []);
  
  const cleanupTTSBuffer = useCallback(() => {
    const now = Date.now();
    ttsBufferRef.current = ttsBufferRef.current.filter(
      entry => now - entry.timestamp < ECHO_BUFFER_TTL_MS
    );
  }, []);

  useEffect(() => {
    isPausedRef.current = isPaused;
    
    if (!recognitionRef.current || !isActiveRef.current) return;
    
    if (isPaused) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    } else if (isTranscribing) {
      try {
        recognitionRef.current.start();
      } catch (e) {}
    }
  }, [isPaused, isTranscribing]);

  const audioPlayback = useAudioPlayback();
  
  const isMutedRef = useRef(isMuted);
  const audioPlaybackRef = useRef(audioPlayback);
  
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);
  
  useEffect(() => {
    audioPlaybackRef.current = audioPlayback;
  }, [audioPlayback]);

  const handleTranslatedAudio = useCallback((audioData: ArrayBuffer) => {
    if (!isMutedRef.current) {
      audioPlaybackRef.current.playAudioChunk(audioData);
    }
  }, []);

  const updateSegmentTextRef = useRef(updateSegmentText);
  useEffect(() => { updateSegmentTextRef.current = updateSegmentText; }, [updateSegmentText]);

  const handleTranslationStatus = useCallback((msg: TranslationMessage) => {
    if (msg.type === 'connected') {
      setTranslationConnected(true);
    } else if (msg.type === 'translated_text') {
      if (msg.segment_id && msg.translated_text) {
        // Update UI immediately
        updateSegmentTextRef.current(msg.segment_id, msg.translated_text);
        
        // Store the translation to save to database when we get the backend ID
        // Check if we already have a backend ID for this segment
        let backendId: string | undefined;
        for (const [bid, fid] of segmentIdMapRef.current.entries()) {
          if (fid === msg.segment_id) {
            backendId = bid;
            break;
          }
        }
        
        if (backendId) {
          // We already have the backend ID, save immediately
          transcriptApi.updateTranslatedText(backendId, msg.translated_text)
            .catch(err => console.error('Failed to save translated text:', err));
        } else {
          // Store for later when we get the backend ID
          pendingTranslationsRef.current.set(msg.segment_id, msg.translated_text);
        }
      }
    }
  }, []);

  const translationSocket = useTranslationSocket(
    sessionId,
    selectedLanguage,
    selectedVoiceId,
    handleTranslatedAudio,
    handleTranslationStatus
  );

  const sendTextForTranslation = useCallback((text: string, segmentId: string) => {
    if (translationSocket.isConnected && !isMutedRef.current && text.trim()) {
      addToTTSBuffer(text.trim());
      translationSocket.send({ type: 'translate', text: text.trim(), segment_id: segmentId });
    }
  }, [translationSocket, addToTTSBuffer]);

  useEffect(() => {
    sendTextForTranslationRef.current = sendTextForTranslation;
  }, [sendTextForTranslation]);

  const segmentIdMapRef = useRef<Map<string, string>>(new Map());
  // Store pending translations by frontend ID until we get the backend ID
  const pendingTranslationsRef = useRef<Map<string, string>>(new Map());

  const handleTranscriptionMessage = useCallback((msg: TranscriptionMessage) => {
    if (msg.type === 'segment_saved' && msg.segment_id) {
      if (msg.frontend_id) {
        segmentIdMapRef.current.set(msg.segment_id, msg.frontend_id);
        
        // Check if we have a pending translation for this frontend ID
        const pendingTranslation = pendingTranslationsRef.current.get(msg.frontend_id);
        if (pendingTranslation) {
          // Save to database using the backend ID
          transcriptApi.updateTranslatedText(msg.segment_id, pendingTranslation)
            .catch(err => console.error('Failed to save translated text:', err));
          pendingTranslationsRef.current.delete(msg.frontend_id);
        }
      }
    } else if (msg.type === 'citations' && msg.citations && msg.segment_id) {
      const frontendId = segmentIdMapRef.current.get(msg.segment_id) || msg.segment_id;
      attachCitations(frontendId, msg.citations);
    }
  }, [attachCitations]);

  const transcriptionSocket = useTranscriptionSocket(sessionId, handleTranscriptionMessage);
  
  const transcriptionSocketRefForSend = useRef(transcriptionSocket);
  useEffect(() => { 
    transcriptionSocketRefForSend.current = transcriptionSocket; 
  }, [transcriptionSocket, transcriptionSocket.isConnected]);

  const pendingSegmentsRef = useRef<Array<{
    id: string;
    text: string;
    start_time: number;
    end_time: number;
    confidence: number;
  }>>([]);

  useEffect(() => {
    if (transcriptionSocket.isConnected && pendingSegmentsRef.current.length > 0) {
      pendingSegmentsRef.current.forEach(segment => {
        transcriptionSocket.send({
          type: 'segment',
          segment: {
            id: segment.id,
            text: segment.text,
            start_time: segment.start_time,
            end_time: segment.end_time,
            confidence: segment.confidence,
          },
        });
      });
      pendingSegmentsRef.current = [];
    }
  }, [transcriptionSocket.isConnected, transcriptionSocket]);

  const sendSegmentToBackend = useCallback((segment: {
    id: string;
    text: string;
    start_time: number;
    end_time: number;
    confidence: number;
  }) => {
    const socket = transcriptionSocketRefForSend.current;
    if (socket.isConnected) {
      socket.send({
        type: 'segment',
        segment: {
          id: segment.id,
          text: segment.text,
          start_time: segment.start_time,
          end_time: segment.end_time,
          confidence: segment.confidence,
        },
      });
    } else {
      pendingSegmentsRef.current.push(segment);
    }
  }, []);

  const initSpeechRecognition = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionAPI) {
      setStatus('error');
      return null;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechRecognitionLocales[sourceLanguage] || 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      cleanupTTSBuffer();
      
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

      if (interimTranscript) {
        updateCurrentSegment(interimTranscript);
      }

      if (finalTranscript) {
        const trimmedTranscript = finalTranscript.trim();
        
        if (isLikelyEcho(trimmedTranscript, ttsBufferRef.current)) {
          updateCurrentSegment('');
          return;
        }
        
        const currentTime = (Date.now() - startTimeRef.current) / 1000;
        segmentCounterRef.current += 1;
        const segmentId = `segment-${segmentCounterRef.current}`;
        
        const segment = {
          id: segmentId,
          text: trimmedTranscript,
          start_time: currentTime - 2,
          end_time: currentTime,
          confidence: event.results[event.resultIndex][0].confidence || 0.9,
          citations: [],
        };
        
        addSegment(segment);
        sendSegmentToBackend(segment);
        sendTextForTranslationRef.current?.(trimmedTranscript, segmentId);
        updateCurrentSegment('');
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setStatus('error');
        setTranscribing(false);
      }
    };

    recognition.onend = () => {
      if (isActiveRef.current && recognitionRef.current && !isPausedRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {}
      }
    };

    return recognition;
  }, [addSegment, updateCurrentSegment, setStatus, setTranscribing, sendSegmentToBackend, sourceLanguage, cleanupTTSBuffer]);

  const handleStart = async () => {
    setStatus('connecting');
    if (segmentCounterRef.current === 0) {
      startTimeRef.current = Date.now();
    }
    isActiveRef.current = true;
    ttsBufferRef.current = [];

    transcriptionSocket.connect();
    translationSocket.connect();

    const recognition = initSpeechRecognition();
    if (recognition) {
      recognitionRef.current = recognition;
      try {
        recognition.start();
        setTranscribing(true);
        setStatus('live');
      } catch (e) {
        setStatus('error');
        isActiveRef.current = false;
      }
    } else {
      isActiveRef.current = false;
    }
  };

  const handleStop = () => {
    isActiveRef.current = false;
    
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }
    
    audioPlayback.stop();
    ttsBufferRef.current = [];
    
    transcriptionSocket.disconnect();
    translationSocket.disconnect();
    setTranslationConnected(false);
    
    setStatus('ready');
    setTranscribing(false);
    updateCurrentSegment('');
  };

  useImperativeHandle(ref, () => ({
    stop: handleStop,
  }), []);

  useEffect(() => {
    audioPlayback.updateVolume(volume);
  }, [volume, audioPlayback]);

  const transcriptionSocketRef = useRef(transcriptionSocket);
  const translationSocketRef = useRef(translationSocket);
  
  useEffect(() => { transcriptionSocketRef.current = transcriptionSocket; }, [transcriptionSocket]);
  useEffect(() => { translationSocketRef.current = translationSocket; }, [translationSocket]);

  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
      audioPlaybackRef.current.stop();
      
      if (transcriptionSocketRef.current.isConnected) {
        transcriptionSocketRef.current.disconnect();
      }
      if (translationSocketRef.current.isConnected) {
        translationSocketRef.current.disconnect();
      }
    };
  }, []);

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    setTargetLanguage(lang);
    
    if (translationSocket.isConnected) {
      translationSocket.send({ type: 'change_language', language: lang });
    }
  };

  const handleMuteToggle = () => {
    toggleMute();
    
    if (translationSocket.isConnected) {
      translationSocket.send({ type: isMuted ? 'unmute' : 'mute' });
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'live':
        return t.ready;
      case 'connecting':
        return t.connecting;
      case 'muted':
        return t.paused;
      case 'error':
        return 'Error';
      default:
        return t.ready;
    }
  };

  const isPlaying = status === 'live' || status === 'muted';

  return (
    <Box
      sx={{
        p: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {/* Left Side: Play Button + Status Pill */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* Play/Stop Button - Full Circle */}
        {!isPlaying ? (
          <Tooltip title="Start">
            <IconButton
              onClick={handleStart}
              disabled={!isActive}
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: isActive ? customColors.brandGreen : 'grey.200',
                color: isActive ? 'white' : 'text.disabled',
                '&:hover': {
                  bgcolor: isActive ? '#005F54' : 'grey.300',
                },
              }}
            >
              <PlayCircleIcon sx={{ fontSize: 28 }} />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title="Stop">
            <IconButton
              onClick={handleStop}
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: customColors.endSession.background,
                color: 'white',
                '&:hover': {
                  bgcolor: '#8A1F04',
                },
              }}
            >
              <StopIcon />
            </IconButton>
          </Tooltip>
        )}

        {/* Status Chip */}
        <Chip
          label={getStatusLabel()}
          size="small"
          sx={{
            bgcolor: status === 'live' ? customColors.activePill.background : 'grey.200',
            color: status === 'live' ? customColors.activePill.text : 'text.secondary',
            fontWeight: 500,
          }}
          icon={
            status === 'live' ? (
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
            ) : undefined
          }
        />
      </Box>

      {/* Right Side: Translation, Idle, Headphone, Volume */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {/* Translation Selector */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t.translation}
          </Typography>
          <Select
            value={selectedLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
            size="small"
            disabled={status === 'connecting'}
            sx={{ minWidth: 120 }}
          >
            {languages.map((lang) => (
              <MenuItem key={lang.code} value={lang.code}>
                {lang.nativeName}
              </MenuItem>
            ))}
          </Select>
        </Box>

        {/* Microphone/Idle Status */}
        <Tooltip title={isPaused ? 'Resume Listening' : (isTranscribing ? 'Pause Listening' : 'Start session to enable')}>
          <Box
            onClick={() => {
              if (isTranscribing) {
                togglePause();
              }
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              cursor: isTranscribing ? 'pointer' : 'default',
              transition: 'all 0.2s',
              bgcolor: isPaused
                ? alpha('#F59E0B', 0.1)
                : isTranscribing
                  ? alpha(customColors.brandGreen, 0.1)
                  : 'transparent',
              '&:hover': isTranscribing ? {
                bgcolor: isPaused
                  ? alpha('#F59E0B', 0.2)
                  : alpha(customColors.brandGreen, 0.2),
              } : {},
            }}
          >
            {isPaused ? (
              <MicOffIcon sx={{ fontSize: 20, color: '#F59E0B' }} />
            ) : isTranscribing ? (
              <MicIcon sx={{ fontSize: 20, color: customColors.brandGreen }} />
            ) : (
              <MicOffIcon sx={{ fontSize: 20, color: 'text.disabled' }} />
            )}
            <Typography
              variant="caption"
              color={isPaused ? '#F59E0B' : (isTranscribing ? customColors.brandGreen : 'text.disabled')}
            >
              {isPaused ? t.paused : (isTranscribing ? t.listening : t.idle)}
            </Typography>
          </Box>
        </Tooltip>

        {/* Translation Status - Uses TranslateIcon */}
        <Tooltip title={isMuted ? 'Enable Audio' : (translationConnected ? 'Mute Audio' : 'Start session to enable')}>
          <Box
            onClick={() => {
              if (translationConnected || isMuted) {
                handleMuteToggle();
              }
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              cursor: (translationConnected || isMuted) ? 'pointer' : 'default',
              transition: 'all 0.2s',
              bgcolor: isMuted
                ? 'transparent'
                : translationConnected
                  ? alpha(customColors.brandGreen, 0.1)
                  : 'transparent',
              '&:hover': (translationConnected || isMuted) ? {
                bgcolor: isMuted
                  ? alpha('#999', 0.1)
                  : alpha(customColors.brandGreen, 0.2),
              } : {},
            }}
          >
            <TranslateIcon
              sx={{ 
                fontSize: 20, 
                color: isMuted ? 'text.disabled' : (translationConnected ? customColors.brandGreen : 'text.disabled'),
              }}
            />
            <Typography
              variant="caption"
              color={isMuted ? 'text.disabled' : (translationConnected ? customColors.brandGreen : 'text.disabled')}
            >
              {isMuted ? t.off : (translationConnected ? t.translating : t.off)}
            </Typography>
          </Box>
        </Tooltip>

        {/* Volume Control */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 140 }}>
          <Typography variant="caption" color="text.secondary">
            {t.volume}
          </Typography>
          <Slider
            value={isMuted ? 0 : volume}
            onChange={(_, value) => setVolume(value as number)}
            size="small"
            sx={{ 
              width: 80,
              color: customColors.brandGreen,
              '& .MuiSlider-thumb': {
                bgcolor: customColors.brandGreen,
              },
              '& .MuiSlider-track': {
                bgcolor: customColors.brandGreen,
              },
            }}
            disabled={isMuted}
          />
        </Box>
      </Box>
    </Box>
  );
});
