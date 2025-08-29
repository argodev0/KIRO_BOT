import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  IconButton,
  Collapse
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  TrendingUp as TrendingUpIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { BotConfig, ConfigValidation } from '@/types/config';
import ConfigValidationService from '@/services/configValidation';

interface ConfigurationStatusMonitorProps {
  config: BotConfig;
  validation?: ConfigValidation;
  onRefresh?: () => void;
}

export const ConfigurationStatusMonitor: React.FC<ConfigurationStatusMonitorProps> = ({
  config,
  validation,
  onRefresh
}) => {
  const [safetyScore, setSafetyScore] = useState<number>(0);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const score = ConfigValidationService.getPaperTradingSafetyScore(config);
    setSafetyScore(score);
  }, [config]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await onRefresh?.();
    } finally {
      setLoading(false);
    }
  };

  const getSafetyScoreColor = (score: number): 'success' | 'warning' | 'error' => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  const getSafetyScoreLabel = (score: number): string => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 70) return 'Fair';
    if (score >= 60) return 'Poor';
    return 'Critical';
  };

  const getValidationIcon = () => {
    if (!validation) return <WarningIcon color="action" />;
    if (validation.isValid) return <CheckIcon color="success" />;
    return <ErrorIcon color="error" />;
  };

  const getValidationColor = (): 'success' | 'warning' | 'error' | 'default' => {
    if (!validation) return 'default';
    if (validation.isValid) return 'success';
    return 'error';
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Configuration Status
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip
              icon={<SecurityIcon />}
              label="PAPER TRADING"
              color="warning"
              variant="outlined"
              size="small"
            />
            <Tooltip title="Refresh status">
              <IconButton size="small" onClick={handleRefresh} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Grid container spacing={3}>
          {/* Paper Trading Safety Score */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Paper Trading Safety Score
              </Typography>
              <Box sx={{ position: 'relative', display: 'inline-flex', mb: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={safetyScore}
                  color={getSafetyScoreColor(safetyScore)}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    width: 120,
                    backgroundColor: 'rgba(0,0,0,0.1)'
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    top: -25,
                    left: '50%',
                    transform: 'translateX(-50%)',
                  }}
                >
                  <Typography variant="h6" color={`${getSafetyScoreColor(safetyScore)}.main`}>
                    {safetyScore}%
                  </Typography>
                </Box>
              </Box>
              <Typography variant="caption" color={`${getSafetyScoreColor(safetyScore)}.main`}>
                {getSafetyScoreLabel(safetyScore)}
              </Typography>
            </Box>
          </Grid>

          {/* Validation Status */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Validation Status
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                {getValidationIcon()}
                <Chip
                  label={validation?.isValid ? 'Valid' : validation ? 'Issues Found' : 'Not Validated'}
                  color={getValidationColor()}
                  variant="outlined"
                  size="small"
                />
              </Box>
              {validation && (
                <Typography variant="caption" color="text.secondary">
                  {ConfigValidationService.getValidationSummary(validation)}
                </Typography>
              )}
            </Box>
          </Grid>

          {/* Configuration Summary */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Configuration Summary
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 1 }}>
                <Chip
                  icon={<SpeedIcon />}
                  label={config.strategy?.type.replace(/_/g, ' ').toUpperCase() || 'No Strategy'}
                  size="small"
                  variant="outlined"
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {config.strategy?.symbols?.length || 0} symbols, {config.strategy?.maxConcurrentTrades || 0} max trades
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Expandable Details */}
        <Box sx={{ mt: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' },
              p: 1,
              borderRadius: 1
            }}
            onClick={() => setExpanded(!expanded)}
          >
            <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
              Detailed Status
            </Typography>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </Box>

          <Collapse in={expanded}>
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                {/* Safety Checks */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Safety Checks
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <CheckIcon color="success" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Paper Trading Mode"
                        secondary="All trades are simulated"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        {config.exchanges?.every(ex => ex.testnet) ? 
                          <CheckIcon color="success" fontSize="small" /> : 
                          <WarningIcon color="warning" fontSize="small" />
                        }
                      </ListItemIcon>
                      <ListItemText
                        primary="Exchange Configuration"
                        secondary={config.exchanges?.every(ex => ex.testnet) ? 
                          'All exchanges in testnet mode' : 
                          'Some exchanges in production mode'
                        }
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        {config.riskManagement?.emergencyStop?.enabled ? 
                          <CheckIcon color="success" fontSize="small" /> : 
                          <WarningIcon color="warning" fontSize="small" />
                        }
                      </ListItemIcon>
                      <ListItemText
                        primary="Emergency Stop"
                        secondary={config.riskManagement?.emergencyStop?.enabled ? 
                          'Emergency stop enabled' : 
                          'Emergency stop disabled'
                        }
                      />
                    </ListItem>
                  </List>
                </Grid>

                {/* Risk Settings */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Risk Settings
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <TrendingUpIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Risk Per Trade"
                        secondary={`${config.riskManagement?.maxRiskPerTrade || 0}%`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <TrendingUpIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Daily Loss Limit"
                        secondary={`${config.riskManagement?.maxDailyLoss || 0}%`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <SpeedIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Max Concurrent Trades"
                        secondary={config.strategy?.maxConcurrentTrades || 0}
                      />
                    </ListItem>
                  </List>
                </Grid>
              </Grid>

              {/* Validation Details */}
              {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
                <Box sx={{ mt: 2 }}>
                  {validation.errors.length > 0 && (
                    <Alert severity="error" sx={{ mb: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Errors ({validation.errors.length}):
                      </Typography>
                      {validation.errors.slice(0, 3).map((error, index) => (
                        <Typography key={index} variant="body2">
                          • {error.field}: {error.message}
                        </Typography>
                      ))}
                      {validation.errors.length > 3 && (
                        <Typography variant="body2" color="text.secondary">
                          ... and {validation.errors.length - 3} more
                        </Typography>
                      )}
                    </Alert>
                  )}

                  {validation.warnings.length > 0 && (
                    <Alert severity="warning">
                      <Typography variant="subtitle2" gutterBottom>
                        Warnings ({validation.warnings.length}):
                      </Typography>
                      {validation.warnings.slice(0, 2).map((warning, index) => (
                        <Typography key={index} variant="body2">
                          • {warning.field}: {warning.message}
                        </Typography>
                      ))}
                      {validation.warnings.length > 2 && (
                        <Typography variant="body2" color="text.secondary">
                          ... and {validation.warnings.length - 2} more
                        </Typography>
                      )}
                    </Alert>
                  )}
                </Box>
              )}
            </Box>
          </Collapse>
        </Box>

        {loading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ConfigurationStatusMonitor;