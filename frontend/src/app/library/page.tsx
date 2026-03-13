import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api, getProxyUrl } from "../../lib/api";
import { BookOpen } from "lucide-react";
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Pagination,
} from "@mui/material";
import { MangaCard } from "../../components/MangaCard";
import { Manga } from "../../types";
import { useLibraryState } from "../../hooks/useLibraryState";
import SetCategoriesPicker from "../../components/SetCategoriesPicker";
import LibraryFeedbackSnackbar from "../../components/LibraryFeedbackSnackbar";
import { useColorMode } from "../../theme/ColorModeContext";
import { useMangaIDEPreview } from "../../components/mangaide/MangaIDEPreviewContext";
import { useAniListMetadataMap } from "../../hooks/useAniListMetadataMap";
import MangaIDECenterTable from "../../components/mangaide/MangaIDECenterTable";

interface LibraryItem {
  id: number;
  title: string;
  url: string;
  thumbnail_url?: string;
  source: string;
  status?: string | null;
  last_read_chapter?: number;
  last_read_at?: string | null;
}

function normalizeStatus(raw?: string | null): Manga["status"] {
  const value = (raw || "").trim().toLowerCase();
  if (value.includes("complete")) return "Completed";
  if (value.includes("hiatus")) return "Hiatus";
  return "Ongoing";
}

function toManga(item: LibraryItem, meta?: { author?: string; status?: string; description?: string; rating_10?: number }): Manga {
  return {
    id: item.url,
    title: item.title,
    altTitle: "",
    author: meta?.author || null,
    status: (meta?.status as Manga["status"]) || normalizeStatus(item.status),
    genres: [item.source],
    description: meta?.description || "",
    coverUrl: item.thumbnail_url ? getProxyUrl(item.thumbnail_url, item.source) : "",
    rating: meta?.rating_10 || 0,
    chapters: [],
  };
}

