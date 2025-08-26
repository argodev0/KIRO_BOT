/**
 * Trade Simulation Engine Tests
 */

import { TradeSimulationEngine, SimulatedOrderResponse } from '../services/TradeSimulationEngine';
import { OrderRequest } from '../types/trading';

// Mock dependencies
jest.mock('../services/AuditService');
jest.mock('../services/ProductionLoggingService');
jest.mock('../utils/logger');

describe('TradeSimulationEngine', () => {
  let engine: TradeSimulationEngine;
  let sampleOrderRequest: OrderRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = TradeSimulationEngine.getInstance({
      enableSlippage: true,
      enableFees: true,
      enableExecutionDelay: false,
      baseSlippagePercent: 0.05,
      baseFeePercent: 0.1
    });

    sampleOrderRequest = {
      symbol: 'BTCUSDT',
      side: 'buy',
      type: 'market',
      quantity: 0.1,
      price: 50000,
      exchange: 'binance',
      clientOrderId: 'test-order-123'
    };
  });

  it('should simulate market order execution successfully', async () => {
    const result = await engine.simulateOrderExecution(sampleOrderRequest);

    expect(result).toBeDefined();
    expect(result.isPaperTrade).toBe(true);
    expect(result.orderId).toMatch(/^sim_\d+_[a-z0-9]+$/);
    expect(result.symbol).toBe(sampleOrderRequest.symbol);
    expect(result.side).toBe(sampleOrderRequest.side);
    expect(result.type).toBe(sampleOrderRequest.type);
    expect(result.quantity).toBe(sampleOrderRequest.quantity);
    expect(result.exchange).toBe(sampleOrderRequest.exchange);
    expect(result.clientOrderId).toBe(sampleOrderRequest.clientOrderId);
    expect(result.status).toBe('filled');
    expect(result.price).toBeGreaterThan(0);
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('should apply realistic slippage to orders', async () => {
    const result = await engine.simulateOrderExecution(sampleOrderRequest);

    expect(result.simulationDetails.slippage).toBeGreaterThanOrEqual(0);
    expect(result.simulationDetails.slippagePercent).toBeGreaterThanOrEqual(0);
    expect(result.simulationDetails.slippagePercent).toBeLessThan(2.0);
    
    if (sampleOrderRequest.price && sampleOrderRequest.side === 'buy') {
      expect(result.price).toBeGreaterThanOrEqual(sampleOrderRequest.price);
    }
  });

  it('should calculate realistic trading fees', async () => {
    const result = await engine.simulateOrderExecution(sampleOrderRequest);

    expect(result.simulationDetails.fee).toBeGreaterThan(0);
    expect(result.simulationDetails.feePercent).toBe(0.1);
    
    const expectedFee = result.quantity * (result.price || 0) * (0.1 / 100);
    expect(result.simulationDetails.fee).toBeCloseTo(expectedFee, 2);
  });

  it('should handle limit orders differently from market orders', async () => {
    const limitOrderRequest: OrderRequest = {
      ...sampleOrderRequest,
      type: 'limit',
      price: 49000
    };

    const result = await engine.simulateOrderExecution(limitOrderRequest);

    expect(result.type).toBe('limit');
    expect(['filled', 'new']).toContain(result.status);
  });

  it('should generate unique order IDs', async () => {
    const results = await Promise.all([
      engine.simulateOrderExecution(sampleOrderRequest),
      engine.simulateOrderExecution(sampleOrderRequest),
      engine.simulateOrderExecution(sampleOrderRequest)
    ]);

    const orderIds = results.map(r => r.orderId);
    const uniqueIds = new Set(orderIds);
    expect(uniqueIds.size).toBe(3);
  });

  describe('Market Conditions Simulation', () => {
    it('should generate realistic market conditions for different symbols', () => {
      engine.updateMarketConditions('BTCUSDT', {
        volatility: 0.6,
        liquidity: 0.8,
        spread: 0.02,
        volume: 0.9
      });

      const conditions = (engine as any).getMarketConditions('BTCUSDT');

      expect(conditions).toMatchObject({
        volatility: 0.6,
        liquidity: 0.8,
        spread: 0.02,
        volume: 0.9
      });
    });

    it('should emit market conditions update event', (done) => {
      engine.on('marketConditionsUpdated', (data) => {
        expect(data.symbol).toBe('ETHUSDT');
        expect(data.conditions.volatility).toBe(0.7);
        done();
      });

      engine.updateMarketConditions('ETHUSDT', { volatility: 0.7 });
    });
  });

  describe('Order Management', () => {
    it('should store and retrieve simulated orders', async () => {
      const orderRequest: OrderRequest = {
        symbol: 'ADAUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 1000,
        price: 0.5,
        exchange: 'binance'
      };

      const result = await engine.simulateOrderExecution(orderRequest);
      const retrievedOrder = engine.getSimulatedOrder(result.orderId);

      expect(retrievedOrder).toEqual(result);
    });

    it('should cancel simulated orders', async () => {
      const orderRequest: OrderRequest = {
        symbol: 'DOTUSDT',
        side: 'sell',
        type: 'limit',
        quantity: 100,
        price: 30.0,
        exchange: 'kucoin'
      };

      const result = await engine.simulateOrderExecution(orderRequest);
      
      if (result.status !== 'filled') {
        const cancelled = engine.cancelSimulatedOrder(result.orderId);
        expect(cancelled).toBe(true);

        const updatedOrder = engine.getSimulatedOrder(result.orderId);
        expect(updatedOrder?.status).toBe('cancelled');
      }
    });

    it('should not cancel filled orders', async () => {
      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        exchange: 'binance'
      };

      const result = await engine.simulateOrderExecution(orderRequest);
      
      expect(result.status).toBe('filled');
      
      const cancelled = engine.cancelSimulatedOrder(result.orderId);
      expect(cancelled).toBe(false);
    });
  });

  describe('Simulation Statistics', () => {
    it('should calculate accurate simulation statistics', async () => {
      const orderRequests: OrderRequest[] = [
        { symbol: 'BTCUSDT', side: 'buy', type: 'market', quantity: 0.1, exchange: 'binance' },
        { symbol: 'ETHUSDT', side: 'sell', type: 'limit', quantity: 1.0, price: 3000, exchange: 'kucoin' },
        { symbol: 'ADAUSDT', side: 'buy', type: 'market', quantity: 100, exchange: 'binance' }
      ];

      for (const request of orderRequests) {
        await engine.simulateOrderExecution(request);
      }

      const stats = engine.getSimulationStats();

      expect(stats.totalOrders).toBeGreaterThanOrEqual(3);
      expect(stats.filledOrders).toBeGreaterThan(0);
      expect(stats.averageSlippage).toBeGreaterThanOrEqual(0);
      expect(stats.averageFee).toBeGreaterThan(0);
      expect(stats.averageExecutionDelay).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Configuration Management', () => {
    it('should update simulation configuration', () => {
      const newConfig = {
        baseSlippagePercent: 0.1,
        baseFeePercent: 0.2,
        enableSlippage: false
      };

      engine.updateConfig(newConfig);
      const currentConfig = engine.getConfig();

      expect(currentConfig.baseSlippagePercent).toBe(0.1);
      expect(currentConfig.baseFeePercent).toBe(0.2);
      expect(currentConfig.enableSlippage).toBe(false);
    });

    it('should validate paper trading mode', () => {
      expect(() => engine.validatePaperTradingMode()).not.toThrow();
      expect(engine.validatePaperTradingMode()).toBe(true);
    });
  });

  describe('Event Emission', () => {
    it('should emit orderSimulated event', (done) => {
      engine.on('orderSimulated', (order: SimulatedOrderResponse) => {
        expect(order.isPaperTrade).toBe(true);
        expect(order.symbol).toBe('BTCUSDT');
        done();
      });

      engine.simulateOrderExecution({
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        exchange: 'binance'
      });
    });

    it('should emit orderFilled event for filled orders', (done) => {
      engine.on('orderFilled', (order: SimulatedOrderResponse) => {
        expect(order.status).toBe('filled');
        expect(order.isPaperTrade).toBe(true);
        done();
      });

      engine.simulateOrderExecution({
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        exchange: 'binance'
      });
    });
  });

  describe('Cleanup Operations', () => {
    it('should cleanup old orders when limit exceeded', async () => {
      const promises = [];
      for (let i = 0; i < 1005; i++) {
        promises.push(engine.simulateOrderExecution({
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 0.001,
          exchange: 'binance'
        }));
      }

      await Promise.all(promises);

      engine.cleanupOldOrders();
      const remainingOrders = engine.getAllSimulatedOrders();
      
      expect(remainingOrders.length).toBeLessThanOrEqual(1000);
    });
  });
});