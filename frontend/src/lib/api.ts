import axios from 'axios';
import {
    ReaderSettings,
    Category,
    MangaCategory,
    ReadingProgress,
    HistoryEntry,
    DownloadItem,
    UpdateItem,
    LibraryAddResponse,
    Tracker,
    TrackerStatus,
    TrackerManga,
    TrackerMapping,
    SyncQueueItem,
} from '../types';

export const api = axios.create();

export const setApiBaseUrl = (baseUrl: string) => {
    api.defaults.baseURL = `${baseUrl}/api/v1`;
    console.log('[API] Base URL set to:', api.defaults.baseURL);
};

const getDefaultBaseUrl = (): string => {
    if (typeof window === 'undefined') {
        return 'http://localhost:8000';
    }
    if (window.__BACKEND_URL__) {
        return window.__BACKEND_URL__;
    }
    return (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';
};

const normalizeBaseUrl = (url: string): string => {
    return url.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
};

if (typeof window !== 'undefined') {
    const initialBaseUrl = normalizeBaseUrl(getDefaultBaseUrl());
    setApiBaseUrl(initialBaseUrl);

    window.addEventListener('backend-ready', ((event: CustomEvent<{ url?: string }>) => {
        if (!event.detail?.url) {
            return;
        }
        setApiBaseUrl(normalizeBaseUrl(event.detail.url));
    }) as EventListener);
}

export function waitForBackend(): Promise<void> {
    return Promise.resolve();
}

export const getProxyUrl = (imageUrl: string, source?: string): string => {
    if (!api.defaults.baseURL) {
        return imageUrl;
    }
    const params = new URLSearchParams({ url: imageUrl, cache: '1' });
    if (source) {
        params.append('source', source);
    }
    return `${api.defaults.baseURL}/proxy?${params.toString()}`;
};

export const getReaderSettings = async (userId: string): Promise<ReaderSettings> => {
    const response = await api.get(`/reader/settings/${userId}`);
    return response.data;
};

export const updateReaderSettings = async (userId: string, settings: ReaderSettings): Promise<ReaderSettings> => {
    const response = await api.put(`/reader/settings/${userId}`, settings);
    return response.data.settings;
};

export const createReaderSettings = async (userId: string, settings?: ReaderSettings): Promise<ReaderSettings> => {
    const response = await api.post(`/reader/settings/${userId}`, settings);
    return response.data.settings;
};

export const deleteReaderSettings = async (userId: string): Promise<void> => {
    await api.delete(`/reader/settings/${userId}`);
};

export const getCategories = async (): Promise<Category[]> => {
    const response = await api.get('/categories');
    return response.data.categories;
};

export const createCategory = async (name: string): Promise<Category> => {
    const response = await api.post('/categories', null, {
        params: { name }
    });
    return response.data.category;
};

export const updateCategory = async (id: number, name: string): Promise<Category> => {
    const response = await api.put(`/categories/${id}`, null, {
        params: { name }
    });
    return response.data.category;
};

export const deleteCategory = async (id: number): Promise<void> => {
    await api.delete(`/categories/${id}`);
};

export const getCategoryManga = async (id: number): Promise<any[]> => {
    const response = await api.get(`/categories/${id}/manga`);
    return response.data.manga;
};

export const addMangaToCategory = async (categoryId: number, mangaId: number): Promise<MangaCategory> => {
    const response = await api.post(`/categories/${categoryId}/manga/${mangaId}`);
    return response.data.manga_category;
};

export const removeMangaFromCategory = async (categoryId: number, mangaId: number): Promise<void> => {
    await api.delete(`/categories/${categoryId}/manga/${mangaId}`);
};

export const addToLibrary = async (payload: {
    title: string;
    url: string;
    thumbnail_url?: string;
    source: string;
}): Promise<LibraryAddResponse> => {
    const response = await api.post('/library', payload);
    return response.data;
};

export const getReadingHistory = async (): Promise<HistoryEntry[]> => {
    const response = await api.get('/history');
    return response.data.history;
};

export const getMangaHistory = async (mangaId: number): Promise<HistoryEntry[]> => {
    const response = await api.get(`/history/manga/${mangaId}`);
    return response.data.history;
};

export const addHistoryEntry = async (mangaId: number, chapterNumber: number): Promise<HistoryEntry> => {
    const response = await api.post('/history', null, {
        params: { manga_id: mangaId, chapter_number: chapterNumber }
    });
    return response.data.history;
};

export const deleteHistoryEntry = async (historyId: number): Promise<void> => {
    await api.delete(`/history/${historyId}`);
};

export const deleteMangaHistory = async (mangaId: number): Promise<void> => {
    await api.delete(`/history/manga/${mangaId}`);
};

export const clearHistory = async (): Promise<void> => {
    await api.delete('/history');
};

export const getReadingProgress = async (mangaId: number): Promise<ReadingProgress[]> => {
    const response = await api.get(`/history/progress/manga/${mangaId}`);
    return response.data.progress;
};

export const getChapterProgress = async (mangaId: number, chapterNumber: number): Promise<ReadingProgress> => {
    const response = await api.get(`/history/progress/manga/${mangaId}/chapter/${chapterNumber}`);
    return response.data.progress;
};

export const updateReadingProgress = async (mangaId: number, chapterNumber: number, pageNumber: number): Promise<ReadingProgress> => {
    const response = await api.post('/history/progress', null, {
        params: { manga_id: mangaId, chapter_number: chapterNumber, page_number: pageNumber }
    });
    return response.data.progress;
};

export const queueDownload = async (payload: {
    manga_title: string;
    manga_url: string;
    source: string;
    chapter_number: number;
    chapter_url: string;
    chapter_title?: string;
}) => {
    const response = await api.post('/downloads/queue', payload);
    return response.data;
};

export const getDownloads = async (): Promise<DownloadItem[]> => {
    const response = await api.get('/downloads');
    return response.data.downloads;
};

export const pauseDownload = async (downloadId: number) => {
    await api.post(`/downloads/${downloadId}/pause`);
};

export const resumeDownload = async (downloadId: number) => {
    await api.post(`/downloads/${downloadId}/resume`);
};

export const cancelDownload = async (downloadId: number) => {
    await api.post(`/downloads/${downloadId}/cancel`);
};

export const deleteDownloadFiles = async (downloadId: number) => {
    await api.delete(`/downloads/${downloadId}/files`);
};

export const checkUpdates = async () => {
    const response = await api.post('/updates/check');
    return response.data;
};

export const getUpdates = async (): Promise<UpdateItem[]> => {
    const response = await api.get('/updates');
    return response.data.updates;
};

export const markUpdateRead = async (chapterId: number) => {
    await api.post(`/updates/mark-read/${chapterId}`);
};

export const markChapterReadByManga = async (
    mangaId: number,
    chapterNumber: number,
    chapterUrl: string,
    chapterTitle?: string
) => {
    const response = await api.post('/updates/mark-read-by-manga', null, {
        params: { manga_id: mangaId, chapter_number: chapterNumber, chapter_url: chapterUrl, chapter_title: chapterTitle }
    });
    return response.data;
};

export const markChapterUnreadByUrl = async (chapterUrl: string) => {
    const response = await api.post('/updates/mark-unread-by-url', null, {
        params: { chapter_url: chapterUrl }
    });
    return response.data;
};

export const getChaptersReadStatus = async (mangaUrl: string): Promise<{
    manga_id: number | null;
    chapters: Array<{
        id: number;
        chapter_number: number;
        url: string;
        is_read: boolean;
    }>;
}> => {
    const response = await api.get('/updates/read-status', {
        params: { manga_url: mangaUrl }
    });
    return response.data;
};

export const getAppSettings = async (): Promise<Record<string, unknown>> => {
    const response = await api.get('/settings');
    return response.data.settings;
};

export const updateAppSetting = async (key: string, value: unknown) => {
    await api.put('/settings', { key, value });
};

// Tracker API functions
export async function getTrackers(): Promise<{ trackers: Tracker[] }> {
    const response = await api.get('/trackers');
    return response.data;
}

export async function getTrackerStatus(trackerName: string): Promise<TrackerStatus> {
    const response = await api.get(`/trackers/${trackerName}/status`);
    return response.data;
}

export async function connectTracker(trackerName: string): Promise<{ auth_url: string; state: string }> {
    const frontendOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
    const response = await api.get(`/trackers/${trackerName}/connect`, {
        params: frontendOrigin ? { frontend_origin: frontendOrigin } : undefined,
    });
    return response.data;
}

export async function disconnectTracker(trackerName: string): Promise<{ success: boolean }> {
    const response = await api.delete(`/trackers/${trackerName}/disconnect`);
    return response.data;
}

export async function searchTrackerManga(trackerName: string, query: string): Promise<{ results: TrackerManga[] }> {
    const response = await api.get(`/trackers/${trackerName}/search`, {
        params: { query }
    });
    return response.data;
}

export async function syncToTracker(
    trackerName: string,
    mangaId: number,
    chapterNumber: number
): Promise<{ success: boolean; queued?: boolean; queue_item_id?: number; detail?: string }> {
    const response = await api.post(`/trackers/${trackerName}/sync`, {
        manga_id: mangaId,
        chapter_number: chapterNumber,
    });
    return response.data;
}

export async function getTrackerMappings(trackerName: string): Promise<{ mappings: TrackerMapping[] }> {
    const response = await api.get(`/trackers/${trackerName}/mappings`);
    return response.data;
}

export async function createTrackerMapping(
    trackerName: string,
    mangaId: number,
    trackerMangaId: string,
    trackerUrl?: string
): Promise<{ mapping: TrackerMapping }> {
    const response = await api.post(`/trackers/${trackerName}/mappings`, null, {
        params: { manga_id: mangaId, tracker_manga_id: trackerMangaId, tracker_url: trackerUrl }
    });
    return response.data;
}

export async function deleteTrackerMapping(trackerName: string, mangaId: number): Promise<{ success: boolean }> {
    const response = await api.delete(`/trackers/${trackerName}/mappings`, {
        params: { manga_id: mangaId }
    });
    return response.data;
}

export async function getTrackerUserList(trackerName: string): Promise<{ manga_list: TrackerManga[] }> {
    const response = await api.get(`/trackers/${trackerName}/user-list`);
    return response.data;
}

export async function getSyncQueue(trackerName: string): Promise<{ queue: SyncQueueItem[] }> {
    const response = await api.get(`/trackers/${trackerName}/sync-queue`);
    return response.data;
}

export async function processSyncQueue(trackerName: string): Promise<{ processed: number }> {
    const response = await api.post(`/trackers/${trackerName}/sync-queue/process`);
    return response.data;
}
