/**
 * Hummingbot Audit Logger Service
 * Build audit logging system for all Hummingbot interactions
 */

import { EventEmitter } from 'events';
import { AuditLogService } from './AuditLogService';
import { 
  HBStrategy, 
  StrategyExecution, 
  HBInstance,
  SimulatedOrder,
  SimulatedTrade,
  SafetyViolation
} from '../types';
import { logger } from '../utils/logger';

export interface HummingbotAuditEvent {
  eventId: string;
  timestamp: number;
  eventType: 'strategy' | 'instance' | 'order' | 'trade' | 'safety' | 'configuration' | 'connection';
  action: string;
  resource: string;
  resourceId?: string;
  instanceId?: string;
  strategyId?: string;
  userId?: string;
  success: boolean;
  details: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  paperTrade: boolean;
  metadata?: Record<string, any>;
}

export interface HummingbotAuditQuery {
  eventType?: string;
  action?: string;
  instanceId?: string;
  strategyId?: string;
  userId?: string;
  startTime?: number;
  endTime?: number;
  riskLevel?: string;
  paperTradeOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface HummingbotAuditReport {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByRiskLevel: Record<string, number>;
  safetyViolations: number;
  paperTradeEvents: number;
  realTradeAttempts: number;
  timeRange: {
    start: number;
    end: number;
  };
  topInstances: Array<{
    instanceId: string;
    eventCount: number;
  }>;
  topStrategies: Array<{
    strategyId: string;
    eventCount: number;
  }>;
}

export class HummingbotAuditLogger extends EventEmitter {
  private auditService: AuditLogService;
  private auditEvents: Map<string, HummingbotAuditEvent> = new Map();
  private maxStoredEvents = 10000; // Keep last 10k events in memory
  private eventCounter = 0;

  constructor() {
    super();
    this.auditService = AuditLogService.getInstance();
    this.setupEventHandlers();
  }

  /**
   * Log Hummingbot strategy events
   */
  logStrategyEvent(
    action: 'deploy' | 'start' | 'stop' | 'pause' | 'resume' | 'modify' | 'error',
    strategy: HBStrategy | StrategyExecution,
    instanceId: string,
    success: boolean,
    details: Record<string, any> = {},
    userId?: string
  ): void {
    const eventId = this.generateEventId();
    const strategyId = 'id' in strategy ? strategy.id : `${strategy.type}_${Date.now()}`;
    
    const auditEvent: HummingbotAuditEvent = {
      eventId,
      timestamp: Date.now(),
      eventType: 'strategy',
      action,
      resource: 'hummingbot_strategy',
      resourceId: strategyId,
      instanceId,
      strategyId,
      userId,
      success,
      details: {
        strategyType: 'type' in strategy ? strategy.type : strategy.strategyType,
        ...details
      },
      riskLevel: this.assessEventRiskLevel(action, success, details),
      paperTrade: true, // All Hummingbot operations should be paper trades
      metadata: {
        strategy: this.sanitizeStrategy(strategy)
      }
    };

    this.storeAndLogEvent(auditEvent);

    // Log to audit service
    this.auditService.logTradingAuditEvent({
      action: `hummingbot_strategy_${action}`,
      resource: 'hummingbot_strategy',
      resourceId: strategyId,
      success,
      strategy: 'type' in strategy ? strategy.type : strategy.strategyType,
      paperTrade: true,
      userId,
      metadata: details
    });
  }

