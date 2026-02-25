import { db, upsertManga, upsertLibraryEntry, upsertHistory, upsertCategory, upsertReadingProgress, softDeleteLibraryEntry, LocalManga, LocalLibraryEntry, LocalHistory, LocalCategory, LocalReadingProgress } from './database';
import * as api from '../lib/api';

// Sync status tracking
let isSyncing = false;
let lastSyncTime: Date | null = null;

export const getSyncStatus = () => ({ isSyncing, lastSyncTime });

// Sync library from backend to IndexedDB
export const syncLibraryFromBackend = async (): Promise<boolean> => {
  try {
    const response = await api.api.get('/library');
    const libraryData = response.data;
    
    for (const item of libraryData.library || []) {
      const localManga: LocalManga = {
        id: item.id,
        title: item.title,
        url: item.url,
        thumbnail_url: item.thumbnail_url || null,
        source: item.source,
        description: item.description || null,
        author: item.author || null,
        artist: item.artist || null,
        genres: item.genres || null,
        status: item.status || null,
        last_read_chapter: item.last_read_chapter || null,
        last_read_at: item.last_read_at ? new Date(item.last_read_at) : null,
        created_at: new Date(item.created_at),
        updated_at: new Date(item.updated_at),
        isDeleted: false,
        syncVersion: 1,
      };
      await upsertManga(localManga);
      
      // Create library entry if not exists
      const existingEntry = await db.library.where('manga_id').equals(item.id).first();
      if (!existingEntry) {
        await upsertLibraryEntry({
          manga_id: item.id,
          added_at: new Date(),
          isDeleted: false,
          syncVersion: 1,
        });
      }
    }
    
    lastSyncTime = new Date();
    return true;
  } catch (error) {
    console.error('Failed to sync library from backend:', error);
    return false;
  }
};

// Sync history from backend to IndexedDB
export const syncHistoryFromBackend = async (): Promise<boolean> => {
  try {
    const historyData = await api.getReadingHistory();
    
    for (const item of historyData || []) {
      await upsertHistory({
        id: item.id,
        manga_id: item.manga_id,
        chapter_number: item.chapter_number,
        read_at: new Date(item.read_at),
        isDeleted: false,
        syncVersion: 1,
      });
    }
    
    return true;
  } catch (error) {
    console.error('Failed to sync history from backend:', error);
    return false;
  }
};

// Sync categories from backend to IndexedDB
export const syncCategoriesFromBackend = async (): Promise<boolean> => {
  try {
    const categoriesData = await api.getCategories();
    
    for (const category of categoriesData || []) {
      await upsertCategory({
        id: category.id,
        name: category.name,
        created_at: new Date(category.created_at),
        isDeleted: false,
        syncVersion: 1,
      });
    }
    
    return true;
  } catch (error) {
    console.error('Failed to sync categories from backend:', error);
    return false;
  }
};

