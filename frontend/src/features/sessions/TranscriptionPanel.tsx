import { useRef, useEffect, useCallback, useMemo } from 'react';
import { Box, Typography, alpha, Fab, Alert, CircularProgress, Tooltip } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useQuery } from '@tanstack/react-query';
import { useTranscriptionStore, useLanguageStore } from '../../stores';
import { transcriptApi } from '../../services/api';
import type { TranscriptSegment } from '../../types';
import { customColors } from '../../theme';
import { getCitationKey, buildCitationNumberMap } from './CitationPanel';

// Check if browser supports Web Speech API
const isSpeechRecognitionSupported = () => {
  return !!(
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  );
};

interface TranscriptionPanelProps {
  sessionId: string;
  isActive: boolean;
}

export function TranscriptionPanel({ sessionId, isActive }: TranscriptionPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const { t } = useLanguageStore();

  const {
    segments: liveSegments,
    currentSegment,
    isTranscribing,
    isPaused,
    autoScroll,
    fontSize,
    highContrast,
    setAutoScroll,
  } = useTranscriptionStore();

  // For ended sessions: fetch from database
  const { data: savedTranscript, isLoading: isLoadingTranscript } = useQuery({
    queryKey: ['transcript', sessionId],
    queryFn: () => transcriptApi.get(sessionId),
    enabled: !isActive,
  });

  const segments: TranscriptSegment[] = isActive
    ? liveSegments
    : ((savedTranscript?.segments ?? []) as TranscriptSegment[]);

  // Build global citation number map (memoized)
  const citationNumberMap = useMemo(() => buildCitationNumberMap(segments), [segments]);

  const browserSupported = isSpeechRecognitionSupported();

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    if (!isUserScrollingRef.current) {
      setAutoScroll(isAtBottom);
    }
  }, [setAutoScroll]);

  const handleWheel = useCallback(() => {
    isUserScrollingRef.current = true;
    setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 150);
  }, []);

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
    <Box
      sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}
    >
      {/* Browser Compatibility Warning */}
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
          minHeight: 0,
          overflow: 'auto',
          p: 4,
          px: 8, // Significant lateral padding for "document" feel
          bgcolor: highContrast ? 'background.default' : 'transparent',
        }}
      >
        {/* Loading state for ended sessions */}
        {!isActive && isLoadingTranscript ? (
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
            <CircularProgress size={32} sx={{ mb: 2 }} />
            <Typography variant="body1">{t.loadingTranscript}</Typography>
          </Box>
        ) : segments.length === 0 && !currentSegment ? (
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
              {isActive ? t.transcriptionWillAppear : t.noTranscriptAvailable}
            </Typography>
            {isActive && (
              <Typography variant="caption" sx={{ mt: 1 }}>
                {t.enableMicrophone}
              </Typography>
            )}
          </Box>
        ) : (
          <Box sx={{ fontSize, maxWidth: 800, mx: 'auto' }}>
            {segments.map((segment, index) => (
              <Box
                key={`${sessionId}-seg-${index}-${segment.start_time}-${segment.id || index}`}
                sx={{ mb: 3 }}
              >
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
                {/* Segment text with citations - prefer translated_text if available */}
                <Typography
                  component="span"
                  sx={{
                    lineHeight: 2, // Increased line-height for better readability
                    color: 'text.primary',
                    fontSize: '1rem',
                  }}
                >
                  {segment.translated_text || segment.text}
                  {segment.citations.length > 0 && (
                    <CitationMarkers
                      citations={segment.citations}
                      citationNumberMap={citationNumberMap}
                    />
                  )}
                </Typography>{' '}
              </Box>
            ))}

            {/* Current segment being transcribed */}
            {currentSegment && !isPaused && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 1,
                  bgcolor: alpha(customColors.brandGreen, 0.1),
                  border: `1px solid ${alpha(customColors.brandGreen, 0.3)}`,
                }}
              >
                <Typography
                  sx={{
                    lineHeight: 2,
                    color: customColors.brandGreen,
                  }}
                >
                  {currentSegment}
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-block',
                      width: 2,
                      height: '1em',
                      bgcolor: customColors.brandGreen,
                      ml: 0.5,
                      animation: 'blink 1s infinite',
                      '@keyframes blink': {
                        '0%, 50%': { opacity: 1 },
                        '51%, 100%': { opacity: 0 },
                      },
                    }}
                  />
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 1, display: 'block' }}
                >
                  {t.transcribing}...
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Jump to Latest FAB */}
      {!autoScroll && segments.length > 0 && (
        <Fab
          size="small"
          onClick={handleJumpToLatest}
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            bgcolor: customColors.brandGreen,
            color: 'white',
            '&:hover': {
              bgcolor: '#005F54',
            },
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

function CitationMarkers({
  citations,
  citationNumberMap,
}: {
  citations: Citation[];
  citationNumberMap: Map<string, number>;
}) {
  const highlightCitation = useTranscriptionStore((s) => s.highlightCitation);

  // Sort by global number for consistent display
  const citationsWithNumbers = citations.map((citation) => ({
    ...citation,
    globalNumber: citationNumberMap.get(getCitationKey(citation)) ?? 0,
  }));

  // Deduplicate citations within this segment (same doc+page should only show once)
  const seenNumbers = new Set<number>();
  const uniqueCitations = citationsWithNumbers.filter((citation) => {
    if (seenNumbers.has(citation.globalNumber)) {
      return false;
    }
    seenNumbers.add(citation.globalNumber);
    return true;
  });

  // Sort by global number
  uniqueCitations.sort((a, b) => a.globalNumber - b.globalNumber);

  const handleCitationClick = (citation: Citation) => {
    const key = getCitationKey(citation);
    highlightCitation(key);
  };

  return (
    <Box component="span" sx={{ ml: 0.5 }}>
      {uniqueCitations.map((citation) => (
        <Tooltip
          key={citation.globalNumber}
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
              color: customColors.brandGreen,
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
          >
            {citation.globalNumber}
          </Typography>
        </Tooltip>
      ))}
    </Box>
  );
}
