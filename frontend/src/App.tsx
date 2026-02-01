import { Routes, Route, Navigate } from 'react-router-dom';
import { useConvexAuth } from 'convex/react';
import { Box, CircularProgress, Typography } from '@mui/material';

import { MainLayout } from './components/layout/MainLayout';
import { HomePage } from './features/home/HomePage';
import { SessionPage } from './features/sessions/SessionPage';
import { NotesPage } from './features/notes/NotesPage';
import { LandingPage } from './features/landing/LandingPage';

// Loading screen component
function LoadingScreen() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 2,
      }}
    >
      <CircularProgress size={48} sx={{ color: 'primary.main' }} />
      <Typography variant="body1" color="text.secondary">
        Loading...
      </Typography>
    </Box>
  );
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* Landing page for unauthenticated users */}
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <Navigate to="/home" replace />
          ) : (
            <LandingPage />
          )
        }
      />

      {/* Protected routes */}
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />
      </Route>

      <Route
        path="/session/:sessionId"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<SessionPage />} />
        <Route path="notes" element={<NotesPage />} />
      </Route>

      {/* Catch all - redirect to home or landing */}
      <Route
        path="*"
        element={
          isAuthenticated ? (
            <Navigate to="/home" replace />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
    </Routes>
  );
}

export default App;
