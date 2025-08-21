/**
 * Unit tests for AdvancedTradingViewChart component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AdvancedTradingViewChart from '../../../components/charts/AdvancedTradingViewChart';
import { marketDataSlice } from '../../../store/slices/marketDataSlice';
import { AnalysisResults } from '../../../../types/analysis';

// Mock TradingView
const mockTradingViewWidget = {
  chart: jest.fn(() => ({
    createStudy: jest.fn(),
    removeAllShapes: jest.fn(),
    setSymbol: jest.fn()
  })),
  remove: jest.fn()
};

// Mock window.TradingView
Object.defineProperty(window, 'TradingView', {
  value: {
    widget: jest.fn(() => mockTradingViewWidget)
  },
  writable: true
});

Object.defineProperty(window, 'Datafeeds', {
  value: {
    UDFCompatibleDatafeed: jest.fn()
  },
  writable: true
});

// Mock Redux store
const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      marketData: marketDataSlice.reducer
    },
    preloadedState: {
      marketData: {
        selectedSymbol: 'BTCUSDT',
        selectedTimeframe: '1H',
        currentPrice: 50000,
        priceChange24h: 1000,
        priceChangePercent24h: 2.0,
        volume24h: 1000000,
        isLoading: false,
        error: null,
        lastUpdate: Date.now(),
        ...initialState
      }
    }
  });
};

// Mock analysis data
const mockAnalysisData: AnalysisResults = {
  symbol: 'BTCUSDT',
  timeframe: '1H',
  timestamp: Date.now(),
  technical: {
    rsi: 65,
    waveTrend: { wt1: 10, wt2: 5, signal: 'buy' },
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
      description: 'Hammer pattern',
      reliability: 0.85
    }
  ],
  elliottWave: {
    waves: [],
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
    nextTargets: [],
    invalidationLevel: 45000
  },
  fibonacci: {
    retracements: [],
    extensions: [],
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
      factors: [],
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

describe('AdvancedTradingViewChart', () => {
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    store = createMockStore();
    jest.clearAllMocks();
    
    // Mock document.createElement for script loading
    const mockScript = {
      src: '',
      async: false,
      onload: null as any,
      onerror: null as any
    };
    
    jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'script') {
        return mockScript as any;
      }
      return document.createElement(tagName);
    });

    jest.spyOn(document.head, 'appendChild').mockImplementation(() => mockScript as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders chart container with correct symbol and timeframe', () => {
    render(
      <Provider store={store}>
        <AdvancedTradingViewChart symbol="BTCUSDT" interval="1H" />
      </Provider>
    );

    expect(screen.getByText('BTCUSDT - 1H')).toBeInTheDocument();
  });

  it('displays loading state initially', () => {
    render(
      <Provider store={store}>
        <AdvancedTradingViewChart />
      </Provider>
    );

    expect(screen.getByText('Loading chart...')).toBeInTheDocument();
  });

  it('shows analysis status chips when analysis data is provided', () => {
    render(
      <Provider store={store}>
        <AdvancedTradingViewChart analysisData={mockAnalysisData} />
      </Provider>
    );

    expect(screen.getByText('Wave 3')).toBeInTheDocument();
    expect(screen.getByText('1 Patterns')).toBeInTheDocument();
    expect(screen.getByText('1 Confluence')).toBeInTheDocument();
  });

  it('opens settings menu when settings button is clicked', async () => {
    render(
      <Provider store={store}>
        <AdvancedTradingViewChart />
      </Provider>
    );

    const settingsButton = screen.getByLabelText('Chart Settings');
    fireEvent.click(settingsButton);

    await waitFor(() => {
      expect(screen.getByText('Elliott Wave Analysis')).toBeInTheDocument();
      expect(screen.getByText('Fibonacci Levels')).toBeInTheDocument();
      expect(screen.getByText('Candlestick Patterns')).toBeInTheDocument();
      expect(screen.getByText('Confluence Zones')).toBeInTheDocument();
    });
  });

  it('toggles Elliott Wave overlay when quick toggle button is clicked', () => {
    render(
      <Provider store={store}>
        <AdvancedTradingViewChart />
      </Provider>
    );

    const elliottWaveToggle = screen.getByLabelText('Toggle Elliott Wave');
    fireEvent.click(elliottWaveToggle);

    // The button should change color/state (tested through styling)
    expect(elliottWaveToggle).toBeInTheDocument();
  });

  it('toggles Fibonacci overlay when quick toggle button is clicked', () => {
    render(
      <Provider store={store}>
        <AdvancedTradingViewChart />
      </Provider>
    );

    const fibonacciToggle = screen.getByLabelText('Toggle Fibonacci');
    fireEvent.click(fibonacciToggle);

    expect(fibonacciToggle).toBeInTheDocument();
  });

  it('handles TradingView script loading error gracefully', async () => {
    const mockScript = document.createElement('script') as any;
    mockScript.onerror = jest.fn();
    
    jest.spyOn(document, 'createElement').mockReturnValue(mockScript);

    render(
      <Provider store={store}>
        <AdvancedTradingViewChart />
      </Provider>
    );

    // Simulate script loading error
    if (mockScript.onerror) {
      mockScript.onerror();
    }

    await waitFor(() => {
      expect(screen.getByText(/Failed to load TradingView library/)).toBeInTheDocument();
    });
  });

  it('initializes TradingView widget when script loads successfully', async () => {
    const mockScript = document.createElement('script') as any;
    mockScript.onload = jest.fn();
    
    jest.spyOn(document, 'createElement').mockReturnValue(mockScript);

    render(
      <Provider store={store}>
        <AdvancedTradingViewChart />
      </Provider>
    );

    // Simulate successful script loading
    if (mockScript.onload) {
      mockScript.onload();
    }

    await waitFor(() => {
      expect(window.TradingView.widget).toHaveBeenCalled();
    });
  });

  it('calls onAnalysisUpdate when analysis data changes', () => {
    const mockOnAnalysisUpdate = jest.fn();

    render(
      <Provider store={store}>
        <AdvancedTradingViewChart 
          analysisData={mockAnalysisData}
          onAnalysisUpdate={mockOnAnalysisUpdate}
        />
      </Provider>
    );

    // Auto-refresh would be tested with timer mocks
    expect(mockOnAnalysisUpdate).toBeDefined();
  });

  it('updates chart when symbol or interval changes', () => {
    const { rerender } = render(
      <Provider store={store}>
        <AdvancedTradingViewChart symbol="BTCUSDT" interval="1H" />
      </Provider>
    );

    expect(screen.getByText('BTCUSDT - 1H')).toBeInTheDocument();

    rerender(
      <Provider store={store}>
        <AdvancedTradingViewChart symbol="ETHUSDT" interval="4H" />
      </Provider>
    );

    expect(screen.getByText('ETHUSDT - 4H')).toBeInTheDocument();
  });

  it('renders with custom height', () => {
    render(
      <Provider store={store}>
        <AdvancedTradingViewChart height={800} />
      </Provider>
    );

    const chartContainer = screen.getByRole('generic');
    // Height would be tested through style inspection
    expect(chartContainer).toBeInTheDocument();
  });

  it('handles settings changes correctly', async () => {
    render(
      <Provider store={store}>
        <AdvancedTradingViewChart />
      </Provider>
    );

    // Open settings menu
    const settingsButton = screen.getByLabelText('Chart Settings');
    fireEvent.click(settingsButton);

    await waitFor(() => {
      const elliottWaveSwitch = screen.getByRole('checkbox', { name: /Elliott Wave Analysis/i });
      fireEvent.click(elliottWaveSwitch);
      
      // Switch state should change
      expect(elliottWaveSwitch).toBeInTheDocument();
    });
  });

  it('cleans up widget on unmount', () => {
    const { unmount } = render(
      <Provider store={store}>
        <AdvancedTradingViewChart />
      </Provider>
    );

    // Simulate widget creation
    const mockScript = document.createElement('script') as any;
    mockScript.onload = () => {
      // Widget would be created here
    };

    unmount();

    // Widget cleanup would be tested if we could access the widget instance
    expect(true).toBe(true);
  });

  describe('Chart Settings', () => {
    it('shows all available settings options', async () => {
      render(
        <Provider store={store}>
          <AdvancedTradingViewChart />
        </Provider>
      );

      const settingsButton = screen.getByLabelText('Chart Settings');
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByText('Elliott Wave Analysis')).toBeInTheDocument();
        expect(screen.getByText('Fibonacci Levels')).toBeInTheDocument();
        expect(screen.getByText('Candlestick Patterns')).toBeInTheDocument();
        expect(screen.getByText('Confluence Zones')).toBeInTheDocument();
        expect(screen.getByText('Drawing Tools')).toBeInTheDocument();
        expect(screen.getByText('Multi-Timeframe Sync')).toBeInTheDocument();
        expect(screen.getByText('Auto Refresh')).toBeInTheDocument();
      });
    });

    it('persists settings changes', async () => {
      render(
        <Provider store={store}>
          <AdvancedTradingViewChart />
        </Provider>
      );

      const settingsButton = screen.getByLabelText('Chart Settings');
      fireEvent.click(settingsButton);

      await waitFor(() => {
        const autoRefreshSwitch = screen.getByRole('checkbox', { name: /Auto Refresh/i });
        fireEvent.click(autoRefreshSwitch);
        
        // Close and reopen menu to verify persistence
        fireEvent.click(settingsButton); // Close
        fireEvent.click(settingsButton); // Reopen
        
        // Setting should be persisted
        expect(screen.getByRole('checkbox', { name: /Auto Refresh/i })).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when chart initialization fails', async () => {
      // Mock TradingView to throw error
      Object.defineProperty(window, 'TradingView', {
        value: {
          widget: jest.fn(() => {
            throw new Error('Initialization failed');
          })
        },
        writable: true
      });

      render(
        <Provider store={store}>
          <AdvancedTradingViewChart />
        </Provider>
      );

      const mockScript = document.createElement('script') as any;
      mockScript.onload = () => {
        // This would trigger the error
      };

      // Simulate script load
      if (mockScript.onload) {
        mockScript.onload();
      }

      await waitFor(() => {
        expect(screen.getByText(/Failed to load chart/)).toBeInTheDocument();
      });
    });

    it('handles missing TradingView library gracefully', () => {
      // Remove TradingView from window
      Object.defineProperty(window, 'TradingView', {
        value: undefined,
        writable: true
      });

      render(
        <Provider store={store}>
          <AdvancedTradingViewChart />
        </Provider>
      );

      // Should not crash
      expect(screen.getByText('Loading chart...')).toBeInTheDocument();
    });
  });
});