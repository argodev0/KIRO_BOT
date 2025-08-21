#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating AI Crypto Trading Bot setup...\n');

const requiredFiles = [
  'package.json',
  'tsconfig.json',
  'docker-compose.yml',
  'prisma/schema.prisma',
  'src/index.ts',
  'src/config/config.ts',
  'src/utils/logger.ts',
  'src/utils/metrics.ts',
  '.env.example',
  'README.md'
];

const requiredDirectories = [
  'src/services',
  'src/models',
  'src/types',
  'src/controllers',
  'src/routes',
  'src/middleware',
  'src/utils',
  'src/config',
  'src/test',
  'redis',
  'rabbitmq',
  'monitoring',
  'database/init',
  'scripts'
];

let allValid = true;

// Check required files
console.log('📁 Checking required files:');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - MISSING`);
    allValid = false;
  }
});

console.log('\n📂 Checking required directories:');
requiredDirectories.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`  ✅ ${dir}/`);
  } else {
    console.log(`  ❌ ${dir}/ - MISSING`);
    allValid = false;
  }
});

// Check package.json dependencies
console.log('\n📦 Checking key dependencies:');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const keyDeps = [
    'express',
    'typescript',
    '@prisma/client',
    'redis',
    'amqplib',
    'winston',
    'prom-client'
  ];
  
  keyDeps.forEach(dep => {
    if (packageJson.dependencies[dep] || packageJson.devDependencies[dep]) {
      console.log(`  ✅ ${dep}`);
    } else {
      console.log(`  ❌ ${dep} - MISSING`);
      allValid = false;
    }
  });
} catch (error) {
  console.log('  ❌ Error reading package.json');
  allValid = false;
}

// Check Docker configuration
console.log('\n🐳 Checking Docker configuration:');
try {
  const dockerCompose = fs.readFileSync('docker-compose.yml', 'utf8');
  const requiredServices = ['postgres', 'redis', 'rabbitmq', 'prometheus', 'grafana'];
  
  requiredServices.forEach(service => {
    if (dockerCompose.includes(`${service}:`)) {
      console.log(`  ✅ ${service} service configured`);
    } else {
      console.log(`  ❌ ${service} service - MISSING`);
      allValid = false;
    }
  });
} catch (error) {
  console.log('  ❌ Error reading docker-compose.yml');
  allValid = false;
}

// Check Prisma schema
console.log('\n🗄️  Checking Prisma schema:');
try {
  const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
  const requiredModels = ['User', 'TradingSignal', 'TradeExecution', 'Grid', 'Portfolio'];
  
  requiredModels.forEach(model => {
    if (schema.includes(`model ${model}`)) {
      console.log(`  ✅ ${model} model defined`);
    } else {
      console.log(`  ❌ ${model} model - MISSING`);
      allValid = false;
    }
  });
} catch (error) {
  console.log('  ❌ Error reading Prisma schema');
  allValid = false;
}

console.log('\n' + '='.repeat(50));

if (allValid) {
  console.log('🎉 Setup validation PASSED! All required components are in place.');
  console.log('\nNext steps:');
  console.log('1. Copy .env.example to .env and configure your settings');
  console.log('2. Run: npm install');
  console.log('3. Run: ./scripts/start-dev.sh');
  console.log('4. Run: npm run dev');
} else {
  console.log('❌ Setup validation FAILED! Please fix the missing components above.');
  process.exit(1);
}

console.log('='.repeat(50));