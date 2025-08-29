#!/usr/bin/env node

/**
 * API Endpoint Validation Script
 * Validates that all required API endpoints are properly defined and accessible
 */

const fs = require('fs');
const path = require('path');

// Expected API endpoints based on the requirements
const expectedEndpoints = {
  // Authentication endpoints
  auth: [
    'POST /auth/register',
    'POST /auth/login', 
    'POST /auth/logout',
    'POST /auth/refresh',
    'GET /auth/profile',
    'POST /auth/change-password'
  ],
  
  // Trading endpoints
  trading: [
    'GET /trading/signals',
    'GET /trading/signals/:id',
    'POST /trading/signals/execute',
    'POST /trading/signals/:id/cancel',
    'GET /trading/executions',
    'POST /trading/orders',
    'POST /trading/orders/:orderId/cancel',
    'GET /trading/orders/:orderId/status',
    'GET /trading/portfolio',
    'GET /trading/portfolio/history',
    'GET /trading/portfolio/performance',
    'GET /trading/portfolio/positions'
  ],
  
  // Configuration endpoints
  config: [
    'GET /config',
    'GET /config/templates',
    'GET /config/:id',
    'POST /config',
    'PUT /config/:id',
    'DELETE /config/:id',
    'POST /config/validate',
    'POST /config/:id/control',
    'GET /config/:id/status',
    'POST /config/:id/backup',
    'POST /config/:id/restore'
  ],
  
  // Analytics endpoints
  analytics: [
    'GET /analytics/performance',
    'GET /analytics/patterns',
    'GET /analytics/elliott-wave',
    'GET /analytics/fibonacci',
    'GET /analytics/grid',
    'GET /analytics/portfolio',
    'GET /analytics/charts',
    'GET /analytics/trades',
    'GET /analytics/risk',
    'GET /analytics/comparison',
    'POST /analytics/reports'
  ],
  
  // Grid trading endpoints
  grids: [
    'GET /grids',
    'GET /grids/:id',
    'POST /grids',
    'PUT /grids/:id',
    'POST /grids/:id/close',
    'GET /grids/:id/performance',
    'GET /grids/stats'
  ],
  
  // User management endpoints
  users: [
    'GET /users/profile',
    'PUT /users/profile',
    'GET /users/settings',
    'PUT /users/settings/risk',
    'PUT /users/settings/api-keys',
    'GET /users',
    'PUT /users/:id/role',
    'POST /users/:id/deactivate',
    'GET /users/audit-logs'
  ],
  
  // Health and monitoring endpoints
  health: [
    'GET /health',
    'GET /health/detailed',
    'GET /health/ready',
    'GET /health/live',
    'GET /health/startup',
    'GET /health/deep',
    'GET /health/metrics',
    'GET /health/services',
    'GET /health/system',
    'GET /health/database',
    'GET /health/redis',
    'GET /health/exchanges',
    'GET /health/websocket',
    'GET /health/paper-trading-safety',
    'GET /health/all-services',
    'GET /health/infrastructure',
    'GET /health/external-services',
    'GET /health/application'
  ],
  
  // Monitoring endpoints
  monitoring: [
    'GET /monitoring/metrics',
    'GET /monitoring/health',
    'GET /monitoring/performance',
    'PUT /monitoring/performance/thresholds',
    'GET /monitoring/anomaly/thresholds',
    'PUT /monitoring/anomaly/thresholds',
    'POST /monitoring/logs/query',
    'POST /monitoring/logs/search',
    'POST /monitoring/logs/analyze',
    'GET /monitoring/logs/stats',
    'GET /monitoring/recovery/actions',
    'GET /monitoring/recovery/history',
    'POST /monitoring/recovery/trigger',
    'GET /monitoring/notifications/preferences/:userId',
    'PUT /monitoring/notifications/preferences/:userId',
    'GET /monitoring/notifications/history/:userId',
    'POST /monitoring/notifications/test',
    'GET /monitoring/dashboard'
  ],
  
  // Status endpoints
  status: [
    'GET /status',
    'GET /status/endpoints',
    'GET /status/services',
    'GET /status/paper-trading',
    'GET /status/health-summary',
    'GET /status/connectivity'
  ],
  
  // Logging endpoints
  logging: [
    'GET /logging/config',
    'PUT /logging/config',
    'GET /logging/health',
    'GET /logging/retention/policies',
    'POST /logging/retention/policies',
    'POST /logging/retention/cleanup',
    'GET /logging/retention/statistics',
    'GET /logging/config/export',
    'POST /logging/config/import'
  ]
};

// Results tracking
const results = {
  totalExpected: 0,
  found: 0,
  missing: [],
  routeFiles: [],
  errors: []
};

