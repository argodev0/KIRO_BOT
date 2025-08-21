/**
 * Multi-Timeframe Synchronization Component
 * Synchronizes chart analysis across multiple timeframes
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Box, Typography, Chip, Stack, IconButton, Tooltip } from '@mui/material';
import {
  Sync as SyncIcon,
  SyncDisabled as SyncDisabledIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { AnalysisResults } from '../../../types/analysis';

interface MultiTimeframeSyncProps {
  chartWidget: any;
  currentTimeframe: string;
  onTimeframeChange?: (timeframe: string) => void;
  onAnalysisSync?: (timeframe: string, analysis: AnalysisResults) => void;
}

interface TimeframeData {
  timeframe: string;
  analysis?: AnalysisResults;
  lastUpdate: number;
  isActive: boolean;
  consensus: 'bullish' | 'bearish' | 'neutral';
  strength: number;
}

const TIMEFRAME_HIERARCHY = [
  { value: '1m', label: '1M', order: 1 },
  { value: '5m', label: '5M', order: 2 },
  { value: '15m', label: '15M', order: 3 },
  { value: '1h', label: '1H', order: 4 },
  { value: '4h', label: '4H', order: 5 },
  { value: '1d', label: '1D', order: 6 },
  { value: '1w', label: '1W', order: 7 }
];

const MultiTimeframeSync: React.FC<MultiTimeframeSyncProps> = ({
  chartWidget,
  currentTimeframe,
  onTimeframeChange,
  onAnalysisSync
}) => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [timeframeData, setTimeframeData] = useState<Record<string, TimeframeData>>({});
  const [overallConsensus, setOverallConsensus] = useState<{
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: number;
    confluence: number;
  }>({
    direction: 'neutral',
    strength: 0,
    confluence: 0
  });

  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { selectedSymbol } = useSelector((state: RootState) => state.marketData);

  // Initialize timeframe data
  useEffect(() => {
    const initialData: Record<string, TimeframeData> = {};
    
    TIMEFRAME_HIERARCHY.forEach(tf => {
      initialData[tf.value] = {
        timeframe: tf.value,
        lastUpdate: 0,
        isActive: tf.value === currentTimeframe,
        consensus: 'neutral',
        strength: 0
      };
    });

    setTimeframeData(initialData);
  }, [currentTimeframe]);

  // Sync analysis across timeframes
  const syncTimeframeAnalysis = useCallback(async () => {
    if (!isEnabled || !chartWidget || !selectedSymbol) return;

    try {
      const updatedData = { ...timeframeData };
      
      // Get analysis for each timeframe
      for (const tf of TIMEFRAME_HIERARCHY) {
        if (tf.value === currentTimeframe) continue; // Skip current timeframe
        
        try {
          // This would typically call an API to get analysis for the timeframe
          const analysis = await fetchTimeframeAnalysis(selectedSymbol, tf.value);
          
          if (analysis) {
            updatedData[tf.value] = {
              ...updatedData[tf.value],
              analysis,
              lastUpdate: Date.now(),
              consensus: determineConsensus(analysis),
              strength: calculateStrength(analysis)
            };

            // Notify parent component
            if (onAnalysisSync) {
              onAnalysisSync(tf.value, analysis);
            }
          }
        } catch (error) {
          console.warn(`Failed to sync analysis for ${tf.value}:`, error);
        }
      }

      setTimeframeData(updatedData);
      
      // Calculate overall consensus
      const consensus = calculateOverallConsensus(Object.values(updatedData));
      setOverallConsensus(consensus);

    } catch (error) {
      console.error('Failed to sync timeframe analysis:', error);
    }
  }, [isEnabled, chartWidget, selectedSymbol, timeframeData, currentTimeframe, onAnalysisSync]);

  // Start/stop sync interval
  useEffect(() => {
    if (isEnabled) {
      // Initial sync
      syncTimeframeAnalysis();
      
      // Set up periodic sync
      syncIntervalRef.current = setInterval(syncTimeframeAnalysis, 60000); // Sync every minute
    } else {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [isEnabled, syncTimeframeAnalysis]);

  // Handle timeframe change
  const handleTimeframeChange = (timeframe: string) => {
    if (!chartWidget) return;

    try {
      // Update chart timeframe
      chartWidget.setSymbol(`BINANCE:${selectedSymbol}`, timeframe);
      
      // Update active timeframe
      setTimeframeData(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(tf => {
          updated[tf].isActive = tf === timeframe;
        });
        return updated;
      });

      // Notify parent
      if (onTimeframeChange) {
        onTimeframeChange(timeframe);
      }
    } catch (error) {
      console.error('Failed to change timeframe:', error);
    }
  };

  // Toggle sync
  const toggleSync = () => {
    setIsEnabled(!isEnabled);
  };

  // Get consensus color
  const getConsensusColor = (consensus: string, strength: number) => {
    const alpha = Math.max(0.3, strength);
    
    switch (consensus) {
      case 'bullish':
        return `rgba(0, 255, 0, ${alpha})`;
      case 'bearish':
        return `rgba(255, 0, 0, ${alpha})`;
      default:
        return `rgba(128, 128, 128, ${alpha})`;
    }
  };

  // Get timeframe display order
  const getTimeframeOrder = (timeframe: string) => {
    return TIMEFRAME_HIERARCHY.find(tf => tf.value === timeframe)?.order || 999;
  };

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 60,
        right: 10,
        backgroundColor: 'rgba(26, 26, 26, 0.9)',
        borderRadius: 2,
        p: 1,
        minWidth: 200,
        backdropFilter: 'blur(10px)',
        border: '1px solid #2a2a2a',
        zIndex: 1000
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <TimelineIcon sx={{ color: '#4ECDC4', fontSize: 16 }} />
          <Typography variant="caption" sx={{ color: '#fff', fontWeight: 'bold' }}>
            Multi-Timeframe
          </Typography>
        </Stack>

        <Tooltip title={isEnabled ? 'Disable Sync' : 'Enable Sync'}>
          <IconButton
            size="small"
            onClick={toggleSync}
            sx={{
              color: isEnabled ? '#4ECDC4' : '#666',
              '&:hover': { backgroundColor: 'rgba(78, 205, 196, 0.1)' }
            }}
          >
            {isEnabled ? <SyncIcon fontSize="small" /> : <SyncDisabledIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Overall Consensus */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" sx={{ color: '#aaa', display: 'block' }}>
          Overall Consensus
        </Typography>
        <Chip
          label={`${overallConsensus.direction.toUpperCase()} (${(overallConsensus.strength * 100).toFixed(0)}%)`}
          size="small"
          sx={{
            backgroundColor: getConsensusColor(overallConsensus.direction, overallConsensus.strength),
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '0.7rem'
          }}
        />
        <Typography variant="caption" sx={{ color: '#aaa', display: 'block', mt: 0.5 }}>
          Confluence: {(overallConsensus.confluence * 100).toFixed(0)}%
        </Typography>
      </Box>

      {/* Timeframe List */}
      <Stack spacing={0.5}>
        {TIMEFRAME_HIERARCHY
          .sort((a, b) => b.order - a.order) // Show higher timeframes first
          .map(tf => {
            const data = timeframeData[tf.value];
            if (!data) return null;

            return (
              <Box
                key={tf.value}
                onClick={() => handleTimeframeChange(tf.value)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 0.5,
                  borderRadius: 1,
                  cursor: 'pointer',
                  backgroundColor: data.isActive ? 'rgba(78, 205, 196, 0.2)' : 'transparent',
                  border: data.isActive ? '1px solid #4ECDC4' : '1px solid transparent',
                  '&:hover': {
                    backgroundColor: 'rgba(78, 205, 196, 0.1)'
                  }
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: data.isActive ? '#4ECDC4' : '#fff',
                    fontWeight: data.isActive ? 'bold' : 'normal',
                    fontSize: '0.75rem'
                  }}
                >
                  {tf.label}
                </Typography>

                <Stack direction="row" spacing={0.5} alignItems="center">
                  {/* Consensus indicator */}
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: getConsensusColor(data.consensus, data.strength)
                    }}
                  />

                  {/* Strength indicator */}
                  <Typography
                    variant="caption"
                    sx={{
                      color: '#aaa',
                      fontSize: '0.65rem',
                      minWidth: 25,
                      textAlign: 'right'
                    }}
                  >
                    {(data.strength * 100).toFixed(0)}%
                  </Typography>

                  {/* Last update indicator */}
                  {data.lastUpdate > 0 && (
                    <Box
                      sx={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        backgroundColor: Date.now() - data.lastUpdate < 120000 ? '#4ECDC4' : '#666' // Green if updated within 2 minutes
                      }}
                    />
                  )}
                </Stack>
              </Box>
            );
          })}
      </Stack>

      {/* Sync Status */}
      {isEnabled && (
        <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #2a2a2a' }}>
          <Typography variant="caption" sx={{ color: '#aaa', fontSize: '0.65rem' }}>
            Last sync: {new Date().toLocaleTimeString()}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// Helper functions

async function fetchTimeframeAnalysis(symbol: string, timeframe: string): Promise<AnalysisResults | null> {
  try {
    // This would typically make an API call to get analysis data
    // For now, return mock data
    console.log(`Fetching analysis for ${symbol} on ${timeframe}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Return mock analysis data
    return {
      symbol,
      timeframe,
      timestamp: Date.now(),
      technical: {
        rsi: Math.random() * 100,
        waveTrend: {
          wt1: Math.random() * 200 - 100,
          wt2: Math.random() * 200 - 100,
          signal: Math.random() > 0.5 ? 'buy' : 'sell'
        },
        pvt: Math.random() * 1000,
        supportLevels: [45000, 46000],
        resistanceLevels: [48000, 49000],
        trend: Math.random() > 0.5 ? 'bullish' : 'bearish',
        momentum: 'strong',
        volatility: Math.random() * 100
      },
      patterns: [],
      elliottWave: {
        waves: [],
        currentWave: {
          id: 'wave_3',
          type: 'wave_3',
          degree: 'minor',
          startPrice: 45000,
          endPrice: 48000,
          startTime: Date.now() - 86400000,
          endTime: Date.now(),
          length: 3000,
          duration: 86400000
        },
        waveCount: 3,
        degree: 'minor',
        validity: Math.random(),
        nextTargets: [],
        invalidationLevel: 44000
      },
      fibonacci: {
        retracements: [],
        extensions: [],
        timeProjections: [],
        confluenceZones: [],
        highPrice: 49000,
        lowPrice: 45000,
        swingHigh: 49000,
        swingLow: 45000
      },
      confluence: [],
      marketRegime: {
        type: 'trending',
        strength: Math.random(),
        duration: 86400000,
        volatility: 'medium',
        volume: 'high',
        confidence: Math.random()
      },
      volumeProfile: {
        volumeByPrice: [],
        poc: 47000,
        valueAreaHigh: 48000,
        valueAreaLow: 46000,
        volumeTrend: 'increasing',
        volumeStrength: Math.random()
      }
    };
  } catch (error) {
    console.error(`Failed to fetch analysis for ${symbol} ${timeframe}:`, error);
    return null;
  }
}

function determineConsensus(analysis: AnalysisResults): 'bullish' | 'bearish' | 'neutral' {
  let bullishSignals = 0;
  let bearishSignals = 0;
  let totalSignals = 0;

  // Technical indicators
  if (analysis.technical.trend === 'bullish') bullishSignals++;
  else if (analysis.technical.trend === 'bearish') bearishSignals++;
  totalSignals++;

  // RSI
  if (analysis.technical.rsi < 30) bullishSignals++; // Oversold
  else if (analysis.technical.rsi > 70) bearishSignals++; // Overbought
  totalSignals++;

  // Wave Trend
  if (analysis.technical.waveTrend.signal === 'buy') bullishSignals++;
  else if (analysis.technical.waveTrend.signal === 'sell') bearishSignals++;
  totalSignals++;

  // Elliott Wave
  const currentWaveType = analysis.elliottWave.currentWave.type;
  if (['wave_1', 'wave_3', 'wave_5'].includes(currentWaveType)) bullishSignals++;
  else if (['wave_2', 'wave_4', 'wave_a', 'wave_c'].includes(currentWaveType)) bearishSignals++;
  totalSignals++;

  // Patterns
  const bullishPatterns = analysis.patterns.filter(p => p.direction === 'bullish').length;
  const bearishPatterns = analysis.patterns.filter(p => p.direction === 'bearish').length;
  
  if (bullishPatterns > bearishPatterns) bullishSignals++;
  else if (bearishPatterns > bullishPatterns) bearishSignals++;
  totalSignals++;

  // Determine consensus
  const bullishRatio = bullishSignals / totalSignals;
  const bearishRatio = bearishSignals / totalSignals;

  if (bullishRatio > 0.6) return 'bullish';
  if (bearishRatio > 0.6) return 'bearish';
  return 'neutral';
}

function calculateStrength(analysis: AnalysisResults): number {
  let strength = 0;
  let factors = 0;

  // Technical strength
  if (analysis.technical.momentum === 'strong') strength += 0.8;
  else if (analysis.technical.momentum === 'weak') strength += 0.2;
  else strength += 0.5;
  factors++;

  // Elliott Wave validity
  strength += analysis.elliottWave.validity;
  factors++;

  // Pattern confidence
  if (analysis.patterns.length > 0) {
    const avgPatternConfidence = analysis.patterns.reduce((sum, p) => sum + p.confidence, 0) / analysis.patterns.length;
    strength += avgPatternConfidence;
    factors++;
  }

  // Market regime confidence
  strength += analysis.marketRegime.confidence;
  factors++;

  return factors > 0 ? strength / factors : 0;
}

function calculateOverallConsensus(timeframeData: TimeframeData[]): {
  direction: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  confluence: number;
} {
  const validData = timeframeData.filter(data => data.analysis && data.lastUpdate > 0);
  
  if (validData.length === 0) {
    return { direction: 'neutral', strength: 0, confluence: 0 };
  }

  let bullishCount = 0;
  let bearishCount = 0;
  let totalStrength = 0;

  validData.forEach(data => {
    if (data.consensus === 'bullish') bullishCount++;
    else if (data.consensus === 'bearish') bearishCount++;
    totalStrength += data.strength;
  });

  const avgStrength = totalStrength / validData.length;
  const confluence = Math.max(bullishCount, bearishCount) / validData.length;

  let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (bullishCount > bearishCount && confluence > 0.6) direction = 'bullish';
  else if (bearishCount > bullishCount && confluence > 0.6) direction = 'bearish';

  return {
    direction,
    strength: avgStrength,
    confluence
  };
}

export default MultiTimeframeSync;