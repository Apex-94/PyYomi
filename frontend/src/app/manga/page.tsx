import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { api, getAniListMetadata, getProxyUrl, queueDownload, addToLibrary, deleteDownloadFiles, getDownloads, getTrackerMappings, syncToTracker, getChaptersReadStatus, markChapterReadByManga, markChapterUnreadByUrl } from "../../lib/api";
import { summarizeManga } from "../../services/geminiService";
import { Sparkles, BookOpen, Clock, PenTool, User, Check, Plus, MoreVertical, RefreshCw as SyncIcon, Link as LinkIcon, CheckCircle } from "lucide-react";
import { LibraryAddResponse, Manga } from "../../types";
import TrackerMappingDialog from "../../components/TrackerMappingDialog";
import {
  Box,
  Typography,
  Paper,
  Chip,
  Grid,
  Stack,
  Button,
  CircularProgress,
  Container,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
} from "@mui/material";
import { useLibraryState } from "../../hooks/useLibraryState";
import LibraryFeedbackSnackbar from "../../components/LibraryFeedbackSnackbar";
import SetCategoriesPicker from "../../components/SetCategoriesPicker";

interface MangaDetails {
    id: string;
    title: string;
    description: string;
    author: string | null;
    artist: string | null;
    status: 'Ongoing' | 'Completed' | 'Hiatus';
    genres: string[];
    thumbnail_url: string | null;
    source_url: string;
}

interface Chapter {
    title: string;
    url: string;
    chapter_number: number | null;
}

// Helper to format chapter title in a consistent way
const CHAPTER_INDICATOR_PATTERN = /^(C\.?|Ch\.?\s*|Chapter\s*)\d+(?:\.\d+)?$/i;

const formatChapterTitle = (title: string, chapterNumber: number | null): string => {
    // Check if title already starts with "Chapter X" pattern
    const existingMatch = title.match(/^Chapter\s*(\d+(?:\.\d+)?)(?::\s*(.+))?$/i);
    if (existingMatch) {
        const [, num, name] = existingMatch;
        return name ? `Chapter ${num}: ${name.trim()}` : `Chapter ${num}`;
    }
    
    // Check for format: "15 C.15" or "15 The Beginning"
    const titleMatch = title.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
    const displayNumber = chapterNumber ?? (titleMatch ? parseFloat(titleMatch[1]) : null);
    
    if (titleMatch) {
        const name = titleMatch[2].trim();
        const isChapterIndicator = CHAPTER_INDICATOR_PATTERN.test(name);
        return isChapterIndicator || !name 
            ? `Chapter ${displayNumber ?? titleMatch[1]}`
            : `Chapter ${displayNumber ?? titleMatch[1]}: ${name}`;
    }
    
    // Use chapter number with title if available
    if (chapterNumber) {
        return CHAPTER_INDICATOR_PATTERN.test(title) ? `Chapter ${chapterNumber}` : `Chapter ${chapterNumber}: ${title}`;
    }
    
    return title;
};

