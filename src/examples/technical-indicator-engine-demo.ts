/**
 * Technical Indicator Engine Demo
 * Demonstrates the real-time calculation of RSI, MACD, and Bollinger Bands
 * with multi-timeframe support and caching optimization
 */

import { TechnicalIndicatorEngine } from '../services/TechnicalIndicatorEngine';
import { MarketDataService } from '../services/MarketDataService';
import { ExchangeManager } from '../services/exchanges/ExchangeManager';
import { CandleData, Timeframe } from '../types/market';

// Mock configuration for demo
const engineConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: 0,
  },
  caching: {
    ttl: 300, // 5 minutes cache
    maxCandleHistory: 1000,
  },
  calculation: {
    batchSize: 100,
    updateInterval: 5000, // 5 seconds
    enableRealtime: true,
  },
  timeframes: ['1m', '5m', '15m', '1h', '4h', '1d'] as Timeframe[],
};

const marketDataConfig = {
  redis: engineConfig.redis,
  exchanges: {
    binance: {
      enabled: true,
      symbols: ['BTCUSDT', 'ETHUSDT'],
      timeframes: ['1m', '5m', '15m', '1h'] as Timeframe[],
    },
  },
  caching: {
    candleTtl: 60,
    tickerTtl: 10,
    orderBookTtl: 5,
    tradeTtl: 30,
  },
  processing: {
    batchSize: 50,
    flushInterval: 1000,
    maxRetries: 3,
  },
};

class TechnicalIndicatorDemo {
  private engine: TechnicalIndicatorEngine;
  private marketDataService: MarketDataService;
  private isRunning: boolean = false;

  constructor() {
    // Initialize services
    const exchangeManager = new ExchangeManager();
    this.marketDataService = new MarketDataService(exchangeManager, marketDataConfig);
    this.engine = new TechnicalIndicatorEngine(this.marketDataService, engineConfig);
    
    this.setupEventHandlers();
  }

  /**
   * Start the demo
   */
  async start(): Promise<void> {
    try {
      console.log('🚀 Starting Technical Indicator Engine Demo...\n');
      
      // Start services
      await this.marketDataService.start();
      await this.engine.start();
      
      this.isRunning = true;
      
      // Demo scenarios
      await this.demonstrateBasicCalculations();
      await this.demonstrateMultiTimeframeAnalysis();
      await this.demonstrateRealtimeUpdates();
      await this.demonstrateIndicatorAnalysis();
      await this.demonstrateConfigurationManagement();
      
      console.log('\n✅ Demo completed successfully!');
      
    } catch (error) {
      console.error('❌ Demo failed:', error);
    }
  }

  /**
   * Stop the demo
   */
  async stop(): Promise<void> {
    if (this.isRunning) {
      await this.engine.stop();
      await this.marketDataService.stop();
      this.isRunning = false;
      console.log('🛑 Demo stopped');
    }
  }

  /**
   * Demonstrate basic indicator calculations
   */
  private async demonstrateBasicCalculations(): Promise<void> {
    console.log('📊 Demonstrating Basic Indicator Calculations');
    console.log('=' .repeat(50));
    
    try {
      const symbol = 'BTCUSDT';
      const timeframe: Timeframe = '1h';
      
      console.log(`Calculating indicators for ${symbol} ${timeframe}...`);
      
      const results = await this.engine.calculateIndicators(symbol, timeframe);
      
      console.log('\n📈 Results:');
      console.log(`Symbol: ${results.symbol}`);
      console.log(`Timeframe: ${results.timeframe}`);
      console.log(`Timestamp: ${new Date(results.timestamp).toISOString()}`);
      
      console.log('\n🔢 RSI:');
      console.log(`  Value: ${results.rsi.value.toFixed(2)}`);
      console.log(`  Signal: ${results.rsi.signal}`);
      console.log(`  Divergence: ${results.rsi.divergence || 'None'}`);
      
      console.log('\n📊 MACD:');
      console.log(`  MACD Line: ${results.macd.macd.toFixed(4)}`);
      console.log(`  Signal Line: ${results.macd.signal.toFixed(4)}`);
      console.log(`  Histogram: ${results.macd.histogram.toFixed(4)}`);
      console.log(`  Crossover: ${results.macd.crossover || 'None'}`);
      
      console.log('\n🎯 Bollinger Bands:');
      console.log(`  Upper Band: ${results.bollingerBands.upperBand.toFixed(2)}`);
      console.log(`  Middle Band: ${results.bollingerBands.middleBand.toFixed(2)}`);
      console.log(`  Lower Band: ${results.bollingerBands.lowerBand.toFixed(2)}`);
      console.log(`  %B: ${(results.bollingerBands.percentB * 100).toFixed(1)}%`);
      console.log(`  Bandwidth: ${(results.bollingerBands.bandwidth * 100).toFixed(2)}%`);
      
    } catch (error) {
      console.error('Error in basic calculations:', error);
    }
    
    console.log('\n');
  }

