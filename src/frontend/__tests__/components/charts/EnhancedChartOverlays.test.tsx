/**
 * Unit tests for Enhanced Chart Overlays functionality
 * Tests the advanced Elliott Wave, Fibonacci, Pattern, and Confluence overlays
 */

// import React from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ChartOverlays from '../../../components/charts/ChartOverlays';
import marketDataReducer from '../../../store/slices/marketDataSlice';
import { AnalysisResults } from '../../../../types/analysis';

// Mock TradingView chart widget with enhanced methods
const mockChartWidget = {
  chart: jest.fn(() => ({
    createShape: jest.fn((point, options) => ({
      setPoints: jest.fn(),
      id: `mock-shape-${Math.random()}`,
      point,
      options
    })),
    createStudy: jest.fn((name, overlay, inputs, options) => ({
      id: `mock-study-${Math.random()}`,
      name,
      overlay,
      inputs,
      options
    })),
    removeEntity: jest.fn(),
    removeAllShapes: jest.fn(),
  }))
};

// Mock Redux store
const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      marketData: marketDataReducer
    },
    preloadedState: {
      marketData: {
        tickers: {},
        orderBooks: {},
        candles: {},
        selectedSymbol: 'BTCUSDT',
        selectedTimeframe: '1h',
        isConnected: false,
        lastUpdate: Date.now(),
        ...initialState
      }
    }
  });
};

