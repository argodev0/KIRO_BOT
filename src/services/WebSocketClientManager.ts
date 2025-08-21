import { AuthenticatedSocket } from './WebSocketServer';
import { logger } from '@/utils/logger';
import { WebSocketMessage } from '@/types';

export interface ClientSubscription {
  socketId: string;
  userId: string;
  channels: string[];
  connectedAt: number;
  lastActivity: number;
}

export interface ChannelInfo {
  name: string;
  description: string;
  requiresAuth: boolean;
  adminOnly: boolean;
  userSpecific: boolean;
}

export class WebSocketClientManager {
  private clients: Map<string, ClientSubscription> = new Map();
  private channelDefinitions: Map<string, ChannelInfo> = new Map();
  private heartbeatInterval!: NodeJS.Timeout;
  private cleanupInterval!: NodeJS.Timeout;

  constructor() {
    this.initializeChannelDefinitions();
    this.startHeartbeat();
    this.startCleanup();
    logger.info('WebSocketClientManager initialized');
  }

  private initializeChannelDefinitions(): void {
    const channels: ChannelInfo[] = [
      {
        name: 'market_data',
        description: 'Real-time market data updates',
        requiresAuth: true,
        adminOnly: false,
        userSpecific: false
      },
      {
        name: 'price_updates',
        description: 'Price change notifications',
        requiresAuth: true,
        adminOnly: false,
        userSpecific: false
      },
      {
        name: 'trading_signals',
        description: 'AI-generated trading signals',
        requiresAuth: true,
        adminOnly: false,
        userSpecific: false
      },
      {
        name: 'system_status',
        description: 'System health and status updates',
        requiresAuth: false,
        adminOnly: false,
        userSpecific: false
      },
      {
        name: 'admin_alerts',
        description: 'Administrative alerts and notifications',
        requiresAuth: true,
        adminOnly: true,
        userSpecific: false
      },
      {
        name: 'system_metrics',
        description: 'System performance metrics',
        requiresAuth: true,
        adminOnly: true,
        userSpecific: false
      },
      {
        name: 'all_trades',
        description: 'All trade executions (admin view)',
        requiresAuth: true,
        adminOnly: true,
        userSpecific: false
      },
      {
        name: 'risk_alerts',
        description: 'Risk management alerts',
        requiresAuth: true,
        adminOnly: true,
        userSpecific: false
      }
    ];

    channels.forEach(channel => {
      this.channelDefinitions.set(channel.name, channel);
    });

    // User-specific channels are dynamically created
    logger.info(`Initialized ${channels.length} channel definitions`);
  }

  public registerClient(socket: AuthenticatedSocket): void {
    const subscription: ClientSubscription = {
      socketId: socket.id,
      userId: socket.user?.id || 'anonymous',
      channels: [],
      connectedAt: Date.now(),
      lastActivity: Date.now()
    };

    this.clients.set(socket.id, subscription);
    logger.info(`Registered client: ${socket.id} (User: ${subscription.userId})`);
  }

  public unregisterClient(socketId: string): void {
    const client = this.clients.get(socketId);
    if (client) {
      this.clients.delete(socketId);
      logger.info(`Unregistered client: ${socketId} (User: ${client.userId})`);
    }
  }

  public updateClientActivity(socketId: string): void {
    const client = this.clients.get(socketId);
    if (client) {
      client.lastActivity = Date.now();
    }
  }

  public addClientSubscription(socketId: string, channel: string): boolean {
    const client = this.clients.get(socketId);
    if (!client) {
      logger.warn(`Attempted to add subscription for unknown client: ${socketId}`);
      return false;
    }

    if (!client.channels.includes(channel)) {
      client.channels.push(channel);
      logger.debug(`Added subscription: ${socketId} -> ${channel}`);
    }

    return true;
  }

  public removeClientSubscription(socketId: string, channel: string): boolean {
    const client = this.clients.get(socketId);
    if (!client) {
      return false;
    }

    const index = client.channels.indexOf(channel);
    if (index > -1) {
      client.channels.splice(index, 1);
      logger.debug(`Removed subscription: ${socketId} -> ${channel}`);
    }

    return true;
  }

  public getClientSubscriptions(socketId: string): string[] {
    const client = this.clients.get(socketId);
    return client ? [...client.channels] : [];
  }

  public getChannelSubscribers(channel: string): string[] {
    const subscribers: string[] = [];
    
    this.clients.forEach((client, socketId) => {
      if (client.channels.includes(channel)) {
        subscribers.push(socketId);
      }
    });

    return subscribers;
  }

