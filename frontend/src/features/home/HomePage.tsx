import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActionArea,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  SelectChangeEvent,
  IconButton,
  Menu,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { folderApi, sessionApi } from '../../services/api';
import { useUserStore, useLanguageStore, useFolderStore } from '../../stores';
import { availableLanguages, LanguageCode } from '../../stores/languageStore';
import { customColors } from '../../theme';
import type { Folder, SessionSummary } from '../../types';

// Folder icon paths
const folderIcons = [
  '/icons/folders/BlueFolder.png',
  '/icons/folders/RedFolder.svg',
  '/icons/folders/TurqoiseFolder.svg',
  '/icons/folders/PurpleFolder.png',
];

export function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { name } = useUserStore();
  const { language, setLanguage, t } = useLanguageStore();
  const { selectedFolderId, setSelectedFolderId } = useFolderStore();
  
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderMenuAnchor, setFolderMenuAnchor] = useState<{ el: HTMLElement; folderId: string } | null>(null);
  const [sessionMenuAnchor, setSessionMenuAnchor] = useState<{ el: HTMLElement; sessionId: string } | null>(null);
  const [newSessionDialogOpen, setNewSessionDialogOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionLanguage, setNewSessionLanguage] = useState('zh');

  // Fetch folders
  const { data: folders = [], isLoading } = useQuery({
    queryKey: ['folders'],
    queryFn: folderApi.list,
  });

  // Fetch selected folder details
  const { data: selectedFolder } = useQuery({
    queryKey: ['folder', selectedFolderId],
    queryFn: () => folderApi.get(selectedFolderId!),
    enabled: !!selectedFolderId,
  });

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: (name: string) => folderApi.create({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      setNewFolderDialogOpen(false);
      setNewFolderName('');
    },
  });

  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: (folderId: string) => folderApi.delete(folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      setFolderMenuAnchor(null);
      if (selectedFolderId === folderMenuAnchor?.folderId) {
        setSelectedFolderId(null);
      }
    },
  });

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: ({ folderId, name, targetLanguage }: { folderId: string; name: string; targetLanguage: string }) =>
      sessionApi.create(folderId, { name, target_language: targetLanguage }),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['folder', selectedFolderId] });
      navigate(`/session/${session.id}`);
      setNewSessionDialogOpen(false);
      setNewSessionName('');
    },
  });

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) => sessionApi.delete(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['folder', selectedFolderId] });
      setSessionMenuAnchor(null);
    },
  });

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolderMutation.mutate(newFolderName.trim());
    }
  };

  const handleCreateSession = () => {
    if (newSessionName.trim() && selectedFolderId) {
      createSessionMutation.mutate({
        folderId: selectedFolderId,
        name: newSessionName.trim(),
        targetLanguage: newSessionLanguage,
      });
    }
  };

  const handleLanguageChange = (event: SelectChangeEvent) => {
    setLanguage(event.target.value as LanguageCode);
  };

  const handleFolderClick = (folder: Folder) => {
    setSelectedFolderId(folder.id);
  };

  const handleBackToFolders = () => {
    setSelectedFolderId(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <PlayCircleIcon sx={{ fontSize: 20, color: customColors.brandGreen }} />;
      case 'completed':
        return <CheckCircleIcon sx={{ fontSize: 20, color: customColors.brandGreen }} />;
      default:
        return null;
    }
  };

  // If a folder is selected, show sessions view
  if (selectedFolderId && selectedFolder) {
    const sessions = selectedFolder.sessions || [];

    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', py: 4 }}>
        {/* Welcome Section */}
        <Box
          sx={{
            textAlign: 'center',
            py: 4,
            mb: 2,
          }}
        >
          <Typography
            variant="h1"
            sx={{
              fontWeight: 400,
              color: 'text.primary',
              fontFamily: '"ABeeZee", sans-serif',
              fontSize: '3rem',
            }}
          >
            {t.welcomeBack}, {name}
          </Typography>
        </Box>

        {/* Breadcrumb Header Row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={handleBackToFolders} size="small">
              <ArrowBackIcon />
            </IconButton>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 400,
                color: 'text.secondary',
                cursor: 'pointer',
                '&:hover': { textDecoration: 'underline' },
              }}
              onClick={handleBackToFolders}
            >
              {t.subjects}
            </Typography>
            <Typography variant="h5" sx={{ color: 'text.secondary', mx: 1 }}>
              /
            </Typography>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 500,
                color: 'text.primary',
              }}
            >
              {selectedFolder.name}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {/* Base Language Selector */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary' }}
              >
                {t.yourBaseLanguageIs}
              </Typography>
              <Select
                value={language}
                onChange={handleLanguageChange}
                size="small"
                sx={{ minWidth: 150 }}
              >
                {availableLanguages.map((lang) => (
                  <MenuItem key={lang.code} value={lang.code}>
                    {lang.nativeName}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            {/* Add Session Button */}
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setNewSessionDialogOpen(true)}
              sx={{
                bgcolor: customColors.brandGreen,
                color: 'white',
                textTransform: 'none',
                fontWeight: 500,
                px: 2,
                '&:hover': {
                  bgcolor: '#005F54',
                },
              }}
            >
              {t.startNewSession}
            </Button>
          </Box>
        </Box>

        {/* Sessions List */}
        <Box>
          {sessions.length === 0 ? (
            <Box
              sx={{
                textAlign: 'center',
                py: 8,
                bgcolor: customColors.cardBackground,
                borderRadius: 2,
              }}
            >
              <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                {t.noSessionsYet}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setNewSessionDialogOpen(true)}
                sx={{
                  borderColor: customColors.brandGreen,
                  color: customColors.brandGreen,
                  '&:hover': {
                    borderColor: '#005F54',
                    bgcolor: 'rgba(0, 126, 112, 0.04)',
                  },
                }}
              >
                {t.startNewSession}
              </Button>
            </Box>
          ) : (
            <List disablePadding>
              {sessions.map((session: SessionSummary) => (
                <ListItem
                  key={session.id}
                  disablePadding
                  sx={{ mb: 1.5 }}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSessionMenuAnchor({ el: e.currentTarget, sessionId: session.id });
                      }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  }
                >
                  <ListItemButton
                    onClick={() => navigate(`/session/${session.id}`)}
                    sx={{
                      bgcolor: customColors.cardBackground,
                      borderRadius: 2,
                      py: 2,
                      px: 3,
                      '&:hover': {
                        bgcolor: '#D4EDE8',
                        boxShadow: '0 2px 8px rgba(0, 126, 112, 0.1)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                      {getStatusIcon(session.status)}
                      <ListItemText
                        primary={session.name}
                        primaryTypographyProps={{
                          fontWeight: 500,
                          fontSize: '1.1rem',
                        }}
                      />
                      {session.has_notes && (
                        <Chip
                          label={t.lectureNotes}
                          size="small"
                          sx={{
                            bgcolor: customColors.activePill.background,
                            color: customColors.activePill.text,
                          }}
                        />
                      )}
                      {session.status === 'active' && (
                        <Chip
                          label={t.active}
                          size="small"
                          sx={{
                            bgcolor: customColors.activePill.background,
                            color: customColors.activePill.text,
                          }}
                        />
                      )}
                    </Box>
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Box>

        {/* Session Menu */}
        <Menu
          anchorEl={sessionMenuAnchor?.el}
          open={Boolean(sessionMenuAnchor)}
          onClose={() => setSessionMenuAnchor(null)}
        >
          <MenuItem
            onClick={() => {
              if (sessionMenuAnchor) {
                deleteSessionMutation.mutate(sessionMenuAnchor.sessionId);
              }
            }}
            sx={{ color: 'error.main' }}
          >
            <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
            {t.deleteSession || 'Delete Session'}
          </MenuItem>
        </Menu>

        {/* New Session Dialog */}
        <Dialog open={newSessionDialogOpen} onClose={() => setNewSessionDialogOpen(false)}>
          <DialogTitle>{t.startNewSession}</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label={t.sessionName}
              fullWidth
              variant="outlined"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              placeholder="e.g., Lecture 5 - Neural Networks"
              sx={{ mb: 2 }}
            />
            <TextField
              select
              margin="dense"
              label={t.targetLanguage}
              fullWidth
              variant="outlined"
              value={newSessionLanguage}
              onChange={(e) => setNewSessionLanguage(e.target.value)}
              SelectProps={{ native: true }}
            >
              <option value="zh">{t.chinese}</option>
              <option value="hi">{t.hindi}</option>
              <option value="es">{t.spanish}</option>
              <option value="fr">{t.french}</option>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setNewSessionDialogOpen(false)}>{t.cancel}</Button>
            <Button
              onClick={handleCreateSession}
              variant="contained"
              disabled={!newSessionName.trim() || createSessionMutation.isPending}
              sx={{
                bgcolor: customColors.brandGreen,
                '&:hover': { bgcolor: '#005F54' },
              }}
            >
              {createSessionMutation.isPending ? 'Starting...' : t.startSession}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  // Default view: folder list
  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', py: 2 }}>
      {/* Welcome Section */}
      <Box
        sx={{
          textAlign: 'center',
          py: 4,
          mb: 2,
        }}
      >
        <Typography
          variant="h1"
          sx={{
            fontWeight: 400,
            color: 'text.primary',
            fontFamily: '"ABeeZee", sans-serif',
            fontSize: '3rem',
          }}
        >
          {t.welcomeBack}, {name}
        </Typography>
      </Box>

      {/* Subjects Header Row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: 400,
            color: 'text.primary',
          }}
        >
          {t.subjects}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {/* Base Language Selector */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary' }}
            >
              {t.yourBaseLanguageIs}
            </Typography>
            <Select
              value={language}
              onChange={handleLanguageChange}
              size="small"
              sx={{ minWidth: 150 }}
            >
              {availableLanguages.map((lang) => (
                <MenuItem key={lang.code} value={lang.code}>
                  {lang.nativeName}
                </MenuItem>
              ))}
            </Select>
          </Box>

          {/* Add Folder Button */}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setNewFolderDialogOpen(true)}
            sx={{
              bgcolor: customColors.brandGreen,
              color: 'white',
              textTransform: 'none',
              fontWeight: 500,
              px: 2,
              '&:hover': {
                bgcolor: '#005F54',
              },
            }}
          >
            {t.addFolder}
          </Button>
        </Box>
      </Box>

      {/* Folder Cards Grid */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : folders.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Box
            component="img"
            src="/icons/folders/BlueFolder.png"
            alt="Folder"
            sx={{ width: 64, height: 'auto', mb: 2, opacity: 0.5 }}
          />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
            {t.noFoldersYet}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setNewFolderDialogOpen(true)}
            sx={{
              borderColor: customColors.brandGreen,
              color: customColors.brandGreen,
              '&:hover': {
                borderColor: '#005F54',
                bgcolor: 'rgba(0, 126, 112, 0.04)',
              },
            }}
          >
            {t.createFolder}
          </Button>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 3,
          }}
        >
          {folders.map((folder, index) => (
            <Card
              key={folder.id}
              sx={{
                bgcolor: customColors.cardBackground,
                border: '1px solid',
                borderColor: 'transparent',
                borderRadius: 2,
                position: 'relative',
                '&:hover': {
                  borderColor: customColors.brandGreen,
                  boxShadow: '0 4px 12px rgba(0, 126, 112, 0.1)',
                },
              }}
            >
              <CardActionArea onClick={() => handleFolderClick(folder)}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Box
                        component="img"
                        src={folderIcons[index % folderIcons.length]}
                        alt="Folder"
                        sx={{ width: 40, height: 'auto' }}
                      />
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderMenuAnchor({ el: e.currentTarget, folderId: folder.id });
                      }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 500,
                      color: customColors.brandGreen,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {folder.name}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}

      {/* Folder Menu */}
      <Menu
        anchorEl={folderMenuAnchor?.el}
        open={Boolean(folderMenuAnchor)}
        onClose={() => setFolderMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            if (folderMenuAnchor) {
              deleteFolderMutation.mutate(folderMenuAnchor.folderId);
            }
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
          {t.deleteFolder || 'Delete Folder'}
        </MenuItem>
      </Menu>

      {/* New Folder Dialog */}
      <Dialog 
        open={newFolderDialogOpen} 
        onClose={() => setNewFolderDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t.createNewFolder}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t.folderName}
            fullWidth
            variant="outlined"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="e.g., CS 401 - Machine Learning"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newFolderName.trim()) {
                handleCreateFolder();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewFolderDialogOpen(false)}>
            {t.cancel}
          </Button>
          <Button
            onClick={handleCreateFolder}
            variant="contained"
            disabled={!newFolderName.trim() || createFolderMutation.isPending}
            sx={{
              bgcolor: customColors.brandGreen,
              '&:hover': { bgcolor: '#005F54' },
            }}
          >
            {createFolderMutation.isPending ? 'Creating...' : t.create}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
