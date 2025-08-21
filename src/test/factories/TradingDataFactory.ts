import { TradingSignal, Position, Portfolio, Grid, GridLevel } from '../../types/trading';
import { AnalysisResults, TechnicalIndicators } from '../../types/analysis';
import { WaveStructure, Wave, FibonacciLevels } from '../../types/analysis';

export interface SignalOptions {
  symbol?: string;
  direction?: 'long' | 'short';
  confidence?: number;
  entryPrice?: number;
  withStopLoss?: boolean;
  withTakeProfit?: boolean;
  reasoning?: Partial<SignalReasoning>;
}

export interface PositionOptions {
  symbol?: string;
  side?: 'long' | 'short';
  size?: number;
  entryPrice?: number;
  currentPrice?: number;
  withStopLoss?: boolean;
  withTakeProfit?: boolean;
}

export interface PortfolioOptions {
  totalBalance?: number;
  positionCount?: number;
  profitableTrades?: number;
  totalTrades?: number;
}

interface SignalReasoning {
  technical: string[];
  patterns: string[];
  elliottWave: string[];
  fibonacci: string[];
  confluence: string[];
}

export class TradingDataFactory {
  /**
   * Generate realistic trading signals
   */
  static createSignal(options: SignalOptions = {}): TradingSignal {
    const {
      symbol = 'BTCUSDT',
      direction = Math.random() > 0.5 ? 'long' : 'short',
      confidence = Math.random() * 0.4 + 0.6, // 60-100%
      entryPrice = 50000 + (Math.random() - 0.5) * 10000,
      withStopLoss = true,
      withTakeProfit = true,
      reasoning = {}
    } = options;

    const stopLossDistance = entryPrice * 0.02; // 2% stop loss
    const takeProfitDistance = entryPrice * 0.06; // 6% take profit

    const stopLoss = withStopLoss 
      ? direction === 'long' 
        ? entryPrice - stopLossDistance 
        : entryPrice + stopLossDistance
      : undefined;

    const takeProfit = withTakeProfit 
      ? direction === 'long'
        ? [entryPrice + takeProfitDistance, entryPrice + takeProfitDistance * 1.5]
        : [entryPrice - takeProfitDistance, entryPrice - takeProfitDistance * 1.5]
      : [];

    return {
      id: this.generateId(),
      symbol,
      direction,
      confidence: Number(confidence.toFixed(3)),
      entryPrice: Number(entryPrice.toFixed(2)),
      stopLoss: stopLoss ? Number(stopLoss.toFixed(2)) : undefined,
      takeProfit: takeProfit.map(tp => Number(tp.toFixed(2))),
      reasoning: {
        technical: reasoning.technical || ['RSI oversold', 'Wave Trend bullish crossover'],
        patterns: reasoning.patterns || ['Hammer candlestick', 'Support level hold'],
        elliottWave: reasoning.elliottWave || ['Wave 3 impulse beginning'],
        fibonacci: reasoning.fibonacci || ['61.8% retracement support'],
        confluence: reasoning.confluence || ['Multiple timeframe alignment']
      },
      timestamp: Date.now(),
      status: 'pending'
    };
  }

  /**
   * Generate multiple signals with different characteristics
   */
  static createSignalBatch(count: number = 5): TradingSignal[] {
    const signals: TradingSignal[] = [];
    const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT'];
    
    for (let i = 0; i < count; i++) {
      signals.push(this.createSignal({
        symbol: symbols[i % symbols.length],
        confidence: 0.5 + (i / count) * 0.5, // Increasing confidence
        direction: i % 2 === 0 ? 'long' : 'short'
      }));
    }
    
    return signals;
  }

