import { createTheme } from '@mui/material/styles';
import { UIMode } from './ColorModeContext';

export function createAppTheme(mode: 'light' | 'dark', uiMode: UIMode) {
  const isLight = mode === 'light';

  if (uiMode === 'mangaide') {
    return createTheme({
      palette: {
        mode,
        primary: {
          main: isLight ? '#3b82f6' : '#60a5fa',
        },
        secondary: {
          main: isLight ? '#64748b' : '#94a3b8',
        },
        background: {
          default: isLight ? '#e8e8e8' : '#17191d',
          paper: isLight ? '#f5f5f5' : '#23272f',
        },
        text: {
          primary: isLight ? '#2f3743' : '#e5e7eb',
          secondary: isLight ? '#5d6673' : '#a8b0bd',
        },
        divider: isLight ? '#cfcfcf' : '#3a3f4b',
      },
      typography: {
        fontFamily: '"JetBrains Mono", "Consolas", "Menlo", monospace',
      },
      shape: {
        borderRadius: 6,
      },
      components: {
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              textTransform: 'none',
              borderRadius: 6,
            },
          },
        },
      },
    });
  }

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isLight ? '#4f46e5' : '#818cf8',
      },
      secondary: {
        main: isLight ? '#6366f1' : '#818cf8',
      },
      background: {
        default: isLight ? '#f9fafb' : '#111827',
        paper: isLight ? '#ffffff' : '#1f2937',
      },
      text: {
        primary: isLight ? '#111827' : '#f3f4f6',
        secondary: isLight ? '#6b7280' : '#d1d5db',
      },
      divider: isLight ? '#e5e7eb' : '#374151',
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(31, 41, 55, 0.95)',
            backdropFilter: 'blur(8px)',
            borderBottom: isLight ? '1px solid #e5e7eb' : '1px solid #374151',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isLight ? '#ffffff' : '#1f2937',
            borderRight: isLight ? '1px solid #e5e7eb' : '1px solid #374151',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
          },
        },
      },
    },
  });
}
