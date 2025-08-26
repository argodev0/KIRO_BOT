import nodemailer from 'nodemailer';
import twilio from 'twilio';
import webpush from 'web-push';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

interface NotificationChannel {
  type: 'email' | 'sms' | 'push' | 'webhook';
  enabled: boolean;
  config: any;
}

interface NotificationPreferences {
  userId: string;
  channels: NotificationChannel[];
  alertTypes: {
    trading: boolean;
    system: boolean;
    performance: boolean;
    security: boolean;
  };
  quietHours?: {
    start: string; // HH:MM format
    end: string;   // HH:MM format
    timezone: string;
  };
}

interface NotificationTemplate {
  id: string;
  name: string;
  subject: string;
  emailTemplate: string;
  smsTemplate: string;
  pushTemplate: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface NotificationRequest {
  userId: string;
  templateId: string;
  data: any;
  channels?: string[];
  priority?: 'low' | 'medium' | 'high' | 'critical';
  immediate?: boolean;
}

interface NotificationHistory {
  id: string;
  userId: string;
  templateId: string;
  channels: string[];
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  sentAt: number;
  deliveredAt?: number;
  error?: string;
}

export class NotificationService extends EventEmitter {
  private static instance: NotificationService;
  private emailTransporter: nodemailer.Transporter;
  private twilioClient: twilio.Twilio;
  private userPreferences: Map<string, NotificationPreferences> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private notificationQueue: NotificationRequest[] = [];
  private notificationHistory: NotificationHistory[] = [];
  private processingInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.initializeServices();
    this.initializeTemplates();
    this.startNotificationProcessing();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private initializeServices(): void {
    // Initialize email service
    this.emailTransporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Initialize SMS service (Twilio)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }

