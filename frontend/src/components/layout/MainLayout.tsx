import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Box, AppBar, Toolbar, Typography, IconButton, Tooltip } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SettingsIcon from '@mui/icons-material/Settings';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

import { Sidebar } from './Sidebar';
import { useFolderStore } from '../../stores/folderStore';

const SIDEBAR_WIDTH = 280;

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebarWidth = useFolderStore((state) => state.sidebarWidth);
  const navigate = useNavigate();

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
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle sidebar"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            edge="start"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="h6"
              noWrap
              component="div"
              onClick={() => navigate('/')}
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(135deg, #6366F1 0%, #10B981 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                cursor: 'pointer',
                '&:hover': {
                  opacity: 0.8,
                },
              }}
            >
              LectureLens
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          <Tooltip title="Help">
            <IconButton color="inherit" size="small">
              <HelpOutlineIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings">
            <IconButton color="inherit" size="small">
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

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
