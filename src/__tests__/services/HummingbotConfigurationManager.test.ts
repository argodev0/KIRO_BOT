/**
 * Unit tests for HummingbotConfigurationManager
 */

import { PrismaClient } from '@prisma/client';
import { HummingbotConfigurationManager } from '../../services/HummingbotConfigurationManager';
import { EncryptionService } from '../../services/EncryptionService';
import { ConfigTemplate, ConfigParams, HBConfig, StrategyParameters } from '../../types';
import e from 'express';
import e from 'express';
import { rejects } from 'assert';
import { version } from 'os';
import { mock } from 'node:test';
import { mock } from 'node:test';
import { version } from 'os';
import e from 'express';
import e from 'express';
import e from 'express';
import e from 'express';
import { rejects } from 'assert';
import { version } from 'os';
import { version } from 'os';
import e from 'express';
import e from 'express';

// Mock Prisma Client
const mockPrisma = {
  hummingbotConfiguration: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn()
  }
} as unknown as PrismaClient;

// Mock Encryption Service
const mockEncryptionService = {} as unknown as EncryptionService;

// Mock static methods
jest.mock('../../services/EncryptionService', () => ({
  EncryptionService: {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    generateEncryptionKey: jest.fn(),
    hash: jest.fn(),
    verifyHash: jest.fn(),
    generateSecureToken: jest.fn(),
    encryptApiKey: jest.fn(),
    decryptApiKey: jest.fn(),
    encryptApiKeys: jest.fn(),
    decryptApiKeys: jest.fn()
  }
}));

