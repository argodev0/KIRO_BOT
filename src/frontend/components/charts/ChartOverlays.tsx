/**
 * Chart Overlays Component
 * Renders Elliott Wave, Fibonacci, and pattern overlays on TradingView charts
 */

import React, { useEffect, useRef, useCallback } from 'react';
// import { Box, Typography, Chip, Stack } from '@mui/material';
// import { useSelector } from 'react-redux';
// import { RootState } from '../../store/store';
import {
  WaveStructure,
  FibonacciLevels,
  CandlestickPattern,
  ConfluenceZone,
  AnalysisResults
} from '../../../types/analysis';

interface ChartOverlaysProps {
  chartWidget: any; // TradingView widget instance
  analysisData?: AnalysisResults;
  showElliottWave?: boolean;
  showFibonacci?: boolean;
  showPatterns?: boolean;
  showConfluence?: boolean;
}

interface OverlayDrawing {
  id: string;
  type: 'line' | 'text' | 'shape' | 'fibonacci';
  data: any;
}

const ChartOverlays: React.FC<ChartOverlaysProps> = ({
  chartWidget,
  analysisData,
  showElliottWave = true,
  showFibonacci = true,
  showPatterns = true,
  showConfluence = true
}) => {
  const overlayRef = useRef<OverlayDrawing[]>([]);
  // const { selectedSymbol, selectedTimeframe } = useSelector((state: RootState) => state.marketData);

  // Clear all overlays
  const clearOverlays = useCallback(() => {
    if (!chartWidget) return;

    try {
      const chart = chartWidget.chart();
      overlayRef.current.forEach(overlay => {
        try {
          chart.removeEntity(overlay.id);
        } catch (error) {
          console.warn('Failed to remove overlay:', overlay.id, error);
        }
      });
      overlayRef.current = [];
    } catch (error) {
      console.error('Failed to clear overlays:', error);
    }
  }, [chartWidget]);

  // Draw Elliott Wave overlays
  const drawElliottWaveOverlays = useCallback((waveStructure: WaveStructure) => {
    if (!chartWidget || !showElliottWave) return;

    try {
      const chart = chartWidget.chart();
      
      waveStructure.waves.forEach((wave) => {
        // Draw wave line with enhanced styling
        const lineId = `elliott_wave_${wave.id}`;
        const line = chart.createShape(
          { time: wave.startTime / 1000, price: wave.startPrice },
          {
            shape: 'trend_line',
            lock: true,
            disableSelection: true,
            disableUndo: true,
            overrides: {
              linecolor: getWaveColor(wave.type),
              linewidth: getWaveLineWidth(wave.degree),
              linestyle: getWaveLineStyle(wave.type),
              transparency: 0,
            }
          }
        );
        
        if (line) {
          line.setPoints([
            { time: wave.startTime / 1000, price: wave.startPrice },
            { time: wave.endTime / 1000, price: wave.endPrice }
          ]);
          
          overlayRef.current.push({
            id: lineId,
            type: 'line',
            data: wave
          });
        }

        // Draw wave label with enhanced positioning
        const labelId = `elliott_label_${wave.id}`;
        const midTime = (wave.startTime + wave.endTime) / 2000;
        const labelPrice = getLabelPosition(wave);
        
        const label = chart.createShape(
          { time: midTime, price: labelPrice },
          {
            shape: 'text',
            lock: true,
            disableSelection: true,
            disableUndo: true,
            text: getWaveLabel(wave.type, wave.degree),
            overrides: {
              color: getWaveColor(wave.type),
              fontsize: getWaveFontSize(wave.degree),
              bold: true,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              borderColor: getWaveColor(wave.type),
              borderWidth: 1,
            }
          }
        );

        if (label) {
          overlayRef.current.push({
            id: labelId,
            type: 'text',
            data: wave
          });
        }

        // Draw Fibonacci projections for wave targets
        if (wave.fibonacciRatio) {
          const fibId = `wave_fib_${wave.id}`;
          const fibLine = chart.createShape(
            { time: wave.endTime / 1000, price: wave.endPrice },
            {
              shape: 'horizontal_line',
              lock: true,
              disableSelection: true,
              disableUndo: true,
              overrides: {
                linecolor: '#FFD700',
                linewidth: 1,
                linestyle: 1, // dashed
                transparency: 30,
              }
            }
          );

          if (fibLine) {
            overlayRef.current.push({
              id: fibId,
              type: 'line',
              data: { ...wave, isFibonacci: true }
            });
          }
        }
      });

      // Highlight current wave with enhanced styling
      if (waveStructure.currentWave) {
        const currentWaveId = `current_wave_highlight`;
        const highlight = chart.createShape(
          { time: waveStructure.currentWave.startTime / 1000, price: waveStructure.currentWave.startPrice },
          {
            shape: 'trend_line',
            lock: true,
            disableSelection: true,
            disableUndo: true,
            overrides: {
              linecolor: '#FFD700', // Gold color for current wave
              linewidth: 4,
              linestyle: 2, // dashed line
              transparency: 0,
            }
          }
        );

        if (highlight) {
          highlight.setPoints([
            { time: waveStructure.currentWave.startTime / 1000, price: waveStructure.currentWave.startPrice },
            { time: waveStructure.currentWave.endTime / 1000, price: waveStructure.currentWave.endTime }
          ]);

          overlayRef.current.push({
            id: currentWaveId,
            type: 'line',
            data: waveStructure.currentWave
          });
        }

        // Add current wave progress indicator
        const progressId = `wave_progress_${waveStructure.currentWave.id}`;
        const progressIndicator = chart.createShape(
          { time: waveStructure.currentWave.endTime / 1000, price: waveStructure.currentWave.endPrice },
          {
            shape: 'arrow_up',
            lock: true,
            disableSelection: true,
            disableUndo: true,
            overrides: {
              color: '#FFD700',
              transparency: 20,
            }
          }
        );

        if (progressIndicator) {
          overlayRef.current.push({
            id: progressId,
            type: 'shape',
            data: waveStructure.currentWave
          });
        }
      }

      // Draw wave targets
      waveStructure.nextTargets.forEach((target, index) => {
        const targetId = `wave_target_${index}`;
        const targetLine = chart.createShape(
          { time: Date.now() / 1000, price: target.price },
          {
            shape: 'horizontal_line',
            lock: true,
            disableSelection: true,
            disableUndo: true,
            overrides: {
              linecolor: getTargetColor(target.probability),
              linewidth: 2,
              linestyle: 1, // dashed
              transparency: 20,
            }
          }
        );

        if (targetLine) {
          overlayRef.current.push({
            id: targetId,
            type: 'line',
            data: target
          });
        }

        // Add target label
        const targetLabelId = `target_label_${index}`;
        const targetLabel = chart.createShape(
          { time: Date.now() / 1000, price: target.price },
          {
            shape: 'text',
            lock: true,
            disableSelection: true,
            disableUndo: true,
            text: `Target: ${target.price.toFixed(0)} (${(target.probability * 100).toFixed(0)}%)`,
            overrides: {
              color: getTargetColor(target.probability),
              fontsize: 10,
              horzAlign: 'right',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
            }
          }
        );

        if (targetLabel) {
          overlayRef.current.push({
            id: targetLabelId,
            type: 'text',
            data: target
          });
        }
      });

    } catch (error) {
      console.error('Failed to draw Elliott Wave overlays:', error);
    }
  }, [chartWidget, showElliottWave]);

  // Draw Fibonacci overlays
  const drawFibonacciOverlays = useCallback((fibonacciLevels: FibonacciLevels) => {
    if (!chartWidget || !showFibonacci) return;

    try {
      const chart = chartWidget.chart();
      
      // Draw main Fibonacci retracement tool
      const fibRetracementId = 'main_fib_retracement';
      const fibRetracement = chart.createStudy('Fibonacci Retracement', false, false, undefined, {
        'style.linecolor': '#FFD700',
        'style.linewidth': 2,
        'levels.0.color': getFibonacciColor(0.236, 'retracement'),
        'levels.1.color': getFibonacciColor(0.382, 'retracement'),
        'levels.2.color': getFibonacciColor(0.5, 'retracement'),
        'levels.3.color': getFibonacciColor(0.618, 'retracement'),
        'levels.4.color': getFibonacciColor(0.786, 'retracement'),
      });

      if (fibRetracement) {
        overlayRef.current.push({
          id: fibRetracementId,
          type: 'fibonacci',
          data: { type: 'retracement', levels: fibonacciLevels.retracements }
        });
      }

      // Draw individual retracement levels with enhanced styling
      fibonacciLevels.retracements.forEach((level, index) => {
        const lineId = `fib_retracement_${index}`;
        const isGoldenRatio = Math.abs(level.ratio - 0.618) < 0.001;
        const isHalfRetracement = Math.abs(level.ratio - 0.5) < 0.001;
        
        const line = chart.createShape(
          { time: Date.now() / 1000 - 86400, price: level.price },
          {
            shape: 'horizontal_line',
            lock: true,
            disableSelection: true,
            disableUndo: true,
            overrides: {
              linecolor: getFibonacciColor(level.ratio, 'retracement'),
              linewidth: isGoldenRatio ? 3 : isHalfRetracement ? 2 : 1,
              linestyle: isGoldenRatio ? 0 : 1, // Solid for golden ratio
              transparency: isGoldenRatio ? 0 : 20,
            }
          }
        );

        if (line) {
          overlayRef.current.push({
            id: lineId,
            type: 'line',
            data: level
          });
        }

        // Add enhanced level label
        const labelId = `fib_retracement_label_${index}`;
        const labelText = isGoldenRatio 
          ? `${(level.ratio * 100).toFixed(1)}% (Golden Ratio)` 
          : `${(level.ratio * 100).toFixed(1)}%`;
        
        const label = chart.createShape(
          { time: Date.now() / 1000, price: level.price },
          {
            shape: 'text',
            lock: true,
            disableSelection: true,
            disableUndo: true,
            text: labelText,
            overrides: {
              color: getFibonacciColor(level.ratio, 'retracement'),
              fontsize: isGoldenRatio ? 12 : 10,
              bold: isGoldenRatio,
              horzAlign: 'right',
              backgroundColor: isGoldenRatio ? 'rgba(255, 215, 0, 0.2)' : 'rgba(0, 0, 0, 0.7)',
              borderColor: getFibonacciColor(level.ratio, 'retracement'),
              borderWidth: isGoldenRatio ? 2 : 1,
            }
          }
        );

        if (label) {
          overlayRef.current.push({
            id: labelId,
            type: 'text',
            data: level
          });
        }

        // Add strength indicator for high-strength levels
        if (level.strength > 0.8) {
          const strengthId = `fib_strength_${index}`;
          const strengthIndicator = chart.createShape(
            { time: Date.now() / 1000 - 43200, price: level.price },
            {
              shape: 'circle',
              lock: true,
              disableSelection: true,
              disableUndo: true,
              overrides: {
                color: getFibonacciColor(level.ratio, 'retracement'),
                transparency: 50,
              }
            }
          );

          if (strengthIndicator) {
            overlayRef.current.push({
              id: strengthId,
              type: 'shape',
              data: level
            });
          }
        }
      });

      // Draw extension levels with enhanced styling
      fibonacciLevels.extensions.forEach((level, index) => {
        const lineId = `fib_extension_${index}`;
        const isGoldenExtension = Math.abs(level.ratio - 1.618) < 0.001;
        
        const line = chart.createShape(
          { time: Date.now() / 1000 - 86400, price: level.price },
          {
            shape: 'horizontal_line',
            lock: true,
            disableSelection: true,
            disableUndo: true,
            overrides: {
              linecolor: getFibonacciColor(level.ratio, 'extension'),
              linewidth: isGoldenExtension ? 3 : 1,
              linestyle: isGoldenExtension ? 0 : 2, // Solid for golden ratio extension
              transparency: isGoldenExtension ? 0 : 30,
            }
          }
        );

        if (line) {
          overlayRef.current.push({
            id: lineId,
            type: 'line',
            data: level
          });
        }

        // Add enhanced extension label
        const labelId = `fib_extension_label_${index}`;
        const labelText = isGoldenExtension 
          ? `${(level.ratio * 100).toFixed(1)}% (Golden Extension)` 
          : `${(level.ratio * 100).toFixed(1)}%`;
        
        const label = chart.createShape(
          { time: Date.now() / 1000, price: level.price },
          {
            shape: 'text',
            lock: true,
            disableSelection: true,
            disableUndo: true,
            text: labelText,
            overrides: {
              color: getFibonacciColor(level.ratio, 'extension'),
              fontsize: isGoldenExtension ? 12 : 10,
              bold: isGoldenExtension,
              horzAlign: 'right',
              backgroundColor: isGoldenExtension ? 'rgba(255, 215, 0, 0.2)' : 'rgba(0, 0, 0, 0.7)',
              borderColor: getFibonacciColor(level.ratio, 'extension'),
              borderWidth: isGoldenExtension ? 2 : 1,
            }
          }
        );

        if (label) {
          overlayRef.current.push({
            id: labelId,
            type: 'text',
            data: level
          });
        }
      });

      // Draw Fibonacci fan if we have enough data
      if (fibonacciLevels.retracements.length > 2) {
        const fanId = 'fibonacci_fan';
        const fibFan = chart.createStudy('Fibonacci Fan', false, false, undefined, {
          'style.linecolor': '#FFD700',
          'style.linewidth': 1,
          'style.transparency': 50,
        });

        if (fibFan) {
          overlayRef.current.push({
            id: fanId,
            type: 'fibonacci',
            data: { type: 'fan', levels: fibonacciLevels.retracements }
          });
        }
      }

      // Highlight confluence zones created by Fibonacci levels
      fibonacciLevels.confluenceZones.forEach((zone, index) => {
        const zoneId = `fib_confluence_${index}`;
        const confluenceBox = chart.createShape(
          { time: Date.now() / 1000 - 86400, price: zone.priceLevel - 50 },
          {
            shape: 'rectangle',
            lock: true,
            disableSelection: true,
            disableUndo: true,
            overrides: {
              color: '#FFD700',
              transparency: 70,
              borderColor: '#FFD700',
              borderWidth: 2,
            }
          }
        );

        if (confluenceBox) {
          confluenceBox.setPoints([
            { time: Date.now() / 1000 - 86400, price: zone.priceLevel - 50 },
            { time: Date.now() / 1000, price: zone.priceLevel + 50 }
          ]);

          overlayRef.current.push({
            id: zoneId,
            type: 'shape',
            data: zone
          });
        }
      });

    } catch (error) {
      console.error('Failed to draw Fibonacci overlays:', error);
    }
  }, [chartWidget, showFibonacci]);

  // Draw pattern overlays
  const drawPatternOverlays = useCallback((patterns: CandlestickPattern[]) => {
    if (!chartWidget || !showPatterns) return;

    try {
      const chart = chartWidget.chart();
      
      patterns.forEach((pattern, index) => {
        // Calculate pattern timing and positioning
        const patternDuration = (pattern.endIndex - pattern.startIndex + 1) * 3600; // 1 hour per candle
        const startTime = Date.now() / 1000 - patternDuration;
        const endTime = Date.now() / 1000;
        
        // Estimate price range based on pattern type and market data
        const priceRange = getPatternPriceRange(pattern);
        const centerPrice = getCurrentPrice(); // This would come from market data
        
        // Create pattern highlight box with enhanced styling
        const boxId = `pattern_${pattern.type}_${index}`;
        const box = chart.createShape(
          { time: startTime, price: centerPrice - priceRange / 2 },
          {
            shape: 'rectangle',
            lock: true,
            disableSelection: true,
            disableUndo: true,
            overrides: {
              color: getPatternColor(pattern.direction),
              transparency: getPatternTransparency(pattern.strength),
              borderColor: getPatternBorderColor(pattern.direction, pattern.strength),
              borderWidth: getPatternBorderWidth(pattern.strength),
            }
          }
        );

        if (box) {
          box.setPoints([
            { time: startTime, price: centerPrice - priceRange / 2 },
            { time: endTime, price: centerPrice + priceRange / 2 }
          ]);

          overlayRef.current.push({
            id: boxId,
            type: 'shape',
            data: pattern
          });
        }

        // Add pattern label with confidence indicator
        const labelId = `pattern_label_${index}`;
        const labelText = `${getPatternDisplayName(pattern.type)} (${(pattern.confidence * 100).toFixed(0)}%)`;
        
        const label = chart.createShape(
          { time: (startTime + endTime) / 2, price: centerPrice + priceRange / 2 + 100 },
          {
            shape: 'text',
            lock: true,
            disableSelection: true,
            disableUndo: true,
            text: labelText,
            overrides: {
              color: getPatternColor(pattern.direction),
              fontsize: getPatternFontSize(pattern.strength),
              bold: pattern.strength === 'strong',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              borderColor: getPatternColor(pattern.direction),
              borderWidth: 1,
              horzAlign: 'center',
            }
          }
        );

        if (label) {
          overlayRef.current.push({
            id: labelId,
            type: 'text',
            data: pattern
          });
        }

        // Add pattern strength indicator
        const strengthId = `pattern_strength_${index}`;
        const strengthIcon = getPatternStrengthIcon(pattern.strength);
        
        if (strengthIcon) {
          const strengthIndicator = chart.createShape(
            { time: startTime - 1800, price: centerPrice },
            {
              shape: strengthIcon,
              lock: true,
              disableSelection: true,
              disableUndo: true,
              overrides: {
                color: getPatternStrengthColor(pattern.strength),
                transparency: 20,
              }
            }
          );

          if (strengthIndicator) {
            overlayRef.current.push({
              id: strengthId,
              type: 'shape',
              data: pattern
            });
          }
        }

        // Add pattern direction arrow
        const arrowId = `pattern_arrow_${index}`;
        const arrowShape = pattern.direction === 'bullish' ? 'arrow_up' : 'arrow_down';
        const arrowPrice = pattern.direction === 'bullish' 
          ? centerPrice + priceRange / 2 + 50
          : centerPrice - priceRange / 2 - 50;
        
        const arrow = chart.createShape(
          { time: endTime + 900, price: arrowPrice },
          {
            shape: arrowShape,
            lock: true,
            disableSelection: true,
            disableUndo: true,
            overrides: {
              color: getPatternColor(pattern.direction),
              transparency: 30,
            }
          }
        );

        if (arrow) {
          overlayRef.current.push({
            id: arrowId,
            type: 'shape',
            data: pattern
          });
        }

        // Add reliability indicator for high-reliability patterns
        if (pattern.reliability > 0.8) {
          const reliabilityId = `pattern_reliability_${index}`;
          const reliabilityIndicator = chart.createShape(
            { time: startTime - 3600, price: centerPrice + priceRange / 2 },
            {
              shape: 'circle',
              lock: true,
              disableSelection: true,
              disableUndo: true,
              overrides: {
                color: '#FFD700',
                transparency: 40,
              }
            }
          );

          if (reliabilityIndicator) {
            overlayRef.current.push({
              id: reliabilityId,
              type: 'shape',
              data: pattern
            });
          }
        }
      });

    } catch (error) {
      console.error('Failed to draw pattern overlays:', error);
    }
  }, [chartWidget, showPatterns]);

  // Draw confluence zone overlays
  const drawConfluenceOverlays = useCallback((confluenceZones: ConfluenceZone[]) => {
    if (!chartWidget || !showConfluence) return;

    try {
      const chart = chartWidget.chart();
      
      confluenceZones.forEach((zone, index) => {
        // Create confluence zone as a highlighted area
        const zoneId = `confluence_zone_${index}`;
        const zoneHeight = 100; // Price range for the zone
        
        const confluenceBox = chart.createShape(
          { time: Date.now() / 1000 - 86400, price: zone.priceLevel - zoneHeight / 2 },
          {
            shape: 'rectangle',
            lock: true,
            disableSelection: true,
            disableUndo: true,
            overrides: {
              color: getConfluenceZoneColor(zone.strength),
              transparency: getConfluenceTransparency(zone.strength),
              borderColor: getConfluenceColor(zone.strength),
              borderWidth: Math.max(2, Math.floor(zone.strength * 4)),
            }
          }
        );

        if (confluenceBox) {
          confluenceBox.setPoints([
            { time: Date.now() / 1000 - 86400, price: zone.priceLevel - zoneHeight / 2 },
            { time: Date.now() / 1000, price: zone.priceLevel + zoneHeight / 2 }
          ]);

          overlayRef.current.push({
            id: zoneId,
            type: 'shape',
            data: zone
          });
        }

        // Add main confluence line
        const lineId = `confluence_line_${index}`;
        const line = chart.createShape(
          { time: Date.now() / 1000 - 86400, price: zone.priceLevel },
          {
            shape: 'horizontal_line',
            lock: true,
            disableSelection: true,
            disableUndo: true,
            overrides: {
              linecolor: getConfluenceColor(zone.strength),
              linewidth: Math.max(3, zone.strength * 5),
              linestyle: 0,
              transparency: 0,
            }
          }
        );

        if (line) {
          overlayRef.current.push({
            id: lineId,
            type: 'line',
            data: zone
          });
        }

        // Add detailed confluence label with factor breakdown
        const labelId = `confluence_label_${index}`;
        const factorSummary = zone.factors.map(f => f.type).join(', ');
        const labelText = `${zone.type.toUpperCase()} Confluence\n${zone.factors.length} factors: ${factorSummary}\nStrength: ${(zone.strength * 100).toFixed(0)}%`;
        
        const label = chart.createShape(
          { time: Date.now() / 1000 - 21600, price: zone.priceLevel },
          {
            shape: 'text',
            lock: true,
            disableSelection: true,
            disableUndo: true,
            text: labelText,
            overrides: {
              color: getConfluenceColor(zone.strength),
              fontsize: getConfluenceFontSize(zone.strength),
              bold: zone.strength > 0.8,
              horzAlign: 'left',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              borderColor: getConfluenceColor(zone.strength),
              borderWidth: 2,
            }
          }
        );

        if (label) {
          overlayRef.current.push({
            id: labelId,
            type: 'text',
            data: zone
          });
        }

        // Add individual factor indicators
        zone.factors.forEach((factor, factorIndex) => {
          const factorId = `confluence_factor_${index}_${factorIndex}`;
          const factorPrice = zone.priceLevel + (factorIndex - zone.factors.length / 2) * 20;
          
          const factorIndicator = chart.createShape(
            { time: Date.now() / 1000 - 43200, price: factorPrice },
            {
              shape: getFactorShape(factor.type),
              lock: true,
              disableSelection: true,
              disableUndo: true,
              overrides: {
                color: getFactorColor(factor.type),
                transparency: 30,
              }
            }
          );

          if (factorIndicator) {
            overlayRef.current.push({
              id: factorId,
              type: 'shape',
              data: factor
            });
          }
        });

        // Add strength meter for high-strength zones
        if (zone.strength > 0.7) {
          const meterId = `confluence_meter_${index}`;
          const meterBars = Math.floor(zone.strength * 5);
          
          for (let bar = 0; bar < meterBars; bar++) {
            const barId = `${meterId}_bar_${bar}`;
            const barPrice = zone.priceLevel + zoneHeight / 2 + 50 + (bar * 10);
            
            const strengthBar = chart.createShape(
              { time: Date.now() / 1000 - 10800, price: barPrice },
              {
                shape: 'rectangle',
                lock: true,
                disableSelection: true,
                disableUndo: true,
                overrides: {
                  color: getStrengthBarColor(bar, meterBars),
                  transparency: 20,
                  borderColor: getStrengthBarColor(bar, meterBars),
                  borderWidth: 1,
                }
              }
            );

            if (strengthBar) {
              strengthBar.setPoints([
                { time: Date.now() / 1000 - 10800, price: barPrice },
                { time: Date.now() / 1000 - 9000, price: barPrice + 8 }
              ]);

              overlayRef.current.push({
                id: barId,
                type: 'shape',
                data: { type: 'strength_bar', value: bar }
              });
            }
          }
        }

        // Add reliability indicator
        if (zone.reliability > 0.8) {
          const reliabilityId = `confluence_reliability_${index}`;
          const reliabilityIndicator = chart.createShape(
            { time: Date.now() / 1000 - 7200, price: zone.priceLevel },
            {
              shape: 'circle',
              lock: true,
              disableSelection: true,
              disableUndo: true,
              overrides: {
                color: '#FFD700',
                transparency: 40,
              }
            }
          );

          if (reliabilityIndicator) {
            overlayRef.current.push({
              id: reliabilityId,
              type: 'shape',
              data: { type: 'reliability', value: zone.reliability }
            });
          }
        }
      });

    } catch (error) {
      console.error('Failed to draw confluence overlays:', error);
    }
  }, [chartWidget, showConfluence]);

  // Update overlays when analysis data changes
  useEffect(() => {
    if (!analysisData || !chartWidget) return;

    // Clear existing overlays
    clearOverlays();

    // Draw new overlays
    if (showElliottWave && analysisData.elliottWave) {
      drawElliottWaveOverlays(analysisData.elliottWave);
    }

    if (showFibonacci && analysisData.fibonacci) {
      drawFibonacciOverlays(analysisData.fibonacci);
    }

    if (showPatterns && analysisData.patterns) {
      drawPatternOverlays(analysisData.patterns);
    }

    if (showConfluence && analysisData.confluence) {
      drawConfluenceOverlays(analysisData.confluence);
    }

  }, [
    analysisData,
    chartWidget,
    showElliottWave,
    showFibonacci,
    showPatterns,
    showConfluence,
    clearOverlays,
    drawElliottWaveOverlays,
    drawFibonacciOverlays,
    drawPatternOverlays,
    drawConfluenceOverlays
  ]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearOverlays();
    };
  }, [clearOverlays]);

  return null; // This component doesn't render anything visible
};

