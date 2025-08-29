import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Fullscreen,
  FullscreenExit,
  Refresh,
  TrendingUp,
  Security,
  LiveTv,
  ShowChart,
  Timeline,
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { setSelectedSymbol, setSelectedTimeframe } from '../../store/slices/marketDataSlice';
import PaperTradingIndicator from '../common/PaperTradingIndicator';
import LiveDataIndicator from '../common/LiveDataIndicator';
import { useWebSocket } from '../../hooks/useWebSocket';

interface RealTimeChartProps {
  symbol?: string;
  timeframe?: string;
  height?: number;
  showControls?: boolean;
  showTechnicalIndicators?: boolean;
  onFullscreenToggle?: (isFullscreen: boolean) => void;
}

interface TechnicalIndicator {
  name: string;
  enabled: boolean;
  color: string;
  values?: number[];
}

const AVAILABLE_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT',
  'LTCUSDT', 'BCHUSDT', 'XLMUSDT', 'EOSUSDT', 'TRXUSDT'
];

const TIMEFRAMES = [
  { value: '1m', label: '1 Minute' },
  { value: '5m', label: '5 Minutes' },
  { value: '15m', label: '15 Minutes' },
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hours' },
  { value: '1d', label: '1 Day' },
];

const RealTimeChart: React.FC<RealTimeChartProps> = ({
  symbol: propSymbol,
  timeframe: propTimeframe,
  height = 500,
  showControls = true,
  showTechnicalIndicators = true,
  onFullscreenToggle
}) => {
  const dispatch = useDispatch();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  
  // Technical indicators state
  const [technicalIndicators, setTechnicalIndicators] = useState<Record<string, TechnicalIndicator>>({
    rsi: { name: 'RSI', enabled: false, color: '#ff9800' },
    macd: { name: 'MACD', enabled: false, color: '#2196f3' },
    bollinger: { name: 'Bollinger Bands', enabled: false, color: '#9c27b0' },
    sma20: { name: 'SMA 20', enabled: false, color: '#4caf50' },
    ema50: { name: 'EMA 50', enabled: false, color: '#f44336' },
  });

  const { 
    isConnected, 
    tickers, 
    candles, 
    selectedSymbol, 
    selectedTimeframe 
  } = useSelector((state: RootState) => state.marketData);
  
  const { emit } = useWebSocket(true);

  // Use props or store values
  const currentSymbol = propSymbol || selectedSymbol;
  const currentTimeframe = propTimeframe || selectedTimeframe;
  const currentTicker = tickers[currentSymbol];
  const candleKey = `${currentSymbol}_${currentTimeframe}`;
  const currentCandles = candles[candleKey] || [];

  // Subscribe to real-time data when symbol or timeframe changes
  useEffect(() => {
    if (isConnected && emit) {
      // Subscribe to ticker updates
      emit('subscribe', { symbols: [currentSymbol] });
      
      // Request candle data
      emit('getCandles', { 
        symbol: currentSymbol, 
        timeframe: currentTimeframe,
        limit: 100 
      });
      
      setIsLoading(false);
      setChartError(null);
    } else if (!isConnected) {
      setChartError('No connection to live data feeds');
    }

    return () => {
      if (emit) {
        emit('unsubscribe', { symbols: [currentSymbol] });
      }
    };
  }, [currentSymbol, currentTimeframe, isConnected, emit]);

  // Update chart when new data arrives
  useEffect(() => {
    if (currentCandles.length > 0 && canvasRef.current) {
      drawChart();
      setLastUpdate(Date.now());
    }
  }, [currentCandles, currentTicker, technicalIndicators]);

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || currentCandles.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Chart dimensions
    const padding = 40;
    const chartWidth = rect.width - padding * 2;
    const chartHeight = rect.height - padding * 2;

    // Calculate price range
    const prices = currentCandles.flatMap(candle => [candle.high, candle.low]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;

    // Draw background grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    
    // Horizontal grid lines
    for (let i = 0; i <= 10; i++) {
      const y = padding + (chartHeight / 10) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + chartWidth, y);
      ctx.stroke();
    }

    // Vertical grid lines
    const candleWidth = chartWidth / currentCandles.length;
    for (let i = 0; i < currentCandles.length; i += Math.ceil(currentCandles.length / 10)) {
      const x = padding + candleWidth * i;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, padding + chartHeight);
      ctx.stroke();
    }

    // Draw candlesticks
    currentCandles.forEach((candle, index) => {
      const x = padding + candleWidth * index;
      const centerX = x + candleWidth / 2;

      // Calculate y positions
      const highY = padding + ((maxPrice - candle.high) / priceRange) * chartHeight;
      const lowY = padding + ((maxPrice - candle.low) / priceRange) * chartHeight;
      const openY = padding + ((maxPrice - candle.open) / priceRange) * chartHeight;
      const closeY = padding + ((maxPrice - candle.close) / priceRange) * chartHeight;

      // Determine candle color
      const isGreen = candle.close > candle.open;
      ctx.fillStyle = isGreen ? '#4caf50' : '#f44336';
      ctx.strokeStyle = isGreen ? '#4caf50' : '#f44336';

      // Draw wick
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX, highY);
      ctx.lineTo(centerX, lowY);
      ctx.stroke();

      // Draw body
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.abs(closeY - openY);
      const bodyWidth = candleWidth * 0.8;
      
      ctx.fillRect(centerX - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
    });

    // Draw technical indicators if enabled
    Object.entries(technicalIndicators).forEach(([key, indicator]) => {
      if (indicator.enabled && indicator.values) {
        drawTechnicalIndicator(ctx, indicator, padding, chartWidth, chartHeight, minPrice, maxPrice, priceRange);
      }
    });

    // Draw price labels
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    
    for (let i = 0; i <= 5; i++) {
      const price = maxPrice - (priceRange / 5) * i;
      const y = padding + (chartHeight / 5) * i;
      ctx.fillText(price.toFixed(4), padding - 5, y + 4);
    }

    // Draw current price line if we have ticker data
    if (currentTicker) {
      const currentPriceY = padding + ((maxPrice - currentTicker.price) / priceRange) * chartHeight;
      
      ctx.strokeStyle = currentTicker.changePercent24h >= 0 ? '#4caf50' : '#f44336';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      
      ctx.beginPath();
      ctx.moveTo(padding, currentPriceY);
      ctx.lineTo(padding + chartWidth, currentPriceY);
      ctx.stroke();
      
      ctx.setLineDash([]);
      
      // Price label
      ctx.fillStyle = currentTicker.changePercent24h >= 0 ? '#4caf50' : '#f44336';
      ctx.fillRect(padding + chartWidth + 5, currentPriceY - 10, 80, 20);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(currentTicker.price.toFixed(4), padding + chartWidth + 10, currentPriceY + 4);
    }
  }, [currentCandles, currentTicker, technicalIndicators]);

  const drawTechnicalIndicator = (
    ctx: CanvasRenderingContext2D,
    indicator: TechnicalIndicator,
    padding: number,
    chartWidth: number,
    chartHeight: number,
    minPrice: number,
    maxPrice: number,
    priceRange: number
  ) => {
    if (!indicator.values || indicator.values.length === 0) return;

    ctx.strokeStyle = indicator.color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const candleWidth = chartWidth / currentCandles.length;

    indicator.values.forEach((value, index) => {
      if (value !== null && value !== undefined) {
        const x = padding + candleWidth * index + candleWidth / 2;
        const y = padding + ((maxPrice - value) / priceRange) * chartHeight;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
    });

    ctx.stroke();
  };

  const handleSymbolChange = (newSymbol: string) => {
    if (!propSymbol) {
      dispatch(setSelectedSymbol(newSymbol));
    }
  };

  const handleTimeframeChange = (newTimeframe: string) => {
    if (!propTimeframe) {
      dispatch(setSelectedTimeframe(newTimeframe));
    }
  };

  const handleFullscreenToggle = () => {
    const newFullscreenState = !isFullscreen;
    setIsFullscreen(newFullscreenState);
    onFullscreenToggle?.(newFullscreenState);
  };

  const handleRefresh = () => {
    if (emit) {
      emit('getCandles', { 
        symbol: currentSymbol, 
        timeframe: currentTimeframe,
        limit: 100 
      });
    }
  };

  const toggleTechnicalIndicator = (indicatorKey: string) => {
    setTechnicalIndicators(prev => ({
      ...prev,
      [indicatorKey]: {
        ...prev[indicatorKey],
        enabled: !prev[indicatorKey].enabled
      }
    }));
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
              <ShowChart color="primary" />
              Real-Time Chart
            </Typography>
            
            {showControls && (
              <Box display="flex" gap={1}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Symbol</InputLabel>
                  <Select
                    value={currentSymbol}
                    label="Symbol"
                    onChange={(e) => handleSymbolChange(e.target.value)}
                  >
                    {AVAILABLE_SYMBOLS.map(sym => (
                      <MenuItem key={sym} value={sym}>
                        {sym.replace('USDT', '/USDT')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Timeframe</InputLabel>
                  <Select
                    value={currentTimeframe}
                    label="Timeframe"
                    onChange={(e) => handleTimeframeChange(e.target.value)}
                  >
                    {TIMEFRAMES.map(tf => (
                      <MenuItem key={tf.value} value={tf.value}>
                        {tf.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}
            
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
              <IconButton size="small" onClick={handleRefresh}>
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

        {/* Technical Indicators Controls */}
        {showTechnicalIndicators && (
          <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
            {Object.entries(technicalIndicators).map(([key, indicator]) => (
              <FormControlLabel
                key={key}
                control={
                  <Switch
                    size="small"
                    checked={indicator.enabled}
                    onChange={() => toggleTechnicalIndicator(key)}
                    sx={{
                      '& .MuiSwitch-thumb': {
                        backgroundColor: indicator.enabled ? indicator.color : undefined
                      }
                    }}
                  />
                }
                label={
                  <Typography variant="caption" sx={{ color: indicator.enabled ? indicator.color : 'text.secondary' }}>
                    {indicator.name}
                  </Typography>
                }
              />
            ))}
          </Box>
        )}

        {/* Live Data Status Alert */}
        <Alert
          severity={isConnected ? "success" : "warning"}
          icon={<LiveTv />}
          sx={{ mb: 2, backgroundColor: isConnected ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 152, 0, 0.1)' }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="body2">
              <strong>{isConnected ? 'LIVE DATA CONNECTED:' : 'CONNECTION ISSUE:'}</strong> 
              {isConnected 
                ? ` Real-time data from exchanges • Last update: ${new Date(lastUpdate).toLocaleTimeString()}`
                : ' Attempting to reconnect to live data feeds'
              }
            </Typography>
            <PaperTradingIndicator variant="inline" />
          </Box>
        </Alert>

        {/* Chart Container */}
        <Box
          ref={chartContainerRef}
          sx={{
            height: height - 200, // Account for header, controls, and alerts
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
                Loading real-time chart data...
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
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                height: '100%',
                cursor: 'crosshair'
              }}
            />
          )}

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

        {/* Chart Footer */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
          <Typography variant="caption" color="text.secondary">
            {currentSymbol} • {currentTimeframe} • {currentCandles.length} candles • Live updates every second
          </Typography>
          <Typography variant="caption" color="warning.main" fontWeight="bold">
            PAPER TRADING MODE - NO REAL MONEY AT RISK
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default RealTimeChart;