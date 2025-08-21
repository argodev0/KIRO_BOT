import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import '@testing-library/jest-dom';

import PortfolioOverview from '../../../components/dashboard/PortfolioOverview';
import tradingReducer from '../../../store/slices/tradingSlice';

const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      trading: tradingReducer,
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

describe('PortfolioOverview', () => {
  const mockPortfolioData = {
    totalBalance: 50000,
    availableBalance: 35000,
    totalUnrealizedPnl: 2450.75,
    totalRealizedPnl: 1250.30,
    maxDrawdown: -5.2,
    currentDrawdown: -1.8,
  };

  const mockPositions = [
    {
      id: 'pos_001',
      symbol: 'BTCUSDT',
      side: 'long' as const,
      size: 0.1,
      entryPrice: 43000,
      currentPrice: 43250.50,
      unrealizedPnl: 25.05,
      stopLoss: 42000,
      takeProfit: [44000, 45000],
      timestamp: Date.now() - 300000,
    },
    {
      id: 'pos_002',
      symbol: 'ETHUSDT',
      side: 'short' as const,
      size: 2,
      entryPrice: 2700,
      currentPrice: 2650.75,
      unrealizedPnl: 98.50,
      stopLoss: 2750,
      takeProfit: [2600, 2550],
      timestamp: Date.now() - 600000,
    },
  ];

  test('renders portfolio overview title', () => {
    render(
      <TestWrapper>
        <PortfolioOverview />
      </TestWrapper>
    );

    expect(screen.getByText('Portfolio Overview')).toBeInTheDocument();
  });

  test('displays portfolio balance information', () => {
    const store = createTestStore({
      trading: {
        signals: [],
        positions: [],
        orders: [],
        portfolio: mockPortfolioData,
        botStatus: 'stopped',
        isLoading: false,
        error: null,
      },
    });

    render(
      <TestWrapper store={store}>
        <PortfolioOverview />
      </TestWrapper>
    );

    expect(screen.getByText('Total Balance')).toBeInTheDocument();
    expect(screen.getByText('$50,000.00')).toBeInTheDocument();
    expect(screen.getByText('Available Balance')).toBeInTheDocument();
    expect(screen.getByText('$35,000.00')).toBeInTheDocument();
  });

  test('displays P&L information with correct colors', () => {
    const store = createTestStore({
      trading: {
        signals: [],
        positions: [],
        orders: [],
        portfolio: mockPortfolioData,
        botStatus: 'stopped',
        isLoading: false,
        error: null,
      },
    });

    render(
      <TestWrapper store={store}>
        <PortfolioOverview />
      </TestWrapper>
    );

    expect(screen.getByText('Unrealized P&L')).toBeInTheDocument();
    expect(screen.getByText('$2,450.75')).toBeInTheDocument();
    expect(screen.getByText('Realized P&L (Today)')).toBeInTheDocument();
    expect(screen.getByText('$1,250.30')).toBeInTheDocument();
  });

  test('displays max drawdown information', () => {
    const store = createTestStore({
      trading: {
        signals: [],
        positions: [],
        orders: [],
        portfolio: mockPortfolioData,
        botStatus: 'stopped',
        isLoading: false,
        error: null,
      },
    });

    render(
      <TestWrapper store={store}>
        <PortfolioOverview />
      </TestWrapper>
    );

    expect(screen.getByText('Max Drawdown')).toBeInTheDocument();
    expect(screen.getByText('-5.20%')).toBeInTheDocument();
  });

  test('calculates and displays portfolio allocation', () => {
    const store = createTestStore({
      trading: {
        signals: [],
        positions: mockPositions,
        orders: [],
        portfolio: mockPortfolioData,
        botStatus: 'stopped',
        isLoading: false,
        error: null,
      },
    });

    render(
      <TestWrapper store={store}>
        <PortfolioOverview />
      </TestWrapper>
    );

    expect(screen.getByText('Portfolio Allocation')).toBeInTheDocument();
    
    // Should show allocation percentage
    const allocationText = screen.getByText(/\d+\.\d%/);
    expect(allocationText).toBeInTheDocument();
  });

  test('displays active positions', () => {
    const store = createTestStore({
      trading: {
        signals: [],
        positions: mockPositions,
        orders: [],
        portfolio: mockPortfolioData,
        botStatus: 'stopped',
        isLoading: false,
        error: null,
      },
    });

    render(
      <TestWrapper store={store}>
        <PortfolioOverview />
      </TestWrapper>
    );

    expect(screen.getByText('Active Positions (2)')).toBeInTheDocument();
    expect(screen.getByText('BTCUSDT')).toBeInTheDocument();
    expect(screen.getByText('ETHUSDT')).toBeInTheDocument();
  });

  test('displays position details correctly', () => {
    const store = createTestStore({
      trading: {
        signals: [],
        positions: mockPositions,
        orders: [],
        portfolio: mockPortfolioData,
        botStatus: 'stopped',
        isLoading: false,
        error: null,
      },
    });

    render(
      <TestWrapper store={store}>
        <PortfolioOverview />
      </TestWrapper>
    );

    // Check for position sides
    expect(screen.getByText('LONG')).toBeInTheDocument();
    expect(screen.getByText('SHORT')).toBeInTheDocument();

    // Check for position sizes and prices
    expect(screen.getByText(/Size: 0\.1000/)).toBeInTheDocument();
    expect(screen.getByText(/Entry: \$43000\.0000/)).toBeInTheDocument();
    expect(screen.getByText(/Current: \$43250\.5000/)).toBeInTheDocument();
  });

  test('displays position P&L with correct formatting', () => {
    const store = createTestStore({
      trading: {
        signals: [],
        positions: mockPositions,
        orders: [],
        portfolio: mockPortfolioData,
        botStatus: 'stopped',
        isLoading: false,
        error: null,
      },
    });

    render(
      <TestWrapper store={store}>
        <PortfolioOverview />
      </TestWrapper>
    );

    // Check for P&L values
    expect(screen.getByText('$25.05')).toBeInTheDocument();
    expect(screen.getByText('$98.50')).toBeInTheDocument();
  });

  test('shows correct position side colors', () => {
    const store = createTestStore({
      trading: {
        signals: [],
        positions: mockPositions,
        orders: [],
        portfolio: mockPortfolioData,
        botStatus: 'stopped',
        isLoading: false,
        error: null,
      },
    });

    render(
      <TestWrapper store={store}>
        <PortfolioOverview />
      </TestWrapper>
    );

    const longChip = screen.getByText('LONG');
    const shortChip = screen.getByText('SHORT');

    expect(longChip).toHaveClass('MuiChip-colorSuccess');
    expect(shortChip).toHaveClass('MuiChip-colorError');
  });

  test('handles empty positions state', () => {
    const store = createTestStore({
      trading: {
        signals: [],
        positions: [],
        orders: [],
        portfolio: mockPortfolioData,
        botStatus: 'stopped',
        isLoading: false,
        error: null,
      },
    });

    render(
      <TestWrapper store={store}>
        <PortfolioOverview />
      </TestWrapper>
    );

    expect(screen.getByText('Active Positions (0)')).toBeInTheDocument();
    expect(screen.getByText('No active positions')).toBeInTheDocument();
  });

  test('limits displayed positions to 5', () => {
    const manyPositions = Array.from({ length: 8 }, (_, i) => ({
      id: `pos_${i}`,
      symbol: `SYMBOL${i}USDT`,
      side: 'long' as const,
      size: 1,
      entryPrice: 1000,
      currentPrice: 1010,
      unrealizedPnl: 10,
      timestamp: Date.now(),
    }));

    const store = createTestStore({
      trading: {
        signals: [],
        positions: manyPositions,
        orders: [],
        portfolio: mockPortfolioData,
        botStatus: 'stopped',
        isLoading: false,
        error: null,
      },
    });

    render(
      <TestWrapper store={store}>
        <PortfolioOverview />
      </TestWrapper>
    );

    expect(screen.getByText('Active Positions (8)')).toBeInTheDocument();
    expect(screen.getByText('+3 more positions')).toBeInTheDocument();
  });

  test('displays trending icons for P&L', () => {
    const store = createTestStore({
      trading: {
        signals: [],
        positions: [],
        orders: [],
        portfolio: {
          ...mockPortfolioData,
          totalUnrealizedPnl: 1500, // positive
          totalRealizedPnl: -500,   // negative
        },
        botStatus: 'stopped',
        isLoading: false,
        error: null,
      },
    });

    render(
      <TestWrapper store={store}>
        <PortfolioOverview />
      </TestWrapper>
    );

    // Should have trending up and down icons
    const trendingUpIcons = document.querySelectorAll('[data-testid="TrendingUpIcon"]');
    const trendingDownIcons = document.querySelectorAll('[data-testid="TrendingDownIcon"]');
    
    expect(trendingUpIcons.length).toBeGreaterThan(0);
    expect(trendingDownIcons.length).toBeGreaterThan(0);
  });

  test('handles negative P&L display', () => {
    const store = createTestStore({
      trading: {
        signals: [],
        positions: [
          {
            ...mockPositions[0],
            unrealizedPnl: -150.25,
          },
        ],
        orders: [],
        portfolio: {
          ...mockPortfolioData,
          totalUnrealizedPnl: -500.75,
          totalRealizedPnl: -250.50,
        },
        botStatus: 'stopped',
        isLoading: false,
        error: null,
      },
    });

    render(
      <TestWrapper store={store}>
        <PortfolioOverview />
      </TestWrapper>
    );

    expect(screen.getByText('-$500.75')).toBeInTheDocument();
    expect(screen.getByText('-$250.50')).toBeInTheDocument();
    expect(screen.getByText('-$150.25')).toBeInTheDocument();
  });

  test('calculates position percentage correctly', () => {
    const store = createTestStore({
      trading: {
        signals: [],
        positions: [
          {
            ...mockPositions[0],
            entryPrice: 40000,
            currentPrice: 44000, // 10% gain
          },
        ],
        orders: [],
        portfolio: mockPortfolioData,
        botStatus: 'stopped',
        isLoading: false,
        error: null,
      },
    });

    render(
      <TestWrapper store={store}>
        <PortfolioOverview />
      </TestWrapper>
    );

    // Should show percentage gain
    expect(screen.getByText('+10.00%')).toBeInTheDocument();
  });
});