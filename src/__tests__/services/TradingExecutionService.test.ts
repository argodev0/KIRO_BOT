/**
 * Trading Execution Service Tests
 * Comprehensive test suite for order execution workflows
 */

import { TradingExecutionService, ExecutionConfig } from '../../services/TradingExecutionService';
import { ExchangeManager } from '../../services/exchanges/ExchangeManager';
import { OrderRequest, OrderResponse, TradingSignal } from '../../types/trading';

// Mock ExchangeManager
jest.mock('../../services/exchanges/ExchangeManager');

describe('TradingExecutionService', () => {
  let executionService: TradingExecutionService;
  let mockExchangeManager: jest.Mocked<ExchangeManager>;
  let defaultConfig: ExecutionConfig;

  beforeEach(() => {
    // Create mock exchange manager
    mockExchangeManager = {
      placeOrder: jest.fn(),
      cancelOrder: jest.fn(),
      getOrder: jest.fn(),
      getOrderHistory: jest.fn(),
      getTicker: jest.fn(),
      getAvailableExchanges: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    // Default configuration
    defaultConfig = {
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
      retryDelay: 1000,
      orderTimeout: 300000,
      enableAuditLog: true
    };

    executionService = new TradingExecutionService(mockExchangeManager, defaultConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Order Placement', () => {
    it('should place a simple market order successfully', async () => {
      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        exchange: 'binance',
        clientOrderId: 'test_order_1'
      };

      const mockOrderResponse: OrderResponse = {
        orderId: 'order_123',
        clientOrderId: 'test_order_1',
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        status: 'filled',
        timestamp: Date.now(),
        exchange: 'binance'
      };

      mockExchangeManager.placeOrder.mockResolvedValue(mockOrderResponse);
      mockExchangeManager.getOrder.mockResolvedValue({
        ...mockOrderResponse,
        status: 'filled'
      });

      const result = await executionService.placeOrder(orderRequest);

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('order_123');
      expect(mockExchangeManager.placeOrder).toHaveBeenCalledWith(orderRequest, 'binance');
    });

    it('should place a limit order with price validation', async () => {
      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 50000,
        exchange: 'binance'
      };

      const mockOrderResponse: OrderResponse = {
        orderId: 'order_124',
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 50000,
        status: 'new',
        timestamp: Date.now(),
        exchange: 'binance'
      };

      mockExchangeManager.placeOrder.mockResolvedValue(mockOrderResponse);
      mockExchangeManager.getTicker.mockResolvedValue({
        symbol: 'BTCUSDT',
        exchange: 'binance',
        price: 50100,
        volume: 1000,
        timestamp: Date.now(),
        bid: 49950,
        ask: 50050
      });

      const result = await executionService.placeOrder(orderRequest);

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('order_124');
    });

    it('should reject order with excessive slippage', async () => {
      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 50000,
        exchange: 'binance'
      };

      // Mock ticker with high slippage
      mockExchangeManager.getTicker.mockResolvedValue({
        symbol: 'BTCUSDT',
        exchange: 'binance',
        price: 52000,
        volume: 1000,
        timestamp: Date.now(),
        bid: 51500,
        ask: 52500 // 5% slippage, above 2% threshold
      });

      const result = await executionService.placeOrder(orderRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Excessive slippage detected');
      expect(mockExchangeManager.placeOrder).not.toHaveBeenCalled();
    });

    it('should handle order placement failures with retries', async () => {
      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        exchange: 'binance'
      };

      // Mock first two calls to fail, third to succeed
      mockExchangeManager.placeOrder
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Rate limit'))
        .mockResolvedValueOnce({
          orderId: 'order_125',
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 0.1,
          status: 'filled',
          timestamp: Date.now(),
          exchange: 'binance'
        });

      const result = await executionService.placeOrder(orderRequest);

      expect(result.success).toBe(true);
      expect(mockExchangeManager.placeOrder).toHaveBeenCalledTimes(3);
    });

    it('should validate order request parameters', async () => {
      const invalidOrder: OrderRequest = {
        symbol: '',
        side: 'buy',
        type: 'market',
        quantity: -1,
        exchange: 'binance'
      };

      const result = await executionService.placeOrder(invalidOrder);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid order request');
      expect(mockExchangeManager.placeOrder).not.toHaveBeenCalled();
    });
  });

  describe('Signal Execution', () => {
    it('should execute a long signal successfully', async () => {
      const signal: TradingSignal = {
        id: 'signal_1',
        symbol: 'BTCUSDT',
        direction: 'long',
        confidence: 0.85,
        entryPrice: 50000,
        takeProfit: [52000, 54000],
        reasoning: {
          technical: { indicators: ['RSI'], confluence: 0.8, trend: 'bullish' },
          patterns: { detected: ['hammer'], strength: 0.7 },
          elliottWave: { currentWave: 'wave3', wavePosition: 'impulse', validity: 0.9 },
          fibonacci: { levels: [0.618], confluence: 0.6 },
          volume: { profile: 'increasing', strength: 0.8 },
          summary: 'Strong bullish signal'
        },
        timestamp: Date.now()
      };

      mockExchangeManager.getAvailableExchanges.mockReturnValue(['binance', 'kucoin']);
      mockExchangeManager.placeOrder.mockResolvedValue({
        orderId: 'signal_order_1',
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        status: 'filled',
        timestamp: Date.now(),
        exchange: 'binance'
      });

      const result = await executionService.executeSignal(signal, 0.1);

      expect(result.success).toBe(true);
      expect(result.executedQuantity).toBe(0.1);
      expect(mockExchangeManager.placeOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 0.1
        }),
        'binance'
      );
    });

    it('should execute a short signal successfully', async () => {
      const signal: TradingSignal = {
        id: 'signal_2',
        symbol: 'BTCUSDT',
        direction: 'short',
        confidence: 0.75,
        entryPrice: 50000,
        takeProfit: [48000, 46000],
        reasoning: {
          technical: { indicators: ['RSI'], confluence: 0.7, trend: 'bearish' },
          patterns: { detected: ['shooting_star'], strength: 0.8 },
          elliottWave: { currentWave: 'waveA', wavePosition: 'correction', validity: 0.8 },
          fibonacci: { levels: [0.382], confluence: 0.5 },
          volume: { profile: 'decreasing', strength: 0.6 },
          summary: 'Bearish reversal signal'
        },
        timestamp: Date.now()
      };

      mockExchangeManager.getAvailableExchanges.mockReturnValue(['binance']);
      mockExchangeManager.placeOrder.mockResolvedValue({
        orderId: 'signal_order_2',
        symbol: 'BTCUSDT',
        side: 'sell',
        type: 'market',
        quantity: 0.05,
        status: 'filled',
        timestamp: Date.now(),
        exchange: 'binance'
      });

      const result = await executionService.executeSignal(signal, 0.05);

      expect(result.success).toBe(true);
      expect(mockExchangeManager.placeOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTCUSDT',
          side: 'sell',
          type: 'market',
          quantity: 0.05
        }),
        'binance'
      );
    });
  });

  describe('Order Management', () => {
    it('should cancel an active order successfully', async () => {
      // First place an order
      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 50000,
        exchange: 'binance'
      };

      mockExchangeManager.placeOrder.mockResolvedValue({
        orderId: 'order_to_cancel',
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 50000,
        status: 'new',
        timestamp: Date.now(),
        exchange: 'binance'
      });

      await executionService.placeOrder(orderRequest);

      // Now cancel it
      mockExchangeManager.cancelOrder.mockResolvedValue(true);

      const cancelled = await executionService.cancelOrder('order_to_cancel');

      expect(cancelled).toBe(true);
      expect(mockExchangeManager.cancelOrder).toHaveBeenCalledWith(
        'order_to_cancel',
        'BTCUSDT',
        'binance'
      );
    });

    it('should modify an order by cancelling and replacing', async () => {
      // First place an order
      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 50000,
        exchange: 'binance'
      };

      mockExchangeManager.placeOrder.mockResolvedValueOnce({
        orderId: 'order_to_modify',
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 50000,
        status: 'new',
        timestamp: Date.now(),
        exchange: 'binance'
      });

      await executionService.placeOrder(orderRequest);

      // Mock cancel and new order placement
      mockExchangeManager.cancelOrder.mockResolvedValue(true);
      mockExchangeManager.placeOrder.mockResolvedValueOnce({
        orderId: 'modified_order',
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.2,
        price: 49000,
        status: 'new',
        timestamp: Date.now(),
        exchange: 'binance'
      });

      const result = await executionService.modifyOrder('order_to_modify', {
        quantity: 0.2,
        price: 49000
      });

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('modified_order');
      expect(mockExchangeManager.cancelOrder).toHaveBeenCalled();
      expect(mockExchangeManager.placeOrder).toHaveBeenCalledTimes(2);
    });

    it('should get order status from exchange', async () => {
      // First place an order
      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 50000,
        exchange: 'binance'
      };

      mockExchangeManager.placeOrder.mockResolvedValue({
        orderId: 'status_check_order',
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 50000,
        status: 'new',
        timestamp: Date.now(),
        exchange: 'binance'
      });

      await executionService.placeOrder(orderRequest);

      // Mock getting updated status
      mockExchangeManager.getOrder.mockResolvedValue({
        orderId: 'status_check_order',
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 50000,
        status: 'partially_filled',
        timestamp: Date.now(),
        exchange: 'binance'
      });

      const status = await executionService.getOrderStatus('status_check_order');

      expect(status).toBeTruthy();
      expect(status?.status).toBe('partially_filled');
      expect(mockExchangeManager.getOrder).toHaveBeenCalledWith(
        'status_check_order',
        'BTCUSDT',
        'binance'
      );
    });
  });

  describe('Order Optimization', () => {
    it('should split large orders into iceberg chunks', async () => {
      const largeOrderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 2500, // Larger than chunk size of 1000
        exchange: 'binance',
        clientOrderId: 'large_order'
      };

      // Mock successful responses for each chunk
      mockExchangeManager.placeOrder
        .mockResolvedValueOnce({
          orderId: 'chunk_1',
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 1000,
          status: 'filled',
          timestamp: Date.now(),
          exchange: 'binance'
        })
        .mockResolvedValueOnce({
          orderId: 'chunk_2',
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 1000,
          status: 'filled',
          timestamp: Date.now(),
          exchange: 'binance'
        })
        .mockResolvedValueOnce({
          orderId: 'chunk_3',
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 500,
          status: 'filled',
          timestamp: Date.now(),
          exchange: 'binance'
        });

      const result = await executionService.placeOrder(largeOrderRequest);

      expect(result.success).toBe(true);
      expect(result.executedQuantity).toBe(2500);
      expect(mockExchangeManager.placeOrder).toHaveBeenCalledTimes(3);
    });

    it('should handle TWAP order execution', async () => {
      // Enable TWAP in config
      const twapConfig = {
        ...defaultConfig,
        orderOptimization: {
          ...defaultConfig.orderOptimization,
          twap: {
            enabled: true,
            duration: 300000,
            intervals: 3
          }
        }
      };

      const twapService = new TradingExecutionService(mockExchangeManager, twapConfig);

      const twapOrderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.3,
        exchange: 'binance',
        clientOrderId: 'twap_order'
      };

      // Mock successful responses for each interval
      mockExchangeManager.placeOrder
        .mockResolvedValueOnce({
          orderId: 'twap_1',
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 0.1,
          status: 'filled',
          timestamp: Date.now(),
          exchange: 'binance'
        })
        .mockResolvedValueOnce({
          orderId: 'twap_2',
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 0.1,
          status: 'filled',
          timestamp: Date.now(),
          exchange: 'binance'
        })
        .mockResolvedValueOnce({
          orderId: 'twap_3',
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 0.1,
          status: 'filled',
          timestamp: Date.now(),
          exchange: 'binance'
        });

      const result = await twapService.placeOrder(twapOrderRequest);

      expect(result.success).toBe(true);
      expect(result.executedQuantity).toBe(0.3);
      expect(mockExchangeManager.placeOrder).toHaveBeenCalledTimes(3);
    });
  });

  describe('Audit Logging', () => {
    it('should log order placement events', async () => {
      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        exchange: 'binance'
      };

      mockExchangeManager.placeOrder.mockResolvedValue({
        orderId: 'audit_order',
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        status: 'filled',
        timestamp: Date.now(),
        exchange: 'binance'
      });

      await executionService.placeOrder(orderRequest);

      const auditLog = executionService.getAuditLog();
      
      expect(auditLog.length).toBeGreaterThan(0);
      expect(auditLog.some(entry => entry.action === 'order_placed')).toBe(true);
    });

    it('should log signal execution events', async () => {
      const signal: TradingSignal = {
        id: 'audit_signal',
        symbol: 'BTCUSDT',
        direction: 'long',
        confidence: 0.8,
        entryPrice: 50000,
        takeProfit: [52000],
        reasoning: {
          technical: { indicators: [], confluence: 0, trend: '' },
          patterns: { detected: [], strength: 0 },
          elliottWave: { currentWave: '', wavePosition: '', validity: 0 },
          fibonacci: { levels: [], confluence: 0 },
          volume: { profile: '', strength: 0 },
          summary: ''
        },
        timestamp: Date.now()
      };

      mockExchangeManager.getAvailableExchanges.mockReturnValue(['binance']);
      mockExchangeManager.placeOrder.mockResolvedValue({
        orderId: 'audit_signal_order',
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        status: 'filled',
        timestamp: Date.now(),
        exchange: 'binance'
      });

      await executionService.executeSignal(signal, 0.1);

      const auditLog = executionService.getAuditLog();
      
      expect(auditLog.some(entry => entry.action === 'signal_execution_start')).toBe(true);
      expect(auditLog.some(entry => entry.action === 'signal_execution_complete')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle exchange connection failures gracefully', async () => {
      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        exchange: 'binance'
      };

      mockExchangeManager.placeOrder.mockRejectedValue(new Error('Exchange unavailable'));

      const result = await executionService.placeOrder(orderRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Exchange unavailable');
    });

    it('should handle invalid order parameters', async () => {
      const invalidOrder: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        // Missing required price for limit order
        exchange: 'binance'
      };

      const result = await executionService.placeOrder(invalidOrder);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Limit orders require a price');
    });

    it('should handle order not found scenarios', async () => {
      const cancelled = await executionService.cancelOrder('non_existent_order');
      expect(cancelled).toBe(false);

      const status = await executionService.getOrderStatus('non_existent_order');
      expect(status).toBeNull();
    });
  });

  describe('Service Lifecycle', () => {
    it('should shutdown gracefully and cancel active orders', async () => {
      // Place some orders first
      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 50000,
        exchange: 'binance'
      };

      mockExchangeManager.placeOrder.mockResolvedValue({
        orderId: 'shutdown_order',
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 50000,
        status: 'new',
        timestamp: Date.now(),
        exchange: 'binance'
      });

      await executionService.placeOrder(orderRequest);

      // Mock cancel for shutdown
      mockExchangeManager.cancelOrder.mockResolvedValue(true);

      await executionService.shutdown();

      expect(mockExchangeManager.cancelOrder).toHaveBeenCalledWith(
        'shutdown_order',
        'BTCUSDT',
        'binance'
      );

      const activeOrders = executionService.getActiveOrders();
      expect(activeOrders.length).toBe(0);
    });
  });
});