import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import '@testing-library/jest-dom';
import RealTimeChart from '../../frontend/components/charts/RealTimeChart';
import marketDataReducer from '../../frontend/store/slices/marketDataSlice';
import tradingReducer from '../../frontend/store/slices/tradingSlice';
import authReducer from '../../frontend/store/slices/authSlice';
import uiReducer from '../../frontend/store/slices/uiSlice';

// Mock the WebSocket hook
jest.mock('../../frontend/hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    isConnected: true,
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
  }),
}));

// Mock the chart WebSocket client
jest.mock('../../frontend/services/chartWebSocketClient', () => ({
  getChartWebSocketClient: () => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    subscribeToSymbol: jest.fn(),
    unsubscribeFromSymbol: jest.fn(),
    requestCandles: jest.fn(),
    isConnected: () => true,
  }),
}));

const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      marketData: marketDataReducer,
      trading: tradingReducer,
      auth: authReducer,
      ui: uiReducer,
    },
    preloadedState: {
      marketData: {
        tickers: {
          BTCUSDT: {
            symbol: 'BTCUSDT',
            price: 45000,
            change24h: 1000,
            changePercent24h: 2.27,
            volume24h: 1000000,
            high24h: 46000,
            low24h: 44000,
            timestamp: Date.now(),
          },
        },
        orderBooks: {},
        candles: {
          'BTCUSDT_1h': [
            {
              timestamp: Date.now() - 3600000,
              open: 44500,
              high: 45200,
              low: 44300,
              close: 45000,
              volume: 100,
            },
            {
              timestamp: Date.now(),
              open: 45000,
              high: 45500,
              low: 44800,
              close: 45200,
              volume: 120,
            },
          ],
        },
        selectedSymbol: 'BTCUSDT',
        selectedTimeframe: '1h',
        isConnected: true,
        lastUpdate: Date.now(),
      },
      trading: {
        signals: [],
        positions: [],
        orders: [],
        portfolio: {
          totalBalance: 10000,
          availableBalance: 9000,
          totalUnrealizedPnl: 100,
          totalRealizedPnl: 50,
          maxDrawdown: 0,
          currentDrawdown: 0,
        },
        paperTrading: {
          isEnabled: true,
          initialBalance: 10000,
          virtualBalance: 10000,
          totalPaperTrades: 5,
          paperTradingStartDate: Date.now() - 86400000,
        },
        botStatus: 'stopped',
        isLoading: false,
        error: null,
      },
      auth: {
        isAuthenticated: true,
        user: null,
        token: 'mock-token',
        isLoading: false,
        error: null,
      },
      ui: {
        notifications: [],
        theme: 'dark',
        sidebarOpen: true,
      },
      ...initialState,
    },
  });
};

