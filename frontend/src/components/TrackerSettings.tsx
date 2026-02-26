import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
} from '@mui/material';
import {
  Link as LinkIcon,
  Unlink as UnlinkIcon,
  Check as CheckIcon,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTrackers,
  getTrackerStatus,
  connectTracker,
  disconnectTracker,
} from '../lib/api';

const trackerIcons: Record<string, string> = {
  mal: 'https://cdn.myanimelist.net/img/sp/icon/apple-touch-icon-256.png',
  anilist: 'https://anilist.co/img/icons/android-chrome-512x512.png',
  kitsu: 'https://kitsu.app/kitsu-256.png',
  mangaupdates: 'https://www.mangaupdates.com/images/logo.png',
};

export default function TrackerSettings() {
  const queryClient = useQueryClient();

  // Listen for tracker connection messages from OAuth popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'TRACKER_CONNECTED') {
        queryClient.invalidateQueries({ queryKey: ['tracker-statuses'] });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [queryClient]);

  const { data: trackersData, isLoading: trackersLoading } = useQuery({
    queryKey: ['trackers'],
    queryFn: getTrackers,
  });

  const trackerStatuses = useQuery({
    queryKey: ['tracker-statuses'],
    queryFn: async () => {
      if (!trackersData?.trackers) return {};
      const statuses: Record<string, { connected: boolean; username: string | null; user_id: string | number | null }> = {};
      for (const tracker of trackersData.trackers) {
        try {
          statuses[tracker.name] = await getTrackerStatus(tracker.name);
        } catch {
          statuses[tracker.name] = { connected: false, username: null, user_id: null };
        }
      }
      return statuses;
    },
    enabled: !!trackersData?.trackers,
  });

  const connectMutation = useMutation({
    mutationFn: connectTracker,
    onSuccess: (data) => {
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open(
        data.auth_url,
        'tracker-oauth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectTracker,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracker-statuses'] });
    },
  });

  const handleConnect = (trackerName: string) => {
    connectMutation.mutate(trackerName);
  };

  const handleDisconnect = async (trackerName: string) => {
    if (confirm('Are you sure you want to disconnect this tracker?')) {
      disconnectMutation.mutate(trackerName);
    }
  };

  if (trackersLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  const trackers = trackersData?.trackers || [];

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Tracker Integrations
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Connect your manga tracking accounts to sync reading progress automatically.
      </Typography>

      <Chip
        label="When you finish reading a chapter, your progress will be automatically synced to connected trackers."
        color="info"
        variant="outlined"
        sx={{ mb: 3 }}
      />

      <List>
        {trackers.map((tracker) => {
          const status = trackerStatuses.data?.[tracker.name];
          const isConnected = status?.connected;

          return (
            <ListItem
              key={tracker.name}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                mb: 2,
                bgcolor: 'background.paper',
              }}
            >
              <Avatar
                src={trackerIcons[tracker.name]}
                alt={tracker.display_name}
                sx={{ width: 40, height: 40, mr: 2 }}
              >
                {tracker.display_name[0]}
              </Avatar>
              <ListItemText
                primary={tracker.display_name}
                secondary={
                  isConnected
                    ? `Connected as ${status.username}`
                    : tracker.oauth_configured
                    ? 'Not connected'
                    : 'Not configured'
                }
              />
              <ListItemSecondaryAction>
                {isConnected ? (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                      icon={<CheckIcon size={16} />}
                      label="Connected"
                      color="success"
                      size="small"
                    />
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={<UnlinkIcon size={16} />}
                      onClick={() => handleDisconnect(tracker.name)}
                      disabled={disconnectMutation.isPending}
                    >
                      Disconnect
                    </Button>
                  </Box>
                ) : (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<LinkIcon size={16} />}
                    onClick={() => handleConnect(tracker.name)}
                    disabled={!tracker.oauth_configured || connectMutation.isPending}
                  >
                    Connect
                  </Button>
                )}
              </ListItemSecondaryAction>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
}
