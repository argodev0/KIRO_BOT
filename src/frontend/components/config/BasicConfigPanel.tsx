import React from 'react';
import {
  Box,
  TextField,
  FormControlLabel,
  Switch,
  Typography,
  Grid,
  Alert,
  Chip,
  Divider
} from '@mui/material';
import { Security as SecurityIcon, Warning as WarningIcon } from '@mui/icons-material';
import { BotConfig } from '@/types/config';

interface BasicConfigPanelProps {
  config: BotConfig;
  onChange: (updates: Partial<BotConfig>) => void;
}

export const BasicConfigPanel: React.FC<BasicConfigPanelProps> = ({
  config,
  onChange
}) => {
  const handleChange = (field: keyof BotConfig, value: any) => {
    onChange({ [field]: value });
  };

  return (
    <Box>
      <Typography variant="subtitle1" gutterBottom>
        Basic Settings
      </Typography>

      {/* Paper Trading Mode Status */}
      <Alert 
        severity="info" 
        icon={<SecurityIcon />}
        sx={{ mb: 3, backgroundColor: 'rgba(76, 175, 80, 0.1)' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2">
            <strong>Paper Trading Mode:</strong> All trades will be simulated with virtual funds
          </Typography>
          <Chip
            icon={<SecurityIcon />}
            label="PAPER TRADING ACTIVE"
            color="success"
            variant="outlined"
            size="small"
          />
        </Box>
      </Alert>
      
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            label="Configuration Name"
            value={config.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
            helperText="A descriptive name for this bot configuration"
          />
        </Grid>
        
        <Grid size={{ xs: 12, md: 6 }}>
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={config.isActive}
                  onChange={(e) => handleChange('isActive', e.target.checked)}
                />
              }
              label="Active Configuration"
            />
            {config.isActive && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                <Typography variant="caption">
                  <WarningIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                  Active configurations can be used for paper trading
                </Typography>
              </Alert>
            )}
          </Box>
        </Grid>
        
        <Grid size={{ xs: 12 }}>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Description"
            value={config.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            helperText="Optional description of this configuration's purpose and settings"
          />
        </Grid>

        {/* Paper Trading Safety Information */}
        <Grid size={{ xs: 12 }}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            Paper Trading Safety Features
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box sx={{ textAlign: 'center', p: 2, border: '1px solid', borderColor: 'success.main', borderRadius: 1 }}>
                <SecurityIcon color="success" />
                <Typography variant="caption" display="block">
                  Virtual Portfolio
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box sx={{ textAlign: 'center', p: 2, border: '1px solid', borderColor: 'success.main', borderRadius: 1 }}>
                <SecurityIcon color="success" />
                <Typography variant="caption" display="block">
                  Simulated Trades
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box sx={{ textAlign: 'center', p: 2, border: '1px solid', borderColor: 'success.main', borderRadius: 1 }}>
                <SecurityIcon color="success" />
                <Typography variant="caption" display="block">
                  Real Market Data
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box sx={{ textAlign: 'center', p: 2, border: '1px solid', borderColor: 'success.main', borderRadius: 1 }}>
                <SecurityIcon color="success" />
                <Typography variant="caption" display="block">
                  No Real Money Risk
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};