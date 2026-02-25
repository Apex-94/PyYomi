import { api } from '../lib/api';

export interface BackupData {
  version: number;
  exported_at: string;
  app: string;
  data: {
    manga: any[];
    chapters: any[];
    library_entries: any[];
    history: any[];
    categories: any[];
    manga_categories: any[];
    reading_progress: any[];
    tracker_mappings: any[];
  };
}

export interface RestoreStats {
  manga: { imported: number; skipped: number };
  chapters: { imported: number; skipped: number };
  library_entries: { imported: number; skipped: number };
  history: { imported: number; skipped: number };
  categories: { imported: number; skipped: number };
  manga_categories: { imported: number; skipped: number };
  reading_progress: { imported: number; updated: number; skipped: number };
  tracker_mappings: { imported: number; updated: number; skipped: number };
}

export interface RestoreResult {
  success: boolean;
  message: string;
  stats: RestoreStats;
}

// Export backup - calls GET /api/backup/export
export const exportBackup = async (): Promise<BackupData> => {
  const response = await api.get('/backup/export');
  return response.data;
};

// Import backup - calls POST /api/backup/restore
export const importBackup = async (backup: BackupData): Promise<RestoreResult> => {
  const response = await api.post('/backup/restore', backup);
  return response.data;
};

// Download backup as file
export const downloadBackupFile = async (): Promise<void> => {
  const response = await api.get('/backup/export', {
    responseType: 'blob'
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `pyyomi_backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// Read backup file from disk
export const readBackupFile = async (file: File): Promise<BackupData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        resolve(data);
      } catch (error) {
        reject(new Error('Invalid backup file format'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};
