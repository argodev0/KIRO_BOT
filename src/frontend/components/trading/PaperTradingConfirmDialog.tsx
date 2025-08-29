import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  Chip,
  Divider,
} from '@mui/material';
import {
  Security,
  TrendingUp,
  TrendingDown,
  Warning,
} from '@mui/icons-material';

interface TradeDetails {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  quantity: number;
  price?: number;
  estimatedValue: number;
}

interface PaperTradingConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  tradeDetails: TradeDetails | null;
}

const PaperTradingConfirmDialog: React.FC<PaperTradingConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  tradeDetails
}) => {
  if (!tradeDetails) return null;

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(amount);
  };

  const formatCrypto = (amount: number, symbol: string): string => {
    return `${amount.toFixed(8)} ${symbol.replace('USDT', '')}`;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          border: '2px solid',
          borderColor: 'warning.main',
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" gap={1}>
          <Security color="warning" />
          <Typography variant="h6" fontWeight="bold">
            Confirm Paper Trade
          </Typography>
          <Chip
            label="SIMULATION"
            color="warning"
            size="small"
            variant="filled"
          />
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Safety Warning */}
        <Alert 
          severity="warning" 
          icon={<Warning />}
          sx={{ mb: 3, backgroundColor: 'rgba(255, 152, 0, 0.1)' }}
        >
          <Typography variant="body2" fontWeight="bold">
            PAPER TRADING MODE - NO REAL MONEY INVOLVED
          </Typography>
          <Typography variant="caption">
            This is a simulated trade using live market data for educational purposes only
          </Typography>
        </Alert>

        {/* Trade Details */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Trade Details
          </Typography>
          
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            {tradeDetails.side === 'buy' ? (
              <TrendingUp color="success" fontSize="large" />
            ) : (
              <TrendingDown color="error" fontSize="large" />
            )}
            <Box>
              <Typography variant="h6" color={tradeDetails.side === 'buy' ? 'success.main' : 'error.main'}>
                {tradeDetails.side.toUpperCase()} {tradeDetails.symbol.replace('USDT', '/USDT')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {tradeDetails.type.toUpperCase()} Order
              </Typography>
            </Box>
          </Box>

          <Box sx={{ bgcolor: 'background.default', p: 2, borderRadius: 1 }}>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="body2" color="text.secondary">
                Quantity:
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {formatCrypto(tradeDetails.quantity, tradeDetails.symbol)}
              </Typography>
            </Box>

            {tradeDetails.price && (
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2" color="text.secondary">
                  Price:
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {formatCurrency(tradeDetails.price)}
                </Typography>
              </Box>
            )}

            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="body2" color="text.secondary">
                Estimated Value:
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {formatCurrency(tradeDetails.estimatedValue)}
              </Typography>
            </Box>

            <Divider sx={{ my: 1 }} />

            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Estimated Fees:
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {formatCurrency(tradeDetails.estimatedValue * 0.001)} (0.1%)
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Virtual Portfolio Impact */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Virtual Portfolio Impact
          </Typography>
          <Alert severity="info" sx={{ backgroundColor: 'rgba(33, 150, 243, 0.1)' }}>
            <Typography variant="body2">
              This trade will be executed in your virtual portfolio using simulated funds. 
              Your virtual balance will be updated to reflect this paper trade.
            </Typography>
          </Alert>
        </Box>

        {/* Live Data Notice */}
        <Alert severity="success" sx={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}>
          <Typography variant="body2">
            <strong>Live Market Data:</strong> This simulation uses real-time market prices 
            and conditions for accurate paper trading experience.
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          size="large"
          sx={{ minWidth: 120 }}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="warning"
          size="large"
          startIcon={<Security />}
          sx={{ minWidth: 160 }}
        >
          Execute Paper Trade
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaperTradingConfirmDialog;