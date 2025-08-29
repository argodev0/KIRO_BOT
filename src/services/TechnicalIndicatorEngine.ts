/**
 * Technical Indicator Calculation Engine
 * Real-time calculation engine for RSI, MACD, and Bollinger Bands with multi-timeframe support and caching
 */

import { EventEmitter } from 'events';
import { createClient, RedisClientType } from 'redis';
import { CandleData, Timeframe } from '../types/market';
import { RSICalculator, RSIResult } from './indicators/RSICalculator';
import { MACDCalculator, MACDResult } from './indicators/MACDCalculator';
import { BollingerBandsCalculator, BollingerBandsResult } from './indicators/BollingerBandsCalculator';
import { MarketDataService } from './MarketDataService';
import { logger } from '../utils/logger';

export interface IndicatorConfig {
  rsi: {
    period: number;
    overbought: number;
    oversold: number;
  };
  macd: {
    fastPeriod: number;
    slowPeriod: number;
    signalPeriod: number;
  };
  bollingerBands: {
    period: number;
    standardDeviations: number;
  };
}

export interface IndicatorResults {
  symbol: string;
  timeframe: Timeframe;
  timestamp: number;
  rsi: RSIResult;
  macd: MACDResult;
  bollingerBands: BollingerBandsResult;
  candles: CandleData[];
}

export interface MultiTimeframeIndicators {
  symbol: string;
  timestamp: number;
  timeframes: Record<Timeframe, IndicatorResults>;
}

export interface EngineConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  caching: {
    ttl: number; // Cache TTL in seconds
    maxCandleHistory: number; // Maximum candles to keep in memory
  };
  calculation: {
    batchSize: number;
    updateInterval: number; // milliseconds
    enableRealtime: boolean;
  };
  timeframes: Timeframe[];
}

export class TechnicalIndicatorEngine extends EventEmitter {
  private redis: RedisClientType;
  private marketDataService: MarketDataService;
  private config: EngineConfig;
  private indicatorConfig: IndicatorConfig;
  
  // Calculators
  private rsiCalculator: RSICalculator;
  private macdCalculator: MACDCalculator;
  private bollingerBandsCalculator: BollingerBandsCalculator;
  
  // Cache and state management
  private candleCache: Map<string, CandleData[]> = new Map();
  private indicatorCache: Map<string, IndicatorResults> = new Map();
  private subscriptions: Set<string> = new Set();
  private updateTimers: Map<string, NodeJS.Timeout> = new Map();
  
  private isRunning: boolean = false;

  constructor(
    marketDataService: MarketDataService,
    config: EngineConfig,
    indicatorConfig?: Partial<IndicatorConfig>
  ) {
    super();
    this.marketDataService = marketDataService;
    this.config = config;
    
    // Initialize indicator configuration
    this.indicatorConfig = {
      rsi: { period: 14, overbought: 70, oversold: 30 },
      macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      bollingerBands: { period: 20, standardDeviations: 2 },
      ...indicatorConfig,
    };
    
    // Initialize calculators
    this.rsiCalculator = new RSICalculator(this.indicatorConfig.rsi);
    this.macdCalculator = new MACDCalculator(this.indicatorConfig.macd);
    this.bollingerBandsCalculator = new BollingerBandsCalculator(this.indicatorConfig.bollingerBands);
    
    // Initialize Redis client
    const redisConfig: any = {
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      database: config.redis.db,
    };
    
    if (config.redis.password) {
      redisConfig.password = config.redis.password;
    }
    
    this.redis = createClient(redisConfig);
    
    this.setupEventHandlers();
  }

