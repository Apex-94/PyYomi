import React, { useMemo, useState } from 'react';
import {
  AppBar,
  Box,
  Chip,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  BookOpen,
  Download,
  FolderOpen,
  History,
  Library,
  Menu as MenuIcon,
  Moon,
  RefreshCw,
  Search,
  Settings,
  Sun,
  X as CloseIcon,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useColorMode } from '../theme/ColorModeContext';
import { DRAWER_WIDTH, PAGE_PAD_X, PAGE_PAD_Y, RAIL_WIDTH, TOPBAR_HEIGHT } from '../constants/layout';

const menuItems = [
  { text: 'Browse', icon: BookOpen, path: '/browse', blurb: 'Discover something to read.', section: 'primary' },
  { text: 'Library', icon: Library, path: '/library', blurb: 'Return to your saved manga.', section: 'primary' },
  { text: 'Categories', icon: FolderOpen, path: '/categories', blurb: 'Organize series your way.', section: 'primary' },
  { text: 'History', icon: History, path: '/history', blurb: 'Resume from recent chapters.', section: 'primary' },
  { text: 'Sources', icon: Search, path: '/sources', blurb: 'Manage active catalogs.', section: 'secondary' },
  { text: 'Downloads', icon: Download, path: '/downloads', blurb: 'Check offline progress.', section: 'secondary' },
  { text: 'Updates', icon: RefreshCw, path: '/updates', blurb: 'See what changed recently.', section: 'secondary' },
  { text: 'Settings', icon: Settings, path: '/settings', blurb: 'Adjust app behavior.', section: 'secondary' },
];

const primaryMobileItems = [
  { text: 'Browse', icon: BookOpen, path: '/browse' },
  { text: 'Library', icon: Library, path: '/library' },
  { text: 'Downloads', icon: Download, path: '/downloads' },
  { text: 'Settings', icon: Settings, path: '/settings' },
];