    // Initialize push notifications
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        'mailto:' + (process.env.VAPID_EMAIL || 'admin@tradingbot.com'),
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
    }
  }

  private initializeTemplates(): void {
    // Trading alerts
    this.addTemplate({
      id: 'trade_executed',
      name: 'Trade Executed',
      subject: 'Trade Executed: {{symbol}} {{side}}',
      emailTemplate: `
        <h2>Trade Executed</h2>
        <p>A trade has been executed on your account:</p>
        <ul>
          <li><strong>Symbol:</strong> {{symbol}}</li>
          <li><strong>Side:</strong> {{side}}</li>
          <li><strong>Quantity:</strong> {{quantity}}</li>
          <li><strong>Price:</strong> ${{price}}</li>
          <li><strong>Total:</strong> ${{total}}</li>
        </ul>
        <p>Time: {{timestamp}}</p>
      `,
      smsTemplate: 'Trade: {{side}} {{quantity}} {{symbol}} at ${{price}}',
      pushTemplate: '{{side}} {{quantity}} {{symbol}} at ${{price}}',
      priority: 'high'
    });

    this.addTemplate({
      id: 'signal_generated',
      name: 'Trading Signal Generated',
      subject: 'New Trading Signal: {{symbol}}',
      emailTemplate: `
        <h2>New Trading Signal</h2>
        <p>A new trading signal has been generated:</p>
        <ul>
          <li><strong>Symbol:</strong> {{symbol}}</li>
          <li><strong>Direction:</strong> {{direction}}</li>
          <li><strong>Confidence:</strong> {{confidence}}%</li>
          <li><strong>Entry Price:</strong> ${{entryPrice}}</li>
          <li><strong>Stop Loss:</strong> ${{stopLoss}}</li>
          <li><strong>Take Profit:</strong> ${{takeProfit}}</li>
        </ul>
      `,
      smsTemplate: 'Signal: {{direction}} {{symbol}} at ${{entryPrice}} ({{confidence}}%)',
      pushTemplate: '{{direction}} {{symbol}} signal ({{confidence}}%)',
      priority: 'medium'
    });

    // System alerts
    this.addTemplate({
      id: 'system_error',
      name: 'System Error',
      subject: 'System Error Alert',
      emailTemplate: `
        <h2>System Error Detected</h2>
        <p><strong>Error:</strong> {{error}}</p>
        <p><strong>Service:</strong> {{service}}</p>
        <p><strong>Time:</strong> {{timestamp}}</p>
        <p><strong>Severity:</strong> {{severity}}</p>
      `,
      smsTemplate: 'System Error: {{error}} in {{service}}',
      pushTemplate: 'System Error: {{error}}',
      priority: 'critical'
    });

    this.addTemplate({
      id: 'risk_alert',
      name: 'Risk Management Alert',
      subject: 'Risk Alert: {{alertType}}',
      emailTemplate: `
        <h2>Risk Management Alert</h2>
        <p><strong>Alert Type:</strong> {{alertType}}</p>
        <p><strong>Current Value:</strong> {{currentValue}}</p>
        <p><strong>Threshold:</strong> {{threshold}}</p>
        <p><strong>Action Taken:</strong> {{action}}</p>
      `,
      smsTemplate: 'Risk Alert: {{alertType}} - {{action}}',
      pushTemplate: 'Risk Alert: {{alertType}}',
      priority: 'critical'
    });

    // Performance alerts
    this.addTemplate({
      id: 'performance_alert',
      name: 'Performance Alert',
      subject: 'Performance Alert: {{metric}}',
      emailTemplate: `
        <h2>Performance Alert</h2>
        <p>A performance threshold has been exceeded:</p>
        <ul>
          <li><strong>Metric:</strong> {{metric}}</li>
          <li><strong>Current Value:</strong> {{currentValue}}</li>
          <li><strong>Threshold:</strong> {{threshold}}</li>
          <li><strong>Duration:</strong> {{duration}}</li>
        </ul>
      `,
      smsTemplate: 'Performance: {{metric}} at {{currentValue}}',
      pushTemplate: 'Performance alert: {{metric}}',
      priority: 'medium'
    });
  }

  public addTemplate(template: NotificationTemplate): void {
    this.templates.set(template.id, template);
  }

  public setUserPreferences(userId: string, preferences: NotificationPreferences): void {
    this.userPreferences.set(userId, preferences);
    logger.info(`Updated notification preferences for user ${userId}`);
  }

  public async sendNotification(request: NotificationRequest): Promise<void> {
    // Add to queue for processing
    this.notificationQueue.push(request);
    
    // Process immediately if high priority or immediate flag
    if (request.priority === 'critical' || request.immediate) {
      await this.processNotificationQueue();
    }
  }

  private async processNotificationQueue(): Promise<void> {
    while (this.notificationQueue.length > 0) {
      const request = this.notificationQueue.shift()!;
      await this.processNotification(request);
    }
  }

  private async processNotification(request: NotificationRequest): Promise<void> {
    const preferences = this.userPreferences.get(request.userId);
    if (!preferences) {
      logger.warn(`No notification preferences found for user ${request.userId}`);
      return;
    }

    const template = this.templates.get(request.templateId);
    if (!template) {
      logger.error(`Template not found: ${request.templateId}`);
      return;
    }

    // Check if notifications are allowed during quiet hours
    if (this.isQuietHours(preferences) && template.priority !== 'critical') {
      logger.info(`Skipping notification during quiet hours for user ${request.userId}`);
      return;
    }

    const notificationId = this.generateNotificationId();
    const history: NotificationHistory = {
      id: notificationId,
      userId: request.userId,
      templateId: request.templateId,
      channels: [],
      status: 'pending',
      sentAt: Date.now()
    };

    try {
      // Determine which channels to use
      const channelsToUse = request.channels || 
        preferences.channels.filter(ch => ch.enabled).map(ch => ch.type);

      for (const channelType of channelsToUse) {
        const channel = preferences.channels.find(ch => ch.type === channelType);
        if (!channel || !channel.enabled) continue;

        try {
          await this.sendToChannel(channelType, template, request.data, channel.config);
          history.channels.push(channelType);
        } catch (error) {
          logger.error(`Failed to send notification via ${channelType}:`, error);
          history.error = error instanceof Error ? error.message : String(error);
        }
      }

      history.status = history.channels.length > 0 ? 'sent' : 'failed';
      history.deliveredAt = Date.now();
    } catch (error) {
      logger.error('Error processing notification:', error);
      history.status = 'failed';
      history.error = error instanceof Error ? error.message : String(error);
    }

    this.notificationHistory.push(history);
    this.emit('notification_processed', history);
  }

  private async sendToChannel(
    channelType: string,
    template: NotificationTemplate,
    data: any,
    config: any
  ): Promise<void> {
    switch (channelType) {
      case 'email':
        await this.sendEmail(template, data, config);
        break;
      case 'sms':
        await this.sendSMS(template, data, config);
        break;
      case 'push':
        await this.sendPushNotification(template, data, config);
        break;
      case 'webhook':
        await this.sendWebhook(template, data, config);
        break;
      default:
        throw new Error(`Unsupported channel type: ${channelType}`);
    }
  }

  private async sendEmail(template: NotificationTemplate, data: any, config: any): Promise<void> {
    const subject = this.renderTemplate(template.subject, data);
    const html = this.renderTemplate(template.emailTemplate, data);

    await this.emailTransporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@tradingbot.com',
      to: config.email,
      subject,
      html
    });

    logger.info(`Email sent to ${config.email}: ${subject}`);
  }

  private async sendSMS(template: NotificationTemplate, data: any, config: any): Promise<void> {
    if (!this.twilioClient) {
      throw new Error('Twilio not configured');
    }

    const message = this.renderTemplate(template.smsTemplate, data);

    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!fromNumber) {
      throw new Error('TWILIO_PHONE_NUMBER not configured');
    }

    await this.twilioClient.messages.create({
      body: message,
      from: fromNumber,
      to: config.phoneNumber
    });

    logger.info(`SMS sent to ${config.phoneNumber}: ${message}`);
  }

  private async sendPushNotification(template: NotificationTemplate, data: any, config: any): Promise<void> {
    const payload = JSON.stringify({
      title: this.renderTemplate(template.subject, data),
      body: this.renderTemplate(template.pushTemplate, data),
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png'
    });

    await webpush.sendNotification(config.subscription, payload);
    logger.info(`Push notification sent to subscription`);
  }

  private async sendWebhook(template: NotificationTemplate, data: any, config: any): Promise<void> {
    const payload = {
      template: template.id,
      subject: this.renderTemplate(template.subject, data),
      message: this.renderTemplate(template.emailTemplate, data),
      data,
      timestamp: Date.now()
    };

    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.headers || {})
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }

    logger.info(`Webhook sent to ${config.url}`);
  }

  private renderTemplate(template: string, data: any): string {
    let rendered = template;
    
    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return rendered;
  }

  private isQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quietHours) return false;

    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      timeZone: preferences.quietHours.timezone 
    }).substring(0, 5);

    const start = preferences.quietHours.start;
    const end = preferences.quietHours.end;

    if (start <= end) {
      return currentTime >= start && currentTime <= end;
    } else {
      // Quiet hours span midnight
      return currentTime >= start || currentTime <= end;
    }
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startNotificationProcessing(): void {
    this.processingInterval = setInterval(() => {
      if (this.notificationQueue.length > 0) {
        this.processNotificationQueue();
      }
    }, 5000); // Process queue every 5 seconds
  }

  // Convenience methods for common notifications
  public async notifyTradeExecution(userId: string, tradeData: any): Promise<void> {
    await this.sendNotification({
      userId,
      templateId: 'trade_executed',
      data: {
        ...tradeData,
        timestamp: new Date().toLocaleString()
      },
      priority: 'high'
    });
  }

  public async notifySignalGenerated(userId: string, signalData: any): Promise<void> {
    await this.sendNotification({
      userId,
      templateId: 'signal_generated',
      data: signalData,
      priority: 'medium'
    });
  }

  public async notifySystemError(userId: string, errorData: any): Promise<void> {
    await this.sendNotification({
      userId,
      templateId: 'system_error',
      data: {
        ...errorData,
        timestamp: new Date().toLocaleString()
      },
      priority: 'critical',
      immediate: true
    });
  }

  public async notifyRiskAlert(userId: string, riskData: any): Promise<void> {
    await this.sendNotification({
      userId,
      templateId: 'risk_alert',
      data: riskData,
      priority: 'critical',
      immediate: true
    });
  }

  public async notifyPerformanceAlert(userId: string, performanceData: any): Promise<void> {
    await this.sendNotification({
      userId,
      templateId: 'performance_alert',
      data: performanceData,
      priority: 'medium'
    });
  }

  public getNotificationHistory(userId: string, limit: number = 50): NotificationHistory[] {
    return this.notificationHistory
      .filter(h => h.userId === userId)
      .sort((a, b) => b.sentAt - a.sentAt)
      .slice(0, limit);
  }

  public stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }
}