describe('HummingbotConfigurationManager', () => {
  let configManager: HummingbotConfigurationManager;
  let mockTemplate: ConfigTemplate;
  let mockParams: ConfigParams;

  // Helper function to create mock strategy parameters
  const createMockStrategyParameters = (overrides: Partial<StrategyParameters> = {}): StrategyParameters => ({
    bidSpread: 0.1,
    askSpread: 0.1,
    orderAmount: 100,
    orderLevels: 1,
    orderRefreshTime: 30,
    maxOrderAge: 1800,
    inventorySkewEnabled: false,
    inventoryTargetBasePercent: 50,
    inventoryRangeMultiplier: 1.0,
    hangingOrdersEnabled: false,
    hangingOrdersCancelPct: 10,
    orderOptimizationEnabled: false,
    askOrderOptimizationDepth: 0,
    bidOrderOptimizationDepth: 0,
    addTransactionCosts: false,
    priceType: 'mid_price' as const,
    takeLiquidity: false,
    priceSource: 'current_market',
    priceBandEnabled: false,
    priceCeilingPct: 100,
    priceFloorPct: -100,
    pingPongEnabled: false,
    orderRefreshTolerance: 0.2,
    filledOrderDelay: 60,
    jumpOrdersEnabled: false,
    jumpOrdersDepth: 0,
    jumpOrdersDelay: 10,
    ...overrides
  });

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create configuration manager
    configManager = new HummingbotConfigurationManager(
      mockPrisma,
      mockEncryptionService,
      {
        encryptSensitiveData: true,
        validateOnSave: true,
        enableVersioning: true,
        maxVersionsPerConfig: 5,
        enableTemplates: true
      }
    );

    // Mock template
    mockTemplate = {
      id: 'pure_market_making',
      name: 'Pure Market Making',
      description: 'Basic market making strategy',
      category: 'market_making',
      strategyType: 'pure_market_making',
      defaultParameters: {
        bidSpread: 0.1,
        askSpread: 0.1,
        orderAmount: 100,
        orderLevels: 1
      },
      requiredParameters: ['bidSpread', 'askSpread', 'orderAmount'],
      optionalParameters: ['orderLevels'],
      riskProfile: 'moderate',
      suitableMarkets: ['BTC-USDT', 'ETH-USDT'],
      minimumCapital: 1000,
      tags: ['market_making', 'basic']
    };

    // Mock parameters
    mockParams = {
      templateId: 'pure_market_making',
      customParameters: {
        bidSpread: 0.15,
        askSpread: 0.15,
        orderAmount: 200
      }
    };

    // Mock encryption service static methods
    (EncryptionService.encrypt as jest.Mock).mockImplementation((value) => ({
      encryptedData: `encrypted_${value}`,
      iv: 'mock_iv',
      tag: 'mock_tag'
    }));
    (EncryptionService.decrypt as jest.Mock).mockImplementation((encryptedData) => 
      encryptedData.encryptedData.replace('encrypted_', '')
    );
  });

  afterEach(() => {
    configManager.removeAllListeners();
  });

  describe('createConfiguration', () => {
    it('should create configuration successfully', async () => {
      const mockSavedConfig = {
        id: 'config-1',
        userId: 'user-1',
        name: 'Pure Market Making_1234567890',
        configData: {},
        version: '1.0.0'
      };

      (mockPrisma.hummingbotConfiguration.create as jest.Mock).mockResolvedValue(mockSavedConfig);

      const config = await configManager.createConfiguration('user-1', mockTemplate, mockParams);

      expect(config).toBeDefined();
      expect(config.version).toBe('1.0.0');
      expect(config.instanceSettings).toBeDefined();
      expect(config.strategyConfigs).toBeDefined();
      expect(config.exchangeSettings).toBeDefined();
      expect(config.riskSettings).toBeDefined();

      expect(mockPrisma.hummingbotConfiguration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          configType: 'instance',
          version: '1.0.0',
          isActive: true
        })
      });
    });

    it('should merge template parameters with custom parameters', async () => {
      const mockSavedConfig = {
        id: 'config-1',
        userId: 'user-1',
        configData: {}
      };

      (mockPrisma.hummingbotConfiguration.create as jest.Mock).mockResolvedValue(mockSavedConfig);

      const config = await configManager.createConfiguration('user-1', mockTemplate, mockParams);

      const strategyConfig = config.strategyConfigs[0];
      expect(strategyConfig.parameters.bidSpread).toBe(0.15); // Custom value
      expect(strategyConfig.parameters.askSpread).toBe(0.15); // Custom value
      expect(strategyConfig.parameters.orderAmount).toBe(200); // Custom value
      expect(strategyConfig.parameters.orderLevels).toBe(1); // Default value
    });

    it('should encrypt sensitive data when enabled', async () => {
      const mockSavedConfig = {
        id: 'config-1',
        userId: 'user-1',
        configData: {}
      };

      (mockPrisma.hummingbotConfiguration.create as jest.Mock).mockResolvedValue(mockSavedConfig);

      await configManager.createConfiguration('user-1', mockTemplate, mockParams);

      expect(EncryptionService.encrypt).toHaveBeenCalled();
    });

    it('should validate configuration when enabled', async () => {
      const mockSavedConfig = {
        id: 'config-1',
        userId: 'user-1',
        configData: {}
      };

      (mockPrisma.hummingbotConfiguration.create as jest.Mock).mockResolvedValue(mockSavedConfig);

      // This should not throw since the configuration is valid
      await expect(configManager.createConfiguration('user-1', mockTemplate, mockParams))
        .resolves.toBeDefined();
    });

    it('should handle validation errors', async () => {
      const invalidParams = {
        templateId: 'pure_market_making',
        customParameters: {
          bidSpread: -0.1, // Invalid negative spread
          askSpread: 0.1,
          orderAmount: 100
        }
      };

      await expect(configManager.createConfiguration('user-1', mockTemplate, invalidParams))
        .rejects.toThrow('Configuration validation failed');
    });

    it('should emit configuration created event', (done) => {
      const mockSavedConfig = {
        id: 'config-1',
        userId: 'user-1',
        configData: {}
      };

      (mockPrisma.hummingbotConfiguration.create as jest.Mock).mockResolvedValue(mockSavedConfig);

      configManager.on('configuration:created', (event) => {
        expect(event.configId).toBe('config-1');
        expect(event.userId).toBe('user-1');
        expect(event.template).toBe('Pure Market Making');
        done();
      });

      configManager.createConfiguration('user-1', mockTemplate, mockParams);
    });
  });

  describe('loadConfiguration', () => {
    it('should load configuration successfully', async () => {
      const mockConfig: HBConfig = {
        version: '1.0.0',
        instanceSettings: {
          instanceId: 'test-instance',
          name: 'Test Instance',
          dockerImage: 'hummingbot/hummingbot',
          dockerTag: 'latest',
          resources: { memory: '1Gi', cpu: '0.5', storage: '2Gi' },
          networking: { port: 5000, exposedPorts: [5000], networkMode: 'bridge' },
          environment: {}
        },
        strategyConfigs: [],
        exchangeSettings: { exchanges: [], defaultExchange: 'binance' },
        riskSettings: {
          globalRiskEnabled: true,
          maxTotalExposure: 10000,
          maxDailyLoss: 1000,
          maxDrawdown: 20,
          emergencyStopEnabled: true,
          emergencyStopLoss: 5
        }
      };

      const mockDbConfig = {
        id: 'config-1',
        userId: 'user-1',
        configData: mockConfig
      };

      (mockPrisma.hummingbotConfiguration.findUnique as jest.Mock).mockResolvedValue(mockDbConfig);

      const config = await configManager.loadConfiguration('config-1');

      expect(config).toEqual(mockConfig);
      expect(mockPrisma.hummingbotConfiguration.findUnique).toHaveBeenCalledWith({
        where: { id: 'config-1' }
      });
    });

    it('should decrypt sensitive data when enabled', async () => {
      const mockDbConfig = {
        id: 'config-1',
        userId: 'user-1',
        configData: {
          exchangeSettings: {
            exchanges: [{
              apiKey: JSON.stringify({ encr' }),
              apiSecret: JSON.stringify({ encryp})
            }]
          }
        }
      };

      (mockPrisma.hummingbotConfiguration.findUnique as jest.Mock).mockResolvedValue(mockDbConfig);

      await configManager.loadConfiguration('config-1');

      expect(EncryptionService.decrypt).toHaveBeenCalled();
    });

    it('should handle configuration not found', async () => {
      (mockPrisma.hummingbotConfiguration.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(configManager.loadConfiguration('non-existent'))
        .rejects.toThrow('Configuration not found: non-existent');
    });

    it('should emit configuration loaded event', (done) => {
      const mockDbConfig = {
        id: 'config-1',
        userId: 'user-1',
        configData: {}
      };

      (mockPrisma.hummingbotConfiguration.findUnique as jest.Mock).mockResolvedValue(mockDbConfig);

      configManager.on('configuration:loaded', (event) => {
        expect(event.configId).toBe('config-1');
        expect(event.userId).toBe('user-1');
        done();
      });

      configManager.loadConfiguration('config-1');
    });
  });

  describe('saveConfiguration', () => {
    const mockConfig: HBConfig = {
      version: '1.0.0',
      instanceSettings: {
        instanceId: 'test-instance',
        name: 'Test Instance',
        dockerImage: 'hummingbot/hummingbot',
        dockerTag: 'latest',
        resources: { memory: '1Gi', cpu: '0.5', storage: '2Gi' },
        networking: { port: 5000, exposedPorts: [5000], networkMode: 'bridge' },
        environment: {}
      },
      strategyConfigs: [{
        strategyName: 'test-strategy',
        enabled: true,
        parameters: createMockStrategyParameters(),
        markets: [{
          exchange: 'binance',
          tradingPair: 'BTC-USDT',
          baseAsset: 'BTC',
          quoteAsset: 'USDT'
        }],
        riskManagement: {
          killSwitchEnabled: true,
          killSwitchRate: -100,
          maxOrderAge: 1800,
          maxOrderRefreshTime: 30,
          orderRefreshTolerance: 0.2,
          inventorySkewEnabled: false,
          inventoryTargetBasePercent: 50,
          inventoryRangeMultiplier: 1.0
        }
      }],
      exchangeSettings: {
        exchanges: [{
          name: 'binance',
          apiKey: 'test-key',
          apiSecret: 'test-secret',
          sandbox: true,
          rateLimit: 1200,
          testnet: false
        }],
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

    it('should save configuration successfully', async () => {
      const mockUpdatedConfig = {
        id: 'config-1',
        userId: 'user-1'
      };

      (mockPrisma.hummingbotConfiguration.update as jest.Mock).mockResolvedValue(mockUpdatedConfig);

      const configId = await configManager.saveConfiguration('config-1', mockConfig);

      expect(configId).toBe('config-1');
      expect(mockPrisma.hummingbotConfiguration.update).toHaveBeenCalledWith({
        where: { id: 'config-1' },
        data: expect.objectContaining({
          configData: expect.any(Object),
          updatedAt: expect.any(Date)
        })
      });
    });

    it('should validate configuration before saving', async () => {
      const invalidConfig = {
        ...mockConfig,
        instanceSettings: {
          ...mockConfig.instanceSettings,
          instanceId: '' // Invalid empty instance ID
        }
      };

      await expect(configManager.saveConfiguration('config-1', invalidConfig))
        .rejects.toThrow('Configuration validation failed');
    });

    it('should create version backup when versioning is enabled', async () => {
      const mockUpdatedConfig = {
        id: 'config-1',
        userId: 'user-1'
      };

      (mockPrisma.hummingbotConfiguration.update as jest.Mock).mockResolvedValue(mockUpdatedConfig);
      (mockPrisma.hummingbotConfiguration.findUnique as jest.Mock).mockResolvedValue({
        id: 'config-1',
        userId: 'user-1',
        name: 'Test Config',
        configData: mockConfig
      });
      (mockPrisma.hummingbotConfiguration.create as jest.Mock).mockResolvedValue({});
      (mockPrisma.hummingbotConfiguration.findMany as jest.Mock).mockResolvedValue([]);

      await configManager.saveConfiguration('config-1', mockConfig);

      expect(mockPrisma.hummingbotConfiguration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          parentId: 'config-1',
          isActive: false
        })
      });
    });
  });

  describe('validateConfiguration', () => {
    const validConfig: HBConfig = {
      version: '1.0.0',
      instanceSettings: {
        instanceId: 'test-instance',
        name: 'Test Instance',
        dockerImage: 'hummingbot/hummingbot',
        dockerTag: 'latest',
        resources: { memory: '1Gi', cpu: '0.5', storage: '2Gi' },
        networking: { port: 5000, exposedPorts: [5000], networkMode: 'bridge' },
        environment: {}
      },
      strategyConfigs: [{
        strategyName: 'test-strategy',
        enabled: true,
        parameters: createMockStrategyParameters(),
        markets: [{
          exchange: 'binance',
          tradingPair: 'BTC-USDT',
          baseAsset: 'BTC',
          quoteAsset: 'USDT'
        }],
        riskManagement: {
          killSwitchEnabled: true,
          killSwitchRate: -100,
          maxOrderAge: 1800,
          maxOrderRefreshTime: 30,
          orderRefreshTolerance: 0.2,
          inventorySkewEnabled: false,
          inventoryTargetBasePercent: 50,
          inventoryRangeMultiplier: 1.0
        }
      }],
      exchangeSettings: {
        exchanges: [{
          name: 'binance',
          apiKey: 'test-key',
          apiSecret: 'test-secret',
          sandbox: true,
          rateLimit: 1200,
          testnet: false
        }],
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

    it('should validate valid configuration', async () => {
      const validation = await configManager.validateConfiguration(validConfig);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing instance settings', async () => {
      const invalidConfig = {
        ...validConfig,
        instanceSettings: undefined as any
      };

      const validation = await configManager.validateConfiguration(invalidConfig);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.field === 'instanceSettings')).toBe(true);
    });

    it('should detect invalid resource formats', async () => {
      const invalidConfig = {
        ...validConfig,
        instanceSettings: {
          ...validConfig.instanceSettings,
          resources: {
            memory: 'invalid-format',
            cpu: 'invalid-cpu',
            storage: '2Gi'
          }
        }
      };

      const validation = await configManager.validateConfiguration(invalidConfig);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.field === 'resources.memory')).toBe(true);
      expect(validation.errors.some(e => e.field === 'resources.cpu')).toBe(true);
    });

    it('should detect invalid strategy parameters', async () => {
      const invalidConfig = {
        ...validConfig,
        strategyConfigs: [{
          ...validConfig.strategyConfigs[0],
          parameters: c({
            bidSpread: -0.1, // Invalid negative spread
            askSpread: -0.1  // Invalid negative spread
          })
        }]
      };

ig);

se);
      expect(validation.errors.some(e => e.fi);
      expect(validation.errors.some(e => e.field === 'parameters.askSpread')).toBe(true);
    });


      const invalidConfig = {
        ...validConfig,
        exchangeSettingny
      };

);

