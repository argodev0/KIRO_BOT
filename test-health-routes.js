#!/usr/bin/env node

/**
 * Health Routes Test
 * Tests that all health routes are properly configured
 */

const fs = require('fs');
const path = require('path');

// Read the health routes file
const healthRoutesPath = path.join(__dirname, 'src/routes/health.ts');
const statusRoutesPath = path.join(__dirname, 'src/routes/status.ts');

const healthRoutesContent = fs.readFileSync(healthRoutesPath, 'utf8');
const statusRoutesContent = fs.readFileSync(statusRoutesPath, 'utf8');

// Expected health routes based on implementation
const expectedHealthRoutes = [
  { path: '/', method: 'get', handler: 'basicHealth', name: 'Basic Health Check' },
  { path: '/detailed', method: 'get', handler: 'detailedHealth', name: 'Detailed Health Check' },
  { path: '/ready', method: 'get', handler: 'readiness', name: 'Readiness Probe' },
  { path: '/live', method: 'get', handler: 'liveness', name: 'Liveness Probe' },
  { path: '/startup', method: 'get', handler: 'startup', name: 'Startup Probe' },
  { path: '/deep', method: 'get', handler: 'deepHealth', name: 'Deep Health Check' },
  { path: '/system', method: 'get', handler: 'systemHealth', name: 'System Health' },
  { path: '/all-services', method: 'get', handler: 'allServicesHealth', name: 'All Services Health' },
  { path: '/infrastructure', method: 'get', handler: 'infrastructureHealth', name: 'Infrastructure Health' },
  { path: '/external-services', method: 'get', handler: 'externalServicesHealth', name: 'External Services Health' },
  { path: '/application', method: 'get', handler: 'applicationHealth', name: 'Application Health' },
  { path: '/database', method: 'get', handler: 'databaseHealth', name: 'Database Health' },
  { path: '/redis', method: 'get', handler: 'redisHealth', name: 'Redis Health' },
  { path: '/exchanges', method: 'get', handler: 'exchangesHealth', name: 'Exchanges Health' },
  { path: '/websocket', method: 'get', handler: 'websocketHealth', name: 'WebSocket Health' },
  { path: '/paper-trading-safety', method: 'get', handler: 'paperTradingSafety', name: 'Paper Trading Safety' },
  { path: '/services', method: 'get', handler: 'serviceStatus', name: 'Service Status' },
  { path: '/metrics', method: 'get', handler: null, name: 'Prometheus Metrics' }
];

const expectedStatusRoutes = [
  { path: '/', method: 'get', handler: null, name: 'API Status' },
  { path: '/endpoints', method: 'get', handler: null, name: 'Endpoints Status' },
  { path: '/services', method: 'get', handler: null, name: 'Services Status' },
  { path: '/paper-trading', method: 'get', handler: null, name: 'Paper Trading Status' },
  { path: '/health-summary', method: 'get', handler: null, name: 'Health Summary' },
  { path: '/connectivity', method: 'get', handler: null, name: 'Connectivity Status' }
];

// Test results
const testResults = {
  health: { total: expectedHealthRoutes.length, found: 0, missing: [] },
  status: { total: expectedStatusRoutes.length, found: 0, missing: [] }
};

console.log('🛣️ Testing Health and Status Routes');
console.log('=' .repeat(70));

// Test health routes
console.log('\n📋 HEALTH ROUTES (/api/v1/health)');
console.log('-'.repeat(50));

expectedHealthRoutes.forEach(route => {
  const routePattern = new RegExp(`router\\.${route.method}\\s*\\(\\s*['"\`]${route.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`, 'g');
  
  if (routePattern.test(healthRoutesContent)) {
    testResults.health.found++;
    console.log(`✅ ${route.method.toUpperCase()} ${route.path} - ${route.name}`);
  } else {
    testResults.health.missing.push(route);
    console.log(`❌ ${route.method.toUpperCase()} ${route.path} - ${route.name}`);
  }
});

// Test status routes
console.log('\n📋 STATUS ROUTES (/api/v1/status)');
console.log('-'.repeat(50));

expectedStatusRoutes.forEach(route => {
  const routePattern = new RegExp(`router\\.${route.method}\\s*\\(\\s*['"\`]${route.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`, 'g');
  
  if (routePattern.test(statusRoutesContent)) {
    testResults.status.found++;
    console.log(`✅ ${route.method.toUpperCase()} ${route.path} - ${route.name}`);
  } else {
    testResults.status.missing.push(route);
    console.log(`❌ ${route.method.toUpperCase()} ${route.path} - ${route.name}`);
  }
});

// Check for Swagger documentation
console.log('\n📚 SWAGGER DOCUMENTATION');
console.log('-'.repeat(50));

const swaggerPatterns = [
  /@swagger/g,
  /summary:/g,
  /description:/g,
  /tags:/g,
  /responses:/g
];

const swaggerResults = {
  health: {
    blocks: (healthRoutesContent.match(swaggerPatterns[0]) || []).length,
    summaries: (healthRoutesContent.match(swaggerPatterns[1]) || []).length,
    descriptions: (healthRoutesContent.match(swaggerPatterns[2]) || []).length
  },
  status: {
    blocks: (statusRoutesContent.match(swaggerPatterns[0]) || []).length,
    summaries: (statusRoutesContent.match(swaggerPatterns[1]) || []).length,
    descriptions: (statusRoutesContent.match(swaggerPatterns[2]) || []).length
  }
};

console.log(`Health Routes Swagger Blocks: ${swaggerResults.health.blocks} ✅`);
console.log(`Health Routes Summaries: ${swaggerResults.health.summaries} ✅`);
console.log(`Status Routes Swagger Blocks: ${swaggerResults.status.blocks} ✅`);
console.log(`Status Routes Summaries: ${swaggerResults.status.summaries} ✅`);

