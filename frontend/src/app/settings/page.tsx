import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, MenuItem, Paper, Stack, TextField, Typography, Divider } from '@mui/material';
import { getAppSettings, updateAppSetting } from '../../lib/api';
import { useColorMode } from '../../theme/ColorModeContext';
import TrackerSettings from '../../components/TrackerSettings';
import BackupRestore from '../../components/BackupRestore';

const isAbsolutePath = (value: string): boolean =>
  value.trim().length > 0 && (/^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('/'));

export default function SettingsPage() {
  const { setUiMode, mode, setMode } = useColorMode();
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
  const [uiMode, setUIMode] = useState<'classic' | 'mangaide'>('classic');
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
    const rawUiMode = getStr('ui.mode', 'classic');
    setUIMode(rawUiMode === 'mangaide' ? 'mangaide' : 'classic');
    const rawColorMode = getStr('ui.color_mode', mode);
    setColorMode(rawColorMode === 'dark' ? 'dark' : 'light');
  }, [data, mode]);

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
        updateAppSetting('ui.mode', uiMode),
        updateAppSetting('ui.color_mode', colorMode),
      ]);
    },
    onSuccess: async () => {
      setUiMode(uiMode);
      setMode(colorMode);
      await refetch();
    },
  });

  const canUseNativePicker = typeof window !== 'undefined' && typeof window.electronAPI?.selectDownloadPath === 'function';

  return (
    <Box sx={{ py: 1 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
        Settings
      </Typography>

      {isLoading ? (
        <Typography color="text.secondary">Loading settings...</Typography>
      ) : (
        <Stack spacing={3}>
          <Paper sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium' }}>
              General Settings
            </Typography>
            <Stack spacing={2}>
              {saveMutation.isSuccess && <Alert severity="success">Settings saved.</Alert>}
              {saveMutation.isError && <Alert severity="error">Failed to save settings.</Alert>}

              <TextField
                label="Max Concurrent Downloads"
                type="number"
                value={downloadConcurrency}
                onChange={(e) => setDownloadConcurrency(e.target.value)}
                inputProps={{ min: 1, max: 10 }}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField
                  label="Download Path"
                  value={downloadPath}
                  onChange={(e) => setDownloadPath(e.target.value)}
                  fullWidth
                  error={downloadPath.length > 0 && !isAbsolutePath(downloadPath)}
                  helperText={downloadPath.length > 0 && !isAbsolutePath(downloadPath) ? 'Use an absolute path.' : 'Downloads are saved as /path/<manga>/<chapter>/<pages>'}
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
                helperText="Choose how pages are displayed by default."
              >
                <MenuItem value="single">Single page</MenuItem>
                <MenuItem value="scroll">Vertical scroll</MenuItem>
              </TextField>
              <TextField
                label="Default Reading Direction"
                select
                value={readerDirection}
                onChange={(e) => setReaderDirection(e.target.value)}
                helperText="Choose page progression direction."
              >
                <MenuItem value="ltr">Left to right (LTR)</MenuItem>
                <MenuItem value="rtl">Right to left (RTL)</MenuItem>
              </TextField>
              <TextField
                label="User Interface"
                select
                value={uiMode}
                onChange={(e) => setUIMode(e.target.value as 'classic' | 'mangaide')}
                helperText="Choose between classic layout and IDE layout."
              >
                <MenuItem value="classic">Classic</MenuItem>
                <MenuItem value="mangaide">IDE</MenuItem>
              </TextField>
              <TextField
                label="Color Mode"
                select
                value={colorMode}
                onChange={(e) => setColorMode(e.target.value as 'light' | 'dark')}
                helperText="Choose light or dark theme."
              >
                <MenuItem value="light">Light</MenuItem>
                <MenuItem value="dark">Dark</MenuItem>
              </TextField>

              <Button variant="contained" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </Stack>
          </Paper>

          <Divider />

          <Paper sx={{ p: 3, borderRadius: 2 }}>
            <TrackerSettings />
          </Paper>

          <Divider />

          <Paper sx={{ p: 3, borderRadius: 2 }}>
            <BackupRestore />
          </Paper>
        </Stack>
      )}
    </Box>
  );
}
