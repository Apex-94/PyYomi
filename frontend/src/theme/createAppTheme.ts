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
        main: isLight ? '#4d5d7a' : '#a8b7d2',
        light: isLight ? '#7083a4' : '#cad7ec',
        dark: isLight ? '#364258' : '#8c9bb7',
        contrastText: isLight ? '#f7f5f1' : '#12161d',
      },
      secondary: {
        main: isLight ? '#6f7a6a' : '#b9c3b4',
        light: isLight ? '#8b9686' : '#d0d9cb',
        dark: isLight ? '#586152' : '#9da896',
      },
      background: {
        default: isLight ? '#f5f1ea' : '#17191d',
        paper: isLight ? '#fcfaf6' : '#20242a',
      },
      text: {
        primary: isLight ? '#23262b' : '#f1f3f6',
        secondary: isLight ? '#666c75' : '#b7bec9',
      },
      divider: isLight ? '#ddd6ca' : '#323842',
      success: {
        main: isLight ? '#3f7a63' : '#78b594',
      },
      warning: {
        main: isLight ? '#a47735' : '#d7aa68',
      },
      error: {
        main: isLight ? '#aa564d' : '#d8887f',
      },
    },
    typography: {
      fontFamily: '"Manrope", "Segoe UI", sans-serif',
      h1: {
        fontFamily: '"Fraunces", "Georgia", serif',
        fontWeight: 700,
        letterSpacing: '-0.03em',
      },
      h2: {
        fontFamily: '"Fraunces", "Georgia", serif',
        fontWeight: 700,
        letterSpacing: '-0.03em',
      },
      h3: {
        fontFamily: '"Fraunces", "Georgia", serif',
        fontWeight: 700,
        letterSpacing: '-0.025em',
      },
      h4: {
        fontFamily: '"Fraunces", "Georgia", serif',
        fontWeight: 700,
        letterSpacing: '-0.02em',
      },
      h5: {
        fontFamily: '"Fraunces", "Georgia", serif',
        fontWeight: 650,
        letterSpacing: '-0.015em',
      },
      h6: {
        fontFamily: '"Fraunces", "Georgia", serif',
        fontWeight: 650,
        letterSpacing: '-0.015em',
      },
      button: {
        fontWeight: 700,
        letterSpacing: '-0.01em',
      },
    },
    shape: {
      borderRadius: 18,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundImage: 'none',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isLight ? 'rgba(252, 250, 246, 0.94)' : 'rgba(32, 36, 42, 0.94)',
            backdropFilter: 'blur(14px)',
            borderBottom: isLight ? '1px solid rgba(110, 116, 124, 0.14)' : '1px solid rgba(255, 255, 255, 0.06)',
            boxShadow: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isLight ? '#f8f4ed' : '#1b1f25',
            borderRight: isLight ? '1px solid rgba(110, 116, 124, 0.14)' : '1px solid rgba(255, 255, 255, 0.06)',
            backdropFilter: 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderRadius: 20,
            boxShadow: 'none',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 999,
            paddingInline: 18,
            minHeight: 40,
            boxShadow: 'none',
          },
          contained: {
            boxShadow: 'none',
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 16,
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          variant: 'outlined',
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 18,
            backgroundColor: isLight ? 'rgba(255, 255, 255, 0.72)' : 'rgba(33, 37, 43, 0.9)',
            transition: 'border-color 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1), transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
            '&:hover': {
              transform: 'none',
            },
            '&.Mui-focused': {
              boxShadow: isLight ? '0 0 0 4px rgba(77, 93, 122, 0.1)' : '0 0 0 4px rgba(168, 183, 210, 0.14)',
            },
          },
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: {
          root: {
            padding: 4,
            borderRadius: 999,
            backgroundColor: isLight ? 'rgba(77, 93, 122, 0.08)' : 'rgba(168, 183, 210, 0.08)',
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            border: 0,
            borderRadius: 999,
            textTransform: 'none',
            fontWeight: 700,
            color: isLight ? '#666c75' : '#b7bec9',
            '&.Mui-selected': {
              backgroundColor: isLight ? '#ffffff' : '#2b313a',
              color: isLight ? '#23262b' : '#f1f3f6',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            fontWeight: 700,
          },
        },
      },
    },
  });
}