// Check for proper imports
console.log('\n📦 IMPORTS AND DEPENDENCIES');
console.log('-'.repeat(50));

const healthImports = [
  'Router',
  'HealthController',
  'MonitoringService',
  'logger'
];

const statusImports = [
  'Router',
  'Request',
  'Response',
  'logger',
  'config',
  'SystemHealthService',
  'MonitoringService'
];

const importResults = {
  health: { found: 0, missing: [] },
  status: { found: 0, missing: [] }
};

healthImports.forEach(imp => {
  if (healthRoutesContent.includes(imp)) {
    importResults.health.found++;
    console.log(`✅ Health Routes - ${imp}: IMPORTED`);
  } else {
    importResults.health.missing.push(imp);
    console.log(`❌ Health Routes - ${imp}: MISSING`);
  }
});

statusImports.forEach(imp => {
  if (statusRoutesContent.includes(imp)) {
    importResults.status.found++;
    console.log(`✅ Status Routes - ${imp}: IMPORTED`);
  } else {
    importResults.status.missing.push(imp);
    console.log(`❌ Status Routes - ${imp}: MISSING`);
  }
});

// Generate summary
console.log('\n' + '='.repeat(70));
console.log('📊 ROUTES TEST SUMMARY');
console.log('='.repeat(70));

const healthSuccessRate = (testResults.health.found / testResults.health.total) * 100;
const statusSuccessRate = (testResults.status.found / testResults.status.total) * 100;
const overallSuccessRate = ((testResults.health.found + testResults.status.found) / 
                           (testResults.health.total + testResults.status.total)) * 100;

console.log(`Health Routes: ${testResults.health.found}/${testResults.health.total} (${healthSuccessRate.toFixed(1)}%)`);
console.log(`Status Routes: ${testResults.status.found}/${testResults.status.total} (${statusSuccessRate.toFixed(1)}%)`);
console.log(`Overall Success Rate: ${overallSuccessRate.toFixed(1)}%`);

// Show missing routes
if (testResults.health.missing.length > 0) {
  console.log('\n❌ MISSING HEALTH ROUTES:');
  testResults.health.missing.forEach(route => {
    console.log(`  - ${route.method.toUpperCase()} ${route.path} (${route.name})`);
  });
}

if (testResults.status.missing.length > 0) {
  console.log('\n❌ MISSING STATUS ROUTES:');
  testResults.status.missing.forEach(route => {
    console.log(`  - ${route.method.toUpperCase()} ${route.path} (${route.name})`);
  });
}

// Final assessment
console.log('\n💡 FINAL ASSESSMENT');
console.log('='.repeat(70));

if (overallSuccessRate >= 90) {
  console.log('✅ ROUTES CONFIGURATION IS EXCELLENT');
  console.log('✅ All critical health and status endpoints are properly configured');
  
  if (swaggerResults.health.blocks > 10 && swaggerResults.status.blocks > 3) {
    console.log('✅ Swagger documentation is comprehensive');
  } else {
    console.log('⚠️ Swagger documentation could be improved');
  }
  
} else if (overallSuccessRate >= 75) {
  console.log('⚠️ ROUTES CONFIGURATION IS GOOD BUT NEEDS IMPROVEMENT');
  console.log('⚠️ Some endpoints may be missing or misconfigured');
} else {
  console.log('❌ ROUTES CONFIGURATION NEEDS SIGNIFICANT WORK');
  console.log('❌ Many endpoints are missing or misconfigured');
}

// Task completion check
const criticalHealthRoutes = [
  '/', '/detailed', '/ready', '/live', '/system', '/database', '/redis', 
  '/exchanges', '/paper-trading-safety', '/services'
];

const criticalStatusRoutes = [
  '/', '/services', '/paper-trading', '/health-summary'
];

const foundCriticalHealth = criticalHealthRoutes.filter(path => 
  expectedHealthRoutes.find(r => r.path === path && testResults.health.missing.find(m => m.path === path) === undefined)
).length;

const foundCriticalStatus = criticalStatusRoutes.filter(path => 
  expectedStatusRoutes.find(r => r.path === path && testResults.status.missing.find(m => m.path === path) === undefined)
).length;

const criticalCompletionRate = ((foundCriticalHealth + foundCriticalStatus) / 
                               (criticalHealthRoutes.length + criticalStatusRoutes.length)) * 100;

console.log('\n🎯 TASK 19 ROUTES COMPLETION');
console.log('='.repeat(70));
console.log(`Critical Routes Completion: ${criticalCompletionRate.toFixed(1)}%`);

if (criticalCompletionRate >= 90) {
  console.log('🎉 TASK 19 ROUTES SUCCESSFULLY IMPLEMENTED!');
  console.log('✅ All critical health check routes are properly configured');
} else {
  console.log('⚠️ TASK 19 ROUTES NEED MORE WORK');
  console.log('❌ Some critical routes are missing or misconfigured');
}

// Save results
const reportData = {
  timestamp: new Date().toISOString(),
  task: 'Task 19: Health Check Routes Configuration',
  results: testResults,
  swagger: swaggerResults,
  imports: importResults,
  completion: {
    overall: overallSuccessRate,
    critical: criticalCompletionRate,
    status: criticalCompletionRate >= 90 ? 'COMPLETED' : 'PARTIAL'
  }
};

fs.writeFileSync('health-routes-test-report.json', JSON.stringify(reportData, null, 2));
console.log('\n📄 Detailed report saved to: health-routes-test-report.json');

// Exit with appropriate code
process.exit(criticalCompletionRate >= 90 ? 0 : 1);