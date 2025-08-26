import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import VirtualPortfolioDisplay from '../../components/dashboard/VirtualPortfolioDisplay';
import tradingSlice from '../../store/slices/tradingSlice';

const mockStore = configureStore({
  reducer: {
    trading: tradingSlice,
  },
  preloadedState: {
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
        },
      ],
      orders: [],
      portfolio: {
        totalBalance: 10000,
        availableBalance: 8000,
        totalUnrealizedPnl: 200,
        totalRealizedPnl: 150,
        maxDrawdown: -5.2,
        currentDrawdown: -2.1,
      },
      paperTrading: {
        isEnabled: true,
        initialBalance: 10000,
        virtualBalance: 10000,
        totalPaperTrades: 5,
        paperTradingStartDate: Date.now(),
      },
      botStatus: 'stopped',
      isLoading: false,
      error: null,
    },
  },
});

describe('VirtualPortfolioDisplay', () => {
  it('renders virtual portfolio with paper trading indicators', () => {
    render(
      <Provider store={mockStore}>
        <VirtualPortfolioDisplay />
      </Provider>
    );

    expect(screen.getByText('Virtual Portfolio')).toBeInTheDocument();
    expect(screen.getByText('PAPER TRADING')).toBeInTheDocument();
    expect(screen.getByText('Simulated Trading Environment:')).toBeInTheDocument();
  });

  it('displays virtual balance with proper formatting', () => {
    render(
      <Provider store={mockStore}>
        <VirtualPortfolioDisplay />
      </Provider>
    );

    expect(screen.getByText('$10,000.00')).toBeInTheDocument();
    expect(screen.getByText('Virtual Total Balance')).toBeInTheDocument();
    expect(screen.getByText('(Simulated)')).toBeInTheDocument();
  });

  it('shows virtual positions with paper trading labels', () => {
    render(
      <Provider store={mockStore}>
        <VirtualPortfolioDisplay />
      </Provider>
    );

    expect(screen.getByText('Virtual Positions (1)')).toBeInTheDocument();
    expect(screen.getByText('BTCUSDT')).toBeInTheDocument();
    expect(screen.getByText('LONG')).toBeInTheDocument();
    expect(screen.getByText('PAPER')).toBeInTheDocument();
  });

  it('displays P&L with virtual labels', () => {
    render(
      <Provider store={mockStore}>
        <VirtualPortfolioDisplay />
      </Provider>
    );

    expect(screen.getByText('Simulated Unrealized P&L')).toBeInTheDocument();
    expect(screen.getByText('Simulated Realized P&L (Today)')).toBeInTheDocument();
    expect(screen.getAllByText('VIRTUAL')).toHaveLength(2);
  });

  it('shows paper trading disclaimer', () => {
    render(
      <Provider store={mockStore}>
        <VirtualPortfolioDisplay />
      </Provider>
    );

    expect(
      screen.getByText('All positions and balances are simulated for educational purposes only')
    ).toBeInTheDocument();
  });

  it('handles empty positions state', () => {
    const emptyStore = configureStore({
      reducer: {
        trading: tradingSlice,
      },
      preloadedState: {
        trading: {
          ...mockStore.getState().trading,
          positions: [],
        },
      },
    });

    render(
      <Provider store={emptyStore}>
        <VirtualPortfolioDisplay />
      </Provider>
    );

    expect(screen.getByText('No virtual positions active')).toBeInTheDocument();
  });
});