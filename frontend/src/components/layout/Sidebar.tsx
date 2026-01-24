import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  IconButton,
  Typography,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Chip,
  CircularProgress,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import DescriptionIcon from '@mui/icons-material/Description';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { folderApi, sessionApi } from '../../services/api';
import { useFolderStore, useLanguageStore } from '../../stores';
import { customColors } from '../../theme';
import type { Folder, SessionSummary } from '../../types';

interface SidebarProps {
  open: boolean;
  width: number;
}

export function Sidebar({ open, width }: SidebarProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLanguageStore();
  
  const {
    selectedFolderId,
    setSelectedFolderId,
    expandedFolderIds,
    toggleFolderExpanded,
  } = useFolderStore();

  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newSessionDialogOpen, setNewSessionDialogOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionLanguage, setNewSessionLanguage] = useState('zh');

  // Fetch folders
  const { data: folders = [], isLoading } = useQuery({
    queryKey: ['folders'],
    queryFn: folderApi.list,
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

  const handleFolderClick = (folder: Folder) => {
    setSelectedFolderId(folder.id);
    toggleFolderExpanded(folder.id);
  };

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <PlayCircleIcon sx={{ fontSize: 16, color: customColors.brandGreen }} />;
      case 'completed':
        return <CheckCircleIcon sx={{ fontSize: 16, color: customColors.brandGreen }} />;
      default:
        return <DescriptionIcon sx={{ fontSize: 16, color: 'text.secondary' }} />;
    }
  };

  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={open}
      sx={{
        width: width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: width,
          boxSizing: 'border-box',
          pt: 8,
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {t.subjects}
          </Typography>
          <Tooltip title={t.addFolder}>
            <IconButton size="small" onClick={() => setNewFolderDialogOpen(true)}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} sx={{ color: customColors.brandGreen }} />
          </Box>
        ) : folders.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <FolderIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              {t.noFoldersYet}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setNewFolderDialogOpen(true)}
              sx={{ 
                mt: 2,
                borderColor: customColors.brandGreen,
                color: customColors.brandGreen,
                '&:hover': {
                  borderColor: '#005F54',
                },
              }}
            >
              {t.createFolder}
            </Button>
          </Box>
        ) : (
          <List dense disablePadding>
            {folders.map((folder) => (
              <FolderItem
                key={folder.id}
                folder={folder}
                isSelected={selectedFolderId === folder.id}
                isExpanded={expandedFolderIds.has(folder.id)}
                onClick={() => handleFolderClick(folder)}
                onSessionClick={(sessionId) => navigate(`/session/${sessionId}`)}
                onNewSession={() => {
                  setSelectedFolderId(folder.id);
                  setNewSessionDialogOpen(true);
                }}
                getStatusIcon={getStatusIcon}
                t={t}
              />
            ))}
          </List>
        )}
      </Box>

      {/* New Folder Dialog */}
      <Dialog open={newFolderDialogOpen} onClose={() => setNewFolderDialogOpen(false)}>
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
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewFolderDialogOpen(false)}>{t.cancel}</Button>
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
            <option value="bn">{t.bengali}</option>
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
    </Drawer>
  );
}

// Folder Item Component
interface FolderItemProps {
  folder: Folder;
  isSelected: boolean;
  isExpanded: boolean;
  onClick: () => void;
  onSessionClick: (sessionId: string) => void;
  onNewSession: () => void;
  getStatusIcon: (status: string) => React.ReactNode;
  t: any;
}

function FolderItem({
  folder,
  isSelected,
  isExpanded,
  onClick,
  onSessionClick,
  onNewSession,
  getStatusIcon,
  t,
}: FolderItemProps) {
  // Fetch folder details when expanded
  const { data: folderDetail } = useQuery({
    queryKey: ['folder', folder.id],
    queryFn: () => folderApi.get(folder.id),
    enabled: isExpanded,
  });

  const sessions = folderDetail?.sessions || [];

  return (
    <>
      <ListItem disablePadding secondaryAction={
        isExpanded && (
          <Tooltip title={t.startNewSession}>
            <IconButton edge="end" size="small" onClick={(e) => { e.stopPropagation(); onNewSession(); }}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )
      }>
        <ListItemButton selected={isSelected} onClick={onClick}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            {isExpanded ? (
              <FolderOpenIcon sx={{ color: customColors.brandGreen }} />
            ) : (
              <FolderIcon color="action" />
            )}
          </ListItemIcon>
          <ListItemText
            primary={folder.name}
            secondary={`${folder.session_count} ${t.sessions}`}
            primaryTypographyProps={{ noWrap: true, fontWeight: isSelected ? 600 : 400 }}
            secondaryTypographyProps={{ variant: 'caption' }}
          />
          {isExpanded ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>
      </ListItem>

      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <List dense disablePadding sx={{ pl: 2 }}>
          {sessions.length === 0 ? (
            <ListItem>
              <ListItemText
                primary="No sessions yet"
                primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
              />
            </ListItem>
          ) : (
            sessions.map((session: SessionSummary) => (
              <ListItemButton
                key={session.id}
                sx={{ py: 0.5, borderRadius: 1 }}
                onClick={() => onSessionClick(session.id)}
              >
                <ListItemIcon sx={{ minWidth: 28 }}>
                  {getStatusIcon(session.status)}
                </ListItemIcon>
                <ListItemText
                  primary={session.name}
                  primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                />
                {session.has_notes && (
                  <Chip 
                    label="Notes" 
                    size="small" 
                    sx={{ 
                      height: 20, 
                      fontSize: '0.65rem',
                      bgcolor: customColors.activePill.background,
                      color: customColors.activePill.text,
                    }} 
                  />
                )}
              </ListItemButton>
            ))
          )}
        </List>
      </Collapse>
    </>
  );
}
