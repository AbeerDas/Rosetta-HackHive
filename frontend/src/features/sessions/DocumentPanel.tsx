import { useCallback } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  LinearProgress,
  Tooltip,
  CircularProgress,
  alpha,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { documentApi } from '../../services/api';
import type { Document } from '../../types';

interface DocumentPanelProps {
  sessionId: string;
  documents: Document[];
}

export function DocumentPanel({ sessionId, documents }: DocumentPanelProps) {
  const queryClient = useQueryClient();

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: (file: File) => documentApi.upload(sessionId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', sessionId] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => documentApi.delete(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', sessionId] });
    },
  });

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: (documentId: string) => documentApi.retry(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', sessionId] });
    },
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      acceptedFiles.forEach((file) => {
        if (file.type === 'application/pdf') {
          uploadMutation.mutate(file);
        }
      });
    },
    [uploadMutation]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircleIcon sx={{ color: 'success.main', fontSize: 18 }} />;
      case 'processing':
        return <CircularProgress size={16} />;
      case 'error':
        return <ErrorIcon sx={{ color: 'error.main', fontSize: 18 }} />;
      default:
        return <PictureAsPdfIcon sx={{ color: 'text.secondary', fontSize: 18 }} />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Upload Area */}
      <Box
        {...getRootProps()}
        sx={{
          m: 2,
          p: 2,
          border: (theme) =>
            `2px dashed ${isDragActive ? theme.palette.primary.main : theme.palette.divider}`,
          borderRadius: 2,
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          bgcolor: isDragActive ? (theme) => alpha(theme.palette.primary.main, 0.1) : 'transparent',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
          },
        }}
      >
        <input {...getInputProps()} />
        <CloudUploadIcon sx={{ fontSize: 32, color: 'text.secondary', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          {isDragActive ? 'Drop PDF here' : 'Drop PDF files or click to browse'}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          Max 50 MB per file
        </Typography>
      </Box>

      {/* Document List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {documents.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
            <Typography variant="body2" color="text.secondary">
              No documents uploaded yet
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Upload course materials for smart citations
            </Typography>
          </Box>
        ) : (
          <List dense sx={{ px: 1 }}>
            {documents.map((doc) => (
              <ListItem
                key={doc.id}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                }}
                secondaryAction={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {doc.status === 'error' && (
                      <Tooltip title="Retry processing">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => retryMutation.mutate(doc.id)}
                          disabled={retryMutation.isPending}
                        >
                          <RefreshIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Delete">
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => deleteMutation.mutate(doc.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {getStatusIcon(doc.status)}
                </ListItemIcon>
                <ListItemText
                  primary={doc.name}
                  secondary={
                    <Box component="span">
                      {doc.status === 'processing' ? (
                        <>
                          Processing... {doc.processing_progress}%
                          <LinearProgress
                            variant="determinate"
                            value={doc.processing_progress}
                            sx={{ mt: 0.5, height: 2, borderRadius: 1 }}
                          />
                        </>
                      ) : doc.status === 'error' ? (
                        <Typography variant="caption" color="error">
                          {doc.error_message || 'Processing failed'}
                        </Typography>
                      ) : (
                        `${doc.page_count} pages · ${formatFileSize(doc.file_size)}`
                      )}
                    </Box>
                  }
                  primaryTypographyProps={{
                    variant: 'body2',
                    noWrap: true,
                    sx: { maxWidth: 150 },
                  }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* Upload Progress */}
      {uploadMutation.isPending && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            Uploading...
          </Typography>
          <LinearProgress sx={{ mt: 1 }} />
        </Box>
      )}
    </Box>
  );
}
