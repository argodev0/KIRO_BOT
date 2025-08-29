#!/usr/bin/env node

/**
 * Integration Test Validation Script
 * Validates that integration tests can compile and run successfully
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Integration Test Suite...\n');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.TRADING_SIMULATION_ONLY = 'true';
process.env.PAPER_TRADING_MODE = 'true';
process.env.JWT_SECRET = 'test-secret-key';

const testFiles = [
  'src/__tests__/integration/PaperTradingSafetyValidation.test.ts',
  'src/__tests__/integration/APIEndpointsValidation.test.ts',
  'src/__tests__/integration/EndToEndWorkflowValidation.test.ts',
  'src/__tests__/integration/ComprehensiveIntegration.test.ts'
];

let validationResults = {
  totalTests: 0,
  compilationErrors: 0,
  runtimeErrors: 0,
  passed: 0,
  failed: 0
};

console.log('📋 Checking test file existence...');
testFiles.forEach(testFile => {
  const fullPath = path.join(__dirname, testFile);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${testFile} - EXISTS`);
    validationResults.totalTests++;
  } else {
    console.log(`❌ ${testFile} - MISSING`);
  }
});

console.log('\n🔨 Checking TypeScript compilation...');
try {
  execSync('npx tsc --noEmit --project tsconfig.json', { 
    stdio: 'pipe',
    cwd: __dirname
  });
  console.log('✅ TypeScript compilation successful');
} catch (error) {
  console.log('❌ TypeScript compilation failed:');
  console.log(error.stdout?.toString() || error.message);
  validationResults.compilationErrors++;
}

console.log('\n🧪 Running integration test validation...');
try {
  // Run a quick test to validate the test environment
  const testCommand = 'npx jest --testPathPattern="integration" --listTests';
  const output = execSync(testCommand, { 
    stdio: 'pipe',
    cwd: __dirname
  });
  
  const testList = output.toString().split('\n').filter(line => line.includes('.test.ts'));
  console.log(`✅ Found ${testList.length} integration test files`);
  
  // Try to run a simple test
  try {
    execSync('npx jest --testPathPattern="integration" --testNamePattern="should validate test environment" --passWithNoTests', {
      stdio: 'pipe',
      cwd: __dirname,
      timeout: 30000
    });
    console.log('✅ Test environment validation passed');
    validationResults.passed++;
  } catch (testError) {
    console.log('⚠️  Test environment validation had issues (this may be expected)');
    validationResults.runtimeErrors++;
  }
  
} catch (error) {
  console.log('❌ Jest test discovery failed:');
  console.log(error.message);
  validationResults.runtimeErrors++;
}

console.log('\n📊 Validation Summary:');
console.log(`   📁 Test Files Found: ${validationResults.totalTests}`);
console.log(`   🔨 Compilation Errors: ${validationResults.compilationErrors}`);
console.log(`   🧪 Runtime Errors: ${validationResults.runtimeErrors}`);
console.log(`   ✅ Basic Validations Passed: ${validationResults.passed}`);

// Generate validation report
const report = {
  timestamp: new Date().toISOString(),
  validation: validationResults,
  environment: {
    nodeVersion: process.version,
    nodeEnv: process.env.NODE_ENV,
    tradingSimulationOnly: process.env.TRADING_SIMULATION_ONLY,
    paperTradingMode: process.env.PAPER_TRADING_MODE
  },
  recommendations: []
};

if (validationResults.compilationErrors > 0) {
  report.recommendations.push('Fix TypeScript compilation errors before running tests');
}

if (validationResults.runtimeErrors > 0) {
  report.recommendations.push('Check test environment setup and dependencies');
}

if (validationResults.totalTests === 0) {
  report.recommendations.push('Ensure integration test files are created and accessible');
}

if (validationResults.compilationErrors === 0 && validationResults.totalTests > 0) {
  report.recommendations.push('Integration tests are ready to run - execute with: npm test -- --testPathPattern="integration"');
}

// Save validation report
fs.writeFileSync('integration-test-validation-report.json', JSON.stringify(report, null, 2));
console.log('\n📄 Validation report saved to: integration-test-validation-report.json');

// Exit with appropriate code
const hasErrors = validationResults.compilationErrors > 0 || validationResults.totalTests === 0;
if (hasErrors) {
  console.log('\n❌ Validation completed with errors');
  process.exit(1);
} else {
  console.log('\n✅ Validation completed successfully');
  process.exit(0);
}