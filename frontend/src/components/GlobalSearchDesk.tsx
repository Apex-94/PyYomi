import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { AlertTriangle, Clock3, RadioTower } from 'lucide-react';
import { createGlobalSearchSession, getGlobalSearchSession, getProxyUrl } from '../lib/api';
import {
  GlobalSearchSessionSnapshot,
  GlobalSearchSessionSource,
  SearchResultItem,
} from '../types';
import { useAniListMetadataMap } from '../hooks/useAniListMetadataMap';
import { MangaCard } from './MangaCard';
import type { LibraryMangaRecord } from '../hooks/useLibraryState';

interface GlobalSearchDeskProps {
  query: string;
  page: number;
  activeSourceId?: string | null;
  pendingUrls: Record<string, boolean>;
  isInLibrary: (url: string) => boolean;
  getLibraryManga: (url: string) => LibraryMangaRecord | undefined;
  onAddToLibrary: (item: SearchResultItem) => void;
  onRemoveFromLibrary: (url: string) => void;
  onPreview: (item: SearchResultItem) => void;
  onOpenLibrary: () => void;
  onSetCategories: (mangaId?: number, mangaTitle?: string) => void;
}

const TERMINAL_STATUSES = new Set(['complete', 'failed', 'timed_out']);

function normalizeStatus(raw?: string | null): 'Ongoing' | 'Completed' | 'Hiatus' {
  const value = (raw || '').trim().toLowerCase();
  if (value.includes('complete')) return 'Completed';
  if (value.includes('hiatus')) return 'Hiatus';
  return 'Ongoing';
}