Be(false);
      expect(validation.errors.some(e => e.fi
    });

{
      const invalidConfig = {
        ...validConfig,
        riskSettings: {
          ...validConfigs,
          maxTotalExposure: -1000, //  value
          maxDailyLoss: -100, // Invalid negative value
          maxDrawdown: 150 // Invalid value > 100
        }
      };

);

);
      expect(validation.errors.some(e => e.fi;
      expect(validation.errors.some(e => e.field === 'maxDailyLoss')).toBe(true);
      expect(validation.errors.some(e => e.field === 'maxDrawdown')).toBe(true);
    });


      const riskyConfig = {
        ...validConfig,
        riskSettings: {
          ...validConfi
          maxDrawdown: 60 // High drawown
        }
      };

fig);

rue);
    });
  });

 () => {
    it('should return default templates',=> {
      const templates = configManager.getConfigurs();


      expect(templates.some(t => t.id === 'pure_ma;
      expect(templates.some(t => t.id === 'grid_trading')).toBe(true);
      expect(templates.some(t => t.id === 'arbitrage')).toBe(true);
    });


      const customTemplate: ConfigTemplate = {
        id: 'custom_strategy',
        name: 'Custom Strategy',
        description: 'Custom tra
        category: 'custom',
        strategyType: 'pure
        defaultParameters: {},
        requiredParameters: [],
        optionalParameters: [],
        riskProfile: 'moderate',
        suitableMarkets: [],
        minimumCapital: 1000,
        tags: ['custom']
      };

);

);
      expect(templates.some(t => t.id === 'custom_strategy')).toBe);
    });

 {
      const customTemplate: ConfigTempla
        id: 'removable_strategy',
        name: 'Removable Strategy',
        description: 'Strategy to bd',
        category: 'custom',
        strategyType: 'pure
        defaultParameters: {},
        requiredParameters: [],
        optionalParameters: [],
        riskProfile: 'moderate'
        suitableMarkets: [],
        minimumCapital: 1000,
        tags: ['removable']
      };


      const removed = configManager.removeConfigurationTemplagy');

