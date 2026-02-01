import { useState, useEffect, ReactNode } from 'react';
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
  CircularProgress,
  Menu,
  MenuItem,
} from '@mui/material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import DescriptionIcon from '@mui/icons-material/Description';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import { useQuery as useConvexQuery, useMutation as useConvexMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Doc } from '../../../convex/_generated/dataModel';
import { useFolderStore, useLanguageStore, type Translations } from '../../stores';
import { customColors } from '../../theme';

// Folder icon paths
const folderIcons = [
  '/icons/folders/BlueFolder.png',
  '/icons/folders/RedFolder.svg',
  '/icons/folders/TurqoiseFolder.svg',
  '/icons/folders/PurpleFolder.png',
];

interface SidebarProps {
  open: boolean;
  width: number;
  onToggle?: () => void;
}

export function Sidebar({ open, width, onToggle }: SidebarProps) {
  const navigate = useNavigate();
  const { t } = useLanguageStore();
  const [isLogoHovered, setIsLogoHovered] = useState(false);

  const { selectedFolderId, setSelectedFolderId, expandedFolderIds, toggleFolderExpanded } =
    useFolderStore();

  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newSessionDialogOpen, setNewSessionDialogOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionLanguage, setNewSessionLanguage] = useState('zh');
  const [folderMenuAnchor, setFolderMenuAnchor] = useState<{
    el: HTMLElement;
    folderId: string;
  } | null>(null);

  // Reset hover state when sidebar open/close state changes
  useEffect(() => {
    setIsLogoHovered(false);
  }, [open]);

  // Fetch folders
  const folders = useConvexQuery(api.folders.list) ?? [];
  const isLoading = folders === undefined;

  // Create folder mutation
  const createFolder = useConvexMutation(api.folders.create);
  const createFolderMutation = {
    mutate: async (name: string) => {
      await createFolder({ name });
      setNewFolderDialogOpen(false);
      setNewFolderName('');
    },
    isPending: false,
  };

  // Delete folder mutation
  const deleteFolder = useConvexMutation(api.folders.remove);
  const deleteFolderMutation = {
    mutate: async (folderId: string) => {
      await deleteFolder({ id: folderId as any }); // Changed from folderId to id
      setFolderMenuAnchor(null);
      if (selectedFolderId === folderMenuAnchor?.folderId) {
        setSelectedFolderId(null);
      }
    },
  };

  // Create session mutation
  const createSession = useConvexMutation(api.sessions.create);
  const createSessionMutation = {
    mutate: async ({
      folderId,
      name,
      targetLanguage,
    }: {
      folderId: string;
      name: string;
      targetLanguage: string;
    }) => {
      const sessionId = await createSession({ 
        folderId: folderId as any, 
        name, 
        sourceLanguage: 'en', // Default source language
        targetLanguage 
      });
      navigate(`/session/${sessionId}`);
      setNewSessionDialogOpen(false);
      setNewSessionName('');
    },
    isPending: false,
  };

  const handleFolderClick = (folder: Doc<"folders">) => {
    setSelectedFolderId(folder._id);
    toggleFolderExpanded(folder._id);
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
      variant="permanent"
      anchor="left"
      sx={{
        width: open ? width : 64,
        flexShrink: 0,
        transition: 'width 225ms cubic-bezier(0, 0, 0.2, 1)',
        '& .MuiDrawer-paper': {
          width: open ? width : 64,
          boxSizing: 'border-box',
          transition: 'width 225ms cubic-bezier(0, 0, 0.2, 1)',
          overflowX: 'hidden',
        },
      }}
    >
      {/* Logo Header - at top of sidebar */}
      {open ? (
        // Open state: Logo on left, close button on right
        <Box
          sx={{
            p: 2,
            pt: 2.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 64,
          }}
        >
          <Box
            component="img"
            src="/icons/logo/Logo.svg"
            alt="Rosetta"
            onClick={() => navigate('/')}
            sx={{
              width: 24,
              height: 24,
              cursor: 'pointer',
              '&:hover': {
                opacity: 0.8,
              },
            }}
          />
          <IconButton
            onClick={onToggle}
            size="small"
            sx={{
              '&:hover': {
                bgcolor: 'rgba(0, 126, 112, 0.08)',
              },
            }}
          >
            <Box
              component="img"
              src="/icons/material-symbols_left-panel-close.svg"
              alt="Close Panel"
              sx={{ width: 20, height: 20 }}
            />
          </IconButton>
        </Box>
      ) : (
        // Closed state: Just logo with hover to show open icon
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 64,
          }}
        >
          <IconButton
            onClick={onToggle}
            onMouseEnter={() => setIsLogoHovered(true)}
            onMouseLeave={() => setIsLogoHovered(false)}
            sx={{
              p: 1.5,
              '&:hover': {
                bgcolor: 'rgba(0, 126, 112, 0.08)',
              },
            }}
          >
            {isLogoHovered ? (
              <Box
                component="img"
                src="/icons/material-symbols_left-panel-open.svg"
                alt="Open Panel"
                sx={{ width: 24, height: 24 }}
              />
            ) : (
              <Box
                component="img"
                src="/icons/logo/Logo.svg"
                alt="Rosetta"
                sx={{ width: 24, height: 24 }}
              />
            )}
          </IconButton>
        </Box>
      )}

      {/* Sidebar content - only show when open */}
      {open && (
        <Box sx={{ p: 2 }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}
          >
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}
            >
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
              <Box
                component="img"
                src="/icons/folders/BlueFolder.png"
                alt="Folder"
                sx={{ width: 48, height: 'auto', mb: 1, opacity: 0.5 }}
              />
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
              {folders.map((folder, index) => (
                <FolderItem
                  key={folder._id}
                  folder={folder}
                  folderIndex={index}
                  isSelected={selectedFolderId === folder._id}
                  isExpanded={expandedFolderIds.has(folder._id)}
                  onClick={() => handleFolderClick(folder)}
                  onSessionClick={(sessionId) => navigate(`/session/${sessionId}`)}
                  onNewSession={() => {
                    setSelectedFolderId(folder._id);
                    setNewSessionDialogOpen(true);
                  }}
                  onMenuClick={(el) => setFolderMenuAnchor({ el, folderId: folder._id })}
                  getStatusIcon={getStatusIcon}
                  t={t}
                />
              ))}
            </List>
          )}
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
  folder: Doc<"folders">;
  folderIndex: number;
  isSelected: boolean;
  isExpanded: boolean;
  onClick: () => void;
  onSessionClick: (sessionId: string) => void;
  onNewSession: () => void;
  onMenuClick: (el: HTMLElement) => void;
  getStatusIcon: (status: string) => ReactNode;
  t: Translations;
}

