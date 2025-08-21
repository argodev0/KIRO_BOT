import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import '@testing-library/jest-dom';

import DashboardPage from '../../../pages/DashboardPage';
import marketDataReducer from '../../../store/slices/marketDataSlice';
import tradingReducer from '../../../store/slices/tradingSlice';
import authReducer from '../../../store/slices/authSlice';
import uiReducer from '../../../store/slices/uiSlice';

// Mock TradingView
Object.defineProperty(window, 'TradingView', {
  value: {
    widget: jest.fn().mockImplementation(() => ({
      remove: jest.fn(),
    })),
  },
  writable: true,
});

Object.defineProperty(window, 'Datafeeds', {
  value: {
    UDFCompatibleDatafeed: jest.fn(),
  },
  writable: true,
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

const createTestStore = () => {
  return configureStore({
    reducer: {
      marketData: marketDataReducer,
      trading: tradingReducer,
      auth: authReducer,
      ui: uiReducer,
    },
  });
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Provider store={createTestStore()}>
    {children}
  </Provider>
);

describe('Dashboard Simple Tests', () => {
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

  test('renders dashboard without crashing', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>
    );

    // Should render without throwing errors
    expect(document.body).toBeInTheDocument();
  });

  test('displays portfolio overview section', async () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>
    );

    // Wait for the component to render
    await screen.findByText('Portfolio Overview');
    expect(screen.getByText('Portfolio Overview')).toBeInTheDocument();
  });

  test('displays market data section', async () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>
    );

    await screen.findByText('Market Data');
    expect(screen.getByText('Market Data')).toBeInTheDocument();
  });

  test('displays trade history section', async () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>
    );

    await screen.findByText('Trade History');
    expect(screen.getByText('Trade History')).toBeInTheDocument();
  });

  test('displays alerts section', async () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>
    );

    await screen.findByText('Alerts & Notifications');
    expect(screen.getByText('Alerts & Notifications')).toBeInTheDocument();
  });
});