import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAppSettings, updateAppSetting } from '../lib/api';

type ColorMode = 'light' | 'dark';
export type UIMode = 'mangaide';

interface ColorModeContextType {
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
  uiMode: UIMode;
  setUiMode: (mode: UIMode) => void;
  toggleColorMode: () => void;
}

const ColorModeContext = createContext<ColorModeContextType | undefined>(undefined);

export function useColorMode() {
  const context = useContext(ColorModeContext);
  if (context === undefined) {
    throw new Error('useColorMode must be used within a ColorModeProvider');
  }
  return context;
}

export function ColorModeProvider({ children }: { children: React.ReactNode }) {
  const [modeState, setModeState] = useState<ColorMode>('light');
  const uiModeState: UIMode = 'mangaide';

  useEffect(() => {
    const savedMode = localStorage.getItem('color-mode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedMode === 'light' || savedMode === 'dark') {
      setModeState(savedMode);
    } else if (prefersDark) {
      setModeState('dark');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('color-mode', modeState);
  }, [modeState]);

  useEffect(() => {
    let cancelled = false;
    const hydrateFromSettings = async () => {
      try {
        const settings = await getAppSettings();
        if (cancelled) return;
        const apiColorMode = settings['ui.color_mode'];
        if (apiColorMode === 'light' || apiColorMode === 'dark') {
          setModeState(apiColorMode);
        }
      } catch {
        // Keep local fallback if backend settings are unavailable.
      }
    };
    void hydrateFromSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = (mode: ColorMode) => {
    setModeState(mode);
    void updateAppSetting('ui.color_mode', mode).catch(() => {
      // Keep local preference even if backend persistence fails.
    });
  };

  const setUiMode = (_mode: UIMode) => {
    // UI mode is always mangaide, no-op
  };

  const toggleColorMode = () => {
    setMode(modeState === 'light' ? 'dark' : 'light');
  };

  return (
    <ColorModeContext.Provider value={{ mode: modeState, setMode, uiMode: uiModeState, setUiMode, toggleColorMode }}>
      {children}
    </ColorModeContext.Provider>
  );
}