  /**
   * Demonstrate multi-timeframe analysis
   */
  private async demonstrateMultiTimeframeAnalysis(): Promise<void> {
    console.log('⏰ Demonstrating Multi-Timeframe Analysis');
    console.log('=' .repeat(50));
    
    try {
      const symbol = 'ETHUSDT';
      const timeframes: Timeframe[] = ['15m', '1h', '4h'];
      
      console.log(`Analyzing ${symbol} across timeframes: ${timeframes.join(', ')}`);
      
      const results = await this.engine.getMultiTimeframeIndicators(symbol, timeframes);
      
      console.log('\n📊 Multi-Timeframe Results:');
      
      timeframes.forEach(tf => {
        const tfResult = results.timeframes[tf];
        if (tfResult) {
          console.log(`\n⏱️  ${tf} Timeframe:`);
          console.log(`  RSI: ${tfResult.rsi.value.toFixed(1)} (${tfResult.rsi.signal})`);
          console.log(`  MACD: ${tfResult.macd.macd.toFixed(4)} (${tfResult.macd.crossover || 'No crossover'})`);
          console.log(`  BB %B: ${(tfResult.bollingerBands.percentB * 100).toFixed(1)}%`);
        }
      });
      
    } catch (error) {
      console.error('Error in multi-timeframe analysis:', error);
    }
    
    console.log('\n');
  }

  /**
   * Demonstrate real-time updates
   */
  private async demonstrateRealtimeUpdates(): Promise<void> {
    console.log('🔄 Demonstrating Real-time Updates');
    console.log('=' .repeat(50));
    
    try {
      const symbol = 'BTCUSDT';
      const timeframe: Timeframe = '1m';
      
      console.log(`Subscribing to real-time updates for ${symbol} ${timeframe}...`);
      
      // Subscribe to updates
      await this.engine.subscribeToSymbol(symbol, [timeframe]);
      
      console.log('Subscription active. Monitoring for updates...');
      
      // Simulate waiting for updates
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Get current indicators
      const current = await this.engine.getCurrentIndicators(symbol, timeframe);
      if (current) {
        console.log('\n📱 Current Real-time Indicators:');
        console.log(`  RSI: ${current.rsi.value.toFixed(2)}`);
        console.log(`  MACD: ${current.macd.macd.toFixed(4)}`);
        console.log(`  BB %B: ${(current.bollingerBands.percentB * 100).toFixed(1)}%`);
      }
      
      // Unsubscribe
      this.engine.unsubscribeFromSymbol(symbol, [timeframe]);
      console.log('Unsubscribed from real-time updates');
      
    } catch (error) {
      console.error('Error in real-time updates:', error);
    }
    
    console.log('\n');
  }

