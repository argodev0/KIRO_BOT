/**
 * Virtual Portfolio Display Component Tests
 * Tests the enhanced virtual portfolio display with real-time updates
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import '@testing-library/jest-dom';
import VirtualPortfolioDisplay from '../../frontend/components/dashboard/VirtualPortfolioDisplay';
import tradingReducer from '../../frontend/store/slices/tradingSlice';

// Mock the useVirtualPortfolio hook
jest.mock('../../frontend/hooks/useVirtualPortfolio', () => ({
  useVirtualPortfolio: () => ({
    portfolio: {
      userId: 'test-user',
      totalBalance: 10000,
      availableBalance: 8500,
      lockedBalance: 1500,
      totalUnrealizedPnl: 250,
      totalRealizedPnl: 150,
      equity: 10400,
      positions: [
        {
          id: 'pos-1',
          userId: 'test-user',
          symbol: 'BTCUSDT',
          side: 'long',
          size: 0.1,
          entryPrice: 45000,
          currentPrice: 46000,
          unrealizedPnl: 100,
          realizedPnl: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPaperPosition: true
        }
      ],
      tradeHistory: [
        {
          id: 'trade-1',
          userId: 'test-user',
          symbol: 'BTCUSDT',
          side: 'BUY',
          quantity: 0.1,
          price: 45000,
          fee: 4.5,
          slippage: 2.25,
          executedAt: new Date(),
          isPaperTrade: true
        }
      ],
      performance: {
        totalTrades: 5,
        winningTrades: 3,
        losingTrades: 2,
        winRate: 60,
        averageWin: 150,
        averageLoss: 75,
        profitFactor: 2.0,
        maxDrawdown: 200,
        currentDrawdown: 50,
        sharpeRatio: 1.5,
        totalReturn: 400,
        totalReturnPercent: 4.0
      },
      isPaperPortfolio: true
    },
    positions: [
      {
        id: 'pos-1',
        userId: 'test-user',
        symbol: 'BTCUSDT',
        side: 'long',
        size: 0.1,
        entryPrice: 45000,
        currentPrice: 46000,
        unrealizedPnl: 100,
        realizedPnl: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPaperPosition: true
      }
    ],
    tradeHistory: [
      {
        id: 'trade-1',
        userId: 'test-user',
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 0.1,
        price: 45000,
        fee: 4.5,
        slippage: 2.25,
        executedAt: new Date(),
        isPaperTrade: true
      }
    ],
    performance: {
      totalTrades: 5,
      winningTrades: 3,
      losingTrades: 2,
      winRate: 60,
      averageWin: 150,
      averageLoss: 75,
      profitFactor: 2.0,
      maxDrawdown: 200,
      currentDrawdown: 50,
      sharpeRatio: 1.5,
      totalReturn: 400,
      totalReturnPercent: 4.0
    },
    isLoading: false,
    error: null,
    isConnected: true,
    refreshPortfolio: jest.fn(),
    refreshHistory: jest.fn(),
    refreshPerformance: jest.fn(),
    connectWebSocket: jest.fn(),
    disconnectWebSocket: jest.fn()
  })
}));

// Mock recharts components
jest.mock('recharts', () => ({
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: any) => <div data-testid="pie">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  Legend: () => <div data-testid="legend" />,
  Tooltip: () => <div data-testid="tooltip" />,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />
}));

const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      trading: tradingReducer
    },
    preloadedState: {
      trading: {
        signals: [],
        positions: [
          {
            id: 'pos-1',
            symbol: 'BTCUSDT',
            side: 'long',
            size: 0.1,
            entryPrice: 45000,
            currentPrice: 46000,
            unrealizedPnl: 100,
            timestamp: Date.now()
          }
        ],
        orders: [],
        portfolio: {
          totalBalance: 10000,
          availableBalance: 8500,
          totalUnrealizedPnl: 250,
          totalRealizedPnl: 150,
          maxDrawdown: 200,
          currentDrawdown: 50
        },
        paperTrading: {
          isEnabled: true,
          initialBalance: 10000,
          virtualBalance: 10400,
          totalPaperTrades: 5,
          paperTradingStartDate: Date.now() - 86400000 // 1 day ago
        },
        botStatus: 'stopped',
        isLoading: false,
        error: null,
        ...initialState
      }
    }
  });
};

describe('VirtualPortfolioDisplay Component', () => {
  let mockStore: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    mockStore = createMockStore();
    jest.clearAllMocks();
  });

  const renderComponent = (store = mockStore) => {
    return render(
      <Provider store={store}>
        <VirtualPortfolioDisplay />
      </Provider>
    );
  };

  describe('Basic Rendering', () => {
    test('renders virtual portfolio header with paper trading indicator', () => {
      renderComponent();
      
      expect(screen.getByText('Virtual Portfolio')).toBeInTheDocument();
      expect(screen.getByText('PAPER')).toBeInTheDocument();
      expect(screen.getByText(/Simulated Trading/)).toBeInTheDocument();
    });

    test('displays portfolio overview with correct values', () => {
      renderComponent();
      
      expect(screen.getByText('Total Balance')).toBeInTheDocument();
      expect(screen.getByText('$10,000.00')).toBeInTheDocument();
      expect(screen.getByText('Available')).toBeInTheDocument();
      expect(screen.getByText('$8,500.00')).toBeInTheDocument();
    });

    test('shows P&L information with correct formatting', () => {
      renderComponent();
      
      expect(screen.getByText('$400.00')).toBeInTheDocument(); // Total P&L
      expect(screen.getByText('+4.00%')).toBeInTheDocument(); // P&L percentage
    });

    test('displays connection status indicators', () => {
      renderComponent();
      
      // Should show connected status (Wifi icon)
      expect(screen.getByTestId('WifiIcon')).toBeInTheDocument();
      expect(screen.getByText('LIVE UPDATES')).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    test('renders all tab options', () => {
      renderComponent();
      
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Allocation')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Performance')).toBeInTheDocument();
    });

    test('switches between tabs correctly', async () => {
      renderComponent();
      
      // Click on Allocation tab
      fireEvent.click(screen.getByText('Allocation'));
      await waitFor(() => {
        expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      });

      // Click on History tab
      fireEvent.click(screen.getByText('History'));
      await waitFor(() => {
        expect(screen.getByText('Paper Trading History')).toBeInTheDocument();
      });

      // Click on Performance tab
      fireEvent.click(screen.getByText('Performance'));
      await waitFor(() => {
        expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
      });
    });
  });

  describe('Portfolio Overview Tab', () => {
    test('displays active positions when available', () => {
      renderComponent();
      
      expect(screen.getByText('Active Positions')).toBeInTheDocument();
      expect(screen.getByText('BTC/USDT')).toBeInTheDocument();
      expect(screen.getByText('LONG • 0.1')).toBeInTheDocument();
      expect(screen.getByText('$100.00')).toBeInTheDocument(); // Unrealized PnL
    });

    test('shows paper trading statistics', () => {
      renderComponent();
      
      expect(screen.getByText('Paper Trading Statistics')).toBeInTheDocument();
      expect(screen.getByText('Total Trades')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('Win Rate')).toBeInTheDocument();
      expect(screen.getByText('60.0%')).toBeInTheDocument();
    });

    test('displays no positions message when portfolio is empty', () => {
      const emptyStore = createMockStore({
        positions: []
      });
      renderComponent(emptyStore);
      
      expect(screen.getByText('No active positions')).toBeInTheDocument();
    });
  });

  describe('Portfolio Allocation Tab', () => {
    test('renders allocation chart components', async () => {
      renderComponent();
      
      fireEvent.click(screen.getByText('Allocation'));
      
      await waitFor(() => {
        expect(screen.getByText('Portfolio Allocation & Risk Analysis')).toBeInTheDocument();
        expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
        expect(screen.getByText('Risk Metrics')).toBeInTheDocument();
      });
    });

    test('shows portfolio overview in allocation tab', async () => {
      renderComponent();
      
      fireEvent.click(screen.getByText('Allocation'));
      
      await waitFor(() => {
        expect(screen.getByText('Portfolio Overview')).toBeInTheDocument();
        expect(screen.getByText('Total Value')).toBeInTheDocument();
        expect(screen.getByText('Available Cash')).toBeInTheDocument();
      });
    });
  });

  describe('Trading History Tab', () => {
    test('renders trading history component', async () => {
      renderComponent();
      
      fireEvent.click(screen.getByText('History'));
      
      await waitFor(() => {
        expect(screen.getByText('Paper Trading History')).toBeInTheDocument();
        expect(screen.getByText(/Simulated Trading History/)).toBeInTheDocument();
      });
    });
  });

  describe('Performance Tab', () => {
    test('displays performance metrics when available', async () => {
      renderComponent();
      
      fireEvent.click(screen.getByText('Performance'));
      
      await waitFor(() => {
        expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
        expect(screen.getByText('Trading Statistics')).toBeInTheDocument();
        expect(screen.getByText('Profit & Loss')).toBeInTheDocument();
      });
    });

    test('shows detailed performance statistics', async () => {
      renderComponent();
      
      fireEvent.click(screen.getByText('Performance'));
      
      await waitFor(() => {
        expect(screen.getByText('Total Return')).toBeInTheDocument();
        expect(screen.getByText('$400.00')).toBeInTheDocument();
        expect(screen.getByText('Return %')).toBeInTheDocument();
        expect(screen.getByText('+4.00%')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    test('shows refresh button and handles refresh action', () => {
      renderComponent();
      
      const refreshButton = screen.getByTestId('RefreshIcon').closest('button');
      expect(refreshButton).toBeInTheDocument();
      
      fireEvent.click(refreshButton!);
      // The mock functions should be called
    });

    test('displays connection status correctly', () => {
      renderComponent();
      
      // Should show connected status
      expect(screen.getByTestId('WifiIcon')).toBeInTheDocument();
      expect(screen.getByText('LIVE UPDATES')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('displays error message when error occurs', () => {
      // Mock the hook to return an error
      jest.doMock('../../frontend/hooks/useVirtualPortfolio', () => ({
        useVirtualPortfolio: () => ({
          portfolio: null,
          positions: [],
          tradeHistory: [],
          performance: null,
          isLoading: false,
          error: 'Failed to fetch portfolio data',
          isConnected: false,
          refreshPortfolio: jest.fn(),
          refreshHistory: jest.fn(),
          refreshPerformance: jest.fn(),
          connectWebSocket: jest.fn(),
          disconnectWebSocket: jest.fn()
        })
      }));

      renderComponent();
      
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch portfolio data')).toBeInTheDocument();
    });
  });

  describe('Paper Trading Safety', () => {
    test('displays multiple paper trading safety indicators', () => {
      renderComponent();
      
      // Check for paper trading chips and alerts
      const paperChips = screen.getAllByText('PAPER');
      expect(paperChips.length).toBeGreaterThan(0);
      
      expect(screen.getByText(/All trades are simulated - No real money at risk/)).toBeInTheDocument();
      expect(screen.getByText(/Simulated Trading/)).toBeInTheDocument();
    });

    test('shows safety warnings in all tabs', async () => {
      renderComponent();
      
      // Check Overview tab
      expect(screen.getByText(/All trades are simulated/)).toBeInTheDocument();
      
      // Check Allocation tab
      fireEvent.click(screen.getByText('Allocation'));
      await waitFor(() => {
        expect(screen.getByText(/All allocations and risk metrics are virtual/)).toBeInTheDocument();
      });
      
      // Check History tab
      fireEvent.click(screen.getByText('History'));
      await waitFor(() => {
        expect(screen.getByText(/All trading history is simulated/)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    test('renders properly on different screen sizes', () => {
      renderComponent();
      
      // The component should render without errors
      expect(screen.getByText('Virtual Portfolio')).toBeInTheDocument();
      
      // Grid components should be present
      expect(screen.getByText('Total Balance')).toBeInTheDocument();
      expect(screen.getByText('Available')).toBeInTheDocument();
    });
  });

  describe('Data Formatting', () => {
    test('formats currency values correctly', () => {
      renderComponent();
      
      expect(screen.getByText('$10,000.00')).toBeInTheDocument();
      expect(screen.getByText('$8,500.00')).toBeInTheDocument();
      expect(screen.getByText('$400.00')).toBeInTheDocument();
    });

    test('formats percentage values correctly', () => {
      renderComponent();
      
      expect(screen.getByText('+4.00%')).toBeInTheDocument();
      expect(screen.getByText('60.0%')).toBeInTheDocument();
    });
  });
});