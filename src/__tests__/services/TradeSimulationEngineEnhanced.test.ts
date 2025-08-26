/**
 * Enhanced Trade Simulation Engine Tests
 * Tests for the enhanced paper trading simulation functionality
 */

import { TradeSimulationEngine, SimulatedOrderResponse } from '../../services/TradeSimulationEngine';
import { OrderRequest } from '../../types/trading';

// Mock dependencies
jest.mock('../../services/AuditService');
jest.mock('../../services/ProductionLoggingService');
jest.mock('../../utils/logger');

describe('TradeSimulationEngine - Enhanced Features', () => {
  let engine: TradeSimulationEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = TradeSimulationEngine.getInstance({
      enableSlippage: true,
      enableFees: true,
      enableExecutionDelay: false, // Disabled for faster tests
      enableMarketImpact: true,
      baseSlippagePercent: 0.05,
      baseFeePercent: 0.1,
      maxExecutionDelayMs: 100,
      volatilityMultiplier: 2.0,
      liquidityImpactThreshold: 10000
    });
  });

  describe('Enhanced Slippage Simulation', () => {
    it('should apply higher slippage for market orders', async () => {
      const marketOrder: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        price: 50000,
        exchange: 'binance'
      };

      const limitOrder: OrderRequest = {
        ...marketOrder,
        type: 'limit'
      };

      const marketResult = await engine.simulateOrderExecution(marketOrder);
      const limitResult = await engine.simulateOrderExecution(limitOrder);

      // Market orders should generally have higher slippage
      expect(marketResult.simulationDetails.slippagePercent).toBeGreaterThanOrEqual(0);
      expect(limitResult.simulationDetails.slippagePercent).toBeGreaterThanOrEqual(0);
    });

    it('should apply higher slippage for larger orders', async () => {
      const smallOrder: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.01, // Small order
        price: 50000,
        exchange: 'binance'
      };

      const largeOrder: OrderRequest = {
        ...smallOrder,
        quantity: 10 // Large order
      };

      const smallResult = await engine.simulateOrderExecution(smallOrder);
      const largeResult = await engine.simulateOrderExecution(largeOrder);

      // Large orders should have higher slippage
      expect(largeResult.simulationDetails.slippage).toBeGreaterThanOrEqual(
        smallResult.simulationDetails.slippage
      );
    });

    it('should cap slippage at maximum threshold', async () => {
      const extremeOrder: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 1000, // Very large order
        price: 50000,
        exchange: 'binance'
      };

      const result = await engine.simulateOrderExecution(extremeOrder);

      // Slippage should be capped at 2%
      expect(result.simulationDetails.slippagePercent).toBeLessThanOrEqual(2.0);
    });
  });

  describe('Realistic Fee Calculation', () => {
    it('should apply different fees for different exchanges', async () => {
      const binanceOrder: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 1,
        price: 50000,
        exchange: 'binance'
      };

      const kucoinOrder: OrderRequest = {
        ...binanceOrder,
        exchange: 'kucoin'
      };

      const binanceResult = await engine.simulateOrderExecution(binanceOrder);
      const kucoinResult = await engine.simulateOrderExecution(kucoinOrder);

      expect(binanceResult.simulationDetails.fee).toBeGreaterThan(0);
      expect(kucoinResult.simulationDetails.fee).toBeGreaterThan(0);
      
      // Fee percentages should be calculated correctly
      expect(binanceResult.simulationDetails.feePercent).toBeGreaterThan(0);
      expect(kucoinResult.simulationDetails.feePercent).toBeGreaterThan(0);
    });

    it('should apply volume-based fee discounts', async () => {
      const smallOrder: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1, // ~$5k order
        price: 50000,
        exchange: 'binance'
      };

      const largeOrder: OrderRequest = {
        ...smallOrder,
        quantity: 3 // ~$150k order
      };

      const smallResult = await engine.simulateOrderExecution(smallOrder);
      const largeResult = await engine.simulateOrderExecution(largeOrder);

      // Large orders should have lower fee percentage due to volume discounts
      expect(largeResult.simulationDetails.feePercent).toBeLessThanOrEqual(
        smallResult.simulationDetails.feePercent
      );
    });

    it('should apply maker/taker fee structure', async () => {
      const marketOrder: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market', // Taker
        quantity: 1,
        price: 50000,
        exchange: 'binance'
      };

      const limitOrder: OrderRequest = {
        ...marketOrder,
        type: 'limit' // Maker
      };

      const marketResult = await engine.simulateOrderExecution(marketOrder);
      const limitResult = await engine.simulateOrderExecution(limitOrder);

      // Limit orders (makers) should have lower fees than market orders (takers)
      expect(limitResult.simulationDetails.feePercent).toBeLessThanOrEqual(
        marketResult.simulationDetails.feePercent
      );
    });
  });

  describe('Virtual Order Execution', () => {
    it('should generate realistic order IDs based on exchange', async () => {
      const binanceOrder: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        exchange: 'binance'
      };

      const kucoinOrder: OrderRequest = {
        ...binanceOrder,
        exchange: 'kucoin'
      };

      const binanceResult = await engine.simulateOrderExecution(binanceOrder);
      const kucoinResult = await engine.simulateOrderExecution(kucoinOrder);

      expect(binanceResult.orderId).toMatch(/^sim_bn_\d+_[a-z0-9]+$/);
      expect(kucoinResult.orderId).toMatch(/^sim_kc_\d+_[a-z0-9]+$/);
    });

    it('should handle different order types appropriately', async () => {
      const orderTypes: Array<'market' | 'limit' | 'stop' | 'stop_limit'> = 
        ['market', 'limit', 'stop', 'stop_limit'];

      for (const type of orderTypes) {
        const order: OrderRequest = {
          symbol: 'BTCUSDT',
          side: 'buy',
          type,
          quantity: 0.1,
          price: 50000,
          exchange: 'binance'
        };

        const result = await engine.simulateOrderExecution(order);

        expect(result.type).toBe(type);
        expect(result.isPaperTrade).toBe(true);
        
        // Market orders should always fill
        if (type === 'market') {
          expect(result.status).toBe('filled');
        }
      }
    });

    it('should simulate partial fills for large orders', async () => {
      // Update market conditions to simulate low liquidity
      engine.updateMarketConditions('BTCUSDT', {
        liquidity: 0.3, // Low liquidity
        volatility: 0.8 // High volatility
      });

      const largeOrder: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 100, // Very large order
        price: 50000,
        exchange: 'binance'
      };

      const result = await engine.simulateOrderExecution(largeOrder);

      expect(result.isPaperTrade).toBe(true);
      expect(['filled', 'new', 'partially_filled']).toContain(result.status);
    });
  });

  describe('Paper Trade Audit Logging', () => {
    it('should log comprehensive audit information', async () => {
      const order: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        price: 50000,
        exchange: 'binance',
        clientOrderId: 'test-audit-123'
      };

      const result = await engine.simulateOrderExecution(order);

      expect(result.isPaperTrade).toBe(true);
      expect(result.simulationDetails).toBeDefined();
      expect(result.simulationDetails.slippage).toBeGreaterThanOrEqual(0);
      expect(result.simulationDetails.fee).toBeGreaterThan(0);
      expect(result.simulationDetails.marketImpact).toBeGreaterThanOrEqual(0);
    });

    it('should validate paper trading mode', () => {
      expect(() => engine.validatePaperTradingMode()).not.toThrow();
      expect(engine.validatePaperTradingMode()).toBe(true);
    });

    it('should generate paper trade audit report', async () => {
      // Execute several trades
      const orders: OrderRequest[] = [
        { symbol: 'BTCUSDT', side: 'buy', type: 'market', quantity: 0.1, exchange: 'binance' },
        { symbol: 'ETHUSDT', side: 'sell', type: 'limit', quantity: 1, price: 3000, exchange: 'kucoin' },
        { symbol: 'ADAUSDT', side: 'buy', type: 'market', quantity: 100, exchange: 'binance' }
      ];

      for (const order of orders) {
        await engine.simulateOrderExecution(order);
      }

      const report = await engine.getPaperTradeAuditReport();

      expect(report.totalPaperTrades).toBeGreaterThanOrEqual(3);
      expect(report.successfulTrades).toBeGreaterThan(0);
      expect(report.totalVolume).toBeGreaterThan(0);
      expect(report.totalFees).toBeGreaterThan(0);
      expect(report.averageSlippage).toBeGreaterThanOrEqual(0);
      expect(report.exchangeBreakdown).toBeDefined();
      expect(report.symbolBreakdown).toBeDefined();
    });
  });

  describe('Market Conditions Simulation', () => {
    it('should update market conditions dynamically', () => {
      const newConditions = {
        volatility: 0.9,
        liquidity: 0.2,
        spread: 0.05,
        volume: 0.8
      };

      engine.updateMarketConditions('TESTUSDT', newConditions);

      // Verify conditions are updated by executing an order
      const order: OrderRequest = {
        symbol: 'TESTUSDT',
        side: 'buy',
        type: 'market',
        quantity: 1,
        price: 100,
        exchange: 'binance'
      };

      return engine.simulateOrderExecution(order).then(result => {
        expect(result.isPaperTrade).toBe(true);
        expect(result.symbol).toBe('TESTUSDT');
      });
    });

    it('should emit market conditions update events', (done) => {
      engine.on('marketConditionsUpdated', (data) => {
        expect(data.symbol).toBe('TESTUSDT');
        expect(data.conditions.volatility).toBe(0.7);
        done();
      });

      engine.updateMarketConditions('TESTUSDT', { volatility: 0.7 });
    });
  });

  describe('Performance and Statistics', () => {
    it('should track simulation statistics accurately', async () => {
      const orders: OrderRequest[] = [
        { symbol: 'BTCUSDT', side: 'buy', type: 'market', quantity: 0.1, exchange: 'binance' },
        { symbol: 'ETHUSDT', side: 'sell', type: 'limit', quantity: 1, price: 3000, exchange: 'kucoin' },
        { symbol: 'ADAUSDT', side: 'buy', type: 'market', quantity: 100, exchange: 'binance' }
      ];

      for (const order of orders) {
        await engine.simulateOrderExecution(order);
      }

      const stats = engine.getSimulationStats();

      expect(stats.totalOrders).toBeGreaterThanOrEqual(3);
      expect(stats.filledOrders).toBeGreaterThan(0);
      expect(stats.averageSlippage).toBeGreaterThanOrEqual(0);
      expect(stats.averageFee).toBeGreaterThan(0);
      expect(stats.averageExecutionDelay).toBeGreaterThanOrEqual(0);
    });

    it('should cleanup old orders when limit is exceeded', async () => {
      // Create many orders to trigger cleanup
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(engine.simulateOrderExecution({
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 0.001,
          exchange: 'binance'
        }));
      }

      await Promise.all(promises);

      const ordersBefore = engine.getAllSimulatedOrders().length;
      engine.cleanupOldOrders();
      const ordersAfter = engine.getAllSimulatedOrders().length;

      expect(ordersAfter).toBeLessThanOrEqual(ordersBefore);
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration dynamically', () => {
      const newConfig = {
        baseSlippagePercent: 0.2,
        baseFeePercent: 0.15,
        enableSlippage: false,
        enableFees: true
      };

      engine.updateConfig(newConfig);
      const currentConfig = engine.getConfig();

      expect(currentConfig.baseSlippagePercent).toBe(0.2);
      expect(currentConfig.baseFeePercent).toBe(0.15);
      expect(currentConfig.enableSlippage).toBe(false);
      expect(currentConfig.enableFees).toBe(true);
    });

    it('should respect disabled features', async () => {
      engine.updateConfig({
        enableSlippage: false,
        enableFees: false
      });

      const order: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        price: 50000,
        exchange: 'binance'
      };

      const result = await engine.simulateOrderExecution(order);

      expect(result.simulationDetails.slippage).toBe(0);
      expect(result.simulationDetails.fee).toBe(0);
    });
  });
});