// Helper functions for styling overlays

function getWaveColor(waveType: string): string {
  const waveColors: Record<string, string> = {
    'wave_1': '#00FF00', // Green
    'wave_2': '#FF6B6B', // Red
    'wave_3': '#4ECDC4', // Teal
    'wave_4': '#FFE66D', // Yellow
    'wave_5': '#FF8B94', // Pink
    'wave_a': '#A8E6CF', // Light Green
    'wave_b': '#FFD93D', // Light Yellow
    'wave_c': '#6BCF7F', // Medium Green
    'wave_w': '#9B59B6', // Purple
    'wave_x': '#E67E22', // Orange
    'wave_y': '#3498DB', // Blue
    'wave_z': '#E74C3C', // Dark Red
  };
  
  return waveColors[waveType] || '#FFFFFF';
}

function getWaveLabel(waveType: string, degree?: string): string {
  const labels: Record<string, string> = {
    'wave_1': '1',
    'wave_2': '2',
    'wave_3': '3',
    'wave_4': '4',
    'wave_5': '5',
    'wave_a': 'A',
    'wave_b': 'B',
    'wave_c': 'C',
    'wave_w': 'W',
    'wave_x': 'X',
    'wave_y': 'Y',
    'wave_z': 'Z',
  };
  
  const baseLabel = labels[waveType] || '?';
  
  // Add degree indicator for higher degree waves
  if (degree && ['primary', 'cycle', 'supercycle'].includes(degree)) {
    return `(${baseLabel})`;
  }
  
  return baseLabel;
}

