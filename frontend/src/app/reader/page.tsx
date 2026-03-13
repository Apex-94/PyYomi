import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, addHistoryEntry, getProxyUrl, markChapterReadByManga } from '../../lib/api';
import { explainChapter } from '../../services/geminiService';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Maximize2,
  MoveHorizontal,
  ScrollText,
  Sparkles,
} from 'lucide-react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  LinearProgress,
  Paper,
  Slider,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';

type ReaderMode = 'single' | 'scroll';
type FitMode = 'fit-height' | 'fit-width';

function PageImage({
  url,
  index,
  source,
  singleMode,
  fitMode = 'fit-height',
  seamless = false,
}: {
  url: string;
  index: number;
  source: string | null;
  singleMode: boolean;
  fitMode?: FitMode;
  seamless?: boolean;
}) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const safeUrl = typeof url === 'string' ? url : '';

  const isImage = useMemo(
    () => safeUrl.length > 0 && (/\.(jpg|jpeg|png|gif|webp)($|\?)/i.test(safeUrl) || safeUrl.includes('picsum')),
    [safeUrl]
  );

  const proxyUrl = useMemo(() => {
    if (!isImage) return null;
    return getProxyUrl(safeUrl, source || undefined);
  }, [isImage, safeUrl, source]);

  useEffect(() => {
    let cancelled = false;
    setDisplayUrl(null);
    setLoading(true);
    setError(false);

    const resolveAndLoad = async () => {
      if (!safeUrl) {
        setError(true);
        setLoading(false);
        return;
      }

      try {
        const finalUrl = isImage
          ? proxyUrl
          : (await api.get('/manga/resolve', { params: { url: safeUrl, source } })).data.url;

        if (!finalUrl || cancelled) return;

        const preloader = new Image();
        preloader.onload = () => {
          if (cancelled) return;
          setNaturalSize({ width: preloader.naturalWidth, height: preloader.naturalHeight });
          setDisplayUrl(finalUrl);
          setLoading(false);
        };
        preloader.onerror = () => {
          if (cancelled) return;
          setError(true);
          setLoading(false);
        };
        preloader.src = finalUrl;
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    };

    void resolveAndLoad();
    return () => {
      cancelled = true;
    };
  }, [isImage, proxyUrl, safeUrl, source]);

  if (loading || !displayUrl) {
    return (
      <Box
        sx={{
          minHeight: singleMode ? '72vh' : '55vh',
          width: '100%',
          display: 'grid',
          placeItems: 'center',
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Box sx={{ display: 'grid', placeItems: 'center', gap: 1.25 }}>
          <CircularProgress size={24} thickness={4} />
          <Typography variant="caption" sx={{ letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
            Loading page {index + 1}
          </Typography>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          minHeight: singleMode ? '72vh' : '55vh',
          width: '100%',
          display: 'grid',
          placeItems: 'center',
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(216, 136, 127, 0.28)',
          color: '#f3c1bb',
        }}
      >
        Failed to load page {index + 1}
      </Box>
    );
  }

  const isTallPage = !!naturalSize && naturalSize.height > naturalSize.width * 1.45;
  const resolvedFitMode = singleMode && isTallPage ? 'fit-width' : fitMode;

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        lineHeight: 0,
        bgcolor: seamless ? '#ffffff' : 'transparent',
        mt: seamless && index > 0 ? '-1px' : 0,
      }}
    >
      <Box
        component="img"
        src={displayUrl}
        alt={`Page ${index + 1}`}
        loading={singleMode ? 'eager' : 'lazy'}
        sx={{
          display: 'block',
          maxWidth: '100%',
          width: singleMode ? (resolvedFitMode === 'fit-width' ? '100%' : 'auto') : '100%',
          height: singleMode ? (resolvedFitMode === 'fit-height' ? 'calc(100vh - 156px)' : 'auto') : 'auto',
          maxHeight: singleMode && resolvedFitMode === 'fit-height' ? 'calc(100vh - 156px)' : 'none',
          objectFit: 'contain',
          borderRadius: seamless ? 0 : (singleMode ? 2.5 : 2),
          boxShadow: singleMode ? '0 24px 70px rgba(0, 0, 0, 0.42)' : 'none',
          backgroundColor: seamless ? '#ffffff' : 'transparent',
        }}
      />
    </Box>
  );
}

