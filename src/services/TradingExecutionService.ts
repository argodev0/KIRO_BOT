/**
 * Trading Execution Service
 * Handles order placement, monitoring, and execution with advanced features
 */

import { EventEmitter } from 'events';
import { ExchangeManager, ExchangeName } from './exchanges/ExchangeManager';
import { 
  OrderRequest, 
  OrderResponse, 
  OrderStatus, 
  OrderUpdate, 
  ExecutionResult, 

  TradingSignal 
} from '../types/trading';
import { logger } from '../utils/logger';

export interface SlippageProtection {
  enabled: boolean;
  maxSlippagePercent: number;
  priceCheckInterval: number;
  cancelOnExcessiveSlippage: boolean;
}

export interface OrderOptimization {
  enabled: boolean;
  iceberg: {
    enabled: boolean;
    chunkSize: number;
    minChunkSize: number;
  };
  twap: {
    enabled: boolean;
    duration: number;
    intervals: number;
  };
}

export interface ExecutionConfig {
  slippageProtection: SlippageProtection;
  orderOptimization: OrderOptimization;
  maxRetries: number;
  retryDelay: number;
  orderTimeout: number;
  enableAuditLog: boolean;
}

export interface OrderContext {
  orderId: string;
  originalOrder: OrderRequest;
  currentOrder: OrderResponse;
  signalId?: string;
  createdAt: number;
  lastUpdate: number;
  fills: PartialFill[];
  totalFilled: number;
  averagePrice: number;
  status: OrderStatus;
  retryCount: number;
  slippageChecks: SlippageCheck[];
}

export interface PartialFill {
  quantity: number;
  price: number;
  fee: number;
  timestamp: number;
  tradeId: string;
}

export interface SlippageCheck {
  timestamp: number;
  expectedPrice: number;
  actualPrice: number;
  slippagePercent: number;
  action: 'continue' | 'cancel' | 'adjust';
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  action: string;
  orderId: string;
  details: any;
  userId?: string;
  exchange: string;
}

export class TradingExecutionService extends EventEmitter {
  private exchangeManager: ExchangeManager;
  private config: ExecutionConfig;
  private activeOrders: Map<string, OrderContext> = new Map();
  private auditLog: AuditLogEntry[] = [];
  private monitoringInterval?: NodeJS.Timeout;

  constructor(exchangeManager: ExchangeManager, config: ExecutionConfig) {
    super();
    this.exchangeManager = exchangeManager;
    this.config = config;
    
    this.startOrderMonitoring();
    this.setupExchangeEventHandlers();
  }