export default function MangaPage() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const url = searchParams.get("url");
    const source = searchParams.get("source");
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [generatingSummary, setGeneratingSummary] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [backdropError, setBackdropError] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [feedbackActions, setFeedbackActions] = useState<Array<{ label: string; onClick: () => void }>>([]);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [syncMenuAnchor, setSyncMenuAnchor] = useState<null | HTMLElement>(null);
    const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
    
    // Context menu state for chapter read/unread marking
    const [contextMenuAnchor, setContextMenuAnchor] = useState<null | HTMLElement>(null);
    const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
    
    const queueMutation = useMutation({
        mutationFn: queueDownload,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['downloads'] });
        },
    });
    const { isInLibrary, getLibraryManga, applyAddResult, removeByUrl } = useLibraryState();

    // Get library manga early - needed by hooks below
    const libraryManga = url ? getLibraryManga(url) : null;

    const { data: details, isLoading: loadingDetails } = useQuery({
        queryKey: ["manga", url, source],
        queryFn: async () => {
            if (!url) return null;
            const resp = await api.get(`/manga/details`, { params: { url, source } });
            return resp.data as MangaDetails;
        },
        enabled: !!url,
    });

    const { data: chapters, isLoading: loadingChapters } = useQuery({
        queryKey: ["chapters", url, source],
        queryFn: async () => {
            if (!url) return [];
            const resp = await api.get(`/manga/chapters`, { params: { url, source } });
            return resp.data.chapters as Chapter[];
        },
        enabled: !!url,
    });
    const { data: aniMeta } = useQuery({
        queryKey: ["anilist-meta-single", details?.title],
        queryFn: () => getAniListMetadata(details!.title),
        enabled: !!details?.title,
        staleTime: 1000 * 60 * 30,
    });

    // Query for read status of chapters
    const { data: readStatusData, refetch: refetchReadStatus } = useQuery({
        queryKey: ["read-status", url],
        queryFn: async () => {
            if (!url) return { manga_id: null, chapters: [] };
            return getChaptersReadStatus(url);
        },
        enabled: !!url && !!libraryManga?.id,
    });

    const { data: downloads = [] } = useQuery({
        queryKey: ['downloads'],
        queryFn: getDownloads,
        refetchInterval: 2000,
    });

    const deleteDownloadedMutation = useMutation({
        mutationFn: (downloadId: number) => deleteDownloadFiles(downloadId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['downloads'] });
        },
    });

    const addMutation = useMutation({
        mutationFn: async () => {
            if (!details || !url) throw new Error("Missing manga details");
            return addToLibrary({
                title: details.title,
                url,
                thumbnail_url: details.thumbnail_url || undefined,
                source: source || 'mangahere:en',
            });
        },
        onSuccess: (resp: LibraryAddResponse) => {
            applyAddResult(resp);
            setFeedbackMessage(resp.alreadyExists ? 'Already in Library' : 'Added to Library');
            setFeedbackActions([
                { label: 'Open', onClick: () => navigate('/library') },
                { label: 'Set categories', onClick: () => setPickerOpen(true) },
            ]);
            setFeedbackOpen(true);
        },
        onError: () => {
            setFeedbackMessage("Couldn't add to Library");
            setFeedbackActions([]);
            setFeedbackOpen(true);
        },
    });

    const removeMutation = useMutation({
        mutationFn: async () => {
            if (!url) return;
            await api.delete(`/library/`, { params: { url } });
        },
        onSuccess: () => {
            if (url) removeByUrl(url);
            setFeedbackMessage('Removed from Library');
            setFeedbackActions([]);
            setFeedbackOpen(true);
        },
    });

    // Tracker sync mutation
    const syncMutation = useMutation({
        mutationFn: async ({ trackerName, chapterNumber }: { trackerName: string; chapterNumber: number }) => {
            if (!libraryManga?.id) throw new Error('Manga not in library');
            return syncToTracker(trackerName, libraryManga.id, chapterNumber);
        },
        onSuccess: () => {
            setFeedbackMessage('Synced to tracker');
            setFeedbackActions([]);
            setFeedbackOpen(true);
        },
        onError: () => {
            setFeedbackMessage('Failed to sync to tracker');
            setFeedbackActions([]);
            setFeedbackOpen(true);
        },
    });

    // Mutation to mark chapter as read
    const markReadMutation = useMutation({
        mutationFn: async ({ chapterUrl, chapterNumber, chapterTitle }: { chapterUrl: string; chapterNumber: number; chapterTitle?: string }) => {
            if (!libraryManga?.id) throw new Error('Manga not in library');
            return markChapterReadByManga(libraryManga.id, chapterNumber, chapterUrl, chapterTitle);
        },
        onSuccess: async () => {
            await refetchReadStatus();
            setFeedbackMessage('Chapter marked as read');
            setFeedbackActions([]);
            setFeedbackOpen(true);
            setContextMenuAnchor(null);
        },
        onError: () => {
            setFeedbackMessage('Failed to mark chapter as read');
            setFeedbackActions([]);
            setFeedbackOpen(true);
        },
    });

    // Mutation to mark chapter as unread
    const markUnreadMutation = useMutation({
        mutationFn: async (chapterUrl: string) => {
            return markChapterUnreadByUrl(chapterUrl);
        },
        onSuccess: async () => {
            await refetchReadStatus();
            setFeedbackMessage('Chapter marked as unread');
            setFeedbackActions([]);
            setFeedbackOpen(true);
            setContextMenuAnchor(null);
        },
        onError: () => {
            setFeedbackMessage('Failed to mark chapter as unread');
            setFeedbackActions([]);
            setFeedbackOpen(true);
        },
    });

    // Fetch tracker mappings for this manga if in library
    const { data: trackerMappingsData } = useQuery({
        queryKey: ['tracker-mappings', 'mal'],
        queryFn: () => getTrackerMappings('mal'),
        enabled: !!libraryManga?.id,
    });

    const trackerMappings = trackerMappingsData?.mappings?.filter(m => m.manga_id === libraryManga?.id) || [];

    // Helper to check if a chapter is read
    const isChapterRead = (chapterUrl: string): boolean => {
        return readStatusData?.chapters?.some(ch => ch.url === chapterUrl && ch.is_read) ?? false;
    };

    // Context menu handlers
    const handleContextMenu = (event: React.MouseEvent, chapter: Chapter) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenuAnchor(event.currentTarget as HTMLElement);
        setSelectedChapter(chapter);
    };

    const handleContextMenuClose = () => {
        setContextMenuAnchor(null);
        setSelectedChapter(null);
    };

    const handleMarkAsRead = () => {
        if (selectedChapter && libraryManga?.id) {
            markReadMutation.mutate({
                chapterUrl: selectedChapter.url,
                chapterNumber: selectedChapter.chapter_number || 0,
                chapterTitle: selectedChapter.title,
            });
        }
    };

    const handleMarkAsUnread = () => {
        if (selectedChapter) {
            markUnreadMutation.mutate(selectedChapter.url);
        }
    };

    const handleGenerateSummary = async () => {
        if (!details) return;
        setGeneratingSummary(true);
        const mangaObj: Manga = {
            ...details,
            altTitle: "",
            coverUrl: details.thumbnail_url || "",
            rating: 0,
            chapters: []
        };
        setAiSummary(await summarizeManga(mangaObj));
        setGeneratingSummary(false);
    };

    if (!url) return <Box sx={{ p: 3 }}>No manga URL provided.</Box>;
    if (loadingDetails) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress color="primary" /></Box>;
    if (!details) return <Box sx={{ p: 3 }}>Failed to load details.</Box>;
    const displayAuthor = aniMeta?.author || details.author || "Unknown";
    const displayArtist = aniMeta?.artist || details.artist || "Unknown";
    const displayStatus = (aniMeta?.status as MangaDetails["status"]) || details.status;
    const displayDescription = aniMeta?.description || details.description;
    const displayRating = aniMeta?.rating_10;

    const inLibrary = isInLibrary(url);

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            {/* Backdrop */}
            {!backdropError && (
                <Box sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: 400,
                    overflow: 'hidden',
                    zIndex: -1,
                    opacity: 0.3,
                }}>
                    <img
                        src={details.thumbnail_url ? getProxyUrl(details.thumbnail_url, source || '') : ''}
                        alt=""
                        onError={() => setBackdropError(true)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(8px)', transform: 'scale(1.25)' }}
                    />
                    <Box sx={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 1) 100%)',
                        '&.dark': {
                            background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.1) 0%, rgba(17, 24, 39, 1) 100%)',
                        }
                    }} />
                </Box>
            )}

            <Box sx={{ pt: 8, pb: 6 }}>
                <Grid container spacing={6} mb={6}>
                    <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'center', md: 'flex-start' } }}>
                        <Box sx={{
                            aspectRatio: '2/3',
                            width: { xs: 192, md: '100%' },
                            bgcolor: { light: '#f3f4f6', dark: '#374151' },
                            borderRadius: 2,
                            overflow: 'hidden',
                            boxShadow: 8,
                            border: 1,
                            borderColor: { light: 'rgba(0, 0, 0, 0.1)', dark: 'rgba(255, 255, 255, 0.1)' },
                            mb: 3,
                        }}>
                            {details.thumbnail_url && !imageError ? (
                                <img
                                    src={getProxyUrl(details.thumbnail_url, source || '')}
                                    alt={details.title}
                                    onError={() => setImageError(true)}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            ) : (
                                <Box sx={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'linear-gradient(to bottom right, #d1d5db, #9ca3af)',
                                }}>
                                    <Box sx={{ textAlign: 'center' }}>
                                        <Typography variant="h1" sx={{ mb: 1 }}>📚</Typography>
                                        <Typography variant="body2" sx={{ color: { light: '#6b7280', dark: '#d1d5db' } }}>No image</Typography>
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    </Grid>

                    <Grid size={{ xs: 12, md: 8 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                            <Typography variant="h3" sx={{ fontWeight: 'bold', lineHeight: 1.2, letterSpacing: '-0.02em', flex: 1 }}>
                                {details.title}
                            </Typography>
                            {!inLibrary ? (
                                <Button
                                    variant="outlined"
                                    startIcon={addMutation.isPending ? <CircularProgress size={14} /> : <Plus size={14} />}
                                    disabled={addMutation.isPending}
                                    onClick={() => addMutation.mutate()}
                                >
                                    {addMutation.isPending ? 'Adding...' : 'Add'}
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        variant="outlined"
                                        startIcon={<Check size={14} />}
                                        endIcon={<MoreVertical size={14} />}
                                        onClick={(e) => setMenuAnchor(e.currentTarget)}
                                    >
                                        In Library
                                    </Button>
                                    <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
                                        <MenuItem onClick={() => { setMenuAnchor(null); navigate('/library'); }}>
                                            <ListItemIcon><BookOpen size={16} /></ListItemIcon>
                                            <ListItemText>Open</ListItemText>
                                        </MenuItem>
                                        <MenuItem onClick={() => { setMenuAnchor(null); setPickerOpen(true); }}>
                                            <ListItemIcon><MoreVertical size={16} /></ListItemIcon>
                                            <ListItemText>Set categories</ListItemText>
                                        </MenuItem>
                                        <MenuItem onClick={() => { setMenuAnchor(null); setMappingDialogOpen(true); }}>
                                            <ListItemIcon><LinkIcon size={16} /></ListItemIcon>
                                            <ListItemText>Link to Tracker</ListItemText>
                                        </MenuItem>
                                        {trackerMappings.length > 0 && (
                                            <MenuItem onClick={(e) => { setMenuAnchor(null); setSyncMenuAnchor(e.currentTarget); }}>
                                                <ListItemIcon><SyncIcon size={16} /></ListItemIcon>
                                                <ListItemText>Sync to Tracker</ListItemText>
                                            </MenuItem>
                                        )}
                                        <MenuItem onClick={() => { setMenuAnchor(null); removeMutation.mutate(); }} sx={{ color: 'error.main' }}>
                                            <ListItemIcon><MoreVertical size={16} /></ListItemIcon>
                                            <ListItemText>Remove</ListItemText>
                                        </MenuItem>
                                    </Menu>
                                    <Menu anchorEl={syncMenuAnchor} open={Boolean(syncMenuAnchor)} onClose={() => setSyncMenuAnchor(null)}>
                                        {trackerMappings.map((mapping) => (
                                            <MenuItem 
                                                key={mapping.id}
                                                onClick={() => { 
                                                    setSyncMenuAnchor(null);
                                                    // Get the latest chapter number from chapters
                                                    const latestChapter = chapters?.[0]?.chapter_number || 0;
                                                    if (latestChapter > 0) {
                                                        syncMutation.mutate({ trackerName: mapping.tracker_name, chapterNumber: latestChapter });
                                                    }
                                                }}
                                            >
                                                <ListItemIcon><SyncIcon size={16} /></ListItemIcon>
                                                <ListItemText>Sync to {mapping.tracker_name.toUpperCase()}</ListItemText>
                                            </MenuItem>
                                        ))}
                                    </Menu>
                                </>
                            )}
                        </Box>

                        <Stack direction="row" spacing={1} flexWrap="wrap" mb={3}>
                            {details.genres.map((g) => (
                                <Chip
                                    key={g}
                                    label={g}
                                    sx={{
                                        bgcolor: { light: 'rgba(255, 255, 255, 0.5)', dark: 'rgba(31, 41, 55, 0.5)' },
                                        backdropFilter: 'blur(8px)',
                                        borderRadius: '999px',
                                        border: 1,
                                        borderColor: { light: '#e5e7eb', dark: '#374151' },
                                        color: '#4f46e5',
                                        fontSize: '0.875rem',
                                        fontWeight: 'bold',
                                    }}
                                />
                            ))}
                        </Stack>

                        <Stack direction="column" spacing={1} mb={4}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ color: { light: '#6b7280', dark: '#9ca3af' } }}>
                                    <User size={16} />
                                </Box>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: { light: '#111827', dark: '#f3f4f6' } }}>
                                    Author:
                                </Typography>
                                <Typography variant="body2" sx={{ color: { light: '#6b7280', dark: '#d1d5db' } }}>
                                    {displayAuthor}
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ color: { light: '#6b7280', dark: '#9ca3af' } }}>
                                    <PenTool size={16} />
                                </Box>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: { light: '#111827', dark: '#f3f4f6' } }}>
                                    Artist:
                                </Typography>
                                <Typography variant="body2" sx={{ color: { light: '#6b7280', dark: '#d1d5db' } }}>
                                    {displayArtist}
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: { light: '#111827', dark: '#f3f4f6' } }}>
                                    Rating:
                                </Typography>
                                <Typography variant="body2" sx={{ color: { light: '#6b7280', dark: '#d1d5db' } }}>
                                    {typeof displayRating === "number" ? `${displayRating.toFixed(1)}/10` : "N/A"}
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ color: { light: '#6b7280', dark: '#9ca3af' } }}>
                                    <Clock size={16} />
                                </Box>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: { light: '#111827', dark: '#f3f4f6' } }}>
                                    Status:
                                </Typography>
                                <Chip
                                    label={displayStatus}
                                    size="small"
                                    sx={{
                                        bgcolor: displayStatus === 'Ongoing'
                                            ? { light: '#d1fae5', dark: 'rgba(34, 197, 94, 0.2)' }
                                            : { light: '#dbeafe', dark: 'rgba(59, 130, 246, 0.2)' },
                                        color: displayStatus === 'Ongoing'
                                            ? { light: '#065f46', dark: '#34d399' }
                                            : { light: '#1e40af', dark: '#60a5fa' },
                                        fontWeight: 'bold',
                                        fontSize: '0.75rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                    }}
                                />
                            </Box>
                        </Stack>

                        <Paper sx={{
                            bgcolor: { light: 'rgba(255, 255, 255, 0.6)', dark: 'rgba(31, 41, 55, 0.4)' },
                            backdropFilter: 'blur(8px)',
                            borderRadius: 2,
                            border: 1,
                            borderColor: { light: 'rgba(229, 231, 235, 0.5)', dark: 'rgba(55, 65, 81, 0.5)' },
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                            overflow: 'hidden',
                            position: 'relative',
                        }}>
                            <Box sx={{
                                p: 3,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                mb: 1,
                            }}>
                                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                                    Synopsis
                                </Typography>
                                <Button
                                    onClick={handleGenerateSummary}
                                    disabled={generatingSummary}
                                    size="small"
                                    sx={{
                                        color: '#4f46e5',
                                        bgcolor: { light: 'rgba(79, 70, 229, 0.1)', dark: 'rgba(79, 70, 229, 0.2)' },
                                        borderRadius: '10px',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        textTransform: 'none',
                                        minWidth: 'auto',
                                        padding: '4px 8px',
                                        '&:hover': {
                                            bgcolor: { light: 'rgba(79, 70, 229, 0.2)', dark: 'rgba(79, 70, 229, 0.3)' },
                                        },
                                        '&:disabled': {
                                            opacity: 0.5,
                                        },
                                    }}
                                >
                                    <Sparkles size={14} style={{ marginRight: 4 }} />
                                    {generatingSummary ? 'Thinking...' : 'AI Summarize'}
                                </Button>
                            </Box>

                            {aiSummary ? (
                                <Box sx={{
                                    animation: 'fadeIn 0.7s ease',
                                    bgcolor: { light: 'rgba(238, 242, 255, 0.5)', dark: 'rgba(79, 70, 229, 0.1)' },
                                    p: 2,
                                    borderRadius: 2,
                                    border: 1,
                                    borderColor: { light: 'rgba(224, 231, 255, 0.3)', dark: 'rgba(79, 70, 229, 0.3)' },
                                    mb: 2,
                                    ml: 3,
                                    mr: 3,
                                }}>
                                    <Typography variant="body2" sx={{
                                        color: { light: '#312e81', dark: '#c7d2fe' },
                                        fontStyle: 'italic',
                                        lineHeight: 1.6,
                                        '&:before': {
                                            content: '"',
                                            fontSize: '1.5rem',
                                            color: '#6366f1',
                                            marginRight: '4px',
                                        },
                                        '&:after': {
                                            content: '"',
                                            fontSize: '1.5rem',
                                            color: '#6366f1',
                                            marginLeft: '4px',
                                        },
                                    }}>
                                        {aiSummary}
                                    </Typography>
                                </Box>
                            ) : null}

                            <Typography variant="body1" sx={{
                                color: { light: '#374151', dark: '#d1d5db' },
                                lineHeight: 1.8,
                                px: 3,
                                pb: 3,
                                fontSize: { xs: '0.875rem', md: '1rem' },
                            }}>
                                {displayDescription}
                            </Typography>
                        </Paper>
                    </Grid>
                </Grid>

                <Divider sx={{ my: 3 }} />

                <Box sx={{ pt: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
                        <Box sx={{ color: '#4f46e5' }}>
                            <BookOpen size={24} />
                        </Box>
                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                            Chapters
                        </Typography>
                    </Box>

                    {loadingChapters ? (
                        <Grid container spacing={2}>
                            {[1, 2, 3].map(i => (
                                <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                                    <Box sx={{
                                        height: 64,
                                        bgcolor: { light: '#f3f4f6', dark: '#374151' },
                                        borderRadius: 2,
                                        animation: 'pulse 1.5s ease-in-out infinite',
                                    }} />
                                </Grid>
                            ))}
                        </Grid>
                    ) : (
                        <Grid container spacing={2}>
                            {chapters && chapters.length > 0 ? (
                                chapters.slice().reverse().map((ch) => {
                                    const chapterDownload = downloads.find((d) => d.chapter_url === ch.url);
                                    const hasDownloadedFiles = !!chapterDownload?.file_path && chapterDownload.status === 'completed';
                                    const isRead = isChapterRead(ch.url);
                                    return (
                                    <Grid key={ch.url} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                                        <Paper 
                                            sx={{
                                                p: 2,
                                                bgcolor: { light: 'white', dark: '#1f2937' },
                                                border: 1,
                                                borderColor: isRead 
                                                    ? 'rgba(34, 197, 94, 0.3)' 
                                                    : { light: '#e5e7eb', dark: '#374151' },
                                                borderRadius: 2,
                                                transition: 'all 0.2s ease',
                                                opacity: isRead ? 0.7 : 1,
                                                '&:hover': {
                                                    bgcolor: { light: 'rgba(79, 70, 229, 0.05)', dark: 'rgba(31, 41, 55, 0.8)' },
                                                    borderColor: 'rgba(79, 70, 229, 0.3)',
                                                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                                                }
                                            }}
                                            onContextMenu={(e) => handleContextMenu(e, ch)}
                                        >
                                            <Link
                                                to={`/reader?chapter_url=${encodeURIComponent(ch.url)}&source=${encodeURIComponent(source || '')}${url ? `&manga_url=${encodeURIComponent(url)}` : ''}`}
                                                style={{ textDecoration: 'none', color: 'inherit' }}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                    {isRead && (
                                                        <CheckCircle size={16} style={{ color: '#22c55e', marginRight: 8 }} />
                                                    )}
                                                    <Typography variant="body2" sx={{
                                                        fontWeight: 'medium',
                                                        color: isRead 
                                                            ? { light: '#6b7280', dark: '#9ca3af' }
                                                            : { light: '#111827', dark: '#f3f4f6' },
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        flexGrow: 1,
                                                    }}>
                                                        {formatChapterTitle(ch.title, ch.chapter_number)}
                                                    </Typography>
                                                    {isRead && (
                                                        <Chip 
                                                            label="Read" 
                                                            size="small" 
                                                            sx={{
                                                                ml: 1,
                                                                bgcolor: 'rgba(34, 197, 94, 0.2)',
                                                                color: '#22c55e',
                                                                fontSize: '0.7rem',
                                                                height: 20,
                                                            }}
                                                        />
                                                    )}
                                                </Box>
                                            </Link>
                                            <Stack direction="row" spacing={1}>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    fullWidth
                                                onClick={() =>
                                                    queueMutation.mutate({
                                                        manga_title: details.title,
                                                        manga_url: url!,
                                                        source: source || 'mangakatana:en',
                                                        chapter_number: ch.chapter_number || 0,
                                                        chapter_url: ch.url,
                                                        chapter_title: formatChapterTitle(ch.title, ch.chapter_number),
                                                    })
                                                }
                                                >
                                                    {hasDownloadedFiles ? 'Re-download' : 'Download Chapter'}
                                                </Button>
                                                {hasDownloadedFiles && chapterDownload && (
                                                    <Button
                                                        size="small"
                                                        color="error"
                                                        variant="outlined"
                                                        onClick={() => deleteDownloadedMutation.mutate(chapterDownload.id)}
                                                        disabled={deleteDownloadedMutation.isPending}
                                                    >
                                                        Delete
                                                    </Button>
                                                )}
                                            </Stack>
                                        </Paper>
                                    </Grid>
                                    );
                                })
                            ) : (
                                <Grid size={{ xs: 12 }}>
                                    <Typography variant="body2" sx={{
                                        color: { light: '#6b7280', dark: '#9ca3af' },
                                        textAlign: 'center',
                                        py: 6,
                                    }}>
                                        No chapters available.
                                    </Typography>
                                </Grid>
                            )}
                        </Grid>
                    )}
                </Box>
            </Box>

            {/* Context Menu for Chapter Read/Unread */}
            <Menu
                anchorEl={contextMenuAnchor}
                open={Boolean(contextMenuAnchor)}
                onClose={handleContextMenuClose}
            >
                {selectedChapter && !isChapterRead(selectedChapter.url) && (
                    <MenuItem onClick={handleMarkAsRead} disabled={markReadMutation.isPending}>
                        <ListItemIcon>
                            <CheckCircle size={16} />
                        </ListItemIcon>
                        <ListItemText>Mark as Read</ListItemText>
                    </MenuItem>
                )}
                {selectedChapter && isChapterRead(selectedChapter.url) && (
                    <MenuItem onClick={handleMarkAsUnread} disabled={markUnreadMutation.isPending}>
                        <ListItemIcon>
                            <BookOpen size={16} />
                        </ListItemIcon>
                        <ListItemText>Mark as Unread</ListItemText>
                    </MenuItem>
                )}
            </Menu>

            <SetCategoriesPicker
                open={pickerOpen}
                mangaId={libraryManga?.id}
                mangaTitle={details.title}
                onClose={() => setPickerOpen(false)}
            />
            <LibraryFeedbackSnackbar
                open={feedbackOpen}
                message={feedbackMessage}
                onClose={() => setFeedbackOpen(false)}
                actions={feedbackActions}
            />
            {libraryManga?.id && (
                <TrackerMappingDialog
                    open={mappingDialogOpen}
                    onClose={() => setMappingDialogOpen(false)}
                    mangaId={libraryManga.id}
                    mangaTitle={details.title}
                />
            )}
        </Container>
    );
}
