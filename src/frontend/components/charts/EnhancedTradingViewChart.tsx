import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Fullscreen,
  FullscreenExit,
  Refresh,
  TrendingUp,
  Security,
  LiveTv,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import PaperTradingIndicator from '../common/PaperTradingIndicator';
import LiveDataIndicator from '../common/LiveDataIndicator';

interface EnhancedTradingViewChartProps {
  symbol?: string;
  interval?: string;
  height?: number;
  onFullscreenToggle?: (isFullscreen: boolean) => void;
}

const EnhancedTradingViewChart: React.FC<EnhancedTradingViewChartProps> = ({
  symbol = 'BTCUSDT',
  interval = '1H',
  height = 500,
  onFullscreenToggle
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);
  
  const { isConnected, tickers } = useSelector((state: RootState) => state.marketData);
  const currentTicker = tickers[symbol];

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Simulate chart loading
    const loadChart = async () => {
      setIsLoading(true);
      setChartError(null);
      
      try {
        // In a real implementation, this would initialize TradingView widget
        // For now, we'll simulate the loading process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (!isConnected) {
          throw new Error('No connection to live data feeds');
        }
        
        setIsLoading(false);
      } catch (error) {
        setChartError(error instanceof Error ? error.message : 'Failed to load chart');
        setIsLoading(false);
      }
    };

    loadChart();
  }, [symbol, interval, isConnected]);

  const handleFullscreenToggle = () => {
    const newFullscreenState = !isFullscreen;
    setIsFullscreen(newFullscreenState);
    onFullscreenToggle?.(newFullscreenState);
  };

  const formatPrice = (price: number): string => {
    if (price >= 1000) {
      return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (price >= 1) {
      return price.toFixed(4);
    } else {
      return price.toFixed(6);
    }
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ height: '100%', p: 2 }}>
        {/* Chart Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h6" display="flex" alignItems="center" gap={1}>
              <TrendingUp color="primary" />
              {symbol.replace('USDT', '/USDT')} Chart
            </Typography>
            
            {currentTicker && (
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h6" fontWeight="bold">
                  ${formatPrice(currentTicker.price)}
                </Typography>
                <Chip
                  label={`${currentTicker.changePercent24h >= 0 ? '+' : ''}${currentTicker.changePercent24h.toFixed(2)}%`}
                  color={currentTicker.changePercent24h >= 0 ? 'success' : 'error'}
                  size="small"
                />
              </Box>
            )}
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <LiveDataIndicator variant="chip" />
            <PaperTradingIndicator variant="chip" size="small" />
            
            <Tooltip title="Refresh chart data">
              <IconButton size="small">
                <Refresh />
              </IconButton>
            </Tooltip>
            
            <Tooltip title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
              <IconButton size="small" onClick={handleFullscreenToggle}>
                {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Live Data Source Alert */}
        <Alert
          severity="info"
          icon={<LiveTv />}
          sx={{ mb: 2, backgroundColor: 'rgba(33, 150, 243, 0.1)' }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="body2">
              <strong>LIVE MAINNET DATA:</strong> Real-time candlestick data from exchanges
            </Typography>
            <PaperTradingIndicator variant="inline" />
          </Box>
        </Alert>

        {/* Chart Container */}
        <Box
          ref={chartContainerRef}
          sx={{
            height: height - 120, // Account for header and alerts
            width: '100%',
            position: 'relative',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            backgroundColor: 'background.paper',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isLoading ? (
            <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">
                Loading live chart data...
              </Typography>
            </Box>
          ) : chartError ? (
            <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
              <Alert severity="error" sx={{ maxWidth: 400 }}>
                <Typography variant="body2">
                  {chartError}
                </Typography>
              </Alert>
              <Typography variant="caption" color="text.secondary">
                Chart will retry connection automatically
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              {/* Placeholder for TradingView Widget */}
              <Box textAlign="center" color="white">
                <Typography variant="h6" gutterBottom>
                  TradingView Chart
                </Typography>
                <Typography variant="body2" gutterBottom>
                  {symbol} • {interval} • Live Data
                </Typography>
                <Box display="flex" justifyContent="center" gap={1} mt={2}>
                  <Chip
                    label="LIVE DATA"
                    color="success"
                    size="small"
                    variant="filled"
                  />
                  <Chip
                    label="PAPER TRADING"
                    color="warning"
                    size="small"
                    variant="filled"
                  />
                </Box>
              </Box>

              {/* Connection Status Overlay */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  display: 'flex',
                  gap: 1,
                }}
              >
                <LiveDataIndicator variant="minimal" />
              </Box>

              {/* Paper Trading Overlay */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                }}
              >
                <Chip
                  icon={<Security />}
                  label="PAPER"
                  color="warning"
                  size="small"
                  variant="filled"
                />
              </Box>
            </Box>
          )}
        </Box>

        {/* Chart Footer */}
        <Box display="flex" justifyContent="between" alignItems="center" mt={1}>
          <Typography variant="caption" color="text.secondary">
            Timeframe: {interval} • Symbol: {symbol}
          </Typography>
          <Typography variant="caption" color="warning.main" fontWeight="bold">
            PAPER TRADING MODE - NO REAL MONEY AT RISK
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default EnhancedTradingViewChart;