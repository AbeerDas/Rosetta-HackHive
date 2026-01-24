import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
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
const ECHO_BUFFER_TTL_MS = 10000; // How long to keep TTS texts in buffer (10 seconds)
const ECHO_SIMILARITY_THRESHOLD = 0.6; // Minimum similarity to consider as echo

interface TTSBufferEntry {
  text: string;
  normalizedText: string;
  timestamp: number;
}

/**
 * Normalize text for comparison - lowercase, remove punctuation, collapse whitespace
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Collapse whitespace
    .trim();
}

/**
 * Calculate similarity between two strings using Sørensen-Dice coefficient.
 * Returns a value between 0 (no similarity) and 1 (identical).
 * This is faster than Levenshtein and works well for echo detection.
 */
function textSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  // Create bigrams (pairs of consecutive characters)
  const getBigrams = (str: string): Set<string> => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);

  // Count intersection
  let intersection = 0;
  for (const bigram of bigramsA) {
    if (bigramsB.has(bigram)) intersection++;
  }

  // Dice coefficient: 2 * |intersection| / (|A| + |B|)
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

/**
 * Check if a transcript is likely an echo of recent TTS output.
 * Also checks for substring matches to catch partial echoes.
 */
function isLikelyEcho(transcript: string, ttsBuffer: TTSBufferEntry[]): boolean {
  const normalizedTranscript = normalizeText(transcript);
  
  // Skip very short transcripts - they're too prone to false positives
  if (normalizedTranscript.length < 3) return false;
  
  for (const entry of ttsBuffer) {
    // Check similarity score
    const similarity = textSimilarity(normalizedTranscript, entry.normalizedText);
    if (similarity >= ECHO_SIMILARITY_THRESHOLD) {
      console.log(`[Echo Detection] Blocked echo: "${transcript}" matches TTS "${entry.text}" (similarity: ${similarity.toFixed(2)})`);
      return true;
    }
    
    // Also check if transcript is contained within TTS or vice versa (partial echo)
    if (entry.normalizedText.includes(normalizedTranscript) || 
        normalizedTranscript.includes(entry.normalizedText)) {
      // Only block if the matching portion is significant
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
  const isActiveRef = useRef(false); // Track if transcription should be active (avoids stale closure)
  const isPausedRef = useRef(false); // Track pause state for speech recognition handler
  const sendTextForTranslationRef = useRef<((text: string, segmentId: string) => void) | null>(null);
  
  // Echo detection: buffer of recent TTS texts to filter from STT results
  const ttsBufferRef = useRef<TTSBufferEntry[]>([]);
  
  // Add text to TTS buffer for echo detection
  const addToTTSBuffer = useCallback((text: string) => {
    const normalizedText = normalizeText(text);
    if (normalizedText.length < 3) return; // Don't buffer very short texts
    
    ttsBufferRef.current.push({
      text,
      normalizedText,
      timestamp: Date.now(),
    });
    console.log(`[Echo Detection] Added to buffer: "${text}"`);
  }, []);
  
  // Clean up expired entries from TTS buffer
  const cleanupTTSBuffer = useCallback(() => {
    const now = Date.now();
    const before = ttsBufferRef.current.length;
    ttsBufferRef.current = ttsBufferRef.current.filter(
      entry => now - entry.timestamp < ECHO_BUFFER_TTL_MS
    );
    const removed = before - ttsBufferRef.current.length;
    if (removed > 0) {
      console.log(`[Echo Detection] Cleaned up ${removed} expired entries from buffer`);
    }
  }, []);

  // Handle pause/resume for speech recognition per FRD-04
  useEffect(() => {
    // Keep ref in sync with state for use in callbacks
    isPausedRef.current = isPaused;
    
    if (!recognitionRef.current || !isActiveRef.current) return;
    
    if (isPaused) {
      // Pause transcription - stop recognition temporarily (but keep isActiveRef true for resume)
      console.log('[AudioControls] Pausing speech recognition');
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    } else if (isTranscribing) {
      // Resume transcription - restart recognition
      console.log('[AudioControls] Resuming speech recognition');
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
      // Add original text to echo buffer BEFORE sending for translation
      // This ensures we can detect when our own TTS output gets picked up by STT
      addToTTSBuffer(text.trim());
      translationSocket.send({ type: 'translate', text: text.trim(), segment_id: segmentId });
    }
  }, [translationSocket, addToTTSBuffer]);

  // Keep the ref updated to avoid stale closure in speech recognition handler
  useEffect(() => {
    sendTextForTranslationRef.current = sendTextForTranslation;
  }, [sendTextForTranslation]);

  // Track backend ID -> frontend ID mapping for citations
  const segmentIdMapRef = useRef<Map<string, string>>(new Map());

  // Handle messages from transcription WebSocket
  const handleTranscriptionMessage = useCallback((msg: TranscriptionMessage) => {
    console.log('[RAG Debug] Received transcription message:', msg.type, msg);
    if (msg.type === 'segment_saved' && msg.segment_id) {
      // Backend confirmed segment was saved - track the ID mapping for citations
      // We DON'T update the segment ID in the store to avoid breaking translation matching
      console.log('[RAG Debug] Segment saved by backend:', msg.segment_id, 'frontend_id:', msg.frontend_id);
      if (msg.frontend_id) {
        // Map backend ID -> frontend ID so we can match citations later
        segmentIdMapRef.current.set(msg.segment_id, msg.frontend_id);
      }
    } else if (msg.type === 'citations' && msg.citations && msg.segment_id) {
      // Attach citations to the segment - need to map backend ID to frontend ID
      const frontendId = segmentIdMapRef.current.get(msg.segment_id) || msg.segment_id;
      console.log('[RAG Debug] Received citations:', msg.citations.length, 'for segment', msg.segment_id, '-> frontend:', frontendId);
      attachCitations(frontendId, msg.citations);
    } else if (msg.type === 'error') {
      console.error('[RAG Debug] Transcription WebSocket error:', msg.message);
    }
  }, [attachCitations]);

  // Transcription WebSocket
  const transcriptionSocket = useTranscriptionSocket(sessionId, handleTranscriptionMessage);
  
  // Ref for transcription socket - declared here but also used later for cleanup
  // Must be declared early so sendSegmentToBackend can use it
  const transcriptionSocketRefForSend = useRef(transcriptionSocket);
  useEffect(() => { 
    transcriptionSocketRefForSend.current = transcriptionSocket; 
    console.log('[RAG Debug] Transcription socket ref updated, isConnected:', transcriptionSocket.isConnected);
  }, [transcriptionSocket, transcriptionSocket.isConnected]);

  // Queue for pending segments when WebSocket is not yet connected
  const pendingSegmentsRef = useRef<Array<{
    id: string;
    text: string;
    start_time: number;
    end_time: number;
    confidence: number;
  }>>([]);

  // Process pending segments when connection becomes available
  useEffect(() => {
    if (transcriptionSocket.isConnected && pendingSegmentsRef.current.length > 0) {
      console.log(`[RAG Debug] WebSocket connected, flushing ${pendingSegmentsRef.current.length} pending segments`);
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

  // Send segment to backend via WebSocket
  // Uses ref to avoid stale closure issues when called from speech recognition handler
  const sendSegmentToBackend = useCallback((segment: {
    id: string;
    text: string;
    start_time: number;
    end_time: number;
    confidence: number;
  }) => {
    const socket = transcriptionSocketRefForSend.current;
    console.log('[RAG Debug] sendSegmentToBackend called, isConnected:', socket.isConnected);
    if (socket.isConnected) {
      console.log('[RAG Debug] Sending segment to transcription WebSocket:', segment.text.substring(0, 50));
      socket.send({
        type: 'segment',
        segment: {
          id: segment.id,  // Include frontend ID for mapping
          text: segment.text,
          start_time: segment.start_time,
          end_time: segment.end_time,
          confidence: segment.confidence,
        },
      });
    } else {
      // Queue segment for when connection is ready
      console.warn('[RAG Debug] Transcription WebSocket not connected, queuing segment');
      pendingSegmentsRef.current.push(segment);
    }
  }, []); // No dependencies - uses ref

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
      // Periodically clean up expired TTS buffer entries
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

      // Update current segment with interim results (shows live typing)
      // Note: We still show interim results even if they might be echo - 
      // they'll be filtered when finalized
      if (interimTranscript) {
        updateCurrentSegment(interimTranscript);
      }

      // When we get a final result, add it as a completed segment
      if (finalTranscript) {
        const trimmedTranscript = finalTranscript.trim();
        
        // Echo detection: check if this transcript matches recent TTS output
        if (isLikelyEcho(trimmedTranscript, ttsBufferRef.current)) {
          // This is our own TTS being picked up by the microphone - ignore it
          updateCurrentSegment(''); // Clear the interim display
          return;
        }
        
        const currentTime = (Date.now() - startTimeRef.current) / 1000;
        segmentCounterRef.current += 1;
        const segmentId = `segment-${segmentCounterRef.current}`;
        
        const segment = {
          id: segmentId,
          text: trimmedTranscript,
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
        sendTextForTranslationRef.current?.(trimmedTranscript, segmentId);
        
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
      // Auto-restart if still supposed to be transcribing and NOT paused
      // Use refs to avoid stale closure issues with state
      if (isActiveRef.current && recognitionRef.current && !isPausedRef.current) {
        console.log('[AudioControls] Speech recognition ended, auto-restarting');
        try {
          recognitionRef.current.start();
        } catch (e) {
          // Ignore errors from rapid start/stop
        }
      } else {
        console.log('[AudioControls] Speech recognition ended, NOT restarting (paused:', isPausedRef.current, ', active:', isActiveRef.current, ')');
      }
    };

    return recognition;
  }, [addSegment, updateCurrentSegment, setStatus, setTranscribing, sendSegmentToBackend, sourceLanguage, cleanupTTSBuffer]);

  const handleStart = async () => {
    setStatus('connecting');
    // DON'T clear segments - allow resuming with existing transcript
    // Only reset timing for new segments
    if (segmentCounterRef.current === 0) {
      startTimeRef.current = Date.now();
    }
    isActiveRef.current = true; // Mark as active for auto-restart logic
    ttsBufferRef.current = []; // Clear echo detection buffer for fresh session

    // Connect to transcription WebSocket for RAG
    console.log('[RAG Debug] Connecting transcription WebSocket...');
    transcriptionSocket.connect();

    // Connect to translation WebSocket for receiving translated audio
    console.log('[RAG Debug] Connecting translation WebSocket...');
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
    console.log('[AudioControls] handleStop called');
    console.trace('[AudioControls] handleStop stack trace:');
    
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
    
    // Clear echo detection buffer
    ttsBufferRef.current = [];
    
    // Disconnect WebSockets
    transcriptionSocket.disconnect();
    translationSocket.disconnect();
    setTranslationConnected(false);
    
    setStatus('ready');
    setTranscribing(false);
    updateCurrentSegment('');
  };

  // Expose stop method to parent via ref
  useImperativeHandle(ref, () => ({
    stop: handleStop,
  }), []);

  // Sync volume with playback
  useEffect(() => {
    audioPlayback.updateVolume(volume);
  }, [volume, audioPlayback]);

  // Store socket refs for cleanup without causing effect re-runs
  const transcriptionSocketRef = useRef(transcriptionSocket);
  const translationSocketRef = useRef(translationSocket);
  
  useEffect(() => { transcriptionSocketRef.current = transcriptionSocket; }, [transcriptionSocket]);
  useEffect(() => { translationSocketRef.current = translationSocket; }, [translationSocket]);

  // Track if component is mounted (helps with React StrictMode double-invoke)
  const isMountedRef = useRef(true);
  
  // Cleanup on unmount only - use refs to avoid effect re-running
  // Note: In React StrictMode (dev mode), this will run twice - component mounts, unmounts, remounts
  // We use a flag to prevent cleanup from running if we're about to remount
  useEffect(() => {
    isMountedRef.current = true;
    console.log('[AudioControls] Mount effect running');
    
    return () => {
      // Use setTimeout to delay cleanup - allows React StrictMode remount to happen first
      // If this is a real unmount (not StrictMode), the cleanup will still happen
      const shouldCleanup = isMountedRef.current;
      isMountedRef.current = false;
      
      console.log('[AudioControls] Cleanup effect running - component unmounting');
      
      // Only cleanup if we were actually active (not just a StrictMode ghost unmount)
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
      audioPlaybackRef.current.stop();
      
      // For WebSockets, we need to be careful in StrictMode
      // Only disconnect if we're really unmounting (user navigated away)
      // Check if the socket was actually connected before trying to disconnect
      if (transcriptionSocketRef.current.isConnected) {
        transcriptionSocketRef.current.disconnect();
      }
      if (translationSocketRef.current.isConnected) {
        translationSocketRef.current.disconnect();
      }
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

      {/* Microphone Status - Click to pause/resume voice input */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                ? (theme) => alpha(theme.palette.warning.main, 0.1)
                : isTranscribing
                  ? (theme) => alpha(theme.palette.success.main, 0.1)
                  : 'transparent',
              '&:hover': isTranscribing ? {
                bgcolor: isPaused
                  ? (theme) => alpha(theme.palette.warning.main, 0.2)
                  : (theme) => alpha(theme.palette.success.main, 0.2),
              } : {},
            }}
          >
            {isPaused ? (
              <MicOffIcon sx={{ fontSize: 20, color: 'warning.main' }} />
            ) : isTranscribing ? (
              <MicIcon sx={{ fontSize: 20, color: 'success.main' }} />
            ) : (
              <MicOffIcon sx={{ fontSize: 20, color: 'text.disabled' }} />
            )}
            <Typography
              variant="caption"
              color={isPaused ? 'warning.main' : (isTranscribing ? 'success.main' : 'text.disabled')}
            >
              {isPaused ? 'Paused' : (isTranscribing ? 'Listening' : 'Idle')}
            </Typography>
          </Box>
        </Tooltip>
      </Box>

      {/* Translation Status - Click to toggle audio output */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                  ? (theme) => alpha(theme.palette.info.main, 0.1)
                  : 'transparent',
              '&:hover': (translationConnected || isMuted) ? {
                bgcolor: isMuted
                  ? (theme) => alpha(theme.palette.text.disabled, 0.1)
                  : (theme) => alpha(theme.palette.info.main, 0.2),
              } : {},
            }}
          >
            <HeadphonesIcon 
              sx={{ 
                fontSize: 20, 
                color: isMuted ? 'text.disabled' : (translationConnected ? 'info.main' : 'text.disabled')
              }} 
            />
            <Typography
              variant="caption"
              color={isMuted ? 'text.disabled' : (translationConnected ? 'info.main' : 'text.disabled')}
            >
              {isMuted ? 'Stopped' : (translationConnected ? 'Translating' : 'Off')}
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
);
