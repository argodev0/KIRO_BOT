#!/usr/bin/env node

/**
 * SystemHealthService Unit Test
 * Tests the SystemHealthService directly without requiring a running server
 */

// Mock the config and logger to avoid dependencies
const mockConfig = {
  env: 'test',
  paperTrading: {
    enabled: true,
    allowRealTrades: false
  },
  redis: {
    enabled: false,
    host: 'localhost',
    port: 6379,
    password: '',
    db: 0
  }
};

const mockLogger = {
  info: (msg, ...args) => console.log(`INFO: ${msg}`, ...args),
  error: (msg, ...args) => console.error(`ERROR: ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`WARN: ${msg}`, ...args),
  debug: (msg, ...args) => console.log(`DEBUG: ${msg}`, ...args)
};

// Mock the database
const mockDb = {
  $queryRaw: async (query) => {
    if (query.strings && query.strings[0].includes('SELECT 1')) {
      return [{ health_check: 1 }];
    }
    return [{ db_time: new Date() }];
  }
};

// Set up module mocking
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  switch (id) {
    case '../config/config':
      return { config: mockConfig };
    case '../utils/logger':
      return { logger: mockLogger };
    case '../models/database':
      return { db: mockDb };
    case 'ioredis':
      throw new Error('Redis not available in test');
    default:
      return originalRequire.apply(this, arguments);
  }
};

// Now require the SystemHealthService
const { SystemHealthService } = require('./src/services/SystemHealthService.ts');

// Color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function formatResult(result) {
  const statusColor = result.status === 'healthy' ? colors.green : 
                     result.status === 'degraded' ? colors.yellow : colors.red;
  return `${statusColor}${result.status}${colors.reset} (${result.responseTime}ms)`;
}

async function testHealthService() {
  console.log(`${colors.bold}${colors.blue}SystemHealthService Unit Test${colors.reset}\n`);
  
  try {
    const healthService = SystemHealthService.getInstance();
    
    console.log(`${colors.bold}Testing individual health checks:${colors.reset}`);
    
    // Test database health check
    console.log(`${colors.blue}Database Health Check:${colors.reset}`);
    try {
      const dbResult = await healthService.checkDatabaseHealth();
      console.log(`  Result: ${formatResult(dbResult)}`);
      console.log(`  Message: ${dbResult.message}`);
    } catch (error) {
      console.log(`  ${colors.red}ERROR: ${error.message}${colors.reset}`);
    }
    
    // Test Redis health check
    console.log(`\n${colors.blue}Redis Health Check:${colors.reset}`);
    try {
      const redisResult = await healthService.checkRedisHealth();
      console.log(`  Result: ${formatResult(redisResult)}`);
      console.log(`  Message: ${redisResult.message}`);
    } catch (error) {
      console.log(`  ${colors.red}ERROR: ${error.message}${colors.reset}`);
    }
    
    // Test filesystem health check
    console.log(`\n${colors.blue}Filesystem Health Check:${colors.reset}`);
    try {
      const fsResult = await healthService.checkFilesystemHealth();
      console.log(`  Result: ${formatResult(fsResult)}`);
      console.log(`  Message: ${fsResult.message}`);
    } catch (error) {
      console.log(`  ${colors.red}ERROR: ${error.message}${colors.reset}`);
    }
    
    // Test memory health check
    console.log(`\n${colors.blue}Memory Health Check:${colors.reset}`);
    try {
      const memResult = await healthService.checkMemoryHealth();
      console.log(`  Result: ${formatResult(memResult)}`);
      console.log(`  Message: ${memResult.message}`);
      if (memResult.details) {
        console.log(`  Heap Usage: ${memResult.details.heap.usagePercent}%`);
        console.log(`  System Usage: ${memResult.details.system.usagePercent}%`);
      }
    } catch (error) {
      console.log(`  ${colors.red}ERROR: ${error.message}${colors.reset}`);
    }
    
    // Test CPU health check
    console.log(`\n${colors.blue}CPU Health Check:${colors.reset}`);
    try {
      const cpuResult = await healthService.checkCpuHealth();
      console.log(`  Result: ${formatResult(cpuResult)}`);
      console.log(`  Message: ${cpuResult.message}`);
      if (cpuResult.details) {
        console.log(`  Load Average (1min): ${cpuResult.details.loadPercentage['1min']}%`);
        console.log(`  CPU Cores: ${cpuResult.details.cores}`);
      }
    } catch (error) {
      console.log(`  ${colors.red}ERROR: ${error.message}${colors.reset}`);
    }
    
    // Test paper trading safety check
    console.log(`\n${colors.blue}Paper Trading Safety Check:${colors.reset}`);
    try {
      const safetyResult = await healthService.checkPaperTradingSafety();
      console.log(`  Result: ${formatResult(safetyResult)}`);
      console.log(`  Message: ${safetyResult.message}`);
      if (safetyResult.details) {
        console.log(`  Safety Score: ${safetyResult.details.safetyScore}%`);
        console.log(`  Paper Trading Enabled: ${safetyResult.details.checks.paperTradingEnabled}`);
        console.log(`  Real Trades Disabled: ${safetyResult.details.checks.realTradesDisabled}`);
      }
    } catch (error) {
      console.log(`  ${colors.red}ERROR: ${error.message}${colors.reset}`);
    }
    
    // Test comprehensive system health
    console.log(`\n${colors.bold}Comprehensive System Health Check:${colors.reset}`);
    try {
      const systemHealth = await healthService.getSystemHealth();
      console.log(`  Overall Status: ${colors.bold}${systemHealth.overall}${colors.reset}`);
      console.log(`  Uptime: ${Math.round(systemHealth.uptime)}s`);
      console.log(`  Environment: ${systemHealth.environment}`);
      
      console.log(`\n  ${colors.bold}Service Status Summary:${colors.reset}`);
      Object.entries(systemHealth.services).forEach(([serviceName, service]) => {
        const statusColor = service.status === 'healthy' ? colors.green : 
                           service.status === 'degraded' ? colors.yellow : colors.red;
        console.log(`    ${serviceName}: ${statusColor}${service.status}${colors.reset} (${service.responseTime}ms)`);
      });
      
      console.log(`\n  ${colors.bold}System Metrics:${colors.reset}`);
      console.log(`    Memory Usage: ${systemHealth.metrics.memory.usage}`);
      console.log(`    CPU Cores: ${systemHealth.metrics.cpu.cores}`);
      console.log(`    Platform: ${systemHealth.metrics.platform.platform} ${systemHealth.metrics.platform.arch}`);
      
    } catch (error) {
      console.log(`  ${colors.red}ERROR: ${error.message}${colors.reset}`);
    }
    
    console.log(`\n${colors.green}✓ SystemHealthService unit tests completed${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}✗ SystemHealthService test failed:${colors.reset}`, error);
    process.exit(1);
  }
}

// Run the test
testHealthService().catch(error => {
  console.error(`${colors.red}Test suite failed:${colors.reset}`, error);
  process.exit(1);
});