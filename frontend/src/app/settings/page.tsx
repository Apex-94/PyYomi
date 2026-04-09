import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, MenuItem, Paper, Stack, TextField, Typography, Divider, ToggleButton, ToggleButtonGroup, Chip } from '@mui/material';
import { getAppSettings, updateAppSetting } from '../../lib/api';
import { useColorMode } from '../../theme/ColorModeContext';
import TrackerSettings from '../../components/TrackerSettings';
import BackupRestore from '../../components/BackupRestore';

const isAbsolutePath = (value: string): boolean =>
  value.trim().length > 0 && (/^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('/'));

export default function SettingsPage() {
  const { setMode } = useColorMode();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['app-settings'],
    queryFn: getAppSettings,
  });

  const [downloadConcurrency, setDownloadConcurrency] = useState('2');
  const [downloadPath, setDownloadPath] = useState('');
  const [updateInterval, setUpdateInterval] = useState('60');
  const [readerMode, setReaderMode] = useState('single');
  const [readerDirection, setReaderDirection] = useState('ltr');
  const [cacheEnabled, setCacheEnabled] = useState('true');
  const [cacheMaxBytes, setCacheMaxBytes] = useState('536870912');
  const [cacheTtlHours, setCacheTtlHours] = useState('720');
  const [colorMode, setColorMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (!data) return;
    const getStr = (key: string, fallback: unknown) => String(data[key] ?? fallback);
    setDownloadConcurrency(getStr('downloads.max_concurrent', 2));
    setDownloadPath(getStr('downloads.path', ''));
    setUpdateInterval(getStr('updates.interval_minutes', 60));
    setReaderMode(getStr('reader.default_mode', 'single'));
    setReaderDirection(getStr('reader.reading_direction', 'ltr'));
    setCacheEnabled(getStr('images.cache.enabled', true));
    setCacheMaxBytes(getStr('images.cache.max_bytes', 536870912));
    setCacheTtlHours(getStr('images.cache.ttl_hours', 720));
    const rawColorMode = getStr('ui.color_mode', 'light');
    setColorMode(rawColorMode === 'dark' ? 'dark' : 'light');
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!isAbsolutePath(downloadPath)) {
        throw new Error('Download path must be absolute.');
      }
      await Promise.all([
        updateAppSetting('downloads.max_concurrent', Number(downloadConcurrency)),
        updateAppSetting('downloads.path', downloadPath),
        updateAppSetting('updates.interval_minutes', Number(updateInterval)),
        updateAppSetting('reader.default_mode', readerMode),
        updateAppSetting('reader.reading_direction', readerDirection),
        updateAppSetting('images.cache.enabled', cacheEnabled === 'true'),
        updateAppSetting('images.cache.max_bytes', Number(cacheMaxBytes)),
        updateAppSetting('images.cache.ttl_hours', Number(cacheTtlHours)),
        updateAppSetting('ui.mode', 'mangaide'),
        updateAppSetting('ui.color_mode', colorMode),
      ]);
    },
    onSuccess: async () => {
      setMode(colorMode);
      await refetch();
    },
  });

  const canUseNativePicker = typeof window !== 'undefined' && typeof window.electronAPI?.selectDownloadPath === 'function';

  return (
    <Box sx={{ py: 1 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        Settings
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 760 }}>
        Tune PyYomi around how you read: shape the layout, set reading defaults, and control downloads without digging through dense system screens.
      </Typography>

      {isLoading ? (
        <Typography color="text.secondary">Loading settings...</Typography>
      ) : (
        <Stack spacing={3}>
          <Paper sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2.5 }}>
              <Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, mb: 0.5 }}>
                  Reading Setup
                </Typography>
                <Typography color="text.secondary" sx={{ maxWidth: 620 }}>
                  Keep the default experience calm and predictable, then switch into the denser IDE workspace only when you want more tooling on screen.
                </Typography>
              </Box>
              <Chip label="Customizable by design" />
            </Box>

            <Stack spacing={2.25}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                  Color Mode
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  value={colorMode}
                  onChange={(_event, nextValue) => {
                    if (nextValue) {
                      setColorMode(nextValue);
                    }
                  }}
                  sx={{ width: '100%' }}
                >
                  <ToggleButton value="light" sx={{ flex: 1 }}>
                    Light
                  </ToggleButton>
                  <ToggleButton value="dark" sx={{ flex: 1 }}>
                    Dark
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Stack>

            {saveMutation.isSuccess && <Alert severity="success">Settings saved. Your reading environment is updated.</Alert>}
            {saveMutation.isError && <Alert severity="error">Couldn't save these settings. Check the invalid field and try again.</Alert>}

            <Divider />

            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Reader and Downloads
            </Typography>

            <TextField
              label="Max Concurrent Downloads"
              type="number"
              value={downloadConcurrency}
              onChange={(e) => setDownloadConcurrency(e.target.value)}
              inputProps={{ min: 1, max: 10 }}
            />
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'stretch', sm: 'flex-start' }}
            >
              <TextField
                label="Download Path"
                value={downloadPath}
                onChange={(e) => setDownloadPath(e.target.value)}
                fullWidth
                error={downloadPath.length > 0 && !isAbsolutePath(downloadPath)}
                helperText={downloadPath.length > 0 && !isAbsolutePath(downloadPath) ? 'Use an absolute path.' : 'Downloads are saved as /path/<manga>/<chapter>/<pages>.'}
              />
              {canUseNativePicker && (
                <Button
                  variant="outlined"
                  onClick={async () => {
                    const selected = await window.electronAPI!.selectDownloadPath!();
                    if (selected) {
                      setDownloadPath(selected);
                    }
                  }}
                  sx={{
                    minWidth: 120,
                    minHeight: 56,
                    whiteSpace: 'nowrap',
                    alignSelf: { xs: 'stretch', sm: 'flex-start' },
                  }}
                >
                  Browse...
                </Button>
              )}
            </Stack>
            <TextField
              label="Update Check Interval (minutes)"
              type="number"
              value={updateInterval}
              onChange={(e) => setUpdateInterval(e.target.value)}
              inputProps={{ min: 5, max: 1440 }}
            />
            <TextField
              label="Image Cache Enabled"
              select
              value={cacheEnabled}
              onChange={(e) => setCacheEnabled(e.target.value)}
            >
              <MenuItem value="true">Enabled</MenuItem>
              <MenuItem value="false">Disabled</MenuItem>
            </TextField>
            <TextField
              label="Image Cache Max Bytes"
              type="number"
              value={cacheMaxBytes}
              onChange={(e) => setCacheMaxBytes(e.target.value)}
              inputProps={{ min: 0 }}
            />
            <TextField
              label="Image Cache TTL (hours)"
              type="number"
              value={cacheTtlHours}
              onChange={(e) => setCacheTtlHours(e.target.value)}
              inputProps={{ min: 1 }}
            />
            <TextField
              label="Default Reader Mode"
              select
              value={readerMode}
              onChange={(e) => setReaderMode(e.target.value)}
              helperText="Choose whether new chapters open one page at a time or as a vertical stack."
            >
              <MenuItem value="single">Single page</MenuItem>
              <MenuItem value="scroll">Vertical scroll</MenuItem>
            </TextField>
            <TextField
              label="Default Reading Direction"
              select
              value={readerDirection}
              onChange={(e) => setReaderDirection(e.target.value)}
              helperText="Choose how page navigation should advance by default."
            >
              <MenuItem value="ltr">Left to right (LTR)</MenuItem>
              <MenuItem value="rtl">Right to left (RTL)</MenuItem>
            </TextField>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                sx={{ minWidth: 200, py: 1.25 }}
              >
                {saveMutation.isPending ? 'Saving...' : 'Save Reading Setup'}
              </Button>
            </Box>
          </Paper>

          <Divider />

          <Paper sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
            <TrackerSettings />
          </Paper>

          <Divider />

          <Paper sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
            <BackupRestore />
          </Paper>
        </Stack>
      )}
    </Box>
  );
}
