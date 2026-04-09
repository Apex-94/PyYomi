import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  api,
  getProxyUrl,
  addHistoryEntry,
  markChapterReadByManga,
  resolveImageUrl,
} from "../../lib/api";
import {
  ChevronLeft,
  ArrowLeft,
  ArrowRight,
  Settings2,
  Menu,
  X,
} from "lucide-react";
import {
  Box,
  Typography,
  Paper,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
  Drawer,
  Slider,
  Stack,
  Divider,
  Switch,
  FormControlLabel,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

type ReaderMode = "scroll" | "single";
type ReaderDir = "ltr" | "rtl";
type ZoomMode = "fit-width" | "fit-height" | "custom";
type ContentMode = "manga" | "manhwa";

function PageImage({
  url,
  index,
  mode,
  source,
  zoomMode = "fit-height",
  customZoom = 100,
  contentMode = "manga",
}: {
  url: string;
  index: number;
  mode: ReaderMode;
  source: string | null;
  zoomMode?: ZoomMode;
  customZoom?: number;
  contentMode?: ContentMode;
}) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setDisplayUrl(null);
    setLoading(true);
    setError(false);

    const resolveAndLoad = async () => {
      try {
        const finalUrl = await resolveImageUrl(url, source || undefined);

        if (!finalUrl || cancelled) return;

        const preloader = new Image();

        preloader.onload = () => {
          if (cancelled) return;
          setDisplayUrl(finalUrl);
          setLoading(false);
        };

        preloader.onerror = () => {
          if (cancelled) return;
          setError(true);
          setLoading(false);
        };

        preloader.src = finalUrl;
      } catch (err) {
        console.error("Failed to resolve image", err);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    };

    resolveAndLoad();

    return () => {
      cancelled = true;
    };
  }, [url, source]);

  const getImageStyles = (): React.CSSProperties => {
    const baseStyles: any = {
      objectFit: "contain",
      display: "block",
      maxWidth: "100%",
      userSelect: "none",
      WebkitUserDrag: "none",
      marginBottom: mode === "scroll" ? "0.75rem" : "0.5rem",
    };

    if (mode === "scroll") {
      return {
        ...baseStyles,
        width: "100%",
        height: "auto",
      };
    }

    // Single page mode with zoom
    let width: string | number = "auto";
    let height: string | number = "min(92vh, 1200px)";

    if (zoomMode === "fit-width") {
      width = "100%";
      height = "auto";
    } else if (zoomMode === "fit-height") {
      width = "auto";
      height = "min(92vh, 1200px)";
    } else if (zoomMode === "custom") {
      width = `${customZoom}%`;
      height = "auto";
    }

    return {
      ...baseStyles,
      width,
      height,
    } as React.CSSProperties;
  };

  if (error) {
    return (
      <Box
        sx={{
          display: "grid",
          placeItems: "center",
          bgcolor: "#111827",
          color: "#ef4444",
          height: "24rem",
          width: "100%",
          mb: 1,
          borderRadius: 2,
        }}
      >
        Failed to load page {index + 1}
      </Box>
    );
  }

  if (loading || !displayUrl) {
    return (
      <Box
        sx={{
          display: "grid",
          placeItems: "center",
          bgcolor: "#111827",
          color: "#9ca3af",
          height: { xs: "50vh", md: "60vh" },
          width: "100%",
          mb: 1,
          borderRadius: 2,
        }}
      >
        <Typography
          variant="caption"
          sx={{ textTransform: "uppercase", letterSpacing: "0.18em" }}
        >
          Loading...
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        width: "100%",
        scrollSnapAlign: mode === "scroll" ? "start" : "none",
        scrollSnapStop: mode === "scroll" ? "always" : "normal",
      }}
    >
      <img
        src={displayUrl}
        alt={`p${index + 1}`}
        loading={mode === "single" ? "eager" : "lazy"}
        style={getImageStyles()}
      />
    </Box>
  );
}