  /**
   * Log Hummingbot instance events
   */
  logInstanceEvent(
    action: 'create' | 'start' | 'stop' | 'restart' | 'destroy' | 'health_check' | 'scale' | 'error',
    instance: HBInstance | string,
    success: boolean,
    details: Record<string, any> = {},
    userId?: string
  ): void {
    const eventId = this.generateEventId();
    const instanceId = typeof instance === 'string' ? instance : instance.id;
    
    const auditEvent: HummingbotAuditEvent = {
      eventId,
      timestamp: Date.now(),
      eventType: 'instance',
      action,
      resource: 'hummingbot_instance',
      resourceId: instanceId,
      instanceId,
      userId,
      success,
      details,
      riskLevel: this.assessEventRiskLevel(action, success, details),
      paperTrade: true,
      metadata: {
        instance: typeof instance === 'object' ? this.sanitizeInstance(instance) : { id: instance }
      }
    };

    this.storeAndLogEvent(auditEvent);

    // Log to audit service
    this.auditService.logAuditEvent({
      action: `hummingbot_instance_${action}`,
      resource: 'hummingbot_instance',
      resourceId: instanceId,
      success,
      userId,
      metadata: details
    });
  }

  /**
   * Log Hummingbot order events
   */
  logOrderEvent(
    action: 'create' | 'cancel' | 'modify' | 'fill' | 'partial_fill' | 'reject' | 'expire',
    order: SimulatedOrder,
    success: boolean,
    details: Record<string, any> = {},
    userId?: string
  ): void {
    const eventId = this.generateEventId();
    
    const auditEvent: HummingbotAuditEvent = {
      eventId,
      timestamp: Date.now(),
      eventType: 'order',
      action,
      resource: 'hummingbot_order',
      resourceId: order.id,
      instanceId: 'simulation', // Orders are simulated
      strategyId: order.strategyId,
      userId,
      success,
      details: {
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        quantity: order.quantity,
        price: order.price,
        status: order.status,
        ...details
      },
      riskLevel: this.assessOrderRiskLevel(order, action, success),
      paperTrade: true,
      metadata: {
        order: this.sanitizeOrder(order)
      }
    };

    this.storeAndLogEvent(auditEvent);

    // Log to audit service
    this.auditService.logTradingAuditEvent({
      action: `hummingbot_order_${action}`,
      resource: 'hummingbot_order',
      resourceId: order.id,
      success,
      symbol: order.symbol,
      exchange: 'simulation',
      orderType: order.type,
      quantity: order.quantity,
      price: order.price,
      orderId: order.id,
      strategy: order.strategyId,
      paperTrade: true,
      userId,
      metadata: details
    });
  }

  /**
   * Log Hummingbot trade events
   */
  logTradeEvent(
    action: 'execute' | 'settle' | 'error',
    trade: SimulatedTrade,
    success: boolean,
    details: Record<string, any> = {},
    userId?: string
  ): void {
    const eventId = this.generateEventId();
    
    const auditEvent: HummingbotAuditEvent = {
      eventId,
      timestamp: Date.now(),
      eventType: 'trade',
      action,
      resource: 'hummingbot_trade',
      resourceId: trade.id,
      instanceId: 'simulation',
      strategyId: trade.strategyId,
      userId,
      success,
      details: {
        symbol: trade.symbol,
        side: trade.side,
        quantity: trade.quantity,
        price: trade.price,
        orderId: trade.orderId,
        ...details
      },
      riskLevel: this.assessTradeRiskLevel(trade, success),
      paperTrade: true,
      metadata: {
        trade: this.sanitizeTrade(trade)
      }
    };

    this.storeAndLogEvent(auditEvent);

    // Log to audit service
    this.auditService.logTradingAuditEvent({
      action: `hummingbot_trade_${action}`,
      resource: 'hummingbot_trade',
      resourceId: trade.id,
      success,
      symbol: trade.symbol,
      exchange: 'simulation',
      quantity: trade.quantity,
      price: trade.price,
      orderId: trade.orderId,
      tradeId: trade.id,
      strategy: trade.strategyId,
      paperTrade: true,
      userId,
      metadata: details
    });
  }

