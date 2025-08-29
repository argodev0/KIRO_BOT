import React from 'react';
import {
  Box,
  Typography,
  Grid,
  FormControlLabel,
  Switch,
  TextField,
  Card,
  CardContent,
  IconButton,
  Button,
  Chip,
  Alert
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Visibility, VisibilityOff } from '@mui/icons-material';
import { ExchangeConfig } from '@/types/config';

interface ExchangeConfigPanelProps {
  exchanges: ExchangeConfig[];
  onChange: (exchanges: ExchangeConfig[]) => void;
}

export const ExchangeConfigPanel: React.FC<ExchangeConfigPanelProps> = ({
  exchanges,
  onChange
}) => {
  const [showApiKeys, setShowApiKeys] = React.useState<Record<number, boolean>>({});

  const handleExchangeChange = (index: number, field: keyof ExchangeConfig, value: any) => {
    const newExchanges = [...exchanges];
    newExchanges[index] = { ...newExchanges[index], [field]: value };
    onChange(newExchanges);
  };

  const handleNestedChange = (index: number, section: string, field: string, value: any) => {
    const newExchanges = [...exchanges];
    newExchanges[index] = {
      ...newExchanges[index],
      [section]: {
        ...newExchanges[index][section as keyof ExchangeConfig],
        [field]: value
      }
    };
    onChange(newExchanges);
  };

  const addExchange = () => {
    const newExchange: ExchangeConfig = {
      name: 'binance',
      enabled: false,
      testnet: true,
      rateLimits: {
        ordersPerSecond: 1,
        requestsPerMinute: 60
      },
      fees: {
        maker: 0.001,
        taker: 0.001
      },
      symbols: ['BTCUSDT']
    };
    onChange([...exchanges, newExchange]);
  };

  const removeExchange = (index: number) => {
    const newExchanges = exchanges.filter((_, i) => i !== index);
    onChange(newExchanges);
  };

  const toggleApiKeyVisibility = (index: number) => {
    setShowApiKeys(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const availableSymbols = [
    'BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT', 
    'BNBUSDT', 'SOLUSDT', 'MATICUSDT', 'AVAXUSDT', 'ATOMUSDT'
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">Exchange Configurations</Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={addExchange}
        >
          Add Exchange
        </Button>
      </Box>

      {exchanges.length === 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          At least one exchange must be configured for trading.
        </Alert>
      )}

      {exchanges.map((exchange, index) => (
        <Card key={index} sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                {exchange.name.charAt(0).toUpperCase() + exchange.name.slice(1)} Exchange
              </Typography>
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={exchange.enabled}
                      onChange={(e) => handleExchangeChange(index, 'enabled', e.target.checked)}
                    />
                  }
                  label="Enabled"
                />
                {exchanges.length > 1 && (
                  <IconButton
                    color="error"
                    onClick={() => removeExchange(index)}
                  >
                    <DeleteIcon />
                  </IconButton>
                )}
              </Box>
            </Box>

            <Grid container spacing={3}>
              {/* Basic Settings */}
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  select
                  label="Exchange"
                  value={exchange.name}
                  onChange={(e) => handleExchangeChange(index, 'name', e.target.value)}
                  SelectProps={{ native: true }}
                >
                  <option value="binance">Binance</option>
                  <option value="kucoin">KuCoin</option>
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={exchange.testnet}
                      onChange={(e) => handleExchangeChange(index, 'testnet', e.target.checked)}
                    />
                  }
                  label="Use Testnet"
                />
              </Grid>

              {/* API Credentials */}
              {exchange.enabled && (
                <>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      API Credentials
                    </Typography>
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="API Key"
                      type={showApiKeys[index] ? 'text' : 'password'}
                      value={exchange.apiKey || ''}
                      onChange={(e) => handleExchangeChange(index, 'apiKey', e.target.value)}
                      InputProps={{
                        endAdornment: (
                          <IconButton
                            onClick={() => toggleApiKeyVisibility(index)}
                            edge="end"
                          >
                            {showApiKeys[index] ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        )
                      }}
                      helperText="Your exchange API key"
                    />
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="API Secret"
                      type="password"
                      value={exchange.apiSecret || ''}
                      onChange={(e) => handleExchangeChange(index, 'apiSecret', e.target.value)}
                      helperText="Your exchange API secret"
                    />
                  </Grid>
                </>
              )}

              {/* Rate Limits */}
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Rate Limits
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Orders Per Second"
                  value={exchange.rateLimits.ordersPerSecond}
                  onChange={(e) => handleNestedChange(index, 'rateLimits', 'ordersPerSecond', parseInt(e.target.value))}
                  inputProps={{ min: 1, max: 100 }}
                  helperText="Maximum orders per second"
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Requests Per Minute"
                  value={exchange.rateLimits.requestsPerMinute}
                  onChange={(e) => handleNestedChange(index, 'rateLimits', 'requestsPerMinute', parseInt(e.target.value))}
                  inputProps={{ min: 1, max: 6000 }}
                  helperText="Maximum API requests per minute"
                />
              </Grid>

              {/* Fees */}
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Trading Fees
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Maker Fee (%)"
                  value={exchange.fees.maker * 100}
                  onChange={(e) => handleNestedChange(index, 'fees', 'maker', parseFloat(e.target.value) / 100)}
                  inputProps={{ min: 0, max: 1, step: 0.001 }}
                  helperText="Fee for maker orders"
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Taker Fee (%)"
                  value={exchange.fees.taker * 100}
                  onChange={(e) => handleNestedChange(index, 'fees', 'taker', parseFloat(e.target.value) / 100)}
                  inputProps={{ min: 0, max: 1, step: 0.001 }}
                  helperText="Fee for taker orders"
                />
              </Grid>

              {/* Trading Symbols */}
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Trading Symbols
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {availableSymbols.map((symbol) => (
                    <Chip
                      key={symbol}
                      label={symbol}
                      clickable
                      color={exchange.symbols.includes(symbol) ? 'primary' : 'default'}
                      onClick={() => {
                        const newSymbols = exchange.symbols.includes(symbol)
                          ? exchange.symbols.filter(s => s !== symbol)
                          : [...exchange.symbols, symbol];
                        handleExchangeChange(index, 'symbols', newSymbols);
                      }}
                    />
                  ))}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Selected: {exchange.symbols.join(', ')}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};