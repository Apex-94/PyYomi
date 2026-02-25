import { useState, useEffect, useCallback } from 'react';
import { db, LocalManga } from '../db/database';
import { 
  fullSyncFromBackend, 
  addToLocalLibrary, 
  removeFromLocalLibrary,
  addLocalHistory,
  updateLocalReadingProgress,
  getLocalReadingProgress,
  getSyncStatus,
  getLocalLibrary,
  getLocalHistory,
  getLocalCategories,
} from '../db/syncService';
import { downloadBackup, importData, validateBackup, clearLocalData } from '../db/backupService';
import type { BackupData } from '../db/backupService';

export function useIndexedDB() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState(getSyncStatus);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update sync status periodically
  useEffect(() => {
    const interval = setInterval(() => setSyncStatus(getSyncStatus()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync from backend when coming online
  useEffect(() => {
    if (isOnline) {
      fullSyncFromBackend().then(() => setSyncStatus({ isSyncing: false, lastSyncTime: new Date() }));
    }
  }, [isOnline]);

  // Get library (offline-first)
  const getLibrary = useCallback(async () => {
    if (isOnline) await fullSyncFromBackend();
    return getLocalLibrary();
  }, [isOnline]);

  // Import backup file helper
  const readBackupFile = <T>(file: File, processor: (data: BackupData) => T): Promise<T> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const backup: BackupData = JSON.parse(e.target?.result as string);
          resolve(processor(backup));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  // Import backup
  const importBackup = useCallback(async (file: File) => {
    return readBackupFile(file, (backup) => importData(backup, { conflictStrategy: 'merge' }));
  }, []);

  // Validate backup file
  const validateBackupFile = useCallback(async (file: File): Promise<{ valid: boolean; error?: string }> => {
    return readBackupFile(file, (backup) => validateBackup(backup))
      .catch(() => ({ valid: false, error: 'Invalid JSON format' }));
  }, []);

  // Manual sync
  const syncNow = useCallback(async () => {
    if (!isOnline) return { success: false, error: 'Offline - cannot sync' };
    
    setSyncStatus(prev => ({ ...prev, isSyncing: true }));
    try {
      const success = await fullSyncFromBackend();
      setSyncStatus({ isSyncing: false, lastSyncTime: new Date() });
      return { success, error: success ? undefined : 'Sync failed' };
    } catch (error) {
      setSyncStatus(prev => ({ ...prev, isSyncing: false }));
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, [isOnline]);

  return {
    isOnline,
    syncStatus,
    getLibrary,
    getHistory: useCallback(() => getLocalHistory(), []),
    getCategories: useCallback(() => getLocalCategories(), []),
    addToLibrary: useCallback((manga: LocalManga) => addToLocalLibrary(manga), []),
    removeFromLibrary: useCallback((mangaId: number) => removeFromLocalLibrary(mangaId), []),
    recordHistory: useCallback((mangaId: number, chapterNumber: number) => addLocalHistory(mangaId, chapterNumber), []),
    updateProgress: useCallback((mangaId: number, chapterNumber: number, pageNumber: number) => 
      updateLocalReadingProgress(mangaId, chapterNumber, pageNumber), []),
    getProgress: useCallback((mangaId: number) => getLocalReadingProgress(mangaId), []),
    exportBackup: useCallback(() => downloadBackup(), []),
    importBackup,
    validateBackupFile,
    clearData: useCallback(() => clearLocalData(), []),
    syncNow,
  };
}
