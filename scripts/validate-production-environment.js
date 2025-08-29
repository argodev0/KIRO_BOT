const fs = require('fs');
const path = require('path');

console.log('🔍 Production Environment Validation');
console.log('=====================================\n');

let overallScore = 0;
let totalChecks = 0;
let criticalIssues = [];
let warnings = [];

// 1. Paper Trading Safety Validation
console.log('1. 🛡️  Paper Trading Safety Configuration');
let safetyScore = 0;
let safetyChecks = 0;

const envPath = '.env.production';
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    if (envContent.includes('PAPER_TRADING_MODE=true')) {
        console.log('   ✅ Paper trading mode enabled');
        safetyScore++;
    } else {
        console.log('   ❌ Paper trading mode not enabled');
        criticalIssues.push('Paper trading mode not enabled');
    }
    safetyChecks++;
    
    if (envContent.includes('TRADING_SIMULATION_ONLY=true')) {
        console.log('   ✅ Trading simulation only enabled');
        safetyScore++;
    } else {
        console.log('   ❌ Trading simulation only not enabled');
        criticalIssues.push('Trading simulation only not enabled');
    }
    safetyChecks++;
    
    if (envContent.includes('ALLOW_REAL_TRADES=false')) {
        console.log('   ✅ Real trades blocked');
        safetyScore++;
    } else {
        console.log('   ❌ Real trades not blocked');
        criticalIssues.push('Real trades not blocked');
    }
    safetyChecks++;
    
    if (envContent.includes('BINANCE_READ_ONLY=true') && envContent.includes('KUCOIN_READ_ONLY=true')) {
        console.log('   ✅ API keys configured as read-only');
        safetyScore++;
    } else {
        console.log('   ❌ API keys not configured as read-only');
        criticalIssues.push('API keys not configured as read-only');
    }
    safetyChecks++;
    
} else {
    console.log('   ❌ Production environment file not found');
    criticalIssues.push('Production environment file not found');
}

const paperTradingSafetyScore = safetyChecks > 0 ? (safetyScore / safetyChecks) * 100 : 0;
console.log(`   📊 Paper Trading Safety Score: ${paperTradingSafetyScore.toFixed(1)}%\n`);

// 2. Environment Configuration
console.log('2. ⚙️  Environment Configuration');
let envScore = 0;
let envChecks = 0;

const requiredVars = [
    'NODE_ENV',
    'PAPER_TRADING_MODE',
    'TRADING_SIMULATION_ONLY',
    'ALLOW_REAL_TRADES',
    'DATABASE_URL',
    'REDIS_HOST',
    'JWT_SECRET',
    'MONITORING_ENABLED'
];

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    requiredVars.forEach(varName => {
        if (envContent.includes(`${varName}=`)) {
            console.log(`   ✅ ${varName} configured`);
            envScore++;
        } else {
            console.log(`   ❌ ${varName} missing`);
            criticalIssues.push(`Missing environment variable: ${varName}`);
        }
        envChecks++;
    });
    
    if (envContent.includes('NODE_ENV=production')) {
        console.log('   ✅ Production mode enabled');
        envScore++;
    } else {
        console.log('   ❌ Production mode not enabled');
        criticalIssues.push('Production mode not enabled');
    }
    envChecks++;
}

const envConfigScore = envChecks > 0 ? (envScore / envChecks) * 100 : 0;
console.log(`   📊 Environment Configuration Score: ${envConfigScore.toFixed(1)}%\n`);

// 3. Docker Configuration
console.log('3. 🐳 Docker Configuration');
let dockerScore = 0;
let dockerChecks = 0;