// Helper function to extract routes from a route file
function extractRoutesFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const routes = [];
    
    // Extract router.get, router.post, router.put, router.delete patterns
    const routePatterns = [
      /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g
    ];
    
    routePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const path = match[2];
        routes.push(`${method} ${path}`);
      }
    });
    
    return routes;
  } catch (error) {
    results.errors.push(`Error reading ${filePath}: ${error.message}`);
    return [];
  }
}

// Main validation function
function validateApiEndpoints() {
  console.log('🔍 API Endpoint Validation');
  console.log('=' .repeat(50));
  
  // Count total expected endpoints
  Object.values(expectedEndpoints).forEach(endpoints => {
    results.totalExpected += endpoints.length;
  });
  
  console.log(`📊 Total expected endpoints: ${results.totalExpected}`);
  console.log('');
  
  // Check if routes directory exists
  const routesDir = path.join(__dirname, 'src', 'routes');
  if (!fs.existsSync(routesDir)) {
    console.log('❌ Routes directory not found:', routesDir);
    return;
  }
  
  // Read all route files
  const routeFiles = fs.readdirSync(routesDir)
    .filter(file => file.endsWith('.ts') && file !== 'index.ts')
    .map(file => path.join(routesDir, file));
  
  console.log('📁 Found route files:');
  routeFiles.forEach(file => {
    const fileName = path.basename(file);
    console.log(`   • ${fileName}`);
    results.routeFiles.push(fileName);
  });
  console.log('');
  
  // Extract routes from each file
  const foundRoutes = new Set();
  const routesByFile = {};
  
  routeFiles.forEach(file => {
    const fileName = path.basename(file, '.ts');
    const routes = extractRoutesFromFile(file);
    routesByFile[fileName] = routes;
    
    routes.forEach(route => {
      foundRoutes.add(route);
    });
  });
  
  // Check each category of endpoints
  console.log('🔍 Checking endpoint categories:');
  console.log('-'.repeat(50));
  
  Object.entries(expectedEndpoints).forEach(([category, endpoints]) => {
    console.log(`\n📂 ${category.toUpperCase()} (${endpoints.length} endpoints):`);
    
    let categoryFound = 0;
    let categoryMissing = [];
    
    endpoints.forEach(endpoint => {
      if (foundRoutes.has(endpoint)) {
        categoryFound++;
        results.found++;
        console.log(`   ✅ ${endpoint}`);
      } else {
        categoryMissing.push(endpoint);
        results.missing.push(`${category}: ${endpoint}`);
        console.log(`   ❌ ${endpoint}`);
      }
    });
    
    const categoryPercent = Math.round((categoryFound / endpoints.length) * 100);
    console.log(`   📊 Coverage: ${categoryFound}/${endpoints.length} (${categoryPercent}%)`);
  });
  
  // Show routes found in files but not in expected list
  console.log('\n🔍 Additional routes found:');
  console.log('-'.repeat(30));
  
  const additionalRoutes = [];
  foundRoutes.forEach(route => {
    let found = false;
    Object.values(expectedEndpoints).forEach(endpoints => {
      if (endpoints.includes(route)) {
        found = true;
      }
    });
    if (!found) {
      additionalRoutes.push(route);
    }
  });
  
  if (additionalRoutes.length > 0) {
    additionalRoutes.forEach(route => {
      console.log(`   • ${route}`);
    });
  } else {
    console.log('   (none)');
  }
  
  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 VALIDATION SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total Expected: ${results.totalExpected}`);
  console.log(`Found: ${results.found}`);
  console.log(`Missing: ${results.missing.length}`);
  console.log(`Additional: ${additionalRoutes.length}`);
  console.log(`Coverage: ${Math.round((results.found / results.totalExpected) * 100)}%`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    results.errors.forEach(error => {
      console.log(`   • ${error}`);
    });
  }
  
  if (results.missing.length > 0) {
    console.log('\n❌ MISSING ENDPOINTS:');
    results.missing.forEach(missing => {
      console.log(`   • ${missing}`);
    });
  }
  
  // Determine result
  const coveragePercent = (results.found / results.totalExpected) * 100;
  
  if (coveragePercent >= 90) {
    console.log('\n🎉 RESULT: API endpoints are well-defined (90%+ coverage)');
    return 0;
  } else if (coveragePercent >= 70) {
    console.log('\n⚠️  RESULT: API endpoints are mostly defined (70%+ coverage)');
    return 0;
  } else if (coveragePercent >= 50) {
    console.log('\n⚠️  RESULT: API endpoints have significant gaps (50%+ coverage)');
    return 1;
  } else {
    console.log('\n❌ RESULT: API endpoints are poorly defined (<50% coverage)');
    return 1;
  }
}

// Run validation
const exitCode = validateApiEndpoints();
process.exit(exitCode);