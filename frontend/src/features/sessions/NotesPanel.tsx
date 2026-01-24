import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Menu,
  MenuItem,
  Divider,
  IconButton,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { notesApi } from '../../services/api';
import { TipTapEditor } from '../notes/TipTapEditor';

interface NotesPanelProps {
  readonly sessionId: string;
  readonly sessionName: string;
  readonly autoGenerate?: boolean;
}

export function NotesPanel({ sessionId, sessionName, autoGenerate = false }: NotesPanelProps) {
  const queryClient = useQueryClient();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [content, setContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [hasTriggeredGenerate, setHasTriggeredGenerate] = useState(false);

  // Fetch existing note
  const { data: note, isLoading: noteLoading } = useQuery({
    queryKey: ['note', sessionId],
    queryFn: () => notesApi.get(sessionId),
    enabled: !!sessionId,
    retry: false, // Don't retry if note doesn't exist
  });

  // Set content when note is loaded
  useEffect(() => {
    if (note?.content_markdown) {
      setContent(note.content_markdown);
    }
  }, [note]);

  // Generate note mutation
  const generateMutation = useMutation({
    mutationFn: () => notesApi.generate(sessionId),
    onSuccess: (generatedNote) => {
      setContent(generatedNote.content_markdown);
      setHasChanges(false); // Just generated, no unsaved changes yet
      queryClient.invalidateQueries({ queryKey: ['note', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
    },
  });

  // Auto-generate on mount if requested and no note exists
  useEffect(() => {
    if (autoGenerate && !hasTriggeredGenerate && !noteLoading && !note?.content_markdown) {
      setHasTriggeredGenerate(true);
      generateMutation.mutate();
    }
  }, [autoGenerate, hasTriggeredGenerate, noteLoading, note, generateMutation]);

  // Save note mutation
  const saveMutation = useMutation({
    mutationFn: (contentMarkdown: string) => notesApi.update(sessionId, { content_markdown: contentMarkdown }),
    onSuccess: () => {
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['note', sessionId] });
    },
  });

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: () => notesApi.exportPdf(sessionId),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sessionName || 'notes'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
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

  // Show loading state while generating
  if (generateMutation.isPending) {
    return (
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
        <CircularProgress size={48} sx={{ mb: 2 }} />
        <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
          Generating Notes...
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          AI is analyzing your transcript and creating structured notes.
          <br />
          This may take a moment.
        </Typography>
      </Box>
    );
  }

  // Show loading state while fetching existing note
  if (noteLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Toolbar */}
      <Box
        sx={{
          p: 1,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 1,
        }}
      >
        {hasChanges && (
          <Typography variant="caption" color="warning.main" sx={{ mr: 1 }}>
            Unsaved changes
          </Typography>
        )}
        <Button
          size="small"
          variant="contained"
          startIcon={saveMutation.isPending ? <CircularProgress size={14} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={!hasChanges || saveMutation.isPending}
        >
          Save
        </Button>
        <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
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
            Regenerate Notes
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

      {/* Editor or Empty State */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
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
              minHeight: 300,
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
                Generate Notes
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
      </Box>
    </Box>
  );
}
