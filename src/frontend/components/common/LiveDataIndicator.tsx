import React from 'react';
import {
  Box,
  Chip,
  Typography,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Wifi,
  WifiOff,
  TrendingUp,
  Update,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';

interface LiveDataIndicatorProps {
  variant?: 'chip' | 'detailed' | 'minimal';
  showLastUpdate?: boolean;
}

const LiveDataIndicator: React.FC<LiveDataIndicatorProps> = ({
  variant = 'chip',
  showLastUpdate = true
}) => {
  const { isConnected, lastUpdate } = useSelector((state: RootState) => state.marketData);

  const getLastUpdateText = (): string => {
    if (!lastUpdate) return 'Never';
    const now = Date.now();
    const diff = now - lastUpdate;
    if (diff < 1000) return 'Just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  const getConnectionStatus = () => {
    if (isConnected) {
      return {
        label: 'LIVE MAINNET DATA',
        color: 'success' as const,
        icon: <TrendingUp />,
        tooltip: 'Connected to live exchange data feeds'
      };
    } else {
      return {
        label: 'DISCONNECTED',
        color: 'error' as const,
        icon: <WifiOff />,
        tooltip: 'Disconnected from exchange data feeds'
      };
    }
  };

  const status = getConnectionStatus();

  if (variant === 'minimal') {
    return (
      <Tooltip title={status.tooltip}>
        <Box display="flex" alignItems="center" gap={0.5}>
          {status.icon}
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: isConnected ? 'success.main' : 'error.main',
              animation: isConnected ? 'pulse 2s infinite' : 'none',
              '@keyframes pulse': {
                '0%': { opacity: 1 },
                '50%': { opacity: 0.5 },
                '100%': { opacity: 1 },
              },
            }}
          />
        </Box>
      </Tooltip>
    );
  }

  if (variant === 'detailed') {
    return (
      <Box
        sx={{
          p: 2,
          border: 1,
          borderColor: isConnected ? 'success.main' : 'error.main',
          borderRadius: 1,
          backgroundColor: isConnected ? 'success.light' : 'error.light',
          opacity: 0.9,
        }}
      >
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          {status.icon}
          <Typography variant="subtitle2" fontWeight="bold">
            {status.label}
          </Typography>
        </Box>
        
        <Typography variant="caption" display="block" gutterBottom>
          Real-time market data from Binance & KuCoin
        </Typography>
        
        {showLastUpdate && (
          <Box display="flex" alignItems="center" gap={0.5}>
            <Update fontSize="small" />
            <Typography variant="caption">
              Last update: {getLastUpdateText()}
            </Typography>
          </Box>
        )}
      </Box>
    );
  }

  // Chip variant (default)
  return (
    <Tooltip title={`${status.tooltip} - Last update: ${getLastUpdateText()}`}>
      <Chip
        icon={isConnected ? status.icon : <CircularProgress size={16} />}
        label={status.label}
        color={status.color}
        variant="filled"
        size="small"
        sx={{
          fontWeight: 'bold',
          animation: isConnected ? 'pulse 3s infinite' : 'none',
          '@keyframes pulse': {
            '0%': { opacity: 1 },
            '50%': { opacity: 0.8 },
            '100%': { opacity: 1 },
          },
        }}
      />
    </Tooltip>
  );
};

export default LiveDataIndicator;