export default function ReaderPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const chapterUrl = searchParams.get("chapter_url") || "";
  const source = searchParams.get("source");
  const mangaUrl = searchParams.get("manga_url");

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [mode, setMode] = useState<ReaderMode>("single");
  const [dir, setDir] = useState<ReaderDir>("ltr");
  const [idx, setIdx] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [zoomMode, setZoomMode] = useState<ZoomMode>("fit-height");
  const [customZoom, setCustomZoom] = useState(100);
  const [contentMode, setContentMode] = useState<ContentMode>("manga");
  const [filters, setFilters] = useState({
    brightness: 100,
    saturation: 100,
    blueLight: 0,
  });
  const [bookmarks, setBookmarks] = useState<Set<number>>(new Set());
  const [pageReadTime, setPageReadTime] = useState<{ [key: number]: number }>({});

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const { data, isError } = useQuery({
    queryKey: ["pages", chapterUrl, source],
    enabled: !!chapterUrl,
    queryFn: async () => {
      const resp = await api.get("/manga/pages", {
        params: { chapter_url: chapterUrl, source },
      });
      return resp.data;
    },
    staleTime: 1000 * 60 * 10,
  });

  const { data: libraryManga } = useQuery({
    queryKey: ["library-manga", mangaUrl],
    enabled: !!mangaUrl,
    queryFn: async () => {
      const resp = await api.get("/library");
      const manga = resp.data.manga?.find((m: any) => m.url === mangaUrl);
      return manga || null;
    },
  });

  const pages: string[] = useMemo(() => data?.pages || [], [data]);
  const chapter = data?.chapter;
  const manga = data?.manga;

  const markReadMutation = useMutation({
    mutationFn: async () => {
      if (!libraryManga?.id || !chapter?.number) return;
      await markChapterReadByManga(
        libraryManga.id,
        chapter.number,
        chapterUrl,
        chapter.title
      );
      await addHistoryEntry(libraryManga.id, chapter.number);
    },
    onSuccess: () => {
      console.log("Chapter marked as read");
    },
    onError: (error) => {
      console.error("Failed to mark chapter as read:", error);
    },
  });

  useEffect(() => {
    if (mode !== "single" || pages.length === 0) return;

    const prefetchTargets = [pages[idx + 1], pages[idx - 1]].filter(
      (p): p is string => Boolean(p)
    );

    prefetchTargets.forEach((pageUrl) => {
      resolveImageUrl(pageUrl, source || undefined)
        .then((finalUrl) => {
          const img = new Image();
          img.src = finalUrl;
        })
        .catch(() => {
          // best-effort prefetch
        });
    });
  }, [idx, mode, pages, source]);

  useEffect(() => {
    setIdx(0);
    setShowControls(true);
    window.scrollTo(0, 0);

    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [chapterUrl]);

  useEffect(() => {
    // Load filters and reader preferences from localStorage
    try {
      const saved = localStorage.getItem("readerFilters");
      if (saved) {
        setFilters(JSON.parse(saved));
      }
      const savedZoom = localStorage.getItem("readerZoomMode");
      if (savedZoom) setZoomMode(savedZoom as ZoomMode);
      const savedCustomZoom = localStorage.getItem("readerCustomZoom");
      if (savedCustomZoom) setCustomZoom(Number(savedCustomZoom));
      const savedContentMode = localStorage.getItem("readerContentMode");
      if (savedContentMode) setContentMode(savedContentMode as ContentMode);
    } catch (e) {
      console.warn("Failed to load reader preferences", e);
    }
  }, []);

  // Persist filters and preferences
  useEffect(() => {
    try {
      localStorage.setItem("readerFilters", JSON.stringify(filters));
      localStorage.setItem("readerZoomMode", zoomMode);
      localStorage.setItem("readerCustomZoom", String(customZoom));
      localStorage.setItem("readerContentMode", contentMode);
    } catch (e) {
      console.warn("Failed to save reader preferences", e);
    }
  }, [filters, zoomMode, customZoom, contentMode]);

  useEffect(() => {
    // Load bookmarks from localStorage
    try {
      const key = `bookmarks:${mangaUrl}:${chapterUrl}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        setBookmarks(new Set(JSON.parse(saved)));
      }
    } catch (e) {
      console.warn("Failed to load bookmarks", e);
    }
  }, [chapterUrl, mangaUrl]);

  useEffect(() => {
    // Save bookmarks to localStorage
    try {
      const key = `bookmarks:${mangaUrl}:${chapterUrl}`;
      if (bookmarks.size > 0) {
        localStorage.setItem(key, JSON.stringify(Array.from(bookmarks)));
      } else {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn("Failed to save bookmarks", e);
    }
  }, [bookmarks, chapterUrl, mangaUrl]);

  useEffect(() => {
    // Track page read time
    const startTime = Date.now();
    const cleanup = () => {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000); // in seconds
      if (timeSpent > 1) {
        // Only track if spent more than 1 second
        setPageReadTime((prev) => {
          const updated = { ...prev };
          updated[idx] = (prev[idx] || 0) + timeSpent;
          return updated;
        });
      }
    };
    return cleanup;
  }, [idx]);

  useEffect(() => {
    if (mode !== "single" || !immersive) {
      setShowControls(true);
      return;
    }

    const resetTimer = () => {
      setShowControls(true);

      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }

      hideTimerRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 1800);
    };

    resetTimer();

    const onMove = () => resetTimer();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchstart", onMove);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchstart", onMove);

      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, [mode, immersive, idx]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const nextKey = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
      const prevKey = dir === "rtl" ? "ArrowRight" : "ArrowLeft";

      if (mode === "single") {
        if (e.key === nextKey) {
          if (idx >= pages.length - 1 && data?.next_slug) {
            goToNextChapter();
          } else {
            setIdx((i) => Math.min(pages.length - 1, i + 1));
          }
        }

        if (e.key === prevKey) {
          if (idx === 0 && data?.prev_slug) {
            goToPrevChapter();
          } else {
            setIdx((i) => Math.max(0, i - 1));
          }
        }
      } else {
        if (e.key === "ArrowDown" || e.key === nextKey) {
          scrollRef.current?.scrollBy({
            top: window.innerHeight * 0.9,
            behavior: "smooth",
          });
        }

        if (e.key === "ArrowUp" || e.key === prevKey) {
          scrollRef.current?.scrollBy({
            top: -window.innerHeight * 0.9,
            behavior: "smooth",
          });
        }
      }

      if (e.key.toLowerCase() === "f") setShowControls((s) => !s);
      if (e.key.toLowerCase() === "b") {
        setBookmarks((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(idx)) {
            newSet.delete(idx);
          } else {
            newSet.add(idx);
          }
          return newSet;
        });
      }
      if (e.key === "Escape") {
        setShowControls(true);
        setSettingsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dir, mode, pages.length, idx, data?.next_slug, data?.prev_slug]);

  if (!chapterUrl) {
    return (
      <Typography variant="body1" sx={{ p: 3 }}>
        Provide ?chapter_url=â€¦
      </Typography>
    );
  }

  if (isError) {
    return (
      <Box
        sx={{
          display: "grid",
          placeItems: "center",
          height: "100vh",
          bgcolor: "black",
        }}
      >
        <Typography sx={{ color: "#ef4444" }}>Failed to load chapter.</Typography>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box
        sx={{
          display: "grid",
          placeItems: "center",
          height: "100vh",
          bgcolor: "black",
          color: "#9ca3af",
        }}
      >
        Loading Reader...
      </Box>
    );
  }

  const buildChapterUrl = (nextChapterUrl: string) =>
    `/reader?chapter_url=${encodeURIComponent(nextChapterUrl)}&source=${encodeURIComponent(
      source || ""
    )}${mangaUrl ? `&manga_url=${encodeURIComponent(mangaUrl)}` : ""}`;

  const goPrev = () => setIdx((i) => Math.max(0, i - 1));
  const goNext = () => setIdx((i) => Math.min(pages.length - 1, i + 1));

  const goToNextChapter = () => {
    if (data?.next_slug) {
      if (libraryManga?.id && chapter?.number) {
        markReadMutation.mutate();
      }
      navigate(buildChapterUrl(data.next_slug));
    }
  };

  const goToPrevChapter = () => {
    if (data?.prev_slug) {
      navigate(buildChapterUrl(data.prev_slug));
    }
  };

  const onLeftClick = () => {
    const isRtl = dir === "rtl";
    const atStart = idx === 0;
    const atEnd = idx >= pages.length - 1;

    if (isRtl) {
      atEnd && data?.next_slug ? goToNextChapter() : goNext();
    } else {
      atStart && data?.prev_slug ? goToPrevChapter() : goPrev();
    }
  };

  const onRightClick = () => {
    const isRtl = dir === "rtl";
    const atStart = idx === 0;
    const atEnd = idx >= pages.length - 1;

    if (isRtl) {
      atStart && data?.prev_slug ? goToPrevChapter() : goPrev();
    } else {
      atEnd && data?.next_slug ? goToNextChapter() : goNext();
    }
  };

  const leftDisabled =
    dir === "rtl"
      ? idx >= pages.length - 1 && !data?.next_slug
      : idx === 0 && !data?.prev_slug;

  const rightDisabled =
    dir === "rtl"
      ? idx === 0 && !data?.prev_slug
      : idx >= pages.length - 1 && !data?.next_slug;

  const onBackgroundClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button,a,[role='button'],input,textarea,select")) return;
    setShowControls((s) => !s);
  };

  const settingsPanel = (
    <Box
      sx={{
        width: 320,
        maxWidth: "100vw",
        bgcolor: "#0b1220",
        color: "white",
        height: "100%",
        p: 2,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
          Reader Settings
        </Typography>
        <IconButton onClick={() => setSettingsOpen(false)} sx={{ color: "#9ca3af" }}>
          <X size={18} />
        </IconButton>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", mb: 2 }} />

      <Typography
        variant="caption"
        sx={{ color: "#94a3b8", mb: 1, display: "block", fontWeight: 700 }}
      >
        Reading Mode
      </Typography>

      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={(_, newMode: ReaderMode | null) => newMode && setMode(newMode)}
        fullWidth
        size="small"
        sx={{
          mb: 2,
          "& .MuiToggleButton-root": {
            color: "#cbd5e1",
            borderColor: "#1f2937",
            textTransform: "none",
            fontWeight: 700,
            "&.Mui-selected": {
              bgcolor: "#4f46e5",
              color: "white",
            },
          },
        }}
      >
        <ToggleButton value="single">Single</ToggleButton>
        <ToggleButton value="scroll">Scroll</ToggleButton>
      </ToggleButtonGroup>

      <Typography
        variant="caption"
        sx={{ color: "#94a3b8", mb: 1, display: "block", fontWeight: 700 }}
      >
        Reading Direction
      </Typography>

      <ToggleButtonGroup
        value={dir}
        exclusive
        onChange={(_, newDir: ReaderDir | null) => newDir && setDir(newDir)}
        fullWidth
        size="small"
        sx={{
          mb: 2,
          "& .MuiToggleButton-root": {
            color: "#cbd5e1",
            borderColor: "#1f2937",
            textTransform: "none",
            fontWeight: 700,
            "&.Mui-selected": {
              bgcolor: "#4f46e5",
              color: "white",
            },
          },
        }}
      >
        <ToggleButton value="ltr">LTR</ToggleButton>
        <ToggleButton value="rtl">RTL</ToggleButton>
      </ToggleButtonGroup>

      <Stack spacing={0.5}>
        <FormControlLabel
          control={
            <Switch
              checked={immersive}
              onChange={(e) => setImmersive(e.target.checked)}
            />
          }
          label="Immersive auto-hide controls"
        />
      </Stack>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", my: 2 }} />

      {mode === "single" && (
        <>
          <Typography
            variant="caption"
            sx={{ color: "#94a3b8", mb: 1, display: "block", fontWeight: 700 }}
          >
            Zoom Mode
          </Typography>

          <ToggleButtonGroup
            value={zoomMode}
            exclusive
            onChange={(_, newZoom: ZoomMode | null) => newZoom && setZoomMode(newZoom)}
            fullWidth
            size="small"
            sx={{
              mb: 2,
              "& .MuiToggleButton-root": {
                color: "#cbd5e1",
                borderColor: "#1f2937",
                textTransform: "none",
                fontWeight: 700,
                fontSize: "0.75rem",
                "&.Mui-selected": {
                  bgcolor: "#4f46e5",
                  color: "white",
                },
              },
            }}
          >
            <ToggleButton value="fit-width">Width</ToggleButton>
            <ToggleButton value="fit-height">Height</ToggleButton>
            <ToggleButton value="custom">Custom</ToggleButton>
          </ToggleButtonGroup>

          {zoomMode === "custom" && (
            <Box sx={{ mb: 2 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 1,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: "#94a3b8", fontWeight: 700 }}
                >
                  Zoom Level
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "#cbd5e1", fontWeight: 700 }}
                >
                  {customZoom}%
                </Typography>
              </Box>
              <Slider
                min={50}
                max={200}
                step={10}
                value={customZoom}
                onChange={(_, value) => setCustomZoom(value as number)}
                sx={{
                  color: "#6366f1",
                  "& .MuiSlider-valueLabel": {
                    bgcolor: "#111827",
                  },
                }}
              />
            </Box>
          )}

          <Typography
            variant="caption"
            sx={{ color: "#94a3b8", mb: 1, display: "block", fontWeight: 700 }}
          >
            Content Type
          </Typography>

          <ToggleButtonGroup
            value={contentMode}
            exclusive
            onChange={(_, newMode: ContentMode | null) => newMode && setContentMode(newMode)}
            fullWidth
            size="small"
            sx={{
              mb: 2,
              "& .MuiToggleButton-root": {
                color: "#cbd5e1",
                borderColor: "#1f2937",
                textTransform: "none",
                fontWeight: 700,
                "&.Mui-selected": {
                  bgcolor: "#4f46e5",
                  color: "white",
                },
              },
            }}
          >
            <ToggleButton value="manga">Manga</ToggleButton>
            <ToggleButton value="manhwa">Manhwa</ToggleButton>
          </ToggleButtonGroup>

          <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", my: 2 }} />
        </>
      )}

      <Typography
        variant="caption"
        sx={{ color: "#94a3b8", mb: 1, display: "block", fontWeight: 700 }}
      >
        Eye Comfort
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1,
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: "#cbd5e1", fontWeight: 600 }}
          >
            Brightness
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: "#9ca3af", fontWeight: 600 }}
          >
            {filters.brightness}%
          </Typography>
        </Box>
        <Slider
          min={50}
          max={150}
          step={5}
          value={filters.brightness}
          onChange={(_, value) =>
            setFilters({ ...filters, brightness: value as number })
          }
          sx={{ color: "#6366f1" }}
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1,
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: "#cbd5e1", fontWeight: 600 }}
          >
            Saturation
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: "#9ca3af", fontWeight: 600 }}
          >
            {filters.saturation}%
          </Typography>
        </Box>
        <Slider
          min={50}
          max={150}
          step={5}
          value={filters.saturation}
          onChange={(_, value) =>
            setFilters({ ...filters, saturation: value as number })
          }
          sx={{ color: "#6366f1" }}
        />
      </Box>

      <FormControlLabel
        control={
          <Switch
            checked={filters.blueLight > 0}
            onChange={(e) =>
              setFilters({ ...filters, blueLight: e.target.checked ? 15 : 0 })
            }
          />
        }
        label="Blue light filter"
        sx={{ mb: 2 }}
      />

      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", my: 2 }} />

      <Typography
        variant="caption"
        sx={{ color: "#94a3b8", mb: 1, display: "block", fontWeight: 700 }}
      >
        Bookmarks
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Button
          fullWidth
          variant={bookmarks.has(idx) ? "contained" : "outlined"}
          onClick={() => {
            setBookmarks((prev) => {
              const newSet = new Set(prev);
              if (newSet.has(idx)) {
                newSet.delete(idx);
              } else {
                newSet.add(idx);
              }
              return newSet;
            });
          }}
          sx={{
            textTransform: "none",
            fontWeight: 700,
            bgcolor: bookmarks.has(idx) ? "#4f46e5" : "transparent",
            borderColor: "#1f2937",
            color: bookmarks.has(idx) ? "white" : "#cbd5e1",
            "&:hover": {
              bgcolor: bookmarks.has(idx) ? "#4338ca" : "#1f2937",
            },
          }}
        >
          {bookmarks.has(idx) ? "✓ Bookmarked" : "Bookmark this page"}
        </Button>
        {bookmarks.size > 0 && (
          <Typography
            variant="caption"
            sx={{ color: "#9ca3af", mt: 1, display: "block" }}
          >
            {bookmarks.size} page{bookmarks.size !== 1 ? "s" : ""} bookmarked
          </Typography>
        )}
      </Box>

      {mode === "single" && pages.length > 1 && pageReadTime[idx] !== undefined && (
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="caption"
            sx={{ color: "#94a3b8", mb: 1, display: "block", fontWeight: 700 }}
          >
            Reading Time
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: "#cbd5e1" }}
          >
            {Math.round(pageReadTime[idx] / 60)} minute{Math.round(pageReadTime[idx] / 60) !== 1 ? "s" : ""} on this page
          </Typography>
        </Box>
      )}

      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", my: 2 }} />

      {mode === "single" && pages.length > 1 && (
        <Box sx={{ mt: 3 }}>
          <Typography
            variant="caption"
            sx={{ color: "#94a3b8", mb: 1, display: "block", fontWeight: 700 }}
          >
            Jump to page
          </Typography>
          <Slider
            min={0}
            max={pages.length - 1}
            step={1}
            value={idx}
            onChange={(_, value) => setIdx(value as number)}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${Number(value) + 1}`}
            sx={{
              color: "#6366f1",
              "& .MuiSlider-valueLabel": {
                bgcolor: "#111827",
              },
            }}
          />
        </Box>
      )}
    </Box>
  );

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        bgcolor: "black",
        color: "white",
        zIndex: 100,
        overflow: "hidden",
        filter: `brightness(${filters.brightness}%) saturate(${filters.saturation}%)${
          filters.blueLight > 0 ? ` sepia(${filters.blueLight / 100})` : ""
        }`,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bgcolor: "rgba(0,0,0,0.78)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          zIndex: 80,
          transform: showControls ? "translateY(0)" : "translateY(-110%)",
          transition: "transform 0.25s ease",
        }}
      >
        <Box
          sx={{
            maxWidth: "1200px",
            mx: "auto",
            px: { xs: 1, sm: 2 },
            py: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
            <IconButton
              aria-label="Back"
              onClick={() => navigate(-1)}
              sx={{
                color: "#9ca3af",
                "&:hover": { bgcolor: "rgba(255,255,255,0.08)", color: "white" },
                borderRadius: "12px",
              }}
            >
              <ChevronLeft size={22} />
            </IconButton>

            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 800,
                  color: "#f3f4f6",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: { xs: 180, sm: 320, md: 500 },
                }}
              >
                {manga?.title}
              </Typography>
              <Typography variant="caption" sx={{ color: "#9ca3af" }}>
                Chapter {chapter?.number} Page {idx + 1} / {pages.length}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {!isMobile && mode === "single" && pages.length > 1 && (
              <Box sx={{ width: 220, px: 1 }}>
                <Slider
                  size="small"
                  min={0}
                  max={Math.max(0, pages.length - 1)}
                  value={idx}
                  onChange={(_, value) => setIdx(value as number)}
                  sx={{ color: "#6366f1" }}
                />
              </Box>
            )}

            <IconButton
              onClick={() => setSettingsOpen(true)}
              sx={{
                bgcolor: "#111827",
                border: "1px solid #1f2937",
                borderRadius: "12px",
                color: "#cbd5e1",
                "&:hover": { bgcolor: "#1f2937", color: "white" },
              }}
            >
              {isMobile ? <Menu size={18} /> : <Settings2 size={18} />}
            </IconButton>
          </Box>
        </Box>
      </Paper>

      {mode === "scroll" ? (
        <Box
          ref={scrollRef}
          onClick={onBackgroundClick}
          sx={{
            height: "100%",
            overflowY: "auto",
            bgcolor: "#000",
            scrollBehavior: "smooth",
            scrollSnapType: "y proximity",
          }}
        >
          <Box
            sx={{
              maxWidth: "900px",
              mx: "auto",
              px: { xs: 1, sm: 2 },
              pt: { xs: 8, sm: 9 },
              pb: { xs: 10, sm: 12 },
            }}
          >
            <Box sx={{ direction: dir }}>
              {pages.map((p, i) => (
                <PageImage
                  key={`${chapterUrl}-${i}`}
                  url={p}
                  index={i}
                  mode="scroll"
                  source={source}
                  zoomMode={zoomMode}
                  customZoom={customZoom}
                  contentMode={contentMode}
                />
              ))}
            </Box>

            <Box
              sx={{
                mt: 2.5,
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 1,
              }}
            >
              <Button
                disabled={!data?.prev_slug}
                onClick={goToPrevChapter}
                variant="outlined"
                sx={{
                  py: 1.5,
                  bgcolor: "#111827",
                  borderColor: "#1f2937",
                  color: "#e5e7eb",
                  fontWeight: 800,
                  borderRadius: "12px",
                  "&:hover": {
                    bgcolor: "#1f2937",
                    borderColor: "#374151",
                    color: "white",
                  },
                  "&:disabled": { opacity: 0.35 },
                }}
              >
                Previous Chapter
              </Button>

              <Button
                disabled={!data?.next_slug}
                onClick={goToNextChapter}
                variant="contained"
                sx={{
                  py: 1.5,
                  bgcolor: "#4f46e5",
                  color: "white",
                  fontWeight: 900,
                  borderRadius: "12px",
                  "&:hover": {
                    bgcolor: "#4338ca",
                    boxShadow: "0 6px 18px rgba(79,70,229,0.25)",
                  },
                  "&:disabled": { opacity: 0.35 },
                }}
              >
                Next Chapter
              </Button>
            </Box>
          </Box>
        </Box>
      ) : (
        <Box
          onClick={onBackgroundClick}
          sx={{
            height: "100%",
            display: "grid",
            placeItems: "center",
            position: "relative",
            bgcolor: "#000",
            width: "100%",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              left: 0,
              top: { xs: 56, sm: 64 },
              bottom: 0,
              width: { xs: "18%", md: "20%" },
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              pl: { xs: 1, md: 2 },
              zIndex: 40,
              cursor: leftDisabled ? "default" : "pointer",
              background: {
                xs: "linear-gradient(to right, rgba(0,0,0,0.65), transparent)",
                md: "none",
              },
              "&:hover .nav-arrow": leftDisabled
                ? {}
                : { transform: "translateX(-8px)", opacity: 1 },
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (!leftDisabled) onLeftClick();
            }}
          >
            <Box
              className="nav-arrow"
              sx={{
                color: "white",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
                opacity: leftDisabled ? 0.35 : 0.95,
                transition: "all 0.2s ease",
                transform: dir === "rtl" ? "scaleX(-1)" : "none",
              }}
            >
              <ArrowLeft size={40} />
            </Box>
          </Box>

          <Box
            sx={{
              width: "100%",
              maxWidth: { xs: "100%", md: "1000px" },
              px: { xs: 1, sm: 2 },
              pt: { xs: 7.5, sm: 8.5 },
              pb: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <PageImage
              url={pages[idx]}
              index={idx}
              mode="single"
              source={source}
              zoomMode={zoomMode}
              customZoom={customZoom}
              contentMode={contentMode}
            />

            {(idx >= pages.length - 1 && data?.next_slug) || (idx === 0 && data?.prev_slug) ? (
              <Paper
                sx={{
                  position: "absolute",
                  bottom: { xs: 72, sm: 78 },
                  left: "50%",
                  transform: "translateX(-50%)",
                  px: 2,
                  py: 0.6,
                  bgcolor: "rgba(17,24,39,0.85)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: "999px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                  zIndex: 40,
                  maxWidth: "calc(100% - 32px)",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 900,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "block",
                  }}
                >
                  {idx >= pages.length - 1 && data?.next_slug
                    ? "Last Page Click Right for Next Chapter"
                    : "First Page Click Left for Previous Chapter"}
                </Typography>
              </Paper>
            ) : null}

            <Paper
              elevation={0}
              sx={{
                position: "absolute",
                left: "50%",
                bottom: 16,
                transform: showControls
                  ? "translateX(-50%) translateY(0)"
                  : "translateX(-50%) translateY(120%)",
                transition: "transform 0.25s ease",
                bgcolor: "rgba(10,10,10,0.84)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "16px",
                px: 1,
                py: 1,
                zIndex: 60,
                width: { xs: "calc(100% - 24px)", sm: 520 },
                maxWidth: "calc(100% - 24px)",
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  onClick={dir === "rtl" ? onRightClick : onLeftClick}
                  disabled={dir === "rtl" ? rightDisabled : leftDisabled}
                  variant="outlined"
                  sx={{
                    minWidth: 88,
                    borderColor: "#374151",
                    color: "#e5e7eb",
                    borderRadius: "12px",
                    textTransform: "none",
                    fontWeight: 800,
                  }}
                >
                  Prev
                </Button>

                <Box sx={{ flex: 1, px: 1 }}>
                  <Slider
                    min={0}
                    max={Math.max(0, pages.length - 1)}
                    step={1}
                    value={idx}
                    onChange={(_, value) => setIdx(value as number)}
                    sx={{ color: "#6366f1" }}
                  />
                </Box>

                <Button
                  onClick={dir === "rtl" ? onLeftClick : onRightClick}
                  disabled={dir === "rtl" ? leftDisabled : rightDisabled}
                  variant="contained"
                  sx={{
                    minWidth: 88,
                    bgcolor: "#4f46e5",
                    borderRadius: "12px",
                    textTransform: "none",
                    fontWeight: 800,
                    "&:hover": { bgcolor: "#4338ca" },
                  }}
                >
                  Next
                </Button>
              </Stack>
            </Paper>
          </Box>

          <Box
            sx={{
              position: "absolute",
              right: 0,
              top: { xs: 56, sm: 64 },
              bottom: 0,
              width: { xs: "18%", md: "20%" },
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              pr: { xs: 1, md: 2 },
              zIndex: 40,
              cursor: rightDisabled ? "default" : "pointer",
              background: {
                xs: "linear-gradient(to left, rgba(0,0,0,0.65), transparent)",
                md: "none",
              },
              "&:hover .nav-arrow": rightDisabled
                ? {}
                : { transform: "translateX(8px)", opacity: 1 },
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (!rightDisabled) onRightClick();
            }}
          >
            <Box
              className="nav-arrow"
              sx={{
                color: "white",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
                opacity: rightDisabled ? 0.35 : 0.95,
                transition: "all 0.2s ease",
                transform: dir === "rtl" ? "scaleX(-1)" : "none",
              }}
            >
              <ArrowRight size={40} />
            </Box>
          </Box>
        </Box>
      )}

      <Drawer
        anchor="right"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: "#0b1220",
            backgroundImage: "none",
          },
        }}
      >
        {settingsPanel}
      </Drawer>
    </Box>
  );
}
