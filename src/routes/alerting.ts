import { Router } from 'express';
import { AlertingController } from '../controllers/AlertingController';
import { authenticate as auth } from '../middleware/auth';
import { validate } from '../middleware/validation';
import Joi from 'joi';

const router = Router();
const alertingController = new AlertingController();

// Apply authentication to all routes except webhook
// TODO: Add rate limiting back when middleware is available
router.use((req, res, next) => {
  if (req.path.startsWith('/webhook')) {
    return next(); // Skip auth for webhook endpoints
  }
  return auth(req, res, next);
});

// Critical Issues Routes
router.get('/issues', alertingController.getCriticalIssues);
router.get('/issues/:issueId', alertingController.getCriticalIssue);
router.post('/issues', alertingController.createCriticalIssue);
router.patch('/issues/:issueId/resolve', alertingController.resolveCriticalIssue);

// Performance Metrics Routes
router.get('/metrics', alertingController.getPerformanceMetrics);
router.post('/metrics', alertingController.updatePerformanceMetric);

// Alert Thresholds Routes
router.get('/thresholds', alertingController.getAlertThresholds);
router.patch('/thresholds/:metric', alertingController.updateAlertThreshold);

// Configuration and Statistics Routes
router.get('/config', alertingController.getAlertingConfiguration);
router.get('/statistics', alertingController.getAlertStatistics);
router.get('/health', alertingController.healthCheck);

// Testing Routes
router.post('/test', alertingController.testAlertingSystem);

// Paper Trading Safety Routes
router.post('/safety-check', alertingController.checkPaperTradingSafety);

// Webhook Routes (no authentication required)
router.post('/webhook/alerts', alertingController.receiveWebhookAlert);

// Specific webhook endpoints for different alert sources
router.post('/webhook/grafana', alertingController.receiveWebhookAlert);
router.post('/webhook/prometheus', alertingController.receiveWebhookAlert);
router.post('/webhook/external', alertingController.receiveWebhookAlert);

export default router;