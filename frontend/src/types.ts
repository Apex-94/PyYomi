export interface Chapter {
  id: string;
  number: number;
  title: string;
  date: string;
  pages: string[];
}

export interface Manga {
  id: string;
  title: string;
  altTitle: string;
  author: string | null;
  status: 'Ongoing' | 'Completed' | 'Hiatus';
  genres: string[];
  description: string;
  coverUrl: string;
  rating: number;
  chapters: Chapter[];
}

export interface Category {
  id: number;
  name: string;
  created_at: string;
}

export interface MangaCategory {
  manga_id: number;
  category_id: number;
}

export interface ReadingProgress {
  id: number;
  manga_id: number;
  chapter_number: number;
  page_number: number;
  updated_at: string;
}

export interface HistoryEntry {
  id: number;
  manga_id: number;
  chapter_number: number;
  read_at: string;
  manga?: {
    id: number;
    title: string;
    thumbnail_url: string | null;
    source: string;
  };
  chapter?: {
    id: number | null;
    title: string | null;
  };
}

export interface DownloadItem {
  id: number;
  manga_id: number;
  manga_title: string;
  chapter_number: number;
  chapter_title?: string | null;
  chapter_url?: string | null;
  source?: string | null;
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  error?: string | null;
  file_path?: string | null;
  total_pages: number;
  downloaded_pages: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateItem {
  id: number;
  manga_id: number;
  manga_title: string;
  manga_url: string;
  source: string;
  chapter_number: number;
  chapter_title?: string | null;
  chapter_url: string;
  is_read: boolean;
  is_downloaded: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

export interface LibraryAddResponse {
  manga: {
    id: number;
    title: string;
    url: string;
    thumbnail_url?: string | null;
    source: string;
    description?: string | null;
    author?: string | null;
    artist?: string | null;
    genres?: string | null;
    status?: string | null;
  };
  created: boolean;
  alreadyExists: boolean;
  libraryEntryId?: number | null;
}

export type ViewState = 'HOME' | 'DETAIL' | 'READER';

export type ReadingMode = 'VERTICAL' | 'SINGLE' | 'DOUBLE';

export type ZoomMode = 'FIT_WIDTH' | 'FIT_HEIGHT' | 'CUSTOM';

export interface ReaderSettings {
  readingMode: ReadingMode;
  zoomMode: ZoomMode;
  customZoom: number;
  autoScroll: boolean;
  scrollSpeed: number;
  showPageNumbers: boolean;
  showProgress: boolean;
}

// Tracker types
export interface Tracker {
  name: string;
  display_name: string;
  oauth_configured: boolean;
}

export interface TrackerStatus {
  connected: boolean;
  username: string | null;
  user_id: string | null;
}

export interface TrackerCredential {
  id: number;
  tracker_name: string;
  user_id: string;
  username: string;
  created_at: string;
  updated_at: string;
}

export interface TrackerMapping {
  id: number;
  manga_id: number;
  tracker_name: string;
  tracker_manga_id: string;
  tracker_url: string | null;
  last_synced_chapter: number | null;
  last_synced_at: string | null;
  sync_status: 'pending' | 'synced' | 'error';
  created_at: string;
  updated_at: string;
}

export interface TrackerManga {
  id: string;
  title: string;
  chapters: number | null;
  status: string;
  user_status?: string;
  user_chapters?: number;
}

export interface SyncQueueItem {
  id: number;
  manga_id: number;
  chapter_number: number;
  tracker_name: string;
  operation: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  retry_count: number;
  created_at: string;
  processed_at: string | null;
}
