import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid2 as Grid,
  LinearProgress,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalance,
  ShowChart,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';

const PortfolioOverview: React.FC = () => {
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
        <Box display="flex" alignItems="center" mb={2}>
          <AccountBalance sx={{ mr: 1 }} />
          <Typography variant="h6">Portfolio Overview</Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Balance Information */}
          <Grid xs={12} md={6}>
            <Box mb={2}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Total Balance
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {formatCurrency(portfolio.totalBalance)}
              </Typography>
            </Box>

            <Box mb={2}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Available Balance
              </Typography>
              <Typography variant="h6">
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
                  sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                />
                <Typography variant="body2">
                  {getPortfolioAllocation().toFixed(1)}%
                </Typography>
              </Box>
            </Box>
          </Grid>

          {/* P&L Information */}
          <Grid xs={12} md={6}>
            <Box mb={2}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Unrealized P&L
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
              </Box>
            </Box>

            <Box mb={2}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Realized P&L (Today)
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
              </Box>
            </Box>

            <Box mb={2}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Max Drawdown
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

        {/* Active Positions */}
        <Typography variant="subtitle1" fontWeight="bold" mb={2}>
          Active Positions ({positions.length})
        </Typography>

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
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption" display="block">
                        Size: {position.size.toFixed(4)} | Entry: ${position.entryPrice.toFixed(4)}
                      </Typography>
                      <Typography variant="caption" display="block">
                        Current: ${position.currentPrice.toFixed(4)}
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
                      +{positions.length - 5} more positions
                    </Typography>
                  }
                />
              </ListItem>
            )}
          </List>
        ) : (
          <Box display="flex" alignItems="center" justifyContent="center" py={3}>
            <Typography variant="body2" color="text.secondary">
              No active positions
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default PortfolioOverview;