function FolderItem({
  folder,
  folderIndex,
  isSelected,
  isExpanded,
  onClick,
  onSessionClick,
  onNewSession,
  onMenuClick,
  getStatusIcon,
  t,
}: FolderItemProps) {
  // Fetch folder sessions when expanded
  const sessions = useConvexQuery(
    api.sessions.listByFolder,
    isExpanded ? { folderId: folder._id } : 'skip'
  ) ?? [];

  return (
    <>
      <ListItem
        disablePadding
        secondaryAction={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title={t.startNewSession}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onNewSession();
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onMenuClick(e.currentTarget);
              }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            </IconButton>
          </Box>
        }
      >
        <ListItemButton selected={isSelected} onClick={onClick} sx={{ pr: 12 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <Box
              component="img"
              src={folderIcons[folderIndex % folderIcons.length]}
              alt="Folder"
              sx={{ width: 24, height: 'auto' }}
            />
          </ListItemIcon>
          <ListItemText
            primary={folder.name}
            primaryTypographyProps={{ noWrap: true, fontWeight: isSelected ? 600 : 400 }}
            secondaryTypographyProps={{ variant: 'caption' }}
          />
        </ListItemButton>
      </ListItem>

      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <List dense disablePadding sx={{ pl: 2 }}>
          {sessions.length === 0 ? (
            <ListItem>
              <ListItemText
                primary={t.noSessionsYet || 'No sessions yet'}
                primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
              />
            </ListItem>
          ) : (
            sessions.map((session) => (
              <ListItemButton
                key={session._id}
                sx={{ py: 0.5, borderRadius: 1 }}
                onClick={() => onSessionClick(session._id)}
              >
                <ListItemIcon sx={{ minWidth: 28 }}>{getStatusIcon(session.status)}</ListItemIcon>
                <ListItemText
                  primary={session.name}
                  primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                />
              </ListItemButton>
            ))
          )}
        </List>
      </Collapse>
    </>
  );
}