// Enhanced mock analysis data with comprehensive Elliott Wave structure
const mockEnhancedAnalysisData: AnalysisResults = {
  symbol: 'BTCUSDT',
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
      description: 'Strong hammer pattern with high reliability',
      reliability: 0.9
    },
    {
      type: 'engulfing_bearish',
      confidence: 0.75,
      startIndex: 15,
      endIndex: 16,
      direction: 'bearish',
      strength: 'moderate',
      description: 'Bearish engulfing pattern',
      reliability: 0.7
    },
    {
      type: 'morning_star',
      confidence: 0.92,
      startIndex: 20,
      endIndex: 22,
      direction: 'bullish',
      strength: 'strong',
      description: 'Morning star - powerful bullish reversal',
      reliability: 0.95
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
        endTime: Date.now() - 64800000,
        length: 3000,
        duration: 21600000,
        fibonacciRatio: 1.0
      },
      {
        id: 'wave_2',
        type: 'wave_2',
        degree: 'minor',
        startPrice: 48000,
        endPrice: 46500,
        startTime: Date.now() - 64800000,
        endTime: Date.now() - 43200000,
        length: 1500,
        duration: 21600000,
        fibonacciRatio: 0.618
      },
      {
        id: 'wave_3',
        type: 'wave_3',
        degree: 'minor',
        startPrice: 46500,
        endPrice: 52000,
        startTime: Date.now() - 43200000,
        endTime: Date.now() - 21600000,
        length: 5500,
        duration: 21600000,
        fibonacciRatio: 1.618
      },
      {
        id: 'wave_4',
        type: 'wave_4',
        degree: 'minor',
        startPrice: 52000,
        endPrice: 50000,
        startTime: Date.now() - 21600000,
        endTime: Date.now() - 10800000,
        length: 2000,
        duration: 10800000,
        fibonacciRatio: 0.382
      },
      {
        id: 'wave_5',
        type: 'wave_5',
        degree: 'minor',
        startPrice: 50000,
        endPrice: 54000,
        startTime: Date.now() - 10800000,
        endTime: Date.now(),
        length: 4000,
        duration: 10800000,
        fibonacciRatio: 1.0
      }
    ],
    currentWave: {
      id: 'wave_5',
      type: 'wave_5',
      degree: 'minor',
      startPrice: 50000,
      endPrice: 54000,
      startTime: Date.now() - 10800000,
      endTime: Date.now(),
      length: 4000,
      duration: 10800000,
      fibonacciRatio: 1.0
    },
    waveCount: 5,
    degree: 'minor',
    validity: 0.85,
    nextTargets: [
      {
        price: 56000,
        probability: 0.8,
        type: 'fibonacci_extension',
        description: '161.8% Fibonacci extension target'
      },
      {
        price: 58000,
        probability: 0.6,
        type: 'wave_equality',
        description: 'Wave 5 = Wave 1 projection'
      }
    ],
    invalidationLevel: 48000
  },
  fibonacci: {
    retracements: [
      {
        ratio: 0.236,
        price: 51764,
        type: 'retracement',
        strength: 0.6,
        description: '23.6% Fibonacci retracement'
      },
      {
        ratio: 0.382,
        price: 50909,
        type: 'retracement',
        strength: 0.7,
        description: '38.2% Fibonacci retracement'
      },
      {
        ratio: 0.5,
        price: 49500,
        type: 'retracement',
        strength: 0.8,
        description: '50% retracement level'
      },
      {
        ratio: 0.618,
        price: 48418,
        type: 'retracement',
        strength: 1.0,
        description: '61.8% Golden Ratio retracement'
      },
      {
        ratio: 0.786,
        price: 47073,
        type: 'retracement',
        strength: 0.7,
        description: '78.6% deep retracement'
      }
    ],
    extensions: [
      {
        ratio: 1.272,
        price: 55636,
        type: 'extension',
        strength: 0.8,
        description: '127.2% Fibonacci extension'
      },
      {
        ratio: 1.618,
        price: 58909,
        type: 'extension',
        strength: 1.0,
        description: '161.8% Golden Ratio extension'
      },
      {
        ratio: 2.618,
        price: 65909,
        type: 'extension',
        strength: 0.6,
        description: '261.8% extreme extension'
      }
    ],
    timeProjections: [
      {
        ratio: 1.0,
        timestamp: Date.now() + 86400000,
        description: 'Time equality projection'
      },
      {
        ratio: 1.618,
        timestamp: Date.now() + 139968000,
        description: 'Golden ratio time projection'
      }
    ],
    confluenceZones: [
      {
        priceLevel: 48500,
        strength: 0.9,
        factors: [
          {
            type: 'fibonacci',
            description: '61.8% retracement confluence',
            weight: 1.0
          },
          {
            type: 'support_resistance',
            description: 'Previous support level',
            weight: 0.8
          }
        ],
        type: 'support',
        reliability: 0.85
      }
    ],
    highPrice: 54000,
    lowPrice: 45000,
    swingHigh: 54000,
    swingLow: 45000
  },
  confluence: [
    {
      priceLevel: 48500,
      strength: 0.9,
      factors: [
        {
          type: 'fibonacci',
          description: '61.8% retracement',
          weight: 1.0
        },
        {
          type: 'support_resistance',
          description: 'Previous support level',
          weight: 0.8
        },
        {
          type: 'elliott_wave',
          description: 'Wave 4 target area',
          weight: 0.7
        }
      ],
      type: 'support',
      reliability: 0.85
    },
    {
      priceLevel: 56000,
      strength: 0.8,
      factors: [
        {
          type: 'fibonacci',
          description: '161.8% extension',
          weight: 1.0
        },
        {
          type: 'elliott_wave',
          description: 'Wave 5 target',
          weight: 0.9
        }
      ],
      type: 'resistance',
      reliability: 0.8
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
    volumeByPrice: [
      { price: 49000, volume: 1000, percentage: 15 },
      { price: 50000, volume: 1500, percentage: 22 },
      { price: 51000, volume: 1200, percentage: 18 }
    ],
    poc: 50000,
    valueAreaHigh: 52000,
    valueAreaLow: 48000,
    volumeTrend: 'increasing',
    volumeStrength: 0.8
  }
};