  /**
   * Log Hummingbot safety events
   */
  logSafetyEvent(
    action: 'violation' | 'emergency_shutdown' | 'risk_limit_breach' | 'safety_check' | 'recovery',
    violation: SafetyViolation | null,
    success: boolean,
    details: Record<string, any> = {},
    userId?: string
  ): void {
    const eventId = this.generateEventId();
    
    const auditEvent: HummingbotAuditEvent = {
      eventId,
      timestamp: Date.now(),
      eventType: 'safety',
      action,
      resource: 'hummingbot_safety',
      resourceId: violation?.type || 'safety_system',
      instanceId: violation?.instanceId,
      strategyId: violation?.strategyId,
      userId,
      success,
      details: {
        violationType: violation?.type,
        severity: violation?.severity,
        message: violation?.message,
        ...details
      },
      riskLevel: violation?.severity === 'critical' ? 'critical' : 
                 violation?.severity === 'high' ? 'high' : 'medium',
      paperTrade: true,
      metadata: {
        violation: violation ? this.sanitizeViolation(violation) : null
      }
    };

    this.storeAndLogEvent(auditEvent);

    // Log to audit service
    this.auditService.logSecurityAuditEvent({
      action: `hummingbot_safety_${action}`,
      resource: 'hummingbot_safety',
      resourceId: violation?.type || 'safety_system',
      success,
      eventType: 'suspicious_activity',
      severity: violation?.severity || 'medium',
      userId,
      metadata: details
    });
  }

  /**
   * Log Hummingbot configuration events
   */
  logConfigurationEvent(
    action: 'create' | 'update' | 'delete' | 'validate' | 'backup' | 'restore',
    configType: string,
    configKey: string,
    oldValue: any,
    newValue: any,
    success: boolean,
    userId?: string
  ): void {
    const eventId = this.generateEventId();
    
    const auditEvent: HummingbotAuditEvent = {
      eventId,
      timestamp: Date.now(),
      eventType: 'configuration',
      action,
      resource: 'hummingbot_configuration',
      resourceId: configKey,
      userId,
      success,
      details: {
        configType,
        configKey,
        hasOldValue: oldValue !== undefined,
        hasNewValue: newValue !== undefined
      },
      riskLevel: this.assessConfigurationRiskLevel(configType, action),
      paperTrade: true,
      metadata: {
        configType,
        oldValue: this.sanitizeConfigValue(oldValue),
        newValue: this.sanitizeConfigValue(newValue)
      }
    };

    this.storeAndLogEvent(auditEvent);

    // Log to audit service
    this.auditService.logConfigurationAuditEvent({
      action: `hummingbot_config_${action}`,
      resource: 'hummingbot_configuration',
      resourceId: configKey,
      success,
      configType: 'bot_settings',
      configKey,
      oldValue: this.sanitizeConfigValue(oldValue),
      newValue: this.sanitizeConfigValue(newValue),
      userId
    });
  }

  /**
   * Log Hummingbot connection events
   */
  logConnectionEvent(
    action: 'connect' | 'disconnect' | 'reconnect' | 'timeout' | 'error',
    instanceId: string,
    success: boolean,
    details: Record<string, any> = {},
    userId?: string
  ): void {
    const eventId = this.generateEventId();
    
    const auditEvent: HummingbotAuditEvent = {
      eventId,
      timestamp: Date.now(),
      eventType: 'connection',
      action,
      resource: 'hummingbot_connection',
      resourceId: instanceId,
      instanceId,
      userId,
      success,
      details,
      riskLevel: success ? 'low' : 'medium',
      paperTrade: true,
      metadata: details
    };

    this.storeAndLogEvent(auditEvent);

    // Log to audit service
    this.auditService.logAuditEvent({
      action: `hummingbot_connection_${action}`,
      resource: 'hummingbot_connection',
      resourceId: instanceId,
      success,
      userId,
      metadata: details
    });
  }