export default function GlobalSearchDesk({
  query,
  page,
  activeSourceId,
  pendingUrls,
  isInLibrary,
  getLibraryManga,
  onAddToLibrary,
  onRemoveFromLibrary,
  onPreview,
  onOpenLibrary,
  onSetCategories,
}: GlobalSearchDeskProps) {
  const normalizedQuery = query.trim();
  const [searchRun, setSearchRun] = useState(0);

  const sessionCreateQuery = useQuery({
    queryKey: ['global-search-session-create', normalizedQuery, page, searchRun],
    queryFn: () => createGlobalSearchSession(normalizedQuery, page),
    enabled: normalizedQuery.length > 0,
    staleTime: Infinity,
    retry: false,
  });

  const sessionId = sessionCreateQuery.data?.session_id;

  const sessionStatusQuery = useQuery({
    queryKey: ['global-search-session-status', sessionId],
    queryFn: () => getGlobalSearchSession(sessionId!),
    enabled: !!sessionId,
    placeholderData: sessionCreateQuery.data,
    retry: false,
    refetchInterval: (queryInfo) => {
      const snapshot = queryInfo.state.data as GlobalSearchSessionSnapshot | undefined;
      return snapshot?.done ? false : 750;
    },
  });

  const session = sessionStatusQuery.data ?? sessionCreateQuery.data;

  const finishedSources = useMemo(() => {
    if (!session) return [];
    const terminalSources = session.sources.filter((source) => TERMINAL_STATUSES.has(source.status));
    if (!activeSourceId) {
      return terminalSources;
    }
    const activeIndex = terminalSources.findIndex((source) => source.source_id === activeSourceId);
    if (activeIndex <= 0) {
      return terminalSources;
    }
    const activeSource = terminalSources[activeIndex];
    const remaining = terminalSources.filter((source) => source.source_id !== activeSourceId);
    return [activeSource, ...remaining];
  }, [activeSourceId, session]);

  if (!normalizedQuery) {
    return (
      <SearchDeskShell>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
          Global Search Desk
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 640, mt: 1 }}>
          Search all loaded sources at once. Results will appear lane by lane as each source finishes, and
          source-specific filters stay off in this mode because each site exposes different filter schemas.
        </Typography>
      </SearchDeskShell>
    );
  }

  if (sessionCreateQuery.isError) {
    return (
      <SearchDeskShell>
        <Alert severity="error">
          {sessionCreateQuery.error instanceof Error ? sessionCreateQuery.error.message : 'Failed to start global search.'}
        </Alert>
      </SearchDeskShell>
    );
  }

  const stillWorking = (session?.pending_sources || 0) + (session?.running_sources || 0);
  const noFinishedLanes = finishedSources.length === 0;

  return (
    <SearchDeskShell>
      <Paper
        sx={{
          p: { xs: 2, md: 2.5 },
          borderRadius: 4,
          border: 1,
          borderColor: 'divider',
          background: (theme) =>
            theme.palette.mode === 'light'
              ? 'linear-gradient(140deg, rgba(247, 239, 228, 0.96), rgba(255, 250, 244, 0.98))'
              : 'linear-gradient(140deg, rgba(39, 28, 24, 0.98), rgba(23, 20, 18, 0.98))',
          boxShadow: (theme) =>
            theme.palette.mode === 'light'
              ? '0 18px 34px rgba(88, 56, 34, 0.08)'
              : '0 18px 34px rgba(0, 0, 0, 0.24)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
          }}
        >
          <Box>
            <Typography variant="overline" sx={{ letterSpacing: '0.18em', fontWeight: 800, color: 'text.secondary' }}>
              Global Search
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
              Search desk for “{normalizedQuery}”
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <Chip
              icon={<RadioTower size={14} />}
              label={session?.done ? 'Search complete' : 'Searching across sources'}
              color={session?.done ? 'success' : 'primary'}
              variant={session?.done ? 'filled' : 'outlined'}
            />
            <Button
              variant="contained"
              size="small"
              onClick={() => setSearchRun((value) => value + 1)}
              disabled={sessionCreateQuery.isFetching}
              sx={{ minHeight: 32, px: 1.5, borderRadius: 999 }}
            >
              Search again
            </Button>
          </Box>
        </Box>

        <Typography color="text.secondary" sx={{ mt: 1.25, maxWidth: 720 }}>
          Global mode ignores source-specific filters so results can stream in cleanly from every loaded source.
        </Typography>

        <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip label={`${session?.total_sources || 0} total`} />
          <Chip color="success" label={`${session?.completed_sources || 0} completed`} />
          <Chip color="warning" label={`${stillWorking} working`} />
          <Chip color="error" label={`${(session?.failed_sources || 0) + (session?.timed_out_sources || 0)} issues`} />
          <Chip variant="outlined" label={`Page ${session?.page || page}`} />
        </Box>
      </Paper>

      {sessionStatusQuery.isError && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {sessionStatusQuery.error instanceof Error ? sessionStatusQuery.error.message : 'Polling global search failed.'}
        </Alert>
      )}

      {noFinishedLanes ? (
        <Paper
          sx={{
            mt: 2.5,
            p: 4,
            borderRadius: 4,
            border: 1,
            borderStyle: 'dashed',
            borderColor: 'divider',
            textAlign: 'center',
          }}
        >
          <CircularProgress size={26} />
          <Typography variant="h6" sx={{ mt: 2, fontWeight: 700 }}>
            Scanning sources
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            Fast sources will appear here first. Slower sources keep filling in as they finish.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={2.5} sx={{ mt: 2.5 }}>
          {finishedSources.map((source) => (
            <SourceLane
              key={`${source.source_id}-${source.status}-${source.result_count}`}
              source={source}
              isPinned={source.source_id === activeSourceId}
              pendingUrls={pendingUrls}
              isInLibrary={isInLibrary}
              getLibraryManga={getLibraryManga}
              onAddToLibrary={onAddToLibrary}
              onRemoveFromLibrary={onRemoveFromLibrary}
              onPreview={onPreview}
              onOpenLibrary={onOpenLibrary}
              onSetCategories={onSetCategories}
            />
          ))}
        </Stack>
      )}
    </SearchDeskShell>
  );
}

function SearchDeskShell({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column' }}>
      {children}
    </Box>
  );
}

