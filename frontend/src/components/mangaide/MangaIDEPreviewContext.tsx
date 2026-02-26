import React, { createContext, useContext } from 'react';

export interface MangaIDEPreviewData {
  title: string;
  coverUrl?: string;
  status?: string;
  rating?: number;
  author?: string;
  artist?: string;
  source?: string;
  description?: string;
  mangaUrl?: string;
  sourceId?: string;
  chapters?: number;
  inLibrary?: boolean;
}

interface MangaIDEPreviewContextType {
  preview: MangaIDEPreviewData | null;
  setPreview: (data: MangaIDEPreviewData | null) => void;
}

const MangaIDEPreviewContext = createContext<MangaIDEPreviewContextType | undefined>(undefined);

export function MangaIDEPreviewProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: MangaIDEPreviewContextType;
}) {
  return <MangaIDEPreviewContext.Provider value={value}>{children}</MangaIDEPreviewContext.Provider>;
}

export function useMangaIDEPreview() {
  const context = useContext(MangaIDEPreviewContext);
  if (!context) {
    return { preview: null, setPreview: (_data: MangaIDEPreviewData | null) => {} };
  }
  return context;
}
