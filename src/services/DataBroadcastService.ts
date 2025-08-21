import { WebSocketServer } from './WebSocketServer';
import { WebSocketMessage } from '@/types';
import { logger } from '@/utils/logger';
import { EventEmitter } from 'events';

export interface MarketDataUpdate {
  symbol: string;
  price: number;
  volume: number;
  change24h: number;
  timestamp: number;
}

export interface TradingSignalUpdate {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number[];
  timestamp: number;
}

export interface TradeExecutionUpdate {
  id: string;
  userId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  status: 'pending' | 'filled' | 'cancelled' | 'failed';
  timestamp: number;
}

export interface PositionUpdate {
  id: string;
  userId: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  timestamp: number;
}

export interface SystemStatusUpdate {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Array<{
    name: string;
    status: 'up' | 'down' | 'degraded';
    latency?: number;
  }>;
  timestamp: number;
}

export interface AlertUpdate {
  id: string;
  userId: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: number;
}

export class DataBroadcastService extends EventEmitter {
  private wsServer: WebSocketServer;
  private dataThrottlers: Map<string, NodeJS.Timeout> = new Map();
  private lastBroadcastData: Map<string, any> = new Map();

  constructor(wsServer: WebSocketServer) {
    super();
    this.wsServer = wsServer;
    this.setupEventListeners();
    logger.info('DataBroadcastService initialized');
  }

  private setupEventListeners(): void {
    // Listen for internal events and broadcast them
    this.on('market_data', (data: MarketDataUpdate) => {
      this.broadcastMarketData(data);
    });

    this.on('trading_signal', (data: TradingSignalUpdate) => {
      this.broadcastTradingSignal(data);
    });

    this.on('trade_execution', (data: TradeExecutionUpdate) => {
      this.broadcastTradeExecution(data);
    });

    this.on('position_update', (data: PositionUpdate) => {
      this.broadcastPositionUpdate(data);
    });

    this.on('system_status', (data: SystemStatusUpdate) => {
      this.broadcastSystemStatus(data);
    });

    this.on('user_alert', (data: AlertUpdate) => {
      this.broadcastUserAlert(data);
    });
  }

  // Market Data Broadcasting
  public broadcastMarketData(data: MarketDataUpdate): void {
    const message: WebSocketMessage = {
      type: 'market_data_update',
      channel: 'market_data',
      data,
      timestamp: Date.now()
    };

    // Throttle market data updates to prevent spam (max 1 per second per symbol)
    const throttleKey = `market_data_${data.symbol}`;
    this.throttledBroadcast(throttleKey, 1000, () => {
      this.wsServer.broadcastToChannel('market_data', message);
      this.wsServer.broadcastToChannel('price_updates', message);
    });
  }

  // Trading Signal Broadcasting
  public broadcastTradingSignal(data: TradingSignalUpdate): void {
    const message: WebSocketMessage = {
      type: 'trading_signal',
      channel: 'trading_signals',
      data,
      timestamp: Date.now()
    };

    this.wsServer.broadcastToChannel('trading_signals', message);
    logger.info(`Broadcasted trading signal: ${data.symbol} ${data.direction} (confidence: ${data.confidence})`);
  }

  // Trade Execution Broadcasting
  public broadcastTradeExecution(data: TradeExecutionUpdate): void {
    const message: WebSocketMessage = {
      type: 'trade_execution',
      channel: `user_${data.userId}_trades`,
      data,
      timestamp: Date.now()
    };

    // Broadcast to specific user
    this.wsServer.broadcastToUser(data.userId, message);
    
    // Also broadcast to admin channels if needed
    const adminMessage: WebSocketMessage = {
      type: 'trade_execution',
      channel: 'all_trades',
      data,
      timestamp: Date.now()
    };
    this.wsServer.broadcastToChannel('all_trades', adminMessage);

    logger.info(`Broadcasted trade execution: ${data.symbol} ${data.side} ${data.quantity} @ ${data.price}`);
  }

  // Position Update Broadcasting
  public broadcastPositionUpdate(data: PositionUpdate): void {
    const message: WebSocketMessage = {
      type: 'position_update',
      channel: `user_${data.userId}_positions`,
      data,
      timestamp: Date.now()
    };

    this.wsServer.broadcastToUser(data.userId, message);
    logger.debug(`Broadcasted position update: ${data.symbol} ${data.side} PnL: ${data.unrealizedPnl}`);
  }

  // System Status Broadcasting
  public broadcastSystemStatus(data: SystemStatusUpdate): void {
    const message: WebSocketMessage = {
      type: 'system_status',
      channel: 'system_status',
      data,
      timestamp: Date.now()
    };

    this.wsServer.broadcastToChannel('system_status', message);
    
    // Also send to admin channels
    this.wsServer.broadcastToChannel('system_metrics', message);
    
    logger.info(`Broadcasted system status: ${data.status}`);
  }

