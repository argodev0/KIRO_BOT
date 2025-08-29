import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Alert,
  Divider,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Pause as PauseIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Settings as SettingsIcon,
  Security as SecurityIcon,
  Backup as BackupIcon
} from '@mui/icons-material';
import { BotConfig, BotControlState, ConfigValidation } from '@/types/config';
import { ConfigurationPanel } from './ConfigurationPanel';
import { BotControlPanel } from './BotControlPanel';
import { ConfigurationBackup } from './ConfigurationBackup';
import PaperTradingIndicator from '../common/PaperTradingIndicator';
import { api } from '@/services/api';

interface BotConfigurationInterfaceProps {
  configId?: string;
  onConfigChange?: (config: BotConfig) => void;
  onStatusChange?: (status: BotControlState) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`config-tabpanel-${index}`}
    aria-labelledby={`config-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

export const BotConfigurationInterface: React.FC<BotConfigurationInterfaceProps> = ({
  configId,
  onConfigChange,
  onStatusChange
}) => {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [botStatus, setBotStatus] = useState<BotControlState | null>(null);
  const [validation, setValidation] = useState<ConfigValidation | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'info' });

  // Load configuration and status
  const loadConfig = useCallback(async () => {
    if (!configId) return;

    setLoading(true);
    try {
      const [configResponse, statusResponse] = await Promise.all([
        api.get(`/config/${configId}`),
        api.get(`/config/${configId}/status`)
      ]);

      const loadedConfig = configResponse.data.data;
      const loadedStatus = statusResponse.data.data;

      setConfig(loadedConfig);
      setBotStatus(loadedStatus);
      
      onConfigChange?.(loadedConfig);
      onStatusChange?.(loadedStatus);
    } catch (error) {
      console.error('Failed to load configuration:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load bot configuration',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [configId, onConfigChange, onStatusChange]);

  // Real-time validation with debouncing
  const validateConfiguration = useCallback(async (configToValidate: BotConfig) => {
    try {
      const response = await api.post('/config/validate', configToValidate);
      const validationResult = response.data.data;
      setValidation(validationResult);
      return validationResult;
    } catch (error) {
      console.error('Real-time validation error:', error);
      return null;
    }
  }, []);

  // Save configuration
  const saveConfiguration = async () => {
    if (!config) return;

    setSaving(true);
    try {
      // Validate before saving
      const validationResult = await validateConfiguration(config);
      if (validationResult && !validationResult.isValid) {
        setSnackbar({
          open: true,
          message: 'Configuration has validation errors. Please fix them before saving.',
          severity: 'error'
        });
        return;
      }

      const response = configId 
        ? await api.put(`/config/${configId}`, config)
        : await api.post('/config', config);

      const savedConfig = response.data.data;
      setConfig(savedConfig);
      onConfigChange?.(savedConfig);

      setSnackbar({
        open: true,
        message: 'Configuration saved successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('Save error:', error);
      setSnackbar({
        open: true,
        message: 'Failed to save configuration',
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  // Bot control actions
  const handleBotControl = async (action: 'start' | 'stop' | 'pause' | 'resume') => {
    if (!configId) return;

    try {
      const response = await api.post(`/config/${configId}/control`, { action });
      const newStatus = response.data.data;
      setBotStatus(newStatus);
      onStatusChange?.(newStatus);

      setSnackbar({
        open: true,
        message: `Bot ${action} executed successfully`,
        severity: 'success'
      });
    } catch (error: any) {
      console.error('Bot control error:', error);
      
      // Handle confirmation requirement
      if (error.response?.data?.confirmationRequired) {
        // Show confirmation dialog (implement as needed)
        setSnackbar({
          open: true,
          message: error.response.data.warningMessage,
          severity: 'warning'
        });
      } else {
        setSnackbar({
          open: true,
          message: `Failed to ${action} bot`,
          severity: 'error'
        });
      }
    }
  };

  // Handle configuration changes
  const handleConfigChange = (updates: Partial<BotConfig>) => {
    if (!config) return;

    const updatedConfig = { ...config, ...updates };
    setConfig(updatedConfig);
    
    // Debounced validation
    const timeoutId = setTimeout(() => {
      validateConfiguration(updatedConfig);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  // Load initial data
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Auto-refresh status when bot is running (real-time updates)
  useEffect(() => {
    if (botStatus?.status === 'running') {
      const interval = setInterval(loadConfig, 5000); // Real-time refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [botStatus?.status, loadConfig]);

  if (loading && !config) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
          Loading bot configuration...
        </Typography>
      </Box>
    );
  }

  if (!config) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          No configuration found
        </Typography>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={loadConfig}
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  const getValidationStatusIcon = () => {
    if (!validation) return <SettingsIcon color="action" />;
    if (validation.isValid) return <CheckIcon color="success" />;
    return <ErrorIcon color="error" />;
  };

  const getValidationStatusText = () => {
    if (!validation) return 'Not validated';
    if (validation.isValid) return 'Configuration valid';
    return `${validation.errors.length} error(s) found`;
  };

  return (
    <Box>
      {/* Paper Trading Safety Banner */}
      <PaperTradingIndicator variant="banner" showDetails />

      {/* Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="h5" gutterBottom>
                {config.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {config.description || 'No description provided'}
              </Typography>
            </Grid>
            
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                {/* Validation Status */}
                <Tooltip title={getValidationStatusText()}>
                  <Chip
                    icon={getValidationStatusIcon()}
                    label={validation?.isValid ? 'Valid' : 'Issues'}
                    color={validation?.isValid ? 'success' : 'error'}
                    variant="outlined"
                    size="small"
                  />
                </Tooltip>

                {/* Bot Status */}
                {botStatus && (
                  <Chip
                    label={botStatus.status.toUpperCase()}
                    color={
                      botStatus.status === 'running' ? 'success' :
                      botStatus.status === 'error' ? 'error' :
                      botStatus.status === 'paused' ? 'warning' : 'default'
                    }
                    variant="filled"
                  />
                )}

                {/* Paper Trading Indicator */}
                <Chip
                  icon={<SecurityIcon />}
                  label="PAPER TRADING"
                  color="warning"
                  variant="outlined"
                  size="small"
                />
              </Box>
            </Grid>
          </Grid>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={saveConfiguration}
              disabled={saving || (validation && !validation.isValid)}
              loading={saving}
            >
              Save Configuration
            </Button>

            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadConfig}
              disabled={loading}
            >
              Refresh
            </Button>

            <Button
              variant="outlined"
              startIcon={<BackupIcon />}
              onClick={() => setShowBackupDialog(true)}
            >
              Backup
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Validation Alerts */}
      {validation && (
        <Box sx={{ mb: 3 }}>
          {validation.errors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Configuration Errors ({validation.errors.length}):
              </Typography>
              {validation.errors.slice(0, 3).map((error, index) => (
                <Typography key={index} variant="body2">
                  • {error.field}: {error.message}
                </Typography>
              ))}
              {validation.errors.length > 3 && (
                <Typography variant="body2" color="text.secondary">
                  ... and {validation.errors.length - 3} more errors
                </Typography>
              )}
            </Alert>
          )}

          {validation.warnings.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Configuration Warnings ({validation.warnings.length}):
              </Typography>
              {validation.warnings.slice(0, 2).map((warning, index) => (
                <Typography key={index} variant="body2">
                  • {warning.field}: {warning.message}
                  {warning.suggestion && ` (${warning.suggestion})`}
                </Typography>
              ))}
              {validation.warnings.length > 2 && (
                <Typography variant="body2" color="text.secondary">
                  ... and {validation.warnings.length - 2} more warnings
                </Typography>
              )}
            </Alert>
          )}
        </Box>
      )}

      {/* Main Configuration Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            aria-label="configuration tabs"
          >
            <Tab label="Bot Configuration" />
            <Tab label="Bot Control" />
            <Tab label="Backup & Restore" />
          </Tabs>
        </Box>

        <TabPanel value={activeTab} index={0}>
          <ConfigurationPanel
            config={config}
            onSave={handleConfigChange}
            loading={saving}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          {botStatus && (
            <BotControlPanel
              config={config}
              status={botStatus}
              onControl={handleBotControl}
              loading={loading}
            />
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <ConfigurationBackup
            configId={configId}
            config={config}
          />
        </TabPanel>
      </Card>

      {/* Backup Dialog */}
      <Dialog
        open={showBackupDialog}
        onClose={() => setShowBackupDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Backup Configuration</DialogTitle>
        <DialogContent>
          <ConfigurationBackup
            configId={configId}
            config={config}
            embedded
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBackupDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BotConfigurationInterface;