export default function LibraryPage() {
  const ITEMS_PER_PAGE = 24;
  const navigate = useNavigate();
  const { uiMode } = useColorMode();
  const { setPreview } = useMangaIDEPreview();
  const { libraryQuery, removeByUrl } = useLibraryState();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerManga, setPickerManga] = useState<{ id?: number; title?: string }>({});
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [selectedRowUrl, setSelectedRowUrl] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"title" | "status" | "lastRead" | "source">("title");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const removeMutation = useMutation({
    mutationFn: async (url: string) => {
      await api.delete(`/library/`, { params: { url } });
    },
    onSuccess: (_data, url) => {
      removeByUrl(url);
      setFeedbackOpen(true);
    },
  });

  const data = libraryQuery.data as LibraryItem[] | undefined;
  const isLoading = libraryQuery.isLoading;
  const isMangaIDE = uiMode === "mangaide";

  const formatLastRead = (item: LibraryItem) => {
    if (!item.last_read_at) return "-";
    const parsed = new Date(item.last_read_at);
    if (Number.isNaN(parsed.getTime())) return `Ch. ${item.last_read_chapter ?? "-"}`;
    return `Ch. ${item.last_read_chapter ?? "-"} (${parsed.toLocaleDateString()})`;
  };

  const sortedData = useMemo(() => {
    if (!data) return [];
    const rows = [...data];
    rows.sort((a, b) => {
      let left = "";
      let right = "";
      if (sortKey === "title") {
        left = a.title || "";
        right = b.title || "";
      } else if (sortKey === "status") {
        left = normalizeStatus(a.status);
        right = normalizeStatus(b.status);
      } else if (sortKey === "source") {
        left = a.source || "";
        right = b.source || "";
      } else {
        left = a.last_read_at || "";
        right = b.last_read_at || "";
      }
      const cmp = left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [data, sortDirection, sortKey]);
  const totalPages = Math.max(1, Math.ceil(sortedData.length / ITEMS_PER_PAGE));
  const paginatedData = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return sortedData.slice(start, start + ITEMS_PER_PAGE);
  }, [page, sortedData]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const { byKey: metaByUrl } = useAniListMetadataMap((data || []).map((item) => ({ key: item.url, title: item.title })));

  const publishPreview = (item: LibraryItem) => {
    const meta = metaByUrl.get(item.url);
    setPreview({
      title: item.title,
      coverUrl: item.thumbnail_url ? getProxyUrl(item.thumbnail_url, item.source) : meta?.cover_url,
      status: meta?.status || normalizeStatus(item.status),
      rating: meta?.rating_10,
      source: item.source,
      author: meta?.author || undefined,
      artist: meta?.artist || undefined,
      description: meta?.description || undefined,
      mangaUrl: item.url,
      sourceId: item.source,
      chapters: meta?.chapters ?? item.last_read_chapter ?? undefined,
      inLibrary: true,
    });
  };

  const toggleSort = (key: "title" | "status" | "lastRead" | "source") => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
    setPage(1);
  };

  return (
    <Box>
      {!isMangaIDE && (
        <Typography
          variant="h1"
          sx={{
            fontWeight: 700,
            mb: 3,
            fontSize: { xs: "1.5rem", md: "1.9rem" },
            lineHeight: 1.2,
          }}
        >
          My Library
        </Typography>
      )}

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : (
        <>
          {(!data || data.length === 0) && (
            <Paper
              sx={{
                p: { xs: 3, md: 6 },
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                borderRadius: 2,
                border: 1,
                borderColor: "divider",
                bgcolor: "action.hover",
              }}
            >
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: "background.paper",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mb: 2,
                }}
              >
                <Box sx={{ color: "text.secondary" }}>
                  <BookOpen size={36} />
                </Box>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                Your library is empty
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary", maxWidth: 360, mb: 2.5 }}>
                Add manga from Browse to keep your reading list organized.
              </Typography>
              <Button component={Link} to="/browse" variant="contained">
                Go to Browse
              </Button>
            </Paper>
          )}

          {data && data.length > 0 && !isMangaIDE && (
            <>
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: {
                    xs: "repeat(2, minmax(150px, 1fr))",
                    sm: "repeat(auto-fill, minmax(180px, 1fr))",
                    md: "repeat(auto-fill, minmax(210px, 1fr))",
                    lg: "repeat(auto-fill, minmax(240px, 1fr))",
                  },
                }}
              >
                {paginatedData.map((it) => (
                  <MangaCard
                    key={it.url}
                    manga={toManga(it, metaByUrl.get(it.url))}
                    mangaSource={it.source}
                    showStatusBadge={false}
                    actionMode="auto"
                    libraryButtonState="in_library"
                    onOpenInLibrary={() => navigate("/library")}
                    onSetCategories={() => {
                      setPickerManga({ id: it.id, title: it.title });
                      setPickerOpen(true);
                    }}
                    onRemoveFromLibrary={() => removeMutation.mutate(it.url)}
                  />
                ))}
              </Box>

              {totalPages > 1 && (
                <Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
                  <Pagination
                    page={page}
                    count={totalPages}
                    onChange={(_event, value) => setPage(value)}
                    color="primary"
                  />
                </Box>
              )}
            </>
          )}

          {data && data.length > 0 && isMangaIDE && (
            <MangaIDECenterTable
              title="Manga List / All"
              itemCount={data.length}
              page={page}
              totalPages={totalPages}
              rows={paginatedData.map((item) => {
                const meta = metaByUrl.get(item.url);
                const status = meta?.status || normalizeStatus(item.status);
                const ratingText = typeof meta?.rating_10 === "number" ? `${meta.rating_10.toFixed(1)}/10` : "--";
                return {
                  id: item.url,
                  title: item.title,
                  ratingText,
                  status,
                  lastReadText: formatLastRead(item),
                  source: item.source,
                };
              })}
              selectedRowId={selectedRowUrl}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onPageChange={setPage}
              onSortChange={toggleSort}
              onRowClick={(row) => {
                const item = paginatedData.find((entry) => entry.url === row.id);
                if (!item) return;
                setSelectedRowUrl(item.url);
                publishPreview(item);
              }}
              onRowDoubleClick={(row) => {
                const item = paginatedData.find((entry) => entry.url === row.id);
                if (!item) return;
                navigate(`/manga?url=${encodeURIComponent(item.url)}&source=${encodeURIComponent(item.source)}`);
              }}
            />
          )}

        </>
      )}

      <SetCategoriesPicker
        open={pickerOpen}
        mangaId={pickerManga.id}
        mangaTitle={pickerManga.title}
        onClose={() => setPickerOpen(false)}
      />

      <LibraryFeedbackSnackbar
        open={feedbackOpen}
        message="Removed from Library"
        onClose={() => setFeedbackOpen(false)}
      />
    </Box>
  );
}