  /**
   * Start the indicator calculation engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('TechnicalIndicatorEngine is already running');
      return;
    }

    try {
      // Connect to Redis
      await this.redis.connect();
      
      // Start real-time updates if enabled
      if (this.config.calculation.enableRealtime) {
        this.startRealtimeUpdates();
      }
      
      this.isRunning = true;
      this.emit('started');
      logger.info('TechnicalIndicatorEngine started successfully');
    } catch (error) {
      logger.error('Failed to start TechnicalIndicatorEngine:', error);
      throw error;
    }
  }

  /**
   * Stop the indicator calculation engine
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop all update timers
      for (const timer of this.updateTimers.values()) {
        clearInterval(timer);
      }
      this.updateTimers.clear();
      
      // Clear subscriptions
      this.subscriptions.clear();
      
      // Close Redis connection
      await this.redis.disconnect();
      
      this.isRunning = false;
      this.emit('stopped');
      logger.info('TechnicalIndicatorEngine stopped successfully');
    } catch (error) {
      logger.error('Error stopping TechnicalIndicatorEngine:', error);
      throw error;
    }
  }

  /**
   * Calculate indicators for a specific symbol and timeframe
   */
  async calculateIndicators(
    symbol: string,
    timeframe: Timeframe,
    limit: number = 100,
    useCache: boolean = true
  ): Promise<IndicatorResults> {
    try {
      const cacheKey = this.getCacheKey(symbol, timeframe);
      
      // Check cache first if enabled
      if (useCache) {
        const cached = await this.getFromCache(cacheKey);
        if (cached && this.isCacheValid(cached)) {
          logger.debug(`Retrieved cached indicators for ${symbol} ${timeframe}`);
          return cached;
        }
      }
      
      // Get historical candle data
      const candles = await this.marketDataService.getHistoricalCandles(
        symbol,
        timeframe,
        Math.max(limit, this.getRequiredCandleCount())
      );
      
      if (candles.length < this.getRequiredCandleCount()) {
        throw new Error(`Insufficient candle data for ${symbol} ${timeframe}. Need at least ${this.getRequiredCandleCount()} candles`);
      }
      
      // Calculate all indicators
      const results = await this.performCalculations(symbol, timeframe, candles);
      
      // Cache the results
      if (useCache) {
        await this.saveToCache(cacheKey, results);
      }
      
      // Update in-memory cache
      this.indicatorCache.set(cacheKey, results);
      this.updateCandleCache(symbol, timeframe, candles);
      
      // Emit update event
      this.emit('indicatorsUpdated', results);
      
      logger.info(`Calculated indicators for ${symbol} ${timeframe}`);
      return results;
    } catch (error) {
      logger.error(`Failed to calculate indicators for ${symbol} ${timeframe}:`, error);
      throw error;
    }
  }

  /**
   * Get multi-timeframe indicators for a symbol
   */
  async getMultiTimeframeIndicators(
    symbol: string,
    timeframes?: Timeframe[],
    useCache: boolean = true
  ): Promise<MultiTimeframeIndicators> {
    const targetTimeframes = timeframes || this.config.timeframes;
    const results: Record<Timeframe, IndicatorResults> = {} as Record<Timeframe, IndicatorResults>;
    
    const promises = targetTimeframes.map(async (timeframe) => {
      try {
        const indicators = await this.calculateIndicators(symbol, timeframe, 100, useCache);
        results[timeframe] = indicators;
      } catch (error) {
        logger.error(`Failed to calculate ${timeframe} indicators for ${symbol}:`, error);
      }
    });
    
    await Promise.all(promises);
    
    return {
      symbol,
      timestamp: Date.now(),
      timeframes: results,
    };
  }

  /**
   * Subscribe to real-time indicator updates for a symbol
   */
  async subscribeToSymbol(symbol: string, timeframes?: Timeframe[]): Promise<void> {
    const targetTimeframes = timeframes || this.config.timeframes;
    
    for (const timeframe of targetTimeframes) {
      const subscriptionKey = `${symbol}:${timeframe}`;
      
      if (!this.subscriptions.has(subscriptionKey)) {
        this.subscriptions.add(subscriptionKey);
        
        // Start periodic updates
        const timer = setInterval(async () => {
          try {
            await this.updateIndicators(symbol, timeframe);
          } catch (error) {
            logger.error(`Failed to update indicators for ${subscriptionKey}:`, error);
          }
        }, this.config.calculation.updateInterval);
        
        this.updateTimers.set(subscriptionKey, timer);
        
        logger.info(`Subscribed to indicator updates for ${subscriptionKey}`);
      }
    }
  }

  /**
   * Unsubscribe from real-time indicator updates
   */
  unsubscribeFromSymbol(symbol: string, timeframes?: Timeframe[]): void {
    const targetTimeframes = timeframes || this.config.timeframes;
    
    for (const timeframe of targetTimeframes) {
      const subscriptionKey = `${symbol}:${timeframe}`;
      
      if (this.subscriptions.has(subscriptionKey)) {
        this.subscriptions.delete(subscriptionKey);
        
        const timer = this.updateTimers.get(subscriptionKey);
        if (timer) {
          clearInterval(timer);
          this.updateTimers.delete(subscriptionKey);
        }
        
        logger.info(`Unsubscribed from indicator updates for ${subscriptionKey}`);
      }
    }
  }

