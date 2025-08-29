import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Alert,
  Breadcrumbs,
  Link,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Settings as SettingsIcon,
  Home as HomeIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import BotConfigurationInterface from '../components/config/BotConfigurationInterface';
import ConfigurationStatusMonitor from '../components/config/ConfigurationStatusMonitor';
import { ConfigurationList } from '../components/config/ConfigurationList';
import PaperTradingIndicator from '../components/common/PaperTradingIndicator';
import { BotConfig, BotControlState, ConfigValidation } from '@/types/config';
import { configAPI } from '@/services/api';
import ConfigValidationService from '@/services/configValidation';

export const ConfigurationPage: React.FC = () => {
  const { configId } = useParams<{ configId?: string }>();
  const navigate = useNavigate();
  
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [botStatus, setBotStatus] = useState<BotControlState | null>(null);
  const [validation, setValidation] = useState<ConfigValidation | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'info' });

  // Load configuration if configId is provided
  useEffect(() => {
    if (configId) {
      loadConfiguration();
    }
  }, [configId]);

  // Validate configuration when it changes
  useEffect(() => {
    if (config) {
      validateConfiguration();
    }
  }, [config]);

  const loadConfiguration = async () => {
    if (!configId) return;

    setLoading(true);
    try {
      const [configResponse, statusResponse] = await Promise.all([
        configAPI.getConfig(configId),
        configAPI.getBotStatus(configId)
      ]);

      setConfig(configResponse.data.data);
      setBotStatus(statusResponse.data.data);
    } catch (error) {
      console.error('Failed to load configuration:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load configuration',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const validateConfiguration = async () => {
    if (!config) return;

    try {
      const validationResult = await ConfigValidationService.validateConfig(config);
      setValidation(validationResult);
    } catch (error) {
      console.error('Validation error:', error);
    }
  };

  const handleConfigChange = (updatedConfig: BotConfig) => {
    setConfig(updatedConfig);
  };

  const handleStatusChange = (updatedStatus: BotControlState) => {
    setBotStatus(updatedStatus);
  };

  const handleCreateNew = () => {
    setShowCreateDialog(true);
  };

  const handleCreateConfig = async (templateId?: string) => {
    try {
      let newConfig: Partial<BotConfig>;

      if (templateId) {
        const templatesResponse = await configAPI.getTemplates();
        const template = templatesResponse.data.data.find((t: any) => t.id === templateId);
        newConfig = template?.config || {};
      } else {
        // Create minimal config
        newConfig = {
          name: 'New Configuration',
          description: 'Paper trading configuration',
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
                patterns: { enabled: true, minConfidence: 70, patternTypes: [] },
                confluence: { minFactors: 2, requiredIndicators: [] }
              }
            },
            timeframes: ['1h'],
            symbols: ['BTCUSDT'],
            maxConcurrentTrades: 3
          },
          riskManagement: {
            maxRiskPerTrade: 2,
            maxDailyLoss: 5,
            maxTotalExposure: 10,
            maxDrawdown: 10,
            stopLossRequired: true,
            maxLeverage: 1,
            emergencyStop: {
              enabled: true,
              triggers: {
                maxDailyLoss: true,
                maxDrawdown: true,
                consecutiveLosses: { enabled: true, count: 3 },
                marketVolatility: { enabled: false, threshold: 0.05 }
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
              maxSize: 3,
              volatilityAdjustment: false,
              correlationAdjustment: false
            },
            correlationLimits: {
              enabled: false,
              maxCorrelatedPositions: 2,
              correlationThreshold: 0.7,
              timeframe: '1h'
            },
            drawdownProtection: {
              enabled: true,
              maxDrawdown: 10,
              reductionSteps: [],
              recoveryThreshold: 5
            }
          },
          signalFilters: {
            confidence: {
              enabled: true,
              minConfidence: 70,
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
              minPatternStrength: 70,
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
              minVolumeRatio: 1.0,
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
            inApp: { enabled: true, events: ['signal_generated', 'trade_executed'], sound: false }
          }
        };
      }

      const response = await configAPI.createConfig(newConfig);
      const createdConfig = response.data.data;
      
      setSnackbar({
        open: true,
        message: 'Configuration created successfully',
        severity: 'success'
      });

      // Navigate to the new configuration
      navigate(`/config/${createdConfig.id}`);
    } catch (error) {
      console.error('Failed to create configuration:', error);
      setSnackbar({
        open: true,
        message: 'Failed to create configuration',
        severity: 'error'
      });
    } finally {
      setShowCreateDialog(false);
    }
  };

  const renderBreadcrumbs = () => (
    <Breadcrumbs sx={{ mb: 3 }}>
      <Link
        color="inherit"
        href="#"
        onClick={() => navigate('/')}
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
      >
        <HomeIcon fontSize="small" />
        Dashboard
      </Link>
      <Link
        color="inherit"
        href="#"
        onClick={() => navigate('/config')}
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
      >
        <SettingsIcon fontSize="small" />
        Configuration
      </Link>
      {config && (
        <Typography color="text.primary">
          {config.name}
        </Typography>
      )}
    </Breadcrumbs>
  );

  if (configId && !config && !loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {renderBreadcrumbs()}
        <Alert severity="error">
          Configuration not found or failed to load.
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/config')}
            sx={{ ml: 2 }}
          >
            Back to Configurations
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {renderBreadcrumbs()}

      {/* Paper Trading Banner */}
      <PaperTradingIndicator variant="banner" showDetails />

      {configId && config ? (
        // Individual Configuration View
        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}>
            <ConfigurationStatusMonitor
              config={config}
              validation={validation}
              onRefresh={loadConfiguration}
            />
          </Grid>
          
          <Grid size={{ xs: 12 }}>
            <BotConfigurationInterface
              configId={configId}
              onConfigChange={handleConfigChange}
              onStatusChange={handleStatusChange}
            />
          </Grid>
        </Grid>
      ) : (
        // Configuration List View
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4">
              Bot Configurations
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateNew}
            >
              Create New Configuration
            </Button>
          </Box>

          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Paper Trading Mode Active
            </Typography>
            <Typography variant="body2">
              All configurations are for paper trading only. Create and test your strategies safely with virtual funds.
            </Typography>
          </Alert>

          <ConfigurationList
            onConfigSelect={(id) => navigate(`/config/${id}`)}
            onConfigCreate={handleCreateNew}
          />
        </Box>
      )}

      {/* Floating Action Button for Quick Create */}
      {!configId && (
        <Fab
          color="primary"
          aria-label="create configuration"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          onClick={handleCreateNew}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Create Configuration Dialog */}
      <Dialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Configuration</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose how to create your new paper trading configuration:
          </Typography>
          
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <Card 
                sx={{ 
                  cursor: 'pointer', 
                  '&:hover': { backgroundColor: 'action.hover' },
                  border: '1px solid',
                  borderColor: 'divider'
                }}
                onClick={() => handleCreateConfig()}
              >
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Blank Configuration
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Start with a minimal configuration and customize all settings yourself.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid size={{ xs: 12 }}>
              <Card 
                sx={{ 
                  cursor: 'pointer', 
                  '&:hover': { backgroundColor: 'action.hover' },
                  border: '1px solid',
                  borderColor: 'divider'
                }}
                onClick={() => handleCreateConfig('conservative')}
              >
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Conservative Template
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pre-configured with safe settings ideal for learning paper trading.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>
            Cancel
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
    </Container>
  );
};

export default ConfigurationPage;