import { Box, Typography, Button, Card, CardContent, Grid, alpha } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import TranslateIcon from '@mui/icons-material/Translate';
import DescriptionIcon from '@mui/icons-material/Description';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

export function HomePage() {
  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      {/* Hero Section */}
      <Box
        sx={{
          textAlign: 'center',
          py: 8,
          px: 3,
          borderRadius: 4,
          background: (theme) =>
            `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
          border: (theme) => `1px solid ${theme.palette.divider}`,
          mb: 6,
        }}
      >
        <Typography
          variant="h2"
          sx={{
            fontWeight: 700,
            mb: 2,
            background: 'linear-gradient(135deg, #6366F1 0%, #10B981 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Welcome to LectureLens
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}>
          Real-time lecture translation and learning assistant. Break language barriers and focus on learning.
        </Typography>
      </Box>

      {/* Getting Started */}
      <Box
        sx={{
          mt: 8,
          p: 4,
          borderRadius: 3,
          bgcolor: 'background.paper',
          border: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
          Getting Started
        </Typography>
        <Box component="ol" sx={{ pl: 3 }}>
          <Typography component="li" sx={{ mb: 2 }}>
            <strong>Create a folder</strong> for your course (e.g., "CS 401 - Machine Learning")
          </Typography>
          <Typography component="li" sx={{ mb: 2 }}>
            <strong>Start a new session</strong> and select your target language
          </Typography>
          <Typography component="li" sx={{ mb: 2 }}>
            <strong>Upload course materials</strong> (PDF textbooks, notes) for intelligent citations
          </Typography>
          <Typography component="li" sx={{ mb: 2 }}>
            <strong>Begin the lecture</strong> - translation and transcription will start automatically
          </Typography>
          <Typography component="li">
            <strong>Generate notes</strong> when finished, edit as needed, and export to PDF
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

function FeatureCard({ icon, title, description, color }: FeatureCardProps) {
  return (
    <Card
      sx={{
        height: '100%',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: (theme) => `0 12px 24px ${alpha(color, 0.2)}`,
        },
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(color, 0.1),
            color: color,
            mb: 2,
          }}
        >
          {icon}
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </CardContent>
    </Card>
  );
}
