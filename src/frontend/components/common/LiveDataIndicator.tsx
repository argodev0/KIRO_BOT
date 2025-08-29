import React from 'react';
import {
  Box,
  Chip,
  Typography,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  LiveTv,
  SignalWifiOff,
  SignalWifi4Bar,
  Warning,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';

interface LiveDataIndicatorProps {
  variant?: 'chip' | 'minimal' | 'inline' | 'detailed';
  size?: 'small' | 'medium';
  showLabel?: boolean;
}

const LiveDataIndicator: React.FC<LiveDataIndicatorProps> = ({
  variant = 'chip',
  size = 'small',
  showLabel = true
}) => {
  const { isConnected, lastUpdate } = useSelector((state: RootState) => state.marketData);
  
  const getConnectionStatus = () => {
    if (!isConnected) {
      return {
        status: 'disconnected',
        color: 'error' as const,
        icon: <SignalWifiOff />,
        label: 'OFFLINE',
        description: 'No connection to live data feeds'
      };
    }
    
    const timeSinceUpdate = Date.now() - lastUpdate;
    
    if (timeSinceUpdate > 30000) { // 30 seconds
      return {
        status: 'stale',
        color: 'warning' as const,
        icon: <Warning />,
        label: 'STALE',
        description: 'Data may be outdated'
      };
    }
    
    return {
      status: 'connected',
      color: 'success' as const,
      icon: <SignalWifi4Bar />,
      label: 'LIVE',
      description: 'Real-time data active'
    };
  };

  const connectionInfo = getConnectionStatus();

  if (variant === 'minimal') {
    return (
      <Tooltip title={connectionInfo.description}>
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: connectionInfo.color === 'success' ? '#4caf50' : 
                           connectionInfo.color === 'warning' ? '#ff9800' : '#f44336',
            animation: connectionInfo.status === 'connected' ? 'pulse 2s infinite' : 'none',
            '@keyframes pulse': {
              '0%': { opacity: 1 },
              '50%': { opacity: 0.5 },
              '100%': { opacity: 1 },
            },
          }}
        />
      </Tooltip>
    );
  }

  if (variant === 'inline') {
    return (
      <Box display="flex" alignItems="center" gap={0.5}>
        {connectionInfo.icon}
        <Typography variant="caption" color={`${connectionInfo.color}.main`} fontWeight="bold">
          {connectionInfo.label}
        </Typography>
      </Box>
    );
  }

  if (variant === 'detailed') {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.5,
            borderRadius: 1,
            backgroundColor: `${connectionInfo.color}.light`,
            color: `${connectionInfo.color}.contrastText`,
          }}
        >
          {connectionInfo.status === 'connected' && (
            <CircularProgress size={12} color="inherit" />
          )}
          {connectionInfo.icon}
          <Typography variant="caption" fontWeight="bold">
            {connectionInfo.label}
          </Typography>
        </Box>
        
        <Typography variant="caption" color="text.secondary">
          {connectionInfo.description}
          {isConnected && lastUpdate && (
            <> • Last: {new Date(lastUpdate).toLocaleTimeString()}</>
          )}
        </Typography>
      </Box>
    );
  }

  // Default chip variant
  return (
    <Tooltip title={connectionInfo.description}>
      <Chip
        icon={connectionInfo.icon}
        label={showLabel ? connectionInfo.label : undefined}
        color={connectionInfo.color}
        size={size}
        variant="filled"
        sx={{
          animation: connectionInfo.status === 'connected' ? 'pulse 2s infinite' : 'none',
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