  /**
   * Get current indicator values for real-time display
   */
  async getCurrentIndicators(symbol: string, timeframe: Timeframe): Promise<IndicatorResults | null> {
    const cacheKey = this.getCacheKey(symbol, timeframe);
    
    // Try memory cache first
    const memoryCache = this.indicatorCache.get(cacheKey);
    if (memoryCache && this.isCacheValid(memoryCache)) {
      return memoryCache;
    }
    
    // Try Redis cache
    const redisCache = await this.getFromCache(cacheKey);
    if (redisCache && this.isCacheValid(redisCache)) {
      this.indicatorCache.set(cacheKey, redisCache);
      return redisCache;
    }
    
    return null;
  }

  /**
   * Force recalculation of indicators (bypass cache)
   */
  async recalculateIndicators(symbol: string, timeframe: Timeframe): Promise<IndicatorResults> {
    const cacheKey = this.getCacheKey(symbol, timeframe);
    
    // Clear cache
    this.indicatorCache.delete(cacheKey);
    await this.redis.del(cacheKey);
    
    // Recalculate
    return await this.calculateIndicators(symbol, timeframe, 100, false);
  }

  /**
   * Get indicator analysis and signals
   */
  getIndicatorAnalysis(results: IndicatorResults): {
    rsi: ReturnType<RSICalculator['getInterpretation']>;
    macd: ReturnType<MACDCalculator['getInterpretation']>;
    bollingerBands: ReturnType<BollingerBandsCalculator['getInterpretation']>;
    consensus: {
      signal: 'buy' | 'sell' | 'neutral';
      strength: 'weak' | 'moderate' | 'strong';
      confidence: number;
    };
  } {
    const rsiAnalysis = this.rsiCalculator.getInterpretation(results.rsi.value);
    const macdAnalysis = this.macdCalculator.getInterpretation(results.macd);
    const bbAnalysis = this.bollingerBandsCalculator.getInterpretation(results.bollingerBands);
    
    // Calculate consensus
    const signals = [rsiAnalysis.signal, macdAnalysis.signal, bbAnalysis.signal];
    const buySignals = signals.filter(s => s.toLowerCase().includes('buy')).length;
    const sellSignals = signals.filter(s => s.toLowerCase().includes('sell')).length;
    
    let consensusSignal: 'buy' | 'sell' | 'neutral';
    let consensusStrength: 'weak' | 'moderate' | 'strong';
    let confidence: number;
    
    if (buySignals > sellSignals) {
      consensusSignal = 'buy';
      consensusStrength = buySignals >= 2 ? 'strong' : 'moderate';
      confidence = buySignals / signals.length;
    } else if (sellSignals > buySignals) {
      consensusSignal = 'sell';
      consensusStrength = sellSignals >= 2 ? 'strong' : 'moderate';
      confidence = sellSignals / signals.length;
    } else {
      consensusSignal = 'neutral';
      consensusStrength = 'weak';
      confidence = 0.3;
    }
    
    return {
      rsi: rsiAnalysis,
      macd: macdAnalysis,
      bollingerBands: bbAnalysis,
      consensus: {
        signal: consensusSignal,
        strength: consensusStrength,
        confidence,
      },
    };
  }

  // Private methods
  private setupEventHandlers(): void {
    // Listen for new candle data from market data service
    this.marketDataService.on('candle', (candle: CandleData) => {
      this.handleNewCandle(candle);
    });
    
    // Handle market data service events
    this.marketDataService.on('exchangeConnected', (exchange) => {
      logger.info(`Market data connected to ${exchange} - resuming indicator calculations`);
    });
    
    this.marketDataService.on('exchangeDisconnected', (exchange) => {
      logger.warn(`Market data disconnected from ${exchange} - indicator updates may be delayed`);
    });
  }

  private async performCalculations(
    symbol: string,
    timeframe: Timeframe,
    candles: CandleData[]
  ): Promise<IndicatorResults> {
    try {
      // Calculate RSI
      const rsiValues = await this.rsiCalculator.calculate(candles);
      const rsiDetailed = await this.rsiCalculator.calculateDetailed(candles);
      const latestRSI = rsiDetailed[rsiDetailed.length - 1];
      
      // Calculate MACD
      const macdValues = await this.macdCalculator.calculate(candles);
      const latestMACD = macdValues[macdValues.length - 1];
      
      // Calculate Bollinger Bands
      const bbValues = await this.bollingerBandsCalculator.calculate(candles);
      const latestBB = bbValues[bbValues.length - 1];
      
      return {
        symbol,
        timeframe,
        timestamp: Date.now(),
        rsi: latestRSI,
        macd: latestMACD,
        bollingerBands: latestBB,
        candles: candles.slice(-50), // Keep last 50 candles for context
      };
    } catch (error) {
      logger.error(`Error performing calculations for ${symbol} ${timeframe}:`, error);
      throw error;
    }
  }

