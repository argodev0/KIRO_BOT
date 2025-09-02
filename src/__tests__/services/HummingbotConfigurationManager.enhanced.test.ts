/**
 * Enhanced tests for HummingbotConfigurationManager
 * Tests for new backup, restore, import/export, and validation features
 */

import { PrismaClient } from '@prisma/client';
import { HummingbotConfigurationManager } from '../../services/HummingbotConfigurationManager';
import { EncryptionService } from '../../services/EncryptionService';
import { ConfigTemplate, ConfigParams, HBConfig } from '../../types';

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

describe('HummingbotConfigurationManager - Enhanced Features', () => {
  let configManager: HummingbotConfigurationManager;

  // Helper function to create valid mock configuration
  const createValidMockConfig = (overrides: any = {}) => ({
    version: '1.0.0',
    instanceSettings: {
      instanceId: 'test',
      name: 'Test',
      dockerImage: 'test',
      dockerTag: 'latest',
      resources: { memory: '1Gi', cpu: '0.5', storage: '2Gi' },
      networking: { port: 5000, exposedPorts: [5000], networkMode: 'bridge' as const },
      environment: {}
    },
    strategyConfigs: [],
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
      maxTotalExposure: 1000,
      maxDailyLoss: 100,
      maxDrawdown: 10,
      emergencyStopEnabled: true,
      emergencyStopLoss: 5
    },
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();

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

  describe('Backup and Restore Functionality', () => {
    describe('backupConfiguration', () => {
      it('should create configuration backup successfully', async () => {
        const mockConfig = {
          id: 'config-1',
          userId: 'user-1',
          name: 'Test Config',
          configData: { version: '1.0.0' }
        };

        const mockBackup = {
          id: 'backup-1',
          name: 'Test Config_backup_1234567890'
        };

        (mockPrisma.hummingbotConfiguration.findUnique as jest.Mock).mockResolvedValue(mockConfig);
        (mockPrisma.hummingbotConfiguration.create as jest.Mock).mockResolvedValue(mockBackup);

        const backupId = await configManager.backupConfiguration('config-1');

        expect(backupId).toBe('backup-1');
        expect(mockPrisma.hummingbotConfiguration.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            userId: 'user-1',
            configType: 'backup',
            parentId: 'config-1',
            isActive: false
          })
        });
      });

      it('should create backup with custom name', async () => {
        const mockConfig = {
          id: 'config-1',
          userId: 'user-1',
          name: 'Test Config',
          configData: { version: '1.0.0' }
        };

        const mockBackup = {
          id: 'backup-1',
          name: 'Custom Backup Name'
        };

        (mockPrisma.hummingbotConfiguration.findUnique as jest.Mock).mockResolvedValue(mockConfig);
        (mockPrisma.hummingbotConfiguration.create as jest.Mock).mockResolvedValue(mockBackup);

        await configManager.backupConfiguration('config-1', 'Custom Backup Name');

        expect(mockPrisma.hummingbotConfiguration.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            name: 'Custom Backup Name'
          })
        });
      });

      it('should handle backup failure for non-existent config', async () => {
        (mockPrisma.hummingbotConfiguration.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(configManager.backupConfiguration('non-existent'))
          .rejects.toThrow('Configuration not found: non-existent');
      });

      it('should emit backup created event', (done) => {
        const mockConfig = {
          id: 'config-1',
          userId: 'user-1',
          name: 'Test Config',
          configData: { version: '1.0.0' }
        };

        const mockBackup = {
          id: 'backup-1',
          name: 'Test Config_backup_1234567890'
        };

        (mockPrisma.hummingbotConfiguration.findUnique as jest.Mock).mockResolvedValue(mockConfig);
        (mockPrisma.hummingbotConfiguration.create as jest.Mock).mockResolvedValue(mockBackup);

        configManager.on('configuration:backup_created', (event) => {
          expect(event.configId).toBe('config-1');
          expect(event.backupId).toBe('backup-1');
          done();
        });

        configManager.backupConfiguration('config-1');
      });
    });

    describe('restoreConfiguration', () => {
      it('should restore configuration from backup', async () => {
        const mockBackup = {
          id: 'backup-1',
          parentId: 'config-1',
          configData: createValidMockConfig()
        };

        const mockUpdatedConfig = {
          id: 'config-1',
          userId: 'user-1'
        };

        (mockPrisma.hummingbotConfiguration.findUnique as jest.Mock)
          .mockResolvedValueOnce(mockBackup) // For backup lookup
          .mockResolvedValueOnce({ id: 'config-1', userId: 'user-1', configData: {} }); // For version backup

        (mockPrisma.hummingbotConfiguration.create as jest.Mock).mockResolvedValue({});
        (mockPrisma.hummingbotConfiguration.update as jest.Mock).mockResolvedValue(mockUpdatedConfig);
        (mockPrisma.hummingbotConfiguration.findMany as jest.Mock).mockResolvedValue([]);

        const restoredConfig = await configManager.restoreConfiguration('config-1', 'backup-1');

        expect(restoredConfig).toEqual(mockBackup.configData);
        expect(mockPrisma.hummingbotConfiguration.update).toHaveBeenCalledWith({
          where: { id: 'config-1' },
          data: expect.objectContaining({
            configData: expect.any(Object),
            updatedAt: expect.any(Date)
          })
        });
      });

      it('should handle invalid backup', async () => {
        (mockPrisma.hummingbotConfiguration.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(configManager.restoreConfiguration('config-1', 'invalid-backup'))
          .rejects.toThrow('Backup not found: invalid-backup');
      });

      it('should handle mismatched backup', async () => {
        const mockBackup = {
          id: 'backup-1',
          parentId: 'other-config',
          configData: {}
        };

        (mockPrisma.hummingbotConfiguration.findUnique as jest.Mock).mockResolvedValue(mockBackup);

        await expect(configManager.restoreConfiguration('config-1', 'backup-1'))
          .rejects.toThrow('Backup backup-1 is not associated with configuration config-1');
      });
    });

    describe('listConfigurationBackups', () => {
      it('should list configuration backups', async () => {
        const mockBackups = [
          { id: 'backup-1', name: 'Backup 1', version: '1.0.0', createdAt: new Date() },
          { id: 'backup-2', name: 'Backup 2', version: '1.1.0', createdAt: new Date() }
        ];

        (mockPrisma.hummingbotConfiguration.findMany as jest.Mock).mockResolvedValue(mockBackups);

        const backups = await configManager.listConfigurationBackups('config-1');

        expect(backups).toEqual(mockBackups);
        expect(mockPrisma.hummingbotConfiguration.findMany).toHaveBeenCalledWith({
          where: { parentId: 'config-1', configType: 'backup' },
          orderBy: { createdAt: 'desc' },
          select: expect.objectContaining({
            id: true,
            name: true,
            version: true
          })
        });
      });
    });
  });

  describe('Import and Export Functionality', () => {
    describe('exportConfiguration', () => {
      it('should export configuration with metadata', async () => {
        const mockConfig = createValidMockConfig();

        const mockDbConfig = {
          id: 'config-1',
          name: 'Test Config',
          version: '1.0.0'
        };

        (mockPrisma.hummingbotConfiguration.findUnique as jest.Mock).mockResolvedValue({
          ...mockDbConfig,
          configData: mockConfig
        });

        const exportData = await configManager.exportConfiguration('config-1');

        expect(exportData.config).toEqual(mockConfig);
        expect(exportData.metadata).toMatchObject({
          originalId: 'config-1',
          originalName: 'Test Config',
          originalVersion: '1.0.0',
          exportVersion: '1.0.0'
        });
        expect(exportData.metadata.exportedAt).toBeDefined();
      });

      it('should handle export of non-existent configuration', async () => {
        (mockPrisma.hummingbotConfiguration.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(configManager.exportConfiguration('non-existent'))
          .rejects.toThrow('Configuration not found: non-existent');
      });
    });

    describe('importConfiguration', () => {
      it('should import configuration successfully', async () => {
        const mockConfig = createValidMockConfig();

        const exportData = {
          config: mockConfig,
          metadata: {
            originalId: 'original-config',
            originalName: 'Original Config',
            exportedAt: new Date().toISOString()
          }
        };

        const mockImportedConfig = {
          id: 'imported-config-1',
          name: 'Imported Config'
        };

        (mockPrisma.hummingbotConfiguration.create as jest.Mock).mockResolvedValue(mockImportedConfig);

        const importedId = await configManager.importConfiguration('user-1', exportData);

        expect(importedId).toBe('imported-config-1');
        expect(mockPrisma.hummingbotConfiguration.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            userId: 'user-1',
            configType: 'instance',
            configData: mockConfig,
            isActive: true
          })
        });
      });

      it('should handle invalid import data', async () => {
        const invalidExportData = {
          config: null,
          metadata: {}
        };

        await expect(configManager.importConfiguration('user-1', invalidExportData as any))
          .rejects.toThrow('Invalid import data format');
      });

      it('should validate imported configuration', async () => {
        const invalidConfig = createValidMockConfig({
          instanceSettings: undefined // Invalid - missing required field
        });

        const exportData = {
          config: invalidConfig,
          metadata: {
            originalId: 'original-config',
            originalName: 'Original Config',
            exportedAt: new Date().toISOString()
          }
        };

        await expect(configManager.importConfiguration('user-1', exportData as any))
          .rejects.toThrow('Imported configuration is invalid');
      });
    });
  });

  describe('Configuration Cloning', () => {
    it('should clone configuration with new instance ID', async () => {
      const mockConfig = createValidMockConfig({
        instanceSettings: {
          instanceId: 'original-instance',
          name: 'Original Instance',
          dockerImage: 'test',
          dockerTag: 'latest',
          resources: { memory: '1Gi', cpu: '0.5', storage: '2Gi' },
          networking: { port: 5000, exposedPorts: [5000], networkMode: 'bridge' as const },
          environment: {}
        }
      });

      const mockOriginalConfig = {
        id: 'config-1',
        userId: 'user-1',
        name: 'Original Config'
      };

      const mockCloneRecord = {
        id: 'clone-1',
        name: 'Cloned Config'
      };

      (mockPrisma.hummingbotConfiguration.findUnique as jest.Mock)
        .mockResolvedValueOnce({ ...mockOriginalConfig, configData: mockConfig })
        .mockResolvedValueOnce(mockOriginalConfig);

      (mockPrisma.hummingbotConfiguration.create as jest.Mock).mockResolvedValue(mockCloneRecord);

      const cloneId = await configManager.cloneConfiguration('config-1', 'Cloned Config');

      expect(cloneId).toBe('clone-1');
      expect(mockPrisma.hummingbotConfiguration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          name: 'Cloned Config',
          configType: 'instance',
          isActive: true
        })
      });
    });

    it('should generate unique instance ID for clone', async () => {
      const mockConfig = createValidMockConfig({
        instanceSettings: {
          instanceId: 'original-instance',
          name: 'Original Instance',
          dockerImage: 'test',
          dockerTag: 'latest',
          resources: { memory: '1Gi', cpu: '0.5', storage: '2Gi' },
          networking: { port: 5000, exposedPorts: [5000], networkMode: 'bridge' as const },
          environment: {}
        }
      });

      const mockOriginalConfig = {
        id: 'config-1',
        userId: 'user-1',
        name: 'Original Config'
      };

      (mockPrisma.hummingbotConfiguration.findUnique as jest.Mock)
        .mockResolvedValueOnce({ ...mockOriginalConfig, configData: mockConfig })
        .mockResolvedValueOnce(mockOriginalConfig);

      (mockPrisma.hummingbotConfiguration.create as jest.Mock).mockImplementation((data) => {
        const configData = data.data.configData;
        expect(configData.instanceSettings.instanceId).toContain('original-instance_clone_');
        expect(configData.instanceSettings.instanceId).not.toBe('original-instance');
        return Promise.resolve({ id: 'clone-1', name: 'Cloned Config' });
      });

      await configManager.cloneConfiguration('config-1');
    });
  });

  describe('Version Compatibility and Migration', () => {
    describe('Version Compatibility Checks', () => {
      it('should identify compatible versions', async () => {
        const mockConfig = createValidMockConfig({ version: '1.5.0' });

        const validation = await configManager.validateConfiguration(mockConfig);
        
        // Should not have version mismatch warnings for compatible versions
        expect(validation.warnings.some(w => w.message.includes('not be compatible'))).toBe(false);
      });

      it('should identify deprecated versions', async () => {
        const mockConfig = createValidMockConfig({ version: '0.9.0' });

        const validation = await configManager.validateConfiguration(mockConfig);
        
        // Should have warnings about deprecated version
        expect(validation.warnings.some(w => w.message.includes('deprecated'))).toBe(true);
      });

      it('should identify unsupported versions', async () => {
        const mockConfig = createValidMockConfig({ version: '0.5.0' });

        const validation = await configManager.validateConfiguration(mockConfig);
        
        // Should have warnings about unsupported version
        expect(validation.warnings.some(w => w.message.includes('no longer supported'))).toBe(true);
      });
    });

    describe('Configuration Migration', () => {
      it('should migrate configuration to newer version', async () => {
        const oldConfig = createValidMockConfig({
          version: '1.0.0',
          riskSettings: {
            globalRiskEnabled: true,
            maxTotalExposure: 1000,
            maxDailyLoss: 100,
            maxDrawdown: 10,
            emergencyStopEnabled: false, // Old version didn't have this
            emergencyStopLoss: 5
          }
        });

        (mockPrisma.hummingbotConfiguration.findUnique as jest.Mock)
          .mockResolvedValueOnce({ id: 'config-1', configData: oldConfig })
          .mockResolvedValueOnce({ id: 'config-1', userId: 'user-1', name: 'Test Config', configData: oldConfig });

        (mockPrisma.hummingbotConfiguration.create as jest.Mock).mockResolvedValue({});
        (mockPrisma.hummingbotConfiguration.update as jest.Mock).mockResolvedValue({ userId: 'user-1' });
        (mockPrisma.hummingbotConfiguration.findMany as jest.Mock).mockResolvedValue([]);

        const migratedConfig = await configManager.migrateConfiguration('config-1', '2.0.0');

        expect(migratedConfig.version).toBe('2.0.0');
        expect(migratedConfig.riskSettings.emergencyStopEnabled).toBe(true);
        expect(migratedConfig.instanceSettings.environment.HUMMINGBOT_GATEWAY_ENABLED).toBe('true');
      });

      it('should create backup before migration', async () => {
        const oldConfig = createValidMockConfig({ version: '1.0.0' });

        (mockPrisma.hummingbotConfiguration.findUnique as jest.Mock)
          .mockResolvedValueOnce({ id: 'config-1', configData: oldConfig })
          .mockResolvedValueOnce({ id: 'config-1', userId: 'user-1', name: 'Test Config', configData: oldConfig });

        (mockPrisma.hummingbotConfiguration.create as jest.Mock).mockResolvedValue({});
        (mockPrisma.hummingbotConfiguration.update as jest.Mock).mockResolvedValue({ userId: 'user-1' });
        (mockPrisma.hummingbotConfiguration.findMany as jest.Mock).mockResolvedValue([]);

        await configManager.migrateConfiguration('config-1', '2.0.0');

        // Should create a backup before migration
        expect(mockPrisma.hummingbotConfiguration.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            parentId: 'config-1',
            isActive: false
          })
        });
      });
    });
  });

  describe('Enhanced Template Validation', () => {
    it('should validate template with all required fields', () => {
      const validTemplate: ConfigTemplate = {
        id: 'valid_template',
        name: 'Valid Template',
        description: 'A valid template',
        category: 'market_making',
        strategyType: 'pure_market_making',
        defaultParameters: { bidSpread: 0.1, askSpread: 0.1, orderAmount: 100 },
        requiredParameters: ['bidSpread', 'askSpread', 'orderAmount'],
        optionalParameters: ['orderLevels'],
        riskProfile: 'moderate',
        suitableMarkets: ['BTC-USDT'],
        minimumCapital: 1000,
        tags: ['test']
      };

      expect(() => configManager.addConfigurationTemplate(validTemplate)).not.toThrow();
    });

    it('should reject template with invalid strategy type', () => {
      const invalidTemplate: ConfigTemplate = {
        id: 'invalid_template',
        name: 'Invalid Template',
        description: 'An invalid template',
        category: 'market_making',
        strategyType: 'invalid_strategy' as any,
        defaultParameters: {},
        requiredParameters: [],
        optionalParameters: [],
        riskProfile: 'moderate',
        suitableMarkets: [],
        minimumCapital: 1000,
        tags: []
      };

      expect(() => configManager.addConfigurationTemplate(invalidTemplate))
        .toThrow('Strategy type \'invalid_strategy\' is not supported by Hummingbot');
    });

    it('should reject template with negative default parameters', () => {
      const invalidTemplate: ConfigTemplate = {
        id: 'negative_template',
        name: 'Negative Template',
        description: 'Template with negative spreads',
        category: 'market_making',
        strategyType: 'pure_market_making',
        defaultParameters: { bidSpread: -0.1, askSpread: 0.1, orderAmount: 100 },
        requiredParameters: ['bidSpread', 'askSpread', 'orderAmount'],
        optionalParameters: [],
        riskProfile: 'moderate',
        suitableMarkets: [],
        minimumCapital: 1000,
        tags: []
      };

      expect(() => configManager.addConfigurationTemplate(invalidTemplate))
        .toThrow('bidSpread\' cannot be negative');
    });

    it('should validate market making template requirements', () => {
      const incompleteTemplate: ConfigTemplate = {
        id: 'incomplete_mm_template',
        name: 'Incomplete Market Making Template',
        description: 'Missing required parameters',
        category: 'market_making',
        strategyType: 'pure_market_making',
        defaultParameters: {},
        requiredParameters: [], // Missing required parameters for market making
        optionalParameters: [],
        riskProfile: 'moderate',
        suitableMarkets: [],
        minimumCapital: 1000,
        tags: []
      };

      expect(() => configManager.addConfigurationTemplate(incompleteTemplate))
        .toThrow('Market making strategy requires parameters: bidSpread, askSpread, orderAmount');
    });

    it('should validate grid trading template requirements', () => {
      const incompleteTemplate: ConfigTemplate = {
        id: 'incomplete_grid_template',
        name: 'Incomplete Grid Trading Template',
        description: 'Missing required parameters',
        category: 'grid',
        strategyType: 'grid_trading',
        defaultParameters: {},
        requiredParameters: [], // Missing required parameters for grid trading
        optionalParameters: [],
        riskProfile: 'moderate',
        suitableMarkets: [],
        minimumCapital: 1000,
        tags: []
      };

      expect(() => configManager.addConfigurationTemplate(incompleteTemplate))
        .toThrow('Grid trading strategy requires parameters: gridLevels, gridSpacing, orderAmount');
    });

    it('should validate arbitrage template requirements', () => {
      const incompleteTemplate: ConfigTemplate = {
        id: 'incomplete_arbitrage_template',
        name: 'Incomplete Arbitrage Template',
        description: 'Missing required parameters',
        category: 'arbitrage',
        strategyType: 'arbitrage',
        defaultParameters: {},
        requiredParameters: [], // Missing required parameters for arbitrage
        optionalParameters: [],
        riskProfile: 'moderate',
        suitableMarkets: ['BTC-USDT'], // Only one market for arbitrage
        minimumCapital: 1000,
        tags: []
      };

      expect(() => configManager.addConfigurationTemplate(incompleteTemplate))
        .toThrow('Arbitrage strategy requires parameters: minProfitability, orderAmount');
    });
  });
});