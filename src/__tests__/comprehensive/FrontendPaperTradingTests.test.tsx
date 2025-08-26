/**
 * Comprehensive Frontend Paper Trading Tests
 * Frontend tests for paper trading mode indicators and components
 * Requirements: 3.4
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

// Import components to test
import PaperTradingIndicator from '../../frontend/components/common/PaperTradingIndicator';
import VirtualPortfolioDisplay from '../../frontend/components/dashboard/VirtualPortfolioDisplay';
import PaperTradingConfirmDialog from '../../frontend/components/trading/PaperTradingConfirmDialog';
import TradingPage from '../../frontend/pages/TradingPage';
import DashboardPage from '../../frontend/pages/DashboardPage';

// Import store slices
import tradingSlice from '../../frontend/store/slices/tradingSlice';
import authSlice from '../../frontend/store/slices/authSlice';
import marketDataSlice from '../../frontend/store/slices/marketDataSlice';
import uiSlice from '../../frontend/store/slices/uiSlice';

// Mock WebSocket hook
jest.mock('../../frontend/hooks/useWebSocket', () => ({
  __esModule: true,
  default: () => ({
    isConnected: true,
    lastMessage: null,
    sendMessage: jest.fn(),
    connectionStatus: 'connected'
  })
}));

// Mock API service
jest.mock('../../frontend/services/api', () => ({
  tradingApi: {
    getPortfolio: jest.fn().mockResolvedValue({
      data: {
        totalBalance: 10000,
        availableBalance: 8500,
        positions: [],
        isPaperPortfolio: true
      }
    }),
    getPositions: jest.fn().mockResolvedValue({ data: [] }),
    getOrders: jest.fn().mockResolvedValue({ data: [] }),
    placeOrder: jest.fn().mockResolvedValue({
      data: {
        orderId: 'sim_order_123',
        isPaperTrade: true,
        status: 'filled'
      }
    })
  },
  marketApi: {
    getTicker: jest.fn().mockResolvedValue({
      data: {
        symbol: 'BTCUSDT',
        price: 50000,
        change24h: 2.5,
        isLiveData: true,
        paperTradingMode: true
      }
    })
  }
}));

// Test store configuration
const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      trading: tradingSlice,
      auth: authSlice,
      marketData: marketDataSlice,
      ui: uiSlice
    },
    preloadedState: {
      auth: {
        isAuthenticated: true,
        user: { id: 'test-user', email: 'test@example.com' },
        token: 'test-token',
        isLoading: false,
        error: null
      },
      trading: {
        signals: [],
        positions: [
          {
            id: '1',
            symbol: 'BTCUSDT',
            side: 'long',
            size: 0.1,
            entryPrice: 50000,
            currentPrice: 52000,
            unrealizedPnl: 200,
            timestamp: Date.now(),
            isPaperPosition: true
          }
        ],
        orders: [
          {
            id: 'sim_order_1',
            symbol: 'ETHUSDT',
            side: 'buy',
            quantity: 0.5,
            price: 3000,
            status: 'filled',
            timestamp: Date.now(),
            isPaperTrade: true
          }
        ],
        portfolio: {
          totalBalance: 10000,
          availableBalance: 8500,
          totalUnrealizedPnl: 200,
          totalRealizedPnl: 150,
          maxDrawdown: -5.2,
          currentDrawdown: -2.1,
          isPaperPortfolio: true
        },
        paperTrading: {
          isEnabled: true,
          initialBalance: 10000,
          virtualBalance: 10000,
          totalPaperTrades: 5,
          paperTradingStartDate: Date.now()
        },
        botStatus: 'stopped',
        isLoading: false,
        error: null
      },
      marketData: {
        tickers: {
          BTCUSDT: {
            symbol: 'BTCUSDT',
            price: 50000,
            change24h: 2.5,
            volume: 1000000,
            timestamp: Date.now(),
            isLiveData: true,
            paperTradingMode: true
          }
        },
        klines: {},
        subscriptions: ['BTCUSDT'],
        isConnected: true,
        lastUpdate: Date.now()
      },
      ui: {
        theme: 'dark',
        sidebarOpen: true,
        notifications: [],
        modals: {
          paperTradingConfirm: false
        }
      },
      ...initialState
    }
  });
};

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode; store?: any }> = ({ 
  children, 
  store = createTestStore() 
}) => (
  <Provider store={store}>
    <BrowserRouter>
      {children}
    </BrowserRouter>
  </Provider>
);

describe('Comprehensive Frontend Paper Trading Tests', () => {
  describe('PaperTradingIndicator Component', () => {
    test('should render chip variant with proper styling', () => {
      render(
        <TestWrapper>
          <PaperTradingIndicator variant="chip" />
        </TestWrapper>
      );

      const indicator = screen.getByText('PAPER TRADING');
      expect(indicator).toBeInTheDocument();
      expect(indicator.closest('.MuiChip-root')).toBeInTheDocument();
      expect(indicator.closest('.MuiChip-root')).toHaveClass('MuiChip-colorWarning');
    });

    test('should render banner variant with detailed information', () => {
      render(
        <TestWrapper>
          <PaperTradingIndicator variant="banner" showDetails={true} />
        </TestWrapper>
      );

      expect(screen.getByText('PAPER TRADING MODE ACTIVE')).toBeInTheDocument();
      expect(screen.getByText('All trades are simulated - No real money at risk')).toBeInTheDocument();
      expect(screen.getByTestId('paper-trading-banner')).toHaveClass('paper-trading-banner');
    });

    test('should expand details when clicked in banner mode', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <PaperTradingIndicator variant="banner" showDetails={true} />
        </TestWrapper>
      );

      const expandButton = screen.getByRole('button', { name: /expand/i });
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('Paper Trading Safety Features:')).toBeInTheDocument();
        expect(screen.getByText('All trading operations are simulated')).toBeInTheDocument();
        expect(screen.getByText('Virtual portfolio with $10,000 starting balance')).toBeInTheDocument();
        expect(screen.getByText('Real-time market data with zero financial risk')).toBeInTheDocument();
      });
    });

    test('should render inline variant for compact spaces', () => {
      render(
        <TestWrapper>
          <PaperTradingIndicator variant="inline" />
        </TestWrapper>
      );

      expect(screen.getByText('Paper Trading Mode')).toBeInTheDocument();
      expect(screen.getByTestId('paper-trading-inline')).toHaveClass('paper-trading-inline');
    });

    test('should show tooltip on hover for chip variant', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <PaperTradingIndicator variant="chip" />
        </TestWrapper>
      );

      const chip = screen.getByRole('button');
      await user.hover(chip);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        expect(screen.getByText(/All trades are simulated/)).toBeInTheDocument();
      });
    });

    test('should display different sizes correctly', () => {
      const { rerender } = render(
        <TestWrapper>
          <PaperTradingIndicator variant="chip" size="small" />
        </TestWrapper>
      );

      expect(screen.getByRole('button')).toHaveClass('MuiChip-sizeSmall');

      rerender(
        <TestWrapper>
          <PaperTradingIndicator variant="chip" size="large" />
        </TestWrapper>
      );

      expect(screen.getByRole('button')).toHaveClass('MuiChip-sizeMedium');
    });

    test('should be accessible with proper ARIA labels', () => {
      render(
        <TestWrapper>
          <PaperTradingIndicator variant="banner" />
        </TestWrapper>
      );

      const banner = screen.getByRole('alert');
      expect(banner).toHaveAttribute('aria-label', 'Paper trading mode is active');
      expect(banner).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('VirtualPortfolioDisplay Component', () => {
    test('should display virtual portfolio with paper trading indicators', () => {
      render(
        <TestWrapper>
          <VirtualPortfolioDisplay />
        </TestWrapper>
      );

      expect(screen.getByText('Virtual Portfolio')).toBeInTheDocument();
      expect(screen.getByText('PAPER TRADING')).toBeInTheDocument();
      expect(screen.getByText('Simulated Trading Environment:')).toBeInTheDocument();
      expect(screen.getByText('$10,000.00')).toBeInTheDocument();
    });

    test('should show virtual balance with proper formatting', () => {
      render(
        <TestWrapper>
          <VirtualPortfolioDisplay />
        </TestWrapper>
      );

      expect(screen.getByText('Virtual Total Balance')).toBeInTheDocument();
      expect(screen.getByText('(Simulated)')).toBeInTheDocument();
      expect(screen.getByText('$8,500.00')).toBeInTheDocument(); // Available balance
    });

    test('should display virtual positions with paper trading labels', () => {
      render(
        <TestWrapper>
          <VirtualPortfolioDisplay />
        </TestWrapper>
      );

      expect(screen.getByText('Virtual Positions (1)')).toBeInTheDocument();
      expect(screen.getByText('BTCUSDT')).toBeInTheDocument();
      expect(screen.getByText('LONG')).toBeInTheDocument();
      expect(screen.getByText('PAPER')).toBeInTheDocument();
    });

    test('should show P&L with virtual labels', () => {
      render(
        <TestWrapper>
          <VirtualPortfolioDisplay />
        </TestWrapper>
      );

      expect(screen.getByText('Simulated Unrealized P&L')).toBeInTheDocument();
      expect(screen.getByText('Simulated Realized P&L (Today)')).toBeInTheDocument();
      expect(screen.getAllByText('VIRTUAL')).toHaveLength(2);
    });

    test('should display paper trading disclaimer', () => {
      render(
        <TestWrapper>
          <VirtualPortfolioDisplay />
        </TestWrapper>
      );

      expect(screen.getByText(
        'All positions and balances are simulated for educational purposes only'
      )).toBeInTheDocument();
    });

    test('should handle empty positions state', () => {
      const storeWithEmptyPositions = createTestStore({
        trading: {
          positions: [],
          portfolio: {
            totalBalance: 10000,
            availableBalance: 10000,
            totalUnrealizedPnl: 0,
            totalRealizedPnl: 0,
            isPaperPortfolio: true
          },
          paperTrading: {
            isEnabled: true,
            initialBalance: 10000,
            virtualBalance: 10000
          }
        }
      });

      render(
        <TestWrapper store={storeWithEmptyPositions}>
          <VirtualPortfolioDisplay />
        </TestWrapper>
      );

      expect(screen.getByText('No virtual positions active')).toBeInTheDocument();
    });

    test('should update in real-time with WebSocket data', async () => {
      const store = createTestStore();
      
      render(
        <TestWrapper store={store}>
          <VirtualPortfolioDisplay />
        </TestWrapper>
      );

      // Simulate WebSocket update
      store.dispatch({
        type: 'trading/updatePosition',
        payload: {
          id: '1',
          currentPrice: 53000,
          unrealizedPnl: 300
        }
      });

      await waitFor(() => {
        expect(screen.getByText('$300.00')).toBeInTheDocument();
      });
    });
  });

  describe('PaperTradingConfirmDialog Component', () => {
    const mockOnConfirm = jest.fn();
    const mockOnCancel = jest.fn();

    beforeEach(() => {
      mockOnConfirm.mockClear();
      mockOnCancel.mockClear();
    });

    test('should display confirmation dialog with trade details', () => {
      const tradeDetails = {
        symbol: 'BTCUSDT',
        side: 'buy',
        quantity: 0.1,
        price: 50000,
        type: 'market'
      };

      render(
        <TestWrapper>
          <PaperTradingConfirmDialog
            open={true}
            tradeDetails={tradeDetails}
            onConfirm={mockOnConfirm}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      );

      expect(screen.getByText('Confirm Paper Trade')).toBeInTheDocument();
      expect(screen.getByText('BTCUSDT')).toBeInTheDocument();
      expect(screen.getByText('BUY')).toBeInTheDocument();
      expect(screen.getByText('0.1')).toBeInTheDocument();
      expect(screen.getByText('Market Order')).toBeInTheDocument();
    });

    test('should show paper trading warnings', () => {
      render(
        <TestWrapper>
          <PaperTradingConfirmDialog
            open={true}
            tradeDetails={{
              symbol: 'ETHUSDT',
              side: 'sell',
              quantity: 0.5,
              price: 3000,
              type: 'limit'
            }}
            onConfirm={mockOnConfirm}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      );

      expect(screen.getByText('⚠️ PAPER TRADING MODE')).toBeInTheDocument();
      expect(screen.getByText('This is a simulated trade - no real money will be used')).toBeInTheDocument();
      expect(screen.getByText('Virtual portfolio balance will be updated')).toBeInTheDocument();
    });

    test('should handle confirmation action', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <PaperTradingConfirmDialog
            open={true}
            tradeDetails={{
              symbol: 'BTCUSDT',
              side: 'buy',
              quantity: 0.1,
              type: 'market'
            }}
            onConfirm={mockOnConfirm}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      );

      const confirmButton = screen.getByRole('button', { name: /confirm paper trade/i });
      await user.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    test('should handle cancellation action', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <PaperTradingConfirmDialog
            open={true}
            tradeDetails={{
              symbol: 'BTCUSDT',
              side: 'buy',
              quantity: 0.1,
              type: 'market'
            }}
            onConfirm={mockOnConfirm}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    test('should display estimated fees and slippage', () => {
      render(
        <TestWrapper>
          <PaperTradingConfirmDialog
            open={true}
            tradeDetails={{
              symbol: 'BTCUSDT',
              side: 'buy',
              quantity: 0.1,
              price: 50000,
              type: 'market',
              estimatedFee: 5.0,
              estimatedSlippage: 0.05
            }}
            onConfirm={mockOnConfirm}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      );

      expect(screen.getByText('Estimated Fee: $5.00')).toBeInTheDocument();
      expect(screen.getByText('Estimated Slippage: 0.05%')).toBeInTheDocument();
    });
  });

  describe('TradingPage Integration', () => {
    test('should display paper trading indicators throughout trading interface', () => {
      render(
        <TestWrapper>
          <TradingPage />
        </TestWrapper>
      );

      // Should have multiple paper trading indicators
      const paperTradingElements = screen.getAllByText(/paper trading/i);
      expect(paperTradingElements.length).toBeGreaterThan(1);

      // Should show virtual portfolio
      expect(screen.getByText('Virtual Portfolio')).toBeInTheDocument();
      
      // Should show paper trading banner
      expect(screen.getByTestId('paper-trading-banner')).toBeInTheDocument();
    });

    test('should show live market data with paper trading context', async () => {
      render(
        <TestWrapper>
          <TradingPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('LIVE MAINNET DATA')).toBeInTheDocument();
        expect(screen.getByText('Paper Trading Mode')).toBeInTheDocument();
      });
    });

    test('should handle order placement with paper trading confirmation', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <TradingPage />
        </TestWrapper>
      );

      // Fill order form
      const symbolInput = screen.getByLabelText(/symbol/i);
      const quantityInput = screen.getByLabelText(/quantity/i);
      const submitButton = screen.getByRole('button', { name: /place order/i });

      await user.type(symbolInput, 'BTCUSDT');
      await user.type(quantityInput, '0.1');
      await user.click(submitButton);

      // Should show confirmation dialog
      await waitFor(() => {
        expect(screen.getByText('Confirm Paper Trade')).toBeInTheDocument();
      });
    });

    test('should display order history with paper trade markers', () => {
      render(
        <TestWrapper>
          <TradingPage />
        </TestWrapper>
      );

      expect(screen.getByText('Order History')).toBeInTheDocument();
      
      // All orders should be marked as paper trades
      const orderRows = screen.getAllByTestId(/order-row/);
      orderRows.forEach(row => {
        expect(row).toHaveTextContent('PAPER');
      });
    });
  });

  describe('DashboardPage Integration', () => {
    test('should display comprehensive paper trading dashboard', () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      expect(screen.getByText('Trading Dashboard')).toBeInTheDocument();
      expect(screen.getByText('PAPER TRADING MODE ACTIVE')).toBeInTheDocument();
      expect(screen.getByText('Virtual Portfolio')).toBeInTheDocument();
      expect(screen.getByText('Live Market Data')).toBeInTheDocument();
    });

    test('should show paper trading statistics', () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      expect(screen.getByText('Paper Trading Stats')).toBeInTheDocument();
      expect(screen.getByText('Total Virtual Trades: 5')).toBeInTheDocument();
      expect(screen.getByText('Virtual P&L: $350.00')).toBeInTheDocument();
      expect(screen.getByText('Risk Level: ZERO')).toBeInTheDocument();
    });

    test('should display real-time connection status', () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      expect(screen.getByText('Market Data: Connected')).toBeInTheDocument();
      expect(screen.getByText('Paper Trading: Active')).toBeInTheDocument();
      expect(screen.getByTestId('connection-status')).toHaveClass('connected');
    });
  });

  describe('Responsive Design and Accessibility', () => {
    test('should be responsive on mobile devices', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });

      render(
        <TestWrapper>
          <PaperTradingIndicator variant="banner" />
        </TestWrapper>
      );

      const banner = screen.getByTestId('paper-trading-banner');
      expect(banner).toHaveClass('mobile-responsive');
    });

    test('should have proper keyboard navigation', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <PaperTradingConfirmDialog
            open={true}
            tradeDetails={{
              symbol: 'BTCUSDT',
              side: 'buy',
              quantity: 0.1,
              type: 'market'
            }}
            onConfirm={jest.fn()}
            onCancel={jest.fn()}
          />
        </TestWrapper>
      );

      // Should be able to navigate with Tab key
      await user.tab();
      expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /confirm/i })).toHaveFocus();
    });

    test('should have proper ARIA labels and roles', () => {
      render(
        <TestWrapper>
          <VirtualPortfolioDisplay />
        </TestWrapper>
      );

      expect(screen.getByRole('region', { name: /virtual portfolio/i })).toBeInTheDocument();
      expect(screen.getByRole('alert', { name: /paper trading/i })).toBeInTheDocument();
      
      const balanceElement = screen.getByText('$10,000.00');
      expect(balanceElement).toHaveAttribute('aria-label', 'Virtual balance: 10,000 dollars');
    });

    test('should support screen readers', () => {
      render(
        <TestWrapper>
          <PaperTradingIndicator variant="banner" />
        </TestWrapper>
      );

      const banner = screen.getByRole('alert');
      expect(banner).toHaveAttribute('aria-live', 'polite');
      expect(banner).toHaveAttribute('aria-atomic', 'true');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing portfolio data gracefully', () => {
      const storeWithoutPortfolio = createTestStore({
        trading: {
          portfolio: null,
          paperTrading: {
            isEnabled: true
          }
        }
      });

      render(
        <TestWrapper store={storeWithoutPortfolio}>
          <VirtualPortfolioDisplay />
        </TestWrapper>
      );

      expect(screen.getByText('Loading virtual portfolio...')).toBeInTheDocument();
    });

    test('should handle WebSocket disconnection', () => {
      const storeWithDisconnectedWS = createTestStore({
        marketData: {
          isConnected: false,
          tickers: {}
        }
      });

      render(
        <TestWrapper store={storeWithDisconnectedWS}>
          <DashboardPage />
        </TestWrapper>
      );

      expect(screen.getByText('Market Data: Disconnected')).toBeInTheDocument();
      expect(screen.getByText('Attempting to reconnect...')).toBeInTheDocument();
    });

    test('should handle API errors gracefully', async () => {
      // Mock API error
      const mockApi = require('../../frontend/services/api');
      mockApi.tradingApi.placeOrder.mockRejectedValueOnce(new Error('API Error'));

      const user = userEvent.setup();

      render(
        <TestWrapper>
          <TradingPage />
        </TestWrapper>
      );

      // Try to place order
      const submitButton = screen.getByRole('button', { name: /place order/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Error placing paper trade')).toBeInTheDocument();
        expect(screen.getByText('Paper trading mode remains active')).toBeInTheDocument();
      });
    });
  });

  describe('Performance and Optimization', () => {
    test('should not cause memory leaks with frequent updates', async () => {
      const store = createTestStore();
      
      const { unmount } = render(
        <TestWrapper store={store}>
          <VirtualPortfolioDisplay />
        </TestWrapper>
      );

      // Simulate many updates
      for (let i = 0; i < 100; i++) {
        store.dispatch({
          type: 'trading/updatePortfolio',
          payload: {
            totalBalance: 10000 + i,
            availableBalance: 8500 + i
          }
        });
      }

      // Should not crash
      expect(screen.getByText('Virtual Portfolio')).toBeInTheDocument();

      unmount();
      // Component should unmount cleanly
    });

    test('should efficiently render large position lists', () => {
      const manyPositions = Array.from({ length: 100 }, (_, i) => ({
        id: `pos_${i}`,
        symbol: `SYMBOL${i}USDT`,
        side: 'long',
        size: 0.1,
        entryPrice: 1000 + i,
        currentPrice: 1100 + i,
        unrealizedPnl: 10 + i,
        isPaperPosition: true
      }));

      const storeWithManyPositions = createTestStore({
        trading: {
          positions: manyPositions,
          portfolio: {
            totalBalance: 10000,
            isPaperPortfolio: true
          }
        }
      });

      const startTime = performance.now();
      
      render(
        <TestWrapper store={storeWithManyPositions}>
          <VirtualPortfolioDisplay />
        </TestWrapper>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time
      expect(renderTime).toBeLessThan(1000);
      expect(screen.getByText('Virtual Positions (100)')).toBeInTheDocument();
    });
  });
});