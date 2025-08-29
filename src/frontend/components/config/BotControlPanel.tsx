import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  LinearProgress,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Pause as PauseIcon,
  TrendingUp as ProfitIcon,
  TrendingDown as LossIcon,
  AccountBalance as BalanceIcon,
  Speed as SpeedIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { BotConfig, BotControlState, BotStatus } from '@/types/config';

interface BotControlPanelProps {
  config: BotConfig;
  status: BotControlState;
  onControl: (action: 'start' | 'stop' | 'pause' | 'resume') => void;
  loading?: boolean;
}

export const BotControlPanel: React.FC<BotControlPanelProps> = ({
  config,
  status,
  onControl,
  loading = false
}) => {
  const getStatusColor = (botStatus: BotStatus): 'success' | 'error' | 'warning' | 'info' => {
    switch (botStatus) {
      case 'running': return 'success';
      case 'error': return 'error';
      case 'paused': case 'pausing': case 'stopping': return 'warning';
      default: return 'info';
    }
  };

  const getStatusIcon = (botStatus: BotStatus) => {
    switch (botStatus) {
      case 'running': return <StartIcon />;
      case 'paused': return <PauseIcon />;
      case 'error': return <WarningIcon />;
      default: return <StopIcon />;
    }
  };

  const getControlButtons = (botStatus: BotStatus) => {
    switch (botStatus) {
      case 'running':
        return [
          { action: 'pause' as const, label: 'Pause Bot', color: 'warning' as const, icon: <PauseIcon /> },
          { action: 'stop' as const, label: 'Stop Bot', color: 'error' as const, icon: <StopIcon /> }
        ];
      case 'paused':
        return [
          { action: 'resume' as const, label: 'Resume Bot', color: 'success' as const, icon: <StartIcon /> },
          { action: 'stop' as const, label: 'Stop Bot', color: 'error' as const, icon: <StopIcon /> }
        ];
      default:
        return [
          { action: 'start' as const, label: 'Start Bot', color: 'success' as const, icon: <StartIcon /> }
        ];
    }
  };

  const formatDuration = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const controlButtons = getControlButtons(status.status);

  return (
    <Box>
      {/* Bot Status Overview */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Bot Status: {config.name}
            </Typography>
            <Chip
              icon={getStatusIcon(status.status)}
              label={status.status.toUpperCase()}
              color={getStatusColor(status.status)}
              variant="filled"
            />
          </Box>

          {status.status === 'running' && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Running Time: {formatDuration(status.runningTime)}
              </Typography>
              <LinearProgress 
                variant="indeterminate" 
                color="success" 
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Box>
          )}

          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {status.totalTrades}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total Trades
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="warning.main">
                  {status.activePositions}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Active Positions
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography 
                  variant="h4" 
                  color={status.totalProfit >= 0 ? 'success.main' : 'error.main'}
                >
                  {formatCurrency(status.totalProfit)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total P&L
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography 
                  variant="h4" 
                  color={status.currentDrawdown > 5 ? 'error.main' : 'text.primary'}
                >
                  {status.currentDrawdown.toFixed(1)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Drawdown
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Control Buttons */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Bot Controls
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {controlButtons.map((button) => (
              <Button
                key={button.action}
                variant="contained"
                color={button.color}
                startIcon={button.icon}
                onClick={() => onControl(button.action)}
                disabled={loading || ['starting', 'stopping', 'pausing'].includes(status.status)}
                size="large"
              >
                {button.label}
              </Button>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Configuration Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Configuration Summary
          </Typography>
          
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <SpeedIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Strategy"
                    secondary={config.strategy.type.replace(/_/g, ' ').toUpperCase()}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <BalanceIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Max Risk Per Trade"
                    secondary={`${config.riskManagement.maxRiskPerTrade}%`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <WarningIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Max Daily Loss"
                    secondary={`${config.riskManagement.maxDailyLoss}%`}
                  />
                </ListItem>
              </List>
            </Grid>
            
            <Grid size={{ xs: 12, md: 6 }}>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Trading Symbols"
                    secondary={config.strategy.symbols.join(', ')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Timeframes"
                    secondary={config.strategy.timeframes.join(', ')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Max Concurrent Trades"
                    secondary={config.strategy.maxConcurrentTrades}
                  />
                </ListItem>
              </List>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Risk Warnings */}
      {(status.currentDrawdown > 5 || status.activePositions > config.strategy.maxConcurrentTrades) && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Risk Warning
          </Typography>
          {status.currentDrawdown > 5 && (
            <Typography variant="body2">
              • Current drawdown ({status.currentDrawdown.toFixed(1)}%) is above 5%
            </Typography>
          )}
          {status.activePositions > config.strategy.maxConcurrentTrades && (
            <Typography variant="body2">
              • Active positions ({status.activePositions}) exceed configured limit ({config.strategy.maxConcurrentTrades})
            </Typography>
          )}
        </Alert>
      )}

      {/* Emergency Stop Status */}
      {config.riskManagement.emergencyStop.enabled && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Emergency Stop System
            </Typography>
            <Chip
              icon={<WarningIcon />}
              label="ACTIVE"
              color="success"
              variant="outlined"
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Emergency stop is enabled and monitoring for risk violations.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};