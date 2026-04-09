import React, { useState, useEffect } from 'react';
import { Chapter, Manga, ReadingMode, ZoomMode, ReaderSettings } from '../types';
import { explainChapter } from '../services/geminiService';
import { ReaderControls } from './ReaderControls';
import {
  Box,
  Typography,
  Paper,
  Fade,
} from '@mui/material';

interface ReaderProps {
  manga: Manga;
  chapter: Chapter;
  onClose: () => void;
  onNextChapter: () => void;
  onPrevChapter: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

const DEFAULT_SETTINGS: ReaderSettings = {
  readingMode: 'VERTICAL',
  zoomMode: 'FIT_HEIGHT',
  customZoom: 100,
  autoScroll: false,
  scrollSpeed: 50,
  showPageNumbers: true,
  showProgress: true,
};

export const Reader: React.FC<ReaderProps> = ({
  manga,
  chapter,
  onClose,
  onNextChapter,
  onPrevChapter,
  hasPrev,
  hasNext
}) => {
  const [showControls, setShowControls] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [teaser, setTeaser] = useState<string>('');

  useEffect(() => {
    // Load saved settings from localStorage
    const savedSettings = localStorage.getItem('readerSettings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (error) {
        console.error('Failed to parse reader settings:', error);
      }
    }

    // Reset to first page when chapter changes
    setCurrentPage(1);
  }, [chapter]);

  useEffect(() => {
    explainChapter(chapter.title, manga.title).then(setTeaser);
  }, [chapter, manga]);

  useEffect(() => {
    // Save settings to localStorage
    localStorage.setItem('readerSettings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handlePrevPage();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNextPage();
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (settings.readingMode === 'VERTICAL') {
            window.scrollBy({ top: -window.innerHeight / 2, behavior: 'smooth' });
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (settings.readingMode === 'VERTICAL') {
            window.scrollBy({ top: window.innerHeight / 2, behavior: 'smooth' });
          }
          break;
        case ' ':
          e.preventDefault();
          if (settings.readingMode === 'VERTICAL') {
            window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
          } else {
            handleNextPage();
          }
          break;
        case 'f':
          e.preventDefault();
          handleZoomModeChange(settings.zoomMode === 'FIT_WIDTH' ? 'FIT_HEIGHT' : 'FIT_WIDTH');
          break;
        case 'm':
          e.preventDefault();
          handleReadingModeChange(
            settings.readingMode === 'VERTICAL' ? 'SINGLE' :
            settings.readingMode === 'SINGLE' ? 'DOUBLE' : 'VERTICAL'
          );
          break;
        case 'c':
          e.preventDefault();
          setShowControls(!showControls);
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings, currentPage, chapter.pages.length, hasPrev, hasNext]);

  const handleReadingModeChange = (mode: ReadingMode) => {
    setSettings(prev => ({ ...prev, readingMode: mode }));
    setCurrentPage(1);
  };

  const handleZoomModeChange = (mode: ZoomMode) => {
    setSettings(prev => ({ ...prev, zoomMode: mode }));
  };

  const handleSettingsChange = (newSettings: ReaderSettings) => {
    setSettings(newSettings);
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= chapter.pages.length) {
      setCurrentPage(page);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    } else if (hasPrev) {
      onPrevChapter();
    }
  };

  const handleNextPage = () => {
    if (currentPage < chapter.pages.length) {
      setCurrentPage(prev => prev + 1);
    } else if (hasNext) {
      onNextChapter();
    }
  };

  const getImageStyle = () => {
    switch (settings.zoomMode) {
      case 'FIT_WIDTH':
        return { width: '100%', height: 'auto' };
      case 'FIT_HEIGHT':
        return { width: 'auto', height: '100%' };
      case 'CUSTOM':
        return { width: `${settings.customZoom}%`, height: 'auto' };
    }
  };

  const renderVerticalMode = () => (
    <Box
      sx={{
        maxWidth: '48rem',
        mx: 'auto',
        position: 'relative',
        zIndex: 10,
        pt: 8,
        pb: 16,
        minHeight: '100vh',
        bgcolor: '#09090b',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      }}
    >
      {settings.showPageNumbers && (
        <Box sx={{ mb: 4, px: 2, textAlign: 'center' }}>
          <Typography sx={{ color: '#71717a', fontSize: '0.875rem' }}>
            Page {currentPage} of {chapter.pages.length}
          </Typography>
        </Box>
      )}

      {chapter.pages.map((url, idx) => (
        <Box
          key={idx}
          component="img"
          src={url}
          alt={`Page ${idx + 1}`}
          sx={{
            ...getImageStyle(),
            display: 'block',
            mb: 1,
          }}
          loading="lazy"
        />
      ))}

      {/* Navigation Footer */}
      <Box sx={{ mt: 6, px: 2, py: 4, borderTop: '1px solid #3f3f46', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Typography sx={{ color: '#71717a' }}>
          End of Chapter {chapter.number}
        </Typography>
      </Box>
    </Box>
  );

  const renderSinglePageMode = () => (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 8,
        position: 'relative',
        zIndex: 10,
      }}
    >
      <Box
        component="img"
        src={chapter.pages[currentPage - 1]}
        alt={`Page ${currentPage}`}
        sx={{
          ...getImageStyle(),
          maxWidth: '100%',
          maxHeight: '100%',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
        }}
      />
    </Box>
  );

  const renderDoublePageMode = () => {
    const currentPageIndex = currentPage - 1;
    const nextPageIndex = currentPage;
    const hasNextPage = nextPageIndex < chapter.pages.length;

    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
          py: 8,
          position: 'relative',
          zIndex: 10,
          gap: 4,
        }}
      >
        <Box
          component="img"
          src={chapter.pages[currentPageIndex]}
          alt={`Page ${currentPage}`}
          sx={{
            ...getImageStyle(),
            maxWidth: '100%',
            maxHeight: '100%',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
          }}
        />
        {hasNextPage && (
          <Box
            component="img"
            src={chapter.pages[nextPageIndex]}
            alt={`Page ${currentPage + 1}`}
            sx={{
              ...getImageStyle(),
              maxWidth: '100%',
              maxHeight: '100%',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
            }}
          />
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#000', position: 'relative' }}>
      <ReaderControls
        settings={settings}
        onSettingsChange={handleSettingsChange}
        currentPage={currentPage}
        totalPages={chapter.pages.length}
        onPageChange={handlePageChange}
        onClose={onClose}
        hasPrevChapter={hasPrev}
        hasNextChapter={hasNext}
        onPrevChapter={onPrevChapter}
        onNextChapter={onNextChapter}
        showControls={showControls}
        onToggleControls={() => setShowControls(!showControls)}
      />

      {/* Reading Content */}
      {settings.readingMode === 'VERTICAL' && renderVerticalMode()}
      {settings.readingMode === 'SINGLE' && renderSinglePageMode()}
      {settings.readingMode === 'DOUBLE' && renderDoublePageMode()}
    </Box>
  );
};
