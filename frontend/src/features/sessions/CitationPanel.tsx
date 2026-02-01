import { useRef, useEffect, useMemo } from 'react';
import { Box, Card, CardContent, Typography, Chip, alpha, keyframes } from '@mui/material';
import { useTranscriptionStore, useLanguageStore } from '../../stores';
import { customColors } from '../../theme';
import type { TranscriptSegment } from '../../types';

interface CitationPanelProps {
  sessionId: string;
}

// Generate a unique key for a citation (for deduplication)
export const getCitationKey = (citation: { document_name: string; page_number: number }) =>
  `${citation.document_name}-p${citation.page_number}`;

/**
 * Build a global citation number map from all segments.
 * Citations are numbered in order of first appearance (1, 2, 3, ...).
 * If the same citation (same document + page) appears again, it reuses the same number.
 */
export function buildCitationNumberMap(segments: TranscriptSegment[]): Map<string, number> {
  const numberMap = new Map<string, number>();
  let nextNumber = 1;

  for (const segment of segments) {
    for (const citation of segment.citations) {
      const key = getCitationKey(citation);
      if (!numberMap.has(key)) {
        numberMap.set(key, nextNumber);
        nextNumber++;
      }
    }
  }

  return numberMap;
}

// Pulse animation for highlighted citation
const pulseAnimation = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(0, 126, 112, 0.7); }
  70% { box-shadow: 0 0 0 10px rgba(0, 126, 112, 0); }
  100% { box-shadow: 0 0 0 0 rgba(0, 126, 112, 0); }
`;

export function CitationPanel(_props: CitationPanelProps) {
  const { t } = useLanguageStore();
  const segments = useTranscriptionStore((s) => s.segments);
  const highlightedCitationKey = useTranscriptionStore((s) => s.highlightedCitationKey);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build global citation number map (memoized)
  const citationNumberMap = useMemo(() => buildCitationNumberMap(segments), [segments]);

  // Collect all citations from segments with global numbers
  const allCitations = segments.flatMap((segment) =>
    segment.citations.map((citation) => {
      const key = getCitationKey(citation);
      return {
        ...citation,
        segmentId: segment.id,
        key,
        globalNumber: citationNumberMap.get(key) ?? 0,
      };
    })
  );

  // Deduplicate citations (keep first occurrence)
  const seenKeys = new Set<string>();
  const uniqueCitations = allCitations.filter((citation) => {
    if (seenKeys.has(citation.key)) {
      return false;
    }
    seenKeys.add(citation.key);
    return true;
  });

  // Sort by global number to maintain consistent ordering
  uniqueCitations.sort((a, b) => a.globalNumber - b.globalNumber);

  // Scroll to highlighted citation
  useEffect(() => {
    if (highlightedCitationKey && containerRef.current) {
      const element = containerRef.current.querySelector(
        `[data-citation-key="${highlightedCitationKey}"]`
      );
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightedCitationKey]);

  if (uniqueCitations.length === 0) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
          color: 'text.secondary',
        }}
      >
        {/* Citation Icon from icons folder */}
        <Box
          component="img"
          src="/icons/material-icon-theme_citation.svg"
          alt="Citations"
          sx={{ width: 64, height: 64, mb: 2, opacity: 0.5 }}
        />
        <Typography variant="body2" textAlign="center">
          {t.citationsEmptyMessage}
        </Typography>
      </Box>
    );
  }

  return (
    <Box ref={containerRef} sx={{ flex: 1, overflow: 'auto', p: 2 }}>
      {uniqueCitations.map((citation) => (
        <CitationCard
          key={citation.key}
          citation={citation}
          isHighlighted={highlightedCitationKey === citation.key}
        />
      ))}
    </Box>
  );
}

interface CitationCardProps {
  citation: {
    rank: number;
    document_name: string;
    page_number: number;
    snippet: string;
    key: string;
    globalNumber: number;
  };
  isHighlighted: boolean;
}

function CitationCard({ citation, isHighlighted }: CitationCardProps) {
  const getOpacity = (rank: number, highlighted: boolean) => {
    if (highlighted) return 1;
    switch (rank) {
      case 1:
        return 1;
      case 2:
        return 0.7;
      case 3:
        return 0.5;
      default:
        return 0.5;
    }
  };

  return (
    <Card
      data-citation-key={citation.key}
      sx={{
        mb: 1.5,
        opacity: getOpacity(citation.rank, isHighlighted),
        transition: 'opacity 0.2s, transform 0.2s, box-shadow 0.2s',
        cursor: 'pointer',
        border: '1px solid',
        borderColor: isHighlighted ? customColors.brandGreen : 'divider',
        ...(isHighlighted && {
          animation: `${pulseAnimation} 0.6s ease-out`,
          borderWidth: 2,
        }),
        '&:hover': {
          opacity: 1,
          transform: 'translateX(4px)',
        },
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Chip
            label={citation.globalNumber}
            size="small"
            sx={{
              minWidth: 24,
              height: 24,
              fontSize: '0.75rem',
              fontWeight: 700,
              bgcolor: alpha(customColors.brandGreen, 0.8),
              color: 'white',
            }}
          />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }} noWrap>
            {citation.document_name}
          </Typography>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Page {citation.page_number}
        </Typography>

        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            fontSize: '0.8rem',
            lineHeight: 1.5,
          }}
        >
          "{citation.snippet}"
        </Typography>
      </CardContent>
    </Card>
  );
}
