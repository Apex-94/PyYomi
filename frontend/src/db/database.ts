import Dexie, { Table } from 'dexie';

// IndexedDB table interfaces
export interface LocalManga {
  id?: number;
  title: string;
  url: string;
  thumbnail_url: string | null;
  source: string;
  description: string | null;
  author: string | null;
  artist: string | null;
  genres: string | null;
  status: string | null;
  last_read_chapter: number | null;
  last_read_at: Date | null;
  created_at: Date;
  updated_at: Date;
  isDeleted: boolean;
  syncVersion: number;
}

export interface LocalChapter {
  id?: number;
  manga_id: number;
  chapter_number: number;
  title: string;
  url: string;
  is_read: boolean;
  is_downloaded: boolean;
  downloaded_path: string | null;
  release_date: Date | null;
  created_at: Date;
  updated_at: Date;
  isDeleted: boolean;
  syncVersion: number;
}

export interface LocalLibraryEntry {
  id?: number;
  manga_id: number;
  added_at: Date;
  isDeleted: boolean;
  syncVersion: number;
}

export interface LocalHistory {
  id?: number;
  manga_id: number;
  chapter_number: number;
  read_at: Date;
  isDeleted: boolean;
  syncVersion: number;
}

export interface LocalCategory {
  id?: number;
  name: string;
  created_at: Date;
  isDeleted: boolean;
  syncVersion: number;
}

export interface LocalMangaCategory {
  manga_id: number;
  category_id: number;
  isDeleted: boolean;
  syncVersion: number;
}

export interface LocalReadingProgress {
  id?: number;
  manga_id: number;
  chapter_number: number;
  page_number: number;
  updated_at: Date;
  isDeleted: boolean;
  syncVersion: number;
}

export interface LocalExtensionConfig {
  id?: number;
  source_key: string;
  enabled: boolean;
  settings: string; // JSON string
  updated_at: Date;
  isDeleted: boolean;
  syncVersion: number;
}

export interface SyncMetadata {
  id?: number;
  entity_type: string;
  entity_id: number;
  last_synced_at: Date;
  sync_status: 'pending' | 'synced' | 'conflict';
  conflict_data: string | null; // JSON string
}

// Database class
export class PyYomiDatabase extends Dexie {
  manga!: Table<LocalManga>;
  chapters!: Table<LocalChapter>;
  library!: Table<LocalLibraryEntry>;
  history!: Table<LocalHistory>;
  categories!: Table<LocalCategory>;
  mangaCategories!: Table<LocalMangaCategory>;
  readingProgress!: Table<LocalReadingProgress>;
  extensionConfigs!: Table<LocalExtensionConfig>;
  syncMetadata!: Table<SyncMetadata>;

  constructor() {
    super('PyYomiDB');
    
    this.version(1).stores({
      manga: '++id, url, source, title, last_read_at, isDeleted, syncVersion',
      chapters: '++id, manga_id, url, chapter_number, is_read, is_downloaded, isDeleted, syncVersion',
      library: '++id, manga_id, added_at, isDeleted, syncVersion',
      history: '++id, manga_id, chapter_number, read_at, isDeleted, syncVersion',
      categories: '++id, name, isDeleted, syncVersion',
      mangaCategories: '[manga_id+category_id], manga_id, category_id, isDeleted, syncVersion',
      readingProgress: '++id, manga_id, chapter_number, isDeleted, syncVersion',
      extensionConfigs: '++id, source_key, isDeleted, syncVersion',
      syncMetadata: '++id, entity_type, entity_id, sync_status',
    });
  }
}

// Database singleton
export const db = new PyYomiDatabase();

// Soft delete helpers
export const softDeleteManga = async (id: number): Promise<void> => {
  const item = await db.manga.get(id);
  if (item) {
    await db.manga.update(id, { isDeleted: true, syncVersion: (item.syncVersion || 0) + 1 });
  }
};

export const softDeleteChapter = async (id: number): Promise<void> => {
  const item = await db.chapters.get(id);
  if (item) {
    await db.chapters.update(id, { isDeleted: true, syncVersion: (item.syncVersion || 0) + 1 });
  }
};

export const softDeleteLibraryEntry = async (id: number): Promise<void> => {
  const item = await db.library.get(id);
  if (item) {
    await db.library.update(id, { isDeleted: true, syncVersion: (item.syncVersion || 0) + 1 });
  }
};

export const softDeleteHistory = async (id: number): Promise<void> => {
  const item = await db.history.get(id);
  if (item) {
    await db.history.update(id, { isDeleted: true, syncVersion: (item.syncVersion || 0) + 1 });
  }
};

export const softDeleteCategory = async (id: number): Promise<void> => {
  const item = await db.categories.get(id);
  if (item) {
    await db.categories.update(id, { isDeleted: true, syncVersion: (item.syncVersion || 0) + 1 });
  }
};

// Upsert helper - creates or updates based on version
const createUpsert = <T extends { id?: number; syncVersion: number }>(
  table: Table<T, number>
) => async (item: T): Promise<number | undefined> => {
  if (item.id) {
    const existing = await table.get(item.id);
    if (existing) {
      if ((item.syncVersion || 0) >= (existing.syncVersion || 0)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await table.update(item.id, { ...item, syncVersion: (existing.syncVersion || 0) + 1 } as any);
      }
      return item.id;
    }
  }
  item.syncVersion = item.syncVersion || 1;
  return table.add(item);
};

// Upsert helpers
export const upsertManga = createUpsert(db.manga);
export const upsertChapter = createUpsert(db.chapters);
export const upsertLibraryEntry = createUpsert(db.library);
export const upsertHistory = createUpsert(db.history);
export const upsertCategory = createUpsert(db.categories);
export const upsertReadingProgress = createUpsert(db.readingProgress);
