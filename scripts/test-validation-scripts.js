#!/usr/bin/env node

/**
 * Test Validation Scripts
 * 
 * Simple test to verify all validation scripts can be executed
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🧪 Testing Production Validation Scripts...\n');

const scripts = [
  {
    name: 'Production Readiness Validation',
    script: 'scripts/production-readiness-validation.js',
    reportFile: 'production-readiness-report.json'
  },
  {
    name: 'Paper Trading Safety Verification',
    script: 'scripts/paper-trading-safety-verification.js',
    reportFile: 'paper-trading-safety-report.json'
  }
];

let allPassed = true;

for (const test of scripts) {
  console.log(`📋 Testing: ${test.name}`);
  
  try {
    // Clean up any existing report
    if (fs.existsSync(test.reportFile)) {
      fs.unlinkSync(test.reportFile);
    }
    
    // Run the script (expect it to fail due to missing components)
    execSync(`node ${test.script}`, { stdio: 'pipe' });
    console.log(`✅ ${test.name}: Script executed successfully`);
    
  } catch (error) {
    // Expected to fail due to missing production components
    console.log(`⚠️  ${test.name}: Script executed with expected failures (exit code: ${error.status})`);
  }
  
  // Check if report was generated
  if (fs.existsSync(test.reportFile)) {
    console.log(`✅ ${test.name}: Report generated successfully`);
    
    // Validate report structure
    try {
      const report = JSON.parse(fs.readFileSync(test.reportFile, 'utf8'));
      const hasValidStructure = (report.details && Array.isArray(report.details)) || 
                               (report.tests && Array.isArray(report.tests));
      
      if (hasValidStructure) {
        console.log(`✅ ${test.name}: Report structure is valid`);
      } else {
        console.log(`❌ ${test.name}: Invalid report structure`);
        allPassed = false;
      }
    } catch (parseError) {
      console.log(`❌ ${test.name}: Report is not valid JSON`);
      allPassed = false;
    }
  } else {
    console.log(`❌ ${test.name}: No report generated`);
    allPassed = false;
  }
  
  console.log('');
}

// Test the master validation suite help
console.log('📋 Testing: Production Validation Suite Help');
try {
  const helpOutput = execSync('node scripts/production-validation-suite.js --help', { encoding: 'utf8' });
  if (helpOutput.includes('Production Validation Suite')) {
    console.log('✅ Production Validation Suite: Help output is correct');
  } else {
    console.log('❌ Production Validation Suite: Invalid help output');
    allPassed = false;
  }
} catch (error) {
  console.log('❌ Production Validation Suite: Help command failed');
  allPassed = false;
}

console.log('\n' + '='.repeat(60));
if (allPassed) {
  console.log('🎉 All validation scripts are working correctly!');
  console.log('✅ Scripts can be executed');
  console.log('✅ Reports are generated');
  console.log('✅ Report structure is valid');
} else {
  console.log('❌ Some validation scripts have issues');
}
console.log('='.repeat(60));

process.exit(allPassed ? 0 : 1);