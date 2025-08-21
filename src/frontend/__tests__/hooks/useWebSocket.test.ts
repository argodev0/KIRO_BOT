import { renderHook } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useWebSocket } from '../../hooks/useWebSocket';
import authReducer from '../../store/slices/authSlice';
import marketDataReducer from '../../store/slices/marketDataSlice';
import tradingReducer from '../../store/slices/tradingSlice';
import uiReducer from '../../store/slices/uiSlice';

// Mock socket.io-client
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));

const createMockStore = () => {
  return configureStore({
    reducer: {
      auth: authReducer,
      marketData: marketDataReducer,
      trading: tradingReducer,
      ui: uiReducer,
    },
  });
};

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const store = createMockStore();
  return React.createElement(Provider, { store, children });
};

describe('useWebSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('token', 'test-token');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should not connect when not authenticated', () => {
    const { io } = require('socket.io-client');
    
    renderHook(() => useWebSocket(false), { wrapper });
    
    expect(io).not.toHaveBeenCalled();
  });

  it('should connect when authenticated', () => {
    const { io } = require('socket.io-client');
    
    renderHook(() => useWebSocket(true), { wrapper });
    
    expect(io).toHaveBeenCalledWith('http://localhost:3000', {
      auth: {
        token: 'test-token',
      },
      transports: ['websocket'],
    });
  });

  it('should set up event listeners', () => {
    renderHook(() => useWebSocket(true), { wrapper });
    
    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('ticker', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('orderbook', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('signal', expect.any(Function));
  });

  it('should provide subscribe and unsubscribe functions', () => {
    const { result } = renderHook(() => useWebSocket(true), { wrapper });
    
    expect(typeof result.current.subscribeToSymbol).toBe('function');
    expect(typeof result.current.unsubscribeFromSymbol).toBe('function');
  });

  it('should emit subscribe event when subscribeToSymbol is called', () => {
    const { result } = renderHook(() => useWebSocket(true), { wrapper });
    
    result.current.subscribeToSymbol('BTCUSDT');
    
    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe', { symbol: 'BTCUSDT' });
  });

  it('should emit unsubscribe event when unsubscribeFromSymbol is called', () => {
    const { result } = renderHook(() => useWebSocket(true), { wrapper });
    
    result.current.unsubscribeFromSymbol('BTCUSDT');
    
    expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe', { symbol: 'BTCUSDT' });
  });

  it('should disconnect when authentication changes to false', () => {
    const { rerender } = renderHook(
      ({ isAuthenticated }) => useWebSocket(isAuthenticated),
      {
        wrapper,
        initialProps: { isAuthenticated: true },
      }
    );
    
    // Change to not authenticated
    rerender({ isAuthenticated: false });
    
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });
});