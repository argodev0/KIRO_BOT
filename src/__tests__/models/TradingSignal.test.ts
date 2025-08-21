/**
 * Trading Signal Model Tests
 * Unit tests for TradingSignal database model
 */

import { TradingSignalModel } from '../../models/TradingSignal';
import { TradingSignal } from '../../types/trading';

// Mock the database
jest.mock('../../models/database', () => ({
  db: {
    tradingSignal: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
  },
}));

// Mock the logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('TradingSignalModel', () => {
  const mockSignalData: Omit<TradingSignal, 'id'> & { userId: string } = {
    userId: 'user123',
    symbol: 'BTCUSDT',
    direction: 'long',
    confidence: 0.85,
    entryPrice: 47000,
    stopLoss: 46000,
    takeProfit: [48000, 49000],
    reasoning: {
      technical: {
        indicators: ['RSI', 'MACD'],
        confluence: 0.8,
        trend: 'bullish',
      },
      patterns: {
        detected: ['hammer'],
        strength: 0.7,
      },
      elliottWave: {
        currentWave: 'wave_3',
        wavePosition: 'impulse',
        validity: 0.9,
      },
      fibonacci: {
        levels: [46800, 47200],
        confluence: 0.6,
      },
      volume: {
        profile: 'increasing',
        strength: 0.8,
      },
      summary: 'Strong bullish signal',
    },
    timestamp: 1640995200000,
    technicalScore: 0.8,
  };

  const mockDbSignal = {
    id: 'signal123',
    userId: 'user123',
    symbol: 'BTCUSDT',
    direction: 'LONG',
    confidence: { toNumber: () => 0.85 },
    entryPrice: { toNumber: () => 47000 },
    stopLoss: { toNumber: () => 46000 },
    takeProfit: [48000, 49000],
    reasoning: mockSignalData.reasoning,
    status: 'PENDING',
    technicalScore: { toNumber: () => 0.8 },
    patternScore: null,
    elliottWaveScore: null,
    fibonacciScore: null,
    volumeScore: null,
    createdAt: new Date(1640995200000),
    updatedAt: new Date(1640995200000),
    executedAt: null,
    closedAt: null,
    user: { id: 'user123', email: 'test@example.com' },
    executions: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new trading signal', async () => {
      const { db } = require('../../models/database');
      db.tradingSignal.create.mockResolvedValue(mockDbSignal);

      const result = await TradingSignalModel.create(mockSignalData);

      expect(db.tradingSignal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          symbol: 'BTCUSDT',
          direction: 'LONG',
          confidence: 0.85,
          entryPrice: 47000,
          userId: 'user123',
        }),
        include: {
          user: true,
          executions: true,
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: 'signal123',
          symbol: 'BTCUSDT',
          direction: 'long',
          confidence: 0.85,
          entryPrice: 47000,
        })
      );
    });

    it('should throw error for invalid signal data', async () => {
      const invalidSignalData = {
        ...mockSignalData,
        confidence: 1.5, // Invalid confidence > 1
      };

      await expect(TradingSignalModel.create(invalidSignalData)).rejects.toThrow(
        'Invalid signal data'
      );
    });

    it('should handle database errors', async () => {
      const { db } = require('../../models/database');
      db.tradingSignal.create.mockRejectedValue(new Error('Database error'));

      await expect(TradingSignalModel.create(mockSignalData)).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('findById', () => {
    it('should find signal by ID', async () => {
      const { db } = require('../../models/database');
      db.tradingSignal.findUnique.mockResolvedValue(mockDbSignal);

      const result = await TradingSignalModel.findById('signal123');

      expect(db.tradingSignal.findUnique).toHaveBeenCalledWith({
        where: { id: 'signal123' },
        include: {
          user: true,
          executions: true,
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: 'signal123',
          symbol: 'BTCUSDT',
        })
      );
    });

    it('should return null if signal not found', async () => {
      const { db } = require('../../models/database');
      db.tradingSignal.findUnique.mockResolvedValue(null);

      const result = await TradingSignalModel.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should find signals by user ID', async () => {
      const { db } = require('../../models/database');
      db.tradingSignal.findMany.mockResolvedValue([mockDbSignal]);

      const result = await TradingSignalModel.findByUserId('user123');

      expect(db.tradingSignal.findMany).toHaveBeenCalledWith({
        where: { userId: 'user123' },
        include: {
          user: true,
          executions: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'signal123',
          symbol: 'BTCUSDT',
        })
      );
    });

    it('should apply filters correctly', async () => {
      const { db } = require('../../models/database');
      db.tradingSignal.findMany.mockResolvedValue([]);

      await TradingSignalModel.findByUserId('user123', {
        status: 'active',
        symbol: 'BTCUSDT',
        limit: 10,
        offset: 5,
      });

      expect(db.tradingSignal.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user123',
          status: 'ACTIVE',
          symbol: 'BTCUSDT',
        },
        include: {
          user: true,
          executions: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 5,
      });
    });
  });

  describe('updateStatus', () => {
    it('should update signal status', async () => {
      const { db } = require('../../models/database');
      const updatedSignal = {
        ...mockDbSignal,
        status: 'EXECUTED',
        executedAt: new Date(),
      };
      db.tradingSignal.update.mockResolvedValue(updatedSignal);

      const result = await TradingSignalModel.updateStatus('signal123', 'executed');

      expect(db.tradingSignal.update).toHaveBeenCalledWith({
        where: { id: 'signal123' },
        data: {
          status: 'EXECUTED',
          executedAt: expect.any(Date),
        },
        include: {
          user: true,
          executions: true,
        },
      });

      expect(result.status).toBe('executed');
    });

    it('should set closedAt when status is closed', async () => {
      const { db } = require('../../models/database');
      const updatedSignal = {
        ...mockDbSignal,
        status: 'CLOSED',
        closedAt: new Date(),
      };
      db.tradingSignal.update.mockResolvedValue(updatedSignal);

      await TradingSignalModel.updateStatus('signal123', 'closed');

      expect(db.tradingSignal.update).toHaveBeenCalledWith({
        where: { id: 'signal123' },
        data: {
          status: 'CLOSED',
          closedAt: expect.any(Date),
        },
        include: {
          user: true,
          executions: true,
        },
      });
    });
  });

  describe('getActiveSignals', () => {
    it('should get active signals for symbol', async () => {
      const { db } = require('../../models/database');
      db.tradingSignal.findMany.mockResolvedValue([mockDbSignal]);

      const result = await TradingSignalModel.getActiveSignals('BTCUSDT');

      expect(db.tradingSignal.findMany).toHaveBeenCalledWith({
        where: {
          symbol: 'BTCUSDT',
          status: {
            in: ['PENDING', 'ACTIVE', 'EXECUTED'],
          },
        },
        include: {
          user: true,
          executions: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toHaveLength(1);
    });
  });

  describe('findByConfidenceRange', () => {
    it('should find signals by confidence range', async () => {
      const { db } = require('../../models/database');
      db.tradingSignal.findMany.mockResolvedValue([mockDbSignal]);

      const result = await TradingSignalModel.findByConfidenceRange(0.8, 1.0, 50);

      expect(db.tradingSignal.findMany).toHaveBeenCalledWith({
        where: {
          confidence: {
            gte: 0.8,
            lte: 1.0
          },
        },
        include: {
          user: true,
          executions: true,
        },
        orderBy: { confidence: 'desc' },
        take: 50,
      });

      expect(result).toHaveLength(1);
    });
  });

  describe('delete', () => {
    it('should delete signal successfully', async () => {
      const { db } = require('../../models/database');
      db.tradingSignal.delete.mockResolvedValue(mockDbSignal);

      const result = await TradingSignalModel.delete('signal123');

      expect(db.tradingSignal.delete).toHaveBeenCalledWith({
        where: { id: 'signal123' },
      });

      expect(result).toBe(true);
    });

    it('should return false on delete error', async () => {
      const { db } = require('../../models/database');
      db.tradingSignal.delete.mockRejectedValue(new Error('Delete failed'));

      const result = await TradingSignalModel.delete('signal123');

      expect(result).toBe(false);
    });
  });

  describe('getStatistics', () => {
    it('should get signal statistics', async () => {
      const { db } = require('../../models/database');
      
      db.tradingSignal.count.mockResolvedValue(100);
      db.tradingSignal.groupBy.mockImplementation((params: any) => {
        if (params.by.includes('status')) {
          return Promise.resolve([
            { status: 'PENDING', _count: { status: 20 } },
            { status: 'EXECUTED', _count: { status: 50 } },
            { status: 'CLOSED', _count: { status: 30 } },
          ]);
        }
        if (params.by.includes('direction')) {
          return Promise.resolve([
            { direction: 'LONG', _count: { direction: 60 } },
            { direction: 'SHORT', _count: { direction: 40 } },
          ]);
        }
        return Promise.resolve([]);
      });
      db.tradingSignal.aggregate.mockResolvedValue({
        _avg: { confidence: { toNumber: () => 0.75 } },
      });

      const result = await TradingSignalModel.getStatistics('user123');

      expect(result).toEqual({
        total: 100,
        byStatus: {
          pending: 20,
          executed: 50,
          closed: 30,
        },
        byDirection: {
          long: 60,
          short: 40,
        },
        averageConfidence: 0.75,
      });
    });
  });
});