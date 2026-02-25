import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress,
  Alert,
  Box,
  Chip,
  IconButton,
  Typography,
} from '@mui/material';
import { Search, Link as LinkIcon, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTrackers,
  getTrackerStatus,
  searchTrackerManga,
  getTrackerMappings,
  createTrackerMapping,
  deleteTrackerMapping,
} from '../lib/api';
import type { TrackerManga, Tracker } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  mangaId: number;
  mangaTitle: string;
}

export default function TrackerMappingDialog({ open, onClose, mangaId, mangaTitle }: Props) {
  const [selectedTracker, setSelectedTracker] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TrackerManga[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: trackersData } = useQuery({
    queryKey: ['trackers'],
    queryFn: getTrackers,
  });

  const { data: trackerStatuses } = useQuery({
    queryKey: ['tracker-statuses'],
    queryFn: async () => {
      const statuses: Record<string, { connected: boolean; username: string | null }> = {};
      if (!trackersData?.trackers) return statuses;
      for (const tracker of trackersData.trackers) {
        try {
          const response = await getTrackerStatus(tracker.name);
          statuses[tracker.name] = { connected: response.connected, username: response.username };
        } catch {
          statuses[tracker.name] = { connected: false, username: null };
        }
      }
      return statuses;
    },
    enabled: !!trackersData?.trackers,
  });

  const { data: mappings } = useQuery({
    queryKey: ['tracker-mappings-all', mangaId],
    queryFn: async () => {
      const results: Record<string, { id: number; tracker_manga_id: string; tracker_url: string | null; last_synced_chapter: number | null }> = {};
      if (!trackersData?.trackers) return results;
      for (const tracker of trackersData.trackers) {
        try {
          const data = await getTrackerMappings(tracker.name);
          const mapping = data.mappings?.find((m) => m.manga_id === mangaId);
          if (mapping) {
            results[tracker.name] = {
              id: mapping.id,
              tracker_manga_id: mapping.tracker_manga_id,
              tracker_url: mapping.tracker_url,
              last_synced_chapter: mapping.last_synced_chapter,
            };
          }
        } catch { /* Ignore errors for individual trackers */ }
      }
      return results;
    },
    enabled: !!trackersData?.trackers && open,
  });

  const createMappingMutation = useMutation({
    mutationFn: ({ trackerName, trackerMangaId }: { trackerName: string; trackerMangaId: string }) =>
      createTrackerMapping(trackerName, mangaId, trackerMangaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracker-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['tracker-mappings-all'] });
      resetSearchState();
    },
  });

  const deleteMappingMutation = useMutation({
    mutationFn: (trackerName: string) => deleteTrackerMapping(trackerName, mangaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracker-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['tracker-mappings-all'] });
    },
  });

  const resetSearchState = () => {
    setSearchResults([]);
    setSelectedTracker(null);
    setSearchQuery('');
    setSearchError(null);
  };

  const handleSearch = async (trackerName: string) => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    setSelectedTracker(trackerName);
    try {
      const results = await searchTrackerManga(trackerName, searchQuery);
      setSearchResults(results.results || []);
    } catch {
      setSearchError('Failed to search. Please try again.');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectManga = (trackerManga: TrackerManga) => {
    if (!selectedTracker) return;
    createMappingMutation.mutate({
      trackerName: selectedTracker,
      trackerMangaId: trackerManga.id,
    });
  };

  const handleClose = () => {
    resetSearchState();
    onClose();
  };

  const connectedTrackers = trackersData?.trackers?.filter(
    (tracker: Tracker) => trackerStatuses?.[tracker.name]?.connected
  ) || [];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Link to Tracker</span>
        <IconButton onClick={handleClose} size="small">
          <X size={20} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          Link "{mangaTitle}" to your tracker accounts to sync reading progress automatically.
        </Alert>

        {connectedTrackers.length === 0 && trackersData?.trackers && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No connected trackers found. Please connect a tracker in Settings first.
          </Alert>
        )}

        <List sx={{ pt: 0 }}>
          {connectedTrackers.map((tracker: Tracker) => {
            const mapping = mappings?.[tracker.name];
            const isExpanded = selectedTracker === tracker.name && !mapping;

            return (
              <Box key={tracker.name}>
                <ListItem
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                    bgcolor: mapping ? 'action.selected' : 'background.paper',
                  }}
                  secondaryAction={
                    mapping ? (
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Chip icon={<LinkIcon size={16} />} label="Linked" color="success" size="small" />
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          onClick={() => deleteMappingMutation.mutate(tracker.name)}
                          disabled={deleteMappingMutation.isPending}
                        >
                          Unlink
                        </Button>
                      </Box>
                    ) : (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setSelectedTracker(tracker.name);
                          setSearchQuery(mangaTitle);
                        }}
                      >
                        Link
                      </Button>
                    )
                  }
                >
                  <ListItemText
                    primary={tracker.display_name}
                    secondary={
                      mapping
                        ? `ID: ${mapping.tracker_manga_id}${mapping.last_synced_chapter ? ` • Last synced: Ch. ${mapping.last_synced_chapter}` : ''}`
                        : trackerStatuses?.[tracker.name]?.username
                          ? `Connected as ${trackerStatuses[tracker.name].username}`
                          : 'Not linked'
                    }
                  />
                </ListItem>

                {isExpanded && (
                  <Box sx={{ ml: 2, mr: 2, mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label={`Search on ${tracker.display_name}`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch(tracker.name)}
                        disabled={searching}
                      />
                      <IconButton
                        onClick={() => handleSearch(tracker.name)}
                        disabled={searching || !searchQuery.trim()}
                        sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
                      >
                        {searching ? <CircularProgress size={20} color="inherit" /> : <Search size={20} />}
                      </IconButton>
                    </Box>

                    {searchError && <Alert severity="error" sx={{ mb: 2 }}>{searchError}</Alert>}

                    {searchResults.length > 0 && (
                      <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                        {searchResults.map((manga) => (
                          <ListItemButton
                            key={manga.id}
                            onClick={() => handleSelectManga(manga)}
                            sx={{
                              border: 1,
                              borderColor: 'divider',
                              borderRadius: 1,
                              mb: 1,
                              '&:hover': { borderColor: 'primary.main', bgcolor: 'action.selected' },
                            }}
                          >
                            <ListItemText
                              primary={manga.title}
                              secondary={
                                <Typography variant="caption" color="text.secondary">
                                  {manga.chapters ? `${manga.chapters} chapters` : 'Unknown chapters'} • {manga.status}
                                  {manga.user_status && ` • ${manga.user_status}`}
                                </Typography>
                              }
                            />
                          </ListItemButton>
                        ))}
                      </List>
                    )}

                    {searchResults.length === 0 && !searching && searchQuery && selectedTracker === tracker.name && (
                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                        Click search to find manga
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            );
          })}
        </List>

        {createMappingMutation.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Failed to create mapping. Please try again.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
