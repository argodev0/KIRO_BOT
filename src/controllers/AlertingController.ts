import { Request, Response } from 'express';
import { ProductionAlertingService } from '../services/ProductionAlertingService';
import { logger } from '../utils/logger';

export class AlertingController {
  private alertingService: ProductionAlertingService;

  constructor() {
    this.alertingService = ProductionAlertingService.getInstance();
  }

  // Get all critical issues
  public getCriticalIssues = async (req: Request, res: Response): Promise<void> => {
    try {
      const includeResolved = req.query.includeResolved === 'true';
      const issues = this.alertingService.getCriticalIssues(includeResolved);
      
      res.json({
        success: true,
        data: {
          issues,
          count: issues.length
        }
      });
    } catch (error) {
      logger.error('Error fetching critical issues:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch critical issues'
      });
    }
  };

  // Get specific critical issue
  public getCriticalIssue = async (req: Request, res: Response): Promise<void> => {
    try {
      const { issueId } = req.params;
      const issue = this.alertingService.getCriticalIssueById(issueId);
      
      if (!issue) {
        res.status(404).json({
          success: false,
          error: 'Critical issue not found'
        });
        return;
      }

      res.json({
        success: true,
        data: issue
      });
    } catch (error) {
      logger.error('Error fetching critical issue:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch critical issue'
      });
    }
  };

  // Resolve critical issue
  public resolveCriticalIssue = async (req: Request, res: Response): Promise<void> => {
    try {
      const { issueId } = req.params;
      const { resolvedBy } = req.body;
      
      const resolved = this.alertingService.resolveCriticalIssue(issueId, resolvedBy);
      
      if (!resolved) {
        res.status(404).json({
          success: false,
          error: 'Critical issue not found or already resolved'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Critical issue resolved successfully'
      });
    } catch (error) {
      logger.error('Error resolving critical issue:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to resolve critical issue'
      });
    }
  };

  // Create manual critical issue
  public createCriticalIssue = async (req: Request, res: Response): Promise<void> => {
    try {
      const { type, title, description, source, metadata, severity } = req.body;
      
      if (!type || !title || !description || !source) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: type, title, description, source'
        });
        return;
      }

      const issueId = this.alertingService.detectCriticalIssue(
        type,
        title,
        description,
        source,
        metadata || {},
        severity || 'critical'
      );

      res.status(201).json({
        success: true,
        data: {
          issueId,
          message: 'Critical issue created successfully'
        }
      });
    } catch (error) {
      logger.error('Error creating critical issue:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create critical issue'
      });
    }
  };

  // Get performance metrics
  public getPerformanceMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const metrics = this.alertingService.getPerformanceMetrics();
      
      res.json({
        success: true,
        data: {
          metrics,
          count: metrics.length,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      logger.error('Error fetching performance metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch performance metrics'
      });
    }
  };

  // Update performance metric
  public updatePerformanceMetric = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, value, threshold } = req.body;
      
      if (!name || value === undefined) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: name, value'
        });
        return;
      }

      this.alertingService.updatePerformanceMetric(name, value, threshold);

      res.json({
        success: true,
        message: 'Performance metric updated successfully'
      });
    } catch (error) {
      logger.error('Error updating performance metric:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update performance metric'
      });
    }
  };

  // Get alert thresholds
  public getAlertThresholds = async (req: Request, res: Response): Promise<void> => {
    try {
      const thresholds = this.alertingService.getAlertThresholds();
      
      res.json({
        success: true,
        data: {
          thresholds,
          count: thresholds.length
        }
      });
    } catch (error) {
      logger.error('Error fetching alert thresholds:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch alert thresholds'
      });
    }
  };

  // Update alert threshold
  public updateAlertThreshold = async (req: Request, res: Response): Promise<void> => {
    try {
      const { metric } = req.params;
      const updates = req.body;
      
      const updated = this.alertingService.updateAlertThreshold(metric, updates);
      
      if (!updated) {
        res.status(404).json({
          success: false,
          error: 'Alert threshold not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Alert threshold updated successfully'
      });
    } catch (error) {
      logger.error('Error updating alert threshold:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update alert threshold'
      });
    }
  };

  // Get alerting configuration
  public getAlertingConfiguration = async (req: Request, res: Response): Promise<void> => {
    try {
      const config = this.alertingService.getAlertingConfiguration();
      
      // Remove sensitive information
      const sanitizedConfig = {
        ...config,
        emailNotifications: {
          ...config.emailNotifications,
          smtpConfig: {
            ...config.emailNotifications.smtpConfig,
            auth: {
              user: config.emailNotifications.smtpConfig.auth.user,
              pass: '***REDACTED***'
            }
          }
        },
        slackNotifications: {
          ...config.slackNotifications,
          webhookUrl: config.slackNotifications.webhookUrl ? '***REDACTED***' : ''
        }
      };
      
      res.json({
        success: true,
        data: sanitizedConfig
      });
    } catch (error) {
      logger.error('Error fetching alerting configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch alerting configuration'
      });
    }
  };

  // Get alert statistics
  public getAlertStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const statistics = this.alertingService.getAlertStatistics();
      
      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      logger.error('Error fetching alert statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch alert statistics'
      });
    }
  };

  // Test alerting system
  public testAlertingSystem = async (req: Request, res: Response): Promise<void> => {
    try {
      const results = await this.alertingService.testAlertingSystem();
      
      res.json({
        success: true,
        data: {
          testResults: results,
          message: 'Alerting system test completed'
        }
      });
    } catch (error) {
      logger.error('Error testing alerting system:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test alerting system'
      });
    }
  };

  // Webhook endpoint for external alerts (e.g., from Grafana)
  public receiveWebhookAlert = async (req: Request, res: Response): Promise<void> => {
    try {
      const alertData = req.body;
      
      // Process Grafana-style alerts
      if (alertData.alerts && Array.isArray(alertData.alerts)) {
        for (const alert of alertData.alerts) {
          const severity = this.mapGrafanaSeverityToInternal(alert.labels?.severity || 'warning');
          const type = this.mapGrafanaTypeToInternal(alert.labels?.team || 'system');
          
          this.alertingService.detectCriticalIssue(
            type,
            alert.annotations?.summary || 'External Alert',
            alert.annotations?.description || 'Alert received from external system',
            'grafana_webhook',
            {
              grafanaAlert: alert,
              receivedAt: Date.now()
            },
            severity
          );
        }
      } else {
        // Generic webhook alert
        this.alertingService.detectCriticalIssue(
          'system_failure',
          alertData.title || 'External Alert',
          alertData.message || 'Alert received from external system',
          'external_webhook',
          {
            externalData: alertData,
            receivedAt: Date.now()
          },
          alertData.severity || 'warning'
        );
      }

      res.json({
        success: true,
        message: 'Webhook alert processed successfully'
      });
    } catch (error) {
      logger.error('Error processing webhook alert:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process webhook alert'
      });
    }
  };

  // Manual paper trading safety check
  public checkPaperTradingSafety = async (req: Request, res: Response): Promise<void> => {
    try {
      this.alertingService.checkPaperTradingSafety();
      
      res.json({
        success: true,
        message: 'Paper trading safety check completed'
      });
    } catch (error) {
      logger.error('Error performing paper trading safety check:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform paper trading safety check'
      });
    }
  };

  // Health check endpoint
  public healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      const statistics = this.alertingService.getAlertStatistics();
      const config = this.alertingService.getAlertingConfiguration();
      
      res.json({
        success: true,
        data: {
          status: 'healthy',
          alertingEnabled: config.enabled,
          activeIssues: statistics.activeIssues,
          totalIssues: statistics.totalIssues,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      logger.error('Error performing alerting health check:', error);
      res.status(500).json({
        success: false,
        error: 'Alerting system health check failed'
      });
    }
  };

  // Helper methods
  private mapGrafanaSeverityToInternal(grafanaSeverity: string): 'warning' | 'critical' | 'emergency' {
    switch (grafanaSeverity.toLowerCase()) {
      case 'critical':
      case 'high':
        return 'critical';
      case 'emergency':
      case 'page':
        return 'emergency';
      default:
        return 'warning';
    }
  }

  private mapGrafanaTypeToInternal(grafanaTeam: string): 'system_failure' | 'paper_trading_violation' | 'performance_degradation' | 'security_breach' {
    switch (grafanaTeam.toLowerCase()) {
      case 'trading':
      case 'paper-trading':
        return 'paper_trading_violation';
      case 'security':
        return 'security_breach';
      case 'performance':
        return 'performance_degradation';
      default:
        return 'system_failure';
    }
  }
}