  /**
   * Generate position data
   */
  static createPosition(options: PositionOptions = {}): Position {
    const {
      symbol = 'BTCUSDT',
      side = Math.random() > 0.5 ? 'long' : 'short',
      size = Math.random() * 2 + 0.1,
      entryPrice = 50000 + (Math.random() - 0.5) * 10000,
      currentPrice = entryPrice + (Math.random() - 0.5) * 1000,
      withStopLoss = true,
      withTakeProfit = true
    } = options;

    const unrealizedPnl = side === 'long' 
      ? (currentPrice - entryPrice) * size
      : (entryPrice - currentPrice) * size;

    const stopLoss = withStopLoss 
      ? side === 'long' 
        ? entryPrice * 0.98 
        : entryPrice * 1.02
      : undefined;

    const takeProfit = withTakeProfit 
      ? side === 'long'
        ? [entryPrice * 1.06, entryPrice * 1.12]
        : [entryPrice * 0.94, entryPrice * 0.88]
      : [];

    return {
      id: this.generateId(),
      symbol,
      side,
      size: Number(size.toFixed(8)),
      entryPrice: Number(entryPrice.toFixed(2)),
      currentPrice: Number(currentPrice.toFixed(2)),
      unrealizedPnl: Number(unrealizedPnl.toFixed(2)),
      stopLoss: stopLoss ? Number(stopLoss.toFixed(2)) : undefined,
      takeProfit: takeProfit.map(tp => Number(tp.toFixed(2))),
      timestamp: Date.now() - Math.random() * 86400000 // Random time in last 24h
    };
  }

  /**
   * Generate portfolio data
   */
  static createPortfolio(options: PortfolioOptions = {}): Portfolio {
    const {
      totalBalance = 10000 + Math.random() * 90000,
      positionCount = Math.floor(Math.random() * 8) + 2,
      profitableTrades = Math.floor(Math.random() * 50) + 20,
      totalTrades = profitableTrades + Math.floor(Math.random() * 30) + 10
    } = options;

    const positions: Position[] = [];
    let totalUnrealizedPnl = 0;

    for (let i = 0; i < positionCount; i++) {
      const position = this.createPosition();
      positions.push(position);
      totalUnrealizedPnl += position.unrealizedPnl;
    }

    const availableBalance = totalBalance * 0.3; // 30% available
    const totalRealizedPnl = (Math.random() - 0.3) * totalBalance * 0.2; // -6% to +14%
    const maxDrawdown = Math.random() * 0.15 + 0.05; // 5-20%
    const currentDrawdown = Math.random() * maxDrawdown;

    return {
      totalBalance: Number(totalBalance.toFixed(2)),
      availableBalance: Number(availableBalance.toFixed(2)),
      positions,
      totalUnrealizedPnl: Number(totalUnrealizedPnl.toFixed(2)),
      totalRealizedPnl: Number(totalRealizedPnl.toFixed(2)),
      maxDrawdown: Number(maxDrawdown.toFixed(4)),
      currentDrawdown: Number(currentDrawdown.toFixed(4)),
      winRate: Number((profitableTrades / totalTrades).toFixed(3)),
      totalTrades,
      profitableTrades
    };
  }

  /**
   * Generate grid trading data
   */
  static createGrid(symbol: string = 'BTCUSDT', strategy: 'elliott-wave' | 'fibonacci' | 'standard' = 'fibonacci'): Grid {
    const basePrice = 50000 + (Math.random() - 0.5) * 20000;
    const spacing = basePrice * (0.005 + Math.random() * 0.015); // 0.5-2% spacing
    const levelCount = Math.floor(Math.random() * 10) + 5; // 5-15 levels

    const levels: GridLevel[] = [];
    
    for (let i = 0; i < levelCount; i++) {
      const isAbove = i % 2 === 0;
      const distance = Math.floor(i / 2) + 1;
      const price = isAbove 
        ? basePrice + (distance * spacing)
        : basePrice - (distance * spacing);

      levels.push({
        id: this.generateId(),
        price: Number(price.toFixed(2)),
        quantity: Number((Math.random() * 0.5 + 0.1).toFixed(8)),
        side: isAbove ? 'sell' : 'buy',
        filled: Math.random() > 0.7, // 30% chance of being filled
        fibonacciLevel: strategy === 'fibonacci' ? this.getFibonacciLevel() : undefined,
        waveContext: strategy === 'elliott-wave' ? this.getWaveContext() : undefined
      });
    }

    const filledLevels = levels.filter(l => l.filled);
    const totalProfit = filledLevels.reduce((sum, level) => {
      return sum + (level.quantity * spacing * 0.5); // Approximate profit
    }, 0);

    return {
      id: this.generateId(),
      symbol,
      strategy,
      levels,
      basePrice: Number(basePrice.toFixed(2)),
      spacing: Number(spacing.toFixed(2)),
      totalProfit: Number(totalProfit.toFixed(2)),
      status: Math.random() > 0.8 ? 'paused' : 'active',
      createdAt: Date.now() - Math.random() * 604800000, // Random time in last week
      updatedAt: Date.now()
    };
  }

