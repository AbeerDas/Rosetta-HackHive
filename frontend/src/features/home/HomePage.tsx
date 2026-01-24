import { Box, Typography, alpha } from '@mui/material';

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
