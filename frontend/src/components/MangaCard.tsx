import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Manga } from '../types';
import { Star, BookOpen, Plus, MoreVertical, Trash2, Check } from 'lucide-react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
  useTheme,
  CircularProgress,
} from '@mui/material';

export interface SecondaryAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

type LibraryButtonState = 'not_in_library' | 'adding' | 'in_library';

interface MangaCardProps {
  manga: Manga;
  mangaSource?: string;
  isFavorite?: boolean;
  toggleFavorite?: (e: React.MouseEvent, id: string) => void;
  onAddToLibrary?: (e: React.MouseEvent, id: string) => void;
  onOpenInLibrary?: () => void;
  onSetCategories?: () => void;
  onRemoveFromLibrary?: () => void;
  libraryButtonState?: LibraryButtonState;
  onRemove?: () => void;
  showRemoveButton?: boolean;
  actionMode?: 'overlay' | 'footer-menu' | 'auto';
  showStatusBadge?: boolean;
  secondaryActions?: SecondaryAction[];
}

export const MangaCard: React.FC<MangaCardProps> = ({
  manga,
  mangaSource,
  isFavorite,
  toggleFavorite,
  onAddToLibrary,
  onOpenInLibrary,
  onSetCategories,
  onRemoveFromLibrary,
  libraryButtonState,
  onRemove,
  showRemoveButton,
  actionMode = 'auto',
  showStatusBadge = true,
  secondaryActions,
}) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const resolvedActionMode = actionMode === 'auto' ? ((canHover && !isMobile) ? 'overlay' : 'footer-menu') : actionMode;
  const resolvedLibraryState: LibraryButtonState = libraryButtonState || (onAddToLibrary ? 'not_in_library' : 'not_in_library');

  const builtInActions = useMemo(() => {
    const actions: SecondaryAction[] = [];
    const syntheticEvent = {
      stopPropagation: () => {},
      preventDefault: () => {},
    } as React.MouseEvent;

    if (toggleFavorite) {
      actions.push({
        id: 'favorite',
        label: isFavorite ? 'Remove Favorite' : 'Add Favorite',
        icon: <Star size={16} />,
        onClick: () => toggleFavorite(syntheticEvent, manga.id),
      });
    }

    if (showRemoveButton && onRemove) {
      actions.push({
        id: 'remove',
        label: 'Remove',
        icon: <Trash2 size={16} />,
        onClick: onRemove,
        danger: true,
      });
    }

    return [...actions, ...(secondaryActions || [])];
  }, [isFavorite, manga.id, onRemove, secondaryActions, showRemoveButton, toggleFavorite]);

  const openReader = () => {
    const params = new URLSearchParams({ url: manga.id });
    if (mangaSource) {
      params.set('source', mangaSource);
    }
    navigate(`/manga?${params.toString()}`);
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const runAction = (e: React.MouseEvent, fn: () => void) => {
    e.stopPropagation();
    fn();
  };

  const sourceLabel = useMemo(() => {
    if (!mangaSource) return null;
    const normalized = mangaSource.split(':')[0]?.trim();
    if (!normalized) return null;
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }, [mangaSource]);

  const handleLibraryAction = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if (resolvedLibraryState === 'adding') {
      return;
    }
    if (resolvedLibraryState === 'in_library') {
      setMenuAnchor(e.currentTarget);
      return;
    }
    if (onAddToLibrary) {
      onAddToLibrary(e as React.MouseEvent, manga.id);
    }
  };

  const renderLibraryButton = (compact = false) => {
    if (!onAddToLibrary && resolvedLibraryState !== 'in_library') return null;
    const baseSx = {
      minHeight: 32,
      borderRadius: 1.25,
      px: compact ? 1 : 1.25,
      fontWeight: 700,
      textTransform: 'none' as const,
      boxShadow: compact ? '0 2px 10px rgba(0,0,0,0.25)' : 'none',
      backdropFilter: compact ? 'blur(8px)' : 'none',
    };

    if (resolvedLibraryState === 'adding') {
      return (
        <Button
          size="small"
          variant="contained"
          disabled
          startIcon={<CircularProgress size={12} />}
          sx={{
            ...baseSx,
            bgcolor: 'rgba(75, 85, 99, 0.92)',
            color: '#fff',
          }}
        >
          Adding...
        </Button>
      );
    }

    if (resolvedLibraryState === 'in_library') {
      return (
        <Button
          size="small"
          variant="contained"
          startIcon={<Check size={14} />}
          onClick={handleLibraryAction}
          sx={{
            ...baseSx,
            bgcolor: 'rgba(22, 163, 74, 0.95)',
            color: '#fff',
            '&:hover': { bgcolor: 'rgba(21, 128, 61, 0.98)' },
          }}
        >
          In Library
        </Button>
      );
    }

    return (
      <Button
        size="small"
        variant="contained"
        startIcon={<Plus size={14} />}
        onClick={handleLibraryAction}
        sx={{
          ...baseSx,
          bgcolor: 'rgba(79, 70, 229, 0.95)',
          color: '#fff',
          '&:hover': { bgcolor: 'rgba(67, 56, 202, 0.98)' },
        }}
      >
        Add
      </Button>
    );
  };

  return (
    <Box
      onClick={openReader}
      sx={{
        cursor: 'pointer',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderRadius: 2,
        p: 1,
        background: theme.palette.mode === 'light'
          ? 'linear-gradient(180deg, rgba(255,250,244,0.88), rgba(244,234,222,0.66))'
          : 'linear-gradient(180deg, rgba(37,30,27,0.92), rgba(27,22,20,0.7))',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: theme.palette.mode === 'light'
          ? '0 16px 34px rgba(89, 58, 41, 0.08)'
          : '0 16px 34px rgba(0, 0, 0, 0.22)',
        transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1), border-color 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        '&:hover .cover-img': { transform: 'scale(1.04)' },
        '&:hover .overlay-actions': {
          opacity: resolvedActionMode === 'overlay' ? 1 : undefined,
          transform: resolvedActionMode === 'overlay' ? 'translateY(0)' : undefined,
          pointerEvents: resolvedActionMode === 'overlay' ? 'auto' : undefined,
        },
        '&:hover': {
          transform: 'translateY(-4px)',
          borderColor: theme.palette.mode === 'light' ? 'rgba(142, 59, 47, 0.22)' : 'rgba(213, 141, 107, 0.24)',
          boxShadow: theme.palette.mode === 'light'
            ? '0 24px 44px rgba(89, 58, 41, 0.12)'
            : '0 24px 44px rgba(0, 0, 0, 0.3)',
        },
      }}
    >
      <Box
        sx={{
          aspectRatio: '2/3',
          overflow: 'hidden',
          borderRadius: 2,
          mb: 1.25,
          position: 'relative',
          bgcolor: 'action.hover',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box
          component="img"
          src={manga.coverUrl}
          alt={manga.title}
          className="cover-img"
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.3s ease',
          }}
          loading="lazy"
        />

        {showStatusBadge && (
          <Box
            sx={{
              position: 'absolute',
              top: 1.5,
              right: 1.5,
              px: 1,
              py: 0.35,
              borderRadius: 999,
              bgcolor: manga.status === 'Ongoing' ? 'rgba(47, 108, 93, 0.92)' : 'rgba(56, 92, 87, 0.92)',
              color: '#f8f1e7',
              fontSize: '0.625rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              backdropFilter: 'blur(6px)',
            }}
          >
            {manga.status}
          </Box>
        )}

        {resolvedActionMode === 'overlay' && (
          <Box
            className="overlay-actions"
            sx={{
              position: 'absolute',
              left: 1.5,
              right: 1.5,
              bottom: 1.5,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 1,
              opacity: 0,
              transform: 'translateY(6px)',
              transition: 'all 0.2s ease',
              pointerEvents: 'none',
            }}
          >
            <Button
              size="small"
              variant="contained"
              startIcon={<BookOpen size={14} />}
              onClick={(e) => runAction(e, openReader)}
              sx={{
                minHeight: 32,
                px: 1.25,
                borderRadius: 1.25,
                boxShadow: 'none',
              }}
            >
              Read
            </Button>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              {renderLibraryButton(true)}
              {toggleFavorite && (
                <IconButton
                  size="small"
                  onClick={(e) => runAction(e, () => toggleFavorite(e, manga.id))}
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: isFavorite ? 'warning.main' : 'rgba(0,0,0,0.55)',
                    color: isFavorite ? '#111827' : '#fff',
                    '&:hover': { bgcolor: isFavorite ? 'warning.light' : 'primary.main' },
                  }}
                >
                  <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
                </IconButton>
              )}
              {showRemoveButton && onRemove && (
                <IconButton
                  size="small"
                  onClick={(e) => runAction(e, onRemove)}
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: 'rgba(220,38,38,0.9)',
                    color: '#fff',
                    '&:hover': { bgcolor: '#dc2626' },
                  }}
                >
                  <Trash2 size={16} />
                </IconButton>
              )}
            </Box>
          </Box>
        )}
      </Box>

      <Box sx={{ minHeight: 72, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography
          variant="body2"
          sx={{
            fontWeight: 800,
            lineHeight: 1.35,
            color: 'text.primary',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: 38,
          }}
        >
          {manga.title}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
        >
          {manga.genres?.[0] || manga.author || sourceLabel || 'Unknown'}
        </Typography>
      </Box>

      {resolvedActionMode === 'footer-menu' && (
        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="contained"
            startIcon={<BookOpen size={14} />}
            onClick={(e) => runAction(e, openReader)}
            sx={{ minHeight: 32, borderRadius: 1.25, px: 1.25 }}
          >
            Read
          </Button>

          {renderLibraryButton()}

          {(builtInActions.length > 0 || resolvedLibraryState === 'in_library') && (
            <>
              <IconButton
                size="small"
                onClick={handleMenuOpen}
                sx={{
                  width: 32,
                  height: 32,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <MoreVertical size={16} />
              </IconButton>
            </>
          )}
        </Box>
      )}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
        {resolvedLibraryState === 'in_library' && onOpenInLibrary && (
          <MenuItem
            onClick={(e) => {
              runAction(e, onOpenInLibrary);
              handleMenuClose();
            }}
          >
            <ListItemIcon><BookOpen size={16} /></ListItemIcon>
            <ListItemText>Open</ListItemText>
          </MenuItem>
        )}
        {resolvedLibraryState === 'in_library' && onSetCategories && (
          <MenuItem
            onClick={(e) => {
              runAction(e, onSetCategories);
              handleMenuClose();
            }}
          >
            <ListItemIcon><MoreVertical size={16} /></ListItemIcon>
            <ListItemText>Set categories</ListItemText>
          </MenuItem>
        )}
        {resolvedLibraryState === 'in_library' && onRemoveFromLibrary && (
          <MenuItem
            onClick={(e) => {
              runAction(e, onRemoveFromLibrary);
              handleMenuClose();
            }}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon><Trash2 size={16} /></ListItemIcon>
            <ListItemText>Remove</ListItemText>
          </MenuItem>
        )}
        {builtInActions.map((action) => (
          <MenuItem
            key={action.id}
            onClick={(e) => {
              runAction(e, action.onClick);
              handleMenuClose();
            }}
            sx={action.danger ? { color: 'error.main' } : undefined}
          >
            {action.icon && <ListItemIcon>{action.icon}</ListItemIcon>}
            <ListItemText>{action.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};