if (fs.existsSync('docker-compose.prod.yml')) {
    console.log('   ✅ Production docker-compose file exists');
    dockerScore++;
    
    const composeContent = fs.readFileSync('docker-compose.prod.yml', 'utf8');
    if (composeContent.includes('healthcheck:')) {
        console.log('   ✅ Health checks configured');
        dockerScore++;
    } else {
        console.log('   ⚠️  Health checks not configured');
        warnings.push('Health checks not configured in docker-compose');
    }
    dockerChecks++;
    
    if (composeContent.includes('networks:')) {
        console.log('   ✅ Docker networks configured');
        dockerScore++;
    } else {
        console.log('   ⚠️  Docker networks not configured');
        warnings.push('Docker networks not configured');
    }
    dockerChecks++;
    
} else {
    console.log('   ❌ Production docker-compose file not found');
    criticalIssues.push('Production docker-compose file not found');
}
dockerChecks++;

if (fs.existsSync('docker/Dockerfile.frontend') && fs.existsSync('docker/Dockerfile.backend')) {
    console.log('   ✅ Required Dockerfiles exist');
    dockerScore++;
} else {
    console.log('   ❌ Required Dockerfiles missing');
    criticalIssues.push('Required Dockerfiles missing');
}
dockerChecks++;

const dockerConfigScore = dockerChecks > 0 ? (dockerScore / dockerChecks) * 100 : 0;
console.log(`   📊 Docker Configuration Score: ${dockerConfigScore.toFixed(1)}%\n`);

// 4. SSL Configuration
console.log('4. 🔒 SSL Configuration');
let sslScore = 0;
let sslChecks = 0;

if (fs.existsSync('docker/ssl/cert.pem') && fs.existsSync('docker/ssl/private.key')) {
    console.log('   ✅ SSL certificates exist');
    sslScore++;
} else {
    console.log('   ⚠️  SSL certificates not found (will use self-signed)');
    warnings.push('SSL certificates not found - using self-signed certificates');
}
sslChecks++;

if (fs.existsSync('docker/nginx/complete-production.conf')) {
    const nginxContent = fs.readFileSync('docker/nginx/complete-production.conf', 'utf8');
    if (nginxContent.includes('ssl_certificate')) {
        console.log('   ✅ Nginx SSL configured');
        sslScore++;
    } else {
        console.log('   ⚠️  Nginx SSL not configured');
        warnings.push('Nginx SSL not configured');
    }
} else {
    console.log('   ⚠️  Nginx configuration not found');
    warnings.push('Nginx configuration not found');
}
sslChecks++;

const sslConfigScore = sslChecks > 0 ? (sslScore / sslChecks) * 100 : 0;
console.log(`   📊 SSL Configuration Score: ${sslConfigScore.toFixed(1)}%\n`);

// 5. Database Configuration
console.log('5. 🗄️  Database Configuration');
let dbScore = 0;
let dbChecks = 0;

if (fs.existsSync('database/init/01-init.sql')) {
    console.log('   ✅ Database initialization scripts exist');
    dbScore++;
} else {
    console.log('   ❌ Database initialization scripts missing');
    criticalIssues.push('Database initialization scripts missing');
}
dbChecks++;

if (fs.existsSync('prisma/schema.prisma')) {
    console.log('   ✅ Prisma schema configured');
    dbScore++;
} else {
    console.log('   ❌ Prisma schema missing');
    criticalIssues.push('Prisma schema missing');
}
dbChecks++;

const dbConfigScore = dbChecks > 0 ? (dbScore / dbChecks) * 100 : 0;
console.log(`   📊 Database Configuration Score: ${dbConfigScore.toFixed(1)}%\n`);

// 6. Monitoring Configuration
console.log('6. 📊 Monitoring Configuration');
let monitoringScore = 0;
let monitoringChecks = 0;

if (fs.existsSync('monitoring/prometheus.yml')) {
    console.log('   ✅ Prometheus configuration exists');
    monitoringScore++;
} else {
    console.log('   ⚠️  Prometheus configuration missing');
    warnings.push('Prometheus configuration missing');
}
monitoringChecks++;

if (fs.existsSync('monitoring/grafana/provisioning')) {
    console.log('   ✅ Grafana provisioning configured');
    monitoringScore++;
} else {
    console.log('   ⚠️  Grafana provisioning not configured');
    warnings.push('Grafana provisioning not configured');
}
monitoringChecks++;

