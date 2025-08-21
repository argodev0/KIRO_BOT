/**
 * Data Processing Pipeline
 * Orchestrates market data ingestion, validation, processing, and storage
 */

import { EventEmitter } from 'events';
import { MarketDataService, MarketDataServiceConfig } from './MarketDataService';
import { ExchangeManager, ExchangeName } from './exchanges/ExchangeManager';
import { DataValidator } from './DataValidator';
import { TimeframeAggregator } from './TimeframeAggregator';
import { CandleData, TickerData, OrderBookData, TradeData, Timeframe } from '../types/market';
import { logger } from '../utils/logger';

export interface PipelineConfig {
  marketData: MarketDataServiceConfig;
  processing: {
    batchSize: number;
    processingInterval: number;
    retryAttempts: number;
    retryDelay: number;
  };
  quality: {
    minValidationRate: number;
    maxErrorRate: number;
    alertThresholds: {
      dataLag: number; // milliseconds
      validationFailures: number;
      processingErrors: number;
    };
  };
}

export interface PipelineMetrics {
  processed: {
    candles: number;
    tickers: number;
    orderBooks: number;
    trades: number;
  };
  errors: {
    validation: number;
    processing: number;
    storage: number;
  };
  performance: {
    avgProcessingTime: number;
    throughput: number; // items per second
    latency: number; // milliseconds
  };
  quality: {
    validationRate: number;
    errorRate: number;
    dataFreshness: number;
  };
}

export class DataProcessingPipeline extends EventEmitter {
  private marketDataService: MarketDataService;
  private exchangeManager: ExchangeManager;
  private dataValidator: DataValidator;
  private timeframeAggregator: TimeframeAggregator;
  private config: PipelineConfig;
  
  private metrics!: PipelineMetrics;
  private processingQueue: Map<string, any[]> = new Map();
  private processingTimer?: NodeJS.Timeout | undefined;
  private isRunning: boolean = false;
  private startTime: number = 0;

  constructor(
    exchangeManager: ExchangeManager,
    config: PipelineConfig
  ) {
    super();
    
    this.exchangeManager = exchangeManager;
    this.config = config;
    
    this.marketDataService = new MarketDataService(exchangeManager, config.marketData);
    this.dataValidator = new DataValidator();
    this.timeframeAggregator = new TimeframeAggregator();
    
    this.initializeMetrics();
    this.setupEventHandlers();
  }

