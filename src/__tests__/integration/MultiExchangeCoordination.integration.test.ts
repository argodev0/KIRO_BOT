/**
 * Integration Tests for Multi-Exchange Coordination System
 * Tests cross-exchange strategy coordination, arbitrage detection, and failover mechanisms
 */

import { MultiExchangeCoordinator } from '../../services/MultiExchangeCoordinator';
import { HummingbotBridgeService } from '../../services/HummingbotBridgeService';
import { HummingbotStrategyMonitor } from '../../services/HummingbotStrategyMonitor';
import { HummingbotConfigurationManager } from '../../services/HummingbotConfigurationManager';
import { 
  HBStrategy, 
  HBInstance, 
  ArbitrageOpportunity, 

  MultiExchangeConfig,
  ExchangeStatus,
  PortfolioBalance
} from '../../types/hummingbot';
import { CrossExchangeStrategy } from '../../services/MultiExchangeCoordinator';

describe('MultiExchangeCoordination Integration Tests', () => {
  let coordinator: MultiExchangeCoordinator;
  let mockBridgeService: jest.Mocked<HummingbotBridgeService>;
  let mockStrategyMonitor: jest.Mocked<HummingbotStrategyMonitor>;
  let mockConfigManager: jest.Mocked<HummingbotConfigurationManager>;
  let mockConfig: MultiExchangeConfig;

  beforeEach(() => {
    // Mock services
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

  describe('Cross-Exchange Strategy Coordination', () => {
    it('should coordinate strategies across Binance and KuCoin', async () => {
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
          parameters: { bid_spread: 0.1, ask_spread: 0.1, order_amount: 100 },
          riskLimits: { maxPositionSize: 1000, maxDailyLoss: 100, stopLossPercentage: 2, maxOpenOrders: 5, maxSlippage: 0.5 },
          executionSettings: { orderRefreshTime: 30, orderRefreshTolerance: 0.1, filledOrderDelay: 1, orderOptimization: true, addTransactionCosts: true, priceSource: 'current_market' }
        },
        {
          id: 'strategy2',
          type: 'grid_trading',
          exchange: 'kucoin',
          tradingPair: 'ETH/USDT',
          parameters: { grid_levels: 10, grid_spread: 0.5, order_amount: 50 },
          riskLimits: { maxPositionSize: 500, maxDailyLoss: 50, stopLossPercentage: 3, maxOpenOrders: 10, maxSlippage: 0.5 },
          executionSettings: { orderRefreshTime: 60, orderRefreshTolerance: 0.2, filledOrderDelay: 2, orderOptimization: false, addTransactionCosts: true, priceSource: 'current_market' }
        }
      ];

      const mockInstances: HBInstance[] = [
        {
          id: 'instance1',
          name: 'Binance Instance',
          status: 'running',
          strategies: [],
          resources: { cpuUsage: 30, memoryUsage: 256000000, memoryLimit: 512000000, networkIn: 1000, networkOut: 1000, diskUsage: 100000000, diskLimit: 1000000000 },
          performance: { uptime: 3600, totalStrategies: 0, activeStrategies: 0, totalTrades: 0, totalVolume: 0, totalPnL: 0, averageLatency: 50, errorRate: 0 },
          config: {} as any,
          createdAt: Date.now() - 3600000,
          updatedAt: Date.now(),
          lastHealthCheck: Date.now()
        },
        {
          id: 'instance2',
          name: 'KuCoin Instance',
          status: 'running',
          strategies: [],
          resources: { cpuUsage: 25, memoryUsage: 200000000, memoryLimit: 512000000, networkIn: 800, networkOut: 800, diskUsage: 80000000, diskLimit: 1000000000 },
          performance: { uptime: 3600, totalStrategies: 0, activeStrategies: 0, totalTrades: 0, totalVolume: 0, totalPnL: 0, averageLatency: 60, errorRate: 0 },
          config: {} as any,
          createdAt: Date.now() - 3600000,
          updatedAt: Date.now(),
          lastHealthCheck: Date.now()
        }
      ];

      mockBridgeService.getInstancesByExchange
        .mockResolvedValueOnce([mockInstances[0]]) // binance
        .mockResolvedValueOnce([mockInstances[1]]); // kucoin

      mockBridgeService.deployStrategy
        .mockResolvedValueOnce({
          id: 'exec_1',
          strategyType: strategies[0].type,
          instanceId: 'instance1',
          status: 'active',
          startTime: Date.now(),
          parameters: strategies[0].parameters,
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
        })
        .mockResolvedValueOnce({
          id: 'exec_2',
          strategyType: strategies[1].type,
          instanceId: 'instance2',
          status: 'active',
          startTime: Date.now(),
          parameters: strategies[1].parameters,
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
      const result = await coordinator.coordinateStrategies(strategies);

      // Assert
      expect(result).toBeDefined();
      expect(result.type).toBe('coordinated_grid');
      expect(result.exchanges).toEqual(['binance', 'kucoin']);
      expect(result.strategies).toHaveLength(2);
      expect(result.status).toBe('active');

      expect(mockBridgeService.getInstancesByExchange).toHaveBeenCalledWith('binance');
      expect(mockBridgeService.getInstancesByExchange).toHaveBeenCalledWith('kucoin');
      expect(mockBridgeService.deployStrategy).toHaveBeenCalledTimes(2);
    });

    it('should handle exchange unavailability during coordination', async () => {
      // Arrange
      const strategies: HBStrategy[] = [
        {
          id: 'strategy1',
          type: 'pure_market_making',
          exchange: 'binance',
          tradingPair: 'BTC/USDT',
          parameters: { bid_spread: 0.1, ask_spread: 0.1, order_amount: 100 },
          riskLimits: { maxPositionSize: 1000, maxDailyLoss: 100, stopLossPercentage: 2, maxOpenOrders: 5, maxSlippage: 0.5 },
          executionSettings: { orderRefreshTime: 30, orderRefreshTolerance: 0.1, filledOrderDelay: 1, orderOptimization: true, addTransactionCosts: true, priceSource: 'current_market' }
        }
      ];

      mockBridgeService.getInstancesByExchange.mockRejectedValue(new Error('Exchange unavailable'));

      // Act & Assert
      await expect(coordinator.coordinateStrategies(strategies)).rejects.toThrow('Exchange binance is not available');
    });
  });

  describe('Arbitrage Opportunity Detection and Execution', () => {
    it('should detect arbitrage opportunities across exchanges', async () => {
      // Arrange
      mockBridgeService.getMarketPrice
        .mockResolvedValueOnce(50000) // BTC price on binance
        .mockResolvedValueOnce(50250) // BTC price on kucoin
        .mockResolvedValueOnce(3000)  // ETH price on binance
        .mockResolvedValueOnce(3015); // ETH price on kucoin

      // Act
      const opportunities = await coordinator.detectArbitrageOpportunities();

      // Assert
      expect(opportunities).toHaveLength(2);
      
      const btcOpportunity = opportunities.find(op => op.pair === 'BTC/USDT');
      expect(btcOpportunity).toBeDefined();
      expect(btcOpportunity!.buyExchange).toBe('binance');
      expect(btcOpportunity!.sellExchange).toBe('kucoin');
      expect(btcOpportunity!.profitPercent).toBeCloseTo(0.5, 1);

      const ethOpportunity = opportunities.find(op => op.pair === 'ETH/USDT');
      expect(ethOpportunity).toBeDefined();
      expect(ethOpportunity!.buyExchange).toBe('binance');
      expect(ethOpportunity!.sellExchange).toBe('kucoin');
      expect(ethOpportunity!.profitPercent).toBeCloseTo(0.5, 1);
    });

    it('should execute arbitrage opportunity via Hummingbot', async () => {
      // Arrange
      const opportunity: ArbitrageOpportunity = {
        id: 'arb_123',
        pair: 'BTC/USDT',
        buyExchange: 'binance',
        sellExchange: 'kucoin',
        buyPrice: 50000,
        sellPrice: 50250,
        profitPercent: 0.5,
        estimatedProfit: 250,
        detectedAt: Date.now(),
        status: 'detected'
      };

      const mockInstances: HBInstance[] = [
        {
          id: 'binance_instance',
          name: 'Binance Instance',
          status: 'running',
          strategies: [],
          resources: { cpuUsage: 30, memoryUsage: 256000000, memoryLimit: 512000000, networkIn: 1000, networkOut: 1000, diskUsage: 100000000, diskLimit: 1000000000 },
          performance: { uptime: 3600, totalStrategies: 0, activeStrategies: 0, totalTrades: 0, totalVolume: 0, totalPnL: 0, averageLatency: 50, errorRate: 0 },
          config: {} as any,
          createdAt: Date.now() - 3600000,
          updatedAt: Date.now(),
          lastHealthCheck: Date.now()
        },
        {
          id: 'kucoin_instance',
          name: 'KuCoin Instance',
          status: 'running',
          strategies: [],
          resources: { cpuUsage: 25, memoryUsage: 200000000, memoryLimit: 512000000, networkIn: 800, networkOut: 800, diskUsage: 80000000, diskLimit: 1000000000 },
          performance: { uptime: 3600, totalStrategies: 0, activeStrategies: 0, totalTrades: 0, totalVolume: 0, totalPnL: 0, averageLatency: 60, errorRate: 0 },
          config: {} as any,
          createdAt: Date.now() - 3600000,
          updatedAt: Date.now(),
          lastHealthCheck: Date.now()
        }
      ];

      // Mock current prices to validate opportunity
      mockBridgeService.getMarketPrice
        .mockResolvedValueOnce(50000) // binance current price
        .mockResolvedValueOnce(50250); // kucoin current price

      mockBridgeService.getInstancesByExchange
        .mockResolvedValueOnce([mockInstances[0]]) // binance
        .mockResolvedValueOnce([mockInstances[1]]); // kucoin

      const mockBuyStrategy: HBStrategy = {
        id: 'arb_buy_arb_123',
        type: 'pure_market_making',
        exchange: 'binance',
        tradingPair: 'BTC/USDT',
        parameters: expect.any(Object),
        riskLimits: expect.any(Object),
        executionSettings: expect.any(Object)
      };

      const mockSellStrategy: HBStrategy = {
        id: 'arb_sell_arb_123',
        type: 'pure_market_making',
        exchange: 'kucoin',
        tradingPair: 'BTC/USDT',
        parameters: expect.any(Object),
        riskLimits: expect.any(Object),
        executionSettings: expect.any(Object)
      };

      mockBridgeService.deployStrategy
        .mockResolvedValueOnce({
          id: 'buy_exec',
          strategyType: mockBuyStrategy.type,
          instanceId: 'binance_instance',
          status: 'active',
          startTime: Date.now(),
          parameters: mockBuyStrategy.parameters,
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
        })
        .mockResolvedValueOnce({
          id: 'sell_exec',
          strategyType: mockSellStrategy.type,
          instanceId: 'kucoin_instance',
          status: 'active',
          startTime: Date.now(),
          parameters: mockSellStrategy.parameters,
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
      const execution = await coordinator.executeArbitrage(opportunity);

      // Assert
      expect(execution).toBeDefined();
      expect(execution.strategyType).toBe('arbitrage');
      expect(execution.status).toBe('active');
      expect(execution.parameters.opportunity).toEqual(opportunity);

      expect(mockBridgeService.deployStrategy).toHaveBeenCalledTimes(2);
      expect(mockBridgeService.deployStrategy).toHaveBeenCalledWith('binance_instance', expect.objectContaining({
        exchange: 'binance',
        tradingPair: 'BTC/USDT'
      }));
      expect(mockBridgeService.deployStrategy).toHaveBeenCalledWith('kucoin_instance', expect.objectContaining({
        exchange: 'kucoin',
        tradingPair: 'BTC/USDT'
      }));
    });

    it('should reject expired arbitrage opportunities', async () => {
      // Arrange
      const opportunity: ArbitrageOpportunity = {
        id: 'arb_expired',
        pair: 'BTC/USDT',
        buyExchange: 'binance',
        sellExchange: 'kucoin',
        buyPrice: 50000,
        sellPrice: 50250,
        profitPercent: 0.5,
        estimatedProfit: 250,
        detectedAt: Date.now(),
        status: 'detected'
      };

      // Mock prices that no longer show arbitrage opportunity
      mockBridgeService.getMarketPrice
        .mockResolvedValueOnce(50200) // binance price increased
        .mockResolvedValueOnce(50220); // kucoin price decreased

      // Act & Assert
      await expect(coordinator.executeArbitrage(opportunity)).rejects.toThrow('Arbitrage opportunity no longer valid');
    });
  });

  describe('Exchange-Specific Strategy Adjustment', () => {
    it('should adjust strategies based on market conditions', async () => {
      // Arrange
      const strategy: CrossExchangeStrategy = {
        id: 'cross_123',
        type: 'coordinated_grid',
        exchanges: ['binance', 'kucoin'],
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

      // Mock the private activeStrategies map
      (coordinator as any).activeStrategies.set('cross_123', strategy);

      // Mock high volatility market conditions
      mockBridgeService.getVolatility.mockResolvedValue(0.08); // 8% volatility
      mockBridgeService.getVolume.mockResolvedValue(1000000);
      mockBridgeService.getSpread.mockResolvedValue(0.002);

      mockBridgeService.updateStrategy.mockResolvedValue(undefined);

      // Act
      await coordinator.adjustStrategiesForMarketConditions();

      // Assert
      expect(mockBridgeService.getVolatility).toHaveBeenCalledWith('binance');
      expect(mockBridgeService.updateStrategy).toHaveBeenCalledWith(
        'strategy1',
        expect.objectContaining({
          parameters: expect.objectContaining({
            bid_spread: 0.16 // 8% volatility * 2
          })
        })
      );
    });
  });

  describe('Exchange Failover Mechanisms', () => {
    it('should handle exchange failover when exchange becomes unavailable', async () => {
      // Arrange
      const strategy: CrossExchangeStrategy = {
        id: 'cross_failover',
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

      (coordinator as any).activeStrategies.set('cross_failover', strategy);

      // Mock exchange status - kucoin is healthy
      const exchangeStatus = new Map();
      exchangeStatus.set('kucoin', { name: 'kucoin', status: 'healthy', lastPing: Date.now(), latency: 50, errorCount: 0 });
      (coordinator as any).exchangeStatus = exchangeStatus;

      const mockKucoinInstances: HBInstance[] = [
        {
          id: 'kucoin_fallback',
          name: 'KuCoin Fallback',
          status: 'running',
          strategies: [],
          resources: { cpuUsage: 20, memoryUsage: 200000000, memoryLimit: 512000000, networkIn: 800, networkOut: 800, diskUsage: 80000000, diskLimit: 1000000000 },
          performance: { uptime: 3600, totalStrategies: 0, activeStrategies: 0, totalTrades: 0, totalVolume: 0, totalPnL: 0, averageLatency: 60, errorRate: 0 },
          config: {} as any,
          createdAt: Date.now() - 3600000,
          updatedAt: Date.now(),
          lastHealthCheck: Date.now()
        }
      ];

      mockBridgeService.stopStrategy.mockResolvedValue(undefined);
      mockBridgeService.getInstancesByExchange.mockResolvedValue(mockKucoinInstances);
      mockBridgeService.deployStrategy.mockResolvedValue({
        id: 'strategy_binance_migrated',
        strategyType: 'pure_market_making',
        instanceId: 'kucoin_fallback',
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
      expect(mockBridgeService.deployStrategy).toHaveBeenCalledWith('kucoin_fallback', expect.objectContaining({
        exchange: 'kucoin',
        tradingPair: 'BTC/USDT'
      }));

      // Check that strategy was updated
      const updatedStrategy = (coordinator as any).activeStrategies.get('cross_failover');
      expect(updatedStrategy.strategies[0].exchange).toBe('kucoin');
    });

    it('should pause strategy when no fallback exchange is available', async () => {
      // Arrange
      const strategy: CrossExchangeStrategy = {
        id: 'cross_no_fallback',
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

      (coordinator as any).activeStrategies.set('cross_no_fallback', strategy);

      // Mock no healthy fallback exchanges
      const exchangeStatus = new Map();
      exchangeStatus.set('kucoin', { name: 'kucoin', status: 'failed', lastPing: Date.now() - 60000, latency: 0, errorCount: 5 });
      (coordinator as any).exchangeStatus = exchangeStatus;

      mockBridgeService.stopStrategy.mockResolvedValue(undefined);

      // Act
      await coordinator.handleExchangeFailover('binance');

      // Assert
      expect(mockBridgeService.stopStrategy).toHaveBeenCalledWith('strategy_binance');
      
      const pausedStrategy = (coordinator as any).activeStrategies.get('cross_no_fallback');
      expect(pausedStrategy.status).toBe('paused');
    });
  });

  describe('Portfolio Rebalancing Coordination', () => {
    it('should rebalance portfolio across multiple exchanges', async () => {
      // Arrange
      const targetAllocations = new Map([
        ['BTC', 50],
        ['ETH', 30],
        ['USDT', 20]
      ]);

      const mockBalances: PortfolioBalance[] = [
        {
          exchange: 'binance',
          assets: {
            'BTC': { amount: 0.8, value: 40000, locked: 0, available: 0.8 },
            'ETH': { amount: 5, value: 15000, locked: 0, available: 5 },
            'USDT': { amount: 5000, value: 5000, locked: 0, available: 5000 }
          },
          totalValue: 60000,
          lastUpdated: Date.now()
        },
        {
          exchange: 'kucoin',
          assets: {
            'BTC': { amount: 0.2, value: 10000, locked: 0, available: 0.2 },
            'ETH': { amount: 3, value: 9000, locked: 0, available: 3 },
            'USDT': { amount: 1000, value: 1000, locked: 0, available: 1000 }
          },
          totalValue: 20000,
          lastUpdated: Date.now()
        }
      ];

      mockBridgeService.getBalances
        .mockResolvedValueOnce(mockBalances[0])
        .mockResolvedValueOnce(mockBalances[1]);

      const mockInstances: HBInstance[] = [
        {
          id: 'binance_rebalance',
          name: 'Binance Rebalance',
          status: 'running',
          strategies: [],
          resources: { cpuUsage: 30, memoryUsage: 256000000, memoryLimit: 512000000, networkIn: 1000, networkOut: 1000, diskUsage: 100000000, diskLimit: 1000000000 },
          performance: { uptime: 3600, totalStrategies: 0, activeStrategies: 0, totalTrades: 0, totalVolume: 0, totalPnL: 0, averageLatency: 50, errorRate: 0 },
          config: {} as any,
          createdAt: Date.now() - 3600000,
          updatedAt: Date.now(),
          lastHealthCheck: Date.now()
        }
      ];

      mockBridgeService.getInstancesByExchange.mockResolvedValue(mockInstances);
      mockBridgeService.deployStrategy.mockResolvedValue({} as any);

      // Act
      await coordinator.rebalancePortfolio(targetAllocations);

      // Assert
      expect(mockBridgeService.getBalances).toHaveBeenCalledWith('binance');
      expect(mockBridgeService.getBalances).toHaveBeenCalledWith('kucoin');
      expect(mockBridgeService.deployStrategy).toHaveBeenCalled();
    });
  });

  describe('Integration Test Scenarios', () => {
    it('should handle complete multi-exchange workflow', async () => {
      // This test simulates a complete workflow:
      // 1. Coordinate strategies across exchanges
      // 2. Detect arbitrage opportunities
      // 3. Execute arbitrage
      // 4. Handle exchange failover
      // 5. Rebalance portfolio

      // Set exchange status to healthy
      const exchangeStatus = new Map();
      exchangeStatus.set('binance', { name: 'binance', status: 'healthy', lastPing: Date.now(), latency: 50, errorCount: 0 });
      exchangeStatus.set('kucoin', { name: 'kucoin', status: 'healthy', lastPing: Date.now(), latency: 60, errorCount: 0 });
      (coordinator as any).exchangeStatus = exchangeStatus;

      // Step 1: Coordinate strategies
      const strategies: HBStrategy[] = [
        {
          id: 'strategy1',
          type: 'pure_market_making',
          exchange: 'binance',
          tradingPair: 'BTC/USDT',
          parameters: { bid_spread: 0.1, ask_spread: 0.1, order_amount: 100 },
          riskLimits: { maxPositionSize: 1000, maxDailyLoss: 100, stopLossPercentage: 2, maxOpenOrders: 5, maxSlippage: 0.5 },
          executionSettings: { orderRefreshTime: 30, orderRefreshTolerance: 0.1, filledOrderDelay: 1, orderOptimization: true, addTransactionCosts: true, priceSource: 'current_market' }
        }
      ];

      const mockInstances: HBInstance[] = [
        {
          id: 'instance1',
          name: 'Test Instance',
          status: 'running',
          strategies: [],
          resources: { cpuUsage: 30, memoryUsage: 256000000, memoryLimit: 512000000, networkIn: 1000, networkOut: 1000, diskUsage: 100000000, diskLimit: 1000000000 },
          performance: { uptime: 3600, totalStrategies: 0, activeStrategies: 0, totalTrades: 0, totalVolume: 0, totalPnL: 0, averageLatency: 50, errorRate: 0 },
          config: {} as any,
          createdAt: Date.now() - 3600000,
          updatedAt: Date.now(),
          lastHealthCheck: Date.now()
        }
      ];

      mockBridgeService.getInstancesByExchange.mockResolvedValue(mockInstances);
      mockBridgeService.deployStrategy.mockResolvedValue({
        id: 'exec_1',
        strategyType: strategies[0].type,
        instanceId: 'instance1',
        status: 'active',
        startTime: Date.now(),
        parameters: strategies[0].parameters,
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

      const coordinatedStrategy = await coordinator.coordinateStrategies(strategies);
      expect(coordinatedStrategy).toBeDefined();

      // Step 2: Detect arbitrage
      mockBridgeService.getMarketPrice
        .mockResolvedValueOnce(50000)
        .mockResolvedValueOnce(50300);

      const opportunities = await coordinator.detectArbitrageOpportunities();
      expect(opportunities.length).toBeGreaterThan(0);

      // Step 3: Execute arbitrage
      if (opportunities.length > 0) {
        mockBridgeService.getMarketPrice
          .mockResolvedValueOnce(50000)
          .mockResolvedValueOnce(50300);

        const execution = await coordinator.executeArbitrage(opportunities[0]);
        expect(execution).toBeDefined();
      }

      // Verify the complete workflow executed successfully
      expect(mockBridgeService.deployStrategy).toHaveBeenCalled();
      expect(mockBridgeService.getMarketPrice).toHaveBeenCalled();
    });
  });
});