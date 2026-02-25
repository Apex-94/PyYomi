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
import { useIndexedDB } from '../hooks/useIndexedDB';

const EMPTY_IMPORT = {
  manga: 0, chapters: 0, library: 0, history: 0, categories: 0, readingProgress: 0
};

export default function BackupRestore() {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    imported: typeof EMPTY_IMPORT;
    errors: string[];
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { exportBackup, importBackup } = useIndexedDB();

  const handleExport = async () => {
    try {
      await exportBackup();
    } catch (error) {
      console.error('Export failed:', error);
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
    try {
      setImportResult(await importBackup(selectedFile));
    } catch (error) {
      setImportResult({
        success: false,
        imported: EMPTY_IMPORT,
        errors: [error instanceof Error ? error.message : 'Import failed'],
      });
    } finally {
      setImporting(false);
    }
  };

  const handleCloseDialog = () => {
    setImportDialogOpen(false);
    setSelectedFile(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Backup & Restore
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Export your library, reading history, and settings to a JSON file for backup or migration.
      </Typography>

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
                  Import completed successfully!
                </Alert>
              ) : (
                <Alert severity="error" sx={{ mb: 2 }}>
                  Import failed with errors
                </Alert>
              )}
              
              <Typography variant="subtitle2" gutterBottom>
                Imported items:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Chip label={`Manga: ${importResult.imported.manga || 0}`} size="small" />
                <Chip label={`Chapters: ${importResult.imported.chapters || 0}`} size="small" />
                <Chip label={`Library: ${importResult.imported.library || 0}`} size="small" />
                <Chip label={`History: ${importResult.imported.history || 0}`} size="small" />
                <Chip label={`Categories: ${importResult.imported.categories || 0}`} size="small" />
              </Box>
              
              {importResult.errors.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" color="error">
                    Errors:
                  </Typography>
                  <List dense>
                    {importResult.errors.map((error, i) => (
                      <ListItem key={i}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <ErrorIcon size={16} color="error" />
                        </ListItemIcon>
                        <ListItemText primary={error} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
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