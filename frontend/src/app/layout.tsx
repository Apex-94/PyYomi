import React from 'react';
import MangaIDEFrame from "../components/mangaide/MangaIDEFrame";

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MangaIDEFrame>
      {children}
    </MangaIDEFrame>
  );
}
