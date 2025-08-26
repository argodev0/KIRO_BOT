/**
 * Mainnet Connection Manager
 * Manages mainnet exchange connections with safety validations
 */

import { LiveMarketDataService, LiveMarketDataConfig } from './LiveMarketDataService';
import { LiveDataWebSocketServer } from './LiveDataWebSocketServer';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { Server as HttpServer } from 'http';

export interface MainnetConnectionConfig {
  symbols: string[];
  timeframes: string[];
  enableBinance: boolean;
  enableKuCoin: boolean;
  websocketPort?: number;
}

export class MainnetConnectionManager {
  private liveDataService?: LiveMarketDataService;
  private webSocketServer?: LiveDataWebSocketServer;
  private isRunning: boolean = false;
  private config: MainnetConnectionConfig;

  constructor(config: MainnetConnectionConfig) {
    this.config = config;
  }

  /**
   * Initialize and start mainnet connections
   */
  async start(httpServer: HttpServer): Promise<void> {
    if (this.isRunning) {
      logger.warn('MainnetConnectionManager is already running');
      return;
    }

    try {
      logger.info('🚀 Starting Mainnet Connection Manager...');
      
      // Validate environment and configuration
      this.validateEnvironment();
      this.validateApiKeys();
      
      // Create live market data service configuration
      const liveDataConfig = this.createLiveDataConfig();
      
      // Initialize live market data service
      this.liveDataService = new LiveMarketDataService(liveDataConfig);
      
      // Initialize WebSocket server
      this.webSocketServer = new LiveDataWebSocketServer(httpServer, this.liveDataService);
      
      // Start services
      await this.liveDataService.start();
      this.webSocketServer.start();
      
      this.isRunning = true;
      
      logger.info('✅ Mainnet Connection Manager started successfully');
      logger.info(`📊 Tracking ${this.config.symbols.length} symbols on mainnet exchanges`);
      logger.info(`🌐 WebSocket server ready for client connections`);
      
    } catch (error) {
      logger.error('❌ Failed to start MainnetConnectionManager:', error);
      await this.stop();
      throw error;
    }
  }

  /**
   * Stop all mainnet connections
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('🛑 Stopping Mainnet Connection Manager...');
      
      // Stop WebSocket server
      if (this.webSocketServer) {
        await this.webSocketServer.stop();
      }
      
      // Stop live data service
      if (this.liveDataService) {
        await this.liveDataService.stop();
      }
      
      this.isRunning = false;
      logger.info('✅ Mainnet Connection Manager stopped');
      
    } catch (error) {
      logger.error('❌ Error stopping MainnetConnectionManager:', error);
      throw error;
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    isRunning: boolean;
    liveDataService?: any;
    webSocketServer?: any;
  } {
    return {
      isRunning: this.isRunning,
      liveDataService: this.liveDataService?.getHealthStatus(),
      webSocketServer: this.webSocketServer?.getStats(),
    };
  }

  /**
   * Get live market data service instance
   */
  getLiveDataService(): LiveMarketDataService | undefined {
    return this.liveDataService;
  }

  /**
   * Get WebSocket server instance
   */
  getWebSocketServer(): LiveDataWebSocketServer | undefined {
    return this.webSocketServer;
  }

  // Private methods
  private validateEnvironment(): void {
    // Ensure we're in paper trading mode
    if (!config.paperTrading.enabled) {
      throw new Error('SECURITY: Paper trading mode must be enabled for mainnet connections');
    }
    
    if (config.paperTrading.allowRealTrades) {
      throw new Error('SECURITY: Real trades must be disabled when using mainnet data');
    }
    
    // Validate environment variables
    if (config.env === 'production' && !config.production.ssl.enabled) {
      logger.warn('⚠️  SSL is not enabled in production environment');
    }
    
    logger.info('✅ Environment validation passed');
  }