function getWaveLineWidth(degree: string): number {
  const widths: Record<string, number> = {
    'subminuette': 1,
    'minuette': 1,
    'minute': 2,
    'minor': 2,
    'intermediate': 3,
    'primary': 3,
    'cycle': 4,
    'supercycle': 4,
    'grand_supercycle': 5,
  };
  
  return widths[degree] || 2;
}

function getWaveLineStyle(waveType: string): number {
  // Impulse waves (1,3,5) are solid, corrective waves (2,4,A,B,C) are dashed
  const impulseWaves = ['wave_1', 'wave_3', 'wave_5'];
  return impulseWaves.includes(waveType) ? 0 : 1; // 0 = solid, 1 = dashed
}

function getWaveFontSize(degree: string): number {
  const sizes: Record<string, number> = {
    'subminuette': 8,
    'minuette': 9,
    'minute': 10,
    'minor': 11,
    'intermediate': 12,
    'primary': 13,
    'cycle': 14,
    'supercycle': 15,
    'grand_supercycle': 16,
  };
  
  return sizes[degree] || 11;
}

function getLabelPosition(wave: any): number {
  // Position label slightly above or below the wave line
  const midPrice = (wave.startPrice + wave.endPrice) / 2;
  const offset = Math.abs(wave.endPrice - wave.startPrice) * 0.1;
  
  // Position above for bullish waves, below for bearish
  return wave.endPrice > wave.startPrice ? midPrice + offset : midPrice - offset;
}

