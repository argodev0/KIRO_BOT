import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalance,
  ShowChart,
  Security,
  Info,
  Refresh,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import PaperTradingIndicator from '../common/PaperTradingIndicator';

const VirtualPortfolioDisplay: React.FC = () => {
  const { portfolio, positions } = useSelector((state: RootState) => state.trading);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercentage = (value: number): string => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getTotalPositionValue = (): number => {
    return positions.reduce((total, position) => {
      return total + (position.size * position.currentPrice);
    }, 0);
  };

  const getPortfolioAllocation = (): number => {
    const totalValue = portfolio.totalBalance;
    const positionValue = getTotalPositionValue();
    return totalValue > 0 ? (positionValue / totalValue) * 100 : 0;
  };

  const getPnLColor = (pnl: number): 'success' | 'error' | 'default' => {
    if (pnl > 0) return 'success';
    if (pnl < 0) return 'error';
    return 'default';
  };

  const getPnLIcon = (pnl: number) => {
    if (pnl > 0) return <TrendingUp color="success" />;
    if (pnl < 0) return <TrendingDown color="error" />;
    return <ShowChart color="disabled" />;
  };

  return (
    <Card>
      <CardContent>
        {/* Header with Paper Trading Indicator */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <Security color="warning" />
            <Typography variant="h6">Virtual Portfolio</Typography>
          </Box>
          <PaperTradingIndicator variant="chip" size="small" />
        </Box>

        {/* Paper Trading Warning */}
        <Alert
          severity="info"
          icon={<Security />}
          sx={{ mb: 2, backgroundColor: 'rgba(255, 152, 0, 0.1)' }}
        >
          <Typography variant="body2">
            <strong>PAPER TRADING - Simulated Trading Environment:</strong> All balances and trades are virtual. 
            No real money is involved.
          </Typography>
        </Alert>

        <Grid container spacing={3}>
          {/* Virtual Balance Information */}
          <Grid xs={12} md={6}>
            <Box mb={2}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Virtual Total Balance
                </Typography>
                <Tooltip title="This is your simulated trading balance">
                  <Info fontSize="small" color="disabled" />
                </Tooltip>
              </Box>
              <Typography variant="h4" fontWeight="bold" color="warning.main">
                {formatCurrency(portfolio.totalBalance)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                (Simulated)
              </Typography>
            </Box>

            <Box mb={2}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Available Virtual Balance
              </Typography>
              <Typography variant="h6" color="warning.main">
                {formatCurrency(portfolio.availableBalance)}
              </Typography>
            </Box>

            <Box mb={2}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Portfolio Allocation
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(getPortfolioAllocation(), 100)}
                  sx={{ 
                    flexGrow: 1, 
                    height: 8, 
                    borderRadius: 4,
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: 'warning.main',
                    },
                  }}
                />
                <Typography variant="body2">
                  {getPortfolioAllocation().toFixed(1)}%
                </Typography>
              </Box>
            </Box>
          </Grid>

          {/* Virtual P&L Information */}
          <Grid xs={12} md={6}>
            <Box mb={2}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Simulated Unrealized P&L
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                {getPnLIcon(portfolio.totalUnrealizedPnl)}
                <Typography
                  variant="h6"
                  color={getPnLColor(portfolio.totalUnrealizedPnl) + '.main'}
                  fontWeight="bold"
                >
                  {formatCurrency(portfolio.totalUnrealizedPnl)}
                </Typography>
                <Chip
                  label="VIRTUAL"
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              </Box>
            </Box>

            <Box mb={2}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Simulated Realized P&L (Today)
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                {getPnLIcon(portfolio.totalRealizedPnl)}
                <Typography
                  variant="h6"
                  color={getPnLColor(portfolio.totalRealizedPnl) + '.main'}
                  fontWeight="bold"
                >
                  {formatCurrency(portfolio.totalRealizedPnl)}
                </Typography>
                <Chip
                  label="VIRTUAL"
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              </Box>
            </Box>

            <Box mb={2}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Max Drawdown (Simulated)
              </Typography>
              <Chip
                label={formatPercentage(portfolio.maxDrawdown)}
                color={portfolio.maxDrawdown < -10 ? 'error' : 'warning'}
                size="small"
              />
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        {/* Virtual Positions */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="subtitle1" fontWeight="bold">
            Virtual Positions ({positions.length})
          </Typography>
          <Tooltip title="Refresh virtual positions">
            <IconButton size="small">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>

        {positions.length > 0 ? (
          <List dense>
            {positions.slice(0, 5).map((position) => (
              <ListItem key={position.id} divider>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {position.symbol}
                      </Typography>
                      <Chip
                        label={position.side.toUpperCase()}
                        color={position.side === 'long' ? 'success' : 'error'}
                        size="small"
                      />
                      <Chip
                        label="PAPER"
                        size="small"
                        color="warning"
                        variant="outlined"
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption" display="block">
                        Size: {position.size.toFixed(4)} | Entry: ${position.entryPrice.toFixed(4)}
                      </Typography>
                      <Typography variant="caption" display="block">
                        Current: ${position.currentPrice.toFixed(4)} | Virtual P&L
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Box textAlign="right">
                    <Typography
                      variant="subtitle2"
                      color={getPnLColor(position.unrealizedPnl) + '.main'}
                      fontWeight="bold"
                    >
                      {formatCurrency(position.unrealizedPnl)}
                    </Typography>
                    <Typography
                      variant="caption"
                      color={getPnLColor(position.unrealizedPnl) + '.main'}
                    >
                      {formatPercentage(
                        ((position.currentPrice - position.entryPrice) / position.entryPrice) * 100 *
                        (position.side === 'long' ? 1 : -1)
                      )}
                    </Typography>
                  </Box>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
            {positions.length > 5 && (
              <ListItem>
                <ListItemText
                  primary={
                    <Typography variant="body2" color="text.secondary" textAlign="center">
                      +{positions.length - 5} more virtual positions
                    </Typography>
                  }
                />
              </ListItem>
            )}
          </List>
        ) : (
          <Box display="flex" alignItems="center" justifyContent="center" py={3}>
            <Typography variant="body2" color="text.secondary">
              No virtual positions active
            </Typography>
          </Box>
        )}

        {/* Virtual Trading Disclaimer */}
        <Box mt={2} p={1} bgcolor="rgba(255, 152, 0, 0.05)" borderRadius={1}>
          <Typography variant="caption" color="text.secondary" textAlign="center" display="block">
            All positions and balances are simulated for educational purposes only
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default VirtualPortfolioDisplay;