  private async handleNewCandle(candle: CandleData): Promise<void> {
    const subscriptionKey = `${candle.symbol}:${candle.timeframe}`;
    
    if (this.subscriptions.has(subscriptionKey)) {
      try {
        // Update candle cache
        this.updateCandleCache(candle.symbol, candle.timeframe as Timeframe, [candle]);
        
        // Recalculate indicators
        await this.updateIndicators(candle.symbol, candle.timeframe as Timeframe);
      } catch (error) {
        logger.error(`Failed to handle new candle for ${subscriptionKey}:`, error);
      }
    }
  }

  private async updateIndicators(symbol: string, timeframe: Timeframe): Promise<void> {
    try {
      const results = await this.calculateIndicators(symbol, timeframe, 100, false);
      
      // Emit real-time update
      this.emit('realtimeUpdate', results);
      
      logger.debug(`Updated indicators for ${symbol} ${timeframe}`);
    } catch (error) {
      logger.error(`Failed to update indicators for ${symbol} ${timeframe}:`, error);
    }
  }

  private updateCandleCache(symbol: string, timeframe: Timeframe, newCandles: CandleData[]): void {
    const cacheKey = `candles:${symbol}:${timeframe}`;
    const existing = this.candleCache.get(cacheKey) || [];
    
    // Merge new candles with existing ones
    const merged = [...existing, ...newCandles];
    
    // Remove duplicates and sort by timestamp
    const unique = merged
      .filter((candle, index, arr) => 
        arr.findIndex(c => c.timestamp === candle.timestamp) === index
      )
      .sort((a, b) => a.timestamp - b.timestamp);
    
    // Keep only the most recent candles
    const trimmed = unique.slice(-this.config.caching.maxCandleHistory);
    
    this.candleCache.set(cacheKey, trimmed);
  }

  private startRealtimeUpdates(): void {
    logger.info('Starting real-time indicator updates');
    
    // Subscribe to market data updates
    this.marketDataService.on('candle', (candle: CandleData) => {
      this.handleNewCandle(candle);
    });
  }

  private getCacheKey(symbol: string, timeframe: Timeframe): string {
    return `indicators:${symbol}:${timeframe}`;
  }

  private async getFromCache(key: string): Promise<IndicatorResults | null> {
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error(`Failed to get from cache: ${key}`, error);
      return null;
    }
  }

  private async saveToCache(key: string, data: IndicatorResults): Promise<void> {
    try {
      await this.redis.setEx(key, this.config.caching.ttl, JSON.stringify(data));
    } catch (error) {
      logger.error(`Failed to save to cache: ${key}`, error);
    }
  }

  private isCacheValid(data: IndicatorResults): boolean {
    const age = Date.now() - data.timestamp;
    const maxAge = this.config.caching.ttl * 1000; // Convert to milliseconds
    return age < maxAge;
  }

  private getRequiredCandleCount(): number {
    return Math.max(
      this.indicatorConfig.rsi.period + 1,
      this.indicatorConfig.macd.slowPeriod + this.indicatorConfig.macd.signalPeriod,
      this.indicatorConfig.bollingerBands.period
    ) + 20; // Add buffer for calculations
  }

  /**
   * Update indicator configuration
   */
  updateIndicatorConfig(newConfig: Partial<IndicatorConfig>): void {
    this.indicatorConfig = { ...this.indicatorConfig, ...newConfig };
    
    // Update calculators
    if (newConfig.rsi) {
      this.rsiCalculator.updateConfig(newConfig.rsi);
    }
    if (newConfig.macd) {
      this.macdCalculator.updateConfig(newConfig.macd);
    }
    if (newConfig.bollingerBands) {
      this.bollingerBandsCalculator.updateConfig(newConfig.bollingerBands);
    }
    
    // Clear cache to force recalculation with new config
    this.indicatorCache.clear();
    
    logger.info('Updated indicator configuration', newConfig);
  }

  /**
   * Get current configuration
   */
  getConfig(): { engine: EngineConfig; indicators: IndicatorConfig } {
    return {
      engine: this.config,
      indicators: this.indicatorConfig,
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    indicatorCacheSize: number;
    candleCacheSize: number;
    subscriptions: number;
    activeTimers: number;
  } {
    return {
      indicatorCacheSize: this.indicatorCache.size,
      candleCacheSize: this.candleCache.size,
      subscriptions: this.subscriptions.size,
      activeTimers: this.updateTimers.size,
    };
  }
}