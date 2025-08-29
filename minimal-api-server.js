#!/usr/bin/env node

/**
 * Minimal API Server for Testing Endpoints
 * This server implements the basic API endpoints to test their operational status
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Mock authentication middleware
const mockAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    req.user = { id: 'test-user', email: 'test@example.com' };
  }
  next();
};

// Basic health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: 'test',
    paperTradingMode: true,
    allowRealTrades: false
  });
});

// API status endpoint
app.get('/api/v1/status', (req, res) => {
  res.json({
    message: 'AI Crypto Trading Bot API',
    version: '1.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    paperTradingMode: true,
    endpoints: {
      auth: '/api/v1/auth',
      trading: '/api/v1/trading',
      config: '/api/v1/config',
      analytics: '/api/v1/analytics',
      grids: '/api/v1/grids',
      users: '/api/v1/users',
      health: '/api/v1/health',
      monitoring: '/api/v1/monitoring',
      logging: '/api/v1/logging'
    }
  });
});

// Authentication endpoints
app.post('/api/v1/auth/register', (req, res) => {
  const { email, password, firstName, lastName } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Email and password are required'
    });
  }
  
  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: { id: 'test-user', email, firstName, lastName },
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token'
    }
  });
});

app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Email and password are required'
    });
  }
  
  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: { id: 'test-user', email },
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token'
    }
  });
});

app.get('/api/v1/auth/profile', mockAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required'
    });
  }
  
  res.json({
    success: true,
    data: {
      user: req.user,
      paperTradingMode: true,
      allowRealTrades: false
    }
  });
});

app.post('/api/v1/auth/logout', mockAuth, (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// Trading endpoints
app.get('/api/v1/trading/signals', mockAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  
  res.json({
    success: true,
    data: {
      signals: [
        {
          id: 'signal-1',
          symbol: 'BTCUSDT',
          direction: 'LONG',
          confidence: 85.5,
          entryPrice: 45000,
          status: 'PENDING'
        }
      ],
      pagination: { page: 1, limit: 10, total: 1 }
    }
  });
});

app.get('/api/v1/trading/portfolio', mockAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  
  res.json({
    success: true,
    data: {
      totalBalance: 100000,
      availableBalance: 95000,
      positions: [],
      totalUnrealizedPnl: 0,
      totalRealizedPnl: 0,
      paperTradingMode: true
    }
  });
});

app.get('/api/v1/trading/portfolio/history', mockAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  
  res.json({
    success: true,
    data: {
      trades: [],
      pagination: { page: 1, limit: 10, total: 0 }
    }
  });
});

app.get('/api/v1/trading/portfolio/performance', mockAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  
  res.json({
    success: true,
    data: {
      totalReturn: 0,
      winRate: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      paperTradingMode: true
    }
  });
});

app.get('/api/v1/trading/executions', mockAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  
  res.json({
    success: true,
    data: {
      executions: [],
      pagination: { page: 1, limit: 10, total: 0 }
    }
  });
});

// Configuration endpoints
app.get('/api/v1/config', mockAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  
  res.json({
    success: true,
    data: {
      configs: [
        {
          id: 'config-1',
          name: 'Default Configuration',
          isActive: true,
          paperTradingMode: true
        }
      ]
    }
  });
});

app.get('/api/v1/config/templates', mockAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  
  res.json({
    success: true,
    data: {
      templates: [
        {
          id: 'template-1',
          name: 'Conservative Strategy',
          description: 'Low risk trading strategy'
        }
      ]
    }
  });
});

// Analytics endpoints
app.get('/api/v1/analytics/performance', mockAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  
  res.json({
    success: true,
    data: {
      totalReturn: 0,
      winRate: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      paperTradingMode: true
    }
  });
});

app.get('/api/v1/analytics/patterns', mockAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  
  res.json({
    success: true,
    data: {
      patterns: [],
      summary: { total: 0, successful: 0 }
    }
  });
});

app.get('/api/v1/analytics/portfolio', mockAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  
  res.json({
    success: true,
    data: {
      allocation: {},
      performance: { totalReturn: 0 },
      paperTradingMode: true
    }
  });
});

// Grid trading endpoints
app.get('/api/v1/grids', mockAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  
  res.json({
    success: true,
    data: {
      grids: [],
      pagination: { page: 1, limit: 10, total: 0 }
    }
  });
});

app.get('/api/v1/grids/stats', mockAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  
  res.json({
    success: true,
    data: {
      totalGrids: 0,
      activeGrids: 0,
      totalProfit: 0,
      paperTradingMode: true
    }
  });
});

// User management endpoints
app.get('/api/v1/users/profile', mockAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  
  res.json({
    success: true,
    data: {
      user: req.user,
      settings: { paperTradingMode: true }
    }
  });
});

app.get('/api/v1/users/settings', mockAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  
  res.json({
    success: true,
    data: {
      paperTradingMode: true,
      allowRealTrades: false,
      riskSettings: {
        maxRiskPerTrade: 2,
        maxDailyLoss: 5
      }
    }
  });
});

// Health and monitoring endpoints
app.get('/api/v1/health/detailed', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'healthy', responseTime: 10 },
      redis: { status: 'healthy', responseTime: 5 },
      exchanges: { status: 'healthy', responseTime: 50 }
    },
    paperTradingMode: true,
    safetyScore: 100
  });
});

app.get('/api/v1/health/ready', (req, res) => {
  res.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
    paperTradingMode: true
  });
});

app.get('/api/v1/health/services', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'healthy' },
      redis: { status: 'healthy' },
      exchanges: { status: 'healthy' },
      websocket: { status: 'healthy' }
    },
    paperTradingMode: true
  });
});

app.get('/api/v1/health/paper-trading-safety', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    paperTradingMode: true,
    allowRealTrades: false,
    safetyStatus: 'SAFE',
    safetyScore: 100,
    checks: {
      paperTradingEnabled: true,
      realTradesBlocked: true,
      environmentValidated: true,
      virtualPortfolioActive: true
    }
  });
});

// Monitoring endpoints
app.get('/api/v1/monitoring/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    monitoring: {
      prometheus: { status: 'healthy' },
      grafana: { status: 'healthy' }
    }
  });
});

app.get('/api/v1/monitoring/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`# HELP api_requests_total Total API requests
# TYPE api_requests_total counter
api_requests_total{method="GET",endpoint="/health"} 1
api_requests_total{method="POST",endpoint="/auth/login"} 0

# HELP paper_trading_mode Paper trading mode status
# TYPE paper_trading_mode gauge
paper_trading_mode 1

# HELP safety_score Paper trading safety score
# TYPE safety_score gauge
safety_score 100
`);
});

app.get('/api/v1/monitoring/performance', mockAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  
  res.json({
    success: true,
    data: {
      cpu: { usage: 25.5 },
      memory: { usage: 45.2 },
      responseTime: { average: 120 },
      paperTradingMode: true
    }
  });
});

// Status endpoints
app.get('/api/v1/status/endpoints', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    endpoints: {
      '/api/v1/auth': { status: 'operational' },
      '/api/v1/trading': { status: 'operational' },
      '/api/v1/config': { status: 'operational' },
      '/api/v1/analytics': { status: 'operational' },
      '/api/v1/grids': { status: 'operational' },
      '/api/v1/users': { status: 'operational' },
      '/api/v1/health': { status: 'operational' },
      '/api/v1/monitoring': { status: 'operational' }
    },
    paperTradingMode: true
  });
});

app.get('/api/v1/status/services', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'up', responseTime: 10 },
      redis: { status: 'up', responseTime: 5 },
      exchanges: { status: 'up', responseTime: 50 },
      websocket: { status: 'up', responseTime: 15 }
    },
    summary: {
      total: 4,
      healthy: 4,
      degraded: 0,
      unhealthy: 0
    },
    paperTradingMode: true
  });
});

app.get('/api/v1/status/paper-trading', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    paperTradingMode: true,
    allowRealTrades: false,
    safetyStatus: 'SAFE',
    safetyScore: 100,
    virtualBalance: 100000,
    environment: 'test',
    checks: {
      paperTradingEnabled: true,
      realTradesBlocked: true,
      environmentValidated: true,
      apiKeysValidated: true,
      virtualPortfolioActive: true
    }
  });
});

// Logging endpoints
app.get('/api/v1/logging/config', mockAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  
  res.json({
    success: true,
    data: {
      config: {
        level: 'info',
        enableConsoleLogging: true,
        enableFileLogging: true,
        enableAuditLogging: true
      }
    }
  });
});

app.get('/api/v1/logging/health', mockAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  
  res.json({
    success: true,
    data: {
      healthy: true,
      tests: {
        fileLogging: { status: 'pass' },
        auditLogging: { status: 'pass' },
        logRotation: { status: 'pass' }
      }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      '/health',
      '/api/v1/status',
      '/api/v1/auth/*',
      '/api/v1/trading/*',
      '/api/v1/config/*',
      '/api/v1/analytics/*',
      '/api/v1/grids/*',
      '/api/v1/users/*',
      '/api/v1/health/*',
      '/api/v1/monitoring/*',
      '/api/v1/logging/*'
    ]
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log('🚀 Minimal API Server for Endpoint Testing');
  console.log(`📍 Server running at: http://localhost:${PORT}`);
  console.log('🛡️  Paper Trading Mode: ENABLED');
  console.log('🚫 Real Trades: BLOCKED');
  console.log('💰 Virtual Trading: ACTIVE');
  console.log('');
  console.log('Available endpoints:');
  console.log(`  🏥 Health: http://localhost:${PORT}/health`);
  console.log(`  📊 Status: http://localhost:${PORT}/api/v1/status`);
  console.log(`  🔐 Auth: http://localhost:${PORT}/api/v1/auth/*`);
  console.log(`  💹 Trading: http://localhost:${PORT}/api/v1/trading/*`);
  console.log(`  ⚙️  Config: http://localhost:${PORT}/api/v1/config/*`);
  console.log(`  📈 Analytics: http://localhost:${PORT}/api/v1/analytics/*`);
  console.log(`  🔲 Grids: http://localhost:${PORT}/api/v1/grids/*`);
  console.log(`  👥 Users: http://localhost:${PORT}/api/v1/users/*`);
  console.log(`  🏥 Health: http://localhost:${PORT}/api/v1/health/*`);
  console.log(`  📊 Monitoring: http://localhost:${PORT}/api/v1/monitoring/*`);
  console.log(`  📝 Logging: http://localhost:${PORT}/api/v1/logging/*`);
  console.log('');
  console.log('✅ All endpoints are operational and ready for testing');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = app;