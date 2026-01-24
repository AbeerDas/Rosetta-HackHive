import { createTheme, alpha } from '@mui/material/styles';

// Rosetta Modern White brand colors
const colors = {
  primary: {
    main: '#007E70', // Brand green
    light: '#00A896',
    dark: '#005F54',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: '#007E70', // Same as primary for consistency
    light: '#00A896',
    dark: '#005F54',
    contrastText: '#FFFFFF',
  },
  background: {
    default: '#FFFFFF', // Pure white background
    paper: '#FFFFFF', // White paper
    elevated: '#FAFAFA', // Slightly off-white for subtle elevation
  },
  text: {
    primary: '#1A1A1A', // Dark grey/black for main text
    secondary: '#666666', // Medium grey for secondary text
    disabled: '#999999', // Light grey for disabled
  },
  divider: '#CFCFCF', // Grey divider lines
  error: {
    main: '#B32805', // End session red
    light: '#D93A0F',
    dark: '#8A1F04',
    contrastText: '#FFFFFF',
  },
  warning: {
    main: '#F59E0B',
    light: '#FBBF24',
    dark: '#D97706',
  },
  info: {
    main: '#007E70',
    light: '#00A896',
    dark: '#005F54',
  },
  success: {
    main: '#33570F', // Active status text color
    light: '#E5F7D4', // Active status background
    dark: '#2A4A0C',
  },
};