  /**
   * Generate analysis results for testing
   */
  static createAnalysisResults(symbol: string = 'BTCUSDT'): AnalysisResults {
    return {
      symbol,
      timestamp: Date.now(),
      technical: this.createTechnicalIndicators(),
      patterns: this.createCandlestickPatterns(),
      elliottWave: this.createWaveStructure(),
      fibonacci: this.createFibonacciLevels(),
      confluence: this.createConfluenceZones(),
      marketRegime: {
        type: Math.random() > 0.5 ? 'trending' : 'ranging',
        strength: Math.random(),
        direction: Math.random() > 0.5 ? 'bullish' : 'bearish',
        confidence: Math.random() * 0.4 + 0.6
      }
    };
  }

  // Helper methods
  private static generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private static getFibonacciLevel(): number {
    const levels = [0.236, 0.382, 0.5, 0.618, 0.786];
    return levels[Math.floor(Math.random() * levels.length)];
  }

  private static getWaveContext(): any {
    const waves = [1, 2, 3, 4, 5, 'A', 'B', 'C'];
    return {
      currentWave: waves[Math.floor(Math.random() * waves.length)],
      degree: ['minute', 'minor', 'intermediate'][Math.floor(Math.random() * 3)],
      direction: Math.random() > 0.5 ? 'impulse' : 'corrective'
    };
  }

  private static createTechnicalIndicators(): TechnicalIndicators {
    return {
      rsi: Math.random() * 100,
      waveTrend: {
        wt1: (Math.random() - 0.5) * 100,
        wt2: (Math.random() - 0.5) * 100,
        signal: Math.random() > 0.5 ? 'bullish' : 'bearish'
      },
      pvt: Math.random() * 1000000,
      supportLevels: [48000, 47500, 47000].map(p => p + Math.random() * 1000),
      resistanceLevels: [52000, 52500, 53000].map(p => p + Math.random() * 1000),
      trend: ['bullish', 'bearish', 'sideways'][Math.floor(Math.random() * 3)] as any
    };
  }

  private static createCandlestickPatterns(): any[] {
    const patterns = ['hammer', 'doji', 'engulfing', 'shooting-star'];
    return [{
      type: patterns[Math.floor(Math.random() * patterns.length)],
      confidence: Math.random() * 0.4 + 0.6,
      direction: Math.random() > 0.5 ? 'bullish' : 'bearish',
      strength: ['weak', 'moderate', 'strong'][Math.floor(Math.random() * 3)]
    }];
  }

  private static createWaveStructure(): WaveStructure {
    return {
      waves: [],
      currentWave: {
        number: Math.floor(Math.random() * 5) + 1,
        type: Math.random() > 0.5 ? 'impulse' : 'corrective',
        degree: 'minor',
        startPrice: 48000,
        endPrice: 52000,
        startTime: Date.now() - 86400000,
        endTime: Date.now()
      },
      waveCount: Math.floor(Math.random() * 5) + 1,
      degree: 'minor',
      validity: Math.random() * 0.4 + 0.6,
      nextTargets: []
    };
  }

  private static createFibonacciLevels(): FibonacciLevels {
    const high = 52000;
    const low = 48000;
    
    return {
      levels: [
        { ratio: 0.236, price: high - (high - low) * 0.236, type: 'retracement' },
        { ratio: 0.382, price: high - (high - low) * 0.382, type: 'retracement' },
        { ratio: 0.618, price: high - (high - low) * 0.618, type: 'retracement' }
      ],
      highPrice: high,
      lowPrice: low,
      confluenceZones: []
    };
  }

  private static createConfluenceZones(): any[] {
    return [{
      price: 50000 + Math.random() * 2000,
      strength: Math.random() * 0.4 + 0.6,
      factors: ['fibonacci', 'support', 'elliott-wave'],
      timeframe: '4h'
    }];
  }
}