;

es();
      expect(templates.some(t => t.id === 'removable_strategy')).t;
    });

one) => {
      const customTemplate: ConfigTemplate = {
        id: 'event_strategy',
        name: 'Event Strategy',
        description: 'Strategy 
        category: 'custom',
        strategyType: 'pureg',
        defaultParameters: {},
        requiredParameters: [],
        optionalParameters: [],
        riskProfile: 'moderate'
        suitableMarkets: [],
        minimumCapital: 1000
        tags: ['event']
      };


        expect(event.templateId).toBe('event_strategy');
        expect(event.name).toBe('Event Strategy');
        done();
      });

e);
    });
  });

 {
    it('should get user configurations', as{
      const mockConfigs = [
        { id: 'config-1', ne() },
        { id: 'config-2', name: 'Config 2', updatedAt: new Date() }
      ];

Configs);



figs);
      expect(mockPrisma.hummingbotConfigura({
        where: { userId: 'user-1', isActive: true },
        orderBy: { updatedAt: 'desc' }
      });
    });
  });

=> {
    it('should soft delete configuration' {
      (mockPrisma.hummingbotConfiguration.update as jest

-1');


      expect(mockPrisma.hummingbth({
        where: { id: 'config-1' },
        data: { isActive: false }
      });
    });


      (mockPrisma.hummingbotConfiguration.update as ));




    });

 {
      (mockPrisma.hummingbotConfiguration.updatlue({});


        expect(event.configId).toBe('config-1');
        done();
      });


    });
  });

