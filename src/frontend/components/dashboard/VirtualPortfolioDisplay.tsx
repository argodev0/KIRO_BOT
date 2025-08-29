import React, { useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  Divider,
  Tabs,
  Tab,
  Button,
  CircularProgress,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  AccountBalance,
  TrendingUp,
  TrendingDown,
  Security,
  Timeline,
  Refresh,
  PieChart,
  History,
  Assessment,
  WifiOff,
  Wifi,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { useVirtualPortfolio } from '../../hooks/useVirtualPortfolio';
import PortfolioAllocationChart from '../charts/PortfolioAllocationChart';
import PaperTradingHistory from '../trading/PaperTradingHistory';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`portfolio-tabpanel-${index}`}
      aria-labelledby={`portfolio-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
};

const VirtualPortfolioDisplay: React.FC = () => {
  const { portfolio: reduxPortfolio, paperTrading } = useSelector((state: RootState) => state.trading);
  const { positions: reduxPositions } = useSelector((state: RootState) => state.trading);
  
  const {
    portfolio,
    positions,
    tradeHistory,
    performance,
    isLoading,
    error,
    isConnected,
    refreshPortfolio,
    refreshHistory,
    refreshPerformance
  } = useVirtualPortfolio();

  const [activeTab, setActiveTab] = useState(0);

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

  // Use live portfolio data if available, fallback to Redux state
  const currentPortfolio = portfolio || {
    totalBalance: reduxPortfolio.totalBalance,
    availableBalance: reduxPortfolio.availableBalance,
    totalUnrealizedPnl: reduxPortfolio.totalUnrealizedPnl,
    totalRealizedPnl: reduxPortfolio.totalRealizedPnl,
    equity: reduxPortfolio.totalBalance + reduxPortfolio.totalUnrealizedPnl
  };

  // Convert Redux positions to VirtualPosition format for compatibility
  const convertToVirtualPositions = (reduxPos: any[]): any[] => {
    return reduxPos.map(pos => ({
      ...pos,
      userId: 'current-user',
      realizedPnl: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      isPaperPosition: true
    }));
  };

  const currentPositions = positions.length > 0 ? positions : convertToVirtualPositions(reduxPositions);

  const totalPnL = currentPortfolio.totalRealizedPnl + currentPortfolio.totalUnrealizedPnl;
  const initialBalance = paperTrading?.initialBalance || 50000; // Default to $50,000
  const totalPnLPercentage = initialBalance > 0 
    ? (totalPnL / initialBalance) * 100 
    : 0;

  const portfolioUsage = initialBalance > 0
    ? ((initialBalance - currentPortfolio.availableBalance) / initialBalance) * 100
    : 0;

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleRefresh = async () => {
    try {
      await Promise.all([
        refreshPortfolio(),
        refreshHistory(),
        refreshPerformance()
      ]);
    } catch (err) {
      console.error('Failed to refresh portfolio data:', err);
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <AccountBalance color="primary" />
        <Typography variant="h6">Virtual Portfolio</Typography>
        <Chip
          label="PAPER"
          color="warning"
          size="small"
          icon={<Security />}
        />
        <Box flexGrow={1} />
        
        {/* Connection Status */}
        <Tooltip title={isConnected ? 'Real-time updates active' : 'Real-time updates disconnected'}>
          <IconButton size="small">
            {isConnected ? <Wifi color="success" /> : <WifiOff color="error" />}
          </IconButton>
        </Tooltip>
        
        {/* Refresh Button */}
        <Tooltip title="Refresh portfolio data">
          <IconButton 
            size="small" 
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={20} /> : <Refresh />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Error:</strong> {error}
          </Typography>
        </Alert>
      )}

      {/* Paper Trading Alert */}
      <Alert 
        severity="info" 
        sx={{ mb: 2, backgroundColor: 'rgba(33, 150, 243, 0.1)' }}
      >
        <Typography variant="body2">
          <strong>Simulated Trading:</strong> All values are virtual and for educational purposes only
          {isConnected && (
            <Chip 
              label="LIVE UPDATES" 
              color="success" 
              size="small" 
              sx={{ ml: 1 }}
            />
          )}
        </Typography>
      </Alert>

      {/* Portfolio Overview */}
      <Box display="flex" gap={2} sx={{ mb: 2 }}>
        <Box flex="1" textAlign="center">
          <Typography variant="body2" color="text.secondary">
            Total Balance
          </Typography>
          <Typography variant="h6" fontWeight="bold">
            {formatCurrency(currentPortfolio.totalBalance)}
          </Typography>
        </Box>
        <Box flex="1" textAlign="center">
          <Typography variant="body2" color="text.secondary">
            Available
          </Typography>
          <Typography variant="h6" fontWeight="bold">
            {formatCurrency(currentPortfolio.availableBalance)}
          </Typography>
        </Box>
      </Box>

      {/* P&L Section */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Profit & Loss
        </Typography>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          {totalPnL >= 0 ? (
            <TrendingUp color="success" />
          ) : (
            <TrendingDown color="error" />
          )}
          <Typography 
            variant="h6" 
            color={totalPnL >= 0 ? 'success.main' : 'error.main'}
            fontWeight="bold"
          >
            {formatCurrency(totalPnL)}
          </Typography>
          <Chip
            label={formatPercentage(totalPnLPercentage)}
            color={totalPnL >= 0 ? 'success' : 'error'}
            size="small"
          />
        </Box>

        <Box display="flex" gap={1}>
          <Box flex="1">
            <Typography variant="caption" color="text.secondary">
              Realized P&L
            </Typography>
            <Typography 
              variant="body2" 
              color={currentPortfolio.totalRealizedPnl >= 0 ? 'success.main' : 'error.main'}
              fontWeight="bold"
            >
              {formatCurrency(currentPortfolio.totalRealizedPnl)}
            </Typography>
          </Box>
          <Box flex="1">
            <Typography variant="caption" color="text.secondary">
              Unrealized P&L
            </Typography>
            <Typography 
              variant="body2" 
              color={currentPortfolio.totalUnrealizedPnl >= 0 ? 'success.main' : 'error.main'}
              fontWeight="bold"
            >
              {formatCurrency(currentPortfolio.totalUnrealizedPnl)}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Portfolio Usage */}
      <Box sx={{ mb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle2">
            Portfolio Usage
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {portfolioUsage.toFixed(1)}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={Math.min(portfolioUsage, 100)}
          color={portfolioUsage > 80 ? 'warning' : 'primary'}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="portfolio tabs">
          <Tab 
            label="Overview" 
            icon={<AccountBalance />} 
            iconPosition="start"
            id="portfolio-tab-0"
            aria-controls="portfolio-tabpanel-0"
          />
          <Tab 
            label="Allocation" 
            icon={<PieChart />} 
            iconPosition="start"
            id="portfolio-tab-1"
            aria-controls="portfolio-tabpanel-1"
          />
          <Tab 
            label="History" 
            icon={<History />} 
            iconPosition="start"
            id="portfolio-tab-2"
            aria-controls="portfolio-tabpanel-2"
          />
          <Tab 
            label="Performance" 
            icon={<Assessment />} 
            iconPosition="start"
            id="portfolio-tab-3"
            aria-controls="portfolio-tabpanel-3"
          />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <TabPanel value={activeTab} index={0}>
        {/* Active Positions */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Active Positions
          </Typography>
          {currentPositions.length === 0 ? (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              No active positions
            </Typography>
          ) : (
            <Box>
              {currentPositions.slice(0, 3).map((position) => (
                <Box 
                  key={position.id}
                  display="flex" 
                  justifyContent="space-between" 
                  alignItems="center"
                  py={1}
                >
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      {position.symbol.replace('USDT', '/USDT')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {position.side.toUpperCase()} • {position.size}
                    </Typography>
                  </Box>
                  <Box textAlign="right">
                    <Typography 
                      variant="body2" 
                      color={position.unrealizedPnl >= 0 ? 'success.main' : 'error.main'}
                      fontWeight="bold"
                    >
                      {formatCurrency(position.unrealizedPnl)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatCurrency(position.entryPrice)}
                    </Typography>
                  </Box>
                </Box>
              ))}
              {currentPositions.length > 3 && (
                <Typography variant="caption" color="text.secondary" textAlign="center" display="block" mt={1}>
                  +{currentPositions.length - 3} more positions
                </Typography>
              )}
            </Box>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Paper Trading Stats */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Paper Trading Statistics
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={2}>
            <Box flex="1 1 45%">
              <Typography variant="caption" color="text.secondary">
                Total Trades
              </Typography>
              <Typography variant="body2" fontWeight="bold" color="warning.main">
                {performance?.totalTrades || paperTrading.totalPaperTrades}
              </Typography>
            </Box>
            <Box flex="1 1 45%">
              <Typography variant="caption" color="text.secondary">
                Started
              </Typography>
              <Typography variant="body2" fontWeight="bold" color="warning.main">
                {new Date(paperTrading.paperTradingStartDate).toLocaleDateString()}
              </Typography>
            </Box>
            {performance && (
              <>
                <Box flex="1 1 45%">
                  <Typography variant="caption" color="text.secondary">
                    Win Rate
                  </Typography>
                  <Typography variant="body2" fontWeight="bold" color="info.main">
                    {performance.winRate.toFixed(1)}%
                  </Typography>
                </Box>
                <Box flex="1 1 45%">
                  <Typography variant="caption" color="text.secondary">
                    Profit Factor
                  </Typography>
                  <Typography 
                    variant="body2" 
                    fontWeight="bold" 
                    color={performance.profitFactor >= 1 ? 'success.main' : 'error.main'}
                  >
                    {performance.profitFactor.toFixed(2)}
                  </Typography>
                </Box>
              </>
            )}
          </Box>

          {/* Drawdown */}
          {(performance?.currentDrawdown || reduxPortfolio.currentDrawdown) > 0 && (
            <Box mt={1}>
              <Typography variant="caption" color="text.secondary">
                Current Drawdown
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="body2" color="error.main" fontWeight="bold">
                  {formatPercentage(-(performance?.currentDrawdown || reduxPortfolio.currentDrawdown))}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={performance?.currentDrawdown || reduxPortfolio.currentDrawdown}
                  color="error"
                  sx={{ flex: 1, height: 4, borderRadius: 2 }}
                />
              </Box>
            </Box>
          )}
        </Box>
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <PortfolioAllocationChart
          positions={currentPositions}
          totalBalance={currentPortfolio.totalBalance}
          availableBalance={currentPortfolio.availableBalance}
          totalUnrealizedPnl={currentPortfolio.totalUnrealizedPnl}
          totalRealizedPnl={currentPortfolio.totalRealizedPnl}
        />
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <PaperTradingHistory
          trades={tradeHistory}
          isLoading={isLoading}
          onRefresh={refreshHistory}
        />
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        {performance ? (
          <Box>
            <Typography variant="h6" gutterBottom>
              Performance Metrics
            </Typography>
            <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={3}>
              <Box flex="1">
                <Paper sx={{ p: 2, backgroundColor: 'rgba(0,0,0,0.02)' }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Trading Statistics
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={2}>
                    <Box flex="1 1 45%">
                      <Typography variant="body2" color="text.secondary">
                        Total Trades
                      </Typography>
                      <Typography variant="h6" fontWeight="bold">
                        {performance.totalTrades}
                      </Typography>
                    </Box>
                    <Box flex="1 1 45%">
                      <Typography variant="body2" color="text.secondary">
                        Win Rate
                      </Typography>
                      <Typography 
                        variant="h6" 
                        fontWeight="bold"
                        color={performance.winRate >= 50 ? 'success.main' : 'error.main'}
                      >
                        {performance.winRate.toFixed(1)}%
                      </Typography>
                    </Box>
                    <Box flex="1 1 45%">
                      <Typography variant="body2" color="text.secondary">
                        Winning Trades
                      </Typography>
                      <Typography variant="body1" color="success.main">
                        {performance.winningTrades}
                      </Typography>
                    </Box>
                    <Box flex="1 1 45%">
                      <Typography variant="body2" color="text.secondary">
                        Losing Trades
                      </Typography>
                      <Typography variant="body1" color="error.main">
                        {performance.losingTrades}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Box>
              
              <Box flex="1">
                <Paper sx={{ p: 2, backgroundColor: 'rgba(0,0,0,0.02)' }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Profit & Loss
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={2}>
                    <Box flex="1 1 45%">
                      <Typography variant="body2" color="text.secondary">
                        Total Return
                      </Typography>
                      <Typography 
                        variant="h6" 
                        fontWeight="bold"
                        color={performance.totalReturn >= 0 ? 'success.main' : 'error.main'}
                      >
                        {formatCurrency(performance.totalReturn)}
                      </Typography>
                    </Box>
                    <Box flex="1 1 45%">
                      <Typography variant="body2" color="text.secondary">
                        Return %
                      </Typography>
                      <Typography 
                        variant="h6" 
                        fontWeight="bold"
                        color={performance.totalReturnPercent >= 0 ? 'success.main' : 'error.main'}
                      >
                        {formatPercentage(performance.totalReturnPercent)}
                      </Typography>
                    </Box>
                    <Box flex="1 1 45%">
                      <Typography variant="body2" color="text.secondary">
                        Average Win
                      </Typography>
                      <Typography variant="body1" color="success.main">
                        {formatCurrency(performance.averageWin)}
                      </Typography>
                    </Box>
                    <Box flex="1 1 45%">
                      <Typography variant="body2" color="text.secondary">
                        Average Loss
                      </Typography>
                      <Typography variant="body1" color="error.main">
                        {formatCurrency(performance.averageLoss)}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Box>
            </Box>
          </Box>
        ) : (
          <Alert severity="info">
            No performance data available yet. Start trading to see performance metrics.
          </Alert>
        )}
      </TabPanel>

      {/* Safety Footer */}
      <Alert 
        severity="warning" 
        sx={{ mt: 2, backgroundColor: 'rgba(255, 152, 0, 0.05)' }}
      >
        <Typography variant="caption">
          <Security fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
          All trades are simulated - No real money at risk
        </Typography>
      </Alert>
    </Paper>
  );
};

export default VirtualPortfolioDisplay;