import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Divider,
  IconButton,
  InputBase,
  Paper,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Globe,
  List,
  Moon,
  Search,
  Settings,
  Star,
  Sun,
} from 'lucide-react';
import { useColorMode } from '../../theme/ColorModeContext';
import { MangaIDEPreviewProvider, useMangaIDEPreview, type MangaIDEPreviewData } from './MangaIDEPreviewContext';

const menuItems = [
  { text: 'Browse', path: '/browse' },
  { text: 'Library', path: '/library' },
  { text: 'Categories', path: '/categories' },
  { text: 'History', path: '/history' },
  { text: 'Sources', path: '/sources' },
  { text: 'Downloads', path: '/downloads' },
  { text: 'Updates', path: '/updates' },
  { text: 'Settings', path: '/settings' },
];

export default function MangaIDEFrame({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { mode, toggleColorMode, setUiMode } = useColorMode();
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [topSearch, setTopSearch] = useState('');
  const [explorerFilter, setExplorerFilter] = useState('');
  const [preview, setPreview] = useState<MangaIDEPreviewData | null>(null);
  const isCompact = useMediaQuery('(max-width:1023px)');

  const sectionTitle = useMemo(() => {
    const item = menuItems.find((entry) => entry.path === location.pathname);
    return item?.text ?? 'Page';
  }, [location.pathname]);

  if (isCompact) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: 'background.default',
          color: 'text.primary',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <Paper sx={{ p: 3, maxWidth: 460, border: 1, borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            IDE mode is desktop-only
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            This UI mode is optimized for 1024px+ screens.
          </Typography>
          <Button variant="contained" onClick={() => setUiMode('classic')}>
            Switch to Classic UI
          </Button>
        </Paper>
      </Box>
    );
  }

  const selectedCategoryFromQuery = useMemo(() => {
    if (location.pathname !== '/categories') return null;
    const params = new URLSearchParams(location.search);
    return params.get('name');
  }, [location.pathname, location.search]);
  const normalizedFilter = explorerFilter.trim().toLowerCase();
  const showBrowse = normalizedFilter.length === 0 || 'browse'.includes(normalizedFilter);
  const showFavorites = normalizedFilter.length === 0 || 'favorites'.includes(normalizedFilter);
  const showCategories = normalizedFilter.length === 0 || 'categories'.includes(normalizedFilter);
  const categoryNames = ['Reading', 'Completed', 'Plan to Read', 'On Hold', 'Dropped'];
  const visibleCategories = categoryNames.filter((name) => {
    if (normalizedFilter.length === 0) return true;
    return name.toLowerCase().includes(normalizedFilter);
  });
  const showSources = normalizedFilter.length === 0 || 'sources'.includes(normalizedFilter);
  const showLocalFiles = normalizedFilter.length === 0 || 'local files'.includes(normalizedFilter);

  return (
    <MangaIDEPreviewProvider value={{ preview, setPreview }}>
      <Box
        sx={{
          height: '100vh',
          display: 'grid',
          gridTemplateRows: '48px 1fr 24px',
          bgcolor: 'background.default',
          color: 'text.primary',
        }}
      >
      <Box
        sx={{
          px: 2,
          display: 'grid',
          gridTemplateColumns: '280px minmax(320px, 1fr) auto',
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: mode === 'light' ? '#f0f0f0' : '#20242c',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BookOpen size={18} color={theme.palette.primary.main} />
          <Typography sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>PyYomi</Typography>
        </Box>
        <Paper
          sx={{
            mx: 2,
            px: 1.5,
            py: 0.5,
            display: 'flex',
            alignItems: 'center',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            boxShadow: 'none',
            bgcolor: mode === 'light' ? '#ffffff' : '#161a22',
          }}
        >
          <Search size={14} color={theme.palette.text.secondary} />
          <InputBase
            placeholder="Search..."
            sx={{ ml: 1, fontSize: 13, width: '100%' }}
            value={topSearch}
            onChange={(e) => setTopSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                navigate(`/browse?q=${encodeURIComponent(topSearch.trim())}`);
              }
            }}
          />
        </Paper>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" component={Link} to="/settings">
            <Settings size={16} />
          </IconButton>
          <IconButton size="small" onClick={toggleColorMode} aria-label="toggle color mode">
            {mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </IconButton>
        </Box>
      </Box>

      <Box
        sx={{
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '280px minmax(0,1fr) 340px',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            borderRight: 1,
            borderColor: 'divider',
            bgcolor: mode === 'light' ? '#f5f5f5' : '#20242b',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
            <List size={14} />
            <Typography sx={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Explorer
            </Typography>
          </Box>
          <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
            <Paper
              sx={{
                px: 1,
                py: 0.4,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                boxShadow: 'none',
                bgcolor: mode === 'light' ? '#ffffff' : '#161a22',
              }}
            >
              <InputBase
                placeholder="Filter..."
                sx={{ fontSize: 13, width: '100%' }}
                value={explorerFilter}
                onChange={(e) => setExplorerFilter(e.target.value)}
              />
            </Paper>
          </Box>
          <Box sx={{ p: 0.75, overflowY: 'auto', minHeight: 0 }}>
            {showBrowse && <ExplorerRow icon={<Search size={14} />} label="Browse" onClick={() => navigate('/browse')} />}
            {showFavorites && <ExplorerRow icon={<Star size={14} />} label="Favorites" onClick={() => navigate('/library')} />}
            {showCategories && (
              <ExplorerRow
                icon={categoriesOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                label="Categories"
                onClick={() => setCategoriesOpen((v) => !v)}
                bold
              />
            )}
            {showCategories && categoriesOpen && (
              <Box sx={{ pl: 3 }}>
                {visibleCategories.map((name) => (
                  <ExplorerRow
                    key={name}
                    icon={name === selectedCategoryFromQuery ? <FolderOpen size={14} /> : <Folder size={14} />}
                    label={name}
                    selected={name === selectedCategoryFromQuery}
                    onClick={() => navigate(`/categories?name=${encodeURIComponent(name)}`)}
                  />
                ))}
              </Box>
            )}
            {showSources && <ExplorerRow icon={<Globe size={14} />} label="Sources" onClick={() => navigate('/sources')} />}
            {showLocalFiles && <ExplorerRow icon={<FileText size={14} />} label="Local Files" onClick={() => navigate('/downloads')} />}
          </Box>
        </Box>

        <Box sx={{ minWidth: 0, minHeight: 0, overflow: 'auto', p: 2 }}>{children}</Box>

        <Box
          sx={{
            borderLeft: 1,
            borderColor: 'divider',
            bgcolor: mode === 'light' ? '#f5f5f5' : '#20242b',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Preview - {sectionTitle}
            </Typography>
          </Box>
          <PreviewPanel />
        </Box>
      </Box>

      <Box
        sx={{
          borderTop: 1,
          borderColor: 'divider',
          px: 1.5,
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          bgcolor: mode === 'light' ? '#e0e0e0' : '#1d2128',
          color: 'text.secondary',
          gap: 1,
        }}
      >
        <span>Mode: {mode}</span>
        <span>|</span>
        <span>UI: IDE</span>
        <span>|</span>
        <span>Route: {location.pathname}</span>
      </Box>
      </Box>
    </MangaIDEPreviewProvider>
  );
}

function PreviewPanel() {
  const { preview } = useMangaIDEPreview();
  if (!preview) {
    return (
      <Box sx={{ p: 2, color: 'text.secondary', fontSize: 13 }}>
        Select content in the center panel to view details.
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, overflowY: 'auto' }}>
      {preview.coverUrl && (
        <Box
          component="img"
          src={preview.coverUrl}
          alt={preview.title}
          sx={{
            width: '100%',
            maxHeight: 360,
            objectFit: 'cover',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            mb: 1.5,
          }}
          loading="lazy"
        />
      )}
      <Typography sx={{ fontSize: 15, fontWeight: 700, mb: 1 }}>{preview.title}</Typography>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 0.5 }}>
        Status: {preview.status || '-'}
      </Typography>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 0.5 }}>
        Rating: {typeof preview.rating === 'number' ? `${preview.rating.toFixed(1)}/10` : '-'}
      </Typography>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 0.5 }}>
        Source: {preview.source || '-'}
      </Typography>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>
        Author: {preview.author || '-'}
      </Typography>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>
        Artist: {preview.artist || '-'}
      </Typography>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>
        Chapters: {preview.chapters ?? '-'}
      </Typography>
      <Divider sx={{ mb: 1.5 }} />
      {preview.description && (
        <Typography sx={{ fontSize: 12, lineHeight: 1.5, color: 'text.secondary' }}>
          {preview.description}
        </Typography>
      )}
    </Box>
  );
}

function ExplorerRow({
  icon,
  label,
  selected,
  onClick,
  bold,
}: {
  icon: React.ReactNode;
  label: string;
  selected?: boolean;
  onClick?: () => void;
  bold?: boolean;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        px: 1,
        py: 0.55,
        mt: 0.2,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        borderRadius: 0.6,
        fontSize: 13,
        cursor: onClick ? 'pointer' : 'default',
        color: selected ? '#ffffff' : 'text.primary',
        bgcolor: selected ? '#3b82f6' : 'transparent',
        '&:hover': {
          bgcolor: selected ? '#3b82f6' : 'action.hover',
        },
      }}
    >
      {icon}
      <Typography sx={{ fontSize: 13, fontWeight: bold ? 700 : 500 }}>{label}</Typography>
    </Box>
  );
}
