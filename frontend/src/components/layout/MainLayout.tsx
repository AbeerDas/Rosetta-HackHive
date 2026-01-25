import { useState, useEffect } from 'react';
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
  FormControl,
  InputLabel,
  CircularProgress,
  Divider,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';

import { Sidebar } from './Sidebar';
import { useFolderStore, useUserStore, useLanguageStore, useVoiceStore } from '../../stores';
import { availableLanguages, LanguageCode } from '../../stores/languageStore';
import { customColors } from '../../theme';

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const sidebarWidth = useFolderStore((state) => state.sidebarWidth);
  const navigate = useNavigate();
  const { name, setName } = useUserStore();
  const { language, setLanguage, t } = useLanguageStore();
  const { voices, selectedVoiceId, isLoading: voicesLoading, fetchVoices, setSelectedVoiceId } = useVoiceStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(name);

  const actualSidebarWidth = sidebarOpen ? sidebarWidth : 64;

  // Fetch voices when settings modal opens
  useEffect(() => {
    if (settingsOpen && voices.length === 0) {
      fetchVoices();
    }
  }, [settingsOpen, voices.length, fetchVoices]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio.src = '';
      }
    };
  }, [previewAudio]);

  const handlePreviewVoice = (previewUrl: string | undefined, voiceId: string) => {
    if (!previewUrl) return;
    
    // Stop current preview if any
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.src = '';
    }
    
    if (previewingVoice === voiceId) {
      // Stop if same voice is clicked again
      setPreviewingVoice(null);
      return;
    }
    
    const audio = new Audio(previewUrl);
    audio.onended = () => setPreviewingVoice(null);
    audio.onerror = () => setPreviewingVoice(null);
    audio.play();
    setPreviewAudio(audio);
    setPreviewingVoice(voiceId);
  };

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

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          width: `calc(100% - ${actualSidebarWidth}px)`,
          ml: `${actualSidebarWidth}px`,
          transition: 'margin 225ms cubic-bezier(0, 0, 0.2, 1), width 225ms cubic-bezier(0, 0, 0.2, 1)',
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar>
          {/* Just the text "Rosetta" - no logo here, logo is in sidebar */}
          <Typography
            variant="h6"
            noWrap
            component="div"
            onClick={() => navigate('/')}
            sx={{
              fontFamily: '"Inter", sans-serif',
              fontWeight: 600,
              color: 'text.primary',
              cursor: 'pointer',
              '&:hover': {
                opacity: 0.8,
              },
            }}
          >
            {t.rosetta}
          </Typography>

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

          <Divider sx={{ my: 3 }} />

          {/* Voice Selection */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
              {t.voiceForDictation || 'Voice for Dictation'}
            </Typography>
            
            {voicesLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  {t.loadingVoices || 'Loading voices...'}
                </Typography>
              </Box>
            ) : (
              <FormControl fullWidth size="small">
                <InputLabel id="voice-select-label">{t.selectVoice || 'Select Voice'}</InputLabel>
                <Select
                  labelId="voice-select-label"
                  value={selectedVoiceId || ''}
                  onChange={(e) => setSelectedVoiceId(e.target.value || null)}
                  label={t.selectVoice || 'Select Voice'}
                >
                  <MenuItem value="">
                    <em>{t.defaultVoice || 'Default Voice'}</em>
                  </MenuItem>
                  {voices.map((voice) => (
                    <MenuItem key={voice.voice_id} value={voice.voice_id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <Box>
                          <Typography variant="body2">{voice.name}</Typography>
                          {voice.labels?.accent && (
                            <Typography variant="caption" color="text.secondary">
                              {voice.labels.accent}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Voice Preview */}
            {selectedVoiceId && voices.length > 0 && (
              <Box sx={{ mt: 2 }}>
                {(() => {
                  const selectedVoice = voices.find(v => v.voice_id === selectedVoiceId);
                  if (!selectedVoice?.preview_url) {
                    return (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        {t.noPreviewAvailable || 'No preview available for this voice'}
                      </Typography>
                    );
                  }
                  return (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={previewingVoice === selectedVoiceId ? <StopIcon /> : <PlayArrowIcon />}
                      onClick={() => handlePreviewVoice(selectedVoice.preview_url, selectedVoiceId)}
                      sx={{
                        borderColor: customColors.brandGreen,
                        color: customColors.brandGreen,
                        '&:hover': {
                          borderColor: '#005F54',
                          bgcolor: 'rgba(0, 112, 99, 0.08)',
                        },
                      }}
                    >
                      {previewingVoice === selectedVoiceId 
                        ? (t.stopPreview || 'Stop Preview') 
                        : (t.previewVoice || 'Preview Voice')}
                    </Button>
                  );
                })()}
              </Box>
            )}
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
      <Sidebar open={sidebarOpen} width={sidebarWidth} onToggle={toggleSidebar} />

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          pt: 10,
          ml: 0,
          width: `calc(100% - ${actualSidebarWidth}px)`,
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
