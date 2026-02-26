import React from 'react';
import AppFrame from "../components/AppFrame";
import MangaIDEFrame from "../components/mangaide/MangaIDEFrame";
import { useColorMode } from '../theme/ColorModeContext';

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { uiMode } = useColorMode();

  if (uiMode === 'mangaide') {
    return (
      <MangaIDEFrame>
        {children}
      </MangaIDEFrame>
    );
  }

  return (
    <AppFrame>
      {children}
    </AppFrame>
  );
}