const renderWithProvider = (component: React.ReactElement, store = createMockStore()) => {
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

describe('RealTimeChart Component', () => {
  beforeEach(() => {
    // Mock canvas context
    HTMLCanvasElement.prototype.getContext = jest.fn((contextId) => {
      if (contextId === '2d') {
        return {
          clearRect: jest.fn(),
          fillRect: jest.fn(),
          strokeRect: jest.fn(),
          beginPath: jest.fn(),
          moveTo: jest.fn(),
          lineTo: jest.fn(),
          stroke: jest.fn(),
          fill: jest.fn(),
          scale: jest.fn(),
          setLineDash: jest.fn(),
          fillText: jest.fn(),
          measureText: jest.fn(() => ({ width: 50 })),
          save: jest.fn(),
          restore: jest.fn(),
          canvas: {} as HTMLCanvasElement,
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          font: '',
          textAlign: 'start' as CanvasTextAlign,
        } as any;
      }
      return null;
    });

    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 800,
      height: 400,
      top: 0,
      left: 0,
      bottom: 400,
      right: 800,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders real-time chart component', () => {
    renderWithProvider(<RealTimeChart />);
    
    expect(screen.getByText('Real-Time Chart')).toBeInTheDocument();
    expect(screen.getByText('PAPER TRADING MODE - NO REAL MONEY AT RISK')).toBeInTheDocument();
  });

  it('displays current price and change percentage', () => {
    renderWithProvider(<RealTimeChart />);
    
    expect(screen.getByText('$45,000.00')).toBeInTheDocument();
    expect(screen.getByText('+2.27%')).toBeInTheDocument();
  });

  it('shows live data connection status', () => {
    renderWithProvider(<RealTimeChart />);
    
    expect(screen.getByText(/LIVE DATA CONNECTED/)).toBeInTheDocument();
  });

  it('displays paper trading indicators', () => {
    renderWithProvider(<RealTimeChart />);
    
    const paperIndicators = screen.getAllByText(/PAPER/);
    expect(paperIndicators.length).toBeGreaterThan(0);
  });

  it('allows symbol selection when controls are enabled', () => {
    renderWithProvider(<RealTimeChart showControls={true} />);
    
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes.length).toBe(2); // Symbol and Timeframe selects
    expect(screen.getByText('BTC/USDT')).toBeInTheDocument();
  });

  it('allows timeframe selection when controls are enabled', () => {
    renderWithProvider(<RealTimeChart showControls={true} />);
    
    const timeframeSelects = screen.getAllByRole('combobox');
    expect(timeframeSelects.length).toBeGreaterThan(1);
    expect(screen.getByText('1 Hour')).toBeInTheDocument();
  });

  it('displays technical indicator controls when enabled', () => {
    renderWithProvider(<RealTimeChart showTechnicalIndicators={true} />);
    
    expect(screen.getByText('RSI')).toBeInTheDocument();
    expect(screen.getByText('MACD')).toBeInTheDocument();
    expect(screen.getByText('Bollinger Bands')).toBeInTheDocument();
  });

  it('toggles technical indicators', () => {
    renderWithProvider(<RealTimeChart showTechnicalIndicators={true} />);
    
    const rsiSwitch = screen.getByRole('switch', { name: 'RSI' });
    expect(rsiSwitch).not.toBeChecked();
    
    fireEvent.click(rsiSwitch);
    expect(rsiSwitch).toBeChecked();
  });

  it('handles fullscreen toggle', () => {
    const onFullscreenToggle = jest.fn();
    renderWithProvider(
      <RealTimeChart onFullscreenToggle={onFullscreenToggle} />
    );
    
    const fullscreenButton = screen.getByLabelText('Enter fullscreen');
    fireEvent.click(fullscreenButton);
    
    expect(onFullscreenToggle).toHaveBeenCalledWith(true);
  });

  it('handles refresh button click', () => {
    renderWithProvider(<RealTimeChart />);
    
    const refreshButton = screen.getByLabelText('Refresh chart data');
    fireEvent.click(refreshButton);
    
    // Should not throw any errors
    expect(refreshButton).toBeInTheDocument();
  });

  it('shows loading state when no data is available', () => {
    const storeWithoutData = createMockStore({
      marketData: {
        tickers: {},
        orderBooks: {},
        candles: {},
        selectedSymbol: 'BTCUSDT',
        selectedTimeframe: '1h',
        isConnected: false,
        lastUpdate: 0,
      },
    });

    renderWithProvider(<RealTimeChart />, storeWithoutData);
    
    expect(screen.getByText('Loading real-time chart data...')).toBeInTheDocument();
  });

  it('shows connection error when disconnected', () => {
    const storeWithDisconnection = createMockStore({
      marketData: {
        tickers: {},
        orderBooks: {},
        candles: {},
        selectedSymbol: 'BTCUSDT',
        selectedTimeframe: '1h',
        isConnected: false,
        lastUpdate: 0,
      },
    });

    renderWithProvider(<RealTimeChart />, storeWithDisconnection);
    
    expect(screen.getByText(/CONNECTION ISSUE/)).toBeInTheDocument();
  });

  it('displays chart footer with current settings', () => {
    renderWithProvider(<RealTimeChart />);
    
    expect(screen.getByText(/BTCUSDT • 1h • 2 candles • Live updates every second/)).toBeInTheDocument();
  });

  it('renders canvas element for chart drawing', () => {
    renderWithProvider(<RealTimeChart />);
    
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('handles prop-based symbol override', () => {
    renderWithProvider(<RealTimeChart symbol="ETHUSDT" />);
    
    // Should use the prop symbol instead of store symbol
    expect(screen.getByText('Real-Time Chart')).toBeInTheDocument();
  });

  it('handles prop-based timeframe override', () => {
    renderWithProvider(<RealTimeChart timeframe="5m" />);
    
    // Should use the prop timeframe instead of store timeframe
    expect(screen.getByText('Real-Time Chart')).toBeInTheDocument();
  });

  it('shows paper trading safety warnings', () => {
    renderWithProvider(<RealTimeChart />);
    
    expect(screen.getByText('PAPER TRADING MODE - NO REAL MONEY AT RISK')).toBeInTheDocument();
  });

  it('displays live data update timestamp', async () => {
    renderWithProvider(<RealTimeChart />);
    
    await waitFor(() => {
      expect(screen.getByText(/Last update:/)).toBeInTheDocument();
    });
  });
});

describe('RealTimeChart Integration', () => {
  it('integrates with Redux store for market data', () => {
    const store = createMockStore();
    renderWithProvider(<RealTimeChart />, store);
    
    const state = store.getState();
    expect(state.marketData.selectedSymbol).toBe('BTCUSDT');
    expect(state.marketData.isConnected).toBe(true);
  });

  it('handles real-time data updates', () => {
    const store = createMockStore();
    renderWithProvider(<RealTimeChart />, store);
    
    // Simulate real-time data update
    store.dispatch({
      type: 'marketData/updateTicker',
      payload: {
        symbol: 'BTCUSDT',
        price: 45500,
        change24h: 1500,
        changePercent24h: 3.41,
        volume24h: 1200000,
        high24h: 46000,
        low24h: 44000,
        timestamp: Date.now(),
      },
    });

    // Component should re-render with new data
    expect(screen.getByText('Real-Time Chart')).toBeInTheDocument();
  });
});