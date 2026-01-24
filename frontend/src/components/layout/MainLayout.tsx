import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';

import { Sidebar } from './Sidebar';
import { useFolderStore, useUserStore, useLanguageStore } from '../../stores';
import { availableLanguages, LanguageCode } from '../../stores/languageStore';
import { customColors } from '../../theme';

const SIDEBAR_WIDTH = 280;

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sidebarWidth = useFolderStore((state) => state.sidebarWidth);
  const navigate = useNavigate();
  const { name, setName } = useUserStore();
  const { language, setLanguage, t } = useLanguageStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(name);

  const handleSaveName = () => {
    if (editedName.trim()) {
      setName(editedName.trim());
    }
    setIsEditingName(false);
  };

  const handleStartEdit = () => {
    setEditedName(name);
    setIsEditingName(true);
  };

  const handleLanguageChange = (lang: LanguageCode) => {
    setLanguage(lang);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          width: sidebarOpen ? `calc(100% - ${sidebarWidth}px)` : '100%',
          ml: sidebarOpen ? `${sidebarWidth}px` : 0,
          transition: 'margin 225ms cubic-bezier(0, 0, 0.2, 1), width 225ms cubic-bezier(0, 0, 0.2, 1)',
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle sidebar"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            edge="start"
            sx={{ mr: 2, color: 'text.primary' }}
          >
            <MenuIcon />
          </IconButton>
          
          {/* Logo */}
          <Box 
            sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            {/* Logo Icon */}
            <Box
              component="img"
              src="/icons/logo/Logo.svg"
              alt="Rosetta"
              sx={{ width: 28, height: 28 }}
            />
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{
                fontFamily: '"Inter", sans-serif',
                fontWeight: 600,
                color: 'text.primary',
                '&:hover': {
                  opacity: 0.8,
                },
              }}
            >
              {t.rosetta}
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Settings Button */}
          <Button
            variant="contained"
            onClick={() => setSettingsOpen(true)}
            startIcon={
              <Box
                component="img"
                src="/icons/material-symbols_settings.svg"
                alt="Settings"
                sx={{ 
                  width: 18, 
                  height: 18,
                  filter: 'brightness(0) invert(1)', // Make SVG white
                }}
              />
            }
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
            {t.settings}
          </Button>

          {/* User Name Section */}
          <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
            {isEditingName ? (
              <TextField
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                size="small"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
                sx={{ width: 120 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={handleSaveName}>
                        <CheckIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.primary',
                    fontWeight: 500,
                  }}
                >
                  {name}
                </Typography>
                <IconButton size="small" onClick={handleStartEdit}>
                  <EditIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </IconButton>
              </Box>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Settings Modal */}
      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t.settings}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
            <Typography variant="body1">
              {t.yourBaseLanguageIs}
            </Typography>
            <Select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as LanguageCode)}
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
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setSettingsOpen(false)}
            variant="contained"
            sx={{
              bgcolor: customColors.brandGreen,
              '&:hover': { bgcolor: '#005F54' },
            }}
          >
            {t.close || 'Close'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sidebar */}
      <Sidebar open={sidebarOpen} width={sidebarWidth} />

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          pt: 10,
          ml: sidebarOpen ? 0 : `-${sidebarWidth}px`,
          width: sidebarOpen ? `calc(100% - ${sidebarWidth}px)` : '100%',
          transition: 'margin 225ms cubic-bezier(0, 0, 0.2, 1), width 225ms cubic-bezier(0, 0, 0.2, 1)',
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
