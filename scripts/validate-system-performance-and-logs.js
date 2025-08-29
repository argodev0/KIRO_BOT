#!/usr/bin/env node

/**
 * System Performance and Log Validation Script
 * 
 * This script validates:
 * 1. System performance metrics using SystemPerformanceMonitor service
 * 2. Log aggregation using monitoring/logstash configurations
 * 3. Uptime monitoring and availability tracking
 * 4. Backup systems using scripts/backup-automation.sh
 * 
 * Requirements: 6.5, 6.6, 6.7
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class SystemPerformanceLogValidator {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            performanceMonitoring: {},
            logAggregation: {},
            uptimeMonitoring: {},
            backupSystems: {},
            summary: {
                totalChecks: 0,
                passedChecks: 0,
                failedChecks: 0,
                warnings: [],
                errors: [],
                overallStatus: 'unknown'
            }
        };
        
        this.projectRoot = process.cwd();
        this.logFile = path.join(this.projectRoot, 'logs', `system-performance-log-validation-${Date.now()}.log`);
        
        // Ensure logs directory exists
        const logsDir = path.dirname(this.logFile);
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        
        console.log(logMessage);
        
        try {
            fs.appendFileSync(this.logFile, logMessage + '\n');
        } catch (error) {
            console.error('Failed to write to log file:', error.message);
        }
    }

    async validateSystemPerformanceMonitoring() {
        this.log('🔍 Validating System Performance Monitoring...');
        
        const performanceChecks = {
            systemPerformanceMonitorExists: false,
            performanceMetricsCollected: false,
            alertingConfigured: false,
            thresholdsConfigured: false,
            performanceHistoryTracked: false,
            eventLoopMonitored: false,
            memoryUsageMonitored: false,
            cpuUsageMonitored: false,
            diskSpaceMonitored: false,
            networkMonitored: false
        };

        try {
            // Check if SystemPerformanceMonitor service exists
            const performanceMonitorPath = path.join(this.projectRoot, 'src/services/SystemPerformanceMonitor.ts');
            performanceChecks.systemPerformanceMonitorExists = fs.existsSync(performanceMonitorPath);
            
            if (performanceChecks.systemPerformanceMonitorExists) {
                this.log('✅ SystemPerformanceMonitor service found');
                
                // Read and analyze the SystemPerformanceMonitor implementation
                const monitorContent = fs.readFileSync(performanceMonitorPath, 'utf8');
                
                // Check for key monitoring capabilities
                performanceChecks.performanceMetricsCollected = monitorContent.includes('collectSystemMetrics');
                performanceChecks.alertingConfigured = monitorContent.includes('emitAlert') && monitorContent.includes('PerformanceAlert');
                performanceChecks.thresholdsConfigured = monitorContent.includes('SystemThresholds') && monitorContent.includes('updateThresholds');
                performanceChecks.performanceHistoryTracked = monitorContent.includes('performanceHistory') && monitorContent.includes('recordMetric');
                performanceChecks.eventLoopMonitored = monitorContent.includes('monitorEventLoop');
                performanceChecks.memoryUsageMonitored = monitorContent.includes('monitorMemoryUsage');
                performanceChecks.cpuUsageMonitored = monitorContent.includes('monitorCpuUsage');
                performanceChecks.diskSpaceMonitored = monitorContent.includes('monitorDiskSpace');
                performanceChecks.networkMonitored = monitorContent.includes('monitorNetworkConnections');
                
                this.log(`   Performance metrics collection: ${performanceChecks.performanceMetricsCollected ? 'Enabled' : 'Disabled'}`);
                this.log(`   Alerting system: ${performanceChecks.alertingConfigured ? 'Configured' : 'Not configured'}`);
                this.log(`   Performance thresholds: ${performanceChecks.thresholdsConfigured ? 'Configured' : 'Not configured'}`);
                this.log(`   Performance history tracking: ${performanceChecks.performanceHistoryTracked ? 'Enabled' : 'Disabled'}`);
                this.log(`   Event loop monitoring: ${performanceChecks.eventLoopMonitored ? 'Enabled' : 'Disabled'}`);
                this.log(`   Memory usage monitoring: ${performanceChecks.memoryUsageMonitored ? 'Enabled' : 'Disabled'}`);
                this.log(`   CPU usage monitoring: ${performanceChecks.cpuUsageMonitored ? 'Enabled' : 'Disabled'}`);
                this.log(`   Disk space monitoring: ${performanceChecks.diskSpaceMonitored ? 'Enabled' : 'Disabled'}`);
                this.log(`   Network monitoring: ${performanceChecks.networkMonitored ? 'Enabled' : 'Disabled'}`);
                
            } else {
                this.log('❌ SystemPerformanceMonitor service not found');
                this.results.summary.errors.push('SystemPerformanceMonitor service not found');
            }

            // Test if performance monitoring is actually running
            try {
                // Check if there are recent performance logs
                const logsDir = path.join(this.projectRoot, 'logs');
                if (fs.existsSync(logsDir)) {
                    const logFiles = fs.readdirSync(logsDir);
                    const performanceLogFiles = logFiles.filter(file => 
                        file.includes('performance') || file.includes('application')
                    );
                    
                    if (performanceLogFiles.length > 0) {
                        this.log('✅ Performance log files found');
                        
                        // Check for recent performance metrics in logs
                        const recentLogFile = performanceLogFiles
                            .map(file => ({
                                name: file,
                                path: path.join(logsDir, file),
                                mtime: fs.statSync(path.join(logsDir, file)).mtime
                            }))
                            .sort((a, b) => b.mtime - a.mtime)[0];
                        
                        if (recentLogFile) {
                            const logContent = fs.readFileSync(recentLogFile.path, 'utf8');
                            const hasPerformanceMetrics = logContent.includes('Performance') || 
                                                        logContent.includes('memory_usage') ||
                                                        logContent.includes('cpu_usage') ||
                                                        logContent.includes('event_loop_lag');
                            
                            if (hasPerformanceMetrics) {
                                this.log('✅ Performance metrics found in recent logs');
                                performanceChecks.performanceMetricsCollected = true;
                            } else {
                                this.log('⚠️  No performance metrics found in recent logs');
                                this.results.summary.warnings.push('No performance metrics found in recent logs');
                            }
                        }
                    } else {
                        this.log('⚠️  No performance log files found');
                        this.results.summary.warnings.push('No performance log files found');
                    }
                }
            } catch (error) {
                this.log(`⚠️  Error checking performance logs: ${error.message}`);
                this.results.summary.warnings.push(`Error checking performance logs: ${error.message}`);
            }

            this.results.performanceMonitoring = performanceChecks;
            
            // Count checks
            const totalPerformanceChecks = Object.keys(performanceChecks).length;
            const passedPerformanceChecks = Object.values(performanceChecks).filter(Boolean).length;
            
            this.results.summary.totalChecks += totalPerformanceChecks;
            this.results.summary.passedChecks += passedPerformanceChecks;
            this.results.summary.failedChecks += (totalPerformanceChecks - passedPerformanceChecks);
            
            this.log(`✅ Performance monitoring validation completed: ${passedPerformanceChecks}/${totalPerformanceChecks} checks passed`);
            
        } catch (error) {
            this.log(`❌ Performance monitoring validation failed: ${error.message}`);
            this.results.summary.errors.push(`Performance monitoring validation failed: ${error.message}`);
        }
    }

    async validateLogAggregation() {
        this.log('🔍 Validating Log Aggregation System...');
        
        const logAggregationChecks = {
            logstashConfigExists: false,
            logstashPipelineConfigured: false,
            elasticsearchTemplateExists: false,
            logParsingRulesConfigured: false,
            logIndexingConfigured: false,
            logRotationConfigured: false,
            logRetentionConfigured: false,
            structuredLoggingEnabled: false,
            logLevelsConfigured: false,
            auditLoggingEnabled: false
        };

        try {
            // Check Logstash configuration
            const logstashConfigPath = path.join(this.projectRoot, 'monitoring/logstash/config/logstash.yml');
            logAggregationChecks.logstashConfigExists = fs.existsSync(logstashConfigPath);
            
            if (logAggregationChecks.logstashConfigExists) {
                this.log('✅ Logstash configuration found');
                
                const logstashConfig = fs.readFileSync(logstashConfigPath, 'utf8');
                logAggregationChecks.logIndexingConfigured = logstashConfig.includes('elasticsearch');
                
                this.log(`   Elasticsearch integration: ${logAggregationChecks.logIndexingConfigured ? 'Configured' : 'Not configured'}`);
            } else {
                this.log('❌ Logstash configuration not found');
                this.results.summary.errors.push('Logstash configuration not found');
            }

            // Check Logstash pipeline configuration
            const logstashPipelinePath = path.join(this.projectRoot, 'monitoring/logstash/pipeline/logstash.conf');
            logAggregationChecks.logstashPipelineConfigured = fs.existsSync(logstashPipelinePath);
            
            if (logAggregationChecks.logstashPipelineConfigured) {
                this.log('✅ Logstash pipeline configuration found');
                
                const pipelineConfig = fs.readFileSync(logstashPipelinePath, 'utf8');
                
                // Check for log parsing rules
                logAggregationChecks.logParsingRulesConfigured = pipelineConfig.includes('grok') && 
                                                               pipelineConfig.includes('filter');
                
                // Check for structured logging support
                logAggregationChecks.structuredLoggingEnabled = pipelineConfig.includes('json') ||
                                                              pipelineConfig.includes('json_lines');
                
                // Check for audit logging
                logAggregationChecks.auditLoggingEnabled = pipelineConfig.includes('audit') ||
                                                         pipelineConfig.includes('security');
                
                this.log(`   Log parsing rules: ${logAggregationChecks.logParsingRulesConfigured ? 'Configured' : 'Not configured'}`);
                this.log(`   Structured logging: ${logAggregationChecks.structuredLoggingEnabled ? 'Enabled' : 'Disabled'}`);
                this.log(`   Audit logging: ${logAggregationChecks.auditLoggingEnabled ? 'Enabled' : 'Disabled'}`);
                
            } else {
                this.log('❌ Logstash pipeline configuration not found');
                this.results.summary.errors.push('Logstash pipeline configuration not found');
            }

            // Check Elasticsearch template
            const elasticsearchTemplatePath = path.join(this.projectRoot, 'monitoring/logstash/templates/trading-bot-template.json');
            logAggregationChecks.elasticsearchTemplateExists = fs.existsSync(elasticsearchTemplatePath);
            
            if (logAggregationChecks.elasticsearchTemplateExists) {
                this.log('✅ Elasticsearch template found');
                
                const templateConfig = fs.readFileSync(elasticsearchTemplatePath, 'utf8');
                const template = JSON.parse(templateConfig);
                
                // Check for proper field mappings
                const hasProperMappings = template.template && 
                                        template.template.mappings && 
                                        template.template.mappings.properties;
                
                if (hasProperMappings) {
                    this.log('✅ Elasticsearch field mappings configured');
                    
                    // Check for specific field types
                    const properties = template.template.mappings.properties;
                    const hasTimestampMapping = properties['@timestamp'] && properties['@timestamp'].type === 'date';
                    const hasLevelMapping = properties.level && properties.level.type === 'keyword';
                    const hasMessageMapping = properties.message && properties.message.type === 'text';
                    
                    this.log(`   Timestamp mapping: ${hasTimestampMapping ? 'Configured' : 'Missing'}`);
                    this.log(`   Log level mapping: ${hasLevelMapping ? 'Configured' : 'Missing'}`);
                    this.log(`   Message mapping: ${hasMessageMapping ? 'Configured' : 'Missing'}`);
                    
                } else {
                    this.log('⚠️  Elasticsearch field mappings not properly configured');
                    this.results.summary.warnings.push('Elasticsearch field mappings not properly configured');
                }
                
            } else {
                this.log('❌ Elasticsearch template not found');
                this.results.summary.errors.push('Elasticsearch template not found');
            }

            // Check application logging configuration
            const loggerUtilPath = path.join(this.projectRoot, 'src/utils/logger.ts');
            if (fs.existsSync(loggerUtilPath)) {
                this.log('✅ Application logger utility found');
                
                const loggerContent = fs.readFileSync(loggerUtilPath, 'utf8');
                
                // Check for log levels
                logAggregationChecks.logLevelsConfigured = loggerContent.includes('level') &&
                                                         (loggerContent.includes('error') || 
                                                          loggerContent.includes('warn') ||
                                                          loggerContent.includes('info'));
                
                // Check for log rotation
                logAggregationChecks.logRotationConfigured = loggerContent.includes('rotation') ||
                                                           loggerContent.includes('maxSize') ||
                                                           loggerContent.includes('maxFiles');
                
                this.log(`   Log levels configured: ${logAggregationChecks.logLevelsConfigured ? 'Yes' : 'No'}`);
                this.log(`   Log rotation configured: ${logAggregationChecks.logRotationConfigured ? 'Yes' : 'No'}`);
                
            } else {
                this.log('⚠️  Application logger utility not found');
                this.results.summary.warnings.push('Application logger utility not found');
            }

            // Check for log retention policy
            const monitoringComposePath = path.join(this.projectRoot, 'monitoring/production-monitoring.yml');
            if (fs.existsSync(monitoringComposePath)) {
                const monitoringConfig = fs.readFileSync(monitoringComposePath, 'utf8');
                logAggregationChecks.logRetentionConfigured = monitoringConfig.includes('retention') ||
                                                            monitoringConfig.includes('max_age') ||
                                                            monitoringConfig.includes('cleanup');
                
                this.log(`   Log retention policy: ${logAggregationChecks.logRetentionConfigured ? 'Configured' : 'Not configured'}`);
            }

            this.results.logAggregation = logAggregationChecks;
            
            // Count checks
            const totalLogChecks = Object.keys(logAggregationChecks).length;
            const passedLogChecks = Object.values(logAggregationChecks).filter(Boolean).length;
            
            this.results.summary.totalChecks += totalLogChecks;
            this.results.summary.passedChecks += passedLogChecks;
            this.results.summary.failedChecks += (totalLogChecks - passedLogChecks);
            
            this.log(`✅ Log aggregation validation completed: ${passedLogChecks}/${totalLogChecks} checks passed`);
            
        } catch (error) {
            this.log(`❌ Log aggregation validation failed: ${error.message}`);
            this.results.summary.errors.push(`Log aggregation validation failed: ${error.message}`);
        }
    }

    async validateUptimeMonitoring() {
        this.log('🔍 Validating Uptime Monitoring and Availability Tracking...');
        
        const uptimeChecks = {
            healthEndpointsConfigured: false,
            livenessProbeConfigured: false,
            readinessProbeConfigured: false,
            uptimeMetricsCollected: false,
            availabilityTrackingEnabled: false,
            serviceDiscoveryConfigured: false,
            loadBalancerHealthChecks: false,
            monitoringAlertsConfigured: false,
            slaMonitoringEnabled: false,
            downtimeTrackingEnabled: false
        };

        try {
            // Check health endpoints
            const healthControllerPath = path.join(this.projectRoot, 'src/controllers/HealthController.ts');
            uptimeChecks.healthEndpointsConfigured = fs.existsSync(healthControllerPath);
            
            if (uptimeChecks.healthEndpointsConfigured) {
                this.log('✅ Health controller found');
                
                const healthControllerContent = fs.readFileSync(healthControllerPath, 'utf8');
                
                // Check for different types of health checks
                uptimeChecks.livenessProbeConfigured = healthControllerContent.includes('liveness') ||
                                                     healthControllerContent.includes('alive');
                
                uptimeChecks.readinessProbeConfigured = healthControllerContent.includes('readiness') ||
                                                      healthControllerContent.includes('ready');
                
                this.log(`   Liveness probe: ${uptimeChecks.livenessProbeConfigured ? 'Configured' : 'Not configured'}`);
                this.log(`   Readiness probe: ${uptimeChecks.readinessProbeConfigured ? 'Configured' : 'Not configured'}`);
                
            } else {
                this.log('❌ Health controller not found');
                this.results.summary.errors.push('Health controller not found');
            }

            // Check health routes
            const healthRoutesPath = path.join(this.projectRoot, 'src/routes/health.ts');
            if (fs.existsSync(healthRoutesPath)) {
                this.log('✅ Health routes found');
                
                const healthRoutesContent = fs.readFileSync(healthRoutesPath, 'utf8');
                
                // Check for comprehensive health endpoints
                const hasBasicHealth = healthRoutesContent.includes('/health');
                const hasDetailedHealth = healthRoutesContent.includes('/health/detailed') ||
                                        healthRoutesContent.includes('/health/status');
                
                this.log(`   Basic health endpoint: ${hasBasicHealth ? 'Available' : 'Missing'}`);
                this.log(`   Detailed health endpoint: ${hasDetailedHealth ? 'Available' : 'Missing'}`);
                
            } else {
                this.log('⚠️  Health routes not found');
                this.results.summary.warnings.push('Health routes not found');
            }

            // Check Prometheus configuration for uptime metrics
            const prometheusConfigPath = path.join(this.projectRoot, 'monitoring/prometheus/prometheus-prod.yml');
            if (fs.existsSync(prometheusConfigPath)) {
                this.log('✅ Prometheus configuration found');
                
                const prometheusConfig = fs.readFileSync(prometheusConfigPath, 'utf8');
                
                // Check for uptime and availability metrics
                uptimeChecks.uptimeMetricsCollected = prometheusConfig.includes('up') ||
                                                    prometheusConfig.includes('uptime') ||
                                                    prometheusConfig.includes('availability');
                
                uptimeChecks.serviceDiscoveryConfigured = prometheusConfig.includes('scrape_configs') &&
                                                        prometheusConfig.includes('targets');
                
                this.log(`   Uptime metrics collection: ${uptimeChecks.uptimeMetricsCollected ? 'Enabled' : 'Disabled'}`);
                this.log(`   Service discovery: ${uptimeChecks.serviceDiscoveryConfigured ? 'Configured' : 'Not configured'}`);
                
            } else {
                this.log('⚠️  Prometheus configuration not found');
                this.results.summary.warnings.push('Prometheus configuration not found');
            }

            // Check Grafana dashboards for uptime monitoring
            const grafanaDashboardsPath = path.join(this.projectRoot, 'monitoring/grafana/dashboards');
            if (fs.existsSync(grafanaDashboardsPath)) {
                this.log('✅ Grafana dashboards directory found');
                
                const dashboardFiles = fs.readdirSync(grafanaDashboardsPath);
                const uptimeDashboards = dashboardFiles.filter(file => 
                    file.includes('uptime') || 
                    file.includes('availability') ||
                    file.includes('health')
                );
                
                uptimeChecks.availabilityTrackingEnabled = uptimeDashboards.length > 0;
                
                this.log(`   Uptime dashboards: ${uptimeDashboards.length} found`);
                this.log(`   Availability tracking: ${uptimeChecks.availabilityTrackingEnabled ? 'Enabled' : 'Disabled'}`);
                
            } else {
                this.log('⚠️  Grafana dashboards directory not found');
                this.results.summary.warnings.push('Grafana dashboards directory not found');
            }

            // Check alerting rules for uptime monitoring
            const alertingRulesPath = path.join(this.projectRoot, 'monitoring/prometheus/rules');
            if (fs.existsSync(alertingRulesPath)) {
                this.log('✅ Prometheus alerting rules directory found');
                
                const ruleFiles = fs.readdirSync(alertingRulesPath);
                const uptimeRules = ruleFiles.filter(file => 
                    file.includes('uptime') || 
                    file.includes('availability') ||
                    file.includes('health')
                );
                
                uptimeChecks.monitoringAlertsConfigured = uptimeRules.length > 0;
                
                this.log(`   Uptime alerting rules: ${uptimeRules.length} found`);
                this.log(`   Monitoring alerts: ${uptimeChecks.monitoringAlertsConfigured ? 'Configured' : 'Not configured'}`);
                
            } else {
                this.log('⚠️  Prometheus alerting rules directory not found');
                this.results.summary.warnings.push('Prometheus alerting rules directory not found');
            }

            // Check Docker health checks
            const dockerComposePath = path.join(this.projectRoot, 'docker/docker-compose.prod.yml');
            if (fs.existsSync(dockerComposePath)) {
                this.log('✅ Docker Compose production configuration found');
                
                const dockerConfig = fs.readFileSync(dockerComposePath, 'utf8');
                
                // Check for health checks in Docker configuration
                uptimeChecks.loadBalancerHealthChecks = dockerConfig.includes('healthcheck') ||
                                                      dockerConfig.includes('health_check');
                
                this.log(`   Docker health checks: ${uptimeChecks.loadBalancerHealthChecks ? 'Configured' : 'Not configured'}`);
                
            } else {
                this.log('⚠️  Docker Compose production configuration not found');
                this.results.summary.warnings.push('Docker Compose production configuration not found');
            }

            // Check for SLA monitoring configuration
            const monitoringServicePath = path.join(this.projectRoot, 'src/services/MonitoringService.ts');
            if (fs.existsSync(monitoringServicePath)) {
                this.log('✅ Monitoring service found');
                
                const monitoringServiceContent = fs.readFileSync(monitoringServicePath, 'utf8');
                
                // Check for SLA and downtime tracking
                uptimeChecks.slaMonitoringEnabled = monitoringServiceContent.includes('sla') ||
                                                  monitoringServiceContent.includes('SLA') ||
                                                  monitoringServiceContent.includes('availability');
                
                uptimeChecks.downtimeTrackingEnabled = monitoringServiceContent.includes('downtime') ||
                                                     monitoringServiceContent.includes('outage') ||
                                                     monitoringServiceContent.includes('incident');
                
                this.log(`   SLA monitoring: ${uptimeChecks.slaMonitoringEnabled ? 'Enabled' : 'Disabled'}`);
                this.log(`   Downtime tracking: ${uptimeChecks.downtimeTrackingEnabled ? 'Enabled' : 'Disabled'}`);
                
            } else {
                this.log('⚠️  Monitoring service not found');
                this.results.summary.warnings.push('Monitoring service not found');
            }

            this.results.uptimeMonitoring = uptimeChecks;
            
            // Count checks
            const totalUptimeChecks = Object.keys(uptimeChecks).length;
            const passedUptimeChecks = Object.values(uptimeChecks).filter(Boolean).length;
            
            this.results.summary.totalChecks += totalUptimeChecks;
            this.results.summary.passedChecks += passedUptimeChecks;
            this.results.summary.failedChecks += (totalUptimeChecks - passedUptimeChecks);
            
            this.log(`✅ Uptime monitoring validation completed: ${passedUptimeChecks}/${totalUptimeChecks} checks passed`);
            
        } catch (error) {
            this.log(`❌ Uptime monitoring validation failed: ${error.message}`);
            this.results.summary.errors.push(`Uptime monitoring validation failed: ${error.message}`);
        }
    }

    async validateBackupSystems() {
        this.log('🔍 Validating Backup Systems...');
        
        const backupChecks = {
            backupScriptExists: false,
            backupScriptExecutable: false,
            backupConfigurationValid: false,
            databaseBackupConfigured: false,
            applicationBackupConfigured: false,
            configurationBackupConfigured: false,
            backupEncryptionEnabled: false,
            backupRetentionConfigured: false,
            cloudBackupConfigured: false,
            backupVerificationEnabled: false,
            backupSchedulingConfigured: false,
            backupMonitoringEnabled: false
        };

        try {
            // Check backup automation script
            const backupScriptPath = path.join(this.projectRoot, 'scripts/backup-automation.sh');
            backupChecks.backupScriptExists = fs.existsSync(backupScriptPath);
            
            if (backupChecks.backupScriptExists) {
                this.log('✅ Backup automation script found');
                
                // Check if script is executable
                try {
                    const stats = fs.statSync(backupScriptPath);
                    backupChecks.backupScriptExecutable = (stats.mode & parseInt('111', 8)) !== 0;
                    
                    this.log(`   Script executable: ${backupChecks.backupScriptExecutable ? 'Yes' : 'No'}`);
                    
                    if (!backupChecks.backupScriptExecutable) {
                        this.log('⚠️  Making backup script executable...');
                        await execAsync(`chmod +x "${backupScriptPath}"`);
                        backupChecks.backupScriptExecutable = true;
                        this.log('✅ Backup script made executable');
                    }
                    
                } catch (error) {
                    this.log(`⚠️  Error checking script permissions: ${error.message}`);
                    this.results.summary.warnings.push(`Error checking backup script permissions: ${error.message}`);
                }
                
                // Analyze backup script content
                const backupScriptContent = fs.readFileSync(backupScriptPath, 'utf8');
                
                // Check for different backup types
                backupChecks.databaseBackupConfigured = backupScriptContent.includes('pg_dump') ||
                                                      backupScriptContent.includes('database_backup');
                
                backupChecks.applicationBackupConfigured = backupScriptContent.includes('application_backup') ||
                                                         backupScriptContent.includes('tar');
                
                backupChecks.configurationBackupConfigured = backupScriptContent.includes('configuration_backup') ||
                                                           backupScriptContent.includes('config');
                
                // Check for backup features
                backupChecks.backupEncryptionEnabled = backupScriptContent.includes('encrypt') ||
                                                     backupScriptContent.includes('openssl');
                
                backupChecks.backupRetentionConfigured = backupScriptContent.includes('RETENTION_DAYS') ||
                                                       backupScriptContent.includes('cleanup');
                
                backupChecks.cloudBackupConfigured = backupScriptContent.includes('aws s3') ||
                                                   backupScriptContent.includes('S3_BUCKET');
                
                backupChecks.backupVerificationEnabled = backupScriptContent.includes('verify_backup') ||
                                                       backupScriptContent.includes('integrity');
                
                backupChecks.backupSchedulingConfigured = backupScriptContent.includes('cron') ||
                                                        backupScriptContent.includes('schedule');
                
                backupChecks.backupMonitoringEnabled = backupScriptContent.includes('health_check') ||
                                                     backupScriptContent.includes('monitoring');
                
                this.log(`   Database backup: ${backupChecks.databaseBackupConfigured ? 'Configured' : 'Not configured'}`);
                this.log(`   Application backup: ${backupChecks.applicationBackupConfigured ? 'Configured' : 'Not configured'}`);
                this.log(`   Configuration backup: ${backupChecks.configurationBackupConfigured ? 'Configured' : 'Not configured'}`);
                this.log(`   Backup encryption: ${backupChecks.backupEncryptionEnabled ? 'Enabled' : 'Disabled'}`);
                this.log(`   Backup retention: ${backupChecks.backupRetentionConfigured ? 'Configured' : 'Not configured'}`);
                this.log(`   Cloud backup: ${backupChecks.cloudBackupConfigured ? 'Configured' : 'Not configured'}`);
                this.log(`   Backup verification: ${backupChecks.backupVerificationEnabled ? 'Enabled' : 'Disabled'}`);
                this.log(`   Backup scheduling: ${backupChecks.backupSchedulingConfigured ? 'Configured' : 'Not configured'}`);
                this.log(`   Backup monitoring: ${backupChecks.backupMonitoringEnabled ? 'Enabled' : 'Disabled'}`);
                
            } else {
                this.log('❌ Backup automation script not found');
                this.results.summary.errors.push('Backup automation script not found');
            }

            // Test backup script configuration
            if (backupChecks.backupScriptExists && backupChecks.backupScriptExecutable) {
                try {
                    this.log('🔄 Testing backup script configuration...');
                    
                    // Test backup script config command
                    const { stdout, stderr } = await execAsync(`"${backupScriptPath}" config`, {
                        timeout: 30000,
                        cwd: this.projectRoot
                    });
                    
                    if (stdout && !stderr) {
                        backupChecks.backupConfigurationValid = true;
                        this.log('✅ Backup script configuration is valid');
                        this.log(`   Configuration output: ${stdout.trim()}`);
                    } else {
                        this.log(`⚠️  Backup script configuration issues: ${stderr}`);
                        this.results.summary.warnings.push(`Backup script configuration issues: ${stderr}`);
                    }
                    
                } catch (error) {
                    this.log(`⚠️  Error testing backup script: ${error.message}`);
                    this.results.summary.warnings.push(`Error testing backup script: ${error.message}`);
                }
            }

            // Check for backup directories and recent backups
            const backupDir = path.join(this.projectRoot, 'backups');
            if (fs.existsSync(backupDir)) {
                this.log('✅ Backup directory found');
                
                try {
                    const backupFiles = fs.readdirSync(backupDir);
                    const recentBackups = backupFiles.filter(file => {
                        const filePath = path.join(backupDir, file);
                        const stats = fs.statSync(filePath);
                        const ageInDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
                        return ageInDays <= 7; // Recent backups within 7 days
                    });
                    
                    this.log(`   Total backup files: ${backupFiles.length}`);
                    this.log(`   Recent backups (7 days): ${recentBackups.length}`);
                    
                    if (recentBackups.length > 0) {
                        this.log('✅ Recent backups found');
                    } else {
                        this.log('⚠️  No recent backups found');
                        this.results.summary.warnings.push('No recent backups found');
                    }
                    
                } catch (error) {
                    this.log(`⚠️  Error checking backup files: ${error.message}`);
                    this.results.summary.warnings.push(`Error checking backup files: ${error.message}`);
                }
                
            } else {
                this.log('⚠️  Backup directory not found');
                this.results.summary.warnings.push('Backup directory not found');
            }

            this.results.backupSystems = backupChecks;
            
            // Count checks
            const totalBackupChecks = Object.keys(backupChecks).length;
            const passedBackupChecks = Object.values(backupChecks).filter(Boolean).length;
            
            this.results.summary.totalChecks += totalBackupChecks;
            this.results.summary.passedChecks += passedBackupChecks;
            this.results.summary.failedChecks += (totalBackupChecks - passedBackupChecks);
            
            this.log(`✅ Backup systems validation completed: ${passedBackupChecks}/${totalBackupChecks} checks passed`);
            
        } catch (error) {
            this.log(`❌ Backup systems validation failed: ${error.message}`);
            this.results.summary.errors.push(`Backup systems validation failed: ${error.message}`);
        }
    }

    generateSummaryReport() {
        this.log('📊 Generating Summary Report...');
        
        // Calculate overall status
        const successRate = (this.results.summary.passedChecks / this.results.summary.totalChecks) * 100;
        
        if (successRate >= 95 && this.results.summary.errors.length === 0) {
            this.results.summary.overallStatus = 'EXCELLENT';
        } else if (successRate >= 85 && this.results.summary.errors.length <= 1) {
            this.results.summary.overallStatus = 'GOOD';
        } else if (successRate >= 70 && this.results.summary.errors.length <= 3) {
            this.results.summary.overallStatus = 'ACCEPTABLE';
        } else {
            this.results.summary.overallStatus = 'NEEDS_IMPROVEMENT';
        }
        
        // Generate detailed report
        const report = {
            ...this.results,
            summary: {
                ...this.results.summary,
                successRate: Math.round(successRate * 100) / 100,
                validationTimestamp: new Date().toISOString(),
                recommendations: this.generateRecommendations()
            }
        };
        
        // Save report to file
        const reportPath = path.join(this.projectRoot, `system-performance-log-validation-report-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        this.log(`📄 Detailed report saved to: ${reportPath}`);
        
        // Display summary
        console.log('\n' + '='.repeat(80));
        console.log('🏁 SYSTEM PERFORMANCE AND LOG VALIDATION SUMMARY');
        console.log('='.repeat(80));
        console.log(`📊 Overall Status: ${this.results.summary.overallStatus}`);
        console.log(`✅ Passed Checks: ${this.results.summary.passedChecks}/${this.results.summary.totalChecks} (${successRate.toFixed(1)}%)`);
        console.log(`❌ Failed Checks: ${this.results.summary.failedChecks}`);
        console.log(`⚠️  Warnings: ${this.results.summary.warnings.length}`);
        console.log(`🚨 Errors: ${this.results.summary.errors.length}`);
        
        if (this.results.summary.errors.length > 0) {
            console.log('\n🚨 Critical Errors:');
            this.results.summary.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        }
        
        if (this.results.summary.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            this.results.summary.warnings.forEach((warning, index) => {
                console.log(`   ${index + 1}. ${warning}`);
            });
        }
        
        console.log('\n📋 Component Status:');
        console.log(`   🔧 Performance Monitoring: ${this.getComponentStatus('performanceMonitoring')}`);
        console.log(`   📝 Log Aggregation: ${this.getComponentStatus('logAggregation')}`);
        console.log(`   ⏱️  Uptime Monitoring: ${this.getComponentStatus('uptimeMonitoring')}`);
        console.log(`   💾 Backup Systems: ${this.getComponentStatus('backupSystems')}`);
        
        console.log('\n' + '='.repeat(80));
        
        return report;
    }

    getComponentStatus(componentName) {
        const component = this.results[componentName];
        if (!component) return 'NOT_TESTED';
        
        const totalChecks = Object.keys(component).length;
        const passedChecks = Object.values(component).filter(Boolean).length;
        const successRate = (passedChecks / totalChecks) * 100;
        
        if (successRate >= 90) return '🟢 EXCELLENT';
        if (successRate >= 75) return '🟡 GOOD';
        if (successRate >= 60) return '🟠 ACCEPTABLE';
        return '🔴 NEEDS_WORK';
    }

    generateRecommendations() {
        const recommendations = [];
        
        // Performance monitoring recommendations
        const perfChecks = this.results.performanceMonitoring;
        if (perfChecks && !perfChecks.systemPerformanceMonitorExists) {
            recommendations.push({
                category: 'Performance Monitoring',
                priority: 'HIGH',
                action: 'Implement SystemPerformanceMonitor service for comprehensive system metrics collection'
            });
        }
        
        if (perfChecks && !perfChecks.alertingConfigured) {
            recommendations.push({
                category: 'Performance Monitoring',
                priority: 'MEDIUM',
                action: 'Configure performance alerting thresholds and notification system'
            });
        }
        
        // Log aggregation recommendations
        const logChecks = this.results.logAggregation;
        if (logChecks && !logChecks.logstashConfigExists) {
            recommendations.push({
                category: 'Log Aggregation',
                priority: 'HIGH',
                action: 'Set up Logstash configuration for centralized log processing'
            });
        }
        
        if (logChecks && !logChecks.logRetentionConfigured) {
            recommendations.push({
                category: 'Log Aggregation',
                priority: 'MEDIUM',
                action: 'Configure log retention policies to manage storage usage'
            });
        }
        
        // Uptime monitoring recommendations
        const uptimeChecks = this.results.uptimeMonitoring;
        if (uptimeChecks && !uptimeChecks.healthEndpointsConfigured) {
            recommendations.push({
                category: 'Uptime Monitoring',
                priority: 'HIGH',
                action: 'Implement comprehensive health endpoints for service monitoring'
            });
        }
        
        if (uptimeChecks && !uptimeChecks.slaMonitoringEnabled) {
            recommendations.push({
                category: 'Uptime Monitoring',
                priority: 'MEDIUM',
                action: 'Enable SLA monitoring and availability tracking'
            });
        }
        
        // Backup system recommendations
        const backupChecks = this.results.backupSystems;
        if (backupChecks && !backupChecks.backupScriptExists) {
            recommendations.push({
                category: 'Backup Systems',
                priority: 'HIGH',
                action: 'Implement automated backup system with proper scheduling'
            });
        }
        
        if (backupChecks && !backupChecks.backupEncryptionEnabled) {
            recommendations.push({
                category: 'Backup Systems',
                priority: 'MEDIUM',
                action: 'Enable backup encryption for enhanced security'
            });
        }
        
        return recommendations;
    }

    async runValidation() {
        try {
            this.log('🚀 Starting System Performance and Log Validation...');
            this.log(`📁 Project Root: ${this.projectRoot}`);
            this.log(`📝 Log File: ${this.logFile}`);
            
            // Run all validation phases
            await this.validateSystemPerformanceMonitoring();
            await this.validateLogAggregation();
            await this.validateUptimeMonitoring();
            await this.validateBackupSystems();
            
            // Generate final report
            const report = this.generateSummaryReport();
            
            this.log('🏁 System Performance and Log Validation completed');
            
            // Return appropriate exit code
            if (this.results.summary.errors.length > 0) {
                process.exit(1);
            } else if (this.results.summary.warnings.length > 5) {
                process.exit(2);
            } else {
                process.exit(0);
            }
            
        } catch (error) {
            this.log(`💥 Validation failed with error: ${error.message}`);
            console.error('Validation failed:', error);
            process.exit(1);
        }
    }
}

// Run validation if called directly
if (require.main === module) {
    const validator = new SystemPerformanceLogValidator();
    validator.runValidation();
}

module.exports = SystemPerformanceLogValidator;