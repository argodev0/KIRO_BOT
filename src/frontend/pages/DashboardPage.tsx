import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import ResponsiveDashboard from '../components/dashboard/ResponsiveDashboard';
import { updatePortfolio, addSignal, addOrder, addPosition } from '../store/slices/tradingSlice';
import { updateTicker } from '../store/slices/marketDataSlice';
import { setConnectionStatus } from '../store/slices/marketDataSlice';

const DashboardPage: React.FC = () => {
  const dispatch = useDispatch();

  // Mock data updates for demonstration
  useEffect(() => {
    // Simulate connection status
    dispatch(setConnectionStatus(true));

    // Mock portfolio data
    dispatch(updatePortfolio({
      totalBalance: 50000,
      availableBalance: 35000,
      totalUnrealizedPnl: 2450.75,
      totalRealizedPnl: 1250.30,
      maxDrawdown: -5.2,
      currentDrawdown: -1.8,
    }));

    // Mock ticker data
    const mockTickers = [
      { symbol: 'BTCUSDT', price: 43250.50, change24h: 1250.30, changePercent24h: 2.98, volume24h: 28500000, high24h: 43800, low24h: 41200, timestamp: Date.now() },
      { symbol: 'ETHUSDT', price: 2650.75, change24h: -85.25, changePercent24h: -3.12, volume24h: 15200000, high24h: 2750, low24h: 2580, timestamp: Date.now() },
      { symbol: 'BNBUSDT', price: 315.80, change24h: 12.45, changePercent24h: 4.10, volume24h: 8500000, high24h: 320, low24h: 305, timestamp: Date.now() },
      { symbol: 'ADAUSDT', price: 0.4825, change24h: 0.0125, changePercent24h: 2.66, volume24h: 125000000, high24h: 0.495, low24h: 0.465, timestamp: Date.now() },
      { symbol: 'SOLUSDT', price: 98.45, change24h: -3.25, changePercent24h: -3.20, volume24h: 45000000, high24h: 102.5, low24h: 96.8, timestamp: Date.now() },
    ];

    mockTickers.forEach(ticker => {
      dispatch(updateTicker(ticker));
    });

    // Mock some orders
    const mockOrders = [
      {
        id: 'order_001',
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'limit' as const,
        quantity: 0.1,
        price: 43000,
        status: 'filled' as const,
        timestamp: Date.now() - 300000,
      },
      {
        id: 'order_002',
        symbol: 'ETHUSDT',
        side: 'sell' as const,
        type: 'market' as const,
        quantity: 1.5,
        status: 'filled' as const,
        timestamp: Date.now() - 600000,
      },
      {
        id: 'order_003',
        symbol: 'BNBUSDT',
        side: 'buy' as const,
        type: 'limit' as const,
        quantity: 10,
        price: 310,
        status: 'pending' as const,
        timestamp: Date.now() - 120000,
      },
    ];

    mockOrders.forEach(order => {
      dispatch(addOrder(order));
    });

    // Mock some positions
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

    mockPositions.forEach(position => {
      dispatch(addPosition(position));
    });

    // Mock some signals
    const mockSignals = [
      {
        id: 'signal_001',
        symbol: 'BTCUSDT',
        direction: 'long' as const,
        confidence: 85,
        entryPrice: 43200,
        stopLoss: 42000,
        takeProfit: [44000, 45000, 46000],
        reasoning: {
          technical: 'RSI oversold, Wave Trend bullish crossover',
          patterns: 'Hammer candlestick pattern confirmed',
          elliottWave: 'Wave 3 impulse beginning',
          fibonacci: '61.8% retracement support holding',
        },
        status: 'active' as const,
        timestamp: Date.now() - 180000,
      },
      {
        id: 'signal_002',
        symbol: 'ETHUSDT',
        direction: 'short' as const,
        confidence: 72,
        entryPrice: 2680,
        stopLoss: 2750,
        takeProfit: [2600, 2550],
        reasoning: {
          technical: 'RSI overbought, bearish divergence',
          patterns: 'Evening star pattern forming',
          elliottWave: 'Wave A correction starting',
          fibonacci: 'Rejection at 78.6% retracement',
        },
        status: 'filled' as const,
        timestamp: Date.now() - 420000,
      },
    ];

    mockSignals.forEach(signal => {
      dispatch(addSignal(signal));
    });

  }, [dispatch]);

  return <ResponsiveDashboard />;
};

export default DashboardPage;