// Sync reading progress from backend to IndexedDB
export const syncReadingProgressFromBackend = async (): Promise<boolean> => {
  try {
    const libraryEntries = await db.library.filter(e => !e.isDeleted).toArray();
    const mangaIds = libraryEntries.map(e => e.manga_id);
    
    for (const mangaId of mangaIds) {
      try {
        const progressData = await api.getReadingProgress(mangaId);
        for (const progress of progressData || []) {
          await upsertReadingProgress({
            id: progress.id,
            manga_id: progress.manga_id,
            chapter_number: progress.chapter_number,
            page_number: progress.page_number,
            updated_at: new Date(progress.updated_at),
            isDeleted: false,
            syncVersion: 1,
          });
        }
      } catch (e) {
        console.warn(`Failed to sync progress for manga ${mangaId}:`, e);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Failed to sync reading progress from backend:', error);
    return false;
  }
};

// Full sync from backend
export const fullSyncFromBackend = async (): Promise<boolean> => {
  if (isSyncing) return false;
  isSyncing = true;
  
  try {
    await Promise.all([
      syncLibraryFromBackend(),
      syncHistoryFromBackend(),
      syncCategoriesFromBackend(),
      syncReadingProgressFromBackend(),
    ]);
    
    lastSyncTime = new Date();
    return true;
  } finally {
    isSyncing = false;
  }
};

// Get library from IndexedDB (offline-first)
export const getLocalLibrary = async () => {
  const libraryEntries = await db.library.filter(entry => !entry.isDeleted).toArray();
  const mangaIds = libraryEntries.map(e => e.manga_id);
  return db.manga.filter(m => mangaIds.includes(m.id!) && !m.isDeleted).toArray();
};

// Get history from IndexedDB (offline-first)
export const getLocalHistory = async () => {
  const history = await db.history.filter(h => !h.isDeleted).toArray();
  return history.sort((a, b) => new Date(b.read_at).getTime() - new Date(a.read_at).getTime());
};

// Get categories from IndexedDB (offline-first)
export const getLocalCategories = async () => db.categories.filter(c => !c.isDeleted).toArray();

// Add manga to local library
export const addToLocalLibrary = async (manga: LocalManga): Promise<number | undefined> => {
  const mangaId = await upsertManga(manga);
  
  const existingEntry = await db.library.where('manga_id').equals(mangaId as number).first();
  if (!existingEntry) {
    await upsertLibraryEntry({
      manga_id: mangaId as number,
      added_at: new Date(),
      isDeleted: false,
      syncVersion: 1,
    });
  }
  
  return mangaId;
};

// Remove manga from local library (soft delete)
export const removeFromLocalLibrary = async (mangaId: number): Promise<void> => {
  const entry = await db.library.where('manga_id').equals(mangaId).first();
  if (entry?.id) {
    await softDeleteLibraryEntry(entry.id);
  }
};

// Add history entry locally
export const addLocalHistory = async (mangaId: number, chapterNumber: number): Promise<number | undefined> => {
  return db.history.add({
    manga_id: mangaId,
    chapter_number: chapterNumber,
    read_at: new Date(),
    isDeleted: false,
    syncVersion: 1,
  });
};

// Update reading progress locally
export const updateLocalReadingProgress = async (
  mangaId: number,
  chapterNumber: number,
  pageNumber: number
): Promise<number | undefined> => {
  const existing = await db.readingProgress
    .filter(p => p.manga_id === mangaId && p.chapter_number === chapterNumber && !p.isDeleted)
    .first();
  
  return upsertReadingProgress({
    id: existing?.id,
    manga_id: mangaId,
    chapter_number: chapterNumber,
    page_number: pageNumber,
    updated_at: new Date(),
    isDeleted: false,
    syncVersion: (existing?.syncVersion || 0) + 1,
  });
};

// Get reading progress from IndexedDB
export const getLocalReadingProgress = async (mangaId: number): Promise<LocalReadingProgress | undefined> => {
  return db.readingProgress.filter(p => p.manga_id === mangaId && !p.isDeleted).first();
};

// Get all reading progress for a manga from IndexedDB
export const getAllLocalReadingProgress = async (mangaId: number): Promise<LocalReadingProgress[]> => {
  return db.readingProgress.filter(p => p.manga_id === mangaId && !p.isDeleted).toArray();
};

// Sync local changes to backend
export const syncLocalChangesToBackend = async (): Promise<{
  success: boolean;
  synced: number;
  errors: string[];
}> => {
  const errors: string[] = [];
  let synced = 0;
  
  try {
    const pendingHistory = await db.history.filter(h => !h.isDeleted).toArray();
    
    for (const entry of pendingHistory) {
      try {
        await api.addHistoryEntry(entry.manga_id, entry.chapter_number);
        synced++;
      } catch (e) {
        errors.push(`Failed to sync history for manga ${entry.manga_id}`);
      }
    }
    
    const pendingProgress = await db.readingProgress.filter(p => !p.isDeleted).toArray();
    
    for (const progress of pendingProgress) {
      try {
        await api.updateReadingProgress(progress.manga_id, progress.chapter_number, progress.page_number);
        synced++;
      } catch (e) {
        errors.push(`Failed to sync reading progress for manga ${progress.manga_id}`);
      }
    }
    
    return { success: errors.length === 0, synced, errors };
  } catch (error) {
    return { 
      success: false, 
      synced, 
      errors: [`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`] 
    };
  }
};
