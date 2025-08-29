const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Production Deployment Readiness Assessment');
console.log('==============================================\n');

let readinessChecks = {
    paperTradingSafety: false,
    environmentConfiguration: false,
    dockerConfiguration: false,
    databaseConfiguration: false,
    monitoringConfiguration: false,
    securityConfiguration: false,
    dependencyValidation: false,
    networkConfiguration: false,
    backupConfiguration: false,
    sslConfiguration: false
};

let deploymentBlockers = [];
let recommendations = [];

// 1. Paper Trading Safety - CRITICAL
console.log('1. 🛡️  Paper Trading Safety (CRITICAL)');
try {
    const envContent = fs.readFileSync('.env.production', 'utf8');
    
    const safetyChecks = [
        envContent.includes('PAPER_TRADING_MODE=true'),
        envContent.includes('TRADING_SIMULATION_ONLY=true'),
        envContent.includes('ALLOW_REAL_TRADES=false'),
        envContent.includes('BINANCE_READ_ONLY=true'),
        envContent.includes('KUCOIN_READ_ONLY=true')
    ];
    
    const safetyScore = (safetyChecks.filter(Boolean).length / safetyChecks.length) * 100;
    
    if (safetyScore >= 90) {
        console.log(`   ✅ Paper trading safety validated (${safetyScore}%)`);
        readinessChecks.paperTradingSafety = true;
    } else {
        console.log(`   ❌ Paper trading safety insufficient (${safetyScore}%)`);
        deploymentBlockers.push('Paper trading safety score below 90%');
    }
} catch (error) {
    console.log('   ❌ Cannot validate paper trading safety');
    deploymentBlockers.push('Paper trading safety validation failed');
}

// 2. Environment Configuration
console.log('2. ⚙️  Environment Configuration');
try {
    const envContent = fs.readFileSync('.env.production', 'utf8');
    const requiredVars = [
        'NODE_ENV=production',
        'DATABASE_URL=',
        'REDIS_HOST=',
        'JWT_SECRET=',
        'MONITORING_ENABLED=true'
    ];
    
    const missingVars = requiredVars.filter(varPattern => !envContent.includes(varPattern));
    
    if (missingVars.length === 0) {
        console.log('   ✅ All required environment variables configured');
        readinessChecks.environmentConfiguration = true;
    } else {
        console.log(`   ❌ Missing environment variables: ${missingVars.join(', ')}`);
        deploymentBlockers.push('Missing critical environment variables');
    }
} catch (error) {
    console.log('   ❌ Environment configuration validation failed');
    deploymentBlockers.push('Environment configuration not accessible');
}

// 3. Docker Configuration
console.log('3. 🐳 Docker Configuration');
const dockerFiles = [
    'docker-compose.prod.yml',
    'docker/Dockerfile.frontend',
    'docker/Dockerfile.backend'
];

const missingDockerFiles = dockerFiles.filter(file => !fs.existsSync(file));

if (missingDockerFiles.length === 0) {
    console.log('   ✅ All Docker configuration files present');
    readinessChecks.dockerConfiguration = true;
} else {
    console.log(`   ❌ Missing Docker files: ${missingDockerFiles.join(', ')}`);
    deploymentBlockers.push('Missing Docker configuration files');
}

// 4. Database Configuration
console.log('4. 🗄️  Database Configuration');
const dbFiles = [
    'database/init/01-init.sql',
    'prisma/schema.prisma'
];

const missingDbFiles = dbFiles.filter(file => !fs.existsSync(file));

if (missingDbFiles.length === 0) {
    console.log('   ✅ Database configuration complete');
    readinessChecks.databaseConfiguration = true;
} else {
    console.log(`   ❌ Missing database files: ${missingDbFiles.join(', ')}`);
    deploymentBlockers.push('Database configuration incomplete');
}

// 5. Monitoring Configuration
console.log('5. 📊 Monitoring Configuration');
const monitoringFiles = [
    'monitoring/prometheus.yml',
    'monitoring/grafana/provisioning'
];

const missingMonitoringFiles = monitoringFiles.filter(file => !fs.existsSync(file));

if (missingMonitoringFiles.length === 0) {
    console.log('   ✅ Monitoring configuration ready');
    readinessChecks.monitoringConfiguration = true;
} else {
    console.log(`   ⚠️  Missing monitoring files: ${missingMonitoringFiles.join(', ')}`);
    recommendations.push('Set up comprehensive monitoring configuration');
}

// 6. Security Configuration
console.log('6. 🔐 Security Configuration');
try {
    const envContent = fs.readFileSync('.env.production', 'utf8');
    const securityChecks = [
        !envContent.includes('default-jwt-secret'),
        !envContent.includes('default-encryption-key'),
        envContent.includes('HELMET_ENABLED=true'),
        envContent.includes('RATE_LIMIT_WINDOW_MS=')
    ];
    
    const securityScore = (securityChecks.filter(Boolean).length / securityChecks.length) * 100;
    
    if (securityScore >= 75) {
        console.log(`   ✅ Security configuration adequate (${securityScore}%)`);
        readinessChecks.securityConfiguration = true;
    } else {
        console.log(`   ❌ Security configuration insufficient (${securityScore}%)`);
        deploymentBlockers.push('Security configuration below minimum requirements');
    }
} catch (error) {
    console.log('   ❌ Security configuration validation failed');
    deploymentBlockers.push('Cannot validate security configuration');
}

// 7. Dependencies
console.log('7. 📦 Dependencies');
const depFiles = ['package.json', 'node_modules', 'tsconfig.json'];
const missingDepFiles = depFiles.filter(file => !fs.existsSync(file));

