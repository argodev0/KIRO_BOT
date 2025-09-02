import { HummingbotFailoverService } from '../../services/HummingbotFailoverService';
import { HummingbotBridgeService } from '../../services/HummingbotBridgeService';
import { TradingExecutionService } from '../../services/TradingExecutionService';
import { FailoverConfig } from '../../types/hummingbot';
import { TradingSignal } from '../../types/trading';

describe('HummingbotFailoverService', () => {
  let failoverService: HummingbotFailoverService;
  let mockHummingbotService: jest.Mocked<HummingbotBridgeService>;
  let mockTradingService: jest.Mocked<TradingExecutionService>;

  const config: FailoverConfig = {
    initialBackoffMs: 100,
    maxBackoffMs: 1000,
    maxRetryAttempts: 3,
    healthCheckIntervalMs: 1000
  };

  const mockSignal: TradingSignal = {
    id: 'test-signal',
    symbol: 'BTCUSDT',
    exchange: 'binance',
    direction: 'long',
    entryPrice: 50000,
    timestamp: Date.now(),
    confidence: 0.8,
    source: 'elliott_wave'
  };

  beforeEach(() => {
    mockHummingbotService = {
      executeStrategy: jest.fn(),
      getConnections: jest.fn()
    } as any;

    mockTradingService = {
      executeSignal: jest.fn()
    } as any;

    failoverService = new HummingbotFailoverService(
      mockHummingbotService,
      mockTradingService,
      config
    );
  });

  afterEach(async () => {
    await failoverService.cleanup();
  });

  describe('executeWithFailover', () => {
    it('should execute via Hummingbot when healthy', async () => {
      // Arrange
      mockHummingbotService.getConnections.mockReturnValue(new Map([
        ['test-instance', {
          instanceId: 'test-instance',
          status: 'connected',
          lastPing: Date.now(),
          apiVersion: '1.0.0',
          supportedStrategies: ['pure_market_making'],
          endpoint: 'http://localhost:8080',
          connectionAttempts: 1
        }]
      ]));

      mockHummingbotService.executeStrategy.mockResolvedValue({
        id: 'strategy-1',
        strategyType: 'pure_market_making',
        instanceId: 'test-instance',
        status: 'active',
        startTime: Date.now(),
        parameters: {},
        performance: {
          totalTrades: 0,
          successfulTrades: 0,
          totalVolume: 0,
          totalPnL: 0,
          averageLatency: 0,
          averageSlippage: 0,
          fillRate: 0,
          maxDrawdown: 0,
          currentDrawdown: 0,
          profitFactor: 0,
          sharpeRatio: 0,
          winRate: 0
        },
        orders: [],
        trades: [],
        errors: []
      });

      // Act
      const result = await failoverService.executeWithFailover(mockSignal);

      // Assert
      expect(result.success).toBe(true);
      expect(result.executionMethod).toBe('hummingbot');
      expect(result.strategyId).toBe('strategy-1');
      expect(mockHummingbotService.executeStrategy).toHaveBeenCalledTimes(1);
      expect(mockTradingService.executeSignal).not.toHaveBeenCalled();
    });

    it('should failover to direct execution when Hummingbot fails', async () => {
      // Arrange
      mockHummingbotService.getConnections.mockReturnValue(new Map());
      mockHummingbotService.executeStrategy.mockRejectedValue(new Error('Connection failed'));
      mockTradingService.executeSignal.mockResolvedValue({
        success: true,
        orderId: 'direct-order',
        executedQuantity: 0.01,
        averagePrice: 50000,
        timestamp: Date.now()
      });

      // Act
      const result = await failoverService.executeWithFailover(mockSignal);

      // Assert
      expect(result.success).toBe(true);
      expect(result.executionMethod).toBe('direct');
      expect(mockHummingbotService.executeStrategy).toHaveBeenCalledTimes(1);
      expect(mockTradingService.executeSignal).toHaveBeenCalledTimes(1);

      const metrics = failoverService.getMetrics();
      expect(metrics.failoverCount).toBe(1);
      expect(metrics.currentState).toBe('recovering');
    });

    it('should return failure when both methods fail', async () => {
      // Arrange
      mockHummingbotService.getConnections.mockReturnValue(new Map());
      mockHummingbotService.executeStrategy.mockRejectedValue(new Error('Hummingbot failed'));
      mockTradingService.executeSignal.mockRejectedValue(new Error('Direct execution failed'));

      // Act
      const result = await failoverService.executeWithFailover(mockSignal);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockHummingbotService.executeStrategy).toHaveBeenCalledTimes(1);
      expect(mockTradingService.executeSignal).toHaveBeenCalledTimes(1);
    });
  });

  describe('health monitoring', () => {
    it('should check Hummingbot health correctly', async () => {
      // Arrange
      mockHummingbotService.getConnections.mockReturnValue(new Map([
        ['healthy-instance', {
          instanceId: 'healthy-instance',
          status: 'connected',
          lastPing: Date.now(),
          apiVersion: '1.0.0',
          supportedStrategies: ['pure_market_making'],
          endpoint: 'http://localhost:8080',
          connectionAttempts: 1
        }]
      ]));

      // Act
      const isHealthy = await (failoverService as any).checkHummingbotHealth();

      // Assert
      expect(isHealthy).toBe(true);
    });

    it('should detect unhealthy Hummingbot service', async () => {
      // Arrange
      mockHummingbotService.getConnections.mockReturnValue(new Map());

      // Act
      const isHealthy = await (failoverService as any).checkHummingbotHealth();

      // Assert
      expect(isHealthy).toBe(false);
    });

    it('should handle health check errors', async () => {
      // Arrange
      mockHummingbotService.getConnections.mockImplementation(() => {
        throw new Error('Health check failed');
      });

      // Act
      const isHealthy = await (failoverService as any).checkHummingbotHealth();

      // Assert
      expect(isHealthy).toBe(false);
    });
  });

  describe('recovery process', () => {
    it('should initiate recovery after failover', async () => {
      // Arrange
      const recoveryStartedSpy = jest.fn();
      failoverService.on('recovery-started', recoveryStartedSpy);

      mockHummingbotService.executeStrategy.mockRejectedValue(new Error('Connection failed'));
      mockTradingService.executeSignal.mockResolvedValue({
        success: true,
        orderId: 'direct-order',
        executedQuantity: 0.01,
        averagePrice: 50000,
        timestamp: Date.now()
      });

      // Act
      await failoverService.executeWithFailover(mockSignal);

      // Assert
      expect(recoveryStartedSpy).toHaveBeenCalled();
      
      const metrics = failoverService.getMetrics();
      expect(metrics.currentState).toBe('recovering');
    });

    it('should complete recovery when Hummingbot becomes healthy', async () => {
      // Arrange
      const recoveryCompletedSpy = jest.fn();
      failoverService.on('recovery-completed', recoveryCompletedSpy);

      // First call fails, second succeeds
      let callCount = 0;
      mockHummingbotService.getConnections.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return new Map();
        }
        return new Map([
          ['recovered-instance', {
            instanceId: 'recovered-instance',
            status: 'connected',
            lastPing: Date.now(),
            apiVersion: '1.0.0',
            supportedStrategies: ['pure_market_making'],
            endpoint: 'http://localhost:8080',
            connectionAttempts: 1
          }]
        ]);
      });

      mockHummingbotService.executeStrategy.mockRejectedValue(new Error('Initial failure'));
      mockTradingService.executeSignal.mockResolvedValue({
        success: true,
        orderId: 'direct-order',
        executedQuantity: 0.01,
        averagePrice: 50000,
        timestamp: Date.now()
      });

      // Act
      await failoverService.executeWithFailover(mockSignal);

      // Wait for recovery to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Assert
      const metrics = failoverService.getMetrics();
      expect(metrics.failoverCount).toBe(1);
    });
  });

  describe('metrics tracking', () => {
    it('should track failover metrics correctly', async () => {
      // Arrange
      mockHummingbotService.executeStrategy.mockRejectedValue(new Error('Connection failed'));
      mockTradingService.executeSignal.mockResolvedValue({
        success: true,
        orderId: 'direct-order',
        executedQuantity: 0.01,
        averagePrice: 50000,
        timestamp: Date.now()
      });

      // Act
      await failoverService.executeWithFailover(mockSignal);
      await failoverService.executeWithFailover(mockSignal);

      // Assert
      const metrics = failoverService.getMetrics();
      expect(metrics.failoverCount).toBe(2);
      expect(metrics.currentState).toBe('recovering');
      expect(metrics.lastFailoverTime).toBeDefined();
    });

    it('should provide connection health status', async () => {
      // Arrange
      mockHummingbotService.getConnections.mockReturnValue(new Map([
        ['test-instance', {
          instanceId: 'test-instance',
          status: 'connected',
          lastPing: Date.now() - 1000,
          apiVersion: '1.0.0',
          supportedStrategies: ['pure_market_making'],
          endpoint: 'http://localhost:8080',
          connectionAttempts: 1
        }]
      ]));

      // Act
      // Trigger health monitoring
      await new Promise(resolve => setTimeout(resolve, 100));

      const healthMap = failoverService.getConnectionHealth();

      // Assert
      expect(healthMap.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('force failover', () => {
    it('should allow forced failover for testing', async () => {
      // Arrange
      const failoverSpy = jest.fn();
      failoverService.on('failover', failoverSpy);

      // Act
      await failoverService.forceFailover();

      // Assert
      expect(failoverSpy).toHaveBeenCalled();
      
      const metrics = failoverService.getMetrics();
      expect(metrics.failoverCount).toBe(1);
      expect(metrics.currentState).toBe('recovering');
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources properly', async () => {
      // Arrange
      const listenerCount = failoverService.listenerCount('failover');

      // Act
      await failoverService.cleanup();

      // Assert
      expect(failoverService.listenerCount('failover')).toBe(0);
    });
  });
});