const CONTENT_MAX_WIDTH = 1360;

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const { mode, uiMode, setUiMode, toggleColorMode } = useColorMode();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const location = useLocation();
  const navWidth = isMobile ? 0 : (isTablet ? RAIL_WIDTH : DRAWER_WIDTH);

  const currentSection = useMemo(
    () => menuItems.find((item) => location.pathname === item.path) ?? menuItems[0],
    [location.pathname]
  );
  const primaryMenuItems = menuItems.filter((item) => item.section === 'primary');
  const secondaryMenuItems = menuItems.filter((item) => item.section === 'secondary');

  const handleDrawerToggle = () => {
    setMobileOpen((open) => !open);
  };

  const drawer = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        p: isTablet ? 1 : 1.5,
      }}
    >
      <Box
        sx={{
          mb: isTablet ? 1.5 : 2,
          p: isTablet ? 1 : 1.25,
          borderRadius: isTablet ? 2 : 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 3,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                color: 'primary.main',
                flexShrink: 0,
              }}
            >
              <BookOpen size={18} />
            </Box>
            {!isTablet && (
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" sx={{ lineHeight: 1 }}>
                  PyYomi
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Reader-first manga app
                </Typography>
              </Box>
            )}
          </Box>
          {isMobile && (
            <IconButton onClick={handleDrawerToggle} aria-label="close navigation drawer">
              <CloseIcon size={18} />
            </IconButton>
          )}
        </Box>

        {!isTablet && <Divider sx={{ my: 2 }} />}
      </Box>

      <Box sx={{ px: isTablet ? 0.25 : 0, mb: 0.5 }}>
        {!isTablet && (
          <Typography
            variant="overline"
            sx={{ px: 1.5, color: 'text.secondary', letterSpacing: '0.16em', fontWeight: 800 }}
          >
            Read
          </Typography>
        )}
        <List sx={{ mt: 0.75 }}>
          {primaryMenuItems.map((item) => {
            const Icon = item.icon;
            const isSelected = location.pathname === item.path;

            if (isTablet) {
              return (
                <Tooltip title={item.text} placement="right" key={item.text}>
                  <ListItem disablePadding sx={{ mb: 1 }}>
                    <ListItemButton
                      component={Link}
                      to={item.path}
                      selected={isSelected}
                      onClick={() => setMobileOpen(false)}
                      sx={{
                        minHeight: 42,
                        justifyContent: 'center',
                        borderRadius: 2,
                        border: '1px solid transparent',
                        transition: 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                        '&:hover': {
                          transform: 'translateY(-1px)',
                        },
                        '&.Mui-selected': {
                          backgroundColor: mode === 'light' ? 'rgba(77, 93, 122, 0.1)' : 'rgba(168, 183, 210, 0.14)',
                          borderColor: mode === 'light' ? 'rgba(77, 93, 122, 0.18)' : 'rgba(168, 183, 210, 0.18)',
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 0, color: isSelected ? 'primary.main' : 'text.secondary' }}>
                        <Icon size={20} />
                      </ListItemIcon>
                    </ListItemButton>
                  </ListItem>
                </Tooltip>
              );
            }

            return (
              <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  component={Link}
                  to={item.path}
                  selected={isSelected}
                  onClick={() => setMobileOpen(false)}
                  sx={{
                    alignItems: 'center',
                    borderRadius: 2.5,
                    px: 1.25,
                    py: 0.85,
                    border: '1px solid transparent',
                    transition: 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms cubic-bezier(0.22, 1, 0.36, 1), border-color 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                    '&:hover': {
                      transform: 'translateX(2px)',
                    },
                    '&.Mui-selected': {
                      backgroundColor: mode === 'light' ? 'rgba(77, 93, 122, 0.08)' : 'rgba(168, 183, 210, 0.12)',
                      borderColor: mode === 'light' ? 'rgba(77, 93, 122, 0.16)' : 'rgba(168, 183, 210, 0.16)',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 34,
                      alignSelf: 'flex-start',
                      mt: 0.2,
                      color: isSelected ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    <Icon size={16} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Box component="span">{item.text}</Box>
                        {isSelected && (
                          <Chip
                            label="Now"
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.62rem',
                              bgcolor: mode === 'light' ? 'rgba(77, 93, 122, 0.12)' : 'rgba(168, 183, 210, 0.14)',
                              color: 'primary.main',
                            }}
                          />
                        )}
                      </Box>
                    }
                    secondary={item.blurb}
                    primaryTypographyProps={{
                      fontWeight: isSelected ? 800 : 700,
                      fontSize: '0.9rem',
                    }}
                    secondaryTypographyProps={{
                      fontSize: '0.7rem',
                      lineHeight: 1.35,
                      color: 'text.secondary',
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
        {!isTablet && (
          <Typography
            variant="overline"
            sx={{ px: 1.5, mt: 2.25, color: 'text.secondary', letterSpacing: '0.16em', fontWeight: 800 }}
          >
            Manage
          </Typography>
        )}
        <List sx={{ mt: 0.5 }}>
          {secondaryMenuItems.map((item) => {
            const Icon = item.icon;
            const isSelected = location.pathname === item.path;

            if (isTablet) {
              return null;
            }

            return (
              <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  component={Link}
                  to={item.path}
                  selected={isSelected}
                  onClick={() => setMobileOpen(false)}
                  sx={{
                    alignItems: 'center',
                    borderRadius: 2.25,
                    px: 1.25,
                    py: 0.75,
                    border: '1px solid transparent',
                    '&.Mui-selected': {
                      backgroundColor: mode === 'light' ? 'rgba(77, 93, 122, 0.06)' : 'rgba(168, 183, 210, 0.08)',
                      borderColor: mode === 'light' ? 'rgba(77, 93, 122, 0.12)' : 'rgba(168, 183, 210, 0.12)',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 32,
                      color: isSelected ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    <Icon size={15} />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    secondary={item.blurb}
                    primaryTypographyProps={{
                      fontWeight: isSelected ? 800 : 700,
                      fontSize: '0.88rem',
                    }}
                    secondaryTypographyProps={{
                      fontSize: '0.68rem',
                      lineHeight: 1.35,
                      color: 'text.secondary',
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      <Box sx={{ mt: 'auto', pt: 2 }}>
        {!isTablet && (
          <Typography
            variant="overline"
            sx={{ px: 1.5, color: 'text.secondary', letterSpacing: '0.16em', fontWeight: 800 }}
          >
            Mode
          </Typography>
        )}
        <Box
          sx={{
            mt: 0.5,
            p: isTablet ? 0.5 : 0.85,
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          {!isTablet && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.85, fontSize: '0.78rem' }}>
              Keep `Classic` for reading. Switch to `IDE` when you want denser tools.
            </Typography>
          )}
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={uiMode}
            onChange={(_event, nextMode) => {
              if (nextMode) {
                setUiMode(nextMode);
              }
            }}
            size="small"
            sx={{
              width: '100%',
              '& .MuiToggleButton-root': {
                minHeight: 34,
                px: 1,
                fontSize: '0.78rem',
              },
            }}
          >
            <ToggleButton value="classic">Classic</ToggleButton>
            <ToggleButton value="mangaide">IDE</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'transparent' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        color="default"
        sx={{
          width: { sm: `calc(100% - ${navWidth}px)` },
          ml: { sm: `${navWidth}px` },
          zIndex: (t) => t.zIndex.drawer + 1,
        }}
      >
        <Toolbar
          sx={{
            minHeight: `${TOPBAR_HEIGHT}px !important`,
            px: 0,
          }}
        >
          <Box
            sx={{
              width: '100%',
              maxWidth: `${CONTENT_MAX_WIDTH}px`,
              mx: 'auto',
              px: { xs: 1.5, sm: 2.25, md: 3 },
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            {isMobile && (
              <IconButton
                color="inherit"
                aria-label="open navigation drawer"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ color: 'inherit' }}
              >
                <MenuIcon size={18} />
              </IconButton>
            )}

            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.16em',
                  fontWeight: 800,
                  mb: 0.35,
                  fontSize: '0.68rem',
                }}
              >
                {uiMode === 'classic' ? 'Classic' : 'IDE'}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Typography
                  variant="h5"
                  noWrap
                  sx={{
                    fontSize: { xs: '1.2rem', md: '1.55rem' },
                    maxWidth: '100%',
                  }}
                >
                  {currentSection.text}
                </Typography>
                {!isMobile && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {currentSection.blurb}
                  </Typography>
                )}
              </Box>
            </Box>

            {!isMobile && (
              <Chip
                label={mode === 'light' ? 'Light' : 'Dark'}
                variant="outlined"
                sx={{ fontWeight: 700 }}
              />
            )}

            <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <IconButton
                color="inherit"
                onClick={toggleColorMode}
                aria-label="toggle color mode"
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: mode === 'light' ? 'rgba(255, 252, 246, 0.8)' : 'rgba(43, 35, 31, 0.84)',
                }}
              >
                {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: navWidth }, flexShrink: { sm: 0 } }}>
        {isMobile ? (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
            }}
          >
            {drawer}
          </Drawer>
        ) : (
          <Drawer
            variant="persistent"
            open
            sx={{
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: navWidth, overflowX: 'hidden' },
            }}
          >
            {drawer}
          </Drawer>
        )}
      </Box>

      <Box
        component="main"
        className="page-enter"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${navWidth}px)` },
          minHeight: '100vh',
          pl: PAGE_PAD_X,
          pr: PAGE_PAD_X,
          pb: {
            xs: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
            sm: PAGE_PAD_Y.sm,
            md: PAGE_PAD_Y.md,
          },
          pt: `calc(${TOPBAR_HEIGHT}px + 20px)`,
        }}
      >
        <Box sx={{ width: '100%', maxWidth: `${CONTENT_MAX_WIDTH}px`, mx: 'auto' }}>
          {children}
        </Box>
      </Box>

      {isMobile && (
        <Box
          sx={{
            position: 'fixed',
            left: 12,
            right: 12,
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
            zIndex: (t) => t.zIndex.drawer + 2,
            px: 1,
            py: 0.75,
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: 0.5,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 999,
            backdropFilter: 'blur(18px)',
            bgcolor: mode === 'light' ? 'rgba(248, 244, 237, 0.94)' : 'rgba(27, 31, 37, 0.94)',
            boxShadow: mode === 'light' ? '0 18px 36px rgba(60, 66, 75, 0.08)' : '0 18px 36px rgba(0, 0, 0, 0.32)',
          }}
        >
          {primaryMobileItems.map((item) => {
            const Icon = item.icon;
            const isSelected = location.pathname === item.path;
            return (
              <Box
                key={item.text}
                component={Link}
                to={item.path}
                sx={{
                  minWidth: 0,
                  textDecoration: 'none',
                  color: isSelected ? 'primary.main' : 'text.secondary',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.4,
                  py: 0.65,
                  borderRadius: 999,
                  bgcolor: isSelected
                    ? (mode === 'light' ? 'rgba(77, 93, 122, 0.1)' : 'rgba(168, 183, 210, 0.14)')
                    : 'transparent',
                }}
              >
                <Icon size={18} />
                <Typography sx={{ fontSize: '0.63rem', fontWeight: 800 }}>{item.text}</Typography>
              </Box>
            );
          })}

          <IconButton
            onClick={handleDrawerToggle}
            aria-label="open menu"
            sx={{
              justifySelf: 'center',
              alignSelf: 'center',
              color: 'text.primary',
              width: 44,
              height: 44,
            }}
          >
            <MenuIcon size={18} />
          </IconButton>
        </Box>
      )}
    </Box>
  );
}
