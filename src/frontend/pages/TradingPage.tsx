import React, { useState } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Alert,
  Chip,
  Stack,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Security,
  LiveTv,
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import EnhancedTradingViewChart from '../components/charts/EnhancedTradingViewChart';
import VirtualPortfolioDisplay from '../components/dashboard/VirtualPortfolioDisplay';
import PaperTradingIndicator from '../components/common/PaperTradingIndicator';
import LiveDataIndicator from '../components/common/LiveDataIndicator';
import PaperTradingConfirmDialog from '../components/trading/PaperTradingConfirmDialog';
import { addNotification } from '../store/slices/uiSlice';
import { incrementPaperTradeCount } from '../store/slices/tradingSlice';

const TradingPage: React.FC = () => {
  const dispatch = useDispatch();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingTrade, setPendingTrade] = useState<any>(null);
  
  const { selectedSymbol, tickers, isConnected } = useSelector(
    (state: RootState) => state.marketData
  );
  const { botStatus, paperTrading } = useSelector(
    (state: RootState) => state.trading
  );
  
  const currentTicker = tickers[selectedSymbol];
  const currentPrice = currentTicker?.price || 0;
  const priceChangePercent24h = currentTicker?.changePercent24h || 0;

  // Paper trading handlers
  const handlePaperTrade = (tradeDetails: any) => {
    setPendingTrade(tradeDetails);
    setShowConfirmDialog(true);
  };

  const handleConfirmPaperTrade = () => {
    if (pendingTrade) {
      // Execute paper trade
      dispatch(incrementPaperTradeCount());
      dispatch(addNotification({
        type: 'success',
        title: 'Paper Trade Executed',
        message: `Virtual ${pendingTrade.side} order for ${pendingTrade.quantity} ${pendingTrade.symbol} executed successfully`,
        autoHide: true,
      }));
      
      setShowConfirmDialog(false);
      setPendingTrade(null);
    }
  };

  const handleCancelPaperTrade = () => {
    setShowConfirmDialog(false);
    setPendingTrade(null);
  };

  const handleQuickBuy = () => {
    const tradeDetails = {
      symbol: selectedSymbol,
      side: 'buy' as const,
      type: 'market' as const,
      quantity: 0.001,
      estimatedValue: currentPrice * 0.001,
    };
    handlePaperTrade(tradeDetails);
  };

  const handleQuickSell = () => {
    const tradeDetails = {
      symbol: selectedSymbol,
      side: 'sell' as const,
      type: 'market' as const,
      quantity: 0.001,
      estimatedValue: currentPrice * 0.001,
    };
    handlePaperTrade(tradeDetails);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Paper Trading Header */}
      <Alert
        severity="warning"
        icon={<Security />}
        sx={{ mb: 3, backgroundColor: 'rgba(255, 152, 0, 0.1)' }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="subtitle1" fontWeight="bold">
              PAPER TRADING MODE ACTIVE
            </Typography>
            <Typography variant="body2">
              All trades are simulated with live market data - No real money at risk
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <LiveDataIndicator variant="chip" />
            <PaperTradingIndicator variant="chip" />
          </Box>
        </Box>
      </Alert>

      <Grid container spacing={3}>
        {/* Trading Chart */}
        <Grid item xs={12} lg={8}>
          <Box sx={{ mb: 2 }}>
            <EnhancedTradingViewChart 
              symbol={selectedSymbol}
              height={500}
            />
          </Box>

          {/* Quick Trading Panel */}
          <Paper sx={{ p: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Quick Paper Trading</Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="body2" color="text.secondary">
                  Current Price: {formatCurrency(currentPrice)}
                </Typography>
                <Chip
                  label={`${priceChangePercent24h >= 0 ? '+' : ''}${priceChangePercent24h.toFixed(2)}%`}
                  color={priceChangePercent24h >= 0 ? 'success' : 'error'}
                  size="small"
                />
              </Box>
            </Box>

            <Alert severity="info" icon={<LiveTv />} sx={{ mb: 2 }}>
              <Typography variant="body2">
                Trading with <strong>LIVE MAINNET DATA</strong> from {selectedSymbol.replace('USDT', '/USDT')} - All orders are paper trades only
              </Typography>
            </Alert>

            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                color="success"
                size="large"
                startIcon={<TrendingUpIcon />}
                onClick={handleQuickBuy}
                disabled={!isConnected}
                sx={{ flex: 1 }}
              >
                Paper Buy (0.001 {selectedSymbol.replace('USDT', '')})
              </Button>
              <Button
                variant="contained"
                color="error"
                size="large"
                startIcon={<TrendingDownIcon />}
                onClick={handleQuickSell}
                disabled={!isConnected}
                sx={{ flex: 1 }}
              >
                Paper Sell (0.001 {selectedSymbol.replace('USDT', '')})
              </Button>
            </Stack>

            {/* Paper Trading Stats */}
            <Box mt={2} p={2} bgcolor="rgba(255, 152, 0, 0.05)" borderRadius={1}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Paper Trading Statistics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Total Paper Trades
                  </Typography>
                  <Typography variant="h6" color="warning.main">
                    {paperTrading.totalPaperTrades}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Virtual Balance
                  </Typography>
                  <Typography variant="h6" color="warning.main">
                    {formatCurrency(paperTrading.virtualBalance)}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} lg={4}>
          <Stack spacing={3}>
            {/* Virtual Portfolio */}
            <VirtualPortfolioDisplay />

            {/* Bot Status */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Bot Status
              </Typography>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Chip
                  label={botStatus.toUpperCase()}
                  color={botStatus === 'running' ? 'success' : 'default'}
                  icon={<Security />}
                />
                <PaperTradingIndicator variant="chip" size="small" />
              </Box>
              <Typography variant="body2" color="text.secondary">
                All bot operations are in paper trading mode only
              </Typography>
            </Paper>

            {/* Safety Reminders */}
            <Paper sx={{ p: 2, bgcolor: 'rgba(255, 152, 0, 0.05)' }}>
              <Typography variant="h6" gutterBottom color="warning.main">
                Safety Reminders
              </Typography>
              <Box component="ul" sx={{ pl: 2, m: 0 }}>
                <Typography component="li" variant="body2" gutterBottom>
                  All trades are simulated
                </Typography>
                <Typography component="li" variant="body2" gutterBottom>
                  No real money is at risk
                </Typography>
                <Typography component="li" variant="body2" gutterBottom>
                  Live market data is used
                </Typography>
                <Typography component="li" variant="body2">
                  Educational purposes only
                </Typography>
              </Box>
            </Paper>
          </Stack>
        </Grid>
      </Grid>

      {/* Paper Trading Confirmation Dialog */}
      <PaperTradingConfirmDialog
        open={showConfirmDialog}
        onClose={handleCancelPaperTrade}
        onConfirm={handleConfirmPaperTrade}
        tradeDetails={pendingTrade}
      />
    </Box>
  );
};

export default TradingPage;