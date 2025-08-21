import { CandleData, OrderBookData, TradeData, TickerData } from '../../types/market';

export interface MarketDataOptions {
  symbol?: string;
  timeframe?: string;
  count?: number;
  startPrice?: number;
  volatility?: number;
  trend?: 'bullish' | 'bearish' | 'sideways';
  pattern?: 'elliott-wave' | 'fibonacci' | 'candlestick' | 'none';
}

export interface ElliottWaveOptions {
  waveType: 'impulse' | 'corrective';
  degree: 'minute' | 'minor' | 'intermediate' | 'primary';
  currentWave: 1 | 2 | 3 | 4 | 5 | 'A' | 'B' | 'C';
  basePrice: number;
  waveHeight: number;
}

export interface FibonacciScenario {
  type: 'retracement' | 'extension';
  high: number;
  low: number;
  retracementLevel?: 0.236 | 0.382 | 0.5 | 0.618 | 0.786;
  extensionLevel?: 1.272 | 1.618 | 2.618;
}

export class MarketDataFactory {
  /**
   * Generate realistic OHLCV candlestick data
   */
  static createCandles(options: MarketDataOptions = {}): CandleData[] {
    const {
      symbol = 'BTCUSDT',
      timeframe = '1h',
      count = 100,
      startPrice = 50000,
      volatility = 0.02,
      trend = 'sideways',
      pattern = 'none'
    } = options;

    const candles: CandleData[] = [];
    let currentPrice = startPrice;
    const baseTime = Date.now() - (count * this.getTimeframeMs(timeframe));

    for (let i = 0; i < count; i++) {
      const timestamp = baseTime + (i * this.getTimeframeMs(timeframe));
      
      // Apply trend bias
      const trendBias = this.getTrendBias(trend, i, count);
      
      // Apply pattern-specific price movement
      const patternBias = this.getPatternBias(pattern, i, count, startPrice);
      
      // Generate OHLCV with realistic relationships
      const open = currentPrice;
      const priceChange = (Math.random() - 0.5) * volatility * currentPrice + trendBias + patternBias;
      const close = open + priceChange;
      
      const high = Math.max(open, close) + Math.random() * volatility * currentPrice * 0.3;
      const low = Math.min(open, close) - Math.random() * volatility * currentPrice * 0.3;
      
      const volume = this.generateRealisticVolume(Math.abs(priceChange), currentPrice);

      candles.push({
        symbol,
        timeframe,
        timestamp,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: Number(volume.toFixed(8))
      });

      currentPrice = close;
    }

    return candles;
  }

  /**
   * Generate Elliott Wave pattern data
   */
  static createElliottWaveData(options: ElliottWaveOptions): CandleData[] {
    const { waveType, degree, currentWave, basePrice, waveHeight } = options;
    
    if (waveType === 'impulse') {
      return this.generateImpulseWave(currentWave as number, basePrice, waveHeight);
    } else {
      return this.generateCorrectiveWave(currentWave as string, basePrice, waveHeight);
    }
  }

  /**
   * Generate Fibonacci retracement/extension scenario
   */
  static createFibonacciScenario(scenario: FibonacciScenario): CandleData[] {
    const { type, high, low, retracementLevel, extensionLevel } = scenario;
    const candles: CandleData[] = [];
    
    if (type === 'retracement' && retracementLevel) {
      const targetPrice = high - ((high - low) * retracementLevel);
      return this.generateRetracementMove(high, low, targetPrice);
    } else if (type === 'extension' && extensionLevel) {
      const targetPrice = high + ((high - low) * (extensionLevel - 1));
      return this.generateExtensionMove(high, low, targetPrice);
    }
    
    return candles;
  }

  /**
   * Generate order book data
   */
  static createOrderBook(symbol: string = 'BTCUSDT', midPrice: number = 50000): OrderBookData {
    const spread = midPrice * 0.0001; // 0.01% spread
    const bidPrice = midPrice - spread / 2;
    const askPrice = midPrice + spread / 2;

    const bids: [number, number][] = [];
    const asks: [number, number][] = [];

    // Generate 20 levels each side
    for (let i = 0; i < 20; i++) {
      const bidLevel = bidPrice - (i * spread * 0.1);
      const askLevel = askPrice + (i * spread * 0.1);
      
      const bidQuantity = Math.random() * 10 + 0.1;
      const askQuantity = Math.random() * 10 + 0.1;
      
      bids.push([Number(bidLevel.toFixed(2)), Number(bidQuantity.toFixed(8))]);
      asks.push([Number(askLevel.toFixed(2)), Number(askQuantity.toFixed(8))]);
    }

    return {
      symbol,
      exchange: 'binance',
      timestamp: Date.now(),
      bids,
      asks
    };
  }

  /**
   * Generate ticker data
   */
  static createTicker(symbol: string = 'BTCUSDT', price: number = 50000): TickerData {
    const spread = price * 0.0001;
    return {
      symbol,
      exchange: 'binance',
      price,
      volume: Math.random() * 1000 + 100,
      timestamp: Date.now(),
      bid: price - spread / 2,
      ask: price + spread / 2
    };
  }

  /**
   * Generate trade data
   */
  static createTrades(symbol: string = 'BTCUSDT', count: number = 10): TradeData[] {
    const trades: TradeData[] = [];
    const basePrice = 50000;
    const baseTime = Date.now();

    for (let i = 0; i < count; i++) {
      trades.push({
        symbol,
        exchange: 'binance',
        price: basePrice + (Math.random() - 0.5) * 100,
        quantity: Math.random() * 5 + 0.1,
        side: Math.random() > 0.5 ? 'buy' : 'sell',
        timestamp: baseTime + i * 1000
      });
    }

    return trades;
  }

