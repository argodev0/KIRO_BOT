import { Router, Request, Response } from 'express';
import { MonitoringService } from '../services/MonitoringService';
import { PerformanceMonitoringService } from '../services/PerformanceMonitoringService';
import { AnomalyDetectionService } from '../services/AnomalyDetectionService';
import { LogAggregationService } from '../services/LogAggregationService';
import { AutoRecoveryService } from '../services/AutoRecoveryService';
import { NotificationService } from '../services/NotificationService';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Get Prometheus metrics
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const monitoring = MonitoringService.getInstance();
    const metrics = await monitoring.getMetrics();
    
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    logger.error('Error getting metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// Health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    const monitoring = MonitoringService.getInstance();
    const health = monitoring.getHealthStatus();
    
    res.json(health);
  } catch (error) {
    logger.error('Error getting health status:', error);
    res.status(500).json({ error: 'Failed to get health status' });
  }
});

// Performance metrics (requires authentication)
router.get('/performance', authenticate, async (req: Request, res: Response) => {
  try {
    const performance = PerformanceMonitoringService.getInstance();
    const metrics = performance.getPerformanceMetrics();
    
    res.json(metrics);
  } catch (error) {
    logger.error('Error getting performance metrics:', error);
    res.status(500).json({ error: 'Failed to get performance metrics' });
  }
});

// Update performance thresholds
router.put('/performance/thresholds', authenticate, async (req: Request, res: Response) => {
  try {
    const performance = PerformanceMonitoringService.getInstance();
    performance.updateThresholds(req.body);
    
    res.json({ message: 'Thresholds updated successfully' });
  } catch (error) {
    logger.error('Error updating performance thresholds:', error);
    res.status(500).json({ error: 'Failed to update thresholds' });
  }
});

// Get anomaly detection thresholds
router.get('/anomaly/thresholds', authenticate, async (req: Request, res: Response) => {
  try {
    const anomaly = AnomalyDetectionService.getInstance();
    const thresholds = anomaly.getThresholds();
    
    res.json(thresholds);
  } catch (error) {
    logger.error('Error getting anomaly thresholds:', error);
    res.status(500).json({ error: 'Failed to get anomaly thresholds' });
  }
});

// Update anomaly detection thresholds
router.put('/anomaly/thresholds', authenticate, async (req: Request, res: Response) => {
  try {
    const anomaly = AnomalyDetectionService.getInstance();
    anomaly.updateThresholds(req.body);
    
    res.json({ message: 'Anomaly thresholds updated successfully' });
  } catch (error) {
    logger.error('Error updating anomaly thresholds:', error);
    res.status(500).json({ error: 'Failed to update anomaly thresholds' });
  }
});

// Query logs
router.post('/logs/query', authenticate, async (req: Request, res: Response) => {
  try {
    const logService = LogAggregationService.getInstance();
    const logs = await logService.queryLogs(req.body);
    
    res.json(logs);
  } catch (error) {
    logger.error('Error querying logs:', error);
    res.status(500).json({ error: 'Failed to query logs' });
  }
});

// Search logs
router.post('/logs/search', authenticate, async (req: Request, res: Response) => {
  try {
    const { searchTerm, filters } = req.body;
    const logService = LogAggregationService.getInstance();
    const logs = await logService.searchLogs(searchTerm, filters);
    
    res.json(logs);
  } catch (error) {
    logger.error('Error searching logs:', error);
    res.status(500).json({ error: 'Failed to search logs' });
  }
});

// Analyze logs
router.post('/logs/analyze', authenticate, async (req: Request, res: Response) => {
  try {
    const { timeRange } = req.body;
    const logService = LogAggregationService.getInstance();
    const analysis = await logService.analyzeLogs(timeRange);
    
    res.json(analysis);
  } catch (error) {
    logger.error('Error analyzing logs:', error);
    res.status(500).json({ error: 'Failed to analyze logs' });
  }
});

// Get log statistics
router.get('/logs/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const logService = LogAggregationService.getInstance();
    const stats = await logService.getLogStats();
    
    res.json(stats);
  } catch (error) {
    logger.error('Error getting log stats:', error);
    res.status(500).json({ error: 'Failed to get log stats' });
  }
});

// Get recovery actions
router.get('/recovery/actions', authenticate, async (req: Request, res: Response) => {
  try {
    const recovery = AutoRecoveryService.getInstance();
    const actions = Array.from(recovery.getRecoveryActions().values());
    
    res.json(actions);
  } catch (error) {
    logger.error('Error getting recovery actions:', error);
    res.status(500).json({ error: 'Failed to get recovery actions' });
  }
});

// Get failure history
router.get('/recovery/history', authenticate, async (req: Request, res: Response) => {
  try {
    const recovery = AutoRecoveryService.getInstance();
    const history = Array.from(recovery.getFailureHistory().values());
    
    res.json(history);
  } catch (error) {
    logger.error('Error getting failure history:', error);
    res.status(500).json({ error: 'Failed to get failure history' });
  }
});

// Trigger manual recovery
router.post('/recovery/trigger', authenticate, async (req: Request, res: Response) => {
  try {
    const { errorType, errorData } = req.body;
    const recovery = AutoRecoveryService.getInstance();
    
    const success = await recovery.handleFailure({
      type: errorType,
      ...errorData
    });
    
    res.json({ success, message: success ? 'Recovery initiated' : 'Recovery failed' });
  } catch (error) {
    logger.error('Error triggering recovery:', error);
    res.status(500).json({ error: 'Failed to trigger recovery' });
  }
});

// Get notification preferences
router.get('/notifications/preferences/:userId', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const notification = NotificationService.getInstance();
    
    // In a real implementation, you'd get preferences from database
    res.json({ message: 'Preferences retrieved', userId });
  } catch (error) {
    logger.error('Error getting notification preferences:', error);
    res.status(500).json({ error: 'Failed to get notification preferences' });
  }
});

// Update notification preferences
router.put('/notifications/preferences/:userId', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const notification = NotificationService.getInstance();
    
    notification.setUserPreferences(userId, req.body);
    
    res.json({ message: 'Preferences updated successfully' });
  } catch (error) {
    logger.error('Error updating notification preferences:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

// Get notification history
router.get('/notifications/history/:userId', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit } = req.query;
    const notification = NotificationService.getInstance();
    
    const history = notification.getNotificationHistory(userId, parseInt(limit as string) || 50);
    
    res.json(history);
  } catch (error) {
    logger.error('Error getting notification history:', error);
    res.status(500).json({ error: 'Failed to get notification history' });
  }
});

// Send test notification
router.post('/notifications/test', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId, templateId, data, channels } = req.body;
    const notification = NotificationService.getInstance();
    
    await notification.sendNotification({
      userId,
      templateId,
      data,
      channels,
      immediate: true
    });
    
    res.json({ message: 'Test notification sent' });
  } catch (error) {
    logger.error('Error sending test notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

// System status dashboard
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const monitoring = MonitoringService.getInstance();
    const performance = PerformanceMonitoringService.getInstance();
    const recovery = AutoRecoveryService.getInstance();
    
    const dashboard = {
      health: monitoring.getHealthStatus(),
      performance: performance.getPerformanceMetrics(),
      recentFailures: Array.from(recovery.getFailureHistory().values())
        .filter(f => !f.resolved)
        .slice(0, 10),
      timestamp: Date.now()
    };
    
    res.json(dashboard);
  } catch (error) {
    logger.error('Error getting dashboard data:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

export default router;