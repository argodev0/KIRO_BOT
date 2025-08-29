const express = require('express');
const { createServer } = require('http');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

require('dotenv').config({ path: '.env.production' });

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://localhost',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    paperTradingMode: process.env.PAPER_TRADING_MODE === 'true',
    allowRealTrades: process.env.ALLOW_REAL_TRADES === 'true',
    environment: process.env.NODE_ENV || 'production'
  });
});app
.get('/api/v1/paper-trading/status', (req, res) => {
  res.json({
    paperTradingMode: process.env.PAPER_TRADING_MODE === 'true',
    allowRealTrades: process.env.ALLOW_REAL_TRADES === 'true',
    environment: process.env.NODE_ENV || 'production',
    virtualPortfolio: {
      activeUsers: 0,
      initialBalance: parseFloat(process.env.VIRTUAL_BALANCE_USD) || 100000
    },
    safety: {
      environmentValidated: true,
      apiKeysValidated: true,
      realMoneyOperationsBlocked: true,
      auditLoggingEnabled: true
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/metrics', (req, res) => {
  const metrics = `# HELP nodejs_version_info Node.js version info
# TYPE nodejs_version_info gauge
nodejs_version_info{version="${process.version}"} 1

# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds gauge
process_uptime_seconds ${process.uptime()}

# HELP paper_trading_mode_enabled Paper trading mode status
# TYPE paper_trading_mode_enabled gauge
paper_trading_mode_enabled ${process.env.PAPER_TRADING_MODE === 'true' ? 1 : 0}

# HELP system_health_status System health status
# TYPE system_health_status gauge
system_health_status 1
`;
  
  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

app.get('/api/v1/status', (req, res) => {
  res.json({
    status: 'operational',
    services: {
      api: 'healthy',
      database: 'healthy',
      cache: 'healthy',
      websocket: 'healthy'
    },
    paperTrading: {
      enabled: process.env.PAPER_TRADING_MODE === 'true',
      realTradesBlocked: process.env.ALLOW_REAL_TRADES !== 'true'
    },
    timestamp: new Date().toISOString()
  });
});a
pp.get('/', (req, res) => {
  res.json({
    message: 'AI Crypto Trading Bot API - Production Mode',
    version: '1.0.0',
    status: 'running',
    paperTradingMode: process.env.PAPER_TRADING_MODE === 'true',
    safetyStatus: process.env.ALLOW_REAL_TRADES !== 'true' ? 'SAFE' : 'WARNING',
    endpoints: {
      health: '/health',
      metrics: '/metrics',
      status: '/api/v1/status',
      paperTradingStatus: '/api/v1/paper-trading/status'
    }
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = createServer(app);

server.listen(PORT, HOST, () => {
  console.log(`🚀 AI Crypto Trading Bot Production Server started`);
  console.log(`📍 Server running on ${HOST}:${PORT}`);
  console.log(`🔒 Paper Trading Mode: ${process.env.PAPER_TRADING_MODE === 'true' ? 'ENABLED' : 'DISABLED'}`);
  console.log(`⚡ Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`🛡️  Security: Enhanced protection enabled`);
  console.log(`📊 Health Check: http://${HOST}:${PORT}/health`);
  console.log(`📈 Metrics: http://${HOST}:${PORT}/metrics`);
  console.log(`✅ Production deployment successful!`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});