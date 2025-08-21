import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Paper,
  Button,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress
} from '@mui/material';
import { Add as AddIcon, PlayArrow as StartIcon, Stop as StopIcon, Pause as PauseIcon } from '@mui/icons-material';
import { BotConfig, BotControlState, BotStatus } from '@/types/config';
import { ConfigurationPanel } from '@/components/config/ConfigurationPanel';
import { BotControlPanel } from '@/components/config/BotControlPanel';
import { ConfigurationList } from '@/components/config/ConfigurationList';
import { ConfigurationBackup } from '@/components/config/ConfigurationBackup';
import { api } from '@/services/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`config-tabpanel-${index}`}
      aria-labelledby={`config-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const BotConfigPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [configs, setConfigs] = useState<BotConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<BotConfig | null>(null);
  const [botStatus, setBotStatus] = useState<BotControlState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    action: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    action: () => {}
  });

  useEffect(() => {
    loadConfigurations();
  }, []);

  useEffect(() => {
    if (selectedConfig) {
      loadBotStatus(selectedConfig.id!);
      // Set up polling for bot status
      const interval = setInterval(() => {
        loadBotStatus(selectedConfig.id!);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedConfig]);

  const loadConfigurations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/config');
      setConfigs(response.data.data);
      if (response.data.data.length > 0 && !selectedConfig) {
        setSelectedConfig(response.data.data[0]);
      }
    } catch (err: any) {
      setError('Failed to load configurations');
    } finally {
      setLoading(false);
    }
  };

  const loadBotStatus = async (configId: string) => {
    try {
      const response = await api.get(`/config/${configId}/status`);
      setBotStatus(response.data.data);
    } catch (err: any) {
      console.error('Failed to load bot status:', err);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleConfigSelect = (config: BotConfig) => {
    setSelectedConfig(config);
    setTabValue(0); // Switch to configuration tab
  };

  const handleConfigSave = async (config: BotConfig) => {
    try {
      setLoading(true);
      if (config.id) {
        await api.put(`/config/${config.id}`, config);
        setSuccess('Configuration updated successfully');
      } else {
        const response = await api.post('/config', config);
        setSuccess('Configuration created successfully');
        setSelectedConfig(response.data.data);
      }
      await loadConfigurations();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigDelete = async (configId: string) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Configuration',
      message: 'Are you sure you want to delete this configuration? This action cannot be undone.',
      action: async () => {
        try {
          setLoading(true);
          await api.delete(`/config/${configId}`);
          setSuccess('Configuration deleted successfully');
          await loadConfigurations();
          if (selectedConfig?.id === configId) {
            setSelectedConfig(configs.length > 1 ? configs[0] : null);
          }
        } catch (err: any) {
          setError(err.response?.data?.message || 'Failed to delete configuration');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleBotControl = async (action: 'start' | 'stop' | 'pause' | 'resume', confirmation?: boolean) => {
    if (!selectedConfig) return;

    try {
      setLoading(true);
      const response = await api.post(`/config/${selectedConfig.id}/control`, {
        action,
        confirmation,
        reason: `Manual ${action} from UI`
      });

      if (response.data.confirmationRequired) {
        setConfirmDialog({
          open: true,
          title: 'Confirmation Required',
          message: response.data.warningMessage,
          action: () => handleBotControl(action, true)
        });
        return;
      }

      setSuccess(`Bot ${action} executed successfully`);
      await loadBotStatus(selectedConfig.id!);
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to ${action} bot`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedConfig({
      name: '',
      description: '',
      isActive: false,
      strategy: {
        type: 'technical_analysis',
        parameters: {
          technicalAnalysis: {
            indicators: {
              rsi: { enabled: true, period: 14, overbought: 70, oversold: 30 },
              waveTrend: { enabled: true, n1: 10, n2: 21 },
              pvt: { enabled: true, period: 14 }
            },
            patterns: { enabled: true, minConfidence: 70, patternTypes: ['hammer', 'doji'] },
            confluence: { minFactors: 2, requiredIndicators: ['rsi'] }
          }
        },
        timeframes: ['1h'],
        symbols: ['BTCUSDT'],
        maxConcurrentTrades: 3
      },
      riskManagement: {
        maxRiskPerTrade: 2,
        maxDailyLoss: 5,
        maxTotalExposure: 3,
        maxDrawdown: 10,
        stopLossRequired: true,
        maxLeverage: 1,
        emergencyStop: {
          enabled: true,
          triggers: {
            maxDailyLoss: true,
            maxDrawdown: true,
            consecutiveLosses: { enabled: false, count: 5 },
            marketVolatility: { enabled: false, threshold: 0.1 }
          },
          actions: {
            closeAllPositions: true,
            pauseTrading: true,
            sendNotification: true
          }
        },
        positionSizing: {
          method: 'percentage',
          baseSize: 1,
          maxSize: 5,
          volatilityAdjustment: false,
          correlationAdjustment: false
        },
        correlationLimits: {
          enabled: false,
          maxCorrelatedPositions: 3,
          correlationThreshold: 0.7,
          timeframe: '1h'
        },
        drawdownProtection: {
          enabled: true,
          maxDrawdown: 10,
          reductionSteps: [
            { threshold: 5, action: 'reduce_size', parameter: 50 }
          ],
          recoveryThreshold: 3
        }
      },
      signalFilters: {
        confidence: {
          enabled: true,
          minConfidence: 60,
          maxSignalsPerHour: 5,
          cooldownPeriod: 15
        },
        technical: {
          enabled: true,
          requiredIndicators: [],
          indicatorThresholds: {},
          trendAlignment: false
        },
        patterns: {
          enabled: true,
          allowedPatterns: [],
          minPatternStrength: 60,
          multiTimeframeConfirmation: false
        },
        confluence: {
          enabled: true,
          minConfluenceFactors: 2,
          requiredFactorTypes: [],
          confluenceWeight: 0.7
        },
        timeframe: {
          enabled: false,
          primaryTimeframe: '1h',
          confirmationTimeframes: [],
          alignmentRequired: false
        },
        volume: {
          enabled: false,
          minVolumeRatio: 1.2,
          volumeTrendRequired: false,
          unusualVolumeDetection: false
        }
      },
      exchanges: [
        {
          name: 'binance',
          enabled: true,
          testnet: true,
          rateLimits: { ordersPerSecond: 1, requestsPerMinute: 60 },
          fees: { maker: 0.001, taker: 0.001 },
          symbols: ['BTCUSDT']
        }
      ],
      notifications: {
        email: { enabled: false, events: [] },
        webhook: { enabled: false, events: [] },
        inApp: { enabled: true, events: ['signal_generated', 'trade_executed'], sound: true }
      }
    });
    setTabValue(0);
  };

  const getBotStatusColor = (status: BotStatus): 'success' | 'error' | 'warning' | 'info' => {
    switch (status) {
      case 'running': return 'success';
      case 'error': return 'error';
      case 'paused': case 'pausing': case 'stopping': return 'warning';
      default: return 'info';
    }
  };

  const getBotControlIcon = (status: BotStatus) => {
    switch (status) {
      case 'running': return <StopIcon />;
      case 'paused': return <StartIcon />;
      default: return <StartIcon />;
    }
  };

  const getBotControlAction = (status: BotStatus): 'start' | 'stop' | 'pause' | 'resume' => {
    switch (status) {
      case 'running': return 'stop';
      case 'paused': return 'resume';
      default: return 'start';
    }
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Bot Configuration & Control
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {selectedConfig && botStatus && (
              <Button
                variant="contained"
                color={botStatus.status === 'running' ? 'error' : 'success'}
                startIcon={getBotControlIcon(botStatus.status)}
                onClick={() => handleBotControl(getBotControlAction(botStatus.status))}
                disabled={loading || ['starting', 'stopping', 'pausing'].includes(botStatus.status)}
              >
                {botStatus.status === 'running' ? 'Stop Bot' : 
                 botStatus.status === 'paused' ? 'Resume Bot' : 'Start Bot'}
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleCreateNew}
            >
              New Configuration
            </Button>
          </Box>
        </Box>

        {botStatus && (
          <Alert 
            severity={getBotStatusColor(botStatus.status)} 
            sx={{ mb: 3 }}
          >
            Bot Status: {botStatus.status.toUpperCase()} | 
            Active Positions: {botStatus.activePositions} | 
            Total Profit: ${botStatus.totalProfit.toFixed(2)} | 
            Drawdown: {botStatus.currentDrawdown.toFixed(2)}%
          </Alert>
        )}

        <Paper sx={{ width: '100%' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab label="Configuration" />
              <Tab label="Bot Control" />
              <Tab label="All Configurations" />
              <Tab label="Backup & Restore" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            {selectedConfig ? (
              <ConfigurationPanel
                config={selectedConfig}
                onSave={handleConfigSave}
                loading={loading}
              />
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h6" color="text.secondary">
                  No configuration selected
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleCreateNew}
                  sx={{ mt: 2 }}
                >
                  Create New Configuration
                </Button>
              </Box>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            {selectedConfig && botStatus ? (
              <BotControlPanel
                config={selectedConfig}
                status={botStatus}
                onControl={handleBotControl}
                loading={loading}
              />
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h6" color="text.secondary">
                  Select a configuration to control the bot
                </Typography>
              </Box>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <ConfigurationList
              configs={configs}
              selectedConfig={selectedConfig}
              onSelect={handleConfigSelect}
              onDelete={handleConfigDelete}
              loading={loading}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            {selectedConfig ? (
              <ConfigurationBackup
                config={selectedConfig}
                onRestore={loadConfigurations}
              />
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h6" color="text.secondary">
                  Select a configuration to manage backups
                </Typography>
              </Box>
            )}
          </TabPanel>
        </Paper>
      </Box>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
      >
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              confirmDialog.action();
              setConfirmDialog({ ...confirmDialog, open: false });
            }}
            variant="contained"
            color="primary"
          >
            Confirm
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

      {/* Loading Overlay */}
      {loading && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <CircularProgress />
        </Box>
      )}
    </Container>
  );
};

export default BotConfigPage;