  // User Alert Broadcasting
  public broadcastUserAlert(data: AlertUpdate): void {
    const message: WebSocketMessage = {
      type: 'user_alert',
      channel: `user_${data.userId}_alerts`,
      data,
      timestamp: Date.now()
    };

    this.wsServer.broadcastToUser(data.userId, message);
    
    // Broadcast critical alerts to admin channels
    if (data.type === 'error') {
      const adminMessage: WebSocketMessage = {
        type: 'admin_alert',
        channel: 'admin_alerts',
        data,
        timestamp: Date.now()
      };
      this.wsServer.broadcastToChannel('admin_alerts', adminMessage);
    }

    logger.info(`Broadcasted user alert: ${data.type} - ${data.title}`);
  }

  // Risk Alert Broadcasting
  public broadcastRiskAlert(data: {
    userId: string;
    type: 'position_limit' | 'daily_loss' | 'drawdown' | 'emergency';
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    metadata?: any;
  }): void {
    const alertData: AlertUpdate = {
      id: `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: data.userId,
      type: data.severity === 'critical' ? 'error' : 'warning',
      title: `Risk Alert: ${data.type.replace('_', ' ').toUpperCase()}`,
      message: data.message,
      timestamp: Date.now()
    };

    // Send to user
    this.broadcastUserAlert(alertData);

    // Send to risk management channel
    const riskMessage: WebSocketMessage = {
      type: 'risk_alert',
      channel: 'risk_alerts',
      data: {
        ...alertData,
        severity: data.severity,
        metadata: data.metadata
      },
      timestamp: Date.now()
    };

    this.wsServer.broadcastToChannel('risk_alerts', riskMessage);
    logger.warn(`Risk alert broadcasted: ${data.type} for user ${data.userId}`);
  }

  // Grid Trading Updates
  public broadcastGridUpdate(data: {
    gridId: string;
    userId: string;
    symbol: string;
    action: 'created' | 'updated' | 'filled' | 'closed';
    level?: number;
    price?: number;
    profit?: number;
    metadata?: any;
  }): void {
    const message: WebSocketMessage = {
      type: 'grid_update',
      channel: `user_${data.userId}_positions`,
      data,
      timestamp: Date.now()
    };

    this.wsServer.broadcastToUser(data.userId, message);
    logger.info(`Grid update broadcasted: ${data.action} for grid ${data.gridId}`);
  }

  // Performance Metrics Broadcasting
  public broadcastPerformanceMetrics(data: {
    userId: string;
    metrics: {
      totalPnl: number;
      winRate: number;
      sharpeRatio: number;
      maxDrawdown: number;
      totalTrades: number;
    };
    period: 'daily' | 'weekly' | 'monthly';
  }): void {
    const message: WebSocketMessage = {
      type: 'performance_metrics',
      channel: `user_${data.userId}_alerts`,
      data,
      timestamp: Date.now()
    };

    this.wsServer.broadcastToUser(data.userId, message);
    logger.info(`Performance metrics broadcasted for user ${data.userId}`);
  }

  // Throttled broadcasting to prevent spam
  private throttledBroadcast(key: string, delay: number, callback: () => void): void {
    // Clear existing timeout
    const existingTimeout = this.dataThrottlers.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      callback();
      this.dataThrottlers.delete(key);
    }, delay);

    this.dataThrottlers.set(key, timeout);
  }

  // Batch broadcasting for efficiency
  public broadcastBatch(messages: Array<{
    channel: string;
    message: WebSocketMessage;
  }>): void {
    messages.forEach(({ channel, message }) => {
      this.wsServer.broadcastToChannel(channel, message);
    });
    logger.debug(`Broadcasted batch of ${messages.length} messages`);
  }

  // Connection health check
  public broadcastConnectionHealth(): void {
    const stats = this.wsServer.getServerStats();
    const healthMessage: WebSocketMessage = {
      type: 'connection_health',
      channel: 'system_status',
      data: {
        connectedClients: stats.connectedClients,
        totalChannels: stats.totalChannels,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    };

    this.wsServer.broadcastToChannel('system_status', healthMessage);
  }

  // Cleanup method
  public cleanup(): void {
    // Clear all throttlers
    this.dataThrottlers.forEach(timeout => clearTimeout(timeout));
    this.dataThrottlers.clear();
    this.lastBroadcastData.clear();
    this.removeAllListeners();
    logger.info('DataBroadcastService cleaned up');
  }

  // Get service statistics
  public getStats() {
    return {
      activeThrottlers: this.dataThrottlers.size,
      cachedDataEntries: this.lastBroadcastData.size,
      wsServerStats: this.wsServer.getServerStats()
    };
  }
}