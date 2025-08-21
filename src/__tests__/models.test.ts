/**
 * Models Test
 * Test database model compilation and basic functionality
 */

import { TradingSignalModel } from '../models/TradingSignal';
import { MarketDataModel } from '../models/MarketData';
import { GridModel } from '../models/Grid';

// Mock the database
jest.mock('../models/database', () => ({
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
    marketData: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
      $transaction: jest.fn(),
    },
    grid: {
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

describe('Database Models', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TradingSignalModel', () => {
    it('should have all required static methods', () => {
      expect(typeof TradingSignalModel.create).toBe('function');
      expect(typeof TradingSignalModel.findById).toBe('function');
      expect(typeof TradingSignalModel.findByUserId).toBe('function');
      expect(typeof TradingSignalModel.updateStatus).toBe('function');
      expect(typeof TradingSignalModel.getActiveSignals).toBe('function');
      expect(typeof TradingSignalModel.findByConfidenceRange).toBe('function');
      expect(typeof TradingSignalModel.delete).toBe('function');
      expect(typeof TradingSignalModel.getStatistics).toBe('function');
    });

    it('should validate input data before creating', async () => {
      const invalidSignalData = {
        userId: 'user123',
        symbol: 'BTCUSDT',
        direction: 'long' as const,
        confidence: 1.5, // Invalid confidence > 1
        entryPrice: 47000,
        takeProfit: [48000],
        reasoning: {
          technical: { indicators: [], confluence: 0.8, trend: 'bullish' },
          patterns: { detected: [], strength: 0.7 },
          elliottWave: { currentWave: 'wave_3', wavePosition: 'impulse', validity: 0.9 },
          fibonacci: { levels: [], confluence: 0.6 },
          volume: { profile: 'increasing', strength: 0.8 },
          summary: 'Test signal',
        },
        timestamp: 1640995200000,
      };

      await expect(TradingSignalModel.create(invalidSignalData)).rejects.toThrow(
        'Invalid signal data'
      );
    });
  });

  describe('MarketDataModel', () => {
    it('should have all required static methods', () => {
      expect(typeof MarketDataModel.storeCandles).toBe('function');
      expect(typeof MarketDataModel.getCandles).toBe('function');
      expect(typeof MarketDataModel.getLatestCandle).toBe('function');
      expect(typeof MarketDataModel.getCandlesMultiSymbol).toBe('function');
      expect(typeof MarketDataModel.storeIndicators).toBe('function');
      expect(typeof MarketDataModel.getCandlesWithIndicators).toBe('function');
      expect(typeof MarketDataModel.deleteOldData).toBe('function');
      expect(typeof MarketDataModel.getStatistics).toBe('function');
    });

    it('should validate candle data before storing', async () => {
      const invalidCandles = [
        {
          symbol: 'BTCUSDT',
          timeframe: '1h' as const,
          timestamp: 1640995200000,
          open: 47000,
          high: 46000, // Invalid: high < open
          low: 46500,
          close: 47200,
          volume: 1234.56,
        },
      ];

      await expect(MarketDataModel.storeCandles(invalidCandles)).rejects.toThrow(
        'Invalid candle data'
      );
    });
  });

  describe('GridModel', () => {
    it('should have all required static methods', () => {
      expect(typeof GridModel.create).toBe('function');
      expect(typeof GridModel.findById).toBe('function');
      expect(typeof GridModel.findByUserId).toBe('function');
      expect(typeof GridModel.updateStatus).toBe('function');
      expect(typeof GridModel.updateLevels).toBe('function');
      expect(typeof GridModel.updateProfit).toBe('function');
      expect(typeof GridModel.getActiveGrids).toBe('function');
      expect(typeof GridModel.findByStrategy).toBe('function');
      expect(typeof GridModel.delete).toBe('function');
      expect(typeof GridModel.getStatistics).toBe('function');
      expect(typeof GridModel.updateMetadata).toBe('function');
    });

    it('should validate grid data before creating', async () => {
      const invalidGridData = {
        userId: 'user123',
        symbol: 'BTCUSDT',
        strategy: 'invalid_strategy' as any, // Invalid strategy
        levels: [],
        basePrice: 47000,
        spacing: 500,
        totalProfit: 0,
        status: 'active' as const,
      };

      await expect(GridModel.create(invalidGridData)).rejects.toThrow(
        'Invalid grid data'
      );
    });
  });

  describe('Model Integration', () => {
    it('should work with TypeScript types', () => {
      // Test that our model types are properly defined
      expect(TradingSignalModel).toBeDefined();
      expect(MarketDataModel).toBeDefined();
      expect(GridModel).toBeDefined();
    });

    it('should handle empty arrays correctly', async () => {
      // Test edge case with empty data
      await expect(MarketDataModel.storeCandles([])).resolves.not.toThrow();
    });
  });
});