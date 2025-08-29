import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import { AlertNotificationService } from './AlertNotificationService';
import { NotificationService } from './NotificationService';
import { PrometheusMetricsService } from './PrometheusMetricsService';
import axios from 'axios';

interface CriticalIssue {
  id: string;
  type: 'system_failure' | 'paper_trading_violation' | 'performance_degradation' | 'security_breach';
  severity: 'warning' | 'critical' | 'emergency';
  title: string;
  description: string;
  timestamp: number;
  source: string;
  metadata: Record<string, any>;
  resolved: boolean;
  resolvedAt?: number;
  escalated: boolean;
  escalatedAt?: number;
}

interface AlertThreshold {
  metric: string;
  operator: '>' | '<' | '==' | '!=' | '>=' | '<=';
  value: number;
  duration: number; // in seconds
  severity: 'warning' | 'critical' | 'emergency';
  description: string;
  enabled: boolean;
}

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  threshold?: number;
  status: 'normal' | 'warning' | 'critical';
}

interface AlertingConfiguration {
  enabled: boolean;
  emailNotifications: {
    enabled: boolean;
    recipients: string[];
    smtpConfig: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
  };
  webhookNotifications: {
    enabled: boolean;
    endpoints: Array<{
      url: string;
      headers?: Record<string, string>;
      retryAttempts: number;
      timeout: number;
    }>;
  };
  slackNotifications: {
    enabled: boolean;
    webhookUrl: string;
    channels: {
      critical: string;
      warning: string;
      security: string;
      trading: string;
    };
  };
  escalationRules: {
    criticalIssueTimeout: number; // minutes before escalation
    emergencyIssueTimeout: number; // minutes before emergency escalation
    maxRetries: number;
  };
}

export class ProductionAlertingService extends EventEmitter {
  private static instance: ProductionAlertingService;
  
  private criticalIssues: Map<string, CriticalIssue> = new Map();
  private alertThresholds: Map<string, AlertThreshold> = new Map();
  private performanceMetrics: Map<string, PerformanceMetric> = new Map();
  private alertingConfig: AlertingConfiguration;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private escalationInterval: NodeJS.Timeout | null = null;
  
  private alertNotificationService: AlertNotificationService;
  private notificationService: NotificationService;
  private metricsService: PrometheusMetricsService;

  private constructor() {
    super();
    
    this.alertNotificationService = AlertNotificationService.getInstance();
    this.notificationService = NotificationService.getInstance();
    this.metricsService = PrometheusMetricsService.getInstance();
    
    this.initializeConfiguration();
    this.initializeAlertThresholds();
    this.startMonitoring();
    this.startEscalationMonitoring();
  }

  public static getInstance(): ProductionAlertingService {
    if (!ProductionAlertingService.instance) {
      ProductionAlertingService.instance = new ProductionAlertingService();
    }
    return ProductionAlertingService.instance;
  }

  private initializeConfiguration(): void {
    this.alertingConfig = {
      enabled: process.env.PRODUCTION_ALERTING_ENABLED === 'true',
      emailNotifications: {
        enabled: process.env.EMAIL_ALERTS_ENABLED === 'true',
        recipients: (process.env.ALERT_EMAIL_RECIPIENTS || '').split(',').filter(Boolean),
        smtpConfig: {
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || ''
          }
        }
      },
      webhookNotifications: {
        enabled: process.env.WEBHOOK_ALERTS_ENABLED === 'true',
        endpoints: this.parseWebhookEndpoints(process.env.ALERT_WEBHOOK_ENDPOINTS || '')
      },
      slackNotifications: {
        enabled: process.env.SLACK_ALERTS_ENABLED === 'true',
        webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
        channels: {
          critical: process.env.SLACK_CRITICAL_CHANNEL || '#critical-alerts',
          warning: process.env.SLACK_WARNING_CHANNEL || '#warnings',
          security: process.env.SLACK_SECURITY_CHANNEL || '#security-alerts',
          trading: process.env.SLACK_TRADING_CHANNEL || '#trading-alerts'
        }
      },
      escalationRules: {
        criticalIssueTimeout: parseInt(process.env.CRITICAL_ESCALATION_TIMEOUT || '15'),
        emergencyIssueTimeout: parseInt(process.env.EMERGENCY_ESCALATION_TIMEOUT || '5'),
        maxRetries: parseInt(process.env.ALERT_MAX_RETRIES || '3')
      }
    };