const monitoringConfigScore = monitoringChecks > 0 ? (monitoringScore / monitoringChecks) * 100 : 0;
console.log(`   📊 Monitoring Configuration Score: ${monitoringConfigScore.toFixed(1)}%\n`);

// 7. Dependencies
console.log('7. 📦 Dependencies');
let depScore = 0;
let depChecks = 0;

if (fs.existsSync('package.json')) {
    console.log('   ✅ Package.json exists');
    depScore++;
} else {
    console.log('   ❌ Package.json missing');
    criticalIssues.push('Package.json missing');
}
depChecks++;

if (fs.existsSync('node_modules')) {
    console.log('   ✅ Dependencies installed');
    depScore++;
} else {
    console.log('   ❌ Dependencies not installed');
    criticalIssues.push('Dependencies not installed');
}
depChecks++;

if (fs.existsSync('tsconfig.json')) {
    console.log('   ✅ TypeScript configured');
    depScore++;
} else {
    console.log('   ❌ TypeScript configuration missing');
    criticalIssues.push('TypeScript configuration missing');
}
depChecks++;

const depConfigScore = depChecks > 0 ? (depScore / depChecks) * 100 : 0;
console.log(`   📊 Dependencies Score: ${depConfigScore.toFixed(1)}%\n`);

// Calculate Overall Score
const categoryScores = [
    paperTradingSafetyScore,
    envConfigScore,
    dockerConfigScore,
    sslConfigScore,
    dbConfigScore,
    monitoringConfigScore,
    depConfigScore
];

// Weight paper trading safety more heavily
const weightedScore = (paperTradingSafetyScore * 0.4) + 
                     (categoryScores.slice(1).reduce((a, b) => a + b, 0) / 6 * 0.6);

overallScore = Math.round(weightedScore);

// Generate Report
console.log('📋 PRODUCTION ENVIRONMENT VALIDATION REPORT');
console.log('='.repeat(50));
console.log(`Overall Score: ${overallScore}%`);
console.log(`Paper Trading Safety: ${paperTradingSafetyScore.toFixed(1)}%`);
console.log(`Critical Issues: ${criticalIssues.length}`);
console.log(`Warnings: ${warnings.length}`);

let status;
if (criticalIssues.length > 0) {
    status = 'FAILED - Critical issues must be resolved';
} else if (overallScore < 80) {
    status = 'WARNING - Improvements recommended';
} else if (overallScore < 95) {
    status = 'GOOD - Minor improvements possible';
} else {
    status = 'EXCELLENT - Production ready';
}

console.log(`Status: ${status}`);

if (criticalIssues.length > 0) {
    console.log('\n❌ Critical Issues:');
    criticalIssues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
    });
}

if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
    });
}

console.log('\n' + '='.repeat(50));

// Save report
const report = {
    timestamp: new Date().toISOString(),
    environment: 'production',
    overallScore: overallScore,
    status: status,
    paperTradingSafetyScore: paperTradingSafetyScore,
    categoryScores: {
        paperTradingSafety: paperTradingSafetyScore,
        environmentConfiguration: envConfigScore,
        dockerConfiguration: dockerConfigScore,
        sslConfiguration: sslConfigScore,
        databaseConfiguration: dbConfigScore,
        monitoringConfiguration: monitoringConfigScore,
        dependencies: depConfigScore
    },
    criticalIssues: criticalIssues,
    warnings: warnings,
    productionReady: criticalIssues.length === 0 && overallScore >= 90
};

fs.writeFileSync('production-environment-validation-report.json', JSON.stringify(report, null, 2));
console.log('Report saved to: production-environment-validation-report.json');

// Exit with appropriate code
if (criticalIssues.length > 0) {
    process.exit(1);
} else if (warnings.length > 0) {
    process.exit(2);
} else {
    process.exit(0);
}