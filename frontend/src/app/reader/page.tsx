import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api, getProxyUrl, addHistoryEntry, markChapterReadByManga } from "../../lib/api";
import { explainChapter } from "../../services/geminiService";
import { ChevronLeft, ArrowLeft, ArrowRight, Sparkles, Settings2 } from "lucide-react";
import {
  Box,
  Typography,
  Paper,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
} from "@mui/material";

// Helper component to lazy resolve images
function PageImage({
  url,
  index,
  mode,
  source,
}: {
  url: string;
  index: number;
  mode: "scroll" | "single";
  source: string | null;
}) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isImage = useMemo(() => {
    return /\.(jpg|jpeg|png|gif|webp)($|\?)/i.test(url) || url.includes("picsum");
  }, [url]);

  const proxyUrl = useMemo(() => {
    if (!isImage) return null;
    return getProxyUrl(url, source || undefined);
  }, [url, isImage, source]);

  useEffect(() => {
    let cancelled = false;
    // Clear currently rendered image immediately on page change.
    setDisplayUrl(null);
    setLoading(true);
    setError(false);

    const resolveAndLoad = async () => {
      try {
        const finalUrl = isImage
          ? proxyUrl
          : (await api.get("/manga/resolve", { params: { url, source } })).data.url;

        if (!finalUrl || cancelled) {
          return;
        }

        // Only show image after browser fully loads it to prevent stale previous-page frame.
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
  }, [url, isImage, proxyUrl, source]);

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
          borderRadius: 1,
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
          borderRadius: 1,
        }}
      >
        <Typography
          variant="caption"
          sx={{ textTransform: "uppercase", letterSpacing: "0.2em" }}
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
        // keeps single-page centered and prevents “leaning” on wide screens
        width: "100%",
      }}
    >
      <img
        src={displayUrl}
        alt={`p${index + 1}`}
        loading={mode === "single" ? "eager" : "lazy"}
        style={{
          width: mode === "scroll" ? "100%" : "auto",
          height: mode === "scroll" ? "auto" : "min(92vh, 1200px)",
          objectFit: mode === "scroll" ? "contain" : "contain", // avoid cropping in scroll
          display: "block",
          maxWidth: mode === "scroll" ? "100%" : "100%",
          marginBottom: mode === "scroll" ? "0.75rem" : "0.5rem",
        }}
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
  const [mode, setMode] = useState<"scroll" | "single">("single");
  const [dir, setDir] = useState<"ltr" | "rtl">("ltr");
  const [idx, setIdx] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [aiTeaser, setAiTeaser] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { data, isError } = useQuery({
    queryKey: ["pages", chapterUrl, source],
    enabled: !!chapterUrl,
    queryFn: async () => {
      const resp = await api.get(`/manga/pages`, {
        params: { chapter_url: chapterUrl, source },
      });
      return resp.data;
    },
    staleTime: 1000 * 60 * 10,
  });

  // Query to get manga_id from library if manga is in library
  const { data: libraryManga } = useQuery({
    queryKey: ["library-manga", mangaUrl],
    enabled: !!mangaUrl,
    queryFn: async () => {
      const resp = await api.get("/library");
      const manga = resp.data.manga?.find((m: any) => m.url === mangaUrl);
      return manga;
    },
  });

  // Mutation to mark chapter as read
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

  const pages: string[] = useMemo(() => data?.pages || [], [data]);
  const chapter = data?.chapter;
  const manga = data?.manga;

  useEffect(() => {
    if (mode !== "single" || pages.length === 0) return;

    const prefetchTargets = [pages[idx + 1], pages[idx - 1]].filter(
      (p): p is string => Boolean(p)
    );

    prefetchTargets.forEach((pageUrl) => {
      const isImage = /\.(jpg|jpeg|png|gif|webp)($|\?)/i.test(pageUrl) || pageUrl.includes("picsum");
      if (isImage) {
        const img = new Image();
        img.src = getProxyUrl(pageUrl, source || undefined);
        return;
      }

      api
        .get("/manga/resolve", { params: { url: pageUrl, source } })
        .then((res) => {
          const img = new Image();
          img.src = res.data.url;
        })
        .catch(() => {
          // Prefetch is best-effort.
        });
    });
  }, [idx, mode, pages, source]);

  useEffect(() => {
    setIdx(0);
    setAiTeaser(null);
    window.scrollTo(0, 0);
  }, [chapterUrl]);

  useEffect(() => {
    if (chapter?.title && manga?.title) {
      explainChapter(chapter.title, manga.title).then(setAiTeaser);
    }
  }, [chapter, manga]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const nextKey = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
      const prevKey = dir === "rtl" ? "ArrowRight" : "ArrowLeft";

      if (mode === "single") {
        if (e.key === nextKey) {
          // Navigate to next page or next chapter
          if (idx >= pages.length - 1 && data?.next_slug) {
            goToNextChapter();
          } else {
            setIdx((i) => Math.min(pages.length - 1, i + 1));
          }
        }
        if (e.key === prevKey) {
          // Navigate to prev page or prev chapter
          if (idx === 0 && data?.prev_slug) {
            goToPrevChapter();
          } else {
            setIdx((i) => Math.max(0, i - 1));
          }
        }
      } else {
        if (e.key === "ArrowDown" || e.key === nextKey) {
          scrollRef.current?.scrollBy({ top: window.innerHeight * 0.9, behavior: "smooth" });
        }
        if (e.key === "ArrowUp" || e.key === prevKey) {
          scrollRef.current?.scrollBy({ top: -window.innerHeight * 0.9, behavior: "smooth" });
        }
      }

      if (e.key === "f") setShowControls((s) => !s);
      if (e.key === "Escape") setShowControls(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dir, mode, pages.length, idx, data?.next_slug, data?.prev_slug]);

  if (!chapterUrl)
    return (
      <Typography variant="body1" sx={{ p: 3 }}>
        Provide ?chapter_url=…
      </Typography>
    );

  if (isError)
    return (
      <Box sx={{ display: "grid", placeItems: "center", height: "100vh", bgcolor: "black" }}>
        <Typography sx={{ color: "#ef4444" }}>Failed to load chapter.</Typography>
      </Box>
    );

  if (!data)
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

  // Helper to build chapter URL
  const buildChapterUrl = (chapterUrl: string) =>
    `/reader?chapter_url=${encodeURIComponent(chapterUrl)}&source=${encodeURIComponent(source || "")}${
      mangaUrl ? `&manga_url=${encodeURIComponent(mangaUrl)}` : ""
    }`;

  // Direction-aware navigation helpers
  const goPrev = () => setIdx((i) => Math.max(0, i - 1));
  const goNext = () => setIdx((i) => Math.min(pages.length - 1, i + 1));

  // Navigate to next chapter when on last page
  const goToNextChapter = () => {
    if (data?.next_slug) {
      if (libraryManga?.id && chapter?.number) {
        markReadMutation.mutate();
      }
      navigate(buildChapterUrl(data.next_slug));
    }
  };

  // Navigate to prev chapter when on first page
  const goToPrevChapter = () => {
    if (data?.prev_slug) {
      navigate(buildChapterUrl(data.prev_slug));
    }
  };

  // Simplified direction-aware click handlers
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

  const leftDisabled = dir === "rtl" 
    ? (idx >= pages.length - 1 && !data?.next_slug) 
    : (idx === 0 && !data?.prev_slug);
  const rightDisabled = dir === "rtl" 
    ? (idx === 0 && !data?.prev_slug) 
    : (idx >= pages.length - 1 && !data?.next_slug);

  const onBackgroundClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button,a,[role='button'],input,textarea,select")) return;
    setShowControls((s) => !s);
  };

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        bgcolor: "black",
        color: "white",
        zIndex: 100,
        overflow: "hidden",
      }}
    >
      {/* Top Controls (centered + aligned with content width) */}
      <Paper
        elevation={0}
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bgcolor: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          zIndex: 80,
          transform: showControls ? "translateY(0)" : "translateY(-110%)",
          transition: "transform 0.25s ease",
        }}
      >
        <Box
          sx={{
            maxWidth: "1100px",
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

            <Box sx={{ minWidth: 0, display: { xs: "none", sm: "block" } }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  color: "#e5e7eb",
                  display: "block",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: { sm: 260, md: 420 },
                }}
              >
                {manga?.title}
              </Typography>
              <Typography variant="caption" sx={{ color: "#9ca3af", display: "block" }}>
                Chapter {chapter?.number} • Page {idx + 1} of {pages.length}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Paper
              sx={{
                bgcolor: "#111827",
                borderRadius: 2,
                p: 0.25,
                display: "flex",
                alignItems: "center",
                border: "1px solid #1f2937",
              }}
            >
              <ToggleButtonGroup
                value={mode}
                exclusive
                onChange={(e, newMode) => newMode && setMode(newMode)}
                size="small"
                sx={{
                  "& .MuiToggleButton-root": {
                    borderRadius: "10px",
                    fontWeight: 800,
                    fontSize: "0.75rem",
                    px: 1.5,
                    py: 0.75,
                    textTransform: "none",
                    "&.Mui-selected": {
                      bgcolor: "#4f46e5",
                      color: "white",
                      border: "1px solid rgba(79,70,229,0.25)",
                      "&:hover": { bgcolor: "#4338ca" },
                    },
                  },
                }}
              >
                <ToggleButton value="single">Single</ToggleButton>
                <ToggleButton value="scroll">Scroll</ToggleButton>
              </ToggleButtonGroup>
            </Paper>

            <IconButton
              aria-label="Toggle reading direction"
              onClick={() => setDir((d) => (d === "ltr" ? "rtl" : "ltr"))}
              sx={{
                bgcolor: "#111827",
                border: "1px solid #1f2937",
                borderRadius: "12px",
                color: "#9ca3af",
                "&:hover": { bgcolor: "#1f2937", color: "white" },
              }}
            >
              <Settings2 size={16} />
            </IconButton>
          </Box>
        </Box>
      </Paper>

      {/* Main Content */}
      {mode === "scroll" ? (
        <Box
          ref={scrollRef}
          onClick={onBackgroundClick}
          sx={{
            height: "100%",
            overflowY: "auto",
            bgcolor: "#000",
          }}
        >
          <Box
            sx={{
              // aligned with top bar maxWidth
              maxWidth: "900px",
              mx: "auto",
              px: { xs: 1, sm: 2 },
              pt: { xs: 8, sm: 9 },
              pb: { xs: 10, sm: 12 },
            }}
          >
            {/* AI Teaser (centered + consistent padding) */}
            {aiTeaser && (
              <Paper
                sx={{
                  mb: 2,
                  p: { xs: 2, sm: 3 },
                  bgcolor: "rgba(17, 24, 39, 0.6)",
                  border: "1px solid rgba(79,70,229,0.25)",
                  borderRadius: 2,
                  textAlign: "center",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: 2,
                    background: "linear-gradient(to right, transparent, #6366f1, transparent)",
                    opacity: 0.5,
                  }}
                />
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, mb: 1 }}>
                  <Sparkles size={12} style={{ color: "#6366f1" }} />
                  <Typography
                    variant="caption"
                    sx={{
                      color: "#a5b4fc",
                      fontWeight: 900,
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                    }}
                  >
                    AI Preview
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    color: "#e5e7eb",
                    fontStyle: "italic",
                    lineHeight: 1.8,
                    maxWidth: "42rem",
                    mx: "auto",
                    fontSize: { xs: "0.8rem", md: "0.9rem" },
                  }}
                >
                  “{aiTeaser}”
                </Typography>
              </Paper>
            )}

            <Box sx={{ direction: dir }}>
              {pages.map((p, i) => (
                <PageImage key={`${chapterUrl}-${i}`} url={p} index={i} mode="scroll" source={source} />
              ))}
            </Box>

            {/* Bottom Nav (aligned + equal widths) */}
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
                  "&:hover": { bgcolor: "#1f2937", borderColor: "#374151", color: "white" },
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
                  "&:hover": { bgcolor: "#4338ca", boxShadow: "0 6px 18px rgba(79,70,229,0.25)" },
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
          {/* Left Navigation Zone (direction-aware) */}
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
              background: { xs: "linear-gradient(to right, rgba(0,0,0,0.65), transparent)", md: "none" },
              "&:hover .nav-arrow": leftDisabled ? {} : { transform: "translateX(-8px)", opacity: 1 },
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

          {/* Center Content (hard-centered + consistent maxWidth) */}
          <Box
            sx={{
              width: "100%",
              maxWidth: { xs: "100%", md: "1000px" },
              px: { xs: 1, sm: 2 },
              pt: { xs: 7.5, sm: 8.5 }, // aligns content below top bar
              pb: 6,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <PageImage url={pages[idx]} index={idx} mode="single" source={source} />

            {/* Page Indicator (centered, not drifting) */}
            <Paper
              sx={{
                position: "absolute",
                bottom: { xs: 10, sm: 12 },
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
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 900 }}>
                {idx >= pages.length - 1 && data?.next_slug 
                  ? "Last Page - Click Right for Next Chapter" 
                  : idx === 0 && data?.prev_slug
                    ? "First Page - Click Left for Prev Chapter"
                    : <>Page {idx + 1} <span style={{ color: "#6b7280" }}>/</span> {pages.length}</>
                }
              </Typography>
            </Paper>
          </Box>

          {/* Right Navigation Zone (direction-aware) */}
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
              background: { xs: "linear-gradient(to left, rgba(0,0,0,0.65), transparent)", md: "none" },
              "&:hover .nav-arrow": rightDisabled ? {} : { transform: "translateX(8px)", opacity: 1 },
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
    </Box>
  );
}