=> {
    describe('backupConfiguration', () => {
      it('should create configuration backu
        const mockConfig = {
          id: 'config-1',
          userId: 'user-1
          name: 'Test Confi
          configData: { versio
        };

 {
          id: 'backup-1',
          name: 'Test Con
        };

onfig);
        (mockPrisma.hummingbotConfiguration.create as jest.Mock).mockResolvedValue(mockBackup);

fig-1');

');
        expect(mockPrisma.hummingbotConfig({
          data: expect.objectContaining({
            userId: 'user-1',
            configType: 'backup',
            parentId: 'config-1',
            isActive: false
          })
        });
      });


        const mockConfig = {
          id: 'config-1',
          userId: 'user-1',
          name: 'Test Confi,
          configData: { versio' }
        };

Backup = {
          id: 'backup-1',
          name: 'Custom Bp Name'
        };

fig);
        (mockPrisma.hummingbotConfiguration.create as jest.Mock).mockResolvedValue(mockBackup);

');

{
          data: expect.objectContaining({
            name: 'Custom Backup Name'
          })
        });
      });

{
        (mockPrisma.hummingbotConfiguration.findUnique;

nt'))
          .rejects.toThrow('Configuration not found: non-existent');
      });
    });

, () => {
      it('should restore configuration from => {
        const mockBackup = {
          id: 'backup-1',
          parentId: 'confg-1',
          configData: { version{} }
        };

g = {
          id: 'config-1',
          userId: 'user-1
        };

)
          .mockResolvedValueOnce(mockBackup) // For backup lookup
          .mockResolvedValueOnce({ id: 'config-1', userId: 'user-backup


        (mockPrisma.hummingbotConfiguration.update as jest.Mock).mockResolvedValue(mock
        (mockPrisma.hummingbotConfiguration.findMany as jest.Mock).mockResolvedValue([]);

-1');

ta);
        expect(mockPrisma.hummingbotConfiguration.update).toHa{
          where: { id: 'config-1' },
          data: expect.objectContain
            configData: mockBackup.config
          })
        });
      });

