import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import axios from 'axios';

interface AlertRule {
  id: string;
  name: string;
  condition: string;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  cooldownMs: number;
  lastTriggered?: number;
  channels: AlertChannel[];
}

interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  config: any;
  enabled: boolean;
}

interface Alert {
  id: string;
  ruleId: string;
  name: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: number;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  resolved?: boolean;
  resolvedAt?: number;
}

interface NotificationTemplate {
  subject: string;
  body: string;
  format: 'text' | 'html' | 'markdown';
}

export class AlertNotificationService extends EventEmitter {
  private static instance: AlertNotificationService;
  
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private notificationQueue: Alert[] = [];
  private processingInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    
    // Initialize default alert rules
    this.initializeDefaultAlertRules();
    
    // Start notification processing
    this.startNotificationProcessing();
  }

  public static getInstance(): AlertNotificationService {
    if (!AlertNotificationService.instance) {
      AlertNotificationService.instance = new AlertNotificationService();
    }
    return AlertNotificationService.instance;
  }

  private initializeDefaultAlertRules(): void {
    // Paper Trading Safety Alerts
    this.addAlertRule({
      id: 'paper-trading-disabled',
      name: 'Paper Trading Mode Disabled',
      condition: 'paper_trading_mode_enabled == 0',
      severity: 'critical',
      enabled: true,
      cooldownMs: 0, // No cooldown for critical safety alerts
      channels: [
        { type: 'email', enabled: true, config: { to: 'admin@yourdomain.com' } },
        { type: 'slack', enabled: true, config: { channel: '#trading-alerts' } },
        { type: 'sms', enabled: true, config: { to: '+1234567890' } }
      ]
    });

    this.addAlertRule({
      id: 'real-trading-attempt',
      name: 'Real Trading Attempt Blocked',
      condition: 'increase(real_trading_attempts_blocked_total[1m]) > 0',
      severity: 'critical',
      enabled: true,
      cooldownMs: 60000, // 1 minute cooldown
      channels: [
        { type: 'email', enabled: true, config: { to: 'security@yourdomain.com' } },
        { type: 'slack', enabled: true, config: { channel: '#security-alerts' } }
      ]
    });

    // System Health Alerts
    this.addAlertRule({
      id: 'high-memory-usage',
      name: 'High Memory Usage',
      condition: '(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9',
      severity: 'warning',
      enabled: true,
      cooldownMs: 300000, // 5 minutes cooldown
      channels: [
        { type: 'email', enabled: true, config: { to: 'devops@yourdomain.com' } },
        { type: 'slack', enabled: true, config: { channel: '#infrastructure' } }
      ]
    });

    // Exchange Connectivity Alerts
    this.addAlertRule({
      id: 'exchange-connection-lost',
      name: 'Exchange Connection Lost',
      condition: 'exchange_connection_status == 0',
      severity: 'critical',
      enabled: true,
      cooldownMs: 120000, // 2 minutes cooldown
      channels: [
        { type: 'email', enabled: true, config: { to: 'trading-team@yourdomain.com' } },
        { type: 'slack', enabled: true, config: { channel: '#trading-alerts' } }
      ]
    });

    logger.info(`Initialized ${this.alertRules.size} default alert rules`);
  }

  // Alert Rule Management
  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    logger.info(`Added alert rule: ${rule.name}`);
  }

  public removeAlertRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId);
    if (removed) {
      logger.info(`Removed alert rule: ${ruleId}`);
    }
    return removed;
  }

  public updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.alertRules.get(ruleId);
    if (!rule) {
      return false;
    }

    Object.assign(rule, updates);
    this.alertRules.set(ruleId, rule);
    logger.info(`Updated alert rule: ${ruleId}`);
    return true;
  }

  public getAlertRule(ruleId: string): AlertRule | undefined {
    return this.alertRules.get(ruleId);
  }

  public getAllAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  // Alert Processing
  public processAlert(alert: Omit<Alert, 'id' | 'timestamp'>): void {
    const fullAlert: Alert = {
      ...alert,
      id: this.generateAlertId(),
      timestamp: Date.now()
    };

    // Check if this alert should be processed
    if (!this.shouldProcessAlert(fullAlert)) {
      return;
    }

    // Add to active alerts
    this.activeAlerts.set(fullAlert.id, fullAlert);
    
    // Add to history
    this.alertHistory.push(fullAlert);
    
    // Limit history size
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }

    // Queue for notification
    this.notificationQueue.push(fullAlert);

    // Update rule last triggered time
    const rule = this.alertRules.get(fullAlert.ruleId);
    if (rule) {
      rule.lastTriggered = fullAlert.timestamp;
    }

    // Emit alert event
    this.emit('alert_triggered', fullAlert);
    
    logger.warn(`Alert triggered: ${fullAlert.name} - ${fullAlert.message}`);
  }

  public resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = Date.now();
    
    // Remove from active alerts
    this.activeAlerts.delete(alertId);
    
    // Emit resolution event
    this.emit('alert_resolved', alert);
    
    logger.info(`Alert resolved: ${alert.name}`);
    return true;
  }

  private shouldProcessAlert(alert: Alert): boolean {
    const rule = this.alertRules.get(alert.ruleId);
    if (!rule || !rule.enabled) {
      return false;
    }

    // Check cooldown
    if (rule.lastTriggered && rule.cooldownMs > 0) {
      const timeSinceLastTrigger = Date.now() - rule.lastTriggered;
      if (timeSinceLastTrigger < rule.cooldownMs) {
        logger.debug(`Alert ${alert.name} is in cooldown period`);
        return false;
      }
    }

    return true;
  }

  // Notification Processing
  private startNotificationProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.processNotificationQueue();
    }, 5000); // Process every 5 seconds
    
    logger.info('Alert notification processing started');
  }

  private async processNotificationQueue(): Promise<void> {
    if (this.notificationQueue.length === 0) {
      return;
    }

    const alertsToProcess = this.notificationQueue.splice(0, 10); // Process up to 10 alerts at a time
    
    for (const alert of alertsToProcess) {
      try {
        await this.sendNotifications(alert);
      } catch (error) {
        logger.error(`Failed to send notifications for alert ${alert.id}:`, error);
        
        // Re-queue the alert for retry (with limit)
        if (!alert.labels.retryCount || parseInt(alert.labels.retryCount) < 3) {
          alert.labels.retryCount = (parseInt(alert.labels.retryCount || '0') + 1).toString();
          this.notificationQueue.push(alert);
        }
      }
    }
  }

  private async sendNotifications(alert: Alert): Promise<void> {
    const rule = this.alertRules.get(alert.ruleId);
    if (!rule) {
      return;
    }

    const notifications = rule.channels
      .filter(channel => channel.enabled)
      .map(channel => this.sendNotification(alert, channel));

    await Promise.allSettled(notifications);
  }

  private async sendNotification(alert: Alert, channel: AlertChannel): Promise<void> {
    const template = this.generateNotificationTemplate(alert, channel.type);
    
    switch (channel.type) {
      case 'email':
        await this.sendEmailNotification(alert, channel, template);
        break;
      case 'slack':
        await this.sendSlackNotification(alert, channel, template);
        break;
      case 'webhook':
        await this.sendWebhookNotification(alert, channel);
        break;
      case 'sms':
        await this.sendSMSNotification(alert, channel, template);
        break;
      default:
        logger.warn(`Unknown notification channel type: ${channel.type}`);
    }
  }

  private async sendEmailNotification(alert: Alert, channel: AlertChannel, template: NotificationTemplate): Promise<void> {
    // This would integrate with an email service like SendGrid, SES, etc.
    logger.info(`Sending email notification for alert ${alert.id} to ${channel.config.to}`);
    
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.emit('notification_sent', {
      alertId: alert.id,
      channel: 'email',
      recipient: channel.config.to,
      timestamp: Date.now()
    });
  }

  private async sendSlackNotification(alert: Alert, channel: AlertChannel, template: NotificationTemplate): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      logger.warn('Slack webhook URL not configured');
      return;
    }

    const color = this.getSeverityColor(alert.severity);
    const payload = {
      channel: channel.config.channel,
      username: 'Trading Bot Alerts',
      icon_emoji: ':warning:',
      attachments: [{
        color,
        title: template.subject,
        text: template.body,
        fields: [
          { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
          { title: 'Time', value: new Date(alert.timestamp).toISOString(), short: true }
        ],
        footer: 'Trading Bot Alert System',
        ts: Math.floor(alert.timestamp / 1000)
      }]
    };

    await axios.post(webhookUrl, payload);
    
    this.emit('notification_sent', {
      alertId: alert.id,
      channel: 'slack',
      recipient: channel.config.channel,
      timestamp: Date.now()
    });
    
    logger.info(`Sent Slack notification for alert ${alert.id} to ${channel.config.channel}`);
  }

  private async sendWebhookNotification(alert: Alert, channel: AlertChannel): Promise<void> {
    const payload = {
      alert,
      timestamp: Date.now()
    };

    await axios.post(channel.config.url, payload, {
      headers: {
        'Content-Type': 'application/json',
        ...(channel.config.headers || {})
      },
      timeout: 10000
    });
    
    this.emit('notification_sent', {
      alertId: alert.id,
      channel: 'webhook',
      recipient: channel.config.url,
      timestamp: Date.now()
    });
    
    logger.info(`Sent webhook notification for alert ${alert.id} to ${channel.config.url}`);
  }

  private async sendSMSNotification(alert: Alert, channel: AlertChannel, template: NotificationTemplate): Promise<void> {
    // This would integrate with an SMS service like Twilio, AWS SNS, etc.
    logger.info(`Sending SMS notification for alert ${alert.id} to ${channel.config.to}`);
    
    // Simulate SMS sending
    await new Promise(resolve => setTimeout(resolve, 200));
    
    this.emit('notification_sent', {
      alertId: alert.id,
      channel: 'sms',
      recipient: channel.config.to,
      timestamp: Date.now()
    });
  }

  // Template Generation
  private generateNotificationTemplate(alert: Alert, channelType: string): NotificationTemplate {
    const severityEmoji = this.getSeverityEmoji(alert.severity);
    const subject = `${severityEmoji} ${alert.severity.toUpperCase()}: ${alert.name}`;
    
    let body = `${alert.message}\n\n`;
    body += `Severity: ${alert.severity}\n`;
    body += `Time: ${new Date(alert.timestamp).toISOString()}\n`;
    
    if (Object.keys(alert.labels).length > 0) {
      body += `\nLabels:\n`;
      for (const [key, value] of Object.entries(alert.labels)) {
        body += `  ${key}: ${value}\n`;
      }
    }
    
    if (Object.keys(alert.annotations).length > 0) {
      body += `\nAnnotations:\n`;
      for (const [key, value] of Object.entries(alert.annotations)) {
        body += `  ${key}: ${value}\n`;
      }
    }

    return {
      subject,
      body,
      format: channelType === 'slack' ? 'markdown' : 'text'
    };
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'danger';
      case 'warning': return 'warning';
      case 'info': return 'good';
      default: return '#808080';
    }
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '🚨';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📢';
    }
  }

  // Utility Methods
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Status and Query Methods
  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  public getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  public getAlertById(alertId: string): Alert | undefined {
    return this.activeAlerts.get(alertId) || 
           this.alertHistory.find(alert => alert.id === alertId);
  }

  public getAlertsByRule(ruleId: string): Alert[] {
    return this.alertHistory.filter(alert => alert.ruleId === ruleId);
  }

  public getAlertsBySeverity(severity: string): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => alert.severity === severity);
  }

  public getAlertStatistics(): {
    total: number;
    active: number;
    resolved: number;
    bySeverity: Record<string, number>;
  } {
    const total = this.alertHistory.length;
    const active = this.activeAlerts.size;
    const resolved = total - active;
    
    const bySeverity: Record<string, number> = {};
    for (const alert of this.alertHistory) {
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
    }

    return { total, active, resolved, bySeverity };
  }

  // Test Methods
  public async testNotificationChannel(channelType: string, config: any): Promise<boolean> {
    const testAlert: Alert = {
      id: 'test_alert',
      ruleId: 'test_rule',
      name: 'Test Alert',
      message: 'This is a test alert to verify notification channel configuration.',
      severity: 'info',
      timestamp: Date.now(),
      labels: { test: 'true' },
      annotations: { description: 'Test notification' }
    };

    const channel: AlertChannel = {
      type: channelType as any,
      config,
      enabled: true
    };

    try {
      await this.sendNotification(testAlert, channel);
      return true;
    } catch (error) {
      logger.error(`Test notification failed for ${channelType}:`, error);
      return false;
    }
  }

  // Cleanup
  public stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    logger.info('Alert notification service stopped');
  }
}