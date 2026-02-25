import { db, LocalManga, LocalChapter, LocalLibraryEntry, LocalHistory, LocalCategory, LocalReadingProgress } from './database';
import { fullSyncFromBackend } from './syncService';

export interface BackupData {
  version: number;
  exportedAt: string;
  checksum: string;
  data: {
    manga: LocalManga[];
    chapters: LocalChapter[];
    library: LocalLibraryEntry[];
    history: LocalHistory[];
    categories: LocalCategory[];
    readingProgress: LocalReadingProgress[];
  };
}

// Generate SHA-256 checksum
const generateChecksum = async (data: string): Promise<string> => {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

// Export all data to JSON
export const exportData = async (options: {
  includeHistory?: boolean;
  includeReadingProgress?: boolean;
} = {}): Promise<BackupData> => {
  const { includeHistory = true, includeReadingProgress = true } = options;
  
  // Sync from backend first to ensure we have the latest data
  try {
    await fullSyncFromBackend();
  } catch (error) {
    console.warn('Failed to sync from backend before export, exporting local data only:', error);
  }
  
  // Get all data from IndexedDB and filter out deleted items
  const [manga, chapters, library, categories, history, readingProgress] = await Promise.all([
    db.manga.filter(m => !m.isDeleted).toArray(),
    db.chapters.filter(c => !c.isDeleted).toArray(),
    db.library.filter(l => !l.isDeleted).toArray(),
    db.categories.filter(c => !c.isDeleted).toArray(),
    includeHistory ? db.history.filter(h => !h.isDeleted).toArray() : Promise.resolve([]),
    includeReadingProgress ? db.readingProgress.filter(p => !p.isDeleted).toArray() : Promise.resolve([]),
  ]);
  
  const data = { manga, chapters, library, history, categories, readingProgress };
  
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    checksum: await generateChecksum(JSON.stringify(data)),
    data,
  };
};

// Download backup as JSON file
export const downloadBackup = async (filename?: string): Promise<void> => {
  const backup = await exportData({ includeHistory: true, includeReadingProgress: true });
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `pyyomi-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Validate backup file
export const validateBackup = async (backup: BackupData): Promise<{ valid: boolean; error?: string }> => {
  if (!backup.version || backup.version < 1) {
    return { valid: false, error: 'Invalid backup version' };
  }
  
  if (!backup.data || !backup.exportedAt || !backup.checksum) {
    return { valid: false, error: 'Missing required fields' };
  }
  
  const computedChecksum = await generateChecksum(JSON.stringify(backup.data));
  if (computedChecksum !== backup.checksum) {
    return { valid: false, error: 'Checksum mismatch - data may be corrupted' };
  }
  
  return { valid: true };
};

// Import data from backup
export const importData = async (
  backup: BackupData,
  options: { conflictStrategy?: 'skip' | 'overwrite' | 'merge' } = {}
): Promise<{
  success: boolean;
  imported: { manga: number; chapters: number; library: number; history: number; categories: number; readingProgress: number };
  errors: string[];
}> => {
  const { conflictStrategy = 'merge' } = options;
  const errors: string[] = [];
  const imported = { manga: 0, chapters: 0, library: 0, history: 0, categories: 0, readingProgress: 0 };
  
  const validation = await validateBackup(backup);
  if (!validation.valid) {
    return { success: false, imported, errors: [validation.error || 'Validation failed'] };
  }
  
  try {
    // Import manga
    for (const item of backup.data.manga) {
      try {
        if (conflictStrategy === 'overwrite') {
          await db.manga.put(item);
        } else if (conflictStrategy === 'merge') {
          const existing = await db.manga.filter(m => m.url === item.url).first();
          if (!existing) {
            await db.manga.add(item);
          } else if ((item.syncVersion || 0) > (existing.syncVersion || 0)) {
            await db.manga.update(existing.id!, item);
          }
        }
        imported.manga++;
      } catch {
        errors.push(`Failed to import manga: ${item.title}`);
      }
    }
    
    // Import chapters
    for (const item of backup.data.chapters) {
      try {
        if (conflictStrategy === 'overwrite') {
          await db.chapters.put(item);
        } else if (conflictStrategy === 'merge') {
          const existing = await db.chapters.filter(c => c.url === item.url).first();
          if (!existing) {
            await db.chapters.add(item);
          } else if ((item.syncVersion || 0) > (existing.syncVersion || 0)) {
            await db.chapters.update(existing.id!, item);
          }
        }
        imported.chapters++;
      } catch {
        errors.push(`Failed to import chapter: ${item.title}`);
      }
    }
    
    // Import library entries
    for (const item of backup.data.library) {
      try {
        const existing = await db.library.filter(l => l.manga_id === item.manga_id).first();
        if (!existing || conflictStrategy === 'overwrite') {
          await db.library.put(item);
        }
        imported.library++;
      } catch {
        errors.push(`Failed to import library entry for manga: ${item.manga_id}`);
      }
    }
    
    // Import history
    for (const item of backup.data.history) {
      try {
        await db.history.add(item);
        imported.history++;
      } catch {
        errors.push('Failed to import history entry');
      }
    }
    
    // Import categories
    for (const item of backup.data.categories) {
      try {
        if (conflictStrategy === 'overwrite') {
          await db.categories.put(item);
        } else if (conflictStrategy === 'merge') {
          const existing = await db.categories.filter(c => c.name === item.name).first();
          if (!existing) {
            await db.categories.add(item);
          } else if ((item.syncVersion || 0) > (existing.syncVersion || 0)) {
            await db.categories.update(existing.id!, item);
          }
        }
        imported.categories++;
      } catch {
        errors.push(`Failed to import category: ${item.name}`);
      }
    }
    
    // Import reading progress
    for (const item of backup.data.readingProgress) {
      try {
        await db.readingProgress.add(item);
        imported.readingProgress++;
      } catch {
        errors.push('Failed to import reading progress');
      }
    }
    
    return { success: true, imported, errors };
  } catch (e) {
    return { 
      success: false, 
      imported, 
      errors: [`Import failed: ${e instanceof Error ? e.message : 'Unknown error'}`] 
    };
  }
};

// Clear all local data
export const clearLocalData = async (): Promise<void> => {
  await Promise.all([
    db.manga.clear(),
    db.chapters.clear(),
    db.library.clear(),
    db.history.clear(),
    db.categories.clear(),
    db.mangaCategories.clear(),
    db.readingProgress.clear(),
    db.extensionConfigs.clear(),
    db.syncMetadata.clear(),
  ]);
};
