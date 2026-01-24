import { useRef, useEffect } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import { useTranscriptionStore } from '../../stores/transcriptionStore';

export function TranscriptionPanel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    segments,
    currentSegment,
    autoScroll,
    fontSize,
    highContrast,
  } = useTranscriptionStore();

  // Auto-scroll to bottom when new segments arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments, currentSegment, autoScroll]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Box
      ref={scrollRef}
      sx={{
        flex: 1,
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
          {currentSegment && (
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
  );
}

interface Citation {
  rank: number;
  document_name: string;
  page_number: number;
  snippet: string;
}

function CitationMarkers({ citations }: { citations: Citation[] }) {
  // Sort by rank and map to superscript numbers
  const sortedCitations = [...citations].sort((a, b) => a.rank - b.rank);

  return (
    <Box component="span" sx={{ ml: 0.5 }}>
      {sortedCitations.map((citation, idx) => (
        <Typography
          key={idx}
          component="sup"
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
          title={`${citation.document_name}, p. ${citation.page_number}`}
        >
          {citation.rank}
        </Typography>
      ))}
    </Box>
  );
}
