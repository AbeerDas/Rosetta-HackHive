import { useCallback, useState } from 'react';
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
  Alert,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CloudIcon from '@mui/icons-material/Cloud';
import { useDropzone } from 'react-dropzone';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';

import { useLanguageStore } from '../../stores';
import { customColors } from '../../theme';
import { documentProcessingApi, isColdStartError } from '../../services/api';
import { useBackendStatus } from '../../contexts/BackendStatusContext';

interface DocumentPanelProps {
  sessionId: string;
}

export function DocumentPanel({ sessionId }: DocumentPanelProps) {
  const { t } = useLanguageStore();
  const [isUploading, setIsUploading] = useState(false);
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [warmupError, setWarmupError] = useState<string | null>(null);
  const { warmup, status: backendStatus } = useBackendStatus();

  // Convex queries and mutations
  const documents = useQuery(
    api.documents.listBySession,
    { sessionId: sessionId as Id<'sessions'> }
  ) ?? [];

  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const saveDocument = useMutation(api.documents.saveDocument);
  const removeDocument = useMutation(api.documents.remove);

  // Mutations
  const getStorageUrl = useMutation(api.documents.getStorageUrl);
  const updateStatus = useMutation(api.documents.updateStatus);

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    let documentId: Id<'documents'> | null = null;
    
    try {
      // Step 1: Get upload URL from Convex
      const uploadUrl = await generateUploadUrl();

      // Step 2: Upload file directly to Convex Storage
      const result = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      
      if (!result.ok) {
        throw new Error('Failed to upload file');
      }

      const { storageId } = await result.json();

      // Step 3: Save document metadata to Convex
      documentId = await saveDocument({
        sessionId: sessionId as Id<'sessions'>,
        storageId,
        name: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });

      // Step 4: Get the storage URL directly
      const fileUrl = await getStorageUrl({ storageId });

      // Step 5: Tell FastAPI backend to process the document for RAG/citations
      if (fileUrl) {
        console.log('[DocumentPanel] Sending document for processing:', {
          document_id: documentId,
          session_id: sessionId,
          file_url: fileUrl,
          file_name: file.name,
        });

        // Update status to processing
        await updateStatus({
          id: documentId,
          status: 'processing',
          processingProgress: 10,
        });

        // Check if backend needs warming up
        if (backendStatus !== 'ready') {
          setIsWarmingUp(true);
          setWarmupError(null);
          try {
            await warmup();
          } catch (e) {
            console.warn('[DocumentPanel] Warmup failed, continuing anyway:', e);
          }
          setIsWarmingUp(false);
        }

        try {
          const processResult = await documentProcessingApi.process(
            documentId,
            fileUrl,
            file.name,
            sessionId
          );
          
          console.log('[DocumentPanel] Document processing complete:', processResult);
          
          // Update Convex with results
          const updates: {
            id: Id<'documents'>;
            status: 'ready' | 'error' | 'processing' | 'pending';
            pageCount?: number;
            chunkCount?: number;
            processingProgress?: number;
            errorMessage?: string;
          } = {
            id: documentId,
            status: processResult.status === 'ready' ? 'ready' : 'error',
            processingProgress: 100,
          };
          
          if (processResult.page_count !== undefined) {
            updates.pageCount = processResult.page_count;
          }
          if (processResult.chunk_count !== undefined) {
            updates.chunkCount = processResult.chunk_count;
          }
          if (processResult.error) {
            updates.errorMessage = processResult.error;
          }
          
          await updateStatus(updates);
        } catch (processError) {
          console.error('[DocumentPanel] Failed to process document:', processError);
          
          // Check if it's a cold start error and provide helpful message
          const errorMessage = isColdStartError(processError)
            ? 'Server is waking up. Please try uploading again in a moment.'
            : processError instanceof Error ? processError.message : 'Failed to process document';
          
          await updateStatus({
            id: documentId,
            status: 'error',
            errorMessage,
          });
          
          if (isColdStartError(processError)) {
            setWarmupError('Server is waking up. Your document was saved but processing failed. Please try again.');
          }
        }
      } else {
        console.warn('[DocumentPanel] Could not get file URL for processing');
        if (documentId) {
          await updateStatus({
            id: documentId,
            status: 'error',
            errorMessage: 'Could not get file URL',
          });
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
      if (documentId) {
        await updateStatus({
          id: documentId,
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Upload failed',
        });
      }
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      acceptedFiles.forEach((file) => {
        if (file.type === 'application/pdf') {
          uploadFile(file);
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId, generateUploadUrl, saveDocument, getStorageUrl, updateStatus]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const handleDelete = async (documentId: Id<'documents'>) => {
    await removeDocument({ id: documentId });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircleIcon sx={{ color: customColors.brandGreen, fontSize: 18 }} />;
      case 'processing':
        return <CircularProgress size={16} sx={{ color: customColors.brandGreen }} />;
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
      {/* Cold Start Warning/Progress */}
      {isWarmingUp && (
        <Box
          sx={{
            m: 2,
            p: 2,
            borderRadius: 2,
            bgcolor: alpha(customColors.brandGreen, 0.1),
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <CloudIcon
            sx={{
              color: customColors.brandGreen,
              animation: 'pulse 2s infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
            }}
          />
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" fontWeight={500}>
              Server is waking up...
            </Typography>
            <Typography variant="caption" color="text.secondary">
              This may take 20-30 seconds on first use
            </Typography>
          </Box>
          <CircularProgress size={20} sx={{ color: customColors.brandGreen }} />
        </Box>
      )}

      {/* Warmup Error Alert */}
      {warmupError && (
        <Alert 
          severity="warning" 
          onClose={() => setWarmupError(null)}
          sx={{ m: 2, mb: 0 }}
        >
          {warmupError}
        </Alert>
      )}

      {/* Upload Area - Light Blue Dashed Border */}
      <Box
        {...getRootProps()}
        sx={{
          m: 2,
          p: 3,
          border: '2px dashed',
          borderColor: isDragActive ? customColors.brandGreen : customColors.dropzoneBorder,
          borderRadius: 2,
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          bgcolor: isDragActive ? alpha(customColors.brandGreen, 0.05) : 'transparent',
          '&:hover': {
            borderColor: customColors.brandGreen,
            bgcolor: alpha(customColors.brandGreen, 0.02),
          },
        }}
      >
        <input {...getInputProps()} />
        {/* Upload Icon */}
        <Box
          component="img"
          src="/icons/Upload icon.svg"
          alt="Upload"
          sx={{ width: 40, height: 40, mb: 1.5, opacity: 0.7 }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {t.dragDropFiles}{' '}
          <Typography component="span" sx={{ color: customColors.brandGreen, fontWeight: 500 }}>
            {t.browse}
          </Typography>
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {t.supportedFormats}
        </Typography>
      </Box>

      {/* Document List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {documents.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {t.noDocumentsYet}
            </Typography>
            <Typography variant="caption" color="text.disabled">
              {t.uploadMaterials}
            </Typography>
          </Box>
        ) : (
          <List dense sx={{ px: 1 }}>
            {documents.map((doc) => (
              <ListItem
                key={doc._id}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                }}
                secondaryAction={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Tooltip title="Delete">
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => handleDelete(doc._id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{getStatusIcon(doc.status)}</ListItemIcon>
                <ListItemText
                  primary={doc.name}
                  secondary={
                    <Box component="span">
                      {doc.status === 'processing' ? (
                        <>
                          {t.processing} {doc.processingProgress}%
                          <LinearProgress
                            variant="determinate"
                            value={doc.processingProgress}
                            sx={{
                              mt: 0.5,
                              height: 2,
                              borderRadius: 1,
                              bgcolor: alpha(customColors.brandGreen, 0.1),
                              '& .MuiLinearProgress-bar': {
                                bgcolor: customColors.brandGreen,
                              },
                            }}
                          />
                        </>
                      ) : doc.status === 'error' ? (
                        <Typography variant="caption" color="error">
                          {doc.errorMessage || 'Processing failed'}
                        </Typography>
                      ) : (
                        `${doc.pageCount ?? 0} pages · ${formatFileSize(doc.fileSize)}`
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
      {isUploading && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            Uploading...
          </Typography>
          <LinearProgress
            sx={{
              mt: 1,
              bgcolor: alpha(customColors.brandGreen, 0.1),
              '& .MuiLinearProgress-bar': {
                bgcolor: customColors.brandGreen,
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
}
