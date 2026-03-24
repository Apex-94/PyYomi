import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, addToLibrary, getProxyUrl } from "../../lib/api";
import { Filter, SlidersHorizontal } from "lucide-react";
import { MangaCard } from "../../components/MangaCard";
import GlobalSearchDesk from "../../components/GlobalSearchDesk";
import {
  Box,
  Typography,
  Button,
  Chip,
  Paper,
  IconButton,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  MenuItem,
  Pagination,
} from "@mui/material";
import { SECTION_GAP } from "../../constants/layout";
import { useLibraryState } from "../../hooks/useLibraryState";
import LibraryFeedbackSnackbar from "../../components/LibraryFeedbackSnackbar";
import SetCategoriesPicker from "../../components/SetCategoriesPicker";
import { LibraryAddResponse, SearchResultItem } from "../../types";
import { useMangaIDEPreview } from "../../components/mangaide/MangaIDEPreviewContext";
import { useColorMode } from "../../theme/ColorModeContext";
import { useAniListMetadataMap } from "../../hooks/useAniListMetadataMap";
import MangaIDECenterTable from "../../components/mangaide/MangaIDECenterTable";

type MangaCardItem = SearchResultItem;

function toMangaCardPayload(item: MangaCardItem) {
  return {
    title: item.title,
    url: item.url,
    thumbnail_url: item.thumbnail_url ?? undefined,
    source: item.source || "",
  };
}

function normalizeStatus(raw?: string | null): "Ongoing" | "Completed" | "Hiatus" {
  const value = (raw || "").trim().toLowerCase();
  if (value.includes("complete")) return "Completed";
  if (value.includes("hiatus")) return "Hiatus";
  return "Ongoing";
}