describe('Enhanced Chart Overlays', () => {
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    store = createMockStore();
    jest.clearAllMocks();
  });

  describe('Elliott Wave Overlays', () => {
    it('draws enhanced Elliott Wave overlays with proper styling', () => {
      const mockChart = mockChartWidget.chart();
      
      render(
        <Provider store={store}>
          <ChartOverlays 
            chartWidget={mockChartWidget}
            analysisData={mockEnhancedAnalysisData}
            showElliottWave={true}
          />
        </Provider>
      );

      // Should create shapes for each wave
      expect(mockChart.createShape).toHaveBeenCalled();
      
      // Verify wave lines are created
      const createShapeCalls = mockChart.createShape.mock.calls;
      const waveLineCalls = createShapeCalls.filter(call => 
        call[1]?.shape === 'trend_line'
      );
      
      expect(waveLineCalls.length).toBeGreaterThan(0);
    });

    it('highlights current wave with special styling', () => {
      const mockChart = mockChartWidget.chart();
      
      render(
        <Provider store={store}>
          <ChartOverlays 
            chartWidget={mockChartWidget}
            analysisData={mockEnhancedAnalysisData}
            showElliottWave={true}
          />
        </Provider>
      );

      // Should create current wave highlight
      const createShapeCalls = mockChart.createShape.mock.calls;
      const highlightCalls = createShapeCalls.filter(call => 
        call[1]?.overrides?.linecolor === '#FFD700' && 
        call[1]?.overrides?.linewidth === 4
      );
      
      expect(highlightCalls.length).toBeGreaterThan(0);
    });

    it('draws wave targets with probability indicators', () => {
      const mockChart = mockChartWidget.chart();
      
      render(
        <Provider store={store}>
          <ChartOverlays 
            chartWidget={mockChartWidget}
            analysisData={mockEnhancedAnalysisData}
            showElliottWave={true}
          />
        </Provider>
      );

      // Should create target lines and labels
      const createShapeCalls = mockChart.createShape.mock.calls;
      const targetCalls = createShapeCalls.filter(call => 
        call[1]?.shape === 'horizontal_line' && 
        call[1]?.overrides?.linestyle === 1 // dashed for targets
      );
      
      expect(targetCalls.length).toBeGreaterThan(0);
    });

    it('applies different styling based on wave degree', () => {
      const mockChart = mockChartWidget.chart();
      
      render(
        <Provider store={store}>
          <ChartOverlays 
            chartWidget={mockChartWidget}
            analysisData={mockEnhancedAnalysisData}
            showElliottWave={true}
          />
        </Provider>
      );

      // Should use appropriate line widths for wave degree
      const createShapeCalls = mockChart.createShape.mock.calls;
      const waveLineCalls = createShapeCalls.filter(call => 
        call[1]?.shape === 'trend_line' && 
        call[1]?.overrides?.linewidth >= 2 // minor degree should have width 2
      );
      
      expect(waveLineCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Fibonacci Overlays', () => {
    it('draws enhanced Fibonacci retracement levels', () => {
      const mockChart = mockChartWidget.chart();
      
      render(
        <Provider store={store}>
          <ChartOverlays 
            chartWidget={mockChartWidget}
            analysisData={mockEnhancedAnalysisData}
            showFibonacci={true}
          />
        </Provider>
      );

      // Should create Fibonacci study
      expect(mockChart.createStudy).toHaveBeenCalledWith(
        'Fibonacci Retracement',
        false,
        false,
        undefined,
        expect.any(Object)
      );

      // Should create individual level lines
      const createShapeCalls = mockChart.createShape.mock.calls;
      const fibLineCalls = createShapeCalls.filter(call => 
        call[1]?.shape === 'horizontal_line'
      );
      
      expect(fibLineCalls.length).toBeGreaterThan(0);
    });

    it('highlights golden ratio levels with special styling', () => {
      const mockChart = mockChartWidget.chart();
      
      render(
        <Provider store={store}>
          <ChartOverlays 
            chartWidget={mockChartWidget}
            analysisData={mockEnhancedAnalysisData}
            showFibonacci={true}
          />
        </Provider>
      );

      // Should create enhanced labels for golden ratio levels
      const createShapeCalls = mockChart.createShape.mock.calls;
      const goldenRatioLabels = createShapeCalls.filter(call => 
        call[1]?.shape === 'text' && 
        call[1]?.text?.includes('Golden')
      );
      
      expect(goldenRatioLabels.length).toBeGreaterThan(0);
    });

    it('draws Fibonacci extensions with proper styling', () => {
      const mockChart = mockChartWidget.chart();
      
      render(
        <Provider store={store}>
          <ChartOverlays 
            chartWidget={mockChartWidget}
            analysisData={mockEnhancedAnalysisData}
            showFibonacci={true}
          />
        </Provider>
      );

      // Should create extension lines
      const createShapeCalls = mockChart.createShape.mock.calls;
      const extensionCalls = createShapeCalls.filter(call => 
        call[1]?.shape === 'horizontal_line' && 
        call[1]?.overrides?.linestyle === 2 // dotted for extensions
      );
      
      expect(extensionCalls.length).toBeGreaterThan(0);
    });

    it('creates Fibonacci fan when sufficient data is available', () => {
      const mockChart = mockChartWidget.chart();
      
      render(
        <Provider store={store}>
          <ChartOverlays 
            chartWidget={mockChartWidget}
            analysisData={mockEnhancedAnalysisData}
            showFibonacci={true}
          />
        </Provider>
      );

      // Should create Fibonacci fan study
      expect(mockChart.createStudy).toHaveBeenCalledWith(
        'Fibonacci Fan',
        false,
        false,
        undefined,
        expect.any(Object)
      );
    });
  });

  describe('Pattern Overlays', () => {
    it('draws enhanced pattern overlays with confidence indicators', () => {
      const mockChart = mockChartWidget.chart();
      
      render(
        <Provider store={store}>
          <ChartOverlays 
            chartWidget={mockChartWidget}
            analysisData={mockEnhancedAnalysisData}
            showPatterns={true}
          />
        </Provider>
      );

      // Should create pattern boxes
      const createShapeCalls = mockChart.createShape.mock.calls;
      const patternBoxes = createShapeCalls.filter(call => 
        call[1]?.shape === 'rectangle'
      );
      
      expect(patternBoxes.length).toBeGreaterThan(0);
    });

    it('applies different styling based on pattern strength', () => {
      const mockChart = mockChartWidget.chart();
      
      render(
        <Provider store={store}>
          <ChartOverlays 
            chartWidget={mockChartWidget}
            analysisData={mockEnhancedAnalysisData}
            showPatterns={true}
          />
        </Provider>
      );

      // Should use different border widths for different strengths
      const createShapeCalls = mockChart.createShape.mock.calls;
      const strongPatterns = createShapeCalls.filter(call => 
        call[1]?.shape === 'rectangle' && 
        call[1]?.overrides?.borderWidth === 3 // strong patterns
      );
      
      expect(strongPatterns.length).toBeGreaterThan(0);
    });

    it('adds direction arrows for patterns', () => {
      const mockChart = mockChartWidget.chart();
      
      render(
        <Provider store={store}>
          <ChartOverlays 
            chartWidget={mockChartWidget}
            analysisData={mockEnhancedAnalysisData}
            showPatterns={true}
          />
        </Provider>
      );

      // Should create arrow shapes
      const createShapeCalls = mockChart.createShape.mock.calls;
      const arrowCalls = createShapeCalls.filter(call => 
        call[1]?.shape === 'arrow_up' || call[1]?.shape === 'arrow_down'
      );
      
      expect(arrowCalls.length).toBeGreaterThan(0);
    });

    it('highlights high-reliability patterns', () => {
      const mockChart = mockChartWidget.chart();
      
      render(
        <Provider store={store}>
          <ChartOverlays 
            chartWidget={mockChartWidget}
            analysisData={mockEnhancedAnalysisData}
            showPatterns={true}
          />
        </Provider>
      );

      // Should create reliability indicators for high-reliability patterns
      const createShapeCalls = mockChart.createShape.mock.calls;
      const reliabilityIndicators = createShapeCalls.filter(call => 
        call[1]?.shape === 'circle' && 
        call[1]?.overrides?.color === '#FFD700'
      );
      
      expect(reliabilityIndicators.length).toBeGreaterThan(0);
    });
  });

  describe('Confluence Zone Overlays', () => {
    it('draws enhanced confluence zones with factor breakdown', () => {
      const mockChart = mockChartWidget.chart();
      
      render(
        <Provider store={store}>
          <ChartOverlays 
            chartWidget={mockChartWidget}
            analysisData={mockEnhancedAnalysisData}
            showConfluence={true}
          />
        </Provider>
      );

      // Should create confluence zone rectangles
      const createShapeCalls = mockChart.createShape.mock.calls;
      const confluenceZones = createShapeCalls.filter(call => 
        call[1]?.shape === 'rectangle'
      );
      
      expect(confluenceZones.length).toBeGreaterThan(0);
    });

    it('creates individual factor indicators', () => {
      const mockChart = mockChartWidget.chart();
      
      render(
        <Provider store={store}>
          <ChartOverlays 
            chartWidget={mockChartWidget}
            analysisData={mockEnhancedAnalysisData}
            showConfluence={true}
          />
        </Provider>
      );

      // Should create factor indicators
      const createShapeCalls = mockChart.createShape.mock.calls;
      const factorIndicators = createShapeCalls.filter(call => 
        ['triangle', 'rectangle', 'circle', 'diamond', 'square'].includes(call[1]?.shape)
      );
      
      expect(factorIndicators.length).toBeGreaterThan(0);
    });

    it('adds strength meters for high-strength zones', () => {
      const mockChart = mockChartWidget.chart();
      
      render(
        <Provider store={store}>
          <ChartOverlays 
            chartWidget={mockChartWidget}
            analysisData={mockEnhancedAnalysisData}
            showConfluence={true}
          />
        </Provider>
      );

      // Should create strength meter bars for high-strength zones
      const createShapeCalls = mockChart.createShape.mock.calls;
      const strengthBars = createShapeCalls.filter(call => 
        call[1]?.shape === 'rectangle' && 
        call[1]?.overrides?.borderWidth === 1 // strength bars have thin borders
      );
      
      expect(strengthBars.length).toBeGreaterThan(0);
    });

    it('highlights reliability indicators', () => {
      const mockChart = mockChartWidget.chart();
      
      render(
        <Provider store={store}>
          <ChartOverlays 
            chartWidget={mockChartWidget}
            analysisData={mockEnhancedAnalysisData}
            showConfluence={true}
          />
        </Provider>
      );

      // Should create reliability indicators
      const createShapeCalls = mockChart.createShape.mock.calls;
      const reliabilityIndicators = createShapeCalls.filter(call => 
        call[1]?.shape === 'circle' && 
        call[1]?.overrides?.color === '#FFD700' &&
        call[1]?.overrides?.transparency === 40
      );
      
      expect(reliabilityIndicators.length).toBeGreaterThan(0);
    });
  });

  describe('Overlay Integration', () => {
    it('handles all overlays enabled simultaneously', () => {
      const mockChart = mockChartWidget.chart();
      
      render(
        <Provider store={store}>
          <ChartOverlays 
            chartWidget={mockChartWidget}
            analysisData={mockEnhancedAnalysisData}
            showElliottWave={true}
            showFibonacci={true}
            showPatterns={true}
            showConfluence={true}
          />
        </Provider>
      );

      // Should create multiple types of overlays
      expect(mockChart.createShape).toHaveBeenCalled();
      expect(mockChart.createStudy).toHaveBeenCalled();
      
      const createShapeCalls = mockChart.createShape.mock.calls;
      expect(createShapeCalls.length).toBeGreaterThan(10); // Should have many overlays
    });

    it('properly clears overlays when data changes', () => {
      const mockChart = mockChartWidget.chart();
      
      const { rerender } = render(
        <Provider store={store}>
          <ChartOverlays 
            chartWidget={mockChartWidget}
            analysisData={mockEnhancedAnalysisData}
            showElliottWave={true}
          />
        </Provider>
      );

      // Clear mock calls
      jest.clearAllMocks();

      // Update with new data
      const newAnalysisData = {
        ...mockEnhancedAnalysisData,
        timestamp: Date.now() + 1000
      };

      rerender(
        <Provider store={store}>
          <ChartOverlays 
            chartWidget={mockChartWidget}
            analysisData={newAnalysisData}
            showElliottWave={true}
          />
        </Provider>
      );

      // Should clear previous overlays
      expect(mockChart.removeEntity).toHaveBeenCalled();
    });

    it('handles missing or incomplete analysis data gracefully', () => {
      const incompleteData = {
        ...mockEnhancedAnalysisData,
        elliottWave: {
          ...mockEnhancedAnalysisData.elliottWave,
          waves: [], // Empty waves array
          nextTargets: [] // Empty targets
        }
      };

      expect(() => {
        render(
          <Provider store={store}>
            <ChartOverlays 
              chartWidget={mockChartWidget}
              analysisData={incompleteData}
              showElliottWave={true}
            />
          </Provider>
        );
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('handles chart widget errors gracefully', () => {
      const errorChartWidget = {
        chart: jest.fn(() => {
          throw new Error('Chart error');
        })
      };

      expect(() => {
        render(
          <Provider store={store}>
            <ChartOverlays 
              chartWidget={errorChartWidget}
              analysisData={mockEnhancedAnalysisData}
              showElliottWave={true}
            />
          </Provider>
        );
      }).not.toThrow();
    });

    it('handles shape creation failures gracefully', () => {
      const failingChartWidget = {
        chart: jest.fn(() => ({
          createShape: jest.fn(() => null), // Simulate creation failure
          createStudy: jest.fn(() => null),
          removeEntity: jest.fn(),
          removeAllShapes: jest.fn(),
        }))
      };

      expect(() => {
        render(
          <Provider store={store}>
            <ChartOverlays 
              chartWidget={failingChartWidget}
              analysisData={mockEnhancedAnalysisData}
              showElliottWave={true}
              showFibonacci={true}
              showPatterns={true}
              showConfluence={true}
            />
          </Provider>
        );
      }).not.toThrow();
    });
  });
});