  public getAvailableChannels(userId?: string, userRole?: string): ChannelInfo[] {
    const availableChannels: ChannelInfo[] = [];

    this.channelDefinitions.forEach(channel => {
      // Check if channel requires authentication
      if (channel.requiresAuth && !userId) {
        return;
      }

      // Check if channel is admin-only
      if (channel.adminOnly && userRole !== 'admin' && userRole !== 'super_admin') {
        return;
      }

      availableChannels.push(channel);
    });

    // Add user-specific channels if authenticated
    if (userId) {
      const userChannels: ChannelInfo[] = [
        {
          name: `user_${userId}_trades`,
          description: 'Personal trade executions',
          requiresAuth: true,
          adminOnly: false,
          userSpecific: true
        },
        {
          name: `user_${userId}_positions`,
          description: 'Personal position updates',
          requiresAuth: true,
          adminOnly: false,
          userSpecific: true
        },
        {
          name: `user_${userId}_alerts`,
          description: 'Personal alerts and notifications',
          requiresAuth: true,
          adminOnly: false,
          userSpecific: true
        }
      ];

      availableChannels.push(...userChannels);
    }

    return availableChannels;
  }

  public validateChannelAccess(channel: string, userId?: string, userRole?: string): boolean {
    // Check if it's a user-specific channel
    if (channel.startsWith('user_')) {
      const channelUserId = channel.split('_')[1];
      
      // Users can only access their own channels, admins can access any
      if (userId === channelUserId || userRole === 'admin' || userRole === 'super_admin') {
        return true;
      }
      return false;
    }

    // Check predefined channels
    const channelInfo = this.channelDefinitions.get(channel);
    if (!channelInfo) {
      logger.warn(`Unknown channel access attempt: ${channel}`);
      return false;
    }

    // Check authentication requirement
    if (channelInfo.requiresAuth && !userId) {
      return false;
    }

    // Check admin requirement
    if (channelInfo.adminOnly && userRole !== 'admin' && userRole !== 'super_admin') {
      return false;
    }

    return true;
  }

  public getClientStats(): {
    totalClients: number;
    authenticatedClients: number;
    anonymousClients: number;
    channelDistribution: Array<{ channel: string; subscribers: number }>;
  } {
    let authenticatedClients = 0;
    let anonymousClients = 0;
    const channelCounts: Map<string, number> = new Map();

    this.clients.forEach(client => {
      if (client.userId === 'anonymous') {
        anonymousClients++;
      } else {
        authenticatedClients++;
      }

      client.channels.forEach(channel => {
        channelCounts.set(channel, (channelCounts.get(channel) || 0) + 1);
      });
    });

    const channelDistribution = Array.from(channelCounts.entries()).map(([channel, subscribers]) => ({
      channel,
      subscribers
    }));

    return {
      totalClients: this.clients.size,
      authenticatedClients,
      anonymousClients,
      channelDistribution
    };
  }

  public getInactiveClients(thresholdMs: number = 300000): ClientSubscription[] {
    const now = Date.now();
    const inactiveClients: ClientSubscription[] = [];

    this.clients.forEach(client => {
      if (now - client.lastActivity > thresholdMs) {
        inactiveClients.push(client);
      }
    });

    return inactiveClients;
  }

  public broadcastToChannel(channel: string, _message: WebSocketMessage, excludeSocketId?: string): number {
    const subscribers = this.getChannelSubscribers(channel);
    let broadcastCount = 0;

    subscribers.forEach(socketId => {
      if (socketId !== excludeSocketId) {
        // This would be handled by the WebSocketServer
        broadcastCount++;
      }
    });

    return broadcastCount;
  }

  private startHeartbeat(): void {
    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      // This would trigger the WebSocketServer to send heartbeat
      logger.debug(`Heartbeat: ${this.clients.size} connected clients`);
    }, 30000);
  }

  private startCleanup(): void {
    // Clean up inactive clients every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const inactiveClients = this.getInactiveClients(600000); // 10 minutes
      
      if (inactiveClients.length > 0) {
        logger.info(`Found ${inactiveClients.length} inactive clients for cleanup`);
        
        inactiveClients.forEach(client => {
          this.unregisterClient(client.socketId);
        });
      }
    }, 300000); // 5 minutes
  }

  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.clients.clear();
    this.channelDefinitions.clear();
    
    logger.info('WebSocketClientManager shutdown complete');
  }
}