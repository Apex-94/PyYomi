import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAppSettings, updateAppSetting } from '../lib/api';

type ColorMode = 'light' | 'dark';
export type UIMode = 'classic' | 'mangaide';

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
  const [uiModeState, setUiModeState] = useState<UIMode>('mangaide');

  useEffect(() => {
    const savedMode = localStorage.getItem('color-mode');
    const savedUiMode = localStorage.getItem('ui-mode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedMode === 'light' || savedMode === 'dark') {
      setModeState(savedMode);
    } else if (prefersDark) {
      setModeState('dark');
    }
    if (savedUiMode === 'classic' || savedUiMode === 'mangaide') {
      setUiModeState(savedUiMode);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('color-mode', modeState);
  }, [modeState]);

  useEffect(() => {
    localStorage.setItem('ui-mode', uiModeState);
  }, [uiModeState]);

  useEffect(() => {
    let cancelled = false;
    const hydrateFromSettings = async () => {
      try {
        const settings = await getAppSettings();
        if (cancelled) return;
        const apiUiMode = settings['ui.mode'];
        const apiColorMode = settings['ui.color_mode'];
        if (apiColorMode === 'light' || apiColorMode === 'dark') {
          setModeState(apiColorMode);
        }
        if (apiUiMode === 'classic' || apiUiMode === 'mangaide') {
          setUiModeState(apiUiMode);
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

  const setUiMode = (mode: UIMode) => {
    setUiModeState(mode);
    void updateAppSetting('ui.mode', mode).catch(() => {
      // Keep local preference even if backend persistence fails.
    });
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
