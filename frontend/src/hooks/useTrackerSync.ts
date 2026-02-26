import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTrackerMappings, syncToTracker, getSyncQueue, processSyncQueue } from '../lib/api';

export function useTrackerSync(trackerName: string, mangaId?: number) {
  const queryClient = useQueryClient();

  const mappingsQuery = useQuery({
    queryKey: ['tracker-mappings', trackerName],
    queryFn: () => getTrackerMappings(trackerName),
  });

  const syncMutation = useMutation({
    mutationFn: (chapterNumber: number) => {
      if (!mangaId) throw new Error('Manga ID required');
      return syncToTracker(trackerName, mangaId, chapterNumber);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracker-mappings', trackerName] });
    },
  });

  const queueQuery = useQuery({
    queryKey: ['sync-queue', trackerName],
    queryFn: () => getSyncQueue(trackerName),
    refetchInterval: 5000,
  });

  const processQueueMutation = useMutation({
    mutationFn: () => processSyncQueue(trackerName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-queue', trackerName] });
    },
  });

  return {
    mappings: mappingsQuery.data?.mappings || [],
    isLoadingMappings: mappingsQuery.isLoading,
    sync: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    syncError: syncMutation.error,
    queue: queueQuery.data?.queue || [],
    processQueue: processQueueMutation.mutate,
    isProcessing: processQueueMutation.isPending,
  };
}