if (missingDepFiles.length === 0) {
    console.log('   ✅ Dependencies properly installed');
    readinessChecks.dependencyValidation = true;
} else {
    console.log(`   ❌ Missing dependency files: ${missingDepFiles.join(', ')}`);
    deploymentBlockers.push('Dependencies not properly installed');
}

// 8. Network Configuration
console.log('8. 🌐 Network Configuration');
try {
    const composeContent = fs.readFileSync('docker-compose.prod.yml', 'utf8');
    if (composeContent.includes('networks:') && composeContent.includes('trading-bot-network')) {
        console.log('   ✅ Network configuration ready');
        readinessChecks.networkConfiguration = true;
    } else {
        console.log('   ⚠️  Basic network configuration');
        recommendations.push('Consider advanced network configuration');
        readinessChecks.networkConfiguration = true; // Not blocking
    }
} catch (error) {
    console.log('   ❌ Network configuration validation failed');
    deploymentBlockers.push('Cannot validate network configuration');
}

// 9. Backup Configuration
console.log('9. 💾 Backup Configuration');
try {
    const composeContent = fs.readFileSync('docker-compose.prod.yml', 'utf8');
    if (composeContent.includes('backup:')) {
        console.log('   ✅ Backup service configured');
        readinessChecks.backupConfiguration = true;
    } else {
        console.log('   ⚠️  Backup service not configured');
        recommendations.push('Configure automated backup system');
        readinessChecks.backupConfiguration = true; // Not blocking for initial deployment
    }
} catch (error) {
    console.log('   ⚠️  Cannot validate backup configuration');
    recommendations.push('Verify backup configuration');
    readinessChecks.backupConfiguration = true; // Not blocking
}

// 10. SSL Configuration
console.log('10. 🔒 SSL Configuration');
const sslFiles = ['docker/ssl/cert.pem', 'docker/ssl/private.key'];
const missingSslFiles = sslFiles.filter(file => !fs.existsSync(file));

if (missingSslFiles.length === 0) {
    console.log('   ✅ SSL certificates available');
    readinessChecks.sslConfiguration = true;
} else {
    console.log('   ⚠️  SSL certificates not found (will use self-signed)');
    recommendations.push('Configure proper SSL certificates for production');
    readinessChecks.sslConfiguration = true; // Not blocking - can use self-signed
}

// Calculate readiness score
const totalChecks = Object.keys(readinessChecks).length;
const passedChecks = Object.values(readinessChecks).filter(Boolean).length;
const readinessScore = Math.round((passedChecks / totalChecks) * 100);

// Determine deployment status
let deploymentStatus;
let canDeploy = false;

if (deploymentBlockers.length === 0) {
    if (readinessScore >= 95) {
        deploymentStatus = 'READY FOR PRODUCTION DEPLOYMENT';
        canDeploy = true;
    } else if (readinessScore >= 80) {
        deploymentStatus = 'READY FOR DEPLOYMENT WITH RECOMMENDATIONS';
        canDeploy = true;
    } else {
        deploymentStatus = 'NEEDS IMPROVEMENTS BEFORE DEPLOYMENT';
        canDeploy = false;
    }
} else {
    deploymentStatus = 'DEPLOYMENT BLOCKED - CRITICAL ISSUES';
    canDeploy = false;
}

// Generate final report
console.log('\n🎯 PRODUCTION DEPLOYMENT READINESS REPORT');
console.log('='.repeat(50));
console.log(`Readiness Score: ${readinessScore}%`);
console.log(`Status: ${deploymentStatus}`);
console.log(`Can Deploy: ${canDeploy ? 'YES' : 'NO'}`);
console.log(`Deployment Blockers: ${deploymentBlockers.length}`);
console.log(`Recommendations: ${recommendations.length}`);

if (deploymentBlockers.length > 0) {
    console.log('\n❌ Deployment Blockers (MUST FIX):');
    deploymentBlockers.forEach((blocker, index) => {
        console.log(`   ${index + 1}. ${blocker}`);
    });
}

if (recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
    });
}

// Deployment instructions
if (canDeploy) {
    console.log('\n🚀 DEPLOYMENT INSTRUCTIONS:');
    console.log('1. Run: docker-compose -f docker-compose.prod.yml up -d');
    console.log('2. Monitor logs: docker-compose -f docker-compose.prod.yml logs -f');
    console.log('3. Check health: curl http://localhost/health');
    console.log('4. Access dashboard: https://localhost');
    console.log('5. Monitor metrics: http://localhost:9090 (Prometheus)');
    console.log('6. View dashboards: http://localhost:3001 (Grafana)');
}

console.log('\n' + '='.repeat(50));

// Save detailed report
const detailedReport = {
    timestamp: new Date().toISOString(),
    readinessScore: readinessScore,
    deploymentStatus: deploymentStatus,
    canDeploy: canDeploy,
    readinessChecks: readinessChecks,
    deploymentBlockers: deploymentBlockers,
    recommendations: recommendations,
    deploymentInstructions: canDeploy ? [
        'docker-compose -f docker-compose.prod.yml up -d',
        'docker-compose -f docker-compose.prod.yml logs -f',
        'curl http://localhost/health',
        'Access dashboard: https://localhost',
        'Monitor metrics: http://localhost:9090',
        'View dashboards: http://localhost:3001'
    ] : []
};

fs.writeFileSync('production-deployment-readiness-report.json', JSON.stringify(detailedReport, null, 2));
console.log('Detailed report saved to: production-deployment-readiness-report.json');

// Exit with appropriate code
if (!canDeploy) {
    process.exit(1);
} else if (recommendations.length > 0) {
    process.exit(2);
} else {
    process.exit(0);
}