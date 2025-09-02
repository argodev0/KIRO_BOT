/**
 * Unit tests for HummingbotBridgeService
 */

import { HummingbotBridgeService } from '../../services/HummingbotBridgeService';
import { HBConfig, HBConnection, TradingSignal } from '../../types';

// Mock axios
jest.mock('axios');
const mockAxios = require('axios');

describe('HummingbotBridgeService', () => {
  let bridgeService: HummingbotBridgeService;
  let mockConfig: HBConfig;
  let mockTradingSignal: TradingSignal;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create service instance
    bridgeService = new HummingbotBridgeService({
      maxConnections: 5,
      connectionTimeout: 10000,
      retryAttempts: 2,
      retryDelay: 500
    });

    // Mock configuration
    mockConfig = {
      version: '1.0.0',
      instanceSettings: {
        instanceId: 'test-instance',
        name: 'Test Instance',
        dockerImage: 'hummingbot/hummingbot',
        dockerTag: 'latest',
        resources: {
          memory: '512Mi',
          cpu: '0.5',
          storage: '1Gi'
        },
        networking: {
          port: 5000,
          exposedPorts: [5000],
          networkMode: 'bridge'
        },
        environment: {
          HUMMINGBOT_LOG_LEVEL: 'INFO'
        }
      },
      strategyConfigs: [],
      exchangeSettings: {
        exchanges: [],
        defaultExchange: 'binance'
      },
      riskSettings: {
        globalRiskEnabled: true,
        maxTotalExposure: 10000,
        maxDailyLoss: 1000,
        maxDrawdown: 20,
        emergencyStopEnabled: true,
        emergencyStopLoss: 5
      }
    };

    // Mock trading signal
    mockTradingSignal = {
      id: 'signal-1',
      symbol: 'BTC-USDT',
      direction: 'long',
      confidence: 0.8,
      entryPrice: 50000,
      takeProfit: [52000],
      reasoning: {
        technical: {
          indicators: ['RSI', 'MACD'],
          confluence: 0.8,
          trend: 'bullish'
        },
        patterns: {
          detected: ['ascending_triangle'],
          strength: 0.7
        },
        elliottWave: {
          currentWave: 'wave_3',
          wavePosition: 'impulse',
          validity: 0.8
        },
        fibonacci: {
          levels: [50000, 52000],
          confluence: 0.7
        },
        volume: {
          profile: 'increasing',
          strength: 0.8
        },
        summary: 'Strong bullish signal'
      },
      timestamp: Date.now()
    };

    // Mock axios create
    mockAxios.create.mockReturnValue({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    });
  });

  afterEach(() => {
    // Clean up
    bridgeService.removeAllListeners();
  });

  describe('connectToHummingbot', () => {
    it('should successfully connect to Hummingbot instance', async () => {
      // Mock successful health check
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({
          status: 200,
          data: {
            version: '1.0.0',
            supportedStrategies: ['pure_market_making', 'grid_trading']
          }
        })
      };
      mockAxios.create.mockReturnValue(mockHttpClient);

      const connection = await bridgeService.connectToHummingbot('test-instance', mockConfig);

      expect(connection).toBeDefined();
      expect(connection.instanceId).toBe('test-instance');
      expect(connection.status).toBe('connected');
      expect(connection.supportedStrategies).toEqual(['pure_market_making', 'grid_trading']);
    });

    it('should handle connection failure', async () => {
      // Mock failed health check
      const mockHttpClient = {
        get: jest.fn().mockRejectedValue(new Error('Connection failed'))
      };
      mockAxios.create.mockReturnValue(mockHttpClient);

      await expect(bridgeService.connectToHummingbot('test-instance', mockConfig))
        .rejects.toThrow('Connection failed');
    });

    it('should respect maximum connections limit', async () => {
      // Mock successful connections
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({
          status: 200,
          data: { version: '1.0.0', supportedStrategies: [] }
        })
      };
      mockAxios.create.mockReturnValue(mockHttpClient);

      // Connect up to the limit
      for (let i = 0; i < 5; i++) {
        await bridgeService.connectToHummingbot(`instance-${i}`, mockConfig);
      }

      // Attempt to exceed the limit
      await expect(bridgeService.connectToHummingbot('instance-6', mockConfig))
        .rejects.toThrow('Maximum connections (5) reached');
    });

    it('should reuse existing connection', async () => {
      // Mock successful health check
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({
          status: 200,
          data: { version: '1.0.0', supportedStrategies: [] }
        })
      };
      mockAxios.create.mockReturnValue(mockHttpClient);

      // First connection
      const connection1 = await bridgeService.connectToHummingbot('test-instance', mockConfig);
      
      // Second connection to same instance
      const connection2 = await bridgeService.connectToHummingbot('test-instance', mockConfig);

      expect(connection1).toBe(connection2);
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1); // Only one actual connection
    });
  });

  describe('executeStrategy', () => {
    beforeEach(async () => {
      // Set up a connected instance
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({
          status: 200,
          data: { version: '1.0.0', supportedStrategies: ['pure_market_making'] }
        }),
        post: jest.fn()
      };
      mockAxios.create.mockReturnValue(mockHttpClient);

      await bridgeService.connectToHummingbot('test-instance', mockConfig);
    });

    it('should successfully execute a strategy', async () => {
      const mockHttpClient = bridgeService['httpClients'].get('test-instance');
      mockHttpClient.post.mockResolvedValue({
        data: {
          success: true,
          data: {
            id: 'strategy-1',
            status: 'active'
          }
        }
      });

      const execution = await bridgeService.executeStrategy(mockTradingSignal);

      expect(execution).toBeDefined();
      expect(execution.id).toBe('strategy-1');
      expect(execution.status).toBe('active');
    });

    it('should handle strategy execution failure', async () => {
      const mockHttpClient = bridgeService['httpClients'].get('test-instance');
      mockHttpClient.post.mockResolvedValue({
        data: {
          success: false,
          error: 'Strategy validation failed'
        }
      });

      await expect(bridgeService.executeStrategy(mockTradingSignal))
        .rejects.toThrow('Strategy validation failed');
    });

    it('should handle no available instances', async () => {
      // Disconnect all instances
      await bridgeService.disconnectAll();

      await expect(bridgeService.executeStrategy(mockTradingSignal))
        .rejects.toThrow('No healthy Hummingbot instances available');
    });
  });

  describe('monitorStrategy', () => {
    it('should create a strategy monitor', () => {
      const monitor = bridgeService.monitorStrategy('strategy-1');

      expect(monitor).toBeDefined();
      expect(typeof monitor.on).toBe('function');
      expect(typeof monitor.emit).toBe('function');
    });

    it('should emit metrics events', (done) => {
      const monitor = bridgeService.monitorStrategy('strategy-1');
      
      // Mock the getStrategyMetrics method
      bridgeService['getStrategyMetrics'] = jest.fn().mockResolvedValue({
        executionLatency: 100,
        fillRate: 0.95,
        slippage: 0.01
      });

      monitor.on('metrics', (metrics) => {
        expect(metrics).toBeDefined();
        expect(metrics.executionLatency).toBe(100);
        monitor.emit('stop');
        done();
      });
    });
  });

  describe('stopStrategy', () => {
    beforeEach(async () => {
      // Set up a connected instance
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({
          status: 200,
          data: { version: '1.0.0', supportedStrategies: [] }
        }),
        post: jest.fn()
      };
      mockAxios.create.mockReturnValue(mockHttpClient);

      await bridgeService.connectToHummingbot('test-instance', mockConfig);
    });

    it('should successfully stop a strategy', async () => {
      const mockHttpClient = bridgeService['httpClients'].get('test-instance');
      mockHttpClient.post.mockResolvedValue({
        data: { success: true }
      });

      // Mock findStrategyInstance
      bridgeService['findStrategyInstance'] = jest.fn().mockResolvedValue('test-instance');

      const result = await bridgeService.stopStrategy('strategy-1');

      expect(result).toBe(true);
      expect(mockHttpClient.post).toHaveBeenCalledWith('/strategies/strategy-1/stop');
    });

    it('should handle stop strategy failure', async () => {
      const mockHttpClient = bridgeService['httpClients'].get('test-instance');
      mockHttpClient.post.mockResolvedValue({
        data: { success: false, error: 'Strategy not found' }
      });

      bridgeService['findStrategyInstance'] = jest.fn().mockResolvedValue('test-instance');

      await expect(bridgeService.stopStrategy('strategy-1'))
        .rejects.toThrow('Strategy not found');
    });
  });

  describe('getPerformanceMetrics', () => {
    beforeEach(async () => {
      // Set up a connected instance
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({
          status: 200,
          data: { version: '1.0.0', supportedStrategies: [] }
        })
      };
      mockAxios.create.mockReturnValue(mockHttpClient);

      await bridgeService.connectToHummingbot('test-instance', mockConfig);
    });

    it('should successfully get performance metrics', async () => {
      const mockMetrics = {
        totalTrades: 100,
        totalVolume: 50000,
        totalPnL: 1000,
        averageLatency: 150
      };

      const mockHttpClient = bridgeService['httpClients'].get('test-instance');
      mockHttpClient.get.mockResolvedValue({
        data: { success: true, data: mockMetrics }
      });

      bridgeService['findStrategyInstance'] = jest.fn().mockResolvedValue('test-instance');

      const metrics = await bridgeService.getPerformanceMetrics('strategy-1');

      expect(metrics).toEqual(mockMetrics);
      expect(mockHttpClient.get).toHaveBeenCalledWith('/strategies/strategy-1/metrics');
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      // Set up a connected instance
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({
          status: 200,
          data: { version: '1.0.0', supportedStrategies: [] }
        })
      };
      mockAxios.create.mockReturnValue(mockHttpClient);

      await bridgeService.connectToHummingbot('test-instance', mockConfig);
    });

    it('should successfully disconnect from instance', async () => {
      await bridgeService.disconnect('test-instance');

      const connection = bridgeService.getConnection('test-instance');
      expect(connection).toBeUndefined();
    });

    it('should handle disconnect from non-existent instance', async () => {
      await expect(bridgeService.disconnect('non-existent'))
        .resolves.not.toThrow();
    });
  });

  describe('getHealthStatus', () => {
    beforeEach(async () => {
      // Set up connected instances
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({
          status: 200,
          data: { version: '1.0.0', supportedStrategies: [] }
        })
      };
      mockAxios.create.mockReturnValue(mockHttpClient);

      await bridgeService.connectToHummingbot('instance-1', mockConfig);
      await bridgeService.connectToHummingbot('instance-2', mockConfig);
    });

    it('should get health status for all instances', async () => {
      // Mock detailed health check
      const mockHealthData = {
        status: 'running',
        uptime: 3600,
        cpu: 50,
        memory: 60,
        disk: 30,
        errorRate: 1,
        connections: 5,
        queueDepth: 0
      };

      const mockHttpClient1 = bridgeService['httpClients'].get('instance-1');
      const mockHttpClient2 = bridgeService['httpClients'].get('instance-2');
      
      mockHttpClient1.get.mockResolvedValue({
        data: { data: mockHealthData }
      });
      mockHttpClient2.get.mockResolvedValue({
        data: { data: mockHealthData }
      });

      const healthStatuses = await bridgeService.getHealthStatus();

      expect(healthStatuses).toHaveLength(2);
      expect(healthStatuses[0].instanceId).toBe('instance-1');
      expect(healthStatuses[1].instanceId).toBe('instance-2');
      expect(healthStatuses[0].status).toBe('running');
    });

    it('should handle health check failures', async () => {
      const mockHttpClient1 = bridgeService['httpClients'].get('instance-1');
      mockHttpClient1.get.mockRejectedValue(new Error('Health check failed'));

      const healthStatuses = await bridgeService.getHealthStatus();

      expect(healthStatuses).toHaveLength(2);
      expect(healthStatuses[0].status).toBe('unhealthy');
      expect(healthStatuses[0].healthScore).toBe(0);
    });
  });

  describe('Event Handling', () => {
    it('should emit connection established event', (done) => {
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({
          status: 200,
          data: { version: '1.0.0', supportedStrategies: [] }
        })
      };
      mockAxios.create.mockReturnValue(mockHttpClient);

      bridgeService.on('connection:established', (event) => {
        expect(event.instanceId).toBe('test-instance');
        expect(event.connection).toBeDefined();
        done();
      });

      bridgeService.connectToHummingbot('test-instance', mockConfig);
    });

    it('should emit connection failed event', (done) => {
      const mockHttpClient = {
        get: jest.fn().mockRejectedValue(new Error('Connection failed'))
      };
      mockAxios.create.mockReturnValue(mockHttpClient);

      bridgeService.on('connection:failed', (event) => {
        expect(event.instanceId).toBe('test-instance');
        expect(event.error).toBeDefined();
        done();
      });

      bridgeService.connectToHummingbot('test-instance', mockConfig).catch(() => {
        // Expected to fail
      });
    });
  });

  describe('Private Methods', () => {
    describe('buildEndpoint', () => {
      it('should build correct endpoint URL', () => {
        const instanceSettings = {
          host: 'localhost',
          port: 5000
        };

        const endpoint = bridgeService['buildEndpoint'](instanceSettings);
        expect(endpoint).toBe('http://localhost:5000/api/v1');
      });

      it('should use default values when not provided', () => {
        const instanceSettings = {};

        const endpoint = bridgeService['buildEndpoint'](instanceSettings);
        expect(endpoint).toBe('http://localhost:5000/api/v1');
      });
    });

    describe('translateStrategy', () => {
      it('should translate trading signal to Hummingbot strategy', async () => {
        const strategy = await bridgeService['translateStrategy'](mockTradingSignal);

        expect(strategy).toBeDefined();
        expect(strategy.type).toBe('pure_market_making');
        expect(strategy.tradingPair).toBe('BTC-USDT');
        expect(strategy.parameters).toBeDefined();
        expect(strategy.riskLimits).toBeDefined();
        expect(strategy.executionSettings).toBeDefined();
      });
    });

    describe('validateStrategy', () => {
      it('should validate strategy configuration', async () => {
        const strategy = await bridgeService['translateStrategy'](mockTradingSignal);
        const validation = await bridgeService['validateStrategy'](strategy);

        expect(validation).toBeDefined();
        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      });

      it('should detect validation errors', async () => {
        const invalidStrategy = {
          type: 'pure_market_making' as any,
          exchange: '', // Missing exchange
          tradingPair: '', // Missing trading pair
          parameters: {},
          riskLimits: {
            maxPositionSize: -100, // Invalid value
            maxDailyLoss: 100,
            maxOpenOrders: 10,
            maxSlippage: 0.5
          },
          executionSettings: {
            orderRefreshTime: 30,
            orderRefreshTolerance: 0.1,
            filledOrderDelay: 5,
            orderOptimization: true,
            addTransactionCosts: true,
            priceSource: 'current_market' as any
          }
        };

        const validation = await bridgeService['validateStrategy'](invalidStrategy);

        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      });
    });

    describe('calculateHealthScore', () => {
      it('should calculate health score correctly', () => {
        const healthData = {
          cpu: 50,
          memory: 60,
          disk: 30,
          errorRate: 2
        };

        const score = bridgeService['calculateHealthScore'](healthData);
        expect(score).toBe(100); // No penalties for these values
      });

      it('should penalize high resource usage', () => {
        const healthData = {
          cpu: 90, // High CPU
          memory: 85, // High memory
          disk: 95, // High disk
          errorRate: 10 // High error rate
        };

        const score = bridgeService['calculateHealthScore'](healthData);
        expect(score).toBeLessThan(100);
      });
    });
  });
});