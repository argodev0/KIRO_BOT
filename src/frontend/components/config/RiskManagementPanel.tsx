import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Grid,
  FormControlLabel,
  Switch,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Chip
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon, Warning as WarningIcon } from '@mui/icons-material';
import { RiskManagementConfig } from '@/types/config';

interface RiskManagementPanelProps {
  riskManagement: RiskManagementConfig;
  onChange: (riskManagement: RiskManagementConfig) => void;
}

export const RiskManagementPanel: React.FC<RiskManagementPanelProps> = ({
  riskManagement,
  onChange
}) => {
  const handleChange = (field: keyof RiskManagementConfig, value: any) => {
    onChange({ ...riskManagement, [field]: value });
  };

  const handleNestedChange = (section: string, field: string, value: any) => {
    onChange({
      ...riskManagement,
      [section]: {
        ...riskManagement[section as keyof RiskManagementConfig],
        [field]: value
      }
    });
  };

  const getRiskLevel = (riskPerTrade: number): { level: string; color: 'success' | 'warning' | 'error' } => {
    if (riskPerTrade <= 2) return { level: 'Conservative', color: 'success' };
    if (riskPerTrade <= 5) return { level: 'Moderate', color: 'warning' };
    return { level: 'Aggressive', color: 'error' };
  };

  const riskLevel = getRiskLevel(riskManagement.maxRiskPerTrade);

  return (
    <Box>
      {/* Risk Level Indicator */}
      <Alert 
        severity={riskLevel.color} 
        icon={<WarningIcon />}
        sx={{ mb: 3 }}
      >
        <Typography variant="subtitle2">
          Current Risk Level: <Chip label={riskLevel.level} color={riskLevel.color} size="small" />
        </Typography>
        <Typography variant="body2">
          Risk per trade: {riskManagement.maxRiskPerTrade}% | 
          Daily loss limit: {riskManagement.maxDailyLoss}% | 
          Max exposure: {riskManagement.maxTotalExposure}x
        </Typography>
      </Alert>

      {/* Basic Risk Parameters */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Basic Risk Limits</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography gutterBottom>
                Max Risk Per Trade: {riskManagement.maxRiskPerTrade}%
              </Typography>
              <Slider
                value={riskManagement.maxRiskPerTrade}
                onChange={(_e, value) => handleChange('maxRiskPerTrade', value as number)}
                min={0.1}
                max={10}
                step={0.1}
                marks={[
                  { value: 1, label: '1%' },
                  { value: 3, label: '3%' },
                  { value: 5, label: '5%' },
                  { value: 10, label: '10%' }
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}%`}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Typography gutterBottom>
                Max Daily Loss: {riskManagement.maxDailyLoss}%
              </Typography>
              <Slider
                value={riskManagement.maxDailyLoss}
                onChange={(_e, value) => handleChange('maxDailyLoss', value as number)}
                min={1}
                max={20}
                step={0.5}
                marks={[
                  { value: 3, label: '3%' },
                  { value: 5, label: '5%' },
                  { value: 10, label: '10%' },
                  { value: 20, label: '20%' }
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}%`}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Typography gutterBottom>
                Max Total Exposure: {riskManagement.maxTotalExposure}x
              </Typography>
              <Slider
                value={riskManagement.maxTotalExposure}
                onChange={(_e, value) => handleChange('maxTotalExposure', value as number)}
                min={1}
                max={10}
                step={0.5}
                marks={[
                  { value: 1, label: '1x' },
                  { value: 3, label: '3x' },
                  { value: 5, label: '5x' },
                  { value: 10, label: '10x' }
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}x`}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Typography gutterBottom>
                Max Drawdown: {riskManagement.maxDrawdown}%
              </Typography>
              <Slider
                value={riskManagement.maxDrawdown}
                onChange={(_e, value) => handleChange('maxDrawdown', value as number)}
                min={5}
                max={50}
                step={1}
                marks={[
                  { value: 10, label: '10%' },
                  { value: 20, label: '20%' },
                  { value: 30, label: '30%' },
                  { value: 50, label: '50%' }
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}%`}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Max Leverage"
                value={riskManagement.maxLeverage}
                onChange={(e) => handleChange('maxLeverage', parseFloat(e.target.value))}
                inputProps={{ min: 1, max: 100, step: 0.1 }}
                helperText="Maximum leverage allowed for trades"
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={riskManagement.stopLossRequired}
                    onChange={(e) => handleChange('stopLossRequired', e.target.checked)}
                  />
                }
                label="Require Stop Loss"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Emergency Stop Configuration */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Emergency Stop</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={riskManagement.emergencyStop.enabled}
                    onChange={(e) => handleNestedChange('emergencyStop', 'enabled', e.target.checked)}
                  />
                }
                label="Enable Emergency Stop System"
              />
            </Grid>

            {riskManagement.emergencyStop.enabled && (
              <>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Trigger Conditions
                  </Typography>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={riskManagement.emergencyStop.triggers.maxDailyLoss}
                        onChange={(e) => handleNestedChange('emergencyStop', 'triggers', {
                          ...riskManagement.emergencyStop.triggers,
                          maxDailyLoss: e.target.checked
                        })}
                      />
                    }
                    label="Max Daily Loss Reached"
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={riskManagement.emergencyStop.triggers.maxDrawdown}
                        onChange={(e) => handleNestedChange('emergencyStop', 'triggers', {
                          ...riskManagement.emergencyStop.triggers,
                          maxDrawdown: e.target.checked
                        })}
                      />
                    }
                    label="Max Drawdown Reached"
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={riskManagement.emergencyStop.triggers.consecutiveLosses.enabled}
                        onChange={(e) => handleNestedChange('emergencyStop', 'triggers', {
                          ...riskManagement.emergencyStop.triggers,
                          consecutiveLosses: {
                            ...riskManagement.emergencyStop.triggers.consecutiveLosses,
                            enabled: e.target.checked
                          }
                        })}
                      />
                    }
                    label="Consecutive Losses"
                  />
                  {riskManagement.emergencyStop.triggers.consecutiveLosses.enabled && (
                    <TextField
                      fullWidth
                      type="number"
                      label="Loss Count"
                      value={riskManagement.emergencyStop.triggers.consecutiveLosses.count}
                      onChange={(e) => handleNestedChange('emergencyStop', 'triggers', {
                        ...riskManagement.emergencyStop.triggers,
                        consecutiveLosses: {
                          ...riskManagement.emergencyStop.triggers.consecutiveLosses,
                          count: parseInt(e.target.value)
                        }
                      })}
                      inputProps={{ min: 1, max: 20 }}
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  )}
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={riskManagement.emergencyStop.triggers.marketVolatility.enabled}
                        onChange={(e) => handleNestedChange('emergencyStop', 'triggers', {
                          ...riskManagement.emergencyStop.triggers,
                          marketVolatility: {
                            ...riskManagement.emergencyStop.triggers.marketVolatility,
                            enabled: e.target.checked
                          }
                        })}
                      />
                    }
                    label="High Market Volatility"
                  />
                  {riskManagement.emergencyStop.triggers.marketVolatility.enabled && (
                    <TextField
                      fullWidth
                      type="number"
                      label="Volatility Threshold"
                      value={riskManagement.emergencyStop.triggers.marketVolatility.threshold}
                      onChange={(e) => handleNestedChange('emergencyStop', 'triggers', {
                        ...riskManagement.emergencyStop.triggers,
                        marketVolatility: {
                          ...riskManagement.emergencyStop.triggers.marketVolatility,
                          threshold: parseFloat(e.target.value)
                        }
                      })}
                      inputProps={{ min: 0, max: 1, step: 0.01 }}
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  )}
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Emergency Actions
                  </Typography>
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={riskManagement.emergencyStop.actions.closeAllPositions}
                        onChange={(e) => handleNestedChange('emergencyStop', 'actions', {
                          ...riskManagement.emergencyStop.actions,
                          closeAllPositions: e.target.checked
                        })}
                      />
                    }
                    label="Close All Positions"
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={riskManagement.emergencyStop.actions.pauseTrading}
                        onChange={(e) => handleNestedChange('emergencyStop', 'actions', {
                          ...riskManagement.emergencyStop.actions,
                          pauseTrading: e.target.checked
                        })}
                      />
                    }
                    label="Pause Trading"
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={riskManagement.emergencyStop.actions.sendNotification}
                        onChange={(e) => handleNestedChange('emergencyStop', 'actions', {
                          ...riskManagement.emergencyStop.actions,
                          sendNotification: e.target.checked
                        })}
                      />
                    }
                    label="Send Notification"
                  />
                </Grid>
              </>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Position Sizing */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Position Sizing</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Sizing Method</InputLabel>
                <Select
                  value={riskManagement.positionSizing.method}
                  onChange={(e) => handleNestedChange('positionSizing', 'method', e.target.value)}
                >
                  <MenuItem value="fixed">Fixed Size</MenuItem>
                  <MenuItem value="percentage">Percentage of Balance</MenuItem>
                  <MenuItem value="kelly">Kelly Criterion</MenuItem>
                  <MenuItem value="volatility_adjusted">Volatility Adjusted</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Base Size (%)"
                value={riskManagement.positionSizing.baseSize}
                onChange={(e) => handleNestedChange('positionSizing', 'baseSize', parseFloat(e.target.value))}
                inputProps={{ min: 0.1, max: 100, step: 0.1 }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Max Size (%)"
                value={riskManagement.positionSizing.maxSize}
                onChange={(e) => handleNestedChange('positionSizing', 'maxSize', parseFloat(e.target.value))}
                inputProps={{ min: 0.1, max: 100, step: 0.1 }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={riskManagement.positionSizing.volatilityAdjustment}
                    onChange={(e) => handleNestedChange('positionSizing', 'volatilityAdjustment', e.target.checked)}
                  />
                }
                label="Volatility Adjustment"
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={riskManagement.positionSizing.correlationAdjustment}
                    onChange={(e) => handleNestedChange('positionSizing', 'correlationAdjustment', e.target.checked)}
                  />
                }
                label="Correlation Adjustment"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Drawdown Protection */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Drawdown Protection</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={riskManagement.drawdownProtection.enabled}
                    onChange={(e) => handleNestedChange('drawdownProtection', 'enabled', e.target.checked)}
                  />
                }
                label="Enable Drawdown Protection"
              />
            </Grid>

            {riskManagement.drawdownProtection.enabled && (
              <>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography gutterBottom>
                    Max Drawdown: {riskManagement.drawdownProtection.maxDrawdown}%
                  </Typography>
                  <Slider
                    value={riskManagement.drawdownProtection.maxDrawdown}
                    onChange={(_e, value) => handleNestedChange('drawdownProtection', 'maxDrawdown', value as number)}
                    min={5}
                    max={50}
                    step={1}
                    marks={[
                      { value: 10, label: '10%' },
                      { value: 20, label: '20%' },
                      { value: 30, label: '30%' }
                    ]}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}%`}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography gutterBottom>
                    Recovery Threshold: {riskManagement.drawdownProtection.recoveryThreshold}%
                  </Typography>
                  <Slider
                    value={riskManagement.drawdownProtection.recoveryThreshold}
                    onChange={(_e, value) => handleNestedChange('drawdownProtection', 'recoveryThreshold', value as number)}
                    min={1}
                    max={20}
                    step={0.5}
                    marks={[
                      { value: 3, label: '3%' },
                      { value: 5, label: '5%' },
                      { value: 10, label: '10%' }
                    ]}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}%`}
                  />
                </Grid>
              </>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};