  // Helper methods
  private static getTimeframeMs(timeframe: string): number {
    const timeframes: { [key: string]: number } = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    return timeframes[timeframe] || timeframes['1h'];
  }

  private static getTrendBias(trend: string, index: number, total: number): number {
    const progress = index / total;
    switch (trend) {
      case 'bullish':
        return progress * 50; // Gradual upward bias
      case 'bearish':
        return -progress * 50; // Gradual downward bias
      default:
        return 0;
    }
  }

  private static getPatternBias(pattern: string, index: number, total: number, basePrice: number): number {
    const progress = index / total;
    
    switch (pattern) {
      case 'elliott-wave':
        // Simulate 5-wave impulse pattern
        const wavePhase = (progress * 5) % 1;
        const waveNumber = Math.floor(progress * 5) + 1;
        
        if ([1, 3, 5].includes(waveNumber)) {
          return Math.sin(wavePhase * Math.PI) * basePrice * 0.05; // Impulse waves up
        } else {
          return -Math.sin(wavePhase * Math.PI) * basePrice * 0.02; // Corrective waves down
        }
        
      case 'fibonacci':
        // Simulate retracement to 61.8% level
        if (progress < 0.5) {
          return basePrice * 0.1 * progress; // Move up
        } else {
          return basePrice * 0.1 * (1 - progress) * 0.618; // Retrace to 61.8%
        }
        
      default:
        return 0;
    }
  }

  private static generateRealisticVolume(priceChange: number, currentPrice: number): number {
    // Higher volume on larger price moves
    const baseVolume = 100;
    const volatilityMultiplier = Math.abs(priceChange) / currentPrice * 1000;
    return baseVolume + (Math.random() * volatilityMultiplier * 50);
  }

  private static generateImpulseWave(currentWave: number, basePrice: number, waveHeight: number): CandleData[] {
    const candles: CandleData[] = [];
    const waveLength = 20; // 20 candles per wave
    
    for (let wave = 1; wave <= currentWave; wave++) {
      const isImpulse = [1, 3, 5].includes(wave);
      const direction = isImpulse ? 1 : -1;
      const magnitude = isImpulse ? waveHeight : waveHeight * 0.5;
      
      for (let i = 0; i < waveLength; i++) {
        const progress = i / waveLength;
        const waveProgress = Math.sin(progress * Math.PI);
        const price = basePrice + (direction * magnitude * waveProgress);
        
        candles.push({
          symbol: 'BTCUSDT',
          timeframe: '1h',
          timestamp: Date.now() + ((wave - 1) * waveLength + i) * 3600000,
          open: price,
          high: price + Math.random() * 50,
          low: price - Math.random() * 50,
          close: price,
          volume: 100 + Math.random() * 200
        });
      }
      
      basePrice += direction * magnitude;
    }
    
    return candles;
  }

  private static generateCorrectiveWave(currentWave: string, basePrice: number, waveHeight: number): CandleData[] {
    const candles: CandleData[] = [];
    const waves = ['A', 'B', 'C'];
    const currentIndex = waves.indexOf(currentWave);
    
    for (let i = 0; i <= currentIndex; i++) {
      const wave = waves[i];
      const direction = wave === 'B' ? 1 : -1; // B wave goes against main trend
      const magnitude = wave === 'B' ? waveHeight * 0.5 : waveHeight;
      
      for (let j = 0; j < 15; j++) {
        const progress = j / 15;
        const waveProgress = Math.sin(progress * Math.PI);
        const price = basePrice + (direction * magnitude * waveProgress);
        
        candles.push({
          symbol: 'BTCUSDT',
          timeframe: '1h',
          timestamp: Date.now() + (i * 15 + j) * 3600000,
          open: price,
          high: price + Math.random() * 30,
          low: price - Math.random() * 30,
          close: price,
          volume: 80 + Math.random() * 150
        });
      }
      
      basePrice += direction * magnitude;
    }
    
    return candles;
  }

  private static generateRetracementMove(high: number, low: number, targetPrice: number): CandleData[] {
    const candles: CandleData[] = [];
    const steps = 30;
    
    // First, move from low to high
    for (let i = 0; i < steps / 2; i++) {
      const progress = i / (steps / 2);
      const price = low + (high - low) * progress;
      
      candles.push({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: Date.now() + i * 3600000,
        open: price,
        high: price + Math.random() * 50,
        low: price - Math.random() * 50,
        close: price,
        volume: 100 + Math.random() * 200
      });
    }
    
    // Then retrace to target
    for (let i = 0; i < steps / 2; i++) {
      const progress = i / (steps / 2);
      const price = high - (high - targetPrice) * progress;
      
      candles.push({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: Date.now() + (steps / 2 + i) * 3600000,
        open: price,
        high: price + Math.random() * 30,
        low: price - Math.random() * 30,
        close: price,
        volume: 80 + Math.random() * 150
      });
    }
    
    return candles;
  }

  private static generateExtensionMove(high: number, low: number, targetPrice: number): CandleData[] {
    const candles: CandleData[] = [];
    const steps = 40;
    
    // Move from low to high, then extend beyond
    for (let i = 0; i < steps; i++) {
      const progress = i / steps;
      const price = low + (targetPrice - low) * progress;
      
      candles.push({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: Date.now() + i * 3600000,
        open: price,
        high: price + Math.random() * 50,
        low: price - Math.random() * 50,
        close: price,
        volume: 100 + Math.random() * 200
      });
    }
    
    return candles;
  }
}