// Custom colors for specific UI elements
export const customColors = {
  activePill: {
    background: '#E5F7D4',
    text: '#33570F',
  },
  endSession: {
    background: '#B32805',
    text: '#FFFFFF',
  },
  brandGreen: '#007E70',
  dropzoneBorder: '#CFCFCF', // Grey for dashed border
  quoteIcon: '#CCCCCC',
  columnDivider: '#CFCFCF',
  cardBackground: '#E1F5F2', // Light turquoise card background
  sessionListBackground: '#F3F8F7', // Session list background
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    ...colors,
  },
  typography: {
    // Primary font: ABeeZee for all UI elements
    fontFamily: '"ABeeZee", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 400,
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
      color: colors.text.primary,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 400,
      lineHeight: 1.3,
      color: colors.text.primary,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 400,
      lineHeight: 1.4,
      color: colors.text.primary,
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 400,
      lineHeight: 1.4,
      color: colors.text.primary,
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 400,
      lineHeight: 1.5,
      color: colors.text.primary,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 400,
      lineHeight: 1.5,
      color: colors.text.primary,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.8, // Increased line-height for readability
      color: colors.text.primary,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
      color: colors.text.secondary,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
      fontFamily: '"ABeeZee", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.4,
      color: colors.text.secondary,
    },
    overline: {
      fontSize: '0.625rem',
      fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: colors.text.secondary,
    },
  },
  shape: {
    borderRadius: 4, // Minimal border radius for clean look
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#FFFFFF',
          color: colors.text.primary,
          scrollbarWidth: 'thin',
          scrollbarColor: `${colors.divider} transparent`,
          '&::-webkit-scrollbar': {
            width: 6,
            height: 6,
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: colors.divider,
            borderRadius: 3,
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: colors.text.disabled,
          },
        },
        // Logo font class
        '.logo-text': {
          fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif !important',
          fontWeight: 600,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          padding: '8px 16px',
          fontSize: '0.875rem',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        containedPrimary: {
          backgroundColor: colors.primary.main,
          '&:hover': {
            backgroundColor: colors.primary.dark,
          },
        },
        containedError: {
          backgroundColor: customColors.endSession.background,
          color: customColors.endSession.text,
          '&:hover': {
            backgroundColor: '#8A1F04',
          },
        },
        outlined: {
          borderWidth: 1,
          borderColor: colors.divider,
          '&:hover': {
            borderWidth: 1,
            backgroundColor: alpha(colors.primary.main, 0.04),
          },
        },
        outlinedPrimary: {
          borderColor: colors.primary.main,
          color: colors.primary.main,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: colors.background.paper,
          border: 'none',
          borderRadius: 0,
          boxShadow: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: colors.background.paper,
          boxShadow: 'none',
        },
        elevation0: {
          boxShadow: 'none',
        },
        elevation1: {
          boxShadow: 'none',
        },
        elevation2: {
          boxShadow: 'none',
        },
        elevation3: {
          boxShadow: 'none',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 4,
            '& fieldset': {
              borderColor: colors.divider,
              borderWidth: 1,
            },
            '&:hover fieldset': {
              borderColor: colors.text.disabled,
            },
            '&.Mui-focused fieldset': {
              borderColor: colors.primary.main,
              borderWidth: 1,
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 4,
        },
        outlined: {
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: colors.divider,
            borderWidth: 1,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: colors.text.disabled,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: colors.primary.main,
            borderWidth: 1,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          fontWeight: 500,
          fontSize: '0.75rem',
        },
        filled: {
          backgroundColor: customColors.activePill.background,
          color: customColors.activePill.text,
        },
        colorSuccess: {
          backgroundColor: customColors.activePill.background,
          color: customColors.activePill.text,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: colors.text.primary,
          color: '#FFFFFF',
          fontSize: '0.75rem',
          borderRadius: 4,
          padding: '6px 12px',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: colors.background.paper,
          borderRight: `1px solid ${colors.divider}`,
          boxShadow: 'none',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: colors.background.paper,
          backgroundImage: 'none',
          borderBottom: `1px solid ${colors.divider}`,
          boxShadow: 'none',
          color: colors.text.primary,
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          backgroundColor: colors.background.paper,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          margin: '2px 0',
          '&.Mui-selected': {
            backgroundColor: alpha(colors.primary.main, 0.08),
            '&:hover': {
              backgroundColor: alpha(colors.primary.main, 0.12),
            },
          },
          '&:hover': {
            backgroundColor: alpha(colors.text.primary, 0.04),
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          color: colors.text.secondary,
          '&:hover': {
            backgroundColor: alpha(colors.text.primary, 0.04),
          },
        },
        colorPrimary: {
          color: colors.primary.main,
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          height: 2, // Thin line
          color: colors.primary.main,
        },
        thumb: {
          width: 14,
          height: 14,
          backgroundColor: colors.primary.main,
          '&:hover': {
            boxShadow: `0 0 0 8px ${alpha(colors.primary.main, 0.16)}`,
          },
          '&.Mui-focusVisible': {
            boxShadow: `0 0 0 8px ${alpha(colors.primary.main, 0.16)}`,
          },
        },
        track: {
          height: 2,
          backgroundColor: colors.primary.main,
        },
        rail: {
          height: 2,
          backgroundColor: colors.divider,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: colors.divider,
          borderWidth: '0 0 1px 0',
        },
        vertical: {
          borderWidth: '0 1px 0 0',
          borderColor: colors.divider,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 4,
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
          border: `1px solid ${colors.divider}`,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
          '&:hover': {
            backgroundColor: alpha(colors.primary.main, 0.04),
          },
          '&.Mui-selected': {
            backgroundColor: alpha(colors.primary.main, 0.08),
            '&:hover': {
              backgroundColor: alpha(colors.primary.main, 0.12),
            },
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: colors.divider,
          borderRadius: 2,
        },
        bar: {
          backgroundColor: colors.primary.main,
        },
      },
    },
    MuiCircularProgress: {
      styleOverrides: {
        root: {
          color: colors.primary.main,
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          width: 42,
          height: 26,
          padding: 0,
        },
        switchBase: {
          padding: 1,
          '&.Mui-checked': {
            transform: 'translateX(16px)',
            color: '#fff',
            '& + .MuiSwitch-track': {
              backgroundColor: colors.primary.main,
              opacity: 1,
            },
          },
        },
        thumb: {
          width: 24,
          height: 24,
        },
        track: {
          borderRadius: 13,
          backgroundColor: colors.divider,
          opacity: 1,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${colors.divider}`,
        },
        indicator: {
          backgroundColor: colors.primary.main,
          height: 2,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.875rem',
          color: colors.text.secondary,
          '&.Mui-selected': {
            color: colors.primary.main,
          },
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          border: `1px solid ${colors.divider}`,
          '&:before': {
            display: 'none',
          },
          '&.Mui-expanded': {
            margin: 0,
          },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          backgroundColor: colors.background.paper,
          borderBottom: `1px solid ${colors.divider}`,
          '&.Mui-expanded': {
            minHeight: 48,
          },
        },
        content: {
          '&.Mui-expanded': {
            margin: '12px 0',
          },
        },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: {
          fontSize: '0.625rem',
          fontWeight: 600,
        },
        colorPrimary: {
          backgroundColor: colors.primary.main,
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          backgroundColor: colors.primary.main,
          color: '#FFFFFF',
        },
      },
    },
  },
});

// Export type for theme
export type AppTheme = typeof theme;
