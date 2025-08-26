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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Security,
  Warning,
  CheckCircle,
  TrendingUp,
  AccountBalance,
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
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatQuantity = (quantity: number): string => {
    return quantity.toFixed(6);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          border: 2,
          borderColor: 'warning.main',
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Security color="warning" />
          <Typography variant="h6" fontWeight="bold">
            Confirm Paper Trade
          </Typography>
          <Chip
            label="VIRTUAL TRADE"
            color="warning"
            size="small"
            variant="filled"
          />
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Paper Trading Warning */}
        <Alert
          severity="warning"
          icon={<Security />}
          sx={{ mb: 3, backgroundColor: 'rgba(255, 152, 0, 0.1)' }}
        >
          <Typography variant="body2" fontWeight="bold">
            PAPER TRADING MODE ACTIVE
          </Typography>
          <Typography variant="body2">
            This is a simulated trade. No real money will be used or at risk.
          </Typography>
        </Alert>

        {/* Trade Details */}
        <Box mb={3}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Trade Details
          </Typography>
          
          <List dense>
            <ListItem>
              <ListItemIcon>
                <TrendingUp color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Symbol"
                secondary={tradeDetails.symbol.replace('USDT', '/USDT')}
              />
            </ListItem>
            
            <ListItem>
              <ListItemText
                primary="Side"
                secondary={
                  <Chip
                    label={tradeDetails.side.toUpperCase()}
                    color={tradeDetails.side === 'buy' ? 'success' : 'error'}
                    size="small"
                  />
                }
              />
            </ListItem>
            
            <ListItem>
              <ListItemText
                primary="Type"
                secondary={tradeDetails.type.toUpperCase()}
              />
            </ListItem>
            
            <ListItem>
              <ListItemText
                primary="Quantity"
                secondary={formatQuantity(tradeDetails.quantity)}
              />
            </ListItem>
            
            {tradeDetails.price && (
              <ListItem>
                <ListItemText
                  primary="Price"
                  secondary={formatCurrency(tradeDetails.price)}
                />
              </ListItem>
            )}
            
            <ListItem>
              <ListItemIcon>
                <AccountBalance color="warning" />
              </ListItemIcon>
              <ListItemText
                primary="Estimated Value (Virtual)"
                secondary={formatCurrency(tradeDetails.estimatedValue)}
              />
            </ListItem>
          </List>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Safety Confirmations */}
        <Box mb={2}>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Paper Trading Safety Confirmations:
          </Typography>
          
          <List dense>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2">
                    ✓ This trade will be executed in simulation mode only
                  </Typography>
                }
              />
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2">
                    ✓ No real money will be used or transferred
                  </Typography>
                }
              />
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2">
                    ✓ Virtual portfolio balances will be updated
                  </Typography>
                }
              />
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2">
                    ✓ Trade will be logged as a paper trade
                  </Typography>
                }
              />
            </ListItem>
          </List>
        </Box>

        {/* Final Warning */}
        <Alert severity="info" icon={<Warning />}>
          <Typography variant="body2">
            By confirming, you acknowledge this is a paper trade for educational purposes only.
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          color="inherit"
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="warning"
          startIcon={<Security />}
          sx={{ fontWeight: 'bold' }}
        >
          Execute Paper Trade
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaperTradingConfirmDialog;