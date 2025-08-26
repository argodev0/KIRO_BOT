import { Router } from 'express';
import authRoutes from './auth';
import tradingRoutes from './trading';
import gridRoutes from './grids';
import analyticsRoutes from './analytics';
import userRoutes from './users';
import configRoutes from './config';
import healthRoutes from './health';
import monitoringRoutes from './monitoring';
import { apiRateLimit } from '@/middleware/rateLimiter';

const router = Router();

// Apply general API rate limiting
router.use(apiRateLimit);

// Health check endpoint (no rate limiting)
router.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API status endpoint
router.get('/status', (_req, res) => {
  res.json({
    message: 'AI Crypto Trading Bot API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/v1/auth',
      trading: '/api/v1/trading',
      grids: '/api/v1/grids',
      analytics: '/api/v1/analytics',
      users: '/api/v1/users',
      config: '/api/v1/config',
      health: '/api/v1/health',
      monitoring: '/api/v1/monitoring'
    }
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/trading', tradingRoutes);
router.use('/grids', gridRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/users', userRoutes);
router.use('/config', configRoutes);
router.use('/health', healthRoutes);
router.use('/monitoring', monitoringRoutes);

// 404 handler for API routes
router.use('*', (req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'API endpoint not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

export default router;