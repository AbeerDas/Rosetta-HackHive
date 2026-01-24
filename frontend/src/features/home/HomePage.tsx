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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FolderIcon from '@mui/icons-material/Folder';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { folderApi } from '../../services/api';
import { useUserStore, useLanguageStore, useFolderStore } from '../../stores';
import { availableLanguages, LanguageCode } from '../../stores/languageStore';
import { customColors } from '../../theme';
import type { Folder } from '../../types';

export function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { name } = useUserStore();
  const { language, setLanguage, t } = useLanguageStore();
  const { setSelectedFolderId, setFolderExpanded } = useFolderStore();
  
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

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

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolderMutation.mutate(newFolderName.trim());
    }
  };

  const handleLanguageChange = (event: SelectChangeEvent) => {
    setLanguage(event.target.value as LanguageCode);
  };

  const handleFolderClick = (folder: Folder) => {
    setSelectedFolderId(folder.id);
    setFolderExpanded(folder.id, true);
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', py: 4 }}>
      {/* Welcome Section */}
      <Box
        sx={{
          textAlign: 'center',
          py: 8,
          mb: 6,
        }}
      >
        <Typography
          variant="h2"
          sx={{
            fontWeight: 400,
            color: 'text.primary',
            fontFamily: '"ABeeZee", sans-serif',
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
          mb: 4,
          pb: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
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
              {t.yourBaseLanguage}
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
          <FolderIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
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
          {folders.map((folder) => (
            <Card
              key={folder.id}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': {
                  borderColor: customColors.brandGreen,
                  boxShadow: '0 4px 12px rgba(0, 126, 112, 0.1)',
                },
              }}
            >
              <CardActionArea onClick={() => handleFolderClick(folder)}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <FolderIcon sx={{ fontSize: 32, color: customColors.brandGreen }} />
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {folder.name}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {folder.session_count} {t.sessions}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}

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