  /**
   * Query audit events
   */
  queryEvents(query: HummingbotAuditQuery): HummingbotAuditEvent[] {
    let events = Array.from(this.auditEvents.values());

    // Apply filters
    if (query.eventType) {
      events = events.filter(e => e.eventType === query.eventType);
    }

    if (query.action) {
      events = events.filter(e => e.action === query.action);
    }

    if (query.instanceId) {
      events = events.filter(e => e.instanceId === query.instanceId);
    }

    if (query.strategyId) {
      events = events.filter(e => e.strategyId === query.strategyId);
    }

    if (query.userId) {
      events = events.filter(e => e.userId === query.userId);
    }

    if (query.riskLevel) {
      events = events.filter(e => e.riskLevel === query.riskLevel);
    }

    if (query.paperTradeOnly) {
      events = events.filter(e => e.paperTrade);
    }

    if (query.startTime) {
      events = events.filter(e => e.timestamp >= query.startTime!);
    }

    if (query.endTime) {
      events = events.filter(e => e.timestamp <= query.endTime!);
    }

    // Sort by timestamp (newest first)
    events.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    
    return events.slice(offset, offset + limit);
  }

  /**
   * Generate audit report
   */
  generateAuditReport(startTime?: number, endTime?: number): HummingbotAuditReport {
    const now = Date.now();
    const start = startTime || (now - 24 * 60 * 60 * 1000); // Last 24 hours
    const end = endTime || now;

    const events = this.queryEvents({ startTime: start, endTime: end, limit: 10000 });

    const eventsByType: Record<string, number> = {};
    const eventsByRiskLevel: Record<string, number> = {};
    const instanceCounts: Record<string, number> = {};
    const strategyCounts: Record<string, number> = {};

    let safetyViolations = 0;
    let paperTradeEvents = 0;
    let realTradeAttempts = 0;

    for (const event of events) {
      // Count by type
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;

      // Count by risk level
      eventsByRiskLevel[event.riskLevel] = (eventsByRiskLevel[event.riskLevel] || 0) + 1;

      // Count by instance
      if (event.instanceId) {
        instanceCounts[event.instanceId] = (instanceCounts[event.instanceId] || 0) + 1;
      }

      // Count by strategy
      if (event.strategyId) {
        strategyCounts[event.strategyId] = (strategyCounts[event.strategyId] || 0) + 1;
      }

      // Count safety violations
      if (event.eventType === 'safety' && event.action === 'violation') {
        safetyViolations++;
      }

      // Count paper trade events
      if (event.paperTrade) {
        paperTradeEvents++;
      } else {
        realTradeAttempts++;
      }
    }

    // Get top instances and strategies
    const topInstances = Object.entries(instanceCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([instanceId, eventCount]) => ({ instanceId, eventCount }));

    const topStrategies = Object.entries(strategyCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([strategyId, eventCount]) => ({ strategyId, eventCount }));

    return {
      totalEvents: events.length,
      eventsByType,
      eventsByRiskLevel,
      safetyViolations,
      paperTradeEvents,
      realTradeAttempts,
      timeRange: { start, end },
      topInstances,
      topStrategies
    };
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 50): HummingbotAuditEvent[] {
    return this.queryEvents({ limit });
  }

  /**
   * Get events by risk level
   */
  getEventsByRiskLevel(riskLevel: string, limit: number = 100): HummingbotAuditEvent[] {
    return this.queryEvents({ riskLevel, limit });
  }

  /**
   * Clear old events from memory
   */
  clearOldEvents(olderThanMs: number = 7 * 24 * 60 * 60 * 1000): void {
    const cutoffTime = Date.now() - olderThanMs;
    
    for (const [eventId, event] of this.auditEvents) {
      if (event.timestamp < cutoffTime) {
        this.auditEvents.delete(eventId);
      }
    }

    logger.info(`Cleared old audit events older than ${olderThanMs}ms`);
  }

  // Private methods

  private setupEventHandlers(): void {
    // Auto-cleanup old events every hour
    setInterval(() => {
      this.clearOldEvents();
    }, 60 * 60 * 1000);
  }

  private generateEventId(): string {
    this.eventCounter++;
    return `hb_audit_${Date.now()}_${this.eventCounter}`;
  }

