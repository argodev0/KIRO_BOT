/**
 * Unit Tests for MultiExchangeCoordinator Service
 * Tests individual methods and functionality of the multi-exchange coordination system
 */

import { MultiExchangeCoordinator } from '../../services/MultiExchangeCoordinator';
import { HummingbotBridgeService } from '../../services/HummingbotBridgeService';
import { HummingbotStrategyMonitor } from '../../services/HummingbotStrategyMonitor';
import { HummingbotConfigurationManager } from '../../services/HummingbotConfigurationManager';
import { 
  HBStrategy, 
  ArbitrageOpportunity, 
  MultiExchangeConfig,
  ExchangeStatus
} from '../../types/hummingbot';
import { CrossExchangeStrategy } from '../../services/MultiExchangeCoordinator';

describe('MultiExchangeCoordinator', () => {
  let coordinator: MultiExchangeCoordinator;
  let mockBridgeService: jest.Mocked<HummingbotBridgeService>;
  let mockStrategyMonitor: jest.Mocked<HummingbotStrategyMonitor>;
  let mockConfigManager: jest.Mocked<HummingbotConfigurationManager>;
  let mockConfig: MultiExchangeConfig;

  beforeEach(() => {
    mockBridgeService = {
      getInstancesByExchange: jest.fn(),
      deployStrategy: jest.fn(),
      getMarketPrice: jest.fn(),
      pingExchange: jest.fn(),
      getVolatility: jest.fn(),
      getVolume: jest.fn(),
      getSpread: jest.fn(),
      updateStrategy: jest.fn(),
      stopStrategy: jest.fn(),
      getBalances: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    mockStrategyMonitor = {
      trackStrategy: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    mockConfigManager = {
      validateConfiguration: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    mockConfig = {
      arbitrage: {
        minProfitThreshold: 0.5,
        maxLatencyMs: 1000,
        supportedPairs: ['BTC/USDT', 'ETH/USDT'],
        exchanges: ['binance', 'kucoin'],
        maxOrderSize: 1000,
        minOrderSize: 10,
        executionTimeoutMs: 5000,
        priceUpdateIntervalMs: 1000
      },
      failover: {
        primaryExchange: 'binance',
        fallbackExchanges: ['kucoin'],
        healthCheckIntervalMs: 30000,
        failoverThresholdMs: 5000,
        maxFailoverAttempts: 3,
        failoverCooldownMs: 60000,
        autoRecoveryEnabled: true,
        recoveryCheckIntervalMs: 10000
      },
      rebalancing: {
        enabled: true,
        rebalanceIntervalMs: 300000,
        rebalanceThreshold: 5,
        maxRebalanceAmount: 10000,
        minRebalanceAmount: 100,
        targetAllocations: { 'BTC': 50, 'ETH': 30, 'USDT': 20 },
        rebalancingStrategy: 'proportional'
      },
      coordination: {
        maxConcurrentStrategies: 10,
        strategyPriorities: { 'arbitrage': 1, 'grid': 2, 'market_making': 3 },
        conflictResolution: 'priority',
        resourceAllocation: {
          maxCpuPerStrategy: 0.5,
          maxMemoryPerStrategy: 512,
          maxNetworkPerStrategy: 1000
        }
      }
    };

    coordinator = new MultiExchangeCoordinator(
      mockBridgeService,
      mockStrategyMonitor,
      mockConfigManager,
      mockConfig
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(coordinator).toBeInstanceOf(MultiExchangeCoordinator);
      expect((coordinator as any).arbitrageConfig).toEqual(mockConfig.arbitrage);
      expect((coordinator as any).failoverConfig).toEqual(mockConfig.failover);
    });

    it('should initialize exchange status for configured exchanges', () => {
      const exchangeStatus = (coordinator as any).exchangeStatus;
      expect(exchangeStatus.has('binance')).toBe(true);
      expect(exchangeStatus.has('kucoin')).toBe(true);
      
      const binanceStatus = exchangeStatus.get('binance');
      expect(binanceStatus.name).toBe('binance');
      expect(binanceStatus.status).toBe('unknown');
    });
  });

  describe('coordinateStrategies', () => {
    it('should group strategies by exchange correctly', async () => {
      // Arrange
      // Set exchange status to healthy
      const exchangeStatus = new Map();
      exchangeStatus.set('binance', { name: 'binance', status: 'healthy', lastPing: Date.now(), latency: 50, errorCount: 0 });
      exchangeStatus.set('kucoin', { name: 'kucoin', status: 'healthy', lastPing: Date.now(), latency: 60, errorCount: 0 });
      (coordinator as any).exchangeStatus = exchangeStatus;

      const strategies: HBStrategy[] = [
        {
          id: 'strategy1',
          type: 'pure_market_making',
          exchange: 'binance',
          tradingPair: 'BTC/USDT',
          parameters: {},
          riskLimits: { maxPositionSize: 1000, maxDailyLoss: 100, stopLossPercentage: 2, maxOpenOrders: 5, maxSlippage: 0.5 },
          executionSettings: { orderRefreshTime: 30, orderRefreshTolerance: 0.1, filledOrderDelay: 1, orderOptimization: true, addTransactionCosts: true, priceSource: 'current_market' }
        },
        {
          id: 'strategy2',
          type: 'grid_trading',
          exchange: 'binance',
          tradingPair: 'ETH/USDT',
          parameters: {},
          riskLimits: { maxPositionSize: 500, maxDailyLoss: 50, stopLossPercentage: 3, maxOpenOrders: 10, maxSlippage: 0.5 },
          executionSettings: { orderRefreshTime: 60, orderRefreshTolerance: 0.2, filledOrderDelay: 2, orderOptimization: false, addTransactionCosts: true, priceSource: 'current_market' }
        },
        {
          id: 'strategy3',
          type: 'pure_market_making',
          exchange: 'kucoin',
          tradingPair: 'BTC/USDT',
          parameters: {},
          riskLimits: { maxPositionSize: 800, maxDailyLoss: 80, stopLossPercentage: 2.5, maxOpenOrders: 8, maxSlippage: 0.5 },
          executionSettings: { orderRefreshTime: 45, orderRefreshTolerance: 0.15, filledOrderDelay: 1.5, orderOptimization: true, addTransactionCosts: true, priceSource: 'current_market' }
        }
      ];

      const mockInstances = [
        {
          id: 'instance1',
          name: 'Instance 1',
          status: 'running' as const,
          strategies: [],
          resources: { cpuUsage: 30, memoryUsage: 256000000, memoryLimit: 512000000, networkIn: 1000, networkOut: 1000, diskUsage: 100000000, diskLimit: 1000000000 },
          performance: { uptime: 3600, totalStrategies: 0, activeStrategies: 0, totalTrades: 0, totalVolume: 0, totalPnL: 0, averageLatency: 50, errorRate: 0 },
          config: {} as any,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastHealthCheck: Date.now()
        }
      ];

      mockBridgeService.getInstancesByExchange.mockResolvedValue(mockInstances);
      mockBridgeService.deployStrategy.mockImplementation(async (instanceId, strategy) => ({
        id: strategy.id || 'exec_1',
        strategyType: strategy.type,
        instanceId,
        status: 'active',
        startTime: Date.now(),
        parameters: strategy.parameters,
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
      }));

      // Act
      const result = await coordinator.coordinateStrategies(strategies);

      // Assert
      expect(mockBridgeService.getInstancesByExchange).toHaveBeenCalledWith('binance');
      expect(mockBridgeService.getInstancesByExchange).toHaveBeenCalledWith('kucoin');
      expect(mockBridgeService.deployStrategy).toHaveBeenCalledTimes(3);
      expect(result.exchanges).toEqual(['binance', 'kucoin']);
      expect(result.strategies).toHaveLength(3);
    });

    it('should throw error when exchange is unavailable', async () => {
      // Arrange
      const strategies: HBStrategy[] = [
        {
          id: 'strategy1',
          type: 'pure_market_making',
          exchange: 'binance',
          tradingPair: 'BTC/USDT',
          parameters: {},
          riskLimits: { maxPositionSize: 1000, maxDailyLoss: 100, stopLossPercentage: 2, maxOpenOrders: 5, maxSlippage: 0.5 },
          executionSettings: { orderRefreshTime: 30, orderRefreshTolerance: 0.1, filledOrderDelay: 1, orderOptimization: true, addTransactionCosts: true, priceSource: 'current_market' }
        }
      ];

      // Mock exchange status as failed
      const exchangeStatus = new Map();
      exchangeStatus.set('binance', { name: 'binance', status: 'failed', lastPing: 0, latency: 0, errorCount: 5 });
      (coordinator as any).exchangeStatus = exchangeStatus;

      // Act & Assert
      await expect(coordinator.coordinateStrategies(strategies)).rejects.toThrow('Exchange binance is not available');
    });
  });

  describe('detectArbitrageOpportunities', () => {
    it('should detect arbitrage opportunities when price differences exceed threshold', async () => {
      // Arrange
      mockBridgeService.getMarketPrice
        .mockResolvedValueOnce(50000) // BTC on binance
        .mockResolvedValueOnce(50300) // BTC on kucoin
        .mockResolvedValueOnce(3000)  // ETH on binance
        .mockResolvedValueOnce(3020); // ETH on kucoin

      // Act
      const opportunities = await coordinator.detectArbitrageOpportunities();

      // Assert
      expect(opportunities).toHaveLength(2);
      
      const btcOpportunity = opportunities.find(op => op.pair === 'BTC/USDT');
      expect(btcOpportunity).toBeDefined();
      expect(btcOpportunity!.buyExchange).toBe('binance');
      expect(btcOpportunity!.sellExchange).toBe('kucoin');
      expect(btcOpportunity!.profitPercent).toBeCloseTo(0.6, 1);
      expect(btcOpportunity!.status).toBe('detected');

      const ethOpportunity = opportunities.find(op => op.pair === 'ETH/USDT');
      expect(ethOpportunity).toBeDefined();
      expect(ethOpportunity!.buyExchange).toBe('binance');
      expect(ethOpportunity!.sellExchange).toBe('kucoin');
      expect(ethOpportunity!.profitPercent).toBeCloseTo(0.67, 1);
    });

    it('should not detect opportunities when price differences are below threshold', async () => {
      // Arrange
      mockBridgeService.getMarketPrice
        .mockResolvedValueOnce(50000) // BTC on binance
        .mockResolvedValueOnce(50100) // BTC on kucoin (only 0.2% difference)
        .mockResolvedValueOnce(3000)  // ETH on binance
        .mockResolvedValueOnce(3005); // ETH on kucoin (only 0.17% difference)

      // Act
      const opportunities = await coordinator.detectArbitrageOpportunities();

      // Assert
      expect(opportunities).toHaveLength(0);
    });

    it('should handle price fetch errors gracefully', async () => {
      // Arrange
      mockBridgeService.getMarketPrice
        .mockResolvedValueOnce(50000) // BTC on binance
        .mockRejectedValueOnce(new Error('Network error')) // BTC on kucoin fails
        .mockResolvedValueOnce(3000)  // ETH on binance
        .mockResolvedValueOnce(3005); // ETH on kucoin (small difference, below threshold)

      // Act
      const opportunities = await coordinator.detectArbitrageOpportunities();

      // Assert
      expect(opportunities).toHaveLength(0); // No opportunities because BTC price fetch failed and ETH difference is below threshold
    });
  });

  describe('executeArbitrage', () => {
    it('should execute arbitrage when opportunity is still valid', async () => {
      // Arrange
      const opportunity: ArbitrageOpportunity = {
        id: 'arb_test',
        pair: 'BTC/USDT',
        buyExchange: 'binance',
        sellExchange: 'kucoin',
        buyPrice: 50000,
        sellPrice: 50300,
        profitPercent: 0.6,
        estimatedProfit: 300,
        detectedAt: Date.now(),
        status: 'detected'
      };

      // Mock current prices still show arbitrage
      mockBridgeService.getMarketPrice
        .mockResolvedValueOnce(50000) // binance
        .mockResolvedValueOnce(50300); // kucoin

      const mockInstances = [
        {
          id: 'instance1',
          name: 'Instance 1',
          status: 'running' as const,
          strategies: [],
          resources: { cpuUsage: 30, memoryUsage: 256000000, memoryLimit: 512000000, networkIn: 1000, networkOut: 1000, diskUsage: 100000000, diskLimit: 1000000000 },
          performance: { uptime: 3600, totalStrategies: 0, activeStrategies: 0, totalTrades: 0, totalVolume: 0, totalPnL: 0, averageLatency: 50, errorRate: 0 },
          config: {} as any,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastHealthCheck: Date.now()
        }
      ];

      mockBridgeService.getInstancesByExchange.mockResolvedValue(mockInstances);
      mockBridgeService.deployStrategy.mockImplementation(async (instanceId, strategy) => ({
        id: strategy.id || 'exec_1',
        strategyType: strategy.type,
        instanceId,
        status: 'active',
        startTime: Date.now(),
        parameters: strategy.parameters,
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
      }));

      // Act
      const execution = await coordinator.executeArbitrage(opportunity);

      // Assert
      expect(execution).toBeDefined();
      expect(execution.strategyType).toBe('arbitrage');
      expect(execution.status).toBe('active');
      expect(execution.parameters.opportunity).toEqual(opportunity);
      expect(mockBridgeService.deployStrategy).toHaveBeenCalledTimes(2);
    });

    it('should reject arbitrage when opportunity is no longer valid', async () => {
      // Arrange
      const opportunity: ArbitrageOpportunity = {
        id: 'arb_invalid',
        pair: 'BTC/USDT',
        buyExchange: 'binance',
        sellExchange: 'kucoin',
        buyPrice: 50000,
        sellPrice: 50300,
        profitPercent: 0.6,
        estimatedProfit: 300,
        detectedAt: Date.now(),
        status: 'detected'
      };

      // Mock current prices no longer show arbitrage
      mockBridgeService.getMarketPrice
        .mockResolvedValueOnce(50250) // binance price increased
        .mockResolvedValueOnce(50280); // kucoin price decreased

      // Act & Assert
      await expect(coordinator.executeArbitrage(opportunity)).rejects.toThrow('Arbitrage opportunity no longer valid');
    });
  });

  describe('adjustStrategiesForMarketConditions', () => {
    it('should adjust strategy parameters based on high volatility', async () => {
      // Arrange
      const strategy: CrossExchangeStrategy = {
        id: 'test_strategy',
        type: 'coordinated_grid',
        exchanges: ['binance'],
        strategies: [
          {
            id: 'strategy1',
            type: 'pure_market_making',
            exchange: 'binance',
            tradingPair: 'BTC/USDT',
            parameters: { bid_spread: 0.1, ask_spread: 0.1 },
            riskLimits: { maxPositionSize: 1000, maxDailyLoss: 100, stopLossPercentage: 2, maxOpenOrders: 5, maxSlippage: 0.5 },
            executionSettings: { orderRefreshTime: 30, orderRefreshTolerance: 0.1, filledOrderDelay: 1, orderOptimization: true, addTransactionCosts: true, priceSource: 'current_market' }
          }
        ],
        status: 'active',
        performance: { totalPnL: 0, executedTrades: 0, averageLatency: 0 }
      };

      (coordinator as any).activeStrategies.set('test_strategy', strategy);

      mockBridgeService.getVolatility.mockResolvedValue(0.08); // 8% volatility
      mockBridgeService.getVolume.mockResolvedValue(1000000);
      mockBridgeService.getSpread.mockResolvedValue(0.002);
      mockBridgeService.updateStrategy.mockResolvedValue(undefined);

      // Act
      await coordinator.adjustStrategiesForMarketConditions();

      // Assert
      expect(mockBridgeService.updateStrategy).toHaveBeenCalledWith(
        'strategy1',
        expect.objectContaining({
          parameters: expect.objectContaining({
            bid_spread: 0.16 // 8% * 2
          })
        })
      );
    });

    it('should not adjust strategies when volatility is normal', async () => {
      // Arrange
      const strategy: CrossExchangeStrategy = {
        id: 'test_strategy',
        type: 'coordinated_grid',
        exchanges: ['binance'],
        strategies: [
          {
            id: 'strategy1',
            type: 'pure_market_making',
            exchange: 'binance',
            tradingPair: 'BTC/USDT',
            parameters: { bid_spread: 0.1, ask_spread: 0.1 },
            riskLimits: { maxPositionSize: 1000, maxDailyLoss: 100, stopLossPercentage: 2, maxOpenOrders: 5, maxSlippage: 0.5 },
            executionSettings: { orderRefreshTime: 30, orderRefreshTolerance: 0.1, filledOrderDelay: 1, orderOptimization: true, addTransactionCosts: true, priceSource: 'current_market' }
          }
        ],
        status: 'active',
        performance: { totalPnL: 0, executedTrades: 0, averageLatency: 0 }
      };

      (coordinator as any).activeStrategies.set('test_strategy', strategy);

      mockBridgeService.getVolatility.mockResolvedValue(0.02); // 2% volatility (normal)
      mockBridgeService.getVolume.mockResolvedValue(1000000);
      mockBridgeService.getSpread.mockResolvedValue(0.002);

      // Act
      await coordinator.adjustStrategiesForMarketConditions();

      // Assert
      expect(mockBridgeService.updateStrategy).not.toHaveBeenCalled();
    });
  });

  describe('handleExchangeFailover', () => {
    it('should migrate strategy to fallback exchange when available', async () => {
      // Arrange
      const strategy: CrossExchangeStrategy = {
        id: 'failover_test',
        type: 'coordinated_grid',
        exchanges: ['binance'],
        strategies: [
          {
            id: 'strategy_binance',
            type: 'pure_market_making',
            exchange: 'binance',
            tradingPair: 'BTC/USDT',
            parameters: { bid_spread: 0.1, ask_spread: 0.1 },
            riskLimits: { maxPositionSize: 1000, maxDailyLoss: 100, stopLossPercentage: 2, maxOpenOrders: 5, maxSlippage: 0.5 },
            executionSettings: { orderRefreshTime: 30, orderRefreshTolerance: 0.1, filledOrderDelay: 1, orderOptimization: true, addTransactionCosts: true, priceSource: 'current_market' }
          }
        ],
        status: 'active',
        performance: { totalPnL: 0, executedTrades: 0, averageLatency: 0 }
      };

      (coordinator as any).activeStrategies.set('failover_test', strategy);

      // Mock healthy fallback exchange
      const exchangeStatus = new Map();
      exchangeStatus.set('kucoin', { name: 'kucoin', status: 'healthy', lastPing: Date.now(), latency: 50, errorCount: 0 });
      (coordinator as any).exchangeStatus = exchangeStatus;

      const mockInstances = [
        {
          id: 'kucoin_instance',
          name: 'KuCoin Instance',
          status: 'running' as const,
          strategies: [],
          resources: { cpuUsage: 20, memoryUsage: 200000000, memoryLimit: 512000000, networkIn: 800, networkOut: 800, diskUsage: 80000000, diskLimit: 1000000000 },
          performance: { uptime: 3600, totalStrategies: 0, activeStrategies: 0, totalTrades: 0, totalVolume: 0, totalPnL: 0, averageLatency: 60, errorRate: 0 },
          config: {} as any,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastHealthCheck: Date.now()
        }
      ];

      mockBridgeService.stopStrategy.mockResolvedValue(undefined);
      mockBridgeService.getInstancesByExchange.mockResolvedValue(mockInstances);
      mockBridgeService.deployStrategy.mockResolvedValue({
        id: 'strategy_binance_migrated',
        strategyType: 'pure_market_making',
        instanceId: 'kucoin_instance',
        status: 'active',
        startTime: Date.now(),
        parameters: strategy.strategies[0].parameters,
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
      await coordinator.handleExchangeFailover('binance');

      // Assert
      expect(mockBridgeService.stopStrategy).toHaveBeenCalledWith('strategy_binance');
      expect(mockBridgeService.deployStrategy).toHaveBeenCalledWith('kucoin_instance', expect.objectContaining({
        exchange: 'kucoin'
      }));

      const updatedStrategy = (coordinator as any).activeStrategies.get('failover_test');
      expect(updatedStrategy.strategies[0].exchange).toBe('kucoin');
    });

    it('should pause strategy when no healthy fallback exchange is available', async () => {
      // Arrange
      const strategy: CrossExchangeStrategy = {
        id: 'no_fallback_test',
        type: 'coordinated_grid',
        exchanges: ['binance'],
        strategies: [
          {
            id: 'strategy_binance',
            type: 'pure_market_making',
            exchange: 'binance',
            tradingPair: 'BTC/USDT',
            parameters: { bid_spread: 0.1, ask_spread: 0.1 },
            riskLimits: { maxPositionSize: 1000, maxDailyLoss: 100, stopLossPercentage: 2, maxOpenOrders: 5, maxSlippage: 0.5 },
            executionSettings: { orderRefreshTime: 30, orderRefreshTolerance: 0.1, filledOrderDelay: 1, orderOptimization: true, addTransactionCosts: true, priceSource: 'current_market' }
          }
        ],
        status: 'active',
        performance: { totalPnL: 0, executedTrades: 0, averageLatency: 0 }
      };

      (coordinator as any).activeStrategies.set('no_fallback_test', strategy);

      // Mock no healthy fallback exchanges
      const exchangeStatus = new Map();
      exchangeStatus.set('kucoin', { name: 'kucoin', status: 'failed', lastPing: Date.now() - 60000, latency: 0, errorCount: 5 });
      (coordinator as any).exchangeStatus = exchangeStatus;

      mockBridgeService.stopStrategy.mockResolvedValue(undefined);

      // Act
      await coordinator.handleExchangeFailover('binance');

      // Assert
      expect(mockBridgeService.stopStrategy).toHaveBeenCalledWith('strategy_binance');
      
      const pausedStrategy = (coordinator as any).activeStrategies.get('no_fallback_test');
      expect(pausedStrategy.status).toBe('paused');
    });
  });

  describe('Public Methods', () => {
    it('should return active strategies', () => {
      // Arrange
      const strategy: CrossExchangeStrategy = {
        id: 'test_strategy',
        type: 'coordinated_grid',
        exchanges: ['binance'],
        strategies: [],
        status: 'active',
        performance: { totalPnL: 0, executedTrades: 0, averageLatency: 0 }
      };

      (coordinator as any).activeStrategies.set('test_strategy', strategy);

      // Act
      const activeStrategies = coordinator.getActiveStrategies();

      // Assert
      expect(activeStrategies).toHaveLength(1);
      expect(activeStrategies[0]).toEqual(strategy);
    });

    it('should return exchange status', () => {
      // Act
      const exchangeStatus = coordinator.getExchangeStatus();

      // Assert
      expect(exchangeStatus.has('binance')).toBe(true);
      expect(exchangeStatus.has('kucoin')).toBe(true);
    });

    it('should stop strategy and remove from active strategies', async () => {
      // Arrange
      const strategy: CrossExchangeStrategy = {
        id: 'stop_test',
        type: 'coordinated_grid',
        exchanges: ['binance'],
        strategies: [
          {
            id: 'strategy1',
            type: 'pure_market_making',
            exchange: 'binance',
            tradingPair: 'BTC/USDT',
            parameters: {},
            riskLimits: { maxPositionSize: 1000, maxDailyLoss: 100, stopLossPercentage: 2, maxOpenOrders: 5, maxSlippage: 0.5 },
            executionSettings: { orderRefreshTime: 30, orderRefreshTolerance: 0.1, filledOrderDelay: 1, orderOptimization: true, addTransactionCosts: true, priceSource: 'current_market' }
          }
        ],
        status: 'active',
        performance: { totalPnL: 0, executedTrades: 0, averageLatency: 0 }
      };

      (coordinator as any).activeStrategies.set('stop_test', strategy);
      mockBridgeService.stopStrategy.mockResolvedValue(undefined);

      // Act
      await coordinator.stopStrategy('stop_test');

      // Assert
      expect(mockBridgeService.stopStrategy).toHaveBeenCalledWith('strategy1');
      expect((coordinator as any).activeStrategies.has('stop_test')).toBe(false);
    });
  });

  describe('Event Emission', () => {
    it('should emit events during strategy coordination', async () => {
      // Arrange
      // Set exchange status to healthy
      const exchangeStatus = new Map();
      exchangeStatus.set('binance', { name: 'binance', status: 'healthy', lastPing: Date.now(), latency: 50, errorCount: 0 });
      (coordinator as any).exchangeStatus = exchangeStatus;

      const strategies: HBStrategy[] = [
        {
          id: 'strategy1',
          type: 'pure_market_making',
          exchange: 'binance',
          tradingPair: 'BTC/USDT',
          parameters: {},
          riskLimits: { maxPositionSize: 1000, maxDailyLoss: 100, stopLossPercentage: 2, maxOpenOrders: 5, maxSlippage: 0.5 },
          executionSettings: { orderRefreshTime: 30, orderRefreshTolerance: 0.1, filledOrderDelay: 1, orderOptimization: true, addTransactionCosts: true, priceSource: 'current_market' }
        }
      ];

      const mockInstances = [
        {
          id: 'instance1',
          name: 'Instance 1',
          status: 'running' as const,
          strategies: [],
          resources: { cpuUsage: 30, memoryUsage: 256000000, memoryLimit: 512000000, networkIn: 1000, networkOut: 1000, diskUsage: 100000000, diskLimit: 1000000000 },
          performance: { uptime: 3600, totalStrategies: 0, activeStrategies: 0, totalTrades: 0, totalVolume: 0, totalPnL: 0, averageLatency: 50, errorRate: 0 },
          config: {} as any,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastHealthCheck: Date.now()
        }
      ];

      mockBridgeService.getInstancesByExchange.mockResolvedValue(mockInstances);
      mockBridgeService.deployStrategy.mockImplementation(async (instanceId, strategy) => ({
        id: strategy.id || 'exec_1',
        strategyType: strategy.type,
        instanceId,
        status: 'active',
        startTime: Date.now(),
        parameters: strategy.parameters,
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
      }));

      const emitSpy = jest.spyOn(coordinator, 'emit');

      // Act
      await coordinator.coordinateStrategies(strategies);

      // Assert
      expect(emitSpy).toHaveBeenCalledWith('strategyCoordinated', expect.any(Object));
    });

    it('should emit events during arbitrage execution', async () => {
      // Arrange
      const opportunity: ArbitrageOpportunity = {
        id: 'arb_event_test',
        pair: 'BTC/USDT',
        buyExchange: 'binance',
        sellExchange: 'kucoin',
        buyPrice: 50000,
        sellPrice: 50300,
        profitPercent: 0.6,
        estimatedProfit: 300,
        detectedAt: Date.now(),
        status: 'detected'
      };

      mockBridgeService.getMarketPrice
        .mockResolvedValueOnce(50000)
        .mockResolvedValueOnce(50300);

      const mockInstances = [
        {
          id: 'instance1',
          name: 'Instance 1',
          status: 'running' as const,
          strategies: [],
          resources: { cpuUsage: 30, memoryUsage: 256000000, memoryLimit: 512000000, networkIn: 1000, networkOut: 1000, diskUsage: 100000000, diskLimit: 1000000000 },
          performance: { uptime: 3600, totalStrategies: 0, activeStrategies: 0, totalTrades: 0, totalVolume: 0, totalPnL: 0, averageLatency: 50, errorRate: 0 },
          config: {} as any,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastHealthCheck: Date.now()
        }
      ];

      mockBridgeService.getInstancesByExchange.mockResolvedValue(mockInstances);
      mockBridgeService.deployStrategy.mockImplementation(async (instanceId, strategy) => ({
        id: strategy.id || 'exec_1',
        strategyType: strategy.type,
        instanceId,
        status: 'active',
        startTime: Date.now(),
        parameters: strategy.parameters,
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
      }));

      const emitSpy = jest.spyOn(coordinator, 'emit');

      // Act
      await coordinator.executeArbitrage(opportunity);

      // Assert
      expect(emitSpy).toHaveBeenCalledWith('arbitrageExecuted', expect.any(Object));
    });
  });
});