function getTargetColor(probability: number): string {
  if (probability > 0.8) return '#00FF00'; // High probability - green
  if (probability > 0.6) return '#FFD700'; // Medium probability - gold
  return '#FFA500'; // Lower probability - orange
}

function getFibonacciColor(ratio: number, type: 'retracement' | 'extension'): string {
  // Golden ratio levels get special colors
  if (Math.abs(ratio - 0.618) < 0.001) return '#FFD700'; // Gold
  if (Math.abs(ratio - 1.618) < 0.001) return '#FFD700'; // Gold
  
  // 50% level
  if (Math.abs(ratio - 0.5) < 0.001) return '#FF6B6B'; // Red
  
  // Other levels
  return type === 'retracement' ? '#4ECDC4' : '#FF8B94';
}

function getPatternColor(direction: 'bullish' | 'bearish'): string {
  return direction === 'bullish' ? '#00FF00' : '#FF0000';
}

function getPatternBorderColor(direction: 'bullish' | 'bearish', strength: string): string {
  const baseColor = direction === 'bullish' ? '#00FF00' : '#FF0000';
  
  switch (strength) {
    case 'strong': return baseColor;
    case 'moderate': return direction === 'bullish' ? '#66FF66' : '#FF6666';
    case 'weak': return direction === 'bullish' ? '#99FF99' : '#FF9999';
    default: return baseColor;
  }
}

