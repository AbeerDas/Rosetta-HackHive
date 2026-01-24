import { Box, Card, CardContent, Typography, Chip, alpha } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import { useTranscriptionStore } from '../../stores/transcriptionStore';

interface CitationPanelProps {
  sessionId: string;
}

export function CitationPanel({ sessionId }: CitationPanelProps) {
  const segments = useTranscriptionStore((s) => s.segments);

  // Collect all citations from segments
  const allCitations = segments.flatMap((segment) =>
    segment.citations.map((citation) => ({
      ...citation,
      segmentId: segment.id,
    }))
  );

  // Group by window/segment for display
  const groupedCitations = allCitations.reduce((acc, citation) => {
    const key = citation.segmentId;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(citation);
    return acc;
  }, {} as Record<string, typeof allCitations>);

  const citationGroups = Object.entries(groupedCitations).reverse(); // Newest first

  if (allCitations.length === 0) {
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
        <DescriptionIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
        <Typography variant="body2" textAlign="center">
          Citations from your course materials will appear here as the lecture progresses
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
      {citationGroups.map(([segmentId, citations]) => (
        <Box key={segmentId} sx={{ mb: 3 }}>
          {citations.map((citation, idx) => (
            <CitationCard key={idx} citation={citation} />
          ))}
        </Box>
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
  };
}

function CitationCard({ citation }: CitationCardProps) {
  const getOpacity = (rank: number) => {
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
      sx={{
        mb: 1.5,
        opacity: getOpacity(citation.rank),
        transition: 'opacity 0.2s, transform 0.2s',
        '&:hover': {
          opacity: 1,
          transform: 'translateX(4px)',
        },
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Chip
            label={citation.rank}
            size="small"
            sx={{
              width: 24,
              height: 24,
              fontSize: '0.75rem',
              fontWeight: 700,
              bgcolor: (theme) =>
                alpha(theme.palette.primary.main, 0.2 + (4 - citation.rank) * 0.2),
              color: 'primary.main',
            }}
          />
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 600, flex: 1 }}
            noWrap
          >
            {citation.document_name}
          </Typography>
        </Box>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mb: 1 }}
        >
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