    logger.info('Production alerting service configuration initialized', {
      enabled: this.alertingConfig.enabled,
      emailEnabled: this.alertingConfig.emailNotifications.enabled,
      webhookEnabled: this.alertingConfig.webhookNotifications.enabled,
      slackEnabled: this.alertingConfig.slackNotifications.enabled
    });
  }

  private parseWebhookEndpoints(endpointsStr: string): Array<{
    url: string;
    headers?: Record<string, string>;
    retryAttempts: number;
    timeout: number;
  }> {
    if (!endpointsStr) return [];
    
    try {
      return JSON.parse(endpointsStr);
    } catch (error) {
      logger.error('Failed to parse webhook endpoints configuration:', error);
      return [];
    }
  }

  private initializeAlertThresholds(): void {
    // System Health Thresholds
    this.addAlertThreshold({
      metric: 'system_memory_usage_percent',
      operator: '>',
      value: 90,
      duration: 300, // 5 minutes
      severity: 'critical',
      description: 'System memory usage above 90%',
      enabled: true
    });

    this.addAlertThreshold({
      metric: 'system_cpu_usage_percent',
      operator: '>',
      value: 85,
      duration: 600, // 10 minutes
      severity: 'warning',
      description: 'System CPU usage above 85%',
      enabled: true
    });

    this.addAlertThreshold({
      metric: 'system_disk_usage_percent',
      operator: '>',
      value: 95,
      duration: 60, // 1 minute
      severity: 'critical',
      description: 'System disk usage above 95%',
      enabled: true
    });

    // Paper Trading Safety Thresholds
    this.addAlertThreshold({
      metric: 'paper_trading_mode_enabled',
      operator: '==',
      value: 0,
      duration: 0, // Immediate
      severity: 'emergency',
      description: 'Paper trading mode has been disabled',
      enabled: true
    });

    this.addAlertThreshold({
      metric: 'paper_trading_safety_score',
      operator: '<',
      value: 90,
      duration: 0, // Immediate
      severity: 'emergency',
      description: 'Paper trading safety score below 90%',
      enabled: true
    });

    this.addAlertThreshold({
      metric: 'real_trading_attempts_blocked_rate',
      operator: '>',
      value: 0,
      duration: 0, // Immediate
      severity: 'critical',
      description: 'Real trading attempts detected and blocked',
      enabled: true
    });

    // Performance Thresholds
    this.addAlertThreshold({
      metric: 'api_response_time_p95',
      operator: '>',
      value: 2000, // 2 seconds
      duration: 300, // 5 minutes
      severity: 'warning',
      description: 'API response time P95 above 2 seconds',
      enabled: true
    });

    this.addAlertThreshold({
      metric: 'websocket_connection_failures_rate',
      operator: '>',
      value: 0.1,
      duration: 300, // 5 minutes
      severity: 'warning',
      description: 'WebSocket connection failure rate above 0.1/sec',
      enabled: true
    });

    this.addAlertThreshold({
      metric: 'market_data_latency_p95',
      operator: '>',
      value: 1000, // 1 second
      duration: 300, // 5 minutes
      severity: 'warning',
      description: 'Market data latency P95 above 1 second',
      enabled: true
    });

    // Database Performance Thresholds
    this.addAlertThreshold({
      metric: 'database_connection_pool_usage_percent',
      operator: '>',
      value: 80,
      duration: 300, // 5 minutes
      severity: 'warning',
      description: 'Database connection pool usage above 80%',
      enabled: true
    });

    this.addAlertThreshold({
      metric: 'database_query_time_p95',
      operator: '>',
      value: 1000, // 1 second
      duration: 300, // 5 minutes
      severity: 'warning',
      description: 'Database query time P95 above 1 second',
      enabled: true
    });

    // Security Thresholds
    this.addAlertThreshold({
      metric: 'failed_authentication_rate',
      operator: '>',
      value: 0.5,
      duration: 300, // 5 minutes
      severity: 'warning',
      description: 'Failed authentication rate above 0.5/sec',
      enabled: true
    });

    this.addAlertThreshold({
      metric: 'rate_limit_violations_rate',
      operator: '>',
      value: 1,
      duration: 300, // 5 minutes
      severity: 'warning',
      description: 'Rate limit violations above 1/sec',
      enabled: true
    });

    logger.info(`Initialized ${this.alertThresholds.size} alert thresholds`);
  }

  public addAlertThreshold(threshold: AlertThreshold): void {
    this.alertThresholds.set(threshold.metric, threshold);
    logger.debug(`Added alert threshold for ${threshold.metric}`);
  }

  public removeAlertThreshold(metric: string): boolean {
    const removed = this.alertThresholds.delete(metric);
    if (removed) {
      logger.info(`Removed alert threshold for ${metric}`);
    }
    return removed;
  }

  public updateAlertThreshold(metric: string, updates: Partial<AlertThreshold>): boolean {
    const threshold = this.alertThresholds.get(metric);
    if (!threshold) {
      return false;
    }

    Object.assign(threshold, updates);
    this.alertThresholds.set(metric, threshold);
    logger.info(`Updated alert threshold for ${metric}`);
    return true;
  }

  // Critical Issue Detection
  public detectCriticalIssue(
    type: CriticalIssue['type'],
    title: string,
    description: string,
    source: string,
    metadata: Record<string, any> = {},
    severity: CriticalIssue['severity'] = 'critical'
  ): string {
    const issueId = this.generateIssueId();
    const issue: CriticalIssue = {
      id: issueId,
      type,
      severity,
      title,
      description,
      timestamp: Date.now(),
      source,
      metadata,
      resolved: false,
      escalated: false
    };

    this.criticalIssues.set(issueId, issue);
    
    // Emit event for immediate processing
    this.emit('critical_issue_detected', issue);
    
    // Send immediate notifications for critical and emergency issues
    if (severity === 'critical' || severity === 'emergency') {
      this.sendImmediateAlert(issue);
    }

    // Update metrics
    this.metricsService.incrementCounter('critical_issues_detected_total', {
      type,
      severity,
      source
    });

    logger.error(`Critical issue detected: ${title}`, {
      issueId,
      type,
      severity,
      source,
      metadata
    });

    return issueId;
  }

  public resolveCriticalIssue(issueId: string, resolvedBy?: string): boolean {
    const issue = this.criticalIssues.get(issueId);
    if (!issue || issue.resolved) {
      return false;
    }

    issue.resolved = true;
    issue.resolvedAt = Date.now();
    issue.metadata.resolvedBy = resolvedBy;

    this.criticalIssues.set(issueId, issue);
    
    // Emit resolution event
    this.emit('critical_issue_resolved', issue);
    
    // Send resolution notification
    this.sendResolutionAlert(issue);

    // Update metrics
    this.metricsService.incrementCounter('critical_issues_resolved_total', {
      type: issue.type,
      severity: issue.severity,
      source: issue.source
    });

    const resolutionTime = issue.resolvedAt - issue.timestamp;
    this.metricsService.recordHistogram('critical_issue_resolution_time_seconds', resolutionTime / 1000, {
      type: issue.type,
      severity: issue.severity
    });

    logger.info(`Critical issue resolved: ${issue.title}`, {
      issueId,
      resolutionTime: `${Math.round(resolutionTime / 1000)}s`,
      resolvedBy
    });

    return true;
  }

  // Performance Monitoring
  public updatePerformanceMetric(name: string, value: number, threshold?: number): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      threshold,
      status: this.determineMetricStatus(value, threshold)
    };

    this.performanceMetrics.set(name, metric);
    
    // Check if this metric violates any thresholds
    this.checkMetricThresholds(name, value);
    
    // Update Prometheus metrics
    this.metricsService.setGauge(`performance_metric_${name}`, value);
    
    if (metric.status !== 'normal') {
      logger.warn(`Performance metric ${name} is ${metric.status}`, {
        value,
        threshold,
        status: metric.status
      });
    }
  }

  private determineMetricStatus(value: number, threshold?: number): 'normal' | 'warning' | 'critical' {
    if (!threshold) return 'normal';
    
    if (value >= threshold * 1.2) return 'critical';
    if (value >= threshold) return 'warning';
    return 'normal';
  }

  private checkMetricThresholds(metricName: string, value: number): void {
    const threshold = this.alertThresholds.get(metricName);
    if (!threshold || !threshold.enabled) {
      return;
    }

    const violatesThreshold = this.evaluateThreshold(value, threshold);
    if (violatesThreshold) {
      this.detectCriticalIssue(
        'performance_degradation',
        `Performance threshold violated: ${metricName}`,
        `${threshold.description}. Current value: ${value}, threshold: ${threshold.value}`,
        'performance_monitor',
        {
          metric: metricName,
          currentValue: value,
          threshold: threshold.value,
          operator: threshold.operator
        },
        threshold.severity
      );
    }
  }

  private evaluateThreshold(value: number, threshold: AlertThreshold): boolean {
    switch (threshold.operator) {
      case '>': return value > threshold.value;
      case '<': return value < threshold.value;
      case '>=': return value >= threshold.value;
      case '<=': return value <= threshold.value;
      case '==': return value === threshold.value;
      case '!=': return value !== threshold.value;
      default: return false;
    }
  }

  // Paper Trading Safety Monitoring
  public checkPaperTradingSafety(): void {
    try {
      // Check if paper trading mode is enabled
      const paperTradingEnabled = process.env.TRADING_SIMULATION_ONLY === 'true';
      if (!paperTradingEnabled) {
        this.detectCriticalIssue(
          'paper_trading_violation',
          'Paper Trading Mode Disabled',
          'CRITICAL: Paper trading mode has been disabled. Real trading may be active.',
          'paper_trading_monitor',
          {
            environment: process.env.NODE_ENV,
            tradingSimulationOnly: process.env.TRADING_SIMULATION_ONLY
          },
          'emergency'
        );
      }

      // Check for production API keys
      const hasProductionKeys = this.checkForProductionAPIKeys();
      if (hasProductionKeys) {
        this.detectCriticalIssue(
          'paper_trading_violation',
          'Production API Keys Detected',
          'CRITICAL: Production API keys detected in paper trading environment.',
          'api_key_monitor',
          {
            environment: process.env.NODE_ENV
          },
          'emergency'
        );
      }

      // Calculate and check safety score
      const safetyScore = this.calculatePaperTradingSafetyScore();
      if (safetyScore < 90) {
        this.detectCriticalIssue(
          'paper_trading_violation',
          'Low Paper Trading Safety Score',
          `Paper trading safety score is ${safetyScore}%, below the required 90% threshold.`,
          'safety_score_monitor',
          {
            safetyScore,
            threshold: 90
          },
          'emergency'
        );
      }

      // Update safety metrics
      this.metricsService.setGauge('paper_trading_mode_enabled', paperTradingEnabled ? 1 : 0);
      this.metricsService.setGauge('paper_trading_safety_score', safetyScore);
      this.metricsService.setGauge('production_api_keys_detected', hasProductionKeys ? 1 : 0);

    } catch (error) {
      logger.error('Error checking paper trading safety:', error);
      this.detectCriticalIssue(
        'system_failure',
        'Paper Trading Safety Check Failed',
        `Failed to perform paper trading safety check: ${error instanceof Error ? error.message : String(error)}`,
        'safety_monitor',
        { error: error instanceof Error ? error.message : String(error) },
        'critical'
      );
    }
  }

  private checkForProductionAPIKeys(): boolean {
    // Check for patterns that indicate production API keys
    const suspiciousPatterns = [
      process.env.BINANCE_API_KEY?.includes('prod'),
      process.env.KUCOIN_API_KEY?.includes('prod'),
      process.env.NODE_ENV === 'production' && process.env.TRADING_SIMULATION_ONLY !== 'true'
    ];

    return suspiciousPatterns.some(Boolean);
  }

  private calculatePaperTradingSafetyScore(): number {
    let score = 100;
    
    // Deduct points for unsafe configurations
    if (process.env.TRADING_SIMULATION_ONLY !== 'true') score -= 50;
    if (process.env.ALLOW_REAL_TRADES === 'true') score -= 30;
    if (this.checkForProductionAPIKeys()) score -= 20;
    if (process.env.NODE_ENV === 'production' && process.env.TRADING_SIMULATION_ONLY !== 'true') score -= 40;
    
    return Math.max(0, score);
  }

  // Alert Sending Methods
  private async sendImmediateAlert(issue: CriticalIssue): Promise<void> {
    if (!this.alertingConfig.enabled) {
      logger.warn('Production alerting is disabled, skipping immediate alert');
      return;
    }

    const promises: Promise<void>[] = [];

    // Send email alerts
    if (this.alertingConfig.emailNotifications.enabled) {
      promises.push(this.sendEmailAlert(issue));
    }

    // Send webhook alerts
    if (this.alertingConfig.webhookNotifications.enabled) {
      promises.push(this.sendWebhookAlert(issue));
    }

    // Send Slack alerts
    if (this.alertingConfig.slackNotifications.enabled) {
      promises.push(this.sendSlackAlert(issue));
    }

    try {
      await Promise.allSettled(promises);
      logger.info(`Immediate alerts sent for critical issue: ${issue.id}`);
    } catch (error) {
      logger.error(`Failed to send immediate alerts for issue ${issue.id}:`, error);
    }
  }

  private async sendEmailAlert(issue: CriticalIssue): Promise<void> {
    const subject = `🚨 ${issue.severity.toUpperCase()}: ${issue.title}`;
    const body = this.generateEmailBody(issue);

    for (const recipient of this.alertingConfig.emailNotifications.recipients) {
      try {
        await this.notificationService.sendNotification({
          userId: 'system',
          templateId: 'system_error',
          data: {
            error: issue.title,
            service: issue.source,
            timestamp: new Date(issue.timestamp).toISOString(),
            severity: issue.severity,
            description: issue.description,
            metadata: JSON.stringify(issue.metadata, null, 2)
          },
          channels: ['email'],
          priority: issue.severity === 'emergency' ? 'critical' : issue.severity,
          immediate: true
        });
      } catch (error) {
        logger.error(`Failed to send email alert to ${recipient}:`, error);
      }
    }
  }

  private async sendWebhookAlert(issue: CriticalIssue): Promise<void> {
    const payload = {
      type: 'critical_issue',
      issue,
      timestamp: Date.now(),
      environment: process.env.NODE_ENV
    };

    for (const endpoint of this.alertingConfig.webhookNotifications.endpoints) {
      let attempts = 0;
      const maxAttempts = endpoint.retryAttempts || 3;

      while (attempts < maxAttempts) {
        try {
          await axios.post(endpoint.url, payload, {
            headers: {
              'Content-Type': 'application/json',
              ...endpoint.headers
            },
            timeout: endpoint.timeout || 10000
          });
          
          logger.info(`Webhook alert sent to ${endpoint.url} for issue ${issue.id}`);
          break;
        } catch (error) {
          attempts++;
          logger.error(`Webhook alert attempt ${attempts} failed for ${endpoint.url}:`, error);
          
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts)); // Exponential backoff
          }
        }
      }
    }
  }

  private async sendSlackAlert(issue: CriticalIssue): Promise<void> {
    if (!this.alertingConfig.slackNotifications.webhookUrl) {
      logger.warn('Slack webhook URL not configured');
      return;
    }

    const channel = this.getSlackChannelForIssue(issue);
    const color = this.getSlackColorForSeverity(issue.severity);
    const emoji = this.getEmojiForSeverity(issue.severity);

    const payload = {
      channel,
      username: 'Trading Bot Alerts',
      icon_emoji: emoji,
      attachments: [{
        color,
        title: `${emoji} ${issue.severity.toUpperCase()}: ${issue.title}`,
        text: issue.description,
        fields: [
          { title: 'Source', value: issue.source, short: true },
          { title: 'Type', value: issue.type.replace('_', ' '), short: true },
          { title: 'Time', value: new Date(issue.timestamp).toISOString(), short: true },
          { title: 'Issue ID', value: issue.id, short: true }
        ],
        footer: 'Trading Bot Alert System',
        ts: Math.floor(issue.timestamp / 1000)
      }]
    };

    try {
      await axios.post(this.alertingConfig.slackNotifications.webhookUrl, payload);
      logger.info(`Slack alert sent to ${channel} for issue ${issue.id}`);
    } catch (error) {
      logger.error(`Failed to send Slack alert for issue ${issue.id}:`, error);
    }
  }

  private async sendResolutionAlert(issue: CriticalIssue): Promise<void> {
    if (!this.alertingConfig.enabled) return;

    const resolutionTime = issue.resolvedAt ? issue.resolvedAt - issue.timestamp : 0;
    const resolutionTimeStr = `${Math.round(resolutionTime / 1000)}s`;

    // Send Slack resolution notification
    if (this.alertingConfig.slackNotifications.enabled && this.alertingConfig.slackNotifications.webhookUrl) {
      const channel = this.getSlackChannelForIssue(issue);
      const payload = {
        channel,
        username: 'Trading Bot Alerts',
        icon_emoji: '✅',
        attachments: [{
          color: 'good',
          title: `✅ RESOLVED: ${issue.title}`,
          text: `Issue has been resolved after ${resolutionTimeStr}`,
          fields: [
            { title: 'Resolution Time', value: resolutionTimeStr, short: true },
            { title: 'Resolved By', value: issue.metadata.resolvedBy || 'System', short: true }
          ],
          footer: 'Trading Bot Alert System',
          ts: Math.floor((issue.resolvedAt || Date.now()) / 1000)
        }]
      };

      try {
        await axios.post(this.alertingConfig.slackNotifications.webhookUrl, payload);
      } catch (error) {
        logger.error(`Failed to send Slack resolution alert for issue ${issue.id}:`, error);
      }
    }
  }

  private getSlackChannelForIssue(issue: CriticalIssue): string {
    switch (issue.type) {
      case 'paper_trading_violation':
      case 'security_breach':
        return this.alertingConfig.slackNotifications.channels.security;
      case 'performance_degradation':
        return this.alertingConfig.slackNotifications.channels.warning;
      case 'system_failure':
        return issue.severity === 'emergency' ? 
          this.alertingConfig.slackNotifications.channels.critical :
          this.alertingConfig.slackNotifications.channels.warning;
      default:
        return this.alertingConfig.slackNotifications.channels.critical;
    }
  }

  private getSlackColorForSeverity(severity: string): string {
    switch (severity) {
      case 'emergency': return '#FF0000';
      case 'critical': return '#FF6600';
      case 'warning': return '#FFCC00';
      default: return '#808080';
    }
  }

  private getEmojiForSeverity(severity: string): string {
    switch (severity) {
      case 'emergency': return '🚨';
      case 'critical': return '🔥';
      case 'warning': return '⚠️';
      default: return '📢';
    }
  }

  private generateEmailBody(issue: CriticalIssue): string {
    return `
CRITICAL ISSUE DETECTED

Title: ${issue.title}
Severity: ${issue.severity.toUpperCase()}
Type: ${issue.type.replace('_', ' ')}
Source: ${issue.source}
Time: ${new Date(issue.timestamp).toISOString()}

Description:
${issue.description}

Metadata:
${JSON.stringify(issue.metadata, null, 2)}

Issue ID: ${issue.id}

This is an automated alert from the Trading Bot Production Alerting System.
    `.trim();
  }

  // Monitoring and Escalation
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.performSystemHealthCheck();
      this.checkPaperTradingSafety();
      this.checkPerformanceMetrics();
    }, 30000); // Check every 30 seconds

    logger.info('Production alerting monitoring started');
  }

  private startEscalationMonitoring(): void {
    this.escalationInterval = setInterval(() => {
      this.checkForEscalation();
    }, 60000); // Check for escalation every minute

    logger.info('Alert escalation monitoring started');
  }

  private performSystemHealthCheck(): void {
    try {
      // Check memory usage
      const memUsage = process.memoryUsage();
      const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      this.updatePerformanceMetric('system_memory_usage_percent', memUsagePercent, 85);

      // Check if critical services are running
      this.checkCriticalServices();

      // Update system health metrics
      this.metricsService.setGauge('system_health_check_timestamp', Date.now());
      
    } catch (error) {
      logger.error('System health check failed:', error);
      this.detectCriticalIssue(
        'system_failure',
        'System Health Check Failed',
        `System health check encountered an error: ${error instanceof Error ? error.message : String(error)}`,
        'health_monitor',
        { error: error instanceof Error ? error.message : String(error) },
        'warning'
      );
    }
  }

  private checkCriticalServices(): void {
    // This would check if critical services are running
    // For now, we'll just log that the check is happening
    logger.debug('Checking critical services status');
  }

  private checkPerformanceMetrics(): void {
    // Check all performance metrics against their thresholds
    for (const [name, metric] of this.performanceMetrics.entries()) {
      if (metric.status !== 'normal') {
        const age = Date.now() - metric.timestamp;
        if (age > 300000) { // 5 minutes old
          logger.warn(`Performance metric ${name} has been ${metric.status} for ${Math.round(age / 1000)}s`);
        }
      }
    }
  }

  private checkForEscalation(): void {
    const now = Date.now();
    
    for (const [issueId, issue] of this.criticalIssues.entries()) {
      if (issue.resolved || issue.escalated) continue;

      const age = now - issue.timestamp;
      const escalationTimeout = issue.severity === 'emergency' ? 
        this.alertingConfig.escalationRules.emergencyIssueTimeout * 60000 :
        this.alertingConfig.escalationRules.criticalIssueTimeout * 60000;

      if (age > escalationTimeout) {
        this.escalateIssue(issue);
      }
    }
  }

  private escalateIssue(issue: CriticalIssue): void {
    issue.escalated = true;
    issue.escalatedAt = Date.now();
    
    logger.error(`Escalating unresolved critical issue: ${issue.title}`, {
      issueId: issue.id,
      age: `${Math.round((Date.now() - issue.timestamp) / 1000)}s`
    });

    // Send escalation alert
    this.detectCriticalIssue(
      'system_failure',
      `ESCALATED: ${issue.title}`,
      `Critical issue has been escalated due to no resolution within timeout period. Original issue: ${issue.description}`,
      'escalation_monitor',
      {
        originalIssueId: issue.id,
        originalTimestamp: issue.timestamp,
        escalationReason: 'timeout'
      },
      'emergency'
    );

    this.metricsService.incrementCounter('critical_issues_escalated_total', {
      type: issue.type,
      severity: issue.severity
    });
  }

  // Utility Methods
  private generateIssueId(): string {
    return `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public Query Methods
  public getCriticalIssues(includeResolved: boolean = false): CriticalIssue[] {
    const issues = Array.from(this.criticalIssues.values());
    return includeResolved ? issues : issues.filter(issue => !issue.resolved);
  }

  public getCriticalIssueById(issueId: string): CriticalIssue | undefined {
    return this.criticalIssues.get(issueId);
  }

  public getPerformanceMetrics(): PerformanceMetric[] {
    return Array.from(this.performanceMetrics.values());
  }

  public getAlertThresholds(): AlertThreshold[] {
    return Array.from(this.alertThresholds.values());
  }

  public getAlertingConfiguration(): AlertingConfiguration {
    return { ...this.alertingConfig };
  }

  public getAlertStatistics(): {
    totalIssues: number;
    activeIssues: number;
    resolvedIssues: number;
    escalatedIssues: number;
    issuesByType: Record<string, number>;
    issuesBySeverity: Record<string, number>;
  } {
    const issues = Array.from(this.criticalIssues.values());
    
    return {
      totalIssues: issues.length,
      activeIssues: issues.filter(i => !i.resolved).length,
      resolvedIssues: issues.filter(i => i.resolved).length,
      escalatedIssues: issues.filter(i => i.escalated).length,
      issuesByType: this.groupBy(issues, 'type'),
      issuesBySeverity: this.groupBy(issues, 'severity')
    };
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, number> {
    return array.reduce((acc, item) => {
      const value = String(item[key]);
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  // Test Methods
  public async testAlertingSystem(): Promise<{
    email: boolean;
    webhook: boolean;
    slack: boolean;
  }> {
    const results = {
      email: false,
      webhook: false,
      slack: false
    };

    // Test email
    if (this.alertingConfig.emailNotifications.enabled) {
      try {
        const testIssue: CriticalIssue = {
          id: 'test_email',
          type: 'system_failure',
          severity: 'warning',
          title: 'Test Email Alert',
          description: 'This is a test email alert to verify email notification functionality.',
          timestamp: Date.now(),
          source: 'test_system',
          metadata: { test: true },
          resolved: false,
          escalated: false
        };
        
        await this.sendEmailAlert(testIssue);
        results.email = true;
      } catch (error) {
        logger.error('Email alert test failed:', error);
      }
    }

    // Test webhook
    if (this.alertingConfig.webhookNotifications.enabled) {
      try {
        const testIssue: CriticalIssue = {
          id: 'test_webhook',
          type: 'system_failure',
          severity: 'warning',
          title: 'Test Webhook Alert',
          description: 'This is a test webhook alert to verify webhook notification functionality.',
          timestamp: Date.now(),
          source: 'test_system',
          metadata: { test: true },
          resolved: false,
          escalated: false
        };
        
        await this.sendWebhookAlert(testIssue);
        results.webhook = true;
      } catch (error) {
        logger.error('Webhook alert test failed:', error);
      }
    }

    // Test Slack
    if (this.alertingConfig.slackNotifications.enabled) {
      try {
        const testIssue: CriticalIssue = {
          id: 'test_slack',
          type: 'system_failure',
          severity: 'warning',
          title: 'Test Slack Alert',
          description: 'This is a test Slack alert to verify Slack notification functionality.',
          timestamp: Date.now(),
          source: 'test_system',
          metadata: { test: true },
          resolved: false,
          escalated: false
        };
        
        await this.sendSlackAlert(testIssue);
        results.slack = true;
      } catch (error) {
        logger.error('Slack alert test failed:', error);
      }
    }

    return results;
  }

  // Cleanup
  public stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    if (this.escalationInterval) {
      clearInterval(this.escalationInterval);
      this.escalationInterval = null;
    }
    
    logger.info('Production alerting service stopped');
  }
}