function getPatternTransparency(strength: string): number {
  switch (strength) {
    case 'strong': return 60;
    case 'moderate': return 70;
    case 'weak': return 80;
    default: return 70;
  }
}

function getPatternBorderWidth(strength: string): number {
  switch (strength) {
    case 'strong': return 3;
    case 'moderate': return 2;
    case 'weak': return 1;
    default: return 2;
  }
}

function getPatternFontSize(strength: string): number {
  switch (strength) {
    case 'strong': return 12;
    case 'moderate': return 11;
    case 'weak': return 10;
    default: return 11;
  }
}

function getPatternPriceRange(pattern: CandlestickPattern): number {
  // Estimate price range based on pattern type and strength
  const baseRange = 200; // Base range in price units
  
  const multipliers: Record<string, number> = {
    'strong': 1.5,
    'moderate': 1.0,
    'weak': 0.7,
  };
  
  return baseRange * (multipliers[pattern.strength] || 1.0);
}

function getPatternStrengthIcon(strength: string): string | null {
  switch (strength) {
    case 'strong': return 'circle';
    case 'moderate': return 'triangle';
    case 'weak': return 'square';
    default: return null;
  }
}

function getPatternStrengthColor(strength: string): string {
  switch (strength) {
    case 'strong': return '#00FF00';
    case 'moderate': return '#FFD700';
    case 'weak': return '#FFA500';
    default: return '#FFFFFF';
  }
}

