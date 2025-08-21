import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import '@testing-library/jest-dom';

import MarketDataWidget from '../../../components/dashboard/MarketDataWidget';
import marketDataReducer from '../../../store/slices/marketDataSlice';

const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      marketData: marketDataReducer,
    },
    preloadedState: initialState,
  });
};

const TestWrapper: React.FC<{ children: React.ReactNode; store?: any }> = ({ 
  children, 
  store = createTestStore() 
}) => (
  <Provider store={store}>
    {children}
  </Provider>
);

describe('MarketDataWidget', () => {
  const mockTickerData = {
    BTCUSDT: {
      symbol: 'BTCUSDT',
      price: 43250.50,
      change24h: 1250.30,
      changePercent24h: 2.98,
      volume24h: 28500000,
      high24h: 43800,
      low24h: 41200,
      timestamp: Date.now(),
    },
    ETHUSDT: {
      symbol: 'ETHUSDT',
      price: 2650.75,
      change24h: -85.25,
      changePercent24h: -3.12,
      volume24h: 15200000,
      high24h: 2750,
      low24h: 2580,
      timestamp: Date.now(),
    },
  };

  test('renders market data widget with title', () => {
    render(
      <TestWrapper>
        <MarketDataWidget />
      </TestWrapper>
    );

    expect(screen.getByText('Market Data')).toBeInTheDocument();
  });

  test('displays connection status', () => {
    const store = createTestStore({
      marketData: {
        tickers: {},
        orderBooks: {},
        candles: {},
        selectedSymbol: 'BTCUSDT',
        selectedTimeframe: '1h',
        isConnected: true,
        lastUpdate: Date.now(),
      },
    });

    render(
      <TestWrapper store={store}>
        <MarketDataWidget />
      </TestWrapper>
    );

    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  test('displays disconnected status when not connected', () => {
    const store = createTestStore({
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

    render(
      <TestWrapper store={store}>
        <MarketDataWidget />
      </TestWrapper>
    );

    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  test('renders symbol cards with ticker data', () => {
    const store = createTestStore({
      marketData: {
        tickers: mockTickerData,
        orderBooks: {},
        candles: {},
        selectedSymbol: 'BTCUSDT',
        selectedTimeframe: '1h',
        isConnected: true,
        lastUpdate: Date.now(),
      },
    });

    render(
      <TestWrapper store={store}>
        <MarketDataWidget symbols={['BTCUSDT', 'ETHUSDT']} />
      </TestWrapper>
    );

    expect(screen.getByText('BTC/USDT')).toBeInTheDocument();
    expect(screen.getByText('ETH/USDT')).toBeInTheDocument();
    expect(screen.getByText('$43,250.50')).toBeInTheDocument();
    expect(screen.getByText('$2,650.75')).toBeInTheDocument();
  });

  test('displays price changes with correct colors', () => {
    const store = createTestStore({
      marketData: {
        tickers: mockTickerData,
        orderBooks: {},
        candles: {},
        selectedSymbol: 'BTCUSDT',
        selectedTimeframe: '1h',
        isConnected: true,
        lastUpdate: Date.now(),
      },
    });

    render(
      <TestWrapper store={store}>
        <MarketDataWidget symbols={['BTCUSDT', 'ETHUSDT']} />
      </TestWrapper>
    );

    // Positive change should be green
    const positiveChange = screen.getByText('+2.98%');
    expect(positiveChange).toHaveClass('MuiChip-colorSuccess');

    // Negative change should be red
    const negativeChange = screen.getByText('-3.12%');
    expect(negativeChange).toHaveClass('MuiChip-colorError');
  });

  test('handles symbol selection', () => {
    const store = createTestStore({
      marketData: {
        tickers: mockTickerData,
        orderBooks: {},
        candles: {},
        selectedSymbol: 'BTCUSDT',
        selectedTimeframe: '1h',
        isConnected: true,
        lastUpdate: Date.now(),
      },
    });

    render(
      <TestWrapper store={store}>
        <MarketDataWidget symbols={['BTCUSDT', 'ETHUSDT']} />
      </TestWrapper>
    );

    // Click on ETH card
    const ethCard = screen.getByText('ETH/USDT').closest('.MuiCard-root');
    expect(ethCard).toBeInTheDocument();
    
    if (ethCard) {
      fireEvent.click(ethCard);
    }

    // Check if the selection is reflected in the store
    const state = store.getState();
    expect(state.marketData.selectedSymbol).toBe('ETHUSDT');
  });

  test('highlights selected symbol', () => {
    const store = createTestStore({
      marketData: {
        tickers: mockTickerData,
        orderBooks: {},
        candles: {},
        selectedSymbol: 'BTCUSDT',
        selectedTimeframe: '1h',
        isConnected: true,
        lastUpdate: Date.now(),
      },
    });

    render(
      <TestWrapper store={store}>
        <MarketDataWidget symbols={['BTCUSDT', 'ETHUSDT']} />
      </TestWrapper>
    );

    const btcCard = screen.getByText('BTC/USDT').closest('.MuiCard-root');
    const ethCard = screen.getByText('ETH/USDT').closest('.MuiCard-root');

    // BTC should be selected (elevated variant)
    expect(btcCard).toHaveClass('MuiPaper-elevation');
    
    // ETH should not be selected (outlined variant)
    expect(ethCard).not.toHaveClass('MuiPaper-elevation');
  });

  test('formats prices correctly', () => {
    const store = createTestStore({
      marketData: {
        tickers: {
          BTCUSDT: { ...mockTickerData.BTCUSDT, price: 43250.123456 },
          ADAUSDT: { 
            symbol: 'ADAUSDT',
            price: 0.482567,
            change24h: 0.012,
            changePercent24h: 2.55,
            volume24h: 125000000,
            high24h: 0.495,
            low24h: 0.465,
            timestamp: Date.now(),
          },
        },
        orderBooks: {},
        candles: {},
        selectedSymbol: 'BTCUSDT',
        selectedTimeframe: '1h',
        isConnected: true,
        lastUpdate: Date.now(),
      },
    });

    render(
      <TestWrapper store={store}>
        <MarketDataWidget symbols={['BTCUSDT', 'ADAUSDT']} />
      </TestWrapper>
    );

    // High value should show 2 decimal places
    expect(screen.getByText('$43,250.12')).toBeInTheDocument();
    
    // Low value should show more decimal places
    expect(screen.getByText('$0.482567')).toBeInTheDocument();
  });

  test('formats volume correctly', () => {
    const store = createTestStore({
      marketData: {
        tickers: mockTickerData,
        orderBooks: {},
        candles: {},
        selectedSymbol: 'BTCUSDT',
        selectedTimeframe: '1h',
        isConnected: true,
        lastUpdate: Date.now(),
      },
    });

    render(
      <TestWrapper store={store}>
        <MarketDataWidget symbols={['BTCUSDT', 'ETHUSDT']} />
      </TestWrapper>
    );

    // Volume should be formatted with M suffix
    expect(screen.getByText('28.50M')).toBeInTheDocument();
    expect(screen.getByText('15.20M')).toBeInTheDocument();
  });

  test('shows loading state when no ticker data', () => {
    const store = createTestStore({
      marketData: {
        tickers: {},
        orderBooks: {},
        candles: {},
        selectedSymbol: 'BTCUSDT',
        selectedTimeframe: '1h',
        isConnected: true,
        lastUpdate: 0,
      },
    });

    render(
      <TestWrapper store={store}>
        <MarketDataWidget symbols={['BTCUSDT']} />
      </TestWrapper>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('displays trend icons correctly', () => {
    const store = createTestStore({
      marketData: {
        tickers: mockTickerData,
        orderBooks: {},
        candles: {},
        selectedSymbol: 'BTCUSDT',
        selectedTimeframe: '1h',
        isConnected: true,
        lastUpdate: Date.now(),
      },
    });

    render(
      <TestWrapper store={store}>
        <MarketDataWidget symbols={['BTCUSDT', 'ETHUSDT']} />
      </TestWrapper>
    );

    // Should have trending up and down icons
    const trendingUpIcons = document.querySelectorAll('[data-testid="TrendingUpIcon"]');
    const trendingDownIcons = document.querySelectorAll('[data-testid="TrendingDownIcon"]');
    
    expect(trendingUpIcons.length).toBeGreaterThan(0);
    expect(trendingDownIcons.length).toBeGreaterThan(0);
  });

  test('updates last update time', () => {
    const lastUpdate = Date.now() - 30000; // 30 seconds ago
    const store = createTestStore({
      marketData: {
        tickers: mockTickerData,
        orderBooks: {},
        candles: {},
        selectedSymbol: 'BTCUSDT',
        selectedTimeframe: '1h',
        isConnected: true,
        lastUpdate,
      },
    });

    render(
      <TestWrapper store={store}>
        <MarketDataWidget />
      </TestWrapper>
    );

    // Should show time since last update
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    expect(refreshButton).toBeInTheDocument();
  });
});