function SourceLane({
  source,
  isPinned,
  pendingUrls,
  isInLibrary,
  getLibraryManga,
  onAddToLibrary,
  onRemoveFromLibrary,
  onPreview,
  onOpenLibrary,
  onSetCategories,
}: {
  source: GlobalSearchSessionSource;
  isPinned: boolean;
  pendingUrls: Record<string, boolean>;
  isInLibrary: (url: string) => boolean;
  getLibraryManga: (url: string) => LibraryMangaRecord | undefined;
  onAddToLibrary: (item: SearchResultItem) => void;
  onRemoveFromLibrary: (url: string) => void;
  onPreview: (item: SearchResultItem) => void;
  onOpenLibrary: () => void;
  onSetCategories: (mangaId?: number, mangaTitle?: string) => void;
}) {
  if (source.status === 'failed' || source.status === 'timed_out') {
    return (
      <Paper sx={{ p: 2, borderRadius: 3, border: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {source.source_name}
          </Typography>
          <Chip
            icon={source.status === 'timed_out' ? <Clock3 size={14} /> : <AlertTriangle size={14} />}
            label={source.status === 'timed_out' ? 'Timed out' : 'Failed'}
            color="error"
            variant="outlined"
          />
        </Box>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {source.error || 'This source could not finish the search.'}
        </Typography>
      </Paper>
    );
  }

  if (source.status === 'complete' && source.result_count === 0) {
    return (
      <Paper sx={{ p: 2, borderRadius: 3, border: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {source.source_name}
          </Typography>
          <Chip label="No matches" variant="outlined" />
        </Box>
      </Paper>
    );
  }

  return (
    <SourceLaneResults
      source={source}
      isPinned={isPinned}
      pendingUrls={pendingUrls}
      isInLibrary={isInLibrary}
      getLibraryManga={getLibraryManga}
      onAddToLibrary={onAddToLibrary}
      onRemoveFromLibrary={onRemoveFromLibrary}
      onPreview={onPreview}
      onOpenLibrary={onOpenLibrary}
      onSetCategories={onSetCategories}
    />
  );
}

function SourceLaneResults({
  source,
  isPinned,
  pendingUrls,
  isInLibrary,
  getLibraryManga,
  onAddToLibrary,
  onRemoveFromLibrary,
  onPreview,
  onOpenLibrary,
  onSetCategories,
}: {
  source: GlobalSearchSessionSource;
  isPinned: boolean;
  pendingUrls: Record<string, boolean>;
  isInLibrary: (url: string) => boolean;
  getLibraryManga: (url: string) => LibraryMangaRecord | undefined;
  onAddToLibrary: (item: SearchResultItem) => void;
  onRemoveFromLibrary: (url: string) => void;
  onPreview: (item: SearchResultItem) => void;
  onOpenLibrary: () => void;
  onSetCategories: (mangaId?: number, mangaTitle?: string) => void;
}) {
  const { byKey: metaByUrl } = useAniListMetadataMap(
    source.results.map((item) => ({ key: item.url, title: item.title }))
  );

  return (
    <Paper
      sx={{
        p: { xs: 1.5, md: 2 },
        borderRadius: 3.5,
        border: 1,
        borderColor: isPinned ? 'primary.main' : 'divider',
        background: (theme) =>
          theme.palette.mode === 'light'
            ? 'linear-gradient(180deg, rgba(255, 250, 244, 0.94), rgba(250, 243, 234, 0.92))'
            : 'linear-gradient(180deg, rgba(31, 24, 22, 0.98), rgba(24, 20, 18, 0.98))',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.25,
          mb: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {source.source_name}
          </Typography>
          {isPinned && <Chip label="Active source" color="primary" size="small" />}
          <Chip label={`${source.result_count} result${source.result_count === 1 ? '' : 's'}`} size="small" variant="outlined" />
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Source lane
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'flex',
          gap: 1.75,
          overflowX: 'auto',
          pb: 0.5,
          pr: 0.25,
          scrollSnapType: 'x proximity',
          '& > *': { scrollSnapAlign: 'start' },
        }}
      >
        {source.results.map((item, index) => {
          const meta = metaByUrl.get(item.url);
          const inLibrary = isInLibrary(item.url);
          const pending = !!pendingUrls[item.url];
          const libraryRecord = getLibraryManga(item.url);

          return (
            <Box
              key={`${item.url}-${index}`}
              sx={{ minWidth: 220, maxWidth: 220, flex: '0 0 220px' }}
              onClick={() => onPreview(item)}
            >
              <MangaCard
                manga={{
                  id: item.url,
                  title: item.title,
                  altTitle: '',
                  author: meta?.author || null,
                  status: (meta?.status as 'Ongoing' | 'Completed' | 'Hiatus') || normalizeStatus(item.status),
                  genres: item.genres || [],
                  description: meta?.description || item.description || '',
                  coverUrl: item.thumbnail_url ? getProxyUrl(item.thumbnail_url, item.source) : (meta?.cover_url || ''),
                  rating: meta?.rating_10 || 0,
                  chapters: [],
                }}
                mangaSource={item.source}
                libraryButtonState={pending ? 'adding' : (inLibrary ? 'in_library' : 'not_in_library')}
                onAddToLibrary={() => onAddToLibrary(item)}
                onOpenInLibrary={onOpenLibrary}
                onSetCategories={() => onSetCategories(libraryRecord?.id, item.title)}
                onRemoveFromLibrary={() => onRemoveFromLibrary(item.url)}
                actionMode="auto"
                showStatusBadge
              />
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}