export default function ReaderPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const chapterUrl = searchParams.get('chapter_url') || '';
  const source = searchParams.get('source');
  const mangaUrl = searchParams.get('manga_url');

  const [mode, setMode] = useState<ReaderMode>('single');
  const [dir, setDir] = useState<'ltr' | 'rtl'>('ltr');
  const [fitMode, setFitMode] = useState<FitMode>('fit-height');
  const [idx, setIdx] = useState(0);
  const [scrollIdx, setScrollIdx] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [chapterNote, setChapterNote] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { data, isError, isLoading } = useQuery({
    queryKey: ['pages', chapterUrl, source],
    enabled: !!chapterUrl,
    queryFn: async () => {
      const resp = await api.get('/manga/pages', { params: { chapter_url: chapterUrl, source } });
      return resp.data;
    },
    staleTime: 1000 * 60 * 10,
  });

  const { data: libraryManga } = useQuery({
    queryKey: ['library-manga', mangaUrl],
    enabled: !!mangaUrl,
    queryFn: async () => {
      const resp = await api.get('/library');
      return resp.data.manga?.find((m: any) => m.url === mangaUrl) ?? null;
    },
  });

  const pages: string[] = useMemo(() => data?.pages || [], [data]);
  const chapter = data?.chapter;
  const manga = data?.manga;
  const visiblePage = mode === 'scroll' ? scrollIdx : idx;
  const progress = pages.length > 0 ? ((visiblePage + 1) / pages.length) * 100 : 0;
  const isLongStripChapter = pages.length >= 40;
  const markReadMutation = useMutation({
    mutationFn: async () => {
      if (!libraryManga?.id || !chapter?.number) return;
      await markChapterReadByManga(libraryManga.id, chapter.number, chapterUrl, chapter.title);
      await addHistoryEntry(libraryManga.id, chapter.number);
    },
  });

  useEffect(() => {
    setIdx(0);
    setScrollIdx(0);
    setChapterNote(null);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  }, [chapterUrl]);

  useEffect(() => {
    if (pages.length === 0) return;
    if (isLongStripChapter) {
      setMode('scroll');
      setFitMode('fit-width');
      return;
    }
    setMode('single');
    setFitMode('fit-height');
  }, [chapterUrl, isLongStripChapter, pages.length]);

  useEffect(() => {
    if (chapter?.title && manga?.title) {
      explainChapter(chapter.title, manga.title).then(setChapterNote).catch(() => setChapterNote(null));
    }
  }, [chapter, manga]);

  useEffect(() => {
    if (mode !== 'single' || pages.length === 0) return;
    const prefetchTargets = [pages[idx + 1], pages[idx - 1]].filter((page): page is string => Boolean(page));
    prefetchTargets.forEach((pageUrl) => {
      const isImage = /\.(jpg|jpeg|png|gif|webp)($|\?)/i.test(pageUrl) || pageUrl.includes('picsum');
      if (isImage) {
        const img = new Image();
        img.src = getProxyUrl(pageUrl, source || undefined);
      }
    });
  }, [idx, mode, pages, source]);

  useEffect(() => {
    if (mode !== 'scroll' || !scrollRef.current || pages.length === 0) return;

    const node = scrollRef.current;
    const handleScroll = () => {
      const maxScroll = Math.max(node.scrollHeight - node.clientHeight, 1);
      const ratio = node.scrollTop / maxScroll;
      const nextIndex = Math.min(pages.length - 1, Math.max(0, Math.round(ratio * (pages.length - 1))));
      setScrollIdx(nextIndex);
    };

    handleScroll();
    node.addEventListener('scroll', handleScroll, { passive: true });
    return () => node.removeEventListener('scroll', handleScroll);
  }, [mode, pages.length]);

  const buildChapterUrl = (nextChapterUrl: string) =>
    `/reader?chapter_url=${encodeURIComponent(nextChapterUrl)}&source=${encodeURIComponent(source || '')}${
      mangaUrl ? `&manga_url=${encodeURIComponent(mangaUrl)}` : ''
    }`;

  const goToNextChapter = () => {
    if (!data?.next_slug) return;
    if (libraryManga?.id && chapter?.number) {
      markReadMutation.mutate();
    }
    navigate(buildChapterUrl(data.next_slug));
  };

  const goToPrevChapter = () => {
    if (!data?.prev_slug) return;
    navigate(buildChapterUrl(data.prev_slug));
  };

  const goPrev = () => setIdx((current) => Math.max(0, current - 1));
  const goNext = () => setIdx((current) => Math.min(pages.length - 1, current + 1));

  const atStart = idx === 0;
  const atEnd = idx >= pages.length - 1;

  const stepBackward = () => {
    if (dir === 'rtl') {
      if (atEnd && data?.next_slug) {
        goToNextChapter();
        return;
      }
      goNext();
      return;
    }

    if (atStart && data?.prev_slug) {
      goToPrevChapter();
      return;
    }
    goPrev();
  };

  const stepForward = () => {
    if (dir === 'rtl') {
      if (atStart && data?.prev_slug) {
        goToPrevChapter();
        return;
      }
      goPrev();
      return;
    }

    if (atEnd && data?.next_slug) {
      goToNextChapter();
      return;
    }
    goNext();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const nextKey = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      const prevKey = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';

      if (mode === 'single') {
        if (e.key === nextKey) {
          e.preventDefault();
          stepForward();
        }
        if (e.key === prevKey) {
          e.preventDefault();
          stepBackward();
        }
      } else {
        if (e.key === 'ArrowDown' || e.key === nextKey || e.key === ' ') {
          e.preventDefault();
          scrollRef.current?.scrollBy({ top: window.innerHeight * 0.88, behavior: 'smooth' });
        }
        if (e.key === 'ArrowUp' || e.key === prevKey) {
          e.preventDefault();
          scrollRef.current?.scrollBy({ top: -window.innerHeight * 0.88, behavior: 'smooth' });
        }
      }

      if (e.key.toLowerCase() === 'f') setShowControls((current) => !current);
      if (e.key === 'Escape') setShowControls(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [atEnd, atStart, data?.next_slug, data?.prev_slug, dir, mode, pages.length]);

  const onBackgroundClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button,a,[role="button"],input,textarea,select')) return;
    setShowControls((current) => !current);
  };

  if (!chapterUrl) {
    return <Typography sx={{ p: 3 }}>Provide `?chapter_url=...`</Typography>;
  }

  if (isError) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#0f1115', color: '#f3c1bb' }}>
        Failed to load chapter.
      </Box>
    );
  }

  if (isLoading || !data) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#0f1115', color: '#c8d0db' }}>
        Loading reader...
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        bgcolor: '#101216',
        color: '#f5f7fa',
        overflow: 'hidden',
      }}
    >
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          position: 'absolute',
          insetInline: 0,
          top: 0,
          height: 3,
          zIndex: 120,
          bgcolor: 'rgba(255,255,255,0.06)',
          '& .MuiLinearProgress-bar': {
            bgcolor: '#a8b7d2',
          },
        }}
      />

      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 110,
          transform: showControls ? 'translateY(0)' : 'translateY(-110%)',
          transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
          px: { xs: 1, sm: 2 },
          pt: 1,
        }}
      >
        <Paper
          sx={{
            mx: 'auto',
            maxWidth: 1280,
            bgcolor: 'rgba(24, 27, 33, 0.88)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(18px)',
            px: { xs: 1, sm: 1.5 },
            py: 0.875,
            borderRadius: 3,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
              <IconButton
                aria-label="go back"
                onClick={() => navigate(-1)}
                size="small"
                sx={{ color: '#f5f7fa', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <ChevronLeft size={18} />
              </IconButton>

              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 700, fontSize: { xs: '0.95rem', sm: '1rem' }, maxWidth: { xs: 180, sm: 320, md: 460 } }}>
                  {manga?.title}
                </Typography>
                <Typography noWrap variant="caption" sx={{ color: 'rgba(255,255,255,0.62)', maxWidth: { xs: 180, sm: 320, md: 460 } }}>
                  {chapter?.title || `Chapter ${chapter?.number ?? ''}`}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={mode}
                onChange={(_event, nextMode) => {
                  if (nextMode) setMode(nextMode);
                }}
              >
                <ToggleButton value="single" aria-label="single page mode">
                  <BookOpen size={16} />
                </ToggleButton>
                <ToggleButton value="scroll" aria-label="scroll mode">
                  <ScrollText size={16} />
                </ToggleButton>
              </ToggleButtonGroup>

              {mode === 'single' && (
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={fitMode}
                  onChange={(_event, nextFitMode) => {
                    if (nextFitMode) setFitMode(nextFitMode);
                  }}
                >
                  <ToggleButton value="fit-height" aria-label="fit by height">
                    <Maximize2 size={16} />
                  </ToggleButton>
                  <ToggleButton value="fit-width" aria-label="fit by width">
                    <MoveHorizontal size={16} />
                  </ToggleButton>
                </ToggleButtonGroup>
              )}

              <Button
                variant="outlined"
                onClick={() => setDir((current) => (current === 'ltr' ? 'rtl' : 'ltr'))}
                startIcon={<Columns2 size={16} />}
                sx={{ color: '#f5f7fa', borderColor: 'rgba(255,255,255,0.12)' }}
              >
                {dir === 'ltr' ? 'LTR' : 'RTL'}
              </Button>
            </Box>
          </Box>

          <Box sx={{ mt: 0.875, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Chip
              label={
                isLongStripChapter
                  ? `Long-strip chapter · ${pages.length} slices`
                  : mode === 'scroll'
                    ? `${pages.length} pages`
                    : `Page ${Math.min(idx + 1, Math.max(pages.length, 1))} of ${pages.length}`
              }
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#f5f7fa' }}
            />
            <Chip
              label={
                isLongStripChapter
                  ? 'Optimized for manhwa / webtoon reading'
                  : data?.next_slug && atEnd
                    ? 'Next click opens next chapter'
                    : data?.prev_slug && atStart
                      ? 'Back click opens previous chapter'
                      : mode === 'scroll'
                        ? 'Scroll mode'
                        : 'Single page mode'
              }
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.72)' }}
            />
          </Box>
        </Paper>
      </Box>

      {mode === 'scroll' ? (
        <Box
          ref={scrollRef}
          onClick={onBackgroundClick}
          sx={{
            height: '100%',
            overflowY: 'auto',
            px: { xs: 1, sm: 2 },
            pt: { xs: 11, sm: 13 },
            pb: { xs: 12, sm: 14 },
            bgcolor: isLongStripChapter ? '#ffffff' : 'transparent',
          }}
        >
          <Box sx={{ maxWidth: 920, mx: 'auto' }}>
            {chapterNote && (
              <Paper
                sx={{
                  mb: 2.5,
                  px: { xs: 1.5, sm: 2 },
                  py: 1.5,
                  bgcolor: 'rgba(24, 27, 33, 0.72)',
                  border: '1px solid rgba(168, 183, 210, 0.16)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                  <Sparkles size={14} color="#a8b7d2" />
                  <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.12em', color: '#a8b7d2', fontWeight: 800 }}>
                    Chapter note
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.82)', lineHeight: 1.7 }}>
                  {chapterNote}
                </Typography>
              </Paper>
            )}

            <Box
              sx={{
                display: 'grid',
                gap: isLongStripChapter ? 0 : 1.25,
                direction: dir,
                overflow: 'hidden',
                lineHeight: 0,
                bgcolor: isLongStripChapter ? '#ffffff' : 'transparent',
              }}
            >
              {pages.map((page, pageIndex) => (
                <PageImage
                  key={`${chapterUrl}-${pageIndex}`}
                  url={page}
                  index={pageIndex}
                  source={source}
                  singleMode={false}
                  seamless={isLongStripChapter}
                />
              ))}
            </Box>

            <Box sx={{ mt: 3, display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <Button
                variant="outlined"
                onClick={goToPrevChapter}
                disabled={!data?.prev_slug}
                startIcon={<ChevronLeft size={16} />}
                sx={{ py: 1.35, borderColor: 'rgba(255,255,255,0.12)', color: '#f5f7fa' }}
              >
                Previous chapter
              </Button>
              <Button
                variant="contained"
                onClick={goToNextChapter}
                disabled={!data?.next_slug}
                endIcon={<ChevronRight size={16} />}
                sx={{ py: 1.35 }}
              >
                Next chapter
              </Button>
            </Box>
          </Box>
        </Box>
      ) : (
        <Box
          onClick={onBackgroundClick}
          sx={{
            height: '100%',
            position: 'relative',
            overflow: 'auto',
            display: 'grid',
            placeItems: 'center',
            px: { xs: 0.5, sm: 1.25 },
            pt: { xs: 8.5, sm: 9.5 },
            pb: { xs: 7.5, sm: 8.5 },
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              insetY: 0,
              left: 0,
              width: { xs: '18%', md: '14%' },
              zIndex: 60,
              cursor: 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation();
              stepBackward();
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              insetY: 0,
              right: 0,
              width: { xs: '18%', md: '14%' },
              zIndex: 60,
              cursor: 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation();
              stepForward();
            }}
          />

          <Box
            sx={{
              width: '100%',
              maxWidth: fitMode === 'fit-width' ? 1320 : 1180,
              position: 'relative',
              zIndex: 40,
              mx: 'auto',
            }}
          >
            <PageImage url={pages[idx]} index={idx} source={source} singleMode fitMode={fitMode} />
          </Box>

          {!isMobile && (
            <>
              <Tooltip title={dir === 'rtl' ? 'Next page / next chapter' : 'Previous page / previous chapter'}>
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    stepBackward();
                  }}
                  sx={{
                    position: 'absolute',
                    left: 24,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 70,
                    color: '#f5f7fa',
                    bgcolor: 'rgba(18, 20, 24, 0.72)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    '&:hover': {
                      bgcolor: 'rgba(30, 34, 40, 0.92)',
                    },
                  }}
                >
                  <ArrowLeft size={28} />
                </IconButton>
              </Tooltip>
              <Tooltip title={dir === 'rtl' ? 'Previous page / previous chapter' : 'Next page / next chapter'}>
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    stepForward();
                  }}
                  sx={{
                    position: 'absolute',
                    right: 24,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 70,
                    color: '#f5f7fa',
                    bgcolor: 'rgba(18, 20, 24, 0.72)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    '&:hover': {
                      bgcolor: 'rgba(30, 34, 40, 0.92)',
                    },
                  }}
                >
                  <ArrowRight size={28} />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      )}

      <Box
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 110,
          transform: showControls ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
          px: { xs: 1.25, sm: 2.5 },
          pb: 1,
        }}
      >
        <Paper
          sx={{
            mx: 'auto',
            maxWidth: mode === 'scroll' ? 920 : 960,
            bgcolor: 'rgba(24, 27, 33, 0.88)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(18px)',
            px: { xs: 1, sm: 1.5 },
            py: 0.875,
            borderRadius: 3,
          }}
        >
          {mode === 'scroll' ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="text"
                onClick={goToPrevChapter}
                disabled={!data?.prev_slug}
                startIcon={<ChevronLeft size={16} />}
                sx={{ color: '#f5f7fa', minWidth: 0 }}
              >
                Previous chapter
              </Button>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.68)' }}>
                Progress {Math.min(scrollIdx + 1, pages.length)} / {pages.length}
              </Typography>
              <Button
                variant="text"
                onClick={goToNextChapter}
                disabled={!data?.next_slug}
                endIcon={<ChevronRight size={16} />}
                sx={{ color: '#f5f7fa', minWidth: 0 }}
              >
                Next chapter
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'auto 1fr auto', sm: 'auto 1fr auto auto' }, gap: 0.75, alignItems: 'center' }}>
              <Button
                variant="text"
                onClick={stepBackward}
                startIcon={<ChevronLeft size={16} />}
                sx={{ color: '#f5f7fa', minWidth: 0 }}
              >
                {!isMobile ? 'Back' : ''}
              </Button>

              <Box sx={{ px: { xs: 0.5, sm: 1 } }}>
                <Slider
                  min={1}
                  max={Math.max(pages.length, 1)}
                  value={Math.min(idx + 1, Math.max(pages.length, 1))}
                  onChange={(_event, value) => setIdx(Number(value) - 1)}
                  marks={!isMobile ? [{ value: 1, label: '1' }, { value: pages.length, label: String(pages.length) }] : false}
                  sx={{
                    color: '#a8b7d2',
                    '& .MuiSlider-thumb': { width: 14, height: 14 },
                    '& .MuiSlider-markLabel': { color: 'rgba(255,255,255,0.56)' },
                    '& .MuiSlider-rail': { opacity: 0.24 },
                  }}
                />
              </Box>

              <TextField
                size="small"
                value={idx + 1}
                onChange={(e) => {
                  const nextPage = Number(e.target.value);
                  if (Number.isFinite(nextPage) && nextPage >= 1 && nextPage <= pages.length) {
                    setIdx(nextPage - 1);
                  }
                }}
                inputProps={{
                  inputMode: 'numeric',
                  style: { textAlign: 'center', width: isMobile ? 28 : 36 },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255,255,255,0.04)',
                    color: '#f5f7fa',
                  },
                }}
              />

              <Button
                variant="text"
                onClick={stepForward}
                endIcon={<ChevronRight size={16} />}
                sx={{ color: '#f5f7fa', minWidth: 0, display: { xs: 'none', sm: 'inline-flex' } }}
              >
                Forward
              </Button>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
