/**
 * Virtual Portfolio WebSocket Service
 * Handles real-time updates for virtual portfolio data
 */

import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { logger } from '../utils/logger';
import { virtualPortfolioManager, PortfolioSummary } from './VirtualPortfolioManager';

export interface PortfolioUpdate {
  userId: string;
  type: 'BALANCE_UPDATE' | 'POSITION_UPDATE' | 'TRADE_EXECUTED' | 'PERFORMANCE_UPDATE';
  data: any;
  timestamp: number;
  isPaperTrading: true;
}

export interface WebSocketClient {
  id: string;
  userId: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  lastPing: number;
}

export class VirtualPortfolioWebSocketService extends EventEmitter {
  private static instance: VirtualPortfolioWebSocketService;
  private clients: Map<string, WebSocketClient> = new Map();
  private userClients: Map<string, Set<string>> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.setupPortfolioListeners();
    this.startPeriodicUpdates();
    this.startPingPong();
  }

  public static getInstance(): VirtualPortfolioWebSocketService {
    if (!VirtualPortfolioWebSocketService.instance) {
      VirtualPortfolioWebSocketService.instance = new VirtualPortfolioWebSocketService();
    }
    return VirtualPortfolioWebSocketService.instance;
  }

  /**
   * Add a WebSocket client
   */
  public addClient(clientId: string, userId: string, ws: WebSocket): void {
    try {
      const client: WebSocketClient = {
        id: clientId,
        userId,
        ws,
        subscriptions: new Set(['portfolio', 'positions', 'trades']),
        lastPing: Date.now()
      };

      this.clients.set(clientId, client);

      // Track clients by user
      if (!this.userClients.has(userId)) {
        this.userClients.set(userId, new Set());
      }
      this.userClients.get(userId)!.add(clientId);

      // Set up WebSocket event handlers
      ws.on('message', (data) => this.handleClientMessage(clientId, data));
      ws.on('close', () => this.removeClient(clientId));
      ws.on('error', (error) => {
        logger.error(`WebSocket error for client ${clientId}:`, error);
        this.removeClient(clientId);
      });

      // Send initial portfolio data
      this.sendInitialPortfolioData(clientId);

      logger.info(`Virtual portfolio WebSocket client added: ${clientId} for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to add WebSocket client ${clientId}:`, error);
    }
  }

  /**
   * Remove a WebSocket client
   */
  public removeClient(clientId: string): void {
    try {
      const client = this.clients.get(clientId);
      if (client) {
        // Remove from user clients tracking
        const userClientSet = this.userClients.get(client.userId);
        if (userClientSet) {
          userClientSet.delete(clientId);
          if (userClientSet.size === 0) {
            this.userClients.delete(client.userId);
          }
        }

        // Close WebSocket if still open
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.close();
        }

        this.clients.delete(clientId);
        logger.info(`Virtual portfolio WebSocket client removed: ${clientId}`);
      }
    } catch (error) {
      logger.error(`Failed to remove WebSocket client ${clientId}:`, error);
    }
  }

  /**
   * Handle incoming client messages
   */
  private handleClientMessage(clientId: string, data: Buffer): void {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'SUBSCRIBE':
          if (message.channels && Array.isArray(message.channels)) {
            message.channels.forEach((channel: string) => {
              client.subscriptions.add(channel);
            });
            this.sendMessage(clientId, {
              type: 'SUBSCRIPTION_CONFIRMED',
              channels: Array.from(client.subscriptions),
              timestamp: Date.now()
            });
          }
          break;

        case 'UNSUBSCRIBE':
          if (message.channels && Array.isArray(message.channels)) {
            message.channels.forEach((channel: string) => {
              client.subscriptions.delete(channel);
            });
          }
          break;

        case 'PING':
          client.lastPing = Date.now();
          this.sendMessage(clientId, {
            type: 'PONG',
            timestamp: Date.now()
          });
          break;

        case 'REQUEST_PORTFOLIO':
          this.sendPortfolioUpdate(clientId);
          break;

        default:
          logger.warn(`Unknown message type from client ${clientId}:`, message.type);
      }
    } catch (error) {
      logger.error(`Failed to handle client message from ${clientId}:`, error);
    }
  }

  /**
   * Send initial portfolio data to a client
   */
  private sendInitialPortfolioData(clientId: string): void {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const portfolio = virtualPortfolioManager.getPortfolioSummary(client.userId);
      if (portfolio) {
        this.sendMessage(clientId, {
          type: 'INITIAL_PORTFOLIO_DATA',
          data: {
            ...portfolio,
            isPaperTrading: true,
            safetyStatus: 'PAPER_TRADING_ACTIVE'
          },
          timestamp: Date.now()
        });
      }
    } catch (error) {
      logger.error(`Failed to send initial portfolio data to client ${clientId}:`, error);
    }
  }

  /**
   * Send portfolio update to a specific client
   */
  private sendPortfolioUpdate(clientId: string): void {
    try {
      const client = this.clients.get(clientId);
      if (!client || !client.subscriptions.has('portfolio')) return;

      const portfolio = virtualPortfolioManager.getPortfolioSummary(client.userId);
      if (portfolio) {
        this.sendMessage(clientId, {
          type: 'PORTFOLIO_UPDATE',
          data: {
            totalBalance: portfolio.totalBalance,
            availableBalance: portfolio.availableBalance,
            totalUnrealizedPnl: portfolio.totalUnrealizedPnl,
            totalRealizedPnl: portfolio.totalRealizedPnl,
            equity: portfolio.equity,
            performance: portfolio.performance,
            isPaperTrading: true
          },
          timestamp: Date.now()
        });
      }
    } catch (error) {
      logger.error(`Failed to send portfolio update to client ${clientId}:`, error);
    }
  }

  /**
   * Send positions update to a specific client
   */
  private sendPositionsUpdate(clientId: string): void {
    try {
      const client = this.clients.get(clientId);
      if (!client || !client.subscriptions.has('positions')) return;

      const portfolio = virtualPortfolioManager.getPortfolioSummary(client.userId);
      if (portfolio) {
        this.sendMessage(clientId, {
          type: 'POSITIONS_UPDATE',
          data: portfolio.positions.map(position => ({
            ...position,
            isPaperPosition: true,
            safetyStatus: 'SIMULATED'
          })),
          timestamp: Date.now()
        });
      }
    } catch (error) {
      logger.error(`Failed to send positions update to client ${clientId}:`, error);
    }
  }

  /**
   * Send trade update to clients
   */
  private sendTradeUpdate(userId: string, trade: any): void {
    try {
      const userClientIds = this.userClients.get(userId);
      if (!userClientIds) return;

      const message = {
        type: 'TRADE_EXECUTED',
        data: {
          ...trade,
          isPaperTrade: true,
          safetyStatus: 'SIMULATED'
        },
        timestamp: Date.now()
      };

      userClientIds.forEach(clientId => {
        const client = this.clients.get(clientId);
        if (client && client.subscriptions.has('trades')) {
          this.sendMessage(clientId, message);
        }
      });
    } catch (error) {
      logger.error(`Failed to send trade update for user ${userId}:`, error);
    }
  }

  /**
   * Send message to a specific client
   */
  private sendMessage(clientId: string, message: any): void {
    try {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    } catch (error) {
      logger.error(`Failed to send message to client ${clientId}:`, error);
      this.removeClient(clientId);
    }
  }

  /**
   * Broadcast message to all clients of a user
   */
  private broadcastToUser(userId: string, message: any): void {
    try {
      const userClientIds = this.userClients.get(userId);
      if (!userClientIds) return;

      userClientIds.forEach(clientId => {
        this.sendMessage(clientId, message);
      });
    } catch (error) {
      logger.error(`Failed to broadcast to user ${userId}:`, error);
    }
  }

  /**
   * Set up listeners for portfolio manager events
   */
  private setupPortfolioListeners(): void {
    virtualPortfolioManager.on('tradeExecuted', (trade) => {
      this.sendTradeUpdate(trade.userId, trade);
      
      // Also send updated portfolio and positions
      setTimeout(() => {
        const userClientIds = this.userClients.get(trade.userId);
        if (userClientIds) {
          userClientIds.forEach(clientId => {
            this.sendPortfolioUpdate(clientId);
            this.sendPositionsUpdate(clientId);
          });
        }
      }, 100);
    });

    virtualPortfolioManager.on('balanceUpdated', ({ userId, balance, trade }) => {
      this.broadcastToUser(userId, {
        type: 'BALANCE_UPDATE',
        data: {
          balance,
          trade,
          isPaperTrading: true
        },
        timestamp: Date.now()
      });
    });

    virtualPortfolioManager.on('positionUpdated', ({ userId, position, trade }) => {
      this.broadcastToUser(userId, {
        type: 'POSITION_UPDATE',
        data: {
          position: {
            ...position,
            isPaperPosition: true,
            safetyStatus: 'SIMULATED'
          },
          trade,
          isPaperTrading: true
        },
        timestamp: Date.now()
      });
    });
  }

  /**
   * Start periodic updates for all clients
   */
  private startPeriodicUpdates(): void {
    this.updateInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        this.sendPortfolioUpdate(clientId);
        this.sendPositionsUpdate(clientId);
      });
    }, 5000); // Update every 5 seconds
  }

  /**
   * Start ping-pong to keep connections alive
   */
  private startPingPong(): void {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      this.clients.forEach((client, clientId) => {
        if (now - client.lastPing > 60000) { // 1 minute timeout
          logger.warn(`Client ${clientId} timed out, removing`);
          this.removeClient(clientId);
        } else if (client.ws.readyState === WebSocket.OPEN) {
          this.sendMessage(clientId, {
            type: 'PING',
            timestamp: now
          });
        }
      });
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Get connected clients count
   */
  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Get clients for a specific user
   */
  public getUserClientsCount(userId: string): number {
    return this.userClients.get(userId)?.size || 0;
  }

  /**
   * Shutdown the service
   */
  public shutdown(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close all client connections
    this.clients.forEach((client, clientId) => {
      this.removeClient(clientId);
    });

    logger.info('Virtual Portfolio WebSocket Service shut down');
  }
}

// Export singleton instance
export const virtualPortfolioWebSocketService = VirtualPortfolioWebSocketService.getInstance();