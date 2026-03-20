declare global {
  interface Window {
    __BACKEND_URL__?: string;
    electronAPI?: {
      getAppPath?: () => string;
      restartApp?: () => void;
      backendUrl?: string | null;
      platform?: string;
      getVersion?: () => string;
      selectDownloadPath?: () => Promise<string | null>;
    };
  }
}

export {};
