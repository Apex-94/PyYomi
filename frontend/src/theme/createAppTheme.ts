import { createTheme } from '@mui/material/styles';
import { UIMode } from './ColorModeContext';

export function createAppTheme(mode: 'light' | 'dark', _uiMode: UIMode) {
  const isLight = mode === 'light';

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