  /**
   * Demonstrate indicator analysis and signals
   */
  private async demonstrateIndicatorAnalysis(): Promise<void> {
    console.log('🎯 Demonstrating Indicator Analysis & Signals');
    console.log('=' .repeat(50));
    
    try {
      const symbol = 'BTCUSDT';
      const timeframe: Timeframe = '1h';
      
      const results = await this.engine.calculateIndicators(symbol, timeframe);
      const analysis = this.engine.getIndicatorAnalysis(results);
      
      console.log('\n🔍 Individual Indicator Analysis:');
      
      console.log(`\n📊 RSI Analysis:`);
      console.log(`  Signal: ${analysis.rsi.signal}`);
      console.log(`  Strength: ${analysis.rsi.strength}`);
      console.log(`  Description: ${analysis.rsi.description}`);
      
      console.log(`\n📈 MACD Analysis:`);
      console.log(`  Signal: ${analysis.macd.signal}`);
      console.log(`  Strength: ${analysis.macd.strength}`);
      console.log(`  Description: ${analysis.macd.description}`);
      
      console.log(`\n🎯 Bollinger Bands Analysis:`);
      console.log(`  Signal: ${analysis.bollingerBands.signal}`);
      console.log(`  Strength: ${analysis.bollingerBands.strength}`);
      console.log(`  Description: ${analysis.bollingerBands.description}`);
      
      console.log(`\n🎪 Consensus Analysis:`);
      console.log(`  Overall Signal: ${analysis.consensus.signal.toUpperCase()}`);
      console.log(`  Strength: ${analysis.consensus.strength}`);
      console.log(`  Confidence: ${(analysis.consensus.confidence * 100).toFixed(1)}%`);
      
    } catch (error) {
      console.error('Error in indicator analysis:', error);
    }
    
    console.log('\n');
  }

  /**
   * Demonstrate configuration management
   */
  private async demonstrateConfigurationManagement(): Promise<void> {
    console.log('⚙️  Demonstrating Configuration Management');
    console.log('=' .repeat(50));
    
    try {
      // Show current configuration
      const currentConfig = this.engine.getConfig();
      console.log('\n📋 Current Configuration:');
      console.log(`RSI Period: ${currentConfig.indicators.rsi.period}`);
      console.log(`MACD Fast: ${currentConfig.indicators.macd.fastPeriod}`);
      console.log(`BB Period: ${currentConfig.indicators.bollingerBands.period}`);
      
      // Update configuration
      console.log('\n🔧 Updating Configuration...');
      this.engine.updateIndicatorConfig({
        rsi: { period: 21, overbought: 75, oversold: 25 },
        macd: { fastPeriod: 10, slowPeriod: 20, signalPeriod: 7 },
      });
      
      const updatedConfig = this.engine.getConfig();
      console.log('\n✅ Updated Configuration:');
      console.log(`RSI Period: ${updatedConfig.indicators.rsi.period}`);
      console.log(`MACD Fast: ${updatedConfig.indicators.macd.fastPeriod}`);
      
      // Show cache statistics
      const stats = this.engine.getCacheStats();
      console.log('\n📊 Cache Statistics:');
      console.log(`Indicator Cache Size: ${stats.indicatorCacheSize}`);
      console.log(`Candle Cache Size: ${stats.candleCacheSize}`);
      console.log(`Active Subscriptions: ${stats.subscriptions}`);
      console.log(`Active Timers: ${stats.activeTimers}`);
      
    } catch (error) {
      console.error('Error in configuration management:', error);
    }
    
    console.log('\n');
  }

  /**
   * Setup event handlers for demo
   */
  private setupEventHandlers(): void {
    this.engine.on('started', () => {
      console.log('✅ Technical Indicator Engine started');
    });
    
    this.engine.on('indicatorsUpdated', (results) => {
      console.log(`📊 Indicators updated for ${results.symbol} ${results.timeframe}`);
    });
    
    this.engine.on('realtimeUpdate', (results) => {
      console.log(`🔄 Real-time update: ${results.symbol} ${results.timeframe}`);
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down demo...');
      await this.stop();
      process.exit(0);
    });
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  const demo = new TechnicalIndicatorDemo();
  
  demo.start().catch(error => {
    console.error('Demo failed:', error);
    process.exit(1);
  });
}

export { TechnicalIndicatorDemo };