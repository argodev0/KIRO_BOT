import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid2 as Grid,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Refresh,
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { setSelectedSymbol } from '../../store/slices/marketDataSlice';

interface MarketDataWidgetProps {
  symbols?: string[];
}

const MarketDataWidget: React.FC<MarketDataWidgetProps> = ({
  symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT']
}) => {
  const dispatch = useDispatch();
  const { tickers, selectedSymbol, isConnected, lastUpdate } = useSelector(
    (state: RootState) => state.marketData
  );

  const formatPrice = (price: number): string => {
    if (price >= 1000) {
      return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (price >= 1) {
      return price.toFixed(4);
    } else {
      return price.toFixed(6);
    }
  };

  const formatVolume = (volume: number): string => {
    if (volume >= 1e9) {
      return `${(volume / 1e9).toFixed(2)}B`;
    } else if (volume >= 1e6) {
      return `${(volume / 1e6).toFixed(2)}M`;
    } else if (volume >= 1e3) {
      return `${(volume / 1e3).toFixed(2)}K`;
    }
    return volume.toFixed(2);
  };

  const getTrendIcon = (changePercent: number) => {
    if (changePercent > 0.1) return <TrendingUp color="success" />;
    if (changePercent < -0.1) return <TrendingDown color="error" />;
    return <TrendingFlat color="disabled" />;
  };

  const getTrendColor = (changePercent: number): 'success' | 'error' | 'default' => {
    if (changePercent > 0) return 'success';
    if (changePercent < 0) return 'error';
    return 'default';
  };

  const handleSymbolSelect = (symbol: string) => {
    dispatch(setSelectedSymbol(symbol));
  };

  const getLastUpdateText = (): string => {
    if (!lastUpdate) return 'Never';
    const now = Date.now();
    const diff = now - lastUpdate;
    if (diff < 1000) return 'Just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Market Data</Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip
              label={isConnected ? 'Connected' : 'Disconnected'}
              color={isConnected ? 'success' : 'error'}
              size="small"
            />
            <Tooltip title={`Last update: ${getLastUpdateText()}`}>
              <IconButton size="small">
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Grid container spacing={2}>
          {symbols.map((symbol) => {
            const ticker = tickers[symbol];
            const isSelected = symbol === selectedSymbol;

            return (
              <Grid xs={12} sm={6} md={4} key={symbol}>
                <Card
                  variant={isSelected ? 'elevation' : 'outlined'}
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: isSelected ? 'action.selected' : 'background.paper',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                  onClick={() => handleSymbolSelect(symbol)}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {symbol.replace('USDT', '/USDT')}
                      </Typography>
                      {ticker && getTrendIcon(ticker.changePercent24h)}
                    </Box>

                    {ticker ? (
                      <>
                        <Typography variant="h6" fontWeight="bold" mb={0.5}>
                          ${formatPrice(ticker.price)}
                        </Typography>
                        
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                          <Chip
                            label={`${ticker.changePercent24h >= 0 ? '+' : ''}${ticker.changePercent24h.toFixed(2)}%`}
                            color={getTrendColor(ticker.changePercent24h)}
                            size="small"
                          />
                          <Typography variant="caption" color="text.secondary">
                            24h
                          </Typography>
                        </Box>

                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                          <Typography variant="caption" color="text.secondary">
                            High:
                          </Typography>
                          <Typography variant="caption">
                            ${formatPrice(ticker.high24h)}
                          </Typography>
                        </Box>

                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                          <Typography variant="caption" color="text.secondary">
                            Low:
                          </Typography>
                          <Typography variant="caption">
                            ${formatPrice(ticker.low24h)}
                          </Typography>
                        </Box>

                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="caption" color="text.secondary">
                            Volume:
                          </Typography>
                          <Typography variant="caption">
                            {formatVolume(ticker.volume24h)}
                          </Typography>
                        </Box>
                      </>
                    ) : (
                      <Box display="flex" alignItems="center" justifyContent="center" py={2}>
                        <Typography variant="body2" color="text.secondary">
                          Loading...
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </CardContent>
    </Card>
  );
};

export default MarketDataWidget;