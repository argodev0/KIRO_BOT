import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Stack,
  Chip,
  Button,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { AdvancedTradingViewChart, PatternOverlayPanel } from '../components/charts';
import { TradingSignal } from '../../types/trading';
import { AnalysisResults, CandlestickPattern } from '../../types/analysis';

const TradingPage: React.FC = () => {
  const [isTrading, setIsTrading] = useState(false);
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [analysisData, setAnalysisData] = useState<AnalysisResults | undefined>();
  const [showPatternPanel, setShowPatternPanel] = useState(true);
  
  const { selectedSymbol, currentPrice, priceChangePercent24h } = useSelector(
    (state: RootState) => state.marketData
  );

  // Mock analysis data with patterns
  useEffect(() => {
    const mockAnalysisData: AnalysisResults = {
      symbol: selectedSymbol,
      timeframe: '1H',
      timestamp: Date.now(),
      technical: {
        rsi: 65,
        waveTrend: {
          wt1: 10,
          wt2: 5,
          signal: 'buy'
        },
        pvt: 1000,
        supportLevels: [48000, 47000],
        resistanceLevels: [52000, 53000],
        trend: 'bullish',
        momentum: 'strong',
        volatility: 25
      },
      patterns: [
        {
          type: 'hammer',
          confidence: 0.85,
          startIndex: 10,
          endIndex: 10,
          direction: 'bullish',
          strength: 'strong',
          description: 'Hammer pattern indicating potential bullish reversal',
          reliability: 0.85
        },
        {
          type: 'engulfing_bearish',
          confidence: 0.75,
          startIndex: 15,
          endIndex: 16,
          direction: 'bearish',
          strength: 'moderate',
          description: 'Bearish engulfing pattern',
          reliability: 0.75
        },
        {
          type: 'morning_star',
          confidence: 0.9,
          startIndex: 20,
          endIndex: 22,
          direction: 'bullish',
          strength: 'strong',
          description: 'Morning star - strong bullish reversal pattern',
          reliability: 0.9
        },
        {
          type: 'doji',
          confidence: 0.65,
          startIndex: 25,
          endIndex: 25,
          direction: 'bullish',
          strength: 'moderate',
          description: 'Doji pattern showing market indecision',
          reliability: 0.65
        }
      ],
      elliottWave: {
        waves: [
          {
            id: 'wave_1',
            type: 'wave_1',
            degree: 'minor',
            startPrice: 45000,
            endPrice: 48000,
            startTime: Date.now() - 86400000,
            endTime: Date.now() - 43200000,
            length: 3000,
            duration: 43200000
          },
          {
            id: 'wave_3',
            type: 'wave_3',
            degree: 'minor',
            startPrice: 46500,
            endPrice: 52000,
            startTime: Date.now() - 21600000,
            endTime: Date.now(),
            length: 5500,
            duration: 21600000
          }
        ],
        currentWave: {
          id: 'wave_3',
          type: 'wave_3',
          degree: 'minor',
          startPrice: 46500,
          endPrice: 52000,
          startTime: Date.now() - 21600000,
          endTime: Date.now(),
          length: 5500,
          duration: 21600000
        },
        waveCount: 3,
        degree: 'minor',
        validity: 0.8,
        nextTargets: [
          {
            price: 54000,
            probability: 0.7,
            type: 'fibonacci_extension',
            description: '161.8% Fibonacci extension'
          }
        ],
        invalidationLevel: 45000
      },
      fibonacci: {
        retracements: [
          {
            ratio: 0.618,
            price: 47418,
            type: 'retracement',
            strength: 1.0,
            description: '61.8% retracement (Golden Ratio)'
          }
        ],
        extensions: [
          {
            ratio: 1.618,
            price: 55909,
            type: 'extension',
            strength: 1.0,
            description: '161.8% extension (Golden Ratio)'
          }
        ],
        timeProjections: [],
        confluenceZones: [],
        highPrice: 52000,
        lowPrice: 45000,
        swingHigh: 52000,
        swingLow: 45000
      },
      confluence: [
        {
          priceLevel: 47500,
          strength: 0.9,
          factors: [
            {
              type: 'fibonacci',
              description: '61.8% retracement',
              weight: 1.0
            }
          ],
          type: 'support',
          reliability: 0.85
        }
      ],
      marketRegime: {
        type: 'trending',
        strength: 0.8,
        duration: 86400000,
        volatility: 'medium',
        volume: 'high',
        confidence: 0.75
      },
      volumeProfile: {
        volumeByPrice: [],
        poc: 49000,
        valueAreaHigh: 51000,
        valueAreaLow: 47000,
        volumeTrend: 'increasing',
        volumeStrength: 0.7
      }
    };

    setAnalysisData(mockAnalysisData);
  }, [selectedSymbol]);

  // Mock trading signals
  useEffect(() => {
    const mockSignals: TradingSignal[] = [
      {
        id: '1',
        symbol: 'BTCUSDT',
        direction: 'long',
        confidence: 0.85,
        entryPrice: 48500,
        stopLoss: 47000,
        takeProfit: [50000, 52000],
        reasoning: {
          technical: {
            indicators: ['RSI oversold', 'MACD bullish crossover'],
            confluence: 0.8,
            trend: 'bullish'
          },
          patterns: {
            detected: ['Hammer', 'Morning Star'],
            strength: 0.9
          },
          elliottWave: {
            currentWave: 'Wave 3',
            wavePosition: 'Impulse',
            validity: 0.85
          },
          fibonacci: {
            levels: [0.618, 0.786],
            confluence: 0.7
          },
          volume: {
            profile: 'Increasing',
            strength: 0.8
          },
          summary: 'Strong bullish signal with multiple pattern confirmations including Hammer and Morning Star'
        },
        timestamp: Date.now() - 300000,
        status: 'active'
      },
      {
        id: '2',
        symbol: 'ETHUSDT',
        direction: 'short',
        confidence: 0.72,
        entryPrice: 3200,
        stopLoss: 3350,
        takeProfit: [3000, 2850],
        reasoning: {
          technical: {
            indicators: ['RSI overbought', 'Bearish divergence'],
            confluence: 0.7,
            trend: 'bearish'
          },
          patterns: {
            detected: ['Bearish Engulfing'],
            strength: 0.8
          },
          elliottWave: {
            currentWave: 'Wave 4',
            wavePosition: 'Corrective',
            validity: 0.75
          },
          fibonacci: {
            levels: [0.382, 0.5],
            confluence: 0.6
          },
          volume: {
            profile: 'Decreasing',
            strength: 0.6
          },
          summary: 'Moderate bearish signal with Bearish Engulfing pattern confirmation'
        },
        timestamp: Date.now() - 600000,
        status: 'pending'
      }
    ];
    setSignals(mockSignals);
  }, []);

  const handleTradingToggle = () => {
    setIsTrading(!isTrading);
  };

  const handleAnalysisUpdate = (newAnalysis: AnalysisResults) => {
    setAnalysisData(newAnalysis);
  };

  const handlePatternToggle = (patternId: string, visible: boolean) => {
    console.log(`Pattern ${patternId} visibility: ${visible}`);
  };

  const handlePatternHighlight = (pattern: CandlestickPattern) => {
    console.log('Highlighting pattern:', pattern);
  };

  const getSignalColor = (direction: 'long' | 'short') => {
    return direction === 'long' ? '#4caf50' : '#f44336';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#4caf50';
      case 'pending': return '#ff9800';
      case 'closed': return '#9e9e9e';
      default: return '#2196f3';
    }
  };

  return (
    <Box sx={{ p: 3, position: 'relative' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ color: '#fff', mb: 1 }}>
          AI Trading Dashboard
        </Typography>
        <Typography variant="body1" sx={{ color: '#aaa' }}>
          Advanced algorithmic trading with Elliott Wave, Fibonacci analysis, and pattern recognition
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Trading Chart */}
        <Grid item xs={12} lg={8}>
          <Paper elevation={2} sx={{ p: 2, backgroundColor: '#1e1e1e', position: 'relative' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: '#fff' }}>
                {selectedSymbol} Advanced Chart
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip
                  label={`$${currentPrice?.toLocaleString()}`}
                  color={priceChangePercent24h >= 0 ? 'success' : 'error'}
                  icon={priceChangePercent24h >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                />
                <Tooltip title="Toggle Pattern Panel">
                  <IconButton 
                    size="small" 
                    sx={{ color: showPatternPanel ? '#4ECDC4' : '#fff' }}
                    onClick={() => setShowPatternPanel(!showPatternPanel)}
                  >
                    <SettingsIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
            
            <AdvancedTradingViewChart 
              height={600}
              analysisData={analysisData}
              onAnalysisUpdate={handleAnalysisUpdate}
            />

            {/* Pattern Overlay Panel */}
            {showPatternPanel && analysisData && (
              <PatternOverlayPanel
                patterns={analysisData.patterns}
                onPatternToggle={handlePatternToggle}
                onPatternHighlight={handlePatternHighlight}
                showConfidenceFilter={true}
                minConfidence={0.5}
              />
            )}
          </Paper>
        </Grid>

        {/* Trading Controls & Signals */}
        <Grid item xs={12} lg={4}>
          <Stack spacing={3}>
            {/* Trading Controls */}
            <Paper elevation={2} sx={{ p: 2, backgroundColor: '#1e1e1e' }}>
              <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
                Trading Controls
              </Typography>
              
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: '#aaa' }}>
                    Status
                  </Typography>
                  <Chip
                    label={isTrading ? 'Active' : 'Stopped'}
                    color={isTrading ? 'success' : 'default'}
                    size="small"
                  />
                </Box>

                <Button
                  variant="contained"
                  color={isTrading ? 'error' : 'success'}
                  startIcon={isTrading ? <StopIcon /> : <PlayIcon />}
                  onClick={handleTradingToggle}
                  fullWidth
                >
                  {isTrading ? 'Stop Trading' : 'Start Trading'}
                </Button>

                {isTrading && (
                  <Button
                    variant="outlined"
                    startIcon={<PauseIcon />}
                    fullWidth
                    sx={{ color: '#fff', borderColor: '#fff' }}
                  >
                    Pause Trading
                  </Button>
                )}
              </Stack>
            </Paper>

            {/* Pattern Analysis Summary */}
            {analysisData && (
              <Paper elevation={2} sx={{ p: 2, backgroundColor: '#1e1e1e' }}>
                <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
                  Pattern Analysis
                </Typography>
                
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#aaa' }}>
                      Patterns Detected
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#fff' }}>
                      {analysisData.patterns.length}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#aaa' }}>
                      Bullish Patterns
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#4caf50' }}>
                      {analysisData.patterns.filter(p => p.direction === 'bullish').length}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#aaa' }}>
                      Current Wave
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#4ECDC4' }}>
                      {analysisData.elliottWave.currentWave.type.replace('wave_', 'Wave ')}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#aaa' }}>
                      Confluence Zones
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#FFD700' }}>
                      {analysisData.confluence.length}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            )}

            {/* Active Signals */}
            <Paper elevation={2} sx={{ p: 2, backgroundColor: '#1e1e1e' }}>
              <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
                Trading Signals
              </Typography>
              
              <Stack spacing={2}>
                {signals.map((signal) => (
                  <Card key={signal.id} sx={{ backgroundColor: '#2a2a2a' }}>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ color: '#fff' }}>
                          {signal.symbol}
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <Chip
                            label={signal.direction.toUpperCase()}
                            size="small"
                            sx={{
                              backgroundColor: getSignalColor(signal.direction),
                              color: '#fff',
                              fontSize: '0.7rem'
                            }}
                          />
                          <Chip
                            label={signal.status}
                            size="small"
                            sx={{
                              backgroundColor: getStatusColor(signal.status),
                              color: '#fff',
                              fontSize: '0.7rem'
                            }}
                          />
                        </Stack>
                      </Box>

                      <Typography variant="body2" sx={{ color: '#aaa', mb: 1 }}>
                        Entry: ${signal.entryPrice.toLocaleString()}
                      </Typography>
                      
                      <Typography variant="body2" sx={{ color: '#aaa', mb: 1 }}>
                        Confidence: {(signal.confidence * 100).toFixed(0)}%
                      </Typography>

                      <Typography variant="caption" sx={{ color: '#888' }}>
                        {signal.reasoning.summary}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Paper>

            {/* Performance Stats */}
            <Paper elevation={2} sx={{ p: 2, backgroundColor: '#1e1e1e' }}>
              <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
                Performance
              </Typography>
              
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: '#aaa' }}>
                    Today's P&L
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#4caf50' }}>
                    +$1,247.50
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: '#aaa' }}>
                    Win Rate
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#fff' }}>
                    73.2%
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: '#aaa' }}>
                    Active Positions
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#fff' }}>
                    3
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: '#aaa' }}>
                    Max Drawdown
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#f44336' }}>
                    -2.1%
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TradingPage;