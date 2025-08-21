/**
 * Grid Strategy Service Tests
 * Comprehensive test suite for advanced grid trading functionality
 */

import { GridStrategyService } from '../../services/GridStrategyService';
import { ElliottWaveService } from '../../services/ElliottWaveService';

import { GridModel } from '../../models/Grid';
import {
  GridConfig,
  GridStrategy,
  ElliottWaveGridConfig,
  FibonacciGridConfig,
  DynamicGridConfig,
  GridRiskParameters
} from '../../types/grid';
import { CandleData } from '../../types/market';
import { WaveStructure, FibonacciLevels } from '../../types/analysis';

// Mock dependencies
jest.mock('../../services/ElliottWaveService');
jest.mock('../../services/FibonacciService');
jest.mock('../../models/Grid');

describe('GridStrategyService', () => {
  let gridService: GridStrategyService;
  let mockElliottWaveService: jest.Mocked<ElliottWaveService>;
  let mockGridModel: jest.Mocked<typeof GridModel>;

  const mockCandleData: CandleData[] = [
    {
      symbol: 'BTCUSDT',
      timeframe: '1h',
      timestamp: 1640995200000,
      open: 47000,
      high: 47500,
      low: 46500,
      close: 47200,
      volume: 1000
    },
    {
      symbol: 'BTCUSDT',
      timeframe: '1h',
      timestamp: 1640998800000,
      open: 47200,
      high: 47800,
      low: 46800,
      close: 47600,
      volume: 1200
    }
  ];

  const mockWaveStructure: WaveStructure = {
    waves: [
      {
        id: 'wave_1',
        type: 'wave_1',
        degree: 'minor',
        startPrice: 46000,
        endPrice: 48000,
        startTime: 1640995200000,
        endTime: 1640998800000,
        length: 2000,
        duration: 3600000
      },
      {
        id: 'wave_2',
        type: 'wave_2',
        degree: 'minor',
        startPrice: 48000,
        endPrice: 47000,
        startTime: 1640998800000,
        endTime: 1641002400000,
        length: 1000,
        duration: 3600000
      }
    ],
    currentWave: {
      id: 'wave_3',
      type: 'wave_3',
      degree: 'minor',
      startPrice: 47000,
      endPrice: 47600,
      startTime: 1641002400000,
      endTime: 1641006000000,
      length: 600,
      duration: 3600000
    },
    waveCount: 3,
    degree: 'minor',
    validity: 0.8,
    nextTargets: [
      {
        price: 49000,
        probability: 0.7,
        type: 'fibonacci_extension',
        description: '161.8% extension'
      }
    ],
    invalidationLevel: 46500
  };

  const mockFibonacciLevels: FibonacciLevels = {
    retracements: [
      { ratio: 0.236, price: 47764, type: 'retracement', strength: 0.6, description: '23.6% retracement' },
      { ratio: 0.382, price: 47528, type: 'retracement', strength: 0.7, description: '38.2% retracement' },
      { ratio: 0.618, price: 47056, type: 'retracement', strength: 1.0, description: '61.8% retracement (Golden Ratio)' }
    ],
    extensions: [
      { ratio: 1.272, price: 48544, type: 'extension', strength: 0.8, description: '127.2% extension' },
      { ratio: 1.618, price: 49236, type: 'extension', strength: 1.0, description: '161.8% extension' }
    ],
    timeProjections: [],
    confluenceZones: [],
    highPrice: 48000,
    lowPrice: 46000,
    swingHigh: 48000,
    swingLow: 46000
  };

  const mockRiskParameters: GridRiskParameters = {
    maxLevels: 10,
    maxExposure: 100000,
    maxDrawdown: 0.1,
    stopLoss: 45000,
    takeProfit: 50000
  };

  const mockGrid = {
    id: 'grid-123',
    symbol: 'BTCUSDT',
    strategy: 'elliott_wave' as GridStrategy,
    levels: [
      {
        price: 47000,
        quantity: 0.1,
        side: 'buy' as const,
        filled: false,
        waveContext: {
          currentWave: 'wave_3',
          waveType: 'impulse' as const,
          wavePosition: 3,
          expectedDirection: 'up' as const
        }
      },
      {
        price: 47500,
        quantity: 0.1,
        side: 'buy' as const,
        filled: true,
        waveContext: {
          currentWave: 'wave_3',
          waveType: 'impulse' as const,
          wavePosition: 3,
          expectedDirection: 'up' as const
        }
      }
    ],
    basePrice: 47000,
    spacing: 500,
    totalProfit: 100,
    status: 'active' as const,
    metadata: {},
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  beforeEach(() => {
    gridService = new GridStrategyService();
    mockElliottWaveService = new ElliottWaveService() as jest.Mocked<ElliottWaveService>;
    mockGridModel = GridModel as jest.Mocked<typeof GridModel>;

    // Setup default mocks
    mockElliottWaveService.monitorWaveInvalidation.mockReturnValue({
      isInvalidated: false,
      invalidatedWaves: [],
      reason: ''
    });

    jest.clearAllMocks();
  });

  describe('Elliott Wave Grid Calculation', () => {
    it('should calculate long grid levels for impulse waves', async () => {
      const config: GridConfig & { elliottWaveConfig: ElliottWaveGridConfig } = {
        symbol: 'BTCUSDT',
        strategy: 'elliott_wave' as GridStrategy,
        basePrice: 47000,
        quantity: 0.1,
        riskParameters: mockRiskParameters,
        elliottWaveConfig: {
          waveAnalysis: mockWaveStructure,
          longWaves: ['wave_1', 'wave_3', 'wave_5'],
          shortWaves: ['wave_a', 'wave_b', 'wave_c'],
          invalidationLevel: 46500,
          waveTargets: [48000, 49000, 50000]
        }
      };

      const result = await gridService.calculateElliottWaveGrid(config);

      expect(result.levels).toBeDefined();
      expect(result.levels.length).toBeGreaterThan(0);
      expect(result.levels.length).toBeLessThanOrEqual(mockRiskParameters.maxLevels);
      
      // Check that levels are buy orders for long grid
      result.levels.forEach(level => {
        expect(level.side).toBe('buy');
        expect(level.waveContext).toBeDefined();
        expect(level.waveContext?.currentWave).toBe('wave_3');
        expect(level.waveContext?.expectedDirection).toBe('up');
      });

      expect(result.riskAssessment).toBeDefined();
      expect(result.totalLevels).toBe(result.levels.length);
    });

    it('should calculate short grid levels for corrective waves', async () => {
      const correctiveWaveStructure = {
        ...mockWaveStructure,
        currentWave: {
          ...mockWaveStructure.currentWave,
          type: 'wave_a' as any
        }
      };

      const config: GridConfig & { elliottWaveConfig: ElliottWaveGridConfig } = {
        symbol: 'BTCUSDT',
        strategy: 'elliott_wave' as GridStrategy,
        basePrice: 47000,
        quantity: 0.1,
        riskParameters: mockRiskParameters,
        elliottWaveConfig: {
          waveAnalysis: correctiveWaveStructure,
          longWaves: ['wave_1', 'wave_3', 'wave_5'],
          shortWaves: ['wave_a', 'wave_b', 'wave_c'],
          invalidationLevel: 46500,
          waveTargets: [46000, 45000, 44000]
        }
      };

      const result = await gridService.calculateElliottWaveGrid(config);

      expect(result.levels).toBeDefined();
      expect(result.levels.length).toBeGreaterThan(0);
      
      // Check that levels are sell orders for short grid
      result.levels.forEach(level => {
        expect(level.side).toBe('sell');
        expect(level.waveContext?.expectedDirection).toBe('down');
      });
    });

    it('should throw error for unconfigured wave types', async () => {
      const config: GridConfig & { elliottWaveConfig: ElliottWaveGridConfig } = {
        symbol: 'BTCUSDT',
        strategy: 'elliott_wave' as GridStrategy,
        basePrice: 47000,
        quantity: 0.1,
        riskParameters: mockRiskParameters,
        elliottWaveConfig: {
          waveAnalysis: mockWaveStructure,
          longWaves: ['wave_1', 'wave_5'], // wave_3 not included
          shortWaves: ['wave_a', 'wave_c'], // wave_b not included
          invalidationLevel: 46500,
          waveTargets: [48000, 49000]
        }
      };

      await expect(gridService.calculateElliottWaveGrid(config)).rejects.toThrow(
        'Current wave wave_3 not configured for grid trading'
      );
    });
  });

  describe('Fibonacci Grid Calculation', () => {
    it('should calculate grid levels using Fibonacci retracements and extensions', async () => {
      const config: GridConfig & { fibonacciConfig: FibonacciGridConfig } = {
        symbol: 'BTCUSDT',
        strategy: 'fibonacci' as GridStrategy,
        basePrice: 47500,
        quantity: 0.1,
        riskParameters: mockRiskParameters,
        fibonacciConfig: {
          fibonacciLevels: mockFibonacciLevels,
          useRetracements: true,
          useExtensions: true,
          goldenRatioEmphasis: true,
          confluenceZones: true
        }
      };

      const result = await gridService.calculateFibonacciGrid(config);

      expect(result.levels).toBeDefined();
      expect(result.levels.length).toBeGreaterThan(0);
      expect(result.levels.length).toBeLessThanOrEqual(mockRiskParameters.maxLevels);

      // Check that levels have Fibonacci ratios
      result.levels.forEach(level => {
        expect(level.fibonacciLevel).toBeDefined();
        expect(level.side).toMatch(/buy|sell/);
      });

      // Check that golden ratio levels have higher quantities (emphasis)
      const goldenRatioLevels = result.levels.filter(level => 
        level.fibonacciLevel === 0.618 || level.fibonacciLevel === 1.618
      );
      
      if (goldenRatioLevels.length > 0) {
        const regularLevels = result.levels.filter(level => 
          level.fibonacciLevel !== 0.618 && level.fibonacciLevel !== 1.618
        );
        
        if (regularLevels.length > 0) {
          const avgGoldenQuantity = goldenRatioLevels.reduce((sum, level) => sum + level.quantity, 0) / goldenRatioLevels.length;
          const avgRegularQuantity = regularLevels.reduce((sum, level) => sum + level.quantity, 0) / regularLevels.length;
          
          expect(avgGoldenQuantity).toBeGreaterThanOrEqual(avgRegularQuantity);
        }
      }
    });

    it('should use only retracements when extensions disabled', async () => {
      const config: GridConfig & { fibonacciConfig: FibonacciGridConfig } = {
        symbol: 'BTCUSDT',
        strategy: 'fibonacci' as GridStrategy,
        basePrice: 47500,
        quantity: 0.1,
        riskParameters: mockRiskParameters,
        fibonacciConfig: {
          fibonacciLevels: mockFibonacciLevels,
          useRetracements: true,
          useExtensions: false,
          goldenRatioEmphasis: false,
          confluenceZones: false
        }
      };

      const result = await gridService.calculateFibonacciGrid(config);

      expect(result.levels).toBeDefined();
      
      // All levels should be from retracements only
      result.levels.forEach(level => {
        const isRetracementLevel = mockFibonacciLevels.retracements.some(
          ret => Math.abs(ret.ratio - (level.fibonacciLevel || 0)) < 0.001
        );
        expect(isRetracementLevel).toBe(true);
      });
    });
  });

  describe('Dynamic Grid Calculation', () => {
    it('should calculate dynamic grid with volatility adjustment', async () => {
      const config: GridConfig & { dynamicConfig: DynamicGridConfig } = {
        symbol: 'BTCUSDT',
        strategy: 'dynamic' as GridStrategy,
        basePrice: 47500,
        spacing: 100,
        quantity: 0.1,
        riskParameters: mockRiskParameters,
        dynamicConfig: {
          volatilityAdjustment: true,
          volumeAdjustment: false,
          trendAdjustment: false,
          rebalanceFrequency: 60,
          adaptationSpeed: 0.5
        }
      };

      const result = await gridService.calculateDynamicGrid(config, mockCandleData);

      expect(result.levels).toBeDefined();
      expect(result.levels.length).toBeGreaterThan(0);

      // Check that we have both buy and sell levels around base price
      const buyLevels = result.levels.filter(level => level.side === 'buy');
      const sellLevels = result.levels.filter(level => level.side === 'sell');

      expect(buyLevels.length).toBeGreaterThan(0);
      expect(sellLevels.length).toBeGreaterThan(0);

      // Buy levels should be below base price, sell levels above
      buyLevels.forEach(level => {
        expect(level.price).toBeLessThan(config.basePrice!);
      });

      sellLevels.forEach(level => {
        expect(level.price).toBeGreaterThan(config.basePrice!);
      });
    });

    it('should adjust spacing based on market conditions', async () => {
      const highVolatilityCandles: CandleData[] = [
        ...mockCandleData,
        {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          timestamp: 1641002400000,
          open: 47600,
          high: 49000, // High volatility
          low: 46000,
          close: 48500,
          volume: 2000
        }
      ];

      const config: GridConfig & { dynamicConfig: DynamicGridConfig } = {
        symbol: 'BTCUSDT',
        strategy: 'dynamic' as GridStrategy,
        basePrice: 47500,
        spacing: 100,
        quantity: 0.1,
        riskParameters: mockRiskParameters,
        dynamicConfig: {
          volatilityAdjustment: true,
          volumeAdjustment: true,
          trendAdjustment: true,
          rebalanceFrequency: 60,
          adaptationSpeed: 0.8
        }
      };

      const result = await gridService.calculateDynamicGrid(config, highVolatilityCandles);

      expect(result.levels).toBeDefined();
      
      // With high volatility, spacing should be wider than base
      const actualSpacing = Math.abs(result.levels[1].price - result.levels[0].price);
      expect(actualSpacing).toBeGreaterThan(config.spacing!);
    });
  });

  describe('Grid Level Adjustment', () => {

    beforeEach(() => {
      mockGridModel.findById.mockResolvedValue(mockGrid);
      mockGridModel.updateLevels.mockResolvedValue(mockGrid);
    });

    it('should adjust Elliott Wave grid based on wave structure changes', async () => {
      const marketConditions = {
        currentPrice: 47600,
        waveStructure: mockWaveStructure
      };

      const result = await gridService.adjustGridLevels('grid-123', marketConditions);

      expect(result.adjustedLevels).toBeDefined();
      expect(result.reason).toContain('elliott_wave strategy');
      expect(mockGridModel.findById).toHaveBeenCalledWith('grid-123');
      expect(mockGridModel.updateLevels).toHaveBeenCalled();
    });

    it('should adjust Fibonacci grid based on new Fibonacci levels', async () => {
      const fibGrid = { ...mockGrid, strategy: 'fibonacci' as GridStrategy };
      mockGridModel.findById.mockResolvedValue(fibGrid);

      const marketConditions = {
        currentPrice: 47600,
        fibonacciLevels: mockFibonacciLevels
      };

      const result = await gridService.adjustGridLevels('grid-123', marketConditions);

      expect(result.adjustedLevels).toBeDefined();
      expect(result.reason).toContain('fibonacci strategy');
    });

    it('should handle grid not found error', async () => {
      mockGridModel.findById.mockResolvedValue(null);

      await expect(
        gridService.adjustGridLevels('nonexistent-grid', { currentPrice: 47600 })
      ).rejects.toThrow('Grid nonexistent-grid not found');
    });
  });

  describe('Grid Performance Monitoring', () => {
    const mockGridWithFilledLevels = {
      ...mockGrid,
      levels: [
        {
          price: 47000,
          quantity: 0.1,
          side: 'buy' as const,
          filled: true,
          filledAt: Date.now() - 3600000,
          profit: 50
        },
        {
          price: 47500,
          quantity: 0.1,
          side: 'sell' as const,
          filled: true,
          filledAt: Date.now() - 1800000,
          profit: 30
        },
        {
          price: 48000,
          quantity: 0.1,
          side: 'buy' as const,
          filled: false
        }
      ],
      totalProfit: 80
    };

    beforeEach(() => {
      mockGridModel.findById.mockResolvedValue(mockGridWithFilledLevels);
    });

    it('should calculate grid performance metrics', async () => {
      const result = await gridService.monitorGridPerformance('grid-123', 47800);

      expect(result.gridId).toBe('grid-123');
      expect(result.currentPrice).toBe(47800);
      expect(result.filledLevels).toBe(2);
      expect(result.activeLevels).toBe(1);
      expect(result.realizedPnl).toBe(80);
      expect(result.unrealizedPnl).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.performance.totalTrades).toBe(2);
      expect(result.performance.winningTrades).toBe(2);
      expect(result.performance.winRate).toBe(1);
      expect(result.riskMetrics).toBeDefined();
    });

    it('should calculate unrealized P&L correctly', async () => {
      const currentPrice = 47800;
      const result = await gridService.monitorGridPerformance('grid-123', currentPrice);

      // Buy at 47000, current 47800: profit = (47800 - 47000) * 0.1 = 80
      // Sell at 47500, current 47800: loss = (47500 - 47800) * 0.1 = -30
      // Total unrealized: 80 - 30 = 50
      expect(result.unrealizedPnl).toBe(50);
    });
  });

  describe('Grid Invalidation Detection', () => {
    beforeEach(() => {
      mockGridModel.findById.mockResolvedValue(mockGrid);
    });

    it('should detect Elliott Wave invalidation', async () => {
      mockElliottWaveService.monitorWaveInvalidation.mockReturnValue({
        isInvalidated: true,
        invalidatedWaves: [mockWaveStructure.currentWave],
        reason: 'Price broke wave 1 low'
      });

      const result = await gridService.checkGridInvalidation('grid-123', 46000, mockWaveStructure);

      expect(result.isInvalidated).toBe(true);
      expect(result.reason).toContain('Elliott Wave invalidation');
      expect(result.recommendedAction).toBe('close');
      expect(result.invalidatedLevels.length).toBeGreaterThan(0);
    });

    it('should detect Fibonacci level invalidation', async () => {
      const fibGrid = { 
        ...mockGrid, 
        strategy: 'fibonacci' as GridStrategy,
        levels: [
          {
            price: 47056, // 61.8% retracement level
            quantity: 0.1,
            side: 'buy' as const,
            filled: false,
            fibonacciLevel: 0.618
          }
        ]
      };
      mockGridModel.findById.mockResolvedValue(fibGrid);

      // Price moved far from Fibonacci levels
      const result = await gridService.checkGridInvalidation('grid-123', 52000);

      expect(result.isInvalidated).toBe(true);
      expect(result.reason).toContain('too far from Fibonacci levels');
      expect(result.recommendedAction).toBe('adjust');
    });

    it('should detect risk-based invalidation', async () => {
      const standardGrid = { 
        ...mockGrid, 
        strategy: 'standard' as GridStrategy,
        metadata: {
          riskParameters: {
            maxLevels: 10,
            maxExposure: 50000,
            maxDrawdown: 0.05 // 5% max drawdown
          }
        }
      };
      mockGridModel.findById.mockResolvedValue(standardGrid);

      // Simulate large drawdown scenario
      const result = await gridService.checkGridInvalidation('grid-123', 40000); // Significant price drop

      expect(result.recommendedAction).toBe('pause');
    });

    it('should return no invalidation for healthy grid', async () => {
      const result = await gridService.checkGridInvalidation('grid-123', 47600);

      expect(result.isInvalidated).toBe(false);
      expect(result.reason).toBe('');
      expect(result.invalidatedLevels).toHaveLength(0);
    });
  });

  describe('Grid Parameter Optimization', () => {
    const mockHistoricalGrids = [
      {
        id: 'grid-1',
        spacing: 100,
        levels: [{ price: 47000, quantity: 0.1, side: 'buy' as const, filled: true }],
        totalProfit: 150,
        metadata: {
          performance: {
            totalTrades: 10,
            winRate: 0.8,
            sharpeRatio: 1.5,
            maxDrawdown: 0.05
          }
        }
      },
      {
        id: 'grid-2',
        spacing: 200,
        levels: [{ price: 47000, quantity: 0.2, side: 'buy' as const, filled: true }],
        totalProfit: 200,
        metadata: {
          performance: {
            totalTrades: 8,
            winRate: 0.9,
            sharpeRatio: 1.8,
            maxDrawdown: 0.03
          }
        }
      }
    ];

    beforeEach(() => {
      mockGridModel.findByStrategy.mockResolvedValue(mockHistoricalGrids as any);
    });

    it('should optimize for profit metric', async () => {
      const params = {
        symbol: 'BTCUSDT',
        strategy: 'fibonacci' as GridStrategy,
        timeframe: '1h',
        lookbackPeriod: 30,
        optimizationMetric: 'profit' as const
      };

      const result = await gridService.optimizeGridParameters(params);

      expect(result.optimalSpacing).toBe(200); // Grid-2 had higher profit
      expect(result.expectedReturn).toBe(200);
      expect(result.backtestResults).toBeDefined();
      expect(result.backtestResults.totalProfit).toBe(200);
    });

    it('should optimize for Sharpe ratio metric', async () => {
      const params = {
        symbol: 'BTCUSDT',
        strategy: 'fibonacci' as GridStrategy,
        timeframe: '1h',
        lookbackPeriod: 30,
        optimizationMetric: 'sharpe_ratio' as const
      };

      const result = await gridService.optimizeGridParameters(params);

      expect(result.optimalSpacing).toBe(200); // Grid-2 had higher Sharpe ratio
      expect(result.backtestResults.sharpeRatio).toBe(1.8);
    });

    it('should throw error with insufficient historical data', async () => {
      mockGridModel.findByStrategy.mockResolvedValue([]);

      const params = {
        symbol: 'BTCUSDT',
        strategy: 'fibonacci' as GridStrategy,
        timeframe: '1h',
        lookbackPeriod: 30,
        optimizationMetric: 'profit' as const
      };

      await expect(gridService.optimizeGridParameters(params)).rejects.toThrow(
        'Insufficient historical data for optimization'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle Elliott Wave grid calculation errors', async () => {
      const invalidConfig = {
        symbol: 'BTCUSDT',
        strategy: 'elliott_wave' as GridStrategy,
        riskParameters: mockRiskParameters,
        elliottWaveConfig: {
          waveAnalysis: mockWaveStructure,
          longWaves: [],
          shortWaves: [],
          invalidationLevel: 46500,
          waveTargets: []
        }
      };

      await expect(gridService.calculateElliottWaveGrid(invalidConfig)).rejects.toThrow();
    });

    it('should handle database errors gracefully', async () => {
      mockGridModel.findById.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        gridService.monitorGridPerformance('grid-123', 47600)
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle missing grid gracefully in invalidation check', async () => {
      mockGridModel.findById.mockResolvedValue(null);

      await expect(
        gridService.checkGridInvalidation('nonexistent-grid', 47600)
      ).rejects.toThrow('Grid nonexistent-grid not found');
    });
  });

  describe('Integration Tests', () => {
    it('should create complete Elliott Wave grid workflow', async () => {
      // 1. Calculate grid
      const config: GridConfig & { elliottWaveConfig: ElliottWaveGridConfig } = {
        symbol: 'BTCUSDT',
        strategy: 'elliott_wave' as GridStrategy,
        basePrice: 47000,
        quantity: 0.1,
        riskParameters: mockRiskParameters,
        elliottWaveConfig: {
          waveAnalysis: mockWaveStructure,
          longWaves: ['wave_1', 'wave_3', 'wave_5'],
          shortWaves: ['wave_a', 'wave_b', 'wave_c'],
          invalidationLevel: 46500,
          waveTargets: [48000, 49000, 50000]
        }
      };

      const calculationResult = await gridService.calculateElliottWaveGrid(config);
      expect(calculationResult.levels.length).toBeGreaterThan(0);

      // 2. Monitor performance
      mockGridModel.findById.mockResolvedValue({
        ...mockGrid,
        levels: calculationResult.levels
      });

      const monitoringResult = await gridService.monitorGridPerformance('grid-123', 47600);
      expect(monitoringResult.gridId).toBe('grid-123');

      // 3. Check invalidation
      const invalidationResult = await gridService.checkGridInvalidation('grid-123', 47600, mockWaveStructure);
      expect(invalidationResult.isInvalidated).toBe(false);

      // 4. Adjust levels
      const adjustmentResult = await gridService.adjustGridLevels('grid-123', {
        currentPrice: 47600,
        waveStructure: mockWaveStructure
      });
      expect(adjustmentResult.adjustedLevels).toBeDefined();
    });
  });
});