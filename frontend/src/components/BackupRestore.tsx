import { useState, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Upload as UploadIcon,
  Check as CheckIcon,
  AlertCircle as ErrorIcon,
} from 'lucide-react';
import { downloadBackupFile, readBackupFile, importBackup } from '../db/backupService';
import type { RestoreResult, RestoreStats } from '../db/backupService';

const EMPTY_STATS: RestoreStats = {
  manga: { imported: 0, skipped: 0 },
  chapters: { imported: 0, skipped: 0 },
  library_entries: { imported: 0, skipped: 0 },
  history: { imported: 0, skipped: 0 },
  categories: { imported: 0, skipped: 0 },
  manga_categories: { imported: 0, skipped: 0 },
  reading_progress: { imported: 0, updated: 0, skipped: 0 },
  tracker_mappings: { imported: 0, updated: 0, skipped: 0 },
};

export default function BackupRestore() {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<RestoreResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      setError(null);
      await downloadBackupFile();
    } catch (err) {
      console.error('Export failed:', err);
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setSelectedFile(file);
    setImportDialogOpen(true);
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setImporting(true);
    setError(null);
    try {
      const backupData = await readBackupFile(selectedFile);
      const result = await importBackup(backupData);
      setImportResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setImportResult({
        success: false,
        message: err instanceof Error ? err.message : 'Import failed',
        stats: EMPTY_STATS,
      });
    } finally {
      setImporting(false);
    }
  };

  const handleCloseDialog = () => {
    setImportDialogOpen(false);
    setSelectedFile(null);
    setImportResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatStats = (stats: RestoreStats) => {
    const items = [
      { label: 'Manga', ...stats.manga },
      { label: 'Chapters', ...stats.chapters },
      { label: 'Library', ...stats.library_entries },
      { label: 'History', ...stats.history },
      { label: 'Categories', ...stats.categories },
      { label: 'Progress', ...stats.reading_progress },
      { label: 'Tracker Mappings', ...stats.tracker_mappings },
    ];
    
    return items.map(item => (
      <Chip 
        key={item.label}
        label={`${item.label}: ${item.imported} imported`} 
        size="small" 
        sx={{ mr: 1, mb: 1 }}
      />
    ));
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Backup & Restore
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Export your library, reading history, and settings to a JSON file for backup or migration.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<DownloadIcon size={20} />}
          onClick={handleExport}
        >
          Export Backup
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<UploadIcon size={20} />}
          component="label"
        >
          Import Backup
          <input
            type="file"
            hidden
            accept=".json"
            ref={fileInputRef}
            onChange={handleFileSelect}
          />
        </Button>
      </Box>

      <Alert severity="warning" sx={{ mb: 3 }}>
        Importing a backup will merge with your existing data. This action cannot be undone.
      </Alert>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            What's included in the backup:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <CheckIcon size={16} />
              </ListItemIcon>
              <ListItemText primary="Library entries (manga in your library)" />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <CheckIcon size={16} />
              </ListItemIcon>
              <ListItemText primary="Reading history" />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <CheckIcon size={16} />
              </ListItemIcon>
              <ListItemText primary="Categories" />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <CheckIcon size={16} />
              </ListItemIcon>
              <ListItemText primary="Reading progress (current page)" />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <CheckIcon size={16} />
              </ListItemIcon>
              <ListItemText primary="Tracker mappings" />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Import Backup</DialogTitle>
        <DialogContent>
          {importing ? (
            <Box>
              <Typography gutterBottom>Importing data...</Typography>
              <LinearProgress />
            </Box>
          ) : importResult ? (
            <Box>
              {importResult.success ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {importResult.message}
                </Alert>
              ) : (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {importResult.message}
                </Alert>
              )}
              
              <Typography variant="subtitle2" gutterBottom>
                Import Statistics:
              </Typography>
              <Box sx={{ mb: 2 }}>
                {formatStats(importResult.stats)}
              </Box>
            </Box>
          ) : (
            <Box>
              <Typography gutterBottom>
                Selected file: {selectedFile?.name}
              </Typography>
              <Alert severity="info">
                This will merge the backup data with your existing data. Duplicate entries will be skipped.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>
            {importResult ? 'Close' : 'Cancel'}
          </Button>
          {!importResult && !importing && (
            <Button onClick={handleImport} variant="contained" disabled={!selectedFile}>
              Import
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}