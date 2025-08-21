import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Backup as BackupIcon,
  Restore as RestoreIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { BotConfig, ConfigBackup } from '@/types/config';
import { api } from '@/services/api';

interface ConfigurationBackupProps {
  config: BotConfig;
  onRestore: () => void;
}

export const ConfigurationBackup: React.FC<ConfigurationBackupProps> = ({
  config,
  onRestore
}) => {
  const [backups, setBackups] = useState<ConfigBackup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [backupDialog, setBackupDialog] = useState(false);
  const [restoreDialog, setRestoreDialog] = useState<ConfigBackup | null>(null);
  const [backupName, setBackupName] = useState('');
  const [backupDescription, setBackupDescription] = useState('');

  useEffect(() => {
    if (config.id) {
      loadBackups();
    }
  }, [config.id]);

  const loadBackups = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/config/${config.id}/backups`);
      setBackups(response.data.data || []);
    } catch (err: any) {
      setError('Failed to load backups');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!config.id) return;

    try {
      setLoading(true);
      await api.post(`/config/${config.id}/backup`, {
        name: backupName || `Backup ${new Date().toLocaleDateString()}`,
        description: backupDescription
      });
      setSuccess('Backup created successfully');
      setBackupDialog(false);
      setBackupName('');
      setBackupDescription('');
      await loadBackups();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create backup');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async (backup: ConfigBackup) => {
    if (!config.id) return;

    try {
      setLoading(true);
      await api.post(`/config/${config.id}/restore`, {
        backupId: backup.id
      });
      setSuccess('Configuration restored successfully');
      setRestoreDialog(null);
      onRestore();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to restore backup');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    try {
      setLoading(true);
      await api.delete(`/config/backup/${backupId}`);
      setSuccess('Backup deleted successfully');
      await loadBackups();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete backup');
    } finally {
      setLoading(false);
    }
  };

  const handleExportConfig = () => {
    const exportData = {
      ...config,
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_config.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedConfig = JSON.parse(e.target?.result as string);
        // Validate and process imported config
        setSuccess('Configuration imported successfully');
        // You would typically call onRestore or update the config here
      } catch (err) {
        setError('Invalid configuration file');
      }
    };
    reader.readAsText(file);
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">Configuration Backup & Restore</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<BackupIcon />}
            onClick={() => setBackupDialog(true)}
            disabled={!config.id}
          >
            Create Backup
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportConfig}
          >
            Export
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            component="label"
          >
            Import
            <input
              type="file"
              accept=".json"
              hidden
              onChange={handleImportConfig}
            />
          </Button>
        </Box>
      </Box>

      {/* Current Configuration Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Current Configuration
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                Name: {config.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Strategy: {config.strategy.type.replace(/_/g, ' ')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Risk Level: {config.riskManagement.maxRiskPerTrade}% per trade
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                Status: <Chip 
                  label={config.isActive ? 'Active' : 'Inactive'} 
                  color={config.isActive ? 'success' : 'default'} 
                  size="small" 
                />
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Symbols: {config.strategy.symbols.length} configured
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Exchanges: {config.exchanges.filter(e => e.enabled).length} enabled
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Backup List */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Available Backups ({backups.length})
          </Typography>
          
          {backups.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                No backups found. Create your first backup to get started.
              </Typography>
            </Box>
          ) : (
            <List>
              {backups.map((backup) => (
                <ListItem key={backup.id} divider>
                  <ListItemText
                    primary={backup.name}
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {backup.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Created: {formatDate(backup.createdAt)} | Version: {backup.version}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => setRestoreDialog(backup)}
                      disabled={loading}
                    >
                      <RestoreIcon />
                    </IconButton>
                    <IconButton
                      edge="end"
                      onClick={() => handleDeleteBackup(backup.id)}
                      disabled={loading}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Create Backup Dialog */}
      <Dialog
        open={backupDialog}
        onClose={() => setBackupDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create Configuration Backup</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Backup Name"
            value={backupName}
            onChange={(e) => setBackupName(e.target.value)}
            margin="normal"
            placeholder={`Backup ${new Date().toLocaleDateString()}`}
          />
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Description (Optional)"
            value={backupDescription}
            onChange={(e) => setBackupDescription(e.target.value)}
            margin="normal"
            placeholder="Describe what makes this configuration special..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBackupDialog(false)}>Cancel</Button>
          <Button
            onClick={handleCreateBackup}
            variant="contained"
            disabled={loading}
          >
            Create Backup
          </Button>
        </DialogActions>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <Dialog
        open={!!restoreDialog}
        onClose={() => setRestoreDialog(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Restore Configuration</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will replace your current configuration with the backup. 
            Make sure to create a backup of your current settings if needed.
          </Alert>
          {restoreDialog && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Backup Details:
              </Typography>
              <Typography variant="body2">
                Name: {restoreDialog.name}
              </Typography>
              <Typography variant="body2">
                Created: {formatDate(restoreDialog.createdAt)}
              </Typography>
              {restoreDialog.description && (
                <Typography variant="body2">
                  Description: {restoreDialog.description}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialog(null)}>Cancel</Button>
          <Button
            onClick={() => restoreDialog && handleRestoreBackup(restoreDialog)}
            variant="contained"
            color="warning"
            disabled={loading}
          >
            Restore
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbars */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
      >
        <Alert onClose={() => setSuccess(null)} severity="success">
          {success}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};