  /**
   * Start the data processing pipeline
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Data processing pipeline is already running');
      return;
    }

    try {
      this.startTime = Date.now();
      
      // Start market data service
      await this.marketDataService.start();
      
      // Start processing timer
      this.startProcessingTimer();
      
      this.isRunning = true;
      this.emit('started');
      logger.info('Data processing pipeline started successfully');
    } catch (error) {
      logger.error('Failed to start data processing pipeline:', error);
      throw error;
    }
  }

  /**
   * Stop the data processing pipeline
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop processing timer
      if (this.processingTimer) {
        clearInterval(this.processingTimer);
        this.processingTimer = undefined;
      }
      
      // Process remaining items
      await this.processAllQueues();
      
      // Stop market data service
      await this.marketDataService.stop();
      
      this.isRunning = false;
      this.emit('stopped');
      logger.info('Data processing pipeline stopped successfully');
    } catch (error) {
      logger.error('Error stopping data processing pipeline:', error);
      throw error;
    }
  }

  /**
   * Process market data through the pipeline
   */
  async processMarketData(data: CandleData | TickerData | OrderBookData | TradeData, type: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Step 1: Validate data
      const isValid = this.validateData(data, type);
      if (!isValid) {
        this.metrics.errors.validation++;
        this.emit('validationError', { data, type });
        return false;
      }

      // Step 2: Process based on type
      let processed = false;
      switch (type) {
        case 'candle':
          processed = await this.processCandle(data as CandleData);
          break;
        case 'ticker':
          processed = await this.processTicker(data as TickerData);
          break;
        case 'orderbook':
          processed = await this.processOrderBook(data as OrderBookData);
          break;
        case 'trade':
          processed = await this.processTrade(data as TradeData);
          break;
        default:
          logger.warn(`Unknown data type: ${type}`);
          return false;
      }

      if (processed) {
        this.updateProcessingMetrics(type, Date.now() - startTime);
        this.emit('dataProcessed', { data, type });
      } else {
        this.metrics.errors.processing++;
        this.emit('processingError', { data, type });
      }

      return processed;
    } catch (error) {
      this.metrics.errors.processing++;
      logger.error(`Error processing ${type} data:`, error);
      this.emit('processingError', { data, type, error });
      return false;
    }
  }

  /**
   * Bulk process historical data
   */
  async bulkProcessHistoricalData(
    symbols: string[],
    timeframes: Timeframe[],
    startTime: number,
    endTime: number,
    exchange?: ExchangeName
  ): Promise<{
    success: boolean;
    processed: number;
    errors: number;
    duration: number;
  }> {
    const bulkStartTime = Date.now();
    let processed = 0;
    let errors = 0;

    try {
      logger.info(`Starting bulk historical data processing for ${symbols.length} symbols, ${timeframes.length} timeframes`);

      const historicalData = await this.marketDataService.bulkHistoricalFetch(
        symbols,
        timeframes,
        startTime,
        endTime,
        exchange,
        (progress) => {
          this.emit('bulkProgress', progress);
        }
      );

      // Process all fetched data
      for (const [_symbol, timeframeData] of Object.entries(historicalData)) {
        for (const [_timeframe, candles] of Object.entries(timeframeData)) {
          for (const candle of candles) {
            const success = await this.processMarketData(candle, 'candle');
            if (success) {
              processed++;
            } else {
              errors++;
            }
          }
        }
      }

      const duration = Date.now() - bulkStartTime;
      logger.info(`Bulk processing completed: ${processed} processed, ${errors} errors, ${duration}ms`);

      return {
        success: errors === 0,
        processed,
        errors,
        duration
      };
    } catch (error) {
      logger.error('Bulk processing failed:', error);
      return {
        success: false,
        processed,
        errors: errors + 1,
        duration: Date.now() - bulkStartTime
      };
    }
  }

  /**
   * Get pipeline metrics
   */
  getMetrics(): PipelineMetrics {
    const uptime = Date.now() - this.startTime;
    const totalProcessed = Object.values(this.metrics.processed).reduce((sum, count) => sum + count, 0);
    
    return {
      ...this.metrics,
      performance: {
        ...this.metrics.performance,
        throughput: uptime > 0 ? (totalProcessed / (uptime / 1000)) : 0,
      }
    };
  }

  /**
   * Get data quality report
   */
  async getDataQualityReport(symbols: string[], timeframes: Timeframe[]): Promise<Record<string, any>> {
    const report: Record<string, any> = {};

    for (const symbol of symbols) {
      report[symbol] = {};
      
      for (const timeframe of timeframes) {
        try {
          const quality = await this.marketDataService.assessDataQuality(symbol, timeframe);
          report[symbol][timeframe] = quality;
        } catch (error) {
          report[symbol][timeframe] = {
            error: error instanceof Error ? error.message : 'Unknown error',
            overall: 0
          };
        }
      }
    }

    return report;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, boolean>;
    metrics: PipelineMetrics;
  }> {
    const checks = {
      marketDataService: this.marketDataService ? true : false,
      exchangeConnections: await this.checkExchangeConnections(),
      dataQuality: this.checkDataQuality(),
      processing: this.isRunning,
      errorRates: this.checkErrorRates()
    };

    const healthyChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.values(checks).length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyChecks === totalChecks) {
      status = 'healthy';
    } else if (healthyChecks >= totalChecks * 0.7) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      checks,
      metrics: this.getMetrics()
    };
  }

  // Private methods
  private initializeMetrics(): void {
    this.metrics = {
      processed: {
        candles: 0,
        tickers: 0,
        orderBooks: 0,
        trades: 0
      },
      errors: {
        validation: 0,
        processing: 0,
        storage: 0
      },
      performance: {
        avgProcessingTime: 0,
        throughput: 0,
        latency: 0
      },
      quality: {
        validationRate: 100,
        errorRate: 0,
        dataFreshness: 100
      }
    };
  }

  private setupEventHandlers(): void {
    // Market data service events
    this.marketDataService.on('candle', (candle: CandleData) => {
      this.processMarketData(candle, 'candle');
    });

    this.marketDataService.on('ticker', (ticker: TickerData) => {
      this.processMarketData(ticker, 'ticker');
    });

    this.marketDataService.on('orderbook', (orderBook: OrderBookData) => {
      this.processMarketData(orderBook, 'orderbook');
    });

    this.marketDataService.on('trade', (trade: TradeData) => {
      this.processMarketData(trade, 'trade');
    });

    // Timeframe aggregator events
    this.timeframeAggregator.on('aggregatedCandle', (candle: CandleData) => {
      this.emit('aggregatedCandle', candle);
    });
  }

  private validateData(data: any, type: string): boolean {
    switch (type) {
      case 'candle':
        return this.dataValidator.validateCandle(data);
      case 'ticker':
        return this.dataValidator.validateTicker(data);
      case 'orderbook':
        return this.dataValidator.validateOrderBook(data);
      case 'trade':
        return this.dataValidator.validateTrade(data);
      default:
        return false;
    }
  }

  private async processCandle(candle: CandleData): Promise<boolean> {
    try {
      // Process through timeframe aggregator
      this.timeframeAggregator.processCandle(candle);
      
      this.metrics.processed.candles++;
      return true;
    } catch (error) {
      logger.error('Error processing candle:', error);
      return false;
    }
  }

  private async processTicker(_ticker: TickerData): Promise<boolean> {
    try {
      // Store in cache and emit for real-time consumers
      this.metrics.processed.tickers++;
      return true;
    } catch (error) {
      logger.error('Error processing ticker:', error);
      return false;
    }
  }

  private async processOrderBook(_orderBook: OrderBookData): Promise<boolean> {
    try {
      // Process order book data
      this.metrics.processed.orderBooks++;
      return true;
    } catch (error) {
      logger.error('Error processing order book:', error);
      return false;
    }
  }

  private async processTrade(_trade: TradeData): Promise<boolean> {
    try {
      // Process trade data
      this.metrics.processed.trades++;
      return true;
    } catch (error) {
      logger.error('Error processing trade:', error);
      return false;
    }
  }

  private startProcessingTimer(): void {
    this.processingTimer = setInterval(() => {
      this.processAllQueues();
    }, this.config.processing.processingInterval);
  }

  private async processAllQueues(): Promise<void> {
    // Process any queued items
    for (const [queueType, items] of this.processingQueue.entries()) {
      if (items.length > 0) {
        const batch = items.splice(0, this.config.processing.batchSize);
        await this.processBatch(queueType, batch);
      }
    }
  }

  private async processBatch(_type: string, items: any[]): Promise<void> {
    for (const item of items) {
      await this.processMarketData(item.data, item.type);
    }
  }

  private updateProcessingMetrics(_type: string, processingTime: number): void {
    // Update average processing time
    const currentAvg = this.metrics.performance.avgProcessingTime;
    const totalProcessed = Object.values(this.metrics.processed).reduce((sum, count) => sum + count, 0);
    
    this.metrics.performance.avgProcessingTime = 
      (currentAvg * (totalProcessed - 1) + processingTime) / totalProcessed;

    // Update quality metrics
    const totalErrors = Object.values(this.metrics.errors).reduce((sum, count) => sum + count, 0);
    this.metrics.quality.errorRate = (totalErrors / (totalProcessed + totalErrors)) * 100;
    this.metrics.quality.validationRate = 
      ((totalProcessed - this.metrics.errors.validation) / totalProcessed) * 100;
  }

  private async checkExchangeConnections(): Promise<boolean> {
    try {
      const health = await this.exchangeManager.healthCheck();
      return Object.values(health).every(Boolean);
    } catch {
      return false;
    }
  }

  private checkDataQuality(): boolean {
    return this.metrics.quality.validationRate >= this.config.quality.minValidationRate &&
           this.metrics.quality.errorRate <= this.config.quality.maxErrorRate;
  }

  private checkErrorRates(): boolean {
    const totalProcessed = Object.values(this.metrics.processed).reduce((sum, count) => sum + count, 0);
    const totalErrors = Object.values(this.metrics.errors).reduce((sum, count) => sum + count, 0);
    
    if (totalProcessed === 0) return true;
    
    const errorRate = (totalErrors / totalProcessed) * 100;
    return errorRate <= this.config.quality.maxErrorRate;
  }
}