export default function BrowsePage() {
  const navigate = useNavigate();
  const { setPreview } = useMangaIDEPreview();
  const { uiMode } = useColorMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchScope, setSearchScope] = useState<"source" | "global">(
    searchParams.get("scope") === "global" ? "global" : "source"
  );
  const [tab, setTab] = useState<"latest" | "popular" | "random">("latest");
  const [draftQuery, setDraftQuery] = useState(searchParams.get("q") ?? "");
  const [page, setPage] = useState<number>(() => {
    const raw = Number(searchParams.get("page") ?? "1");
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  });
  const [activeFilters, setActiveFilters] = useState<any[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackActions, setFeedbackActions] = useState<Array<{ label: string; onClick: () => void }>>([]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerManga, setPickerManga] = useState<{ id?: number; title?: string }>({});
  const [selectedBrowseUrl, setSelectedBrowseUrl] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"title" | "status" | "lastRead" | "source">("title");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [pendingUrls, setPendingUrls] = useState<Record<string, boolean>>({});

  const { isInLibrary, getLibraryManga, applyAddResult, removeByUrl } = useLibraryState();
  const submittedQuery = searchParams.get("q") ?? "";

  const syncBrowseParams = (
    nextPage: number,
    nextQuery = submittedQuery,
    nextScope = searchScope
  ) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (nextQuery.trim()) {
        next.set("q", nextQuery.trim());
      } else {
        next.delete("q");
      }
      if (nextScope === "global") {
        next.set("scope", "global");
      } else {
        next.delete("scope");
      }
      if (nextPage > 1) {
        next.set("page", String(nextPage));
      } else {
        next.delete("page");
      }
      return next;
    });
  };

  const { data: sourcesData } = useQuery({
    queryKey: ["sources"],
    queryFn: async () => {
      const resp = await api.get(`/sources`);
      return resp.data;
    },
  });

  const activeSource = sourcesData?.sources?.find((s: any) => s.is_active);
  const isGlobalSearch = searchScope === "global";

  const { data: filtersData } = useQuery({
    queryKey: ["filters", activeSource?.id, isGlobalSearch],
    queryFn: async () => {
      if (!activeSource || isGlobalSearch) return { filters: [] };
      const resp = await api.get(`/manga/filters`, {
        params: { source: activeSource.id },
      });
      return resp.data;
    },
    enabled: !!activeSource && !isGlobalSearch,
  });

  const handleFilterChange = (filterId: string, value: any) => {
    setActiveFilters((prev) => {
      const existing = prev.find((f) => f.id === filterId);
      if (existing) {
        if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
          return prev.filter((f) => f.id !== filterId);
        }
        return prev.map((f) => (f.id === filterId ? { ...f, value } : f));
      }
      return [...prev, { id: filterId, value }];
    });
  };

  const clearFilters = () => {
    setActiveFilters([]);
    setDraftQuery("");
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("q");
      return next;
    });
  };

  useEffect(() => {
    const urlQ = searchParams.get("q") ?? "";
    if (urlQ !== draftQuery) {
      setDraftQuery(urlQ);
    }
    const nextScope = searchParams.get("scope") === "global" ? "global" : "source";
    if (nextScope !== searchScope) {
      setSearchScope(nextScope);
    }
    const rawPage = Number(searchParams.get("page") ?? "1");
    const nextPage = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    if (nextPage !== page) {
      setPage(nextPage);
    }
  }, [searchParams]);

  useEffect(() => {
    if (page !== 1 || searchParams.get("page")) {
      setPage(1);
      syncBrowseParams(1);
    }
  }, [tab, activeSource?.id, submittedQuery, activeFilters, searchScope]);

  const sourceBrowseQuery = useQuery({
    queryKey: ["browse", tab, submittedQuery, activeFilters, activeSource?.id, page, searchScope],
    queryFn: async () => {
      if (submittedQuery.trim() || activeFilters.length > 0) {
        const params: any = { q: submittedQuery.trim() || "", page };
        if (!isGlobalSearch && activeFilters.length > 0) {
          params.filters = JSON.stringify(activeFilters);
        }
        if (!isGlobalSearch && activeSource) {
          params.source = activeSource.id;
        }
        const resp = await api.get(`/manga/search`, { params });
        return resp.data;
      }
      const endpoint = tab === "latest" ? "/manga/latest" : tab === "popular" ? "/manga/popular" : "/manga/random";
      const params: Record<string, string | number> = { page };
      if (activeSource) {
        params.source = activeSource.id;
      }
      const resp = await api.get(endpoint, { params });
      return resp.data;
    },
    enabled: !isGlobalSearch,
  });

  const removeMutation = useMutation({
    mutationFn: async (url: string) => {
      await api.delete(`/library/`, { params: { url } });
    },
    onSuccess: (_data, url) => {
      removeByUrl(url);
      setFeedbackMessage("Removed from Library");
      setFeedbackActions([]);
      setFeedbackOpen(true);
    },
  });

  const addMutation = useMutation({
    mutationFn: async (item: MangaCardItem) => addToLibrary(toMangaCardPayload(item)),
    onMutate: (item) => {
      setPendingUrls((prev) => ({ ...prev, [item.url]: true }));
    },
    onSuccess: (resp: LibraryAddResponse, item) => {
      applyAddResult(resp);
      const libraryMangaId = resp.manga.id;
      const openPicker = () => {
        setPickerManga({ id: libraryMangaId, title: resp.manga.title });
        setPickerOpen(true);
      };

      if (resp.alreadyExists) {
        setFeedbackMessage("Already in Library");
        setFeedbackActions([
          { label: "Open", onClick: () => navigate("/library") },
          { label: "Set categories", onClick: openPicker },
        ]);
      } else {
        setFeedbackMessage("Added to Library");
        setFeedbackActions([
          { label: "Set categories", onClick: openPicker },
        ]);
      }
      setFeedbackOpen(true);
      setPendingUrls((prev) => ({ ...prev, [item.url]: false }));
    },
    onError: (_err, item) => {
      setPendingUrls((prev) => ({ ...prev, [item.url]: false }));
      setFeedbackMessage("Couldn't add to Library");
      setFeedbackActions([]);
      setFeedbackOpen(true);
    },
  });

  const browseItems: MangaCardItem[] = useMemo(() => sourceBrowseQuery.data?.results || [], [sourceBrowseQuery.data?.results]);
  const hasBrowseResults = browseItems.length > 0;
  const canGoNextPage = tab !== "random" && hasBrowseResults;
  const isMangaIDE = uiMode === "mangaide";
  const { byKey: browseMetaByUrl } = useAniListMetadataMap(
    browseItems.map((item) => ({ key: item.url, title: item.title }))
  );

  const publishPreview = (item: MangaCardItem) => {
    const meta = browseMetaByUrl.get(item.url);
    const inLibrary = isInLibrary(item.url);
    setPreview({
      title: item.title,
      coverUrl: item.thumbnail_url ? getProxyUrl(item.thumbnail_url, item.source) : meta?.cover_url,
      status: meta?.status || normalizeStatus(item.status),
      rating: meta?.rating_10,
      source: item.source,
      author: meta?.author || undefined,
      artist: meta?.artist || undefined,
      description: meta?.description || item.description || undefined,
      mangaUrl: item.url,
      sourceId: item.source,
      chapters: meta?.chapters,
      inLibrary,
    });
  };

  const sortedBrowseItems = useMemo(() => {
    const rows = [...browseItems];
    rows.sort((a, b) => {
      let left = "";
      let right = "";
      if (sortKey === "title") {
        left = a.title || "";
        right = b.title || "";
      } else if (sortKey === "status") {
        left = (browseMetaByUrl.get(a.url)?.status || normalizeStatus(a.status)) || "";
        right = (browseMetaByUrl.get(b.url)?.status || normalizeStatus(b.status)) || "";
      } else if (sortKey === "source") {
        left = a.source || "";
        right = b.source || "";
      } else {
        left = "";
        right = "";
      }
      const cmp = left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [browseItems, browseMetaByUrl, sortDirection, sortKey]);

  const toggleSort = (key: "title" | "status" | "lastRead" | "source") => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  return (
    <Box sx={{ maxWidth: 1360, mx: "auto" }}>
      {!isMangaIDE && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: SECTION_GAP }}>
          <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: "1.5rem", md: "1.9rem" } }}>
            Browse Manga
          </Typography>
        </Box>
      )}

      <Paper
        sx={{
          p: { xs: 1.25, sm: 1.5 },
          borderRadius: 1,
          border: 1,
          borderColor: "divider",
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "auto minmax(0, 1fr) auto auto",
          },
          gap: 1.25,
          alignItems: "center",
        }}
      >
        <ToggleButtonGroup
          value={tab}
          exclusive
          onChange={(_e, newTab) => newTab && setTab(newTab)}
          size="small"
          sx={{
            width: { xs: "100%", md: "auto" },
            justifySelf: { xs: "stretch", md: "start" },
            "& .MuiToggleButton-root": {
              px: { xs: 1.25, sm: 1.5 },
              py: 0.75,
              minHeight: 40,
              textTransform: "uppercase",
              fontWeight: 600,
              borderRadius: 1,
            },
          }}
        >
          <ToggleButton value="latest">Latest</ToggleButton>
          <ToggleButton value="popular">Popular</ToggleButton>
          <ToggleButton value="random">Random</ToggleButton>
        </ToggleButtonGroup>

        <TextField
          value={draftQuery}
          onChange={(e) => setDraftQuery(e.target.value)}
          placeholder={isGlobalSearch ? "Search all sources" : "Search manga"}
          size="small"
          fullWidth
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const normalized = draftQuery.trim();
              setPage(1);
              syncBrowseParams(1, normalized);
            }
          }}
          sx={{
            minWidth: 0,
            "& .MuiOutlinedInput-root": {
              minHeight: 40,
              borderRadius: 1,
            },
          }}
        />

        <ToggleButtonGroup
          value={searchScope}
          exclusive
          onChange={(_e, nextScope) => {
            if (!nextScope) return;
            setSearchScope(nextScope);
            if (nextScope === "global") {
              setShowFilters(false);
              setActiveFilters([]);
            }
            setPage(1);
            syncBrowseParams(1, draftQuery, nextScope);
          }}
          size="small"
          sx={{
            width: { xs: "100%", md: "auto" },
            justifySelf: { xs: "stretch", md: "start" },
            "& .MuiToggleButton-root": {
              minHeight: 40,
              px: 1.25,
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 1,
            },
          }}
        >
          <ToggleButton value="source">This source</ToggleButton>
          <ToggleButton value="global">Global</ToggleButton>
        </ToggleButtonGroup>

        <IconButton
          onClick={() => setShowFilters(!showFilters)}
          title={isGlobalSearch ? "Filters are only available for source search" : "Filters"}
          disabled={isGlobalSearch}
          sx={{
            height: 40,
            width: 40,
            justifySelf: { xs: "end", md: "center" },
            border: 1,
            borderRadius: 1,
            borderColor: showFilters || activeFilters.length > 0 ? "primary.main" : "divider",
            color: isGlobalSearch ? "text.disabled" : (showFilters || activeFilters.length > 0 ? "primary.main" : "text.secondary"),
            bgcolor: showFilters || activeFilters.length > 0 ? "action.selected" : "transparent",
          }}
        >
          <SlidersHorizontal size={18} />
        </IconButton>
      </Paper>

      {showFilters && !isGlobalSearch && filtersData?.filters && (
        <Paper
          sx={{
            mt: SECTION_GAP,
            p: 2,
            borderRadius: 2,
            border: 1,
            borderColor: "divider",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Filter size={18} />
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1rem" }}>
                Search Filters
              </Typography>
              {activeFilters.length > 0 && <Chip label={`${activeFilters.length} active`} size="small" color="primary" />}
            </Box>
            <Button onClick={clearFilters} size="small">
              Clear all
            </Button>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
                xl: "repeat(3, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            {filtersData.filters.map((filter: any) => (
              <Box key={filter.id} sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {filter.name}
                </Typography>
                {filter.type === "select" || filter.type === "sort" ? (
                  <TextField
                    select
                    value={activeFilters.find((f) => f.id === filter.id)?.value || ""}
                    onChange={(e) => handleFilterChange(filter.id, e.target.value)}
                    size="small"
                    fullWidth
                  >
                    <MenuItem value="">Any</MenuItem>
                    {filter.options?.map((opt: any) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : filter.type === "multiselect" ? (
                  <Box
                    sx={{
                      maxHeight: 160,
                      overflowY: "auto",
                      p: 1,
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1.25,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 1,
                    }}
                  >
                    {filter.options?.map((opt: any) => {
                      const isActive = (activeFilters.find((f) => f.id === filter.id)?.value || []).includes(opt.value);
                      return (
                        <Chip
                          key={opt.value}
                          label={opt.label}
                          size="small"
                          onClick={() => {
                            const current = activeFilters.find((f) => f.id === filter.id)?.value || [];
                            const next = isActive ? current.filter((v: any) => v !== opt.value) : [...current, opt.value];
                            handleFilterChange(filter.id, next);
                          }}
                          color={isActive ? "primary" : "default"}
                          variant={isActive ? "filled" : "outlined"}
                        />
                      );
                    })}
                  </Box>
                ) : (
                  <TextField
                    type="text"
                    value={activeFilters.find((f) => f.id === filter.id)?.value || ""}
                    onChange={(e) => handleFilterChange(filter.id, e.target.value)}
                    size="small"
                    fullWidth
                    placeholder={`Enter ${filter.name.toLowerCase()}...`}
                  />
                )}
              </Box>
            ))}
          </Box>
        </Paper>
      )}

      {isGlobalSearch ? (
        <GlobalSearchDesk
          query={submittedQuery}
          page={page}
          activeSourceId={activeSource?.id}
          pendingUrls={pendingUrls}
          isInLibrary={isInLibrary}
          getLibraryManga={getLibraryManga}
          onAddToLibrary={(item) => addMutation.mutate(item)}
          onRemoveFromLibrary={(url) => removeMutation.mutate(url)}
          onPreview={publishPreview}
          onOpenLibrary={() => navigate('/library')}
          onSetCategories={(mangaId, mangaTitle) => {
            setPickerManga({ id: mangaId, title: mangaTitle });
            setPickerOpen(true);
          }}
        />
      ) : sourceBrowseQuery.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : isMangaIDE ? (
        <Box sx={{ mt: 3 }}>
          <MangaIDECenterTable
            title={isGlobalSearch ? "Browse - Global search" : `Browse - ${activeSource?.id || "Source"}`}
            itemCount={sortedBrowseItems.length}
            page={page}
            totalPages={canGoNextPage ? page + 1 : page}
            rows={sortedBrowseItems.map((item) => {
              const meta = browseMetaByUrl.get(item.url);
              const ratingText = typeof meta?.rating_10 === "number" ? `${meta.rating_10.toFixed(1)}/10` : "--";
              const status = meta?.status || normalizeStatus(item.status);
              return {
                id: item.url,
                title: item.title,
                ratingText,
                status,
                lastReadText: "-",
                source: item.source,
              };
            })}
            selectedRowId={selectedBrowseUrl}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              syncBrowseParams(nextPage);
            }}
            onSortChange={toggleSort}
            onRowClick={(row) => {
              const item = sortedBrowseItems.find((entry) => entry.url === row.id);
              if (!item) return;
              setSelectedBrowseUrl(item.url);
              publishPreview(item);
            }}
            onRowDoubleClick={(row) => {
              const item = sortedBrowseItems.find((entry) => entry.url === row.id);
              if (!item) return;
              navigate(`/manga?url=${encodeURIComponent(item.url)}&source=${encodeURIComponent(item.source)}`);
            }}
          />
        </Box>
      ) : (
        <>
          <Box
            sx={{
              mt: 3,
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "repeat(2, minmax(0, 1fr))",
                sm: "repeat(auto-fill, minmax(200px, 1fr))",
                md: "repeat(auto-fill, minmax(220px, 1fr))",
                lg: "repeat(auto-fill, minmax(220px, 1fr))",
              },
              alignItems: "start",
            }}
          >
            {browseItems.map((it, i) => {
              const meta = browseMetaByUrl.get(it.url);
              const inLibrary = isInLibrary(it.url);
              const pending = !!pendingUrls[it.url];
              const libraryRecord = getLibraryManga(it.url);
              return (
                <Box
                  key={`${it.url}-${i}`}
                  onClick={() => publishPreview(it)}
                >
                  <MangaCard
                    manga={{
                      id: it.url,
                      title: it.title,
                      altTitle: "",
                      author: meta?.author || null,
                      status: (meta?.status as "Ongoing" | "Completed" | "Hiatus") || normalizeStatus(it.status),
                      genres: it.genres || [],
                      description: meta?.description || "",
                      coverUrl: it.thumbnail_url ? getProxyUrl(it.thumbnail_url, it.source) : "",
                      rating: meta?.rating_10 || 0,
                      chapters: [],
                    }}
                    mangaSource={it.source}
                    libraryButtonState={pending ? 'adding' : (inLibrary ? 'in_library' : 'not_in_library')}
                    onAddToLibrary={() => addMutation.mutate(it)}
                    onOpenInLibrary={() => navigate('/library')}
                    onSetCategories={() => {
                      setPickerManga({ id: libraryRecord?.id, title: it.title });
                      setPickerOpen(true);
                    }}
                    onRemoveFromLibrary={() => removeMutation.mutate(it.url)}
                    actionMode="auto"
                    showStatusBadge
                  />
                </Box>
              );
            })}
          </Box>

          {!isMangaIDE && (tab !== "random") && (hasBrowseResults || page > 1) && (
            <Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
              <Pagination
                page={page}
                count={canGoNextPage ? page + 1 : page}
                onChange={(_event, value) => {
                  setPage(value);
                  syncBrowseParams(value);
                }}
                color="primary"
                siblingCount={0}
                boundaryCount={1}
              />
            </Box>
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
        message={feedbackMessage}
        actions={feedbackActions}
        onClose={() => setFeedbackOpen(false)}
      />
    </Box>
  );
}