=> {
        (mockPrisma.hummingbotConfiguration.findUnique

'))
          .rejects.toThrow('Backup not found: invalid-backup');
      });

) => {
        const mockBackup = {
          id: 'backup-1',
          parentId: 'othe
          configData: {}
        };

kBackup);

-1'))
          .rejects.toThrow('Backup backup-1 is not associated with configuration');
      });
    });

> {
      it('should list configuration backups', as
        const mockBackups = [
          { id: 'backup-1', n
          { id: 'backup-2', name: 'Backup 2', version: '1.1.0', createdAt: new Date() }
        ];

ps);

);


        expect(mockPrisma.hummingbotConfigura{
          where: { parentId: 'config-1', configType: 'backup' },
          orderBy: { createdAt: 'desc' },
          select: expect.objectContaining({
            id: true,
            name: true,
            version: tr
          })
        });
      });
    });
  });

 {
    describe('exportConfiguration', () => {
      it('should export configuration', asyc () => {
        const mockConfig = {
          version: '1.0.0',
          instanceSettings:},
          strategyConfigs: [],
          exchangeSettings: {  },
          riskSettings: { globalRiskEnabled: true }
        };

 {
          id: 'config-1',
          name: 'Test Conig',
          version: '1.0.0'
        };

lue({
          ...mockDbConfig,
          configData: mockig
        });

);


        expect(exportData.metadata).toMatchObject({
          originalId: 'config-1',
          originalName: 'Test Config',
          originalVersion: '1.0.0'
        });
      });
    });


      it('should import configuration', asy{
        const mockConfig = {
          version: '1.0.0',
          instanceSettings:,
          strategyConfigs: [],
          exchangeSettings: { nce' },
          riskSettings: { globalRiskEnabled: true, maxTotalExposure: 1000, }
        };

= {
          config: mockConfig
          metadata: {
            originalI,
            originalName: 'Original Config',
            exportedAt: new Date().toISOString()
          }
        };


          id: 'imported-config-1',
          name: 'Imported Config'
        };





g-1');
        expect(mockPrisma.hummingbotConfiguration.cre({
          data: expect.objectContaining({
            userId: 'user-1',
            configType: 'instce',
            configData: mockConfig,
            isActive: true
          })
        });
      });

=> {
        const invalidExportData = {
          config: null,
          metadata: {}
        };

y))
          .rejects.toThrow('Invalid import data format');
      });
    });
  });

 {
    it('should clone configuration', asy {
      const mockConfig = {
        version: '1.0.0',
        instanceSettings:},
        strategyConfigs: [],
        exchangeSettings: { e' },
        riskSettings: { globalRiskEnabled: true, maxTotalExposure: 1000, 5 }
      };

{
        id: 'config-1',
        userId: 'user-1',
        name: 'Original Cig'
      };


        id: 'clone-1',
        name: 'Cloned ig'
      };

t.Mock)
        .mockResolvedValueOnce({ ...mockOriginalConfig, configData)
        .mockResolvedValueOnce(mockOriginalConfig);



Config');


      expect(mockPrisma.hummingbotConf{
        data: expect.objectContaining({
          userId: 'user-1',
          name: 'Cloned Con
          configType: 'instance',
          isActive: true
        })
      });
    });
  });

) => {
    describe('version compatibility checks', () => {
      it('should identify compatible versions', asyn{
        const mockConfig = {
          version: '1.5.0',
          instanceSettings:
          strategyConfigs: [],
          exchangeSettings: {  },
          riskSettings: { globalRiskEnabled: true, maxTotalExposure: 1000,: 5 }
        };

);
        expect(validation.warnings.some(w => w.code === 'VERSION_MISMATCH')).toBe;
      });

 {
        const mockConfig = {
          version: '0.9.0',
          instanceSettings:
          strategyConfigs: [],
          exchangeSettings: {  },
          riskSettings: { globalRiskEnabled: true, maxTotalExposure: 1000,oss: 5 }
        };

fig);
        expect(validation.warnings.some(w => w.message.includes('deprecated'))).te);
      });

