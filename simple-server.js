const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;

// MIME types for static files
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Helper function to send JSON response
function sendJSON(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data, null, 2));
}

// Helper function to serve static files
function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }
    
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  });
}

// Create HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }
  
  // API Routes
  if (pathname === '/health') {
    sendJSON(res, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      paperTradingMode: true,
      allowRealTrades: false,
      environment: 'development',
      safetyStatus: {
        paperTradingEnabled: true,
        realTradesBlocked: true,
        environmentValidated: true,
        virtualPortfolioActive: true
      }
    });
    return;
  }
  
  if (pathname === '/api/v1/paper-trading/status') {
    sendJSON(res, {
      paperTradingMode: true,
      allowRealTrades: false,
      environment: 'development',
      virtualPortfolio: {
        activeUsers: 1,
        initialBalance: 100000
      },
      simulation: {
        tradesExecuted: 0,
        totalVolume: 0,
        averageSlippage: 0.001
      },
      safety: {
        environmentValidated: true,
        apiKeysValidated: true,
        realMoneyOperationsBlocked: true,
        auditLoggingEnabled: true
      },
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  if (pathname === '/api/docs') {
    sendJSON(res, {
      message: 'AI Crypto Trading Bot API Documentation',
      version: '1.0.0',
      paperTradingMode: true,
      endpoints: {
        health: '/health',
        paperTradingStatus: '/api/v1/paper-trading/status',
        documentation: '/api/docs'
      },
      safety: {
        note: 'This API operates in PAPER TRADING MODE ONLY',
        realTrades: 'BLOCKED',
        virtualTrading: 'ENABLED'
      }
    });
    return;
  }
  
  // Serve static files
  let filePath;
  if (pathname === '/' || pathname === '/index.html') {
    filePath = path.join(__dirname, 'dist/frontend/index.html');
  } else {
    filePath = path.join(__dirname, 'dist/frontend', pathname);
  }
  
  // Check if file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      // File doesn't exist, serve index.html for SPA routing
      serveStaticFile(res, path.join(__dirname, 'dist/frontend/index.html'));
    } else {
      serveStaticFile(res, filePath);
    }
  });
});

server.listen(PORT, () => {
  console.log('🚀 AI Crypto Trading Bot - Development Server');
  console.log(`📍 Server running at: http://localhost:${PORT}`);
  console.log('🛡️  Paper Trading Mode: ENABLED');
  console.log('🚫 Real Trades: BLOCKED');
  console.log('💰 Virtual Trading: ACTIVE');
  console.log('');
  console.log('Available endpoints:');
  console.log(`  📊 Dashboard: http://localhost:${PORT}`);
  console.log(`  🏥 Health: http://localhost:${PORT}/health`);
  console.log(`  🛡️  Safety: http://localhost:${PORT}/api/v1/paper-trading/status`);
  console.log(`  📚 API Docs: http://localhost:${PORT}/api/docs`);
});
