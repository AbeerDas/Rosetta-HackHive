import { useRef, useEffect, useCallback, useState } from 'react';
import { 
  Box, 
  Typography, 
  alpha, 
  IconButton, 
  Tooltip, 
  Slider, 
  Popover,
  Button,
  Fab,
  Alert,
} from '@mui/material';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useTranscriptionStore } from '../../stores/transcriptionStore';

// Check if browser supports Web Speech API (types declared in AudioControls.tsx)
const isSpeechRecognitionSupported = () => {
  return !!((window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition || 
            (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
};

export function TranscriptionPanel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const [fontSizeAnchor, setFontSizeAnchor] = useState<HTMLButtonElement | null>(null);
  
  const {
    segments,
    currentSegment,
    isTranscribing,
    isPaused,
    autoScroll,
    fontSize,
    highContrast,
    setAutoScroll,
    togglePause,
    setFontSize,
  } = useTranscriptionStore();

  const browserSupported = isSpeechRecognitionSupported();

  // Handle scroll events to toggle auto-scroll per FRD-04
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50; // Within 50px of bottom
    
    // If user scrolled up, disable auto-scroll
    // If user scrolled to bottom, re-enable auto-scroll
    if (!isUserScrollingRef.current) {
      setAutoScroll(isAtBottom);
    }
  }, [setAutoScroll]);

  // Track user-initiated scrolls
  const handleWheel = useCallback(() => {
    isUserScrollingRef.current = true;
    // Reset flag after scroll ends
    setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 150);
  }, []);

  // Auto-scroll to bottom when new segments arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments, currentSegment, autoScroll]);

  const handleJumpToLatest = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setAutoScroll(true);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}>
      {/* Panel Header with Controls per FRD-04 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 1,
          p: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {/* Font Size Control */}
        <Tooltip title="Adjust font size">
          <IconButton 
            size="small" 
            onClick={(e) => setFontSizeAnchor(e.currentTarget)}
          >
            <TextFieldsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Popover
          open={Boolean(fontSizeAnchor)}
          anchorEl={fontSizeAnchor}
          onClose={() => setFontSizeAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Box sx={{ p: 2, width: 200 }}>
            <Typography variant="caption" color="text.secondary">
              Font Size
            </Typography>
            <Slider
              value={fontSize}
              onChange={(_, value) => setFontSize(value as number)}
              min={14}
              max={24}
              step={1}
              valueLabelDisplay="auto"
              size="small"
            />
          </Box>
        </Popover>

        {/* Pause/Resume Transcription */}
        {isTranscribing && (
          <Tooltip title={isPaused ? 'Resume transcription' : 'Pause transcription'}>
            <IconButton size="small" onClick={togglePause}>
              {isPaused ? <PlayArrowIcon fontSize="small" /> : <PauseIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Browser Compatibility Warning per FRD-04 */}
      {!browserSupported && (
        <Alert severity="warning" sx={{ m: 2 }}>
          Live transcription requires Chrome or Edge. Please switch browsers for full functionality.
        </Alert>
      )}

      {/* Transcription Content */}
      <Box
        ref={scrollRef}
        onScroll={handleScroll}
        onWheel={handleWheel}
        sx={{
          flex: 1,
          minHeight: 0, // Required for flexbox scrolling
          overflow: 'auto',
          p: 3,
          bgcolor: highContrast ? 'background.default' : 'transparent',
        }}
      >
        {segments.length === 0 && !currentSegment ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'text.secondary',
            }}
          >
            <Typography variant="body1">
              Transcription will appear here when you start the session
            </Typography>
            <Typography variant="caption" sx={{ mt: 1 }}>
              Make sure your microphone is enabled
            </Typography>
          </Box>
        ) : (
          <Box sx={{ fontSize }}>
            {segments.map((segment, index) => (
              <Box key={segment.id} sx={{ mb: 2 }}>
                {/* Timestamp marker */}
                {(index === 0 || segment.start_time - segments[index - 1].end_time > 10) && (
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      color: 'text.secondary',
                      mb: 1,
                      fontFamily: 'monospace',
                    }}
                  >
                    [{formatTime(segment.start_time)}]
                  </Typography>
                )}

                {/* Segment text with citations */}
                <Typography
                  component="span"
                  sx={{
                    lineHeight: 1.8,
                    color: highContrast ? 'text.primary' : 'text.secondary',
                  }}
                >
                  {segment.text}
                  {segment.citations.length > 0 && (
                    <CitationMarkers citations={segment.citations} />
                  )}
                </Typography>
                {' '}
              </Box>
            ))}

            {/* Current segment being transcribed */}
            {currentSegment && !isPaused && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 1,
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                  border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                }}
              >
                <Typography
                  sx={{
                    lineHeight: 1.8,
                    color: 'primary.main',
                  }}
                >
                  {currentSegment}
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-block',
                      width: 2,
                      height: '1em',
                      bgcolor: 'primary.main',
                      ml: 0.5,
                      animation: 'blink 1s infinite',
                      '@keyframes blink': {
                        '0%, 50%': { opacity: 1 },
                        '51%, 100%': { opacity: 0 },
                      },
                    }}
                  />
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Currently transcribing...
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Jump to Latest FAB per FRD-04 - shows when auto-scroll is disabled */}
      {!autoScroll && segments.length > 0 && (
        <Fab
          size="small"
          color="primary"
          onClick={handleJumpToLatest}
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
          }}
        >
          <KeyboardArrowDownIcon />
        </Fab>
      )}
    </Box>
  );
}

interface Citation {
  rank: number;
  document_name: string;
  page_number: number;
  snippet: string;
}

// Generate same key as CitationPanel for cross-referencing
const getCitationKey = (citation: Citation) => 
  `${citation.document_name}-p${citation.page_number}`;

function CitationMarkers({ citations }: { citations: Citation[] }) {
  const highlightCitation = useTranscriptionStore((s) => s.highlightCitation);
  
  // Sort by rank and map to superscript numbers
  const sortedCitations = [...citations].sort((a, b) => a.rank - b.rank);

  const handleCitationClick = (citation: Citation) => {
    const key = getCitationKey(citation);
    highlightCitation(key);
  };

  return (
    <Box component="span" sx={{ ml: 0.5 }}>
      {sortedCitations.map((citation, idx) => (
        <Tooltip 
          key={idx}
          title={`${citation.document_name}, page ${citation.page_number}`}
          arrow
          enterDelay={200}
        >
          <Typography
            component="sup"
            onClick={() => handleCitationClick(citation)}
            sx={{
              cursor: 'pointer',
              mx: 0.25,
              fontSize: '0.75em',
              fontWeight: 600,
              color: 'primary.main',
              opacity: 1 - (citation.rank - 1) * 0.25, // Rank 1 = 100%, Rank 2 = 75%, Rank 3 = 50%
              '&:hover': {
                color: 'primary.light',
                textDecoration: 'underline',
              },
            }}
          >
            {citation.rank}
          </Typography>
        </Tooltip>
      ))}
    </Box>
  );
}