{
        const mockConfig = {
          version: '0.5.0',
          instanceSettings:},
          strategyConfigs: [],
          exchangeSettings: { 
          riskSettings: { globalRiskEnabled: true, maxTotalExposure: 1000,
        };

;
        expect(validation.warnings.some(w => w.message.includes('no longer suppor;
      });
    });


      it('should migrate configuration to ne> {
        const oldConfig = {
          version: '1.0.0',
          instanceSettings: {} },
          strategyConfigs: [{
            strategyName: 'te
            enabled: true,
            parameters: cr(),
            markets: [{ exchange: 'binance', tradingPair: 'BTC-USDT', baseAss
            riskManagement: {
              killSwitchEnabld: true,
              killSwitchRate: -100,
              maxOrderAge: 1800,
              maxOrderRefreshTime: 30,
              orderRefreshTolerance: 0
              inventorySkewEnabled: false,
              inventoryTargetBasePercent: 50,
              inventoryRangeMultiplier: 1.0
            }
          }],
          exc },
          riskSettings: { globalRiskEnabled: true, maxTotalExposure: 1000,Loss: 5 }
        };


          .mockResolvedValueOnce({ id: 'config-1', configData: oldCo
          .mockResolvedValueOnce({ id: 'config-1', userId: 'user-1', name: 

);
        (mockPrisma.hummingbotConfiguration.update as jest.Mock).mockResolvedValue({ us);
        (mockPrisma.hummingbotConfiguration.findMany as jest.Mock).mockResolvedValue([]);

0.0');

0');
        expect(migratedConfig.riskSettings.emergencySrue);
        expect(migratedConfig.instanceSettings.environment.HUMMINGBOT_GATEWA;
      });
    });
  });

 {
    it('should validate template with all required> {
      const validTemplate: ConfigTemplate = {
        id: 'valid_template',
        name: 'Valid Template
        description: 'A valid t
        category: 'market_making',
        strategyType: 'pure_market,
        defaultParameters: { bidSpread: 0.1
        requiredParameters: ['bidSpread', 'askSpread', 'orderAmount'],
        optionalParameters: ['orderLevels'],
        riskProfile: 'moderate',
        suitableMarkets: ['BTC-UDT'],
        minimumCapital: 1000,
        tags: ['test']
      };

hrow();
    });


      const invalidTemplate: ConfigTemplate = {
        id: 'invalid_template',
        name: 'Invalid Template
        description: 'An invalid ate',
        category: 'market_making',
        strategyType: 'invalid_str as any,
        defaultParameters: {},
        requiredParameters: []
        optionalParameters: [],
        riskProfile: 'moderate'
        suitableMarkets: [],
        minimumCapital: 1000,
        tags: []
      };

e))
        .toThrow('Strategy type \'invalid_strategy\' is not supported by Hu;
    });

{
      const invalidTemplate: ConfigTemplate = {
        id: 'negative_template',
        name: 'Negative Template',
        description: 'Template wit
        category: 'market_making',
        strategyType: 'pure_market_making',
        defaultParameters: { bidSpread: -0. 0.1 },
        requiredParameters: [],
        optionalParameters: [],
        riskProfile: 'moderate',
        suitableMarkets: [],
        minimumCapital: 1000,
        tags: []
      };

))
        .toThrow('Default parameter \'bidSpread\' cannot be negative');
    });
  });
});