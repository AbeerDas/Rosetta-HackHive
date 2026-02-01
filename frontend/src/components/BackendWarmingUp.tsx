/**
 * Backend Warming Up Component
 * 
 * Displays a friendly indicator when the backend is waking up from a cold start.
 * This helps users understand what's happening and sets proper expectations.
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Stack,
  Fade,
  Chip,
  alpha,
} from '@mui/material';
import CloudIcon from '@mui/icons-material/Cloud';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useBackendStatus } from '../contexts/BackendStatusContext';

interface BackendWarmingUpProps {
  /** Whether to show as a full-screen overlay */
  overlay?: boolean;
  /** Whether to show as a compact inline indicator */
  inline?: boolean;
  /** Custom message to display */
  message?: string;
  /** Callback when warmup is complete */
  onReady?: () => void;
}

export function BackendWarmingUp({
  overlay = false,
  inline = false,
  message,
  onReady,
}: BackendWarmingUpProps) {
  const { status, warmupProgress, warmup, isWarmingUp } = useBackendStatus();
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Simulate progress based on elapsed time
  useEffect(() => {
    if (!isWarmingUp) {
      if (status === 'ready') {
        setProgress(100);
        onReady?.();
      }
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
      // Progress curve: fast at start, slows down approaching 90%
      setProgress((prev) => {
        if (prev >= 90) return prev + 0.5;
        if (prev >= 70) return prev + 1;
        if (prev >= 50) return prev + 2;
        return prev + 3;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isWarmingUp, status, onReady]);

  // Reset on new warmup
  useEffect(() => {
    if (isWarmingUp) {
      setProgress(0);
      setElapsedTime(0);
    }
  }, [isWarmingUp]);

  // Trigger warmup if not already warming
  useEffect(() => {
    if (status === 'unknown') {
      warmup();
    }
  }, [status, warmup]);

  if (status === 'ready' && !overlay) {
    return null;
  }

  const displayMessage = message || warmupProgress?.phase || 'Connecting to server...';
  const estimatedTotal = 30; // seconds
  const estimatedRemaining = Math.max(0, estimatedTotal - elapsedTime);

  // Inline compact version
  if (inline) {
    return (
      <Fade in={isWarmingUp}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            borderRadius: 2,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
          }}
        >
          <CloudIcon
            sx={{
              color: 'primary.main',
              animation: 'pulse 2s infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
            }}
          />
          <Typography variant="body2" color="text.secondary">
            {displayMessage}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={Math.min(progress, 100)}
            sx={{ width: 100, ml: 1 }}
          />
        </Box>
      </Fade>
    );
  }

  // Full overlay version
  if (overlay) {
    return (
      <Fade in={isWarmingUp || status === 'ready'}>
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
          }}
        >
          <WarmingUpCard
            progress={progress}
            message={displayMessage}
            estimatedRemaining={estimatedRemaining}
            modelsLoaded={warmupProgress?.modelsLoaded || []}
            isReady={status === 'ready'}
          />
        </Box>
      </Fade>
    );
  }

  // Default card version
  return (
    <Fade in={isWarmingUp}>
      <Box sx={{ p: 2 }}>
        <WarmingUpCard
          progress={progress}
          message={displayMessage}
          estimatedRemaining={estimatedRemaining}
          modelsLoaded={warmupProgress?.modelsLoaded || []}
          isReady={status === 'ready'}
        />
      </Box>
    </Fade>
  );
}

interface WarmingUpCardProps {
  progress: number;
  message: string;
  estimatedRemaining: number;
  modelsLoaded: string[];
  isReady: boolean;
}

function WarmingUpCard({
  progress,
  message,
  estimatedRemaining,
  modelsLoaded,
  isReady,
}: WarmingUpCardProps) {
  return (
    <Paper
      elevation={8}
      sx={{
        p: 4,
        maxWidth: 400,
        width: '90%',
        borderRadius: 3,
        textAlign: 'center',
      }}
    >
      <Stack spacing={3} alignItems="center">
        {/* Icon */}
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: isReady ? 'success.light' : 'primary.light',
            transition: 'all 0.3s ease',
          }}
        >
          {isReady ? (
            <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main' }} />
          ) : (
            <CloudIcon
              sx={{
                fontSize: 48,
                color: 'primary.main',
                animation: 'bounce 1s infinite',
                '@keyframes bounce': {
                  '0%, 100%': { transform: 'translateY(0)' },
                  '50%': { transform: 'translateY(-10px)' },
                },
              }}
            />
          )}
        </Box>

        {/* Title */}
        <Typography variant="h5" fontWeight={600}>
          {isReady ? 'Ready!' : 'Server is Waking Up'}
        </Typography>

        {/* Description */}
        <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
          {isReady
            ? 'The server is ready to process your requests.'
            : 'Our server runs on a free tier that sleeps when inactive. It takes about 20-30 seconds to wake up.'}
        </Typography>

        {/* Progress */}
        {!isReady && (
          <>
            <Box sx={{ width: '100%' }}>
              <LinearProgress
                variant="determinate"
                value={Math.min(progress, 100)}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: 'action.hover',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                    background: 'linear-gradient(90deg, #4CAF50 0%, #8BC34A 100%)',
                  },
                }}
              />
            </Box>

            {/* Status message */}
            <Typography variant="body2" color="primary.main" fontWeight={500}>
              {message}
            </Typography>

            {/* Time remaining */}
            <Typography variant="caption" color="text.disabled">
              {estimatedRemaining > 0
                ? `~${estimatedRemaining} seconds remaining`
                : 'Almost there...'}
            </Typography>
          </>
        )}

        {/* Models loaded */}
        {modelsLoaded.length > 0 && (
          <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center">
            {modelsLoaded.map((model) => (
              <Chip
                key={model}
                label={model}
                size="small"
                color="success"
                variant="outlined"
                sx={{ mb: 1 }}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

export default BackendWarmingUp;
