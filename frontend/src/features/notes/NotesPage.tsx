import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  CircularProgress,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { notesApi, sessionApi } from '../../services/api';
import { TipTapEditor } from './TipTapEditor';

export function NotesPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [content, setContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch session details
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => sessionApi.get(sessionId!),
    enabled: !!sessionId,
  });

  // Fetch existing note
  const { data: note, isLoading: noteLoading } = useQuery({
    queryKey: ['note', sessionId],
    queryFn: () => notesApi.get(sessionId!),
    enabled: !!sessionId,
  });

  // Set content when note is loaded
  useEffect(() => {
    if (note?.content_markdown) {
      setContent(note.content_markdown);
    }
  }, [note]);

  // Generate note mutation
  const generateMutation = useMutation({
    mutationFn: () => notesApi.generate(sessionId!),
    onSuccess: (generatedNote) => {
      setContent(generatedNote.content_markdown);
      setHasChanges(true);
      queryClient.invalidateQueries({ queryKey: ['note', sessionId] });
    },
  });

  // Save note mutation
  const saveMutation = useMutation({
    mutationFn: (contentMarkdown: string) => notesApi.update(sessionId!, { content_markdown: contentMarkdown }),
    onSuccess: () => {
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['note', sessionId] });
    },
  });

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: () => notesApi.exportPdf(sessionId!),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${session?.name || 'notes'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(content);
  };

  const handleExport = () => {
    exportMutation.mutate();
    setAnchorEl(null);
  };

  const handleGenerate = () => {
    generateMutation.mutate();
    setAnchorEl(null);
  };

  const isLoading = sessionLoading || noteLoading;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!session) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h5" color="text.secondary">
          Session not found
        </Typography>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mt: 2 }}
        >
          Go Back
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
      {/* Header */}
      <Paper
        sx={{
          p: 2,
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate(`/session/${sessionId}`)}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {session.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Lecture Notes
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {hasChanges && (
            <Typography variant="caption" color="warning.main" sx={{ mr: 1 }}>
              Unsaved changes
            </Typography>
          )}
          <Button
            variant="contained"
            startIcon={saveMutation.isPending ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
          >
            Save
          </Button>
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <MoreVertIcon />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            <MenuItem
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
            >
              <AutoAwesomeIcon sx={{ mr: 1, fontSize: 20 }} />
              {generateMutation.isPending ? 'Generating...' : 'Generate from Transcripts'}
            </MenuItem>
            <Divider />
            <MenuItem
              onClick={handleExport}
              disabled={!content || exportMutation.isPending}
            >
              <DownloadIcon sx={{ mr: 1, fontSize: 20 }} />
              {exportMutation.isPending ? 'Exporting...' : 'Export as PDF'}
            </MenuItem>
          </Menu>
        </Box>
      </Paper>

      {/* Editor */}
      <Paper
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {content ? (
          <TipTapEditor content={content} onChange={handleContentChange} />
        ) : (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              p: 4,
            }}
          >
            <AutoAwesomeIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              No notes yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
              Generate notes automatically from your lecture transcripts,
              <br />
              or start writing from scratch.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<AutoAwesomeIcon />}
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? 'Generating...' : 'Generate Notes'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => setContent('<p>Start writing your notes here...</p>')}
              >
                Start from Scratch
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
