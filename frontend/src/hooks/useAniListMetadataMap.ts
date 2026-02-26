import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AniListMetadata, getAniListMetadataBatch } from '../lib/api';

export interface AniListMapItem {
  key: string;
  title: string;
}

export function useAniListMetadataMap(items: AniListMapItem[]) {
  const titles = useMemo(() => items.map((i) => i.title), [items]);

  const query = useQuery({
    queryKey: ['anilist-meta-map', titles],
    queryFn: () => getAniListMetadataBatch(titles),
    enabled: titles.length > 0,
    staleTime: 1000 * 60 * 30,
  });

  const byKey = useMemo(() => {
    const map = new Map<string, AniListMetadata>();
    const list = query.data || [];
    items.forEach((item, idx) => {
      const meta = list[idx];
      if (meta?.found) {
        map.set(item.key, meta);
      }
    });
    return map;
  }, [items, query.data]);

  return { ...query, byKey };
}