  /**
   * Execute a trading signal by placing appropriate orders
   */
  async executeSignal(signal: TradingSignal, positionSize: number): Promise<ExecutionResult> {
    try {
      this.logAudit('signal_execution_start', '', {
        signalId: signal.id,
        symbol: signal.symbol,
        direction: signal.direction,
        positionSize
      });

      // Create order request from signal
      const orderRequest: OrderRequest = {
        symbol: signal.symbol,
        side: signal.direction === 'long' ? 'buy' : 'sell',
        type: 'market', // Start with market orders for immediate execution
        quantity: positionSize,
        exchange: this.selectOptimalExchange(signal.symbol),
        clientOrderId: `signal_${signal.id}_${Date.now()}`
      };

      // Execute the order
      const result = await this.placeOrder(orderRequest, signal.id);
      
      this.logAudit('signal_execution_complete', result.orderId || '', {
        signalId: signal.id,
        success: result.success,
        executedQuantity: result.executedQuantity,
        averagePrice: result.averagePrice
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logAudit('signal_execution_error', '', {
        signalId: signal.id,
        error: errorMessage
      });

      logger.error('Failed to execute signal:', error);
      
      return {
        success: false,
        executedQuantity: 0,
        error: errorMessage,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Place an order with advanced execution features
   */
  async placeOrder(orderRequest: OrderRequest, signalId?: string): Promise<ExecutionResult> {
    try {
      // Validate order request
      this.validateOrderRequest(orderRequest);

      // Apply order optimization if enabled
      const optimizedOrders = this.config.orderOptimization.enabled 
        ? await this.optimizeOrder(orderRequest)
        : [orderRequest];

      let totalExecuted = 0;
      let totalValue = 0;
      let lastOrderId = '';

      // Execute all optimized orders
      for (const order of optimizedOrders) {
        const result = await this.executeSingleOrder(order, signalId);
        
        if (result.success && result.orderId) {
          totalExecuted += result.executedQuantity;
          totalValue += result.executedQuantity * (result.averagePrice || 0);
          lastOrderId = result.orderId;
        } else if (!result.success) {
          // If any order fails, return the failure
          return result;
        }
      }

      const averagePrice = totalExecuted > 0 ? totalValue / totalExecuted : 0;

      return {
        success: true,
        orderId: lastOrderId,
        executedQuantity: totalExecuted > 0 ? totalExecuted : optimizedOrders.reduce((sum, order) => sum + order.quantity, 0),
        averagePrice,
        timestamp: Date.now()
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to place order:', error);
      
      return {
        success: false,
        executedQuantity: 0,
        error: errorMessage,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      const orderContext = this.activeOrders.get(orderId);
      if (!orderContext) {
        throw new Error(`Order ${orderId} not found`);
      }

      this.logAudit('order_cancel_request', orderId, {
        symbol: orderContext.originalOrder.symbol,
        exchange: orderContext.originalOrder.exchange
      });

      const success = await this.exchangeManager.cancelOrder(
        orderId,
        orderContext.originalOrder.symbol,
        orderContext.originalOrder.exchange as ExchangeName
      );

      if (success) {
        orderContext.status = 'cancelled';
        orderContext.lastUpdate = Date.now();
        
        this.logAudit('order_cancelled', orderId, {
          totalFilled: orderContext.totalFilled,
          averagePrice: orderContext.averagePrice
        });

        this.emit('orderCancelled', orderContext);
      }

      return success;
    } catch (error) {
      logger.error(`Failed to cancel order ${orderId}:`, error);
      this.logAudit('order_cancel_error', orderId, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Modify an order (cancel and replace)
   */
  async modifyOrder(orderId: string, modifications: Partial<OrderRequest>): Promise<ExecutionResult> {
    try {
      const orderContext = this.activeOrders.get(orderId);
      if (!orderContext) {
        throw new Error(`Order ${orderId} not found`);
      }

      this.logAudit('order_modify_request', orderId, modifications);

      // Cancel existing order
      const cancelled = await this.cancelOrder(orderId);
      if (!cancelled) {
        throw new Error('Failed to cancel existing order');
      }

      // Create new order with modifications
      const newOrderRequest: OrderRequest = {
        ...orderContext.originalOrder,
        ...modifications,
        clientOrderId: `modified_${Date.now()}`
      };

      // Place new order
      const result = await this.placeOrder(newOrderRequest, orderContext.signalId);
      
      this.logAudit('order_modified', result.orderId || '', {
        originalOrderId: orderId,
        modifications,
        success: result.success
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to modify order ${orderId}:`, error);
      
      this.logAudit('order_modify_error', orderId, {
        error: errorMessage
      });

      return {
        success: false,
        executedQuantity: 0,
        error: errorMessage,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(orderId: string): Promise<OrderResponse | null> {
    try {
      const orderContext = this.activeOrders.get(orderId);
      if (!orderContext) {
        return null;
      }

      // Get fresh status from exchange
      const orderStatus = await this.exchangeManager.getOrder(
        orderId,
        orderContext.originalOrder.symbol,
        orderContext.originalOrder.exchange as ExchangeName
      );

      // Update local context
      this.updateOrderContext(orderId, orderStatus);

      return orderStatus;
    } catch (error) {
      logger.error(`Failed to get order status for ${orderId}:`, error);
      return null;
    }
  }

  /**
   * Get all active orders
   */
  getActiveOrders(): OrderContext[] {
    return Array.from(this.activeOrders.values());
  }

  /**
   * Get order history
   */
  async getOrderHistory(symbol?: string, limit: number = 100): Promise<OrderResponse[]> {
    try {
      // Get from all exchanges and merge
      const exchanges = this.exchangeManager.getAvailableExchanges();
      const allOrders: OrderResponse[] = [];

      for (const exchange of exchanges) {
        try {
          const orders = await this.exchangeManager.getOrderHistory(symbol, limit, exchange);
          allOrders.push(...orders);
        } catch (error) {
          logger.warn(`Failed to get order history from ${exchange}:`, error);
        }
      }

      // Sort by timestamp descending
      return allOrders.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    } catch (error) {
      logger.error('Failed to get order history:', error);
      return [];
    }
  }

  /**
   * Get audit log
   */
  getAuditLog(limit: number = 1000): AuditLogEntry[] {
    return this.auditLog.slice(-limit);
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Cancel all active orders
    const cancelPromises = Array.from(this.activeOrders.keys()).map(orderId => 
      this.cancelOrder(orderId)
    );

    await Promise.allSettled(cancelPromises);
    
    this.logAudit('service_shutdown', '', {
      activeOrdersCount: this.activeOrders.size
    });

    this.activeOrders.clear();
  }

  // Private methods

  private async executeSingleOrder(orderRequest: OrderRequest, signalId?: string): Promise<ExecutionResult> {
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount <= this.config.maxRetries) {
      try {
        // Check slippage before placing order
        if (this.config.slippageProtection.enabled && orderRequest.price) {
          const slippageCheck = await this.checkSlippage(orderRequest);
          if (!slippageCheck.allowed) {
            throw new Error(`Excessive slippage detected: ${slippageCheck.slippagePercent}%`);
          }
        }

        // Place order on exchange
        const orderResponse = await this.exchangeManager.placeOrder(
          orderRequest,
          orderRequest.exchange as ExchangeName
        );

        // Create order context for monitoring
        const orderContext: OrderContext = {
          orderId: orderResponse.orderId,
          originalOrder: orderRequest,
          currentOrder: orderResponse,
          createdAt: Date.now(),
          lastUpdate: Date.now(),
          fills: [],
          totalFilled: 0,
          averagePrice: 0,
          status: orderResponse.status,
          retryCount,
          slippageChecks: [],
          ...(signalId && { signalId })
        };

        this.activeOrders.set(orderResponse.orderId, orderContext);

        this.logAudit('order_placed', orderResponse.orderId, {
          symbol: orderRequest.symbol,
          side: orderRequest.side,
          type: orderRequest.type,
          quantity: orderRequest.quantity,
          price: orderRequest.price,
          exchange: orderRequest.exchange
        });

        this.emit('orderPlaced', orderContext);

        // For market orders, they should execute immediately
        if (orderRequest.type === 'market') {
          // Wait a bit for execution and get final status
          await new Promise(resolve => setTimeout(resolve, 1000));
          const finalStatus = await this.getOrderStatus(orderResponse.orderId);
          
          if (finalStatus && (finalStatus.status === 'filled' || finalStatus.status === 'partially_filled')) {
            const executedQuantity = orderContext.totalFilled || orderRequest.quantity;
            return {
              success: true,
              orderId: orderResponse.orderId,
              executedQuantity,
              averagePrice: orderContext.averagePrice || finalStatus.price || 0,
              timestamp: Date.now()
            };
          }
        }

        return {
          success: true,
          orderId: orderResponse.orderId,
          executedQuantity: orderRequest.type === 'market' ? orderRequest.quantity : 0, // Market orders execute immediately
          averagePrice: orderRequest.price || 0,
          timestamp: Date.now()
        };

      } catch (error) {
        lastError = error as Error;
        retryCount++;
        
        this.logAudit('order_retry', '', {
          attempt: retryCount,
          maxRetries: this.config.maxRetries,
          error: lastError.message,
          orderRequest
        });

        if (retryCount <= this.config.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * retryCount));
        }
      }
    }

    return {
      success: false,
      executedQuantity: 0,
      error: lastError?.message || 'Unknown error after retries',
      timestamp: Date.now()
    };
  }

  private validateOrderRequest(order: OrderRequest): void {
    if (!order.symbol || !order.side || !order.type || !order.quantity || !order.exchange) {
      throw new Error('Invalid order request: missing required fields');
    }

    if (order.quantity <= 0) {
      throw new Error('Order quantity must be positive');
    }

    if (order.type === 'limit' && !order.price) {
      throw new Error('Limit orders require a price');
    }

    if (order.type === 'stop' && !order.stopPrice) {
      throw new Error('Stop orders require a stop price');
    }
  }

  private async optimizeOrder(order: OrderRequest): Promise<OrderRequest[]> {
    const optimization = this.config.orderOptimization;
    
    // Iceberg orders - split large orders into smaller chunks
    if (optimization.iceberg.enabled && order.quantity > optimization.iceberg.chunkSize) {
      const chunks: OrderRequest[] = [];
      let remainingQuantity = order.quantity;
      
      while (remainingQuantity > 0) {
        const chunkSize = Math.min(
          optimization.iceberg.chunkSize,
          Math.max(optimization.iceberg.minChunkSize, remainingQuantity)
        );
        
        chunks.push({
          ...order,
          quantity: chunkSize,
          clientOrderId: `${order.clientOrderId}_chunk_${chunks.length}`
        });
        
        remainingQuantity -= chunkSize;
      }
      
      return chunks;
    }

    // TWAP orders - time-weighted average price execution
    if (optimization.twap.enabled && order.type === 'market') {
      const chunks: OrderRequest[] = [];
      const chunkSize = order.quantity / optimization.twap.intervals;
      
      for (let i = 0; i < optimization.twap.intervals; i++) {
        chunks.push({
          ...order,
          quantity: chunkSize,
          clientOrderId: `${order.clientOrderId}_twap_${i}`
        });
      }
      
      return chunks;
    }

    return [order];
  }

  private async checkSlippage(order: OrderRequest): Promise<{ allowed: boolean; slippagePercent: number }> {
    try {
      if (!order.price) {
        return { allowed: true, slippagePercent: 0 };
      }

      const ticker = await this.exchangeManager.getTicker(
        order.symbol,
        order.exchange as ExchangeName
      );

      const currentPrice = order.side === 'buy' ? ticker.ask : ticker.bid;
      const slippagePercent = Math.abs((currentPrice - order.price) / order.price) * 100;

      const allowed = slippagePercent <= this.config.slippageProtection.maxSlippagePercent;

      return { allowed, slippagePercent };
    } catch (error) {
      logger.warn('Failed to check slippage, allowing order:', error);
      return { allowed: true, slippagePercent: 0 };
    }
  }

  private selectOptimalExchange(_symbol: string): string {
    // Simple implementation - could be enhanced with liquidity/fee analysis
    const exchanges = this.exchangeManager.getAvailableExchanges();
    
    // Prefer Binance for higher liquidity
    if (exchanges.includes('binance')) {
      return 'binance';
    }
    
    return exchanges[0] || 'binance';
  }

  private startOrderMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      await this.monitorActiveOrders();
    }, 5000); // Check every 5 seconds
  }

  private async monitorActiveOrders(): Promise<void> {
    const activeOrderIds = Array.from(this.activeOrders.keys());
    
    for (const orderId of activeOrderIds) {
      try {
        const orderContext = this.activeOrders.get(orderId);
        if (!orderContext) continue;

        // Skip if order is already completed
        if (['filled', 'cancelled', 'rejected', 'expired'].includes(orderContext.status)) {
          continue;
        }

        // Check for timeout
        const orderAge = Date.now() - orderContext.createdAt;
        if (orderAge > this.config.orderTimeout) {
          await this.cancelOrder(orderId);
          continue;
        }

        // Get current status
        const currentStatus = await this.getOrderStatus(orderId);
        if (currentStatus) {
          this.updateOrderContext(orderId, currentStatus);
        }

        // Check slippage for limit orders
        if (this.config.slippageProtection.enabled && 
            orderContext.originalOrder.type === 'limit' &&
            orderContext.originalOrder.price) {
          
          const slippageCheck = await this.checkSlippage(orderContext.originalOrder);
          
          orderContext.slippageChecks.push({
            timestamp: Date.now(),
            expectedPrice: orderContext.originalOrder.price,
            actualPrice: 0, // Would need current market price
            slippagePercent: slippageCheck.slippagePercent,
            action: slippageCheck.allowed ? 'continue' : 'cancel'
          });

          if (!slippageCheck.allowed && this.config.slippageProtection.cancelOnExcessiveSlippage) {
            await this.cancelOrder(orderId);
          }
        }

      } catch (error) {
        logger.error(`Error monitoring order ${orderId}:`, error);
      }
    }
  }

  private updateOrderContext(orderId: string, orderStatus: OrderResponse): void {
    const orderContext = this.activeOrders.get(orderId);
    if (!orderContext) return;

    const previousStatus = orderContext.status;
    orderContext.currentOrder = orderStatus;
    orderContext.status = orderStatus.status;
    orderContext.lastUpdate = Date.now();

    // Handle status changes
    if (previousStatus !== orderStatus.status) {
      this.emit('orderStatusChanged', {
        orderId,
        previousStatus,
        newStatus: orderStatus.status,
        orderContext
      });

      this.logAudit('order_status_change', orderId, {
        previousStatus,
        newStatus: orderStatus.status,
        timestamp: Date.now()
      });

      // Remove from active orders if completed
      if (['filled', 'cancelled', 'rejected', 'expired'].includes(orderStatus.status)) {
        this.activeOrders.delete(orderId);
        this.emit('orderCompleted', orderContext);
      }
    }
  }

  private setupExchangeEventHandlers(): void {
    // Listen for order updates from exchanges
    this.exchangeManager.on('orderUpdate', (update: OrderUpdate) => {
      const orderContext = this.activeOrders.get(update.orderId);
      if (orderContext) {
        // Handle partial fills
        if (update.filledQuantity > orderContext.totalFilled) {
          const newFillQuantity = update.filledQuantity - orderContext.totalFilled;
          
          const partialFill: PartialFill = {
            quantity: newFillQuantity,
            price: update.averagePrice || 0,
            fee: update.fee || 0,
            timestamp: update.timestamp,
            tradeId: `${update.orderId}_${orderContext.fills.length}`
          };

          orderContext.fills.push(partialFill);
          orderContext.totalFilled = update.filledQuantity;
          
          // Recalculate average price
          const totalValue = orderContext.fills.reduce((sum, fill) => sum + (fill.quantity * fill.price), 0);
          orderContext.averagePrice = totalValue / orderContext.totalFilled;

          this.emit('partialFill', {
            orderId: update.orderId,
            fill: partialFill,
            totalFilled: orderContext.totalFilled,
            averagePrice: orderContext.averagePrice
          });

          this.logAudit('partial_fill', update.orderId, partialFill);
        }

        // Update status
        orderContext.status = update.status;
        orderContext.lastUpdate = update.timestamp;
      }
    });
  }

  private logAudit(action: string, orderId: string, details: any): void {
    if (!this.config.enableAuditLog) return;

    const entry: AuditLogEntry = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      action,
      orderId,
      details,
      exchange: details.exchange || 'unknown'
    };

    this.auditLog.push(entry);

    // Keep only last 10000 entries
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-10000);
    }

    this.emit('auditLog', entry);
  }
}