function getCurrentPrice(): number {
  // This would typically come from market data context
  // For now, return a placeholder value
  return 50000;
}

function getPatternDisplayName(patternType: string): string {
  const displayNames: Record<string, string> = {
    'doji': 'Doji',
    'hammer': 'Hammer',
    'hanging_man': 'Hanging Man',
    'shooting_star': 'Shooting Star',
    'inverted_hammer': 'Inverted Hammer',
    'engulfing_bullish': 'Bullish Engulfing',
    'engulfing_bearish': 'Bearish Engulfing',
    'harami_bullish': 'Bullish Harami',
    'harami_bearish': 'Bearish Harami',
    'morning_star': 'Morning Star',
    'evening_star': 'Evening Star',
    'spinning_top': 'Spinning Top',
    'marubozu_bullish': 'Bullish Marubozu',
    'marubozu_bearish': 'Bearish Marubozu',
    'piercing_line': 'Piercing Line',
    'dark_cloud_cover': 'Dark Cloud Cover',
    'three_white_soldiers': 'Three White Soldiers',
    'three_black_crows': 'Three Black Crows',
    'long_legged_doji': 'Long Legged Doji',
    'dragonfly_doji': 'Dragonfly Doji',
    'gravestone_doji': 'Gravestone Doji',
  };
  
  return displayNames[patternType] || patternType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getConfluenceColor(strength: number): string {
  if (strength > 0.8) return '#FFD700'; // Gold for high strength
  if (strength > 0.6) return '#FFA500'; // Orange for medium strength
  return '#87CEEB'; // Sky blue for lower strength
}

function getConfluenceZoneColor(strength: number): string {
  if (strength > 0.8) return '#FFD700'; // Gold
  if (strength > 0.6) return '#FF6B35'; // Orange-red
  if (strength > 0.4) return '#4ECDC4'; // Teal
  return '#95A5A6'; // Gray
}

function getConfluenceTransparency(strength: number): number {
  // Higher strength = less transparency (more visible)
  return Math.max(60, 90 - (strength * 30));
}

function getConfluenceFontSize(strength: number): number {
  if (strength > 0.8) return 12;
  if (strength > 0.6) return 11;
  return 10;
}

function getFactorShape(factorType: string): string {
  const shapes: Record<string, string> = {
    'fibonacci': 'triangle',
    'support_resistance': 'rectangle',
    'elliott_wave': 'circle',
    'pattern': 'diamond',
    'indicator': 'square',
  };
  
  return shapes[factorType] || 'circle';
}

function getFactorColor(factorType: string): string {
  const colors: Record<string, string> = {
    'fibonacci': '#FFD700', // Gold
    'support_resistance': '#4ECDC4', // Teal
    'elliott_wave': '#9B59B6', // Purple
    'pattern': '#E74C3C', // Red
    'indicator': '#3498DB', // Blue
  };
  
  return colors[factorType] || '#FFFFFF';
}

function getStrengthBarColor(barIndex: number, totalBars: number): string {
  const ratio = barIndex / totalBars;
  
  if (ratio < 0.3) return '#E74C3C'; // Red for low
  if (ratio < 0.7) return '#F39C12'; // Orange for medium
  return '#27AE60'; // Green for high
}

export default ChartOverlays;