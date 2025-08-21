/**
 * Trading Execution Integration Tests
 * End-to-end tests for complete trading workflows
 */

import { TradingExecutionService, ExecutionConfig } from '../../services/TradingExecutionService';
import { ExchangeManager, ExchangeManagerConfig } from '../../services/exchanges/ExchangeManager';
import { TradingSignal, OrderRequest } from '../../types/trading';

describe('Trading Execution Integration', () => {
  let executionService: TradingExecutionService;
  let exchangeManager: ExchangeManager;

  beforeAll(async () => {
    // Create exchange manager with mock configuration
    const exchangeConfig: ExchangeManagerConfig = {
      exchanges: {
        binance: {
          enabled: true,
          apiKey: 'test_key',
          apiSecret: 'test_secret',
          testnet: true
        }
      },
      defaultExchange: 'binance'
    };

    exchangeManager = new ExchangeManager(exchangeConfig);

    // Mock the exchange manager methods for integration testing
    jest.spyOn(exchangeManager, 'placeOrder').mockImplementation(async (order) => {
      // Simulate realistic order placement
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        orderId: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...(order.clientOrderId && { clientOrderId: order.clientOrderId }),
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        quantity: order.quantity,
        price: order.price || 0,
        status: order.type === 'market' ? 'filled' : 'new',
        timestamp: Date.now(),
        exchange: order.exchange
      };
    });

    jest.spyOn(exchangeManager, 'cancelOrder').mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return true;
    });

    jest.spyOn(exchangeManager, 'getOrder').mockImplementation(async (orderId) => {
      await new Promise(resolve => setTimeout(resolve, 50));
      
      return {
        orderId,
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 50000,
        status: Math.random() > 0.5 ? 'filled' : 'partially_filled',
        timestamp: Date.now(),
        exchange: 'binance'
      };
    });

    jest.spyOn(exchangeManager, 'getTicker').mockImplementation(async (symbol) => {
      await new Promise(resolve => setTimeout(resolve, 30));
      
      return {
        symbol,
        exchange: 'binance',
        price: 50000 + (Math.random() - 0.5) * 1000,
        volume: 1000,
        timestamp: Date.now(),
        bid: 49950,
        ask: 50050
      };
    });

    jest.spyOn(exchangeManager, 'getAvailableExchanges').mockReturnValue(['binance']);

    const executionConfig: ExecutionConfig = {
      slippageProtection: {
        enabled: true,
        maxSlippagePercent: 2.0,
        priceCheckInterval: 5000,
        cancelOnExcessiveSlippage: true
      },
      orderOptimization: {
        enabled: true,
        iceberg: {
          enabled: true,
          chunkSize: 1000,
          minChunkSize: 100
        },
        twap: {
          enabled: false,
          duration: 300000,
          intervals: 5
        }
      },
      maxRetries: 3,
      retryDelay: 100, // Reduced for testing
      orderTimeout: 30000, // Reduced for testing
      enableAuditLog: true
    };

    executionService = new TradingExecutionService(exchangeManager, executionConfig);
  });

  afterAll(async () => {
    await executionService.shutdown();
  });

  describe('Complete Trading Workflows', () => {
    it('should execute a complete signal-to-trade workflow', async () => {
      const signal: TradingSignal = {
        id: 'integration_signal_1',
        symbol: 'BTCUSDT',
        direction: 'long',
        confidence: 0.85,
        entryPrice: 50000,
        stopLoss: 48000,
        takeProfit: [52000, 54000],
        reasoning: {
          technical: {
            indicators: ['RSI_oversold', 'MACD_bullish_cross'],
            confluence: 0.8,
            trend: 'bullish'
          },
          patterns: {
            detected: ['hammer', 'bullish_engulfing'],
            strength: 0.75
          },
          elliottWave: {
            currentWave: 'wave3',
            wavePosition: 'impulse_up',
            validity: 0.9
          },
          fibonacci: {
            levels: [0.618, 0.786],
            confluence: 0.7
          },
          volume: {
            profile: 'increasing',
            strength: 0.8
          },
          summary: 'Strong bullish signal with multiple confirmations'
        },
        timestamp: Date.now()
      };

      // Execute the signal
      const executionResult = await executionService.executeSignal(signal, 0.1);

      expect(executionResult.success).toBe(true);
      expect(executionResult.executedQuantity).toBe(0.1);
      expect(executionResult.orderId).toBeDefined();

      // Verify audit log contains signal execution events
      const auditLog = executionService.getAuditLog();
      expect(auditLog.some(entry => entry.action === 'signal_execution_start')).toBe(true);
      expect(auditLog.some(entry => entry.action === 'signal_execution_complete')).toBe(true);
    });

    it('should handle multiple concurrent order executions', async () => {
      const orders: OrderRequest[] = [
        {
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 0.05,
          exchange: 'binance',
          clientOrderId: 'concurrent_1'
        },
        {
          symbol: 'ETHUSDT',
          side: 'sell',
          type: 'market',
          quantity: 1.0,
          exchange: 'binance',
          clientOrderId: 'concurrent_2'
        },
        {
          symbol: 'ADAUSDT',
          side: 'buy',
          type: 'limit',
          quantity: 100,
          price: 0.5,
          exchange: 'binance',
          clientOrderId: 'concurrent_3'
        }
      ];

      // Execute all orders concurrently
      const results = await Promise.all(
        orders.map(order => executionService.placeOrder(order))
      );

      // All orders should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.orderId).toBeDefined();
      });

      // Verify all orders are tracked
      const activeOrders = executionService.getActiveOrders();
      expect(activeOrders.length).toBeGreaterThanOrEqual(1); // At least limit orders should be active
    });

    it('should handle order lifecycle from placement to completion', async () => {
      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.2,
        price: 49500,
        exchange: 'binance',
        clientOrderId: 'lifecycle_test'
      };

      // Place order
      const placementResult = await executionService.placeOrder(orderRequest);
      expect(placementResult.success).toBe(true);
      
      const orderId = placementResult.orderId!;

      // Check initial status
      let orderStatus = await executionService.getOrderStatus(orderId);
      expect(orderStatus).toBeTruthy();
      expect(orderStatus!.status).toBe('new');

      // Simulate order getting filled over time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      orderStatus = await executionService.getOrderStatus(orderId);
      expect(orderStatus).toBeTruthy();

      // Verify order is being tracked
      const activeOrders = executionService.getActiveOrders();
      const trackedOrder = activeOrders.find(order => order.orderId === orderId);
      expect(trackedOrder).toBeDefined();
      expect(trackedOrder!.originalOrder.symbol).toBe('BTCUSDT');
    });

    it('should handle order modification workflow', async () => {
      const originalOrder: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 49000,
        exchange: 'binance',
        clientOrderId: 'modify_test'
      };

      // Place original order
      const placementResult = await executionService.placeOrder(originalOrder);
      expect(placementResult.success).toBe(true);
      
      const originalOrderId = placementResult.orderId!;

      // Modify the order
      const modificationResult = await executionService.modifyOrder(originalOrderId, {
        quantity: 0.15,
        price: 48500
      });

      expect(modificationResult.success).toBe(true);
      expect(modificationResult.orderId).toBeDefined();
      expect(modificationResult.orderId).not.toBe(originalOrderId);

      // Verify audit log contains modification events
      const auditLog = executionService.getAuditLog();
      expect(auditLog.some(entry => entry.action === 'order_modify_request')).toBe(true);
      expect(auditLog.some(entry => entry.action === 'order_modified')).toBe(true);
    });

    it('should handle large order optimization with iceberg strategy', async () => {
      const largeOrder: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 2500, // Larger than iceberg chunk size
        exchange: 'binance',
        clientOrderId: 'iceberg_test'
      };

      const executionResult = await executionService.placeOrder(largeOrder);

      expect(executionResult.success).toBe(true);
      expect(executionResult.executedQuantity).toBe(2500);

      // Verify multiple orders were placed (iceberg chunks)
      expect(exchangeManager.placeOrder).toHaveBeenCalledTimes(3); // 1000 + 1000 + 500
    });

    it('should handle error recovery and retry logic', async () => {
      // Mock temporary failures followed by success
      const mockPlaceOrder = jest.spyOn(exchangeManager, 'placeOrder');
      mockPlaceOrder
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValueOnce({
          orderId: 'retry_success_order',
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 0.1,
          status: 'filled',
          timestamp: Date.now(),
          exchange: 'binance'
        });

      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        exchange: 'binance',
        clientOrderId: 'retry_test'
      };

      const result = await executionService.placeOrder(orderRequest);

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('retry_success_order');
      expect(mockPlaceOrder).toHaveBeenCalledTimes(3); // 2 failures + 1 success

      // Verify retry events in audit log
      const auditLog = executionService.getAuditLog();
      expect(auditLog.some(entry => entry.action === 'order_retry')).toBe(true);
    });

    it('should maintain comprehensive audit trail', async () => {
      const signal: TradingSignal = {
        id: 'audit_trail_signal',
        symbol: 'ETHUSDT',
        direction: 'short',
        confidence: 0.75,
        entryPrice: 3000,
        takeProfit: [2800, 2600],
        reasoning: {
          technical: { indicators: ['RSI_overbought'], confluence: 0.7, trend: 'bearish' },
          patterns: { detected: ['shooting_star'], strength: 0.8 },
          elliottWave: { currentWave: 'waveA', wavePosition: 'correction', validity: 0.8 },
          fibonacci: { levels: [0.382], confluence: 0.6 },
          volume: { profile: 'decreasing', strength: 0.7 },
          summary: 'Bearish reversal signal'
        },
        timestamp: Date.now()
      };

      // Execute signal
      await executionService.executeSignal(signal, 0.5);

      // Get comprehensive audit log
      const auditLog = executionService.getAuditLog();

      // Verify all expected events are logged
      const expectedEvents = [
        'signal_execution_start',
        'order_placed',
        'signal_execution_complete'
      ];

      expectedEvents.forEach(eventType => {
        expect(auditLog.some(entry => entry.action === eventType)).toBe(true);
      });

      // Verify audit entries have required fields
      auditLog.forEach(entry => {
        expect(entry.id).toBeDefined();
        expect(entry.timestamp).toBeDefined();
        expect(entry.action).toBeDefined();
        expect(entry.details).toBeDefined();
      });
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle high-frequency order placement', async () => {
      const startTime = Date.now();
      const orderPromises: Promise<any>[] = [];

      // Place 10 orders rapidly
      for (let i = 0; i < 10; i++) {
        const orderRequest: OrderRequest = {
          symbol: 'BTCUSDT',
          side: i % 2 === 0 ? 'buy' : 'sell',
          type: 'market',
          quantity: 0.01,
          exchange: 'binance',
          clientOrderId: `hf_order_${i}`
        };

        orderPromises.push(executionService.placeOrder(orderRequest));
      }

      const results = await Promise.all(orderPromises);
      const endTime = Date.now();

      // All orders should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should complete within reasonable time (less than 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should maintain system stability under error conditions', async () => {
      // Mock various error conditions
      const mockPlaceOrder = jest.spyOn(exchangeManager, 'placeOrder');
      
      // Create a mix of successful and failed orders
      const responses = [
        Promise.resolve({ orderId: 'success_1', symbol: 'BTCUSDT', side: 'buy' as const, type: 'market', quantity: 0.1, status: 'filled' as const, timestamp: Date.now(), exchange: 'binance' }),
        Promise.reject(new Error('Network error')),
        Promise.resolve({ orderId: 'success_2', symbol: 'BTCUSDT', side: 'buy' as const, type: 'market', quantity: 0.1, status: 'filled' as const, timestamp: Date.now(), exchange: 'binance' }),
        Promise.reject(new Error('Insufficient balance')),
        Promise.resolve({ orderId: 'success_3', symbol: 'BTCUSDT', side: 'buy' as const, type: 'market', quantity: 0.1, status: 'filled' as const, timestamp: Date.now(), exchange: 'binance' })
      ];

      let responseIndex = 0;
      mockPlaceOrder.mockImplementation(() => {
        const response = responses[responseIndex % responses.length];
        responseIndex++;
        return response as Promise<any>;
      });

      const orderPromises: Promise<any>[] = [];
      
      // Place multiple orders with mixed success/failure
      for (let i = 0; i < 5; i++) {
        const orderRequest: OrderRequest = {
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 0.1,
          exchange: 'binance',
          clientOrderId: `stability_test_${i}`
        };

        orderPromises.push(executionService.placeOrder(orderRequest));
      }

      const results = await Promise.all(orderPromises);

      // Should have mix of successes and failures
      const successes = results.filter(r => r.success).length;
      const failures = results.filter(r => !r.success).length;

      expect(successes).toBeGreaterThan(0);
      expect(failures).toBeGreaterThan(0);
      expect(successes + failures).toBe(5);

      // Service should remain operational
      const activeOrders = executionService.getActiveOrders();
      expect(Array.isArray(activeOrders)).toBe(true);
    });
  });
});