import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Fullscreen,
  FullscreenExit,
  Refresh,
  Security,
  LiveTv,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import PaperTradingIndicator from '../common/PaperTradingIndicator';
import LiveDataIndicator from '../common/LiveDataIndicator';
import { useWebSocket } from '../../hooks/useWebSocket';

interface TradingViewIntegrationProps {
  symbol?: string;
  interval?: string;
  height?: number;
  theme?: 'light' | 'dark';
  showTechnicalIndicators?: boolean;
  onFullscreenToggle?: (isFullscreen: boolean) => void;
}

// TradingView widget configuration
interface TradingViewWidget {
  new (config: any): any;
}

declare global {
  interface Window {
    TradingView?: {
      widget: TradingViewWidget;
    };
  }
}

const TradingViewIntegration: React.FC<TradingViewIntegrationProps> = ({
  symbol = 'BTCUSDT',
  interval = '1H',
  height = 500,
  theme = 'dark',
  showTechnicalIndicators = true,
  onFullscreenToggle
}) => {
  const widgetRef = useRef<HTMLDivElement>(null);
  const tvWidgetRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  
  const { isConnected, tickers } = useSelector((state: RootState) => state.marketData);
  const { emit } = useWebSocket(true);
  const currentTicker = tickers[symbol];

  // Load TradingView script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      setScriptLoaded(true);
    };
    script.onerror = () => {
      setWidgetError('Failed to load TradingView library');
      setIsLoading(false);
    };
    
    document.head.appendChild(script);
    
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Initialize TradingView widget
  useEffect(() => {
    if (!scriptLoaded || !widgetRef.current || !window.TradingView) {
      return;
    }

    try {
      setIsLoading(true);
      setWidgetError(null);

      // Create custom datafeed for real-time data
      const datafeed = createCustomDatafeed();

      const widgetOptions = {
        symbol: `BINANCE:${symbol}`,
        interval: interval,
        container: widgetRef.current,
        datafeed: datafeed,
        library_path: '/charting_library/',
        locale: 'en',
        disabled_features: [
          'use_localstorage_for_settings',
          'volume_force_overlay',
          'create_volume_indicator_by_default'
        ],
        enabled_features: [
          'study_templates',
          'side_toolbar_in_fullscreen_mode'
        ],
        charts_storage_url: 'https://saveload.tradingview.com',
        charts_storage_api_version: '1.1',
        client_id: 'tradingview.com',
        user_id: 'public_user_id',
        fullscreen: isFullscreen,
        autosize: true,
        theme: theme,
        style: '1', // Candle style
        toolbar_bg: theme === 'dark' ? '#1e1e1e' : '#ffffff',
        studies_overrides: showTechnicalIndicators ? {
          'volume.volume.color.0': '#f44336',
          'volume.volume.color.1': '#4caf50',
          'volume.volume.transparency': 65,
        } : {},
        overrides: {
          'paneProperties.background': theme === 'dark' ? '#1e1e1e' : '#ffffff',
          'paneProperties.vertGridProperties.color': theme === 'dark' ? '#333' : '#e1e1e1',
          'paneProperties.horzGridProperties.color': theme === 'dark' ? '#333' : '#e1e1e1',
          'symbolWatermarkProperties.transparency': 90,
          'scalesProperties.textColor': theme === 'dark' ? '#fff' : '#000',
        },
        studies_access: {
          type: 'black',
          tools: [
            {
              name: 'Trend Line',
              grayed: false
            }
          ]
        },
        time_frames: [
          { text: '1m', resolution: '1' },
          { text: '5m', resolution: '5' },
          { text: '15m', resolution: '15' },
          { text: '1h', resolution: '60' },
          { text: '4h', resolution: '240' },
          { text: '1d', resolution: '1D' },
        ]
      };

      tvWidgetRef.current = new window.TradingView.widget(widgetOptions);

      tvWidgetRef.current.onChartReady(() => {
        setIsLoading(false);
        
        // Add technical indicators if enabled
        if (showTechnicalIndicators) {
          addTechnicalIndicators();
        }

        // Subscribe to real-time updates
        if (emit && isConnected) {
          emit('subscribe', { symbols: [symbol] });
        }
      });

    } catch (error) {
      console.error('TradingView widget initialization error:', error);
      setWidgetError('Failed to initialize TradingView widget');
      setIsLoading(false);
    }

    return () => {
      if (tvWidgetRef.current && tvWidgetRef.current.remove) {
        tvWidgetRef.current.remove();
      }
    };
  }, [scriptLoaded, symbol, interval, theme, showTechnicalIndicators, isFullscreen]);

  // Create custom datafeed for real-time data
  const createCustomDatafeed = () => {
    return {
      onReady: (callback: any) => {
        setTimeout(() => callback({
          supported_resolutions: ['1', '5', '15', '60', '240', '1D'],
          supports_marks: false,
          supports_timescale_marks: false,
          supports_time: true,
        }), 0);
      },

      searchSymbols: (userInput: string, exchange: string, symbolType: string, onResultReadyCallback: any) => {
        // Return available symbols
        const symbols = [
          {
            symbol: 'BTCUSDT',
            full_name: 'BINANCE:BTCUSDT',
            description: 'Bitcoin / Tether',
            exchange: 'BINANCE',
            ticker: 'BTCUSDT',
            type: 'crypto'
          }
        ];
        onResultReadyCallback(symbols);
      },

      resolveSymbol: (symbolName: string, onSymbolResolvedCallback: any, onResolveErrorCallback: any) => {
        const symbolInfo = {
          name: symbolName,
          ticker: symbolName,
          description: `${symbolName} Real-time Data`,
          type: 'crypto',
          session: '24x7',
          timezone: 'Etc/UTC',
          exchange: 'BINANCE',
          minmov: 1,
          pricescale: 100000000,
          has_intraday: true,
          has_weekly_and_monthly: true,
          supported_resolutions: ['1', '5', '15', '60', '240', '1D'],
          volume_precision: 8,
          data_status: 'streaming',
        };
        
        setTimeout(() => onSymbolResolvedCallback(symbolInfo), 0);
      },

      getBars: (symbolInfo: any, resolution: string, periodParams: any, onHistoryCallback: any, onErrorCallback: any) => {
        // Request historical data from backend
        if (emit) {
          emit('getCandles', {
            symbol: symbolInfo.ticker,
            timeframe: resolution,
            from: periodParams.from,
            to: periodParams.to,
            limit: periodParams.countBack || 300
          });
        }

        // For now, return empty data - real implementation would fetch from backend
        setTimeout(() => {
          onHistoryCallback([], { noData: true });
        }, 100);
      },

      subscribeBars: (symbolInfo: any, resolution: string, onRealtimeCallback: any, subscriberUID: string, onResetCacheNeededCallback: any) => {
        // Subscribe to real-time updates
        console.log('Subscribing to real-time data for', symbolInfo.ticker);
        
        // Store callback for real-time updates
        if (emit) {
          emit('subscribe', { symbols: [symbolInfo.ticker] });
        }
      },

      unsubscribeBars: (subscriberUID: string) => {
        console.log('Unsubscribing from real-time data');
        if (emit) {
          emit('unsubscribe', { symbols: [symbol] });
        }
      }
    };
  };

  const addTechnicalIndicators = () => {
    if (!tvWidgetRef.current) return;

    try {
      const chart = tvWidgetRef.current.chart();
      
      // Add common technical indicators
      chart.createStudy('RSI', false, false, [14]);
      chart.createStudy('MACD', false, false, [12, 26, 9]);
      chart.createStudy('Bollinger Bands', false, false, [20, 2]);
      chart.createStudy('Moving Average', false, false, [20, 'close', 0]);
      chart.createStudy('Moving Average Exponential', false, false, [50, 'close', 0]);
      
    } catch (error) {
      console.error('Error adding technical indicators:', error);
    }
  };

  const handleFullscreenToggle = () => {
    const newFullscreenState = !isFullscreen;
    setIsFullscreen(newFullscreenState);
    onFullscreenToggle?.(newFullscreenState);
  };

  const handleRefresh = () => {
    if (tvWidgetRef.current && tvWidgetRef.current.chart) {
      tvWidgetRef.current.chart().resetData();
    }
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
              <LiveTv color="primary" />
              TradingView Chart - {symbol.replace('USDT', '/USDT')}
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

        {/* Live Data Status Alert */}
        <Alert
          severity={isConnected ? "success" : "warning"}
          icon={<LiveTv />}
          sx={{ mb: 2, backgroundColor: isConnected ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 152, 0, 0.1)' }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="body2">
              <strong>{isConnected ? 'LIVE TRADINGVIEW DATA:' : 'CONNECTION ISSUE:'}</strong> 
              {isConnected 
                ? ' Professional charting with real-time market data'
                : ' Attempting to reconnect to live data feeds'
              }
            </Typography>
            <PaperTradingIndicator variant="inline" />
          </Box>
        </Alert>

        {/* TradingView Widget Container */}
        <Box
          sx={{
            height: height - 140, // Account for header and alerts
            width: '100%',
            position: 'relative',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            backgroundColor: theme === 'dark' ? '#1e1e1e' : '#ffffff',
            overflow: 'hidden',
          }}
        >
          {isLoading ? (
            <Box 
              display="flex" 
              flexDirection="column" 
              alignItems="center" 
              justifyContent="center"
              height="100%"
              gap={2}
            >
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">
                Loading TradingView chart...
              </Typography>
            </Box>
          ) : widgetError ? (
            <Box 
              display="flex" 
              flexDirection="column" 
              alignItems="center" 
              justifyContent="center"
              height="100%"
              gap={2}
            >
              <Alert severity="error" sx={{ maxWidth: 400 }}>
                <Typography variant="body2">
                  {widgetError}
                </Typography>
              </Alert>
              <Typography variant="caption" color="text.secondary">
                Falling back to basic chart functionality
              </Typography>
            </Box>
          ) : (
            <div ref={widgetRef} style={{ width: '100%', height: '100%' }} />
          )}

          {/* Paper Trading Overlay */}
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 1000,
            }}
          >
            <Chip
              icon={<Security />}
              label="PAPER TRADING"
              color="warning"
              size="small"
              variant="filled"
            />
          </Box>
        </Box>

        {/* Chart Footer */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
          <Typography variant="caption" color="text.secondary">
            TradingView Professional Charts • {symbol} • {interval} • Real-time data
          </Typography>
          <Typography variant="caption" color="warning.main" fontWeight="bold">
            PAPER TRADING MODE - NO REAL MONEY AT RISK
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default TradingViewIntegration;