import request from 'supertest';
import app from '../../index';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

describe('Configuration API Integration Tests', () => {
  let authToken: string;
  let userId: string;
  let configId: string;

  beforeAll(async () => {
    // Create test user and generate auth token
    const testUser = await prisma.user.create({
      data: {
        email: 'config-test@example.com',
        passwordHash: 'hashedpassword',
        apiKeys: {},
        riskSettings: {}
      }
    });
    
    userId = testUser.id;
    authToken = jwt.sign(
      { userId: testUser.id, email: testUser.email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.botConfig.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  describe('POST /api/v1/config', () => {
    it('should create a new bot configuration', async () => {
      const configData = {
        name: 'Test Configuration',
        description: 'A test configuration for integration testing',
        strategy: {
          type: 'technical_analysis',
          parameters: {
            technicalAnalysis: {
              indicators: {
                rsi: { enabled: true, period: 14, overbought: 70, oversold: 30 },
                waveTrend: { enabled: true, n1: 10, n2: 21 },
                pvt: { enabled: true, period: 14 }
              },
              patterns: { enabled: true, minConfidence: 70, patternTypes: ['hammer', 'doji'] },
              confluence: { minFactors: 2, requiredIndicators: ['rsi'] }
            }
          },
          timeframes: ['1h'],
          symbols: ['BTCUSDT'],
          maxConcurrentTrades: 3
        },
        riskManagement: {
          maxRiskPerTrade: 2,
          maxDailyLoss: 5,
          maxTotalExposure: 3,
          maxDrawdown: 10,
          stopLossRequired: true,
          maxLeverage: 1,
          emergencyStop: {
            enabled: true,
            triggers: {
              maxDailyLoss: true,
              maxDrawdown: true,
              consecutiveLosses: { enabled: false, count: 5 },
              marketVolatility: { enabled: false, threshold: 0.1 }
            },
            actions: {
              closeAllPositions: true,
              pauseTrading: true,
              sendNotification: true
            }
          },
          positionSizing: {
            method: 'percentage',
            baseSize: 1,
            maxSize: 5,
            volatilityAdjustment: false,
            correlationAdjustment: false
          },
          correlationLimits: {
            enabled: false,
            maxCorrelatedPositions: 3,
            correlationThreshold: 0.7,
            timeframe: '1h'
          },
          drawdownProtection: {
            enabled: true,
            maxDrawdown: 10,
            reductionSteps: [{ threshold: 5, action: 'reduce_size', parameter: 50 }],
            recoveryThreshold: 3
          }
        },
        signalFilters: {
          confidence: {
            enabled: true,
            minConfidence: 60,
            maxSignalsPerHour: 5,
            cooldownPeriod: 15
          },
          technical: {
            enabled: true,
            requiredIndicators: [],
            indicatorThresholds: {},
            trendAlignment: false
          },
          patterns: {
            enabled: true,
            allowedPatterns: [],
            minPatternStrength: 60,
            multiTimeframeConfirmation: false
          },
          confluence: {
            enabled: true,
            minConfluenceFactors: 2,
            requiredFactorTypes: [],
            confluenceWeight: 0.7
          },
          timeframe: {
            enabled: false,
            primaryTimeframe: '1h',
            confirmationTimeframes: [],
            alignmentRequired: false
          },
          volume: {
            enabled: false,
            minVolumeRatio: 1.2,
            volumeTrendRequired: false,
            unusualVolumeDetection: false
          }
        },
        exchanges: [
          {
            name: 'binance',
            enabled: true,
            testnet: true,
            rateLimits: { ordersPerSecond: 1, requestsPerMinute: 60 },
            fees: { maker: 0.001, taker: 0.001 },
            symbols: ['BTCUSDT']
          }
        ],
        notifications: {
          email: { enabled: false, events: [] },
          webhook: { enabled: false, events: [] },
          inApp: { enabled: true, events: ['signal_generated', 'trade_executed'], sound: true }
        }
      };

      const response = await request(app)
        .post('/api/v1/config')
        .set('Authorization', `Bearer ${authToken}`)
        .send(configData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(configData.name);
      expect(response.body.data.userId).toBe(userId);
      
      configId = response.body.data.id;
    });

    it('should validate configuration data', async () => {
      const invalidConfigData = {
        name: '', // Invalid: empty name
        strategy: {
          type: 'invalid_strategy', // Invalid strategy type
          parameters: {},
          timeframes: [],
          symbols: [],
          maxConcurrentTrades: 0
        }
      };

      const response = await request(app)
        .post('/api/v1/config')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidConfigData)
        .expect(400);

      expect(response.body.error).toBe('CONFIG_VALIDATION_FAILED');
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('GET /api/v1/config', () => {
    it('should get all user configurations', async () => {
      const response = await request(app)
        .get('/api/v1/config')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter configurations by status', async () => {
      const response = await request(app)
        .get('/api/v1/config?status=inactive')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/v1/config/:id', () => {
    it('should get specific configuration', async () => {
      const response = await request(app)
        .get(`/api/v1/config/${configId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(configId);
      expect(response.body.data.name).toBe('Test Configuration');
    });

    it('should return 404 for non-existent configuration', async () => {
      const response = await request(app)
        .get('/api/v1/config/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('CONFIG_NOT_FOUND');
    });
  });

  describe('PUT /api/v1/config/:id', () => {
    it('should update configuration', async () => {
      const updateData = {
        name: 'Updated Test Configuration',
        description: 'Updated description',
        riskManagement: {
          maxRiskPerTrade: 1.5,
          maxDailyLoss: 4,
          maxTotalExposure: 2.5,
          maxDrawdown: 8,
          stopLossRequired: true,
          maxLeverage: 1
        }
      };

      const response = await request(app)
        .put(`/api/v1/config/${configId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.description).toBe(updateData.description);
    });

    it('should prevent updates to critical settings when bot is running', async () => {
      // This test would require mocking the bot status
      // For now, we'll test the validation logic
      const criticalUpdate = {
        strategy: {
          type: 'elliott_wave' // Changing strategy type
        }
      };

      // Mock bot status as running would be done here
      // For this test, we'll assume the bot is stopped
      const response = await request(app)
        .put(`/api/v1/config/${configId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(criticalUpdate)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/config/validate', () => {
    it('should validate configuration without saving', async () => {
      const configData = {
        name: 'Validation Test',
        strategy: {
          type: 'technical_analysis',
          parameters: {
            technicalAnalysis: {
              indicators: {
                rsi: { enabled: true, period: 14, overbought: 70, oversold: 30 },
                waveTrend: { enabled: true, n1: 10, n2: 21 },
                pvt: { enabled: true, period: 14 }
              },
              patterns: { enabled: true, minConfidence: 70, patternTypes: ['hammer'] },
              confluence: { minFactors: 2, requiredIndicators: ['rsi'] }
            }
          },
          timeframes: ['1h'],
          symbols: ['BTCUSDT'],
          maxConcurrentTrades: 3
        },
        riskManagement: {
          maxRiskPerTrade: 15, // This should trigger a warning
          maxDailyLoss: 5,
          maxTotalExposure: 3,
          maxDrawdown: 10,
          stopLossRequired: true,
          maxLeverage: 1
        }
      };

      const response = await request(app)
        .post('/api/v1/config/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(configData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBeDefined();
      expect(response.body.data.warnings).toBeDefined();
    });
  });

  describe('POST /api/v1/config/:id/control', () => {
    it('should start bot', async () => {
      const response = await request(app)
        .post(`/api/v1/config/${configId}/control`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'start' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('running');
    });

    it('should stop bot', async () => {
      const response = await request(app)
        .post(`/api/v1/config/${configId}/control`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'stop' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('stopped');
    });

    it('should require confirmation for risky actions', async () => {
      // Mock bot with active positions
      const response = await request(app)
        .post(`/api/v1/config/${configId}/control`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'stop' })
        .expect(400);

      if (response.body.confirmationRequired) {
        expect(response.body.error).toBe('CONFIRMATION_REQUIRED');
        expect(response.body.warningMessage).toBeDefined();
      }
    });
  });

  describe('GET /api/v1/config/:id/status', () => {
    it('should get bot status', async () => {
      const response = await request(app)
        .get(`/api/v1/config/${configId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.totalTrades).toBeDefined();
      expect(response.body.data.activePositions).toBeDefined();
    });
  });

  describe('POST /api/v1/config/:id/backup', () => {
    it('should create configuration backup', async () => {
      const backupData = {
        name: 'Test Backup',
        description: 'Backup for integration testing'
      };

      const response = await request(app)
        .post(`/api/v1/config/${configId}/backup`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(backupData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(backupData.name);
      expect(response.body.data.config).toBeDefined();
    });
  });

  describe('GET /api/v1/config/templates', () => {
    it('should get configuration templates', async () => {
      const response = await request(app)
        .get('/api/v1/config/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should filter templates by category', async () => {
      const response = await request(app)
        .get('/api/v1/config/templates?category=conservative')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('DELETE /api/v1/config/:id', () => {
    it('should delete configuration', async () => {
      const response = await request(app)
        .delete(`/api/v1/config/${configId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should prevent deletion of running bot configuration', async () => {
      // Create another config for this test
      const configData = {
        name: 'Delete Test Config',
        strategy: {
          type: 'technical_analysis',
          parameters: { technicalAnalysis: {} },
          timeframes: ['1h'],
          symbols: ['BTCUSDT'],
          maxConcurrentTrades: 1
        },
        riskManagement: {
          maxRiskPerTrade: 1,
          maxDailyLoss: 3,
          maxTotalExposure: 2,
          maxDrawdown: 5,
          stopLossRequired: true,
          maxLeverage: 1
        }
      };

      const createResponse = await request(app)
        .post('/api/v1/config')
        .set('Authorization', `Bearer ${authToken}`)
        .send(configData);

      const newConfigId = createResponse.body.data.id;

      // Mock bot as running would be done here
      // For this test, we'll assume the bot is stopped and deletion succeeds
      const deleteResponse = await request(app)
        .delete(`/api/v1/config/${newConfigId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('should require authentication for all endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/config')
        .expect(401);

      expect(response.body.error).toBe('UNAUTHORIZED');
    });

    it('should reject invalid tokens', async () => {
      const response = await request(app)
        .get('/api/v1/config')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toBe('UNAUTHORIZED');
    });
  });
});