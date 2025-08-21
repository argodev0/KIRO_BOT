import React from 'react';
import {
  Box,
  TextField,
  FormControlLabel,
  Switch,
  Typography,
  Grid
} from '@mui/material';
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
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Configuration Name"
            value={config.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
            helperText="A descriptive name for this bot configuration"
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={config.isActive}
                onChange={(e) => handleChange('isActive', e.target.checked)}
              />
            }
            label="Active Configuration"
          />
        </Grid>
        
        <Grid item xs={12}>
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
      </Grid>
    </Box>
  );
};