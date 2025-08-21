import express from 'express';
import { createServer } from 'http';
import { config } from '@/config/config';
import { logger } from '@/utils/logger';
import { errorHandler } from '@/middleware/errorHandler';
import { requestLogger } from '@/middleware/requestLogger';
import { corsOptions } from '@/middleware/security';

const app = express();

// Basic middleware
app.use(corsOptions);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'AI Crypto Trading Bot API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health'
    }
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

const server = createServer(app);
const PORT = config.server.port;

server.listen(PORT, () => {
  logger.info(`🚀 AI Crypto Trading Bot server started on http://localhost:${PORT}`);
  logger.info(`📊 Environment: ${config.env}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
});

export default app;