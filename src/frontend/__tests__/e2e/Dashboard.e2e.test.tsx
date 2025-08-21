import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import '@testing-library/jest-dom';

import DashboardPage from '../../pages/DashboardPage';
import marketDataReducer from '../../store/slices/marketDataSlice';
import tradingReducer from '../../store/slices/tradingSlice';
import authReducer from '../../store/slices/authSlice';
import uiReducer from '../../store/slices/uiSlice';

// Mock TradingView
const mockTradingView = {
  widget: jest.fn().mockImplementation(() => ({
    remove: jest.fn(),
  })),
};

const mockDatafeeds = {
  UDFCompatibleDatafeed: jest.fn(),
};

Object.defineProperty(window, 'TradingView', {
  value: mockTradingView,
  writable: true,
});

Object.defineProperty(window, 'Datafeeds', {
  value: mockDatafeeds,
  writable: true,
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Create test store
const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      marketData: marketDataReducer,
      trading: tradingReducer,
      auth: authReducer,
      ui: uiReducer,
    },
    preloadedState: initialState,
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

describe('Dashboard E2E Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock document.createElement for TradingView script
    const originalCreateElement = document.createElement;
    document.createElement = jest.fn().mockImplementation((tagName) => {
      if (tagName === 'script') {
        const script = originalCreateElement.call(document, tagName);
        // Simulate script loading
        setTimeout(() => {
          if (script.onload) script.onload({} as Event);
        }, 100);
        return script;
      }
      return originalCreateElement.call(document, tagName);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Dashboard Layout and Components', () => {
    test('renders all main dashboard components', async () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // Wait for components to load
      await waitFor(() => {
        expect(screen.getByText('Portfolio Overview')).toBeInTheDocument();
        expect(screen.getByText('Market Data')).toBeInTheDocument();
        expect(screen.getByText('Trade History')).toBeInTheDocument();
        expect(screen.getByText('Alerts & Notifications')).toBeInTheDocument();
      });
    });

    test('displays portfolio information correctly', async () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Total Balance')).toBeInTheDocument();
        expect(screen.getByText('Available Balance')).toBeInTheDocument();
        expect(screen.getByText('Unrealized P&L')).toBeInTheDocument();
        expect(screen.getByText('$50,000.00')).toBeInTheDocument(); // Total balance
        expect(screen.getByText('$35,000.00')).toBeInTheDocument(); // Available balance
      });
    });

    test('shows market data for multiple symbols', async () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('BTC/USDT')).toBeInTheDocument();
        expect(screen.getByText('ETH/USDT')).toBeInTheDocument();
        expect(screen.getByText('BNB/USDT')).toBeInTheDocument();
        expect(screen.getByText('ADA/USDT')).toBeInTheDocument();
        expect(screen.getByText('SOL/USDT')).toBeInTheDocument();
      });
    });
  });

  describe('Market Data Widget Interactions', () => {
    test('allows symbol selection', async () => {
      const store = createTestStore();
      
      render(
        <TestWrapper store={store}>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        const ethCard = screen.getByText('ETH/USDT').closest('.MuiCard-root');
        expect(ethCard).toBeInTheDocument();
        
        if (ethCard) {
          fireEvent.click(ethCard);
        }
      });

      // Check if the selection is reflected in the store
      const state = store.getState();
      expect(state.marketData.selectedSymbol).toBe('ETHUSDT');
    });

    test('displays price changes with correct colors', async () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        // BTC should show positive change (green)
        const btcChangeChip = screen.getByText('+2.98%');
        expect(btcChangeChip).toHaveClass('MuiChip-colorSuccess');

        // ETH should show negative change (red)
        const ethChangeChip = screen.getByText('-3.12%');
        expect(ethChangeChip).toHaveClass('MuiChip-colorError');
      });
    });
  });

  describe('Portfolio Overview Interactions', () => {
    test('displays active positions correctly', async () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Active Positions (2)')).toBeInTheDocument();
        expect(screen.getByText('BTCUSDT')).toBeInTheDocument();
        expect(screen.getByText('ETHUSDT')).toBeInTheDocument();
      });
    });

    test('shows position P&L with correct formatting', async () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        // Check for positive P&L (BTC position)
        expect(screen.getByText('$25.05')).toBeInTheDocument();
        
        // Check for negative P&L would be shown in red
        const pnlElements = screen.getAllByText(/\$\d+\.\d+/);
        expect(pnlElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Trade History Functionality', () => {
    test('displays trade history table', async () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Trade History')).toBeInTheDocument();
        expect(screen.getByText('Symbol')).toBeInTheDocument();
        expect(screen.getByText('Side')).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
      });
    });

    test('allows filtering trades by status', async () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        const statusFilter = screen.getByLabelText('Status');
        expect(statusFilter).toBeInTheDocument();
        
        fireEvent.mouseDown(statusFilter);
      });

      await waitFor(() => {
        expect(screen.getByText('Filled')).toBeInTheDocument();
        expect(screen.getByText('Pending')).toBeInTheDocument();
        expect(screen.getByText('Cancelled')).toBeInTheDocument();
      });
    });

    test('allows searching trades', async () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search by symbol or order ID...');
        expect(searchInput).toBeInTheDocument();
        
        fireEvent.change(searchInput, { target: { value: 'BTC' } });
      });

      // The search functionality should filter the results
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search by symbol or order ID...');
        expect(searchInput).toHaveValue('BTC');
      });
    });
  });

  describe('Alerts and Notifications', () => {
    test('displays notification count badge', async () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Alerts & Notifications')).toBeInTheDocument();
        // Should show unread notifications badge
        const badge = document.querySelector('.MuiBadge-badge');
        expect(badge).toBeInTheDocument();
      });
    });

    test('allows expanding and collapsing alerts', async () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        const expandButton = screen.getByRole('button', { name: /expand/i });
        expect(expandButton).toBeInTheDocument();
        
        fireEvent.click(expandButton);
      });

      // After clicking, the alerts should be collapsed
      await waitFor(() => {
        const collapseButton = screen.getByRole('button', { name: /expand/i });
        expect(collapseButton).toBeInTheDocument();
      });
    });

    test('allows marking alerts as read', async () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      let initialButtonCount = 0;
      await waitFor(() => {
        const markAsReadButtons = screen.getAllByTitle('Mark as read');
        initialButtonCount = markAsReadButtons.length;
        expect(markAsReadButtons.length).toBeGreaterThan(0);
        
        fireEvent.click(markAsReadButtons[0]);
      });

      // The alert should be marked as read (visual change)
      await waitFor(() => {
        // Check that the button is no longer there or changed
        const remainingButtons = screen.queryAllByTitle('Mark as read');
        expect(remainingButtons.length).toBeLessThan(initialButtonCount);
      });
    });
  });

  describe('Responsive Design', () => {
    test('adapts to mobile viewport', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      // Trigger resize event
      window.dispatchEvent(new Event('resize'));

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        // On mobile, should show app bar with menu button
        expect(screen.getByText('Trading Dashboard')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
      });
    });

    test('opens mobile drawer when menu button is clicked', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        const menuButton = screen.getByRole('button', { name: /menu/i });
        fireEvent.click(menuButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Dashboard Controls')).toBeInTheDocument();
      });
    });
  });

  describe('TradingView Chart Integration', () => {
    test('initializes TradingView widget', async () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockTradingView.widget).toHaveBeenCalled();
      });

      // Check that the widget was called with correct parameters
      const widgetCall = mockTradingView.widget.mock.calls[0][0];
      expect(widgetCall.symbol).toBe('BINANCE:BTCUSDT');
      expect(widgetCall.theme).toBe('dark');
    });

    test('supports fullscreen chart mode', async () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        const fullscreenButton = screen.getByRole('button', { name: /fullscreen/i });
        expect(fullscreenButton).toBeInTheDocument();
        
        fireEvent.click(fullscreenButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Trading Chart - Fullscreen')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /fullscreenexit/i })).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Data Updates', () => {
    test('updates market data in real-time', async () => {
      const store = createTestStore();
      
      render(
        <TestWrapper store={store}>
          <DashboardPage />
        </TestWrapper>
      );

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('$43,250.50')).toBeInTheDocument();
      });

      // Simulate real-time price update
      store.dispatch({
        type: 'marketData/updateTicker',
        payload: {
          symbol: 'BTCUSDT',
          price: 43500.00,
          change24h: 1500.00,
          changePercent24h: 3.57,
          volume24h: 29000000,
          high24h: 43800,
          low24h: 41200,
          timestamp: Date.now(),
        },
      });

      await waitFor(() => {
        expect(screen.getByText('$43,500.00')).toBeInTheDocument();
        expect(screen.getByText('+3.57%')).toBeInTheDocument();
      });
    });

    test('updates portfolio values in real-time', async () => {
      const store = createTestStore();
      
      render(
        <TestWrapper store={store}>
          <DashboardPage />
        </TestWrapper>
      );

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('$50,000.00')).toBeInTheDocument();
      });

      // Simulate portfolio update
      store.dispatch({
        type: 'trading/updatePortfolio',
        payload: {
          totalBalance: 52000,
          totalUnrealizedPnl: 3200.50,
        },
      });

      await waitFor(() => {
        expect(screen.getByText('$52,000.00')).toBeInTheDocument();
        expect(screen.getByText('$3,200.50')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('handles TradingView loading errors gracefully', async () => {
      // Mock TradingView to throw error
      mockTradingView.widget.mockImplementationOnce(() => {
        throw new Error('TradingView failed to load');
      });

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // Should not crash the application
      await waitFor(() => {
        expect(screen.getByText('Portfolio Overview')).toBeInTheDocument();
      });
    });

    test('displays loading states appropriately', async () => {
      const store = createTestStore({
        trading: {
          isLoading: true,
          signals: [],
          positions: [],
          orders: [],
          portfolio: {
            totalBalance: 0,
            availableBalance: 0,
            totalUnrealizedPnl: 0,
            totalRealizedPnl: 0,
            maxDrawdown: 0,
            currentDrawdown: 0,
          },
          botStatus: 'stopped',
          error: null,
        },
      });

      render(
        <TestWrapper store={store}>
          <DashboardPage />
        </TestWrapper>
      );

      // Should show loading indicators where appropriate
      await waitFor(() => {
        const loadingElements = screen.getAllByText(/loading/i);
        expect(loadingElements.length).toBeGreaterThan(0);
      });
    });
  });
});