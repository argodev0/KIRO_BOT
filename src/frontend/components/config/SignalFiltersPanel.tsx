import React from 'react';
import {
  Box,
  Typography,
  Grid,
  FormControlLabel,
  Switch,
  TextField,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { SignalFilterConfig } from '@/types/config';

interface SignalFiltersPanelProps {
  signalFilters: SignalFilterConfig;
  onChange: (signalFilters: SignalFilterConfig) => void;
}

export const SignalFiltersPanel: React.FC<SignalFiltersPanelProps> = ({
  signalFilters,
  onChange
}) => {
  const handleNestedChange = (section: keyof SignalFilterConfig, field: string, value: any) => {
    onChange({
      ...signalFilters,
      [section]: {
        ...signalFilters[section],
        [field]: value
      }
    });
  };

  const availableIndicators = ['rsi', 'waveTrend', 'pvt', 'macd', 'ema', 'sma'];
  const availablePatterns = [
    'hammer', 'doji', 'engulfing_bullish', 'engulfing_bearish', 
    'shooting_star', 'morning_star', 'evening_star', 'harami'
  ];
  const availableTimeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
  const availableFactorTypes = ['technical', 'pattern', 'fibonacci', 'elliott_wave', 'volume'];

  return (
    <Box>
      {/* Confidence Filter */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Confidence Filter</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={signalFilters.confidence.enabled}
                    onChange={(e) => handleNestedChange('confidence', 'enabled', e.target.checked)}
                  />
                }
                label="Enable Confidence Filtering"
              />
            </Grid>

            {signalFilters.confidence.enabled && (
              <>
                <Grid item xs={12} md={6}>
                  <Typography gutterBottom>
                    Minimum Confidence: {signalFilters.confidence.minConfidence}%
                  </Typography>
                  <Slider
                    value={signalFilters.confidence.minConfidence}
                    onChange={(_e, value) => handleNestedChange('confidence', 'minConfidence', value as number)}
                    min={0}
                    max={100}
                    step={5}
                    marks={[
                      { value: 50, label: '50%' },
                      { value: 70, label: '70%' },
                      { value: 90, label: '90%' }
                    ]}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}%`}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Max Signals Per Hour"
                    value={signalFilters.confidence.maxSignalsPerHour}
                    onChange={(e) => handleNestedChange('confidence', 'maxSignalsPerHour', parseInt(e.target.value))}
                    inputProps={{ min: 1, max: 100 }}
                    helperText="Limit signal frequency to avoid overtrading"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Cooldown Period (minutes)"
                    value={signalFilters.confidence.cooldownPeriod}
                    onChange={(e) => handleNestedChange('confidence', 'cooldownPeriod', parseInt(e.target.value))}
                    inputProps={{ min: 0, max: 1440 }}
                    helperText="Minimum time between signals for same symbol"
                  />
                </Grid>
              </>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Technical Filter */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Technical Indicators Filter</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={signalFilters.technical.enabled}
                    onChange={(e) => handleNestedChange('technical', 'enabled', e.target.checked)}
                  />
                }
                label="Enable Technical Indicator Filtering"
              />
            </Grid>

            {signalFilters.technical.enabled && (
              <>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Required Indicators
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {availableIndicators.map((indicator) => (
                      <Chip
                        key={indicator}
                        label={indicator.toUpperCase()}
                        clickable
                        color={signalFilters.technical.requiredIndicators.includes(indicator) ? 'primary' : 'default'}
                        onClick={() => {
                          const newIndicators = signalFilters.technical.requiredIndicators.includes(indicator)
                            ? signalFilters.technical.requiredIndicators.filter(i => i !== indicator)
                            : [...signalFilters.technical.requiredIndicators, indicator];
                          handleNestedChange('technical', 'requiredIndicators', newIndicators);
                        }}
                      />
                    ))}
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={signalFilters.technical.trendAlignment}
                        onChange={(e) => handleNestedChange('technical', 'trendAlignment', e.target.checked)}
                      />
                    }
                    label="Require Trend Alignment"
                  />
                </Grid>
              </>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Pattern Filter */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Pattern Filter</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={signalFilters.patterns.enabled}
                    onChange={(e) => handleNestedChange('patterns', 'enabled', e.target.checked)}
                  />
                }
                label="Enable Pattern Filtering"
              />
            </Grid>

            {signalFilters.patterns.enabled && (
              <>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Allowed Patterns
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {availablePatterns.map((pattern) => (
                      <Chip
                        key={pattern}
                        label={pattern.replace(/_/g, ' ')}
                        clickable
                        color={signalFilters.patterns.allowedPatterns.includes(pattern) ? 'primary' : 'default'}
                        onClick={() => {
                          const newPatterns = signalFilters.patterns.allowedPatterns.includes(pattern)
                            ? signalFilters.patterns.allowedPatterns.filter(p => p !== pattern)
                            : [...signalFilters.patterns.allowedPatterns, pattern];
                          handleNestedChange('patterns', 'allowedPatterns', newPatterns);
                        }}
                      />
                    ))}
                  </Box>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography gutterBottom>
                    Minimum Pattern Strength: {signalFilters.patterns.minPatternStrength}%
                  </Typography>
                  <Slider
                    value={signalFilters.patterns.minPatternStrength}
                    onChange={(_e, value) => handleNestedChange('patterns', 'minPatternStrength', value as number)}
                    min={0}
                    max={100}
                    step={5}
                    marks={[
                      { value: 50, label: '50%' },
                      { value: 70, label: '70%' },
                      { value: 90, label: '90%' }
                    ]}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}%`}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={signalFilters.patterns.multiTimeframeConfirmation}
                        onChange={(e) => handleNestedChange('patterns', 'multiTimeframeConfirmation', e.target.checked)}
                      />
                    }
                    label="Multi-Timeframe Confirmation"
                  />
                </Grid>
              </>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Confluence Filter */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Confluence Filter</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={signalFilters.confluence.enabled}
                    onChange={(e) => handleNestedChange('confluence', 'enabled', e.target.checked)}
                  />
                }
                label="Enable Confluence Filtering"
              />
            </Grid>

            {signalFilters.confluence.enabled && (
              <>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Minimum Confluence Factors"
                    value={signalFilters.confluence.minConfluenceFactors}
                    onChange={(e) => handleNestedChange('confluence', 'minConfluenceFactors', parseInt(e.target.value))}
                    inputProps={{ min: 1, max: 10 }}
                    helperText="Minimum number of confirming factors required"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography gutterBottom>
                    Confluence Weight: {signalFilters.confluence.confluenceWeight}
                  </Typography>
                  <Slider
                    value={signalFilters.confluence.confluenceWeight}
                    onChange={(_e, value) => handleNestedChange('confluence', 'confluenceWeight', value as number)}
                    min={0}
                    max={1}
                    step={0.1}
                    marks={[
                      { value: 0.5, label: '0.5' },
                      { value: 0.7, label: '0.7' },
                      { value: 0.9, label: '0.9' }
                    ]}
                    valueLabelDisplay="auto"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Required Factor Types
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {availableFactorTypes.map((factorType) => (
                      <Chip
                        key={factorType}
                        label={factorType.replace(/_/g, ' ')}
                        clickable
                        color={signalFilters.confluence.requiredFactorTypes.includes(factorType) ? 'primary' : 'default'}
                        onClick={() => {
                          const newFactorTypes = signalFilters.confluence.requiredFactorTypes.includes(factorType)
                            ? signalFilters.confluence.requiredFactorTypes.filter(f => f !== factorType)
                            : [...signalFilters.confluence.requiredFactorTypes, factorType];
                          handleNestedChange('confluence', 'requiredFactorTypes', newFactorTypes);
                        }}
                      />
                    ))}
                  </Box>
                </Grid>
              </>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Timeframe Filter */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Timeframe Filter</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={signalFilters.timeframe.enabled}
                    onChange={(e) => handleNestedChange('timeframe', 'enabled', e.target.checked)}
                  />
                }
                label="Enable Timeframe Filtering"
              />
            </Grid>

            {signalFilters.timeframe.enabled && (
              <>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Primary Timeframe</InputLabel>
                    <Select
                      value={signalFilters.timeframe.primaryTimeframe}
                      onChange={(e) => handleNestedChange('timeframe', 'primaryTimeframe', e.target.value)}
                    >
                      {availableTimeframes.map((timeframe) => (
                        <MenuItem key={timeframe} value={timeframe}>
                          {timeframe}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={signalFilters.timeframe.alignmentRequired}
                        onChange={(e) => handleNestedChange('timeframe', 'alignmentRequired', e.target.checked)}
                      />
                    }
                    label="Require Timeframe Alignment"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Confirmation Timeframes
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {availableTimeframes.map((timeframe) => (
                      <Chip
                        key={timeframe}
                        label={timeframe}
                        clickable
                        color={signalFilters.timeframe.confirmationTimeframes.includes(timeframe) ? 'primary' : 'default'}
                        onClick={() => {
                          const newTimeframes = signalFilters.timeframe.confirmationTimeframes.includes(timeframe)
                            ? signalFilters.timeframe.confirmationTimeframes.filter(t => t !== timeframe)
                            : [...signalFilters.timeframe.confirmationTimeframes, timeframe];
                          handleNestedChange('timeframe', 'confirmationTimeframes', newTimeframes);
                        }}
                      />
                    ))}
                  </Box>
                </Grid>
              </>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Volume Filter */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Volume Filter</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={signalFilters.volume.enabled}
                    onChange={(e) => handleNestedChange('volume', 'enabled', e.target.checked)}
                  />
                }
                label="Enable Volume Filtering"
              />
            </Grid>

            {signalFilters.volume.enabled && (
              <>
                <Grid item xs={12} md={6}>
                  <Typography gutterBottom>
                    Minimum Volume Ratio: {signalFilters.volume.minVolumeRatio}x
                  </Typography>
                  <Slider
                    value={signalFilters.volume.minVolumeRatio}
                    onChange={(_e, value) => handleNestedChange('volume', 'minVolumeRatio', value as number)}
                    min={0.1}
                    max={5}
                    step={0.1}
                    marks={[
                      { value: 1, label: '1x' },
                      { value: 2, label: '2x' },
                      { value: 3, label: '3x' }
                    ]}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}x`}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={signalFilters.volume.volumeTrendRequired}
                        onChange={(e) => handleNestedChange('volume', 'volumeTrendRequired', e.target.checked)}
                      />
                    }
                    label="Volume Trend Required"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={signalFilters.volume.unusualVolumeDetection}
                        onChange={(e) => handleNestedChange('volume', 'unusualVolumeDetection', e.target.checked)}
                      />
                    }
                    label="Unusual Volume Detection"
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