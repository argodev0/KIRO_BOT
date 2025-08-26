import React from 'react';
import {
  Box,
  Chip,
  Alert,
  Typography,
  Tooltip,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  Warning,
  Security,
  ExpandMore,
  ExpandLess,
  Info,
} from '@mui/icons-material';

interface PaperTradingIndicatorProps {
  variant?: 'chip' | 'banner' | 'inline';
  showDetails?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const PaperTradingIndicator: React.FC<PaperTradingIndicatorProps> = ({
  variant = 'chip',
  showDetails = false,
  size = 'medium'
}) => {
  const [expanded, setExpanded] = React.useState(false);

  const handleToggleExpanded = () => {
    setExpanded(!expanded);
  };

  if (variant === 'chip') {
    return (
      <Tooltip title="This is a paper trading environment - no real money is at risk">
        <Chip
          icon={<Security />}
          label="PAPER TRADING"
          color="warning"
          variant="filled"
          size={size === 'large' ? 'medium' : 'small'}
          sx={{
            fontWeight: 'bold',
            animation: 'pulse 2s infinite',
            '@keyframes pulse': {
              '0%': { opacity: 1 },
              '50%': { opacity: 0.7 },
              '100%': { opacity: 1 },
            },
          }}
        />
      </Tooltip>
    );
  }

  if (variant === 'banner') {
    return (
      <Alert
        severity="warning"
        icon={<Security />}
        action={
          showDetails && (
            <IconButton
              color="inherit"
              size="small"
              onClick={handleToggleExpanded}
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          )
        }
        sx={{
          mb: 2,
          '& .MuiAlert-message': {
            width: '100%',
          },
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle1" fontWeight="bold">
            PAPER TRADING MODE ACTIVE
          </Typography>
          <Typography variant="body2">
            All trades are simulated - No real money at risk
          </Typography>
        </Box>
        
        {showDetails && (
          <Collapse in={expanded}>
            <Box mt={2} p={2} bgcolor="rgba(255, 152, 0, 0.1)" borderRadius={1}>
              <Typography variant="body2" gutterBottom>
                <strong>Paper Trading Safety Features:</strong>
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>All trading operations are simulated</li>
                <li>Virtual portfolio with simulated balances</li>
                <li>Real market data from live exchanges</li>
                <li>No API keys with trading permissions allowed</li>
                <li>All trades are clearly marked as paper trades</li>
              </ul>
            </Box>
          </Collapse>
        )}
      </Alert>
    );
  }

  // Inline variant
  return (
    <Box display="flex" alignItems="center" gap={1}>
      <Warning color="warning" fontSize="small" />
      <Typography
        variant="caption"
        color="warning.main"
        fontWeight="bold"
        sx={{ textTransform: 'uppercase' }}
      >
        Paper Trading Mode
      </Typography>
      {showDetails && (
        <Tooltip title="Click for more information about paper trading">
          <IconButton size="small" onClick={handleToggleExpanded}>
            <Info fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

export default PaperTradingIndicator;