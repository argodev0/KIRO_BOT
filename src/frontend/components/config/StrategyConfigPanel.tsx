import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  Chip,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Slider
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { BotStrategy, StrategyType } from '@/types/config';

interface StrategyConfigPanelProps {
  strategy: BotStrategy;
  onChange: (strategy: BotStrategy) => void;
}

export const StrategyConfigPanel: React.FC<StrategyConfigPanelProps> = ({
  strategy,
  onChange
}) => {
  const handleChange = (field: keyof BotStrategy, value: any) => {
    onChange({ ...strategy, [field]: value });
  };

  const handleParameterChange = (paramType: string, updates: any) => {
    onChange({
      ...strategy,
      parameters: {
        ...strategy.parameters,
        [paramType]: {
          ...strategy.parameters[paramType as keyof typeof strategy.parameters],
          ...updates
        }
      }
    });
  };

  const availableTimeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
  const availableSymbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT'];

  return (
    <Box>
      <Grid container spacing={3}>
        {/* Strategy Type */}
        <Grid size={{ xs: 12, md: 6 }}>
          <FormControl fullWidth>
            <InputLabel>Strategy Type</InputLabel>
            <Select
              value={strategy.type}
              onChange={(e) => handleChange('type', e.target.value as StrategyType)}
            >
              <MenuItem value="technical_analysis">Technical Analysis</MenuItem>
              <MenuItem value="elliott_wave">Elliott Wave</MenuItem>
              <MenuItem value="fibonacci_confluence">Fibonacci Confluence</MenuItem>
              <MenuItem value="grid_trading">Grid Trading</MenuItem>
              <MenuItem value="multi_strategy">Multi-Strategy</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {/* Max Concurrent Trades */}
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            type="number"
            label="Max Concurrent Trades"
            value={strategy.maxConcurrentTrades}
            onChange={(e) => handleChange('maxConcurrentTrades', parseInt(e.target.value))}
            inputProps={{ min: 1, max: 20 }}
          />
        </Grid>

        {/* Timeframes */}
        <Grid size={{ xs: 12 }}>
          <Typography variant="subtitle2" gutterBottom>
            Trading Timeframes
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {availableTimeframes.map((timeframe) => (
              <Chip
                key={timeframe}
                label={timeframe}
                clickable
                color={strategy.timeframes.includes(timeframe) ? 'primary' : 'default'}
                onClick={() => {
                  const newTimeframes = strategy.timeframes.includes(timeframe)
                    ? strategy.timeframes.filter(t => t !== timeframe)
                    : [...strategy.timeframes, timeframe];
                  handleChange('timeframes', newTimeframes);
                }}
              />
            ))}
          </Box>
        </Grid>

        {/* Symbols */}
        <Grid size={{ xs: 12 }}>
          <Typography variant="subtitle2" gutterBottom>
            Trading Symbols
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {availableSymbols.map((symbol) => (
              <Chip
                key={symbol}
                label={symbol}
                clickable
                color={strategy.symbols.includes(symbol) ? 'primary' : 'default'}
                onClick={() => {
                  const newSymbols = strategy.symbols.includes(symbol)
                    ? strategy.symbols.filter(s => s !== symbol)
                    : [...strategy.symbols, symbol];
                  handleChange('symbols', newSymbols);
                }}
              />
            ))}
          </Box>
        </Grid>
      </Grid>

      {/* Strategy-Specific Parameters */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Strategy Parameters
        </Typography>

        {/* Technical Analysis Parameters */}
        {strategy.type === 'technical_analysis' && strategy.parameters.technicalAnalysis && (
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Technical Analysis Settings</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                {/* RSI Settings */}
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" gutterBottom>RSI Indicator</Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={strategy.parameters.technicalAnalysis.indicators.rsi.enabled}
                            onChange={(e) => handleParameterChange('technicalAnalysis', {
                              indicators: {
                                ...strategy.parameters.technicalAnalysis.indicators,
                                rsi: {
                                  ...strategy.parameters.technicalAnalysis.indicators.rsi,
                                  enabled: e.target.checked
                                }
                              }
                            })}
                          />
                        }
                        label="Enabled"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Period"
                        value={strategy.parameters.technicalAnalysis.indicators.rsi.period}
                        onChange={(e) => handleParameterChange('technicalAnalysis', {
                          indicators: {
                            ...strategy.parameters.technicalAnalysis.indicators,
                            rsi: {
                              ...strategy.parameters.technicalAnalysis.indicators.rsi,
                              period: parseInt(e.target.value)
                            }
                          }
                        })}
                        inputProps={{ min: 2, max: 100 }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Overbought"
                        value={strategy.parameters.technicalAnalysis.indicators.rsi.overbought}
                        onChange={(e) => handleParameterChange('technicalAnalysis', {
                          indicators: {
                            ...strategy.parameters.technicalAnalysis.indicators,
                            rsi: {
                              ...strategy.parameters.technicalAnalysis.indicators.rsi,
                              overbought: parseInt(e.target.value)
                            }
                          }
                        })}
                        inputProps={{ min: 50, max: 100 }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Oversold"
                        value={strategy.parameters.technicalAnalysis.indicators.rsi.oversold}
                        onChange={(e) => handleParameterChange('technicalAnalysis', {
                          indicators: {
                            ...strategy.parameters.technicalAnalysis.indicators,
                            rsi: {
                              ...strategy.parameters.technicalAnalysis.indicators.rsi,
                              oversold: parseInt(e.target.value)
                            }
                          }
                        })}
                        inputProps={{ min: 0, max: 50 }}
                      />
                    </Grid>
                  </Grid>
                </Grid>

                {/* Wave Trend Settings */}
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" gutterBottom>Wave Trend Indicator</Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={strategy.parameters.technicalAnalysis.indicators.waveTrend.enabled}
                            onChange={(e) => handleParameterChange('technicalAnalysis', {
                              indicators: {
                                ...strategy.parameters.technicalAnalysis.indicators,
                                waveTrend: {
                                  ...strategy.parameters.technicalAnalysis.indicators.waveTrend,
                                  enabled: e.target.checked
                                }
                              }
                            })}
                          />
                        }
                        label="Enabled"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="N1 Period"
                        value={strategy.parameters.technicalAnalysis.indicators.waveTrend.n1}
                        onChange={(e) => handleParameterChange('technicalAnalysis', {
                          indicators: {
                            ...strategy.parameters.technicalAnalysis.indicators,
                            waveTrend: {
                              ...strategy.parameters.technicalAnalysis.indicators.waveTrend,
                              n1: parseInt(e.target.value)
                            }
                          }
                        })}
                        inputProps={{ min: 1, max: 50 }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="N2 Period"
                        value={strategy.parameters.technicalAnalysis.indicators.waveTrend.n2}
                        onChange={(e) => handleParameterChange('technicalAnalysis', {
                          indicators: {
                            ...strategy.parameters.technicalAnalysis.indicators,
                            waveTrend: {
                              ...strategy.parameters.technicalAnalysis.indicators.waveTrend,
                              n2: parseInt(e.target.value)
                            }
                          }
                        })}
                        inputProps={{ min: 1, max: 100 }}
                      />
                    </Grid>
                  </Grid>
                </Grid>

                {/* Pattern Recognition Settings */}
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" gutterBottom>Pattern Recognition</Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={strategy.parameters.technicalAnalysis.patterns.enabled}
                            onChange={(e) => handleParameterChange('technicalAnalysis', {
                              patterns: {
                                ...strategy.parameters.technicalAnalysis.patterns,
                                enabled: e.target.checked
                              }
                            })}
                          />
                        }
                        label="Enable Pattern Recognition"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography gutterBottom>
                        Minimum Confidence: {strategy.parameters.technicalAnalysis.patterns.minConfidence}%
                      </Typography>
                      <Slider
                        value={strategy.parameters.technicalAnalysis.patterns.minConfidence}
                        onChange={(_e, value) => handleParameterChange('technicalAnalysis', {
                          patterns: {
                            ...strategy.parameters.technicalAnalysis.patterns,
                            minConfidence: value as number
                          }
                        })}
                        min={0}
                        max={100}
                        step={5}
                        marks
                        valueLabelDisplay="auto"
                      />
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Elliott Wave Parameters */}
        {strategy.type === 'elliott_wave' && strategy.parameters.elliottWave && (
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Elliott Wave Settings</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={strategy.parameters.elliottWave.enabled}
                        onChange={(e) => handleParameterChange('elliottWave', {
                          enabled: e.target.checked
                        })}
                      />
                    }
                    label="Enable Elliott Wave Analysis"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography gutterBottom>
                    Minimum Wave Validity: {strategy.parameters.elliottWave.minWaveValidity}%
                  </Typography>
                  <Slider
                    value={strategy.parameters.elliottWave.minWaveValidity}
                    onChange={(_e, value) => handleParameterChange('elliottWave', {
                      minWaveValidity: value as number
                    })}
                    min={0}
                    max={100}
                    step={5}
                    marks
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={strategy.parameters.elliottWave.waveTargets}
                        onChange={(e) => handleParameterChange('elliottWave', {
                          waveTargets: e.target.checked
                        })}
                      />
                    }
                    label="Use Wave Targets"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={strategy.parameters.elliottWave.fibonacciProjections}
                        onChange={(e) => handleParameterChange('elliottWave', {
                          fibonacciProjections: e.target.checked
                        })}
                      />
                    }
                    label="Fibonacci Projections"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={strategy.parameters.elliottWave.invalidationRules}
                        onChange={(e) => handleParameterChange('elliottWave', {
                          invalidationRules: e.target.checked
                        })}
                      />
                    }
                    label="Invalidation Rules"
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Grid Trading Parameters */}
        {strategy.type === 'grid_trading' && strategy.parameters.gridTrading && (
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Grid Trading Settings</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>Grid Strategy</InputLabel>
                    <Select
                      value={strategy.parameters.gridTrading.strategy}
                      onChange={(e) => handleParameterChange('gridTrading', {
                        strategy: e.target.value
                      })}
                    >
                      <MenuItem value="elliott_wave">Elliott Wave Based</MenuItem>
                      <MenuItem value="fibonacci">Fibonacci Based</MenuItem>
                      <MenuItem value="standard">Standard Grid</MenuItem>
                      <MenuItem value="dynamic">Dynamic Grid</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Grid Levels"
                    value={strategy.parameters.gridTrading.levels}
                    onChange={(e) => handleParameterChange('gridTrading', {
                      levels: parseInt(e.target.value)
                    })}
                    inputProps={{ min: 2, max: 50 }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography gutterBottom>
                    Grid Spacing: {(strategy.parameters.gridTrading.spacing * 100).toFixed(1)}%
                  </Typography>
                  <Slider
                    value={strategy.parameters.gridTrading.spacing}
                    onChange={(_e, value) => handleParameterChange('gridTrading', {
                      spacing: value as number
                    })}
                    min={0.001}
                    max={0.1}
                    step={0.001}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${(value * 100).toFixed(1)}%`}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={strategy.parameters.gridTrading.dynamicAdjustment}
                        onChange={(e) => handleParameterChange('gridTrading', {
                          dynamicAdjustment: e.target.checked
                        })}
                      />
                    }
                    label="Dynamic Adjustment"
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        )}
      </Box>
    </Box>
  );
};