  private storeAndLogEvent(event: HummingbotAuditEvent): void {
    // Store in memory
    this.auditEvents.set(event.eventId, event);

    // Limit memory usage
    if (this.auditEvents.size > this.maxStoredEvents) {
      const oldestEvents = Array.from(this.auditEvents.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)
        .slice(0, this.auditEvents.size - this.maxStoredEvents);

      for (const [eventId] of oldestEvents) {
        this.auditEvents.delete(eventId);
      }
    }

    // Emit event
    this.emit('audit:event', event);

    // Log to console for high-risk events
    if (event.riskLevel === 'critical' || event.riskLevel === 'high') {
      logger.warn(`High-risk Hummingbot audit event: ${event.eventType}:${event.action}`, {
        eventId: event.eventId,
        riskLevel: event.riskLevel,
        success: event.success,
        details: event.details
      });
    }
  }

  private assessEventRiskLevel(action: string, success: boolean, details: Record<string, any>): 'low' | 'medium' | 'high' | 'critical' {
    if (!success) {
      if (action === 'deploy' || action === 'start') {
        return 'high';
      }
      return 'medium';
    }

    if (action === 'error') {
      return 'high';
    }

    if (details.emergencyShutdown) {
      return 'critical';
    }

    return 'low';
  }

  private assessOrderRiskLevel(order: SimulatedOrder, action: string, success: boolean): 'low' | 'medium' | 'high' | 'critical' {
    if (!success && (action === 'create' || action === 'fill')) {
      return 'medium';
    }

    if (order.quantity > 10000) { // Large order
      return 'medium';
    }

    return 'low';
  }

  private assessTradeRiskLevel(trade: SimulatedTrade, success: boolean): 'low' | 'medium' | 'high' | 'critical' {
    if (!success) {
      return 'medium';
    }

    const tradeValue = trade.quantity * trade.price;
    if (tradeValue > 50000) { // Large trade
      return 'medium';
    }

    return 'low';
  }

  private assessConfigurationRiskLevel(configType: string, action: string): 'low' | 'medium' | 'high' | 'critical' {
    if (configType.includes('security') || configType.includes('api')) {
      return action === 'delete' ? 'high' : 'medium';
    }

    if (configType.includes('risk') || configType.includes('limit')) {
      return 'medium';
    }

    return 'low';
  }

  private sanitizeStrategy(strategy: HBStrategy | StrategyExecution): any {
    return {
      type: 'type' in strategy ? strategy.type : strategy.strategyType,
      id: 'id' in strategy ? strategy.id : undefined,
      status: 'status' in strategy ? strategy.status : undefined,
      // Remove sensitive data
      parameters: strategy.parameters ? Object.keys(strategy.parameters) : undefined
    };
  }

  private sanitizeInstance(instance: HBInstance): any {
    return {
      id: instance.id,
      name: instance.name,
      status: instance.status,
      strategiesCount: instance.strategies?.length || 0
      // Remove sensitive configuration data
    };
  }

  private sanitizeOrder(order: SimulatedOrder): any {
    return {
      id: order.id,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      price: order.price,
      status: order.status,
      isPaperTrade: order.isPaperTrade
    };
  }

  private sanitizeTrade(trade: SimulatedTrade): any {
    return {
      id: trade.id,
      orderId: trade.orderId,
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity,
      price: trade.price,
      isPaperTrade: trade.isPaperTrade
    };
  }

  private sanitizeViolation(violation: SafetyViolation): any {
    return {
      type: violation.type,
      severity: violation.severity,
      message: violation.message,
      timestamp: violation.timestamp,
      strategyId: violation.strategyId,
      instanceId: violation.instanceId
    };
  }

  private sanitizeConfigValue(value: any): any {
    if (typeof value !== 'object' || value === null) {
      return value;
    }

    const sanitized = { ...value };
    const sensitiveKeys = ['password', 'secret', 'key', 'token', 'apiKey', 'privateKey'];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
}

export default HummingbotAuditLogger;