  private validateApiKeys(): void {
    const errors: string[] = [];
    
    // Validate Binance API keys if enabled
    if (this.config.enableBinance) {
      if (!config.exchanges.binance.apiKey) {
        errors.push('Binance API key is required');
      }
      if (!config.exchanges.binance.apiSecret) {
        errors.push('Binance API secret is required');
      }
      if (!config.exchanges.binance.readOnly) {
        logger.warn('⚠️  Binance API key read-only mode is not explicitly set');
      }
      if (!config.exchanges.binance.mainnet) {
        errors.push('Binance mainnet mode must be enabled');
      }
    }
    
    // Validate KuCoin API keys if enabled
    if (this.config.enableKuCoin) {
      if (!config.exchanges.kucoin.apiKey) {
        errors.push('KuCoin API key is required');
      }
      if (!config.exchanges.kucoin.apiSecret) {
        errors.push('KuCoin API secret is required');
      }
      if (!config.exchanges.kucoin.passphrase) {
        errors.push('KuCoin passphrase is required');
      }
      if (!config.exchanges.kucoin.readOnly) {
        logger.warn('⚠️  KuCoin API key read-only mode is not explicitly set');
      }
      if (!config.exchanges.kucoin.mainnet) {
        errors.push('KuCoin mainnet mode must be enabled');
      }
    }
    
    if (errors.length > 0) {
      throw new Error(`API key validation failed: ${errors.join(', ')}`);
    }
    
    logger.info('✅ API key validation passed');
  }

  private createLiveDataConfig(): LiveMarketDataConfig {
    const liveDataConfig: LiveMarketDataConfig = {
      exchanges: {
        binance: {
          enabled: this.config.enableBinance,
          mainnet: true,
          readOnly: true,
          apiKey: config.exchanges.binance.apiKey,
          apiSecret: config.exchanges.binance.apiSecret,
        },
        kucoin: {
          enabled: this.config.enableKuCoin,
          mainnet: true,
          readOnly: true,
          apiKey: config.exchanges.kucoin.apiKey,
          apiSecret: config.exchanges.kucoin.apiSecret,
          passphrase: config.exchanges.kucoin.passphrase,
        },
      },
      symbols: this.config.symbols,
      timeframes: this.config.timeframes as any[],
      redis: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db,
      },
      streaming: {
        maxConnections: config.production.performance.websocketMaxConnections,
        heartbeatInterval: config.websocket.heartbeatInterval,
        reconnectDelay: 5000,
        maxReconnectAttempts: 5,
      },
    };
    
    return liveDataConfig;
  }

  /**
   * Add symbol to tracking
   */
  async addSymbol(symbol: string): Promise<void> {
    if (!this.isRunning || !this.liveDataService) {
      throw new Error('Service is not running');
    }
    
    const normalizedSymbol = symbol.toUpperCase();
    
    if (!this.config.symbols.includes(normalizedSymbol)) {
      this.config.symbols.push(normalizedSymbol);
      
      // This would require extending the LiveMarketDataService to support dynamic symbol addition
      logger.info(`📊 Added symbol ${normalizedSymbol} to tracking`);
    }
  }

  /**
   * Remove symbol from tracking
   */
  async removeSymbol(symbol: string): Promise<void> {
    if (!this.isRunning || !this.liveDataService) {
      throw new Error('Service is not running');
    }
    
    const normalizedSymbol = symbol.toUpperCase();
    const index = this.config.symbols.indexOf(normalizedSymbol);
    
    if (index > -1) {
      this.config.symbols.splice(index, 1);
      
      // This would require extending the LiveMarketDataService to support dynamic symbol removal
      logger.info(`📊 Removed symbol ${normalizedSymbol} from tracking`);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): MainnetConnectionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (requires restart)
   */
  updateConfig(newConfig: Partial<MainnetConnectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('⚙️  Configuration updated (restart required for changes to take effect)');
  }
}

/**
 * Factory function to create and configure MainnetConnectionManager
 */
export function createMainnetConnectionManager(options: {
  symbols?: string[];
  timeframes?: string[];
  enableBinance?: boolean;
  enableKuCoin?: boolean;
}): MainnetConnectionManager {
  const defaultConfig: MainnetConnectionConfig = {
    symbols: options.symbols || [
      'BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT',
      'BNBUSDT', 'SOLUSDT', 'MATICUSDT', 'AVAXUSDT', 'ATOMUSDT'
    ],
    timeframes: options.timeframes || ['1m', '5m', '15m', '1h', '4h', '1d'],
    enableBinance: options.enableBinance ?? true,
    enableKuCoin: options.enableKuCoin ?? true,
  };
  
  return new MainnetConnectionManager(defaultConfig);
}