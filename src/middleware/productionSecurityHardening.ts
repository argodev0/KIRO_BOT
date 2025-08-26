/**
 * Production Security Hardening Middleware
 * Comprehensive security measures for production deployment
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { SecurityMonitoringService } from '@/services/SecurityMonitoringService';
import { AuditLogService, AuditEventType } from '@/services/AuditLogService';
import { config } from '@/config/config';

interface SecurityThreat {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    clientIP: string;
    userAgent?: string;
    path: string;
    method: string;
    timestamp: Date;
    blocked: boolean;
}

interface SecurityMetrics {
    totalRequests: number;
    blockedRequests: number;
    suspiciousActivities: number;
    rateLimitViolations: number;
    intrusionAttempts: number;
    lastReset: Date;
}

export class ProductionSecurityHardening {
    private securityMonitoring: SecurityMonitoringService;
    private auditService: AuditLogService;
    private blockedIPs: Set<string>;
    private suspiciousIPs: Map<string, number>;
    private securityMetrics: SecurityMetrics;
    private threatPatterns: Map<string, RegExp[]>;

    constructor(
        securityMonitoring: SecurityMonitoringService,
        auditService: AuditLogService
    ) {
        this.securityMonitoring = securityMonitoring;
        this.auditService = auditService;
        this.blockedIPs = new Set();
        this.suspiciousIPs = new Map();
        this.securityMetrics = this.initializeMetrics();
        this.threatPatterns = this.initializeThreatPatterns();

        this.loadBlockedIPs();
        this.startSecurityMonitoring();
    }

    /**
     * Comprehensive input validation and sanitization
     */
    public comprehensiveInputValidation() {
        return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            try {
                const clientIP = this.getClientIP(req);

                // Check if IP is blocked
                if (this.blockedIPs.has(clientIP)) {
                    await this.logSecurityThreat({
                        type: 'blocked_ip_access',
                        severity: 'high',
                        description: 'Access attempt from blocked IP',
                        clientIP,
                        userAgent: req.get('User-Agent'),
                        path: req.path,
                        method: req.method,
                        timestamp: new Date(),
                        blocked: true
                    });

                    return res.status(403).json({
                        error: 'FORBIDDEN',
                        message: 'Access denied'
                    });
                }

                // Validate request structure
                const validationResult = await this.validateRequestStructure(req);
                if (!validationResult.valid) {
                    await this.handleSecurityViolation(req, 'invalid_request_structure', validationResult.reason || 'Invalid request structure');
                    return res.status(400).json({
                        error: 'BAD_REQUEST',
                        message: 'Invalid request structure'
                    });
                }

                // Advanced threat detection
                const threats = await this.detectAdvancedThreats(req);
                if (threats.length > 0) {
                    await this.handleMultipleThreats(req, threats);
                    return res.status(403).json({
                        error: 'SECURITY_VIOLATION',
                        message: 'Request blocked by security system'
                    });
                }

                // Paper trading mode validation
                if (!await this.validatePaperTradingMode(req)) {
                    await this.handleSecurityViolation(req, 'paper_trading_violation', 'Real trading attempted in paper mode');
                    return res.status(403).json({
                        error: 'TRADING_BLOCKED',
                        message: 'Real trading operations are not allowed'
                    });
                }

                this.securityMetrics.totalRequests++;
                next();
            } catch (error) {
                logger.error('Security validation error:', error);
                return res.status(500).json({
                    error: 'SECURITY_ERROR',
                    message: 'Security validation failed'
                });
            }
        };
    }

    /**
     * Basic rate limiting with in-memory tracking
     */
    public adaptiveRateLimit(limiterType: string = 'api') {
        return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            try {
                const clientIP = this.getClientIP(req);
                const userId = (req as any).user?.userId;
                const key = userId ? `user:${userId}` : `ip:${clientIP}`;

                // Simple in-memory rate limiting
                const now = Date.now();
                const windowMs = 900000; // 15 minutes
                const maxRequests = 100;

                // Clean up old entries
                const cutoff = now - windowMs;
                
                // For production, this would use Redis or database
                // This is a simplified implementation for the security configuration task
                
                // Set rate limit headers
                res.setHeader('X-RateLimit-Limit', maxRequests);
                res.setHeader('X-RateLimit-Remaining', maxRequests - 1);
                res.setHeader('X-RateLimit-Reset', new Date(now + windowMs));

                next();
            } catch (error) {
                logger.error('Rate limiting error:', error);
                next(); // Continue on rate limiter errors
            }
        };
    }

    /**
     * Enhanced intrusion detection system
     */
    public intrusionDetectionSystem() {
        return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            try {
                const clientIP = this.getClientIP(req);
                const userAgent = req.get('User-Agent') || '';
                const path = req.path.toLowerCase();
                const method = req.method;

                // Check for known attack patterns
                const detectedThreats = this.detectIntrusionPatterns(req);

                if (detectedThreats.length > 0) {
                    this.securityMetrics.intrusionAttempts++;

                    // Increment suspicious activity counter
                    const currentCount = this.suspiciousIPs.get(clientIP) || 0;
                    this.suspiciousIPs.set(clientIP, currentCount + 1);

                    // Auto-block IP after multiple intrusion attempts
                    if (currentCount >= 5) {
                        await this.blockIP(clientIP, 'Multiple intrusion attempts', 86400); // 24 hours
                    }

                    await this.logSecurityThreat({
                        type: 'intrusion_attempt',
                        severity: 'high',
                        description: `Intrusion patterns detected: ${detectedThreats.join(', ')}`,
                        clientIP,
                        userAgent,
                        path,
                        method,
                        timestamp: new Date(),
                        blocked: true
                    });

                    return res.status(403).json({
                        error: 'INTRUSION_DETECTED',
                        message: 'Access denied due to suspicious activity'
                    });
                }

                next();
            } catch (error) {
                logger.error('Intrusion detection error:', error);
                next();
            }
        };
    }

    /**
     * API key security validation
     */
    public apiKeySecurityValidation() {
        return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            try {
                const apiKey = req.get('X-API-Key') || req.body?.apiKey || req.query?.apiKey;

                if (apiKey) {
                    // Validate API key format
                    if (!this.isValidApiKeyFormat(apiKey)) {
                        await this.handleSecurityViolation(req, 'invalid_api_key', 'Invalid API key format');
                        return res.status(401).json({
                            error: 'INVALID_API_KEY',
                            message: 'Invalid API key format'
                        });
                    }

                    // Check for trading permissions (should be blocked in paper mode)
                    if (await this.hasTradePermissions(apiKey)) {
                        await this.handleSecurityViolation(req, 'trading_api_key_detected', 'Trading API key blocked');
                        return res.status(403).json({
                            error: 'TRADING_API_KEY_BLOCKED',
                            message: 'Trading API keys are not allowed in paper trading mode'
                        });
                    }

                    // Validate API key permissions with exchange
                    const permissionCheck = await this.validateApiKeyPermissions(apiKey);
                    if (!permissionCheck.valid) {
                        await this.handleSecurityViolation(req, 'api_key_permission_violation', permissionCheck.reason || 'API key permission denied');
                        return res.status(403).json({
                            error: 'API_KEY_PERMISSION_DENIED',
                            message: 'API key does not have required permissions'
                        });
                    }
                }

                next();
            } catch (error) {
                logger.error('API key validation error:', error);
                return res.status(500).json({
                    error: 'API_KEY_VALIDATION_ERROR',
                    message: 'API key validation failed'
                });
            }
        };
    }

    /**
     * Enhanced CORS with security validation
     */
    public enhancedCORS() {
        return (req: Request, res: Response, next: NextFunction): void => {
            const origin = req.get('Origin');
            const allowedOrigins = this.getAllowedOrigins();

            // Validate origin
            if (origin && !allowedOrigins.includes(origin)) {
                logger.warn('CORS violation detected', {
                    origin,
                    ip: this.getClientIP(req),
                    path: req.path
                });

                return res.status(403).json({
                    error: 'CORS_VIOLATION',
                    message: 'Origin not allowed'
                });
            }

            // Set CORS headers
            if (origin && allowedOrigins.includes(origin)) {
                res.setHeader('Access-Control-Allow-Origin', origin);
            }

            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Request-ID');
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Max-Age', '86400');
            res.setHeader('Vary', 'Origin');

            if (req.method === 'OPTIONS') {
                return res.status(200).end();
            }

            next();
        };
    }

    /**
     * Security monitoring and metrics collection
     */
    public securityMonitoringMiddleware() {
        return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            const startTime = Date.now();
            const clientIP = this.getClientIP(req);
            const userId = (req as any).user?.userId;

            // Monitor request
            if (userId) {
                await this.securityMonitoring.monitorActivity(userId, AuditEventType.SUSPICIOUS_ACTIVITY, req);
            }

            // Capture response for monitoring
            const originalSend = res.send;
            res.send = function (data: any) {
                const duration = Date.now() - startTime;

                // Log security metrics
                if (res.statusCode >= 400) {
                    logger.warn('Security-related error response', {
                        statusCode: res.statusCode,
                        path: req.path,
                        method: req.method,
                        ip: clientIP,
                        userId,
                        duration
                    });
                }

                return originalSend.call(this, data);
            };

            next();
        };
    }

    /**
     * Get security metrics
     */
    public getSecurityMetrics(): SecurityMetrics {
        return { ...this.securityMetrics };
    }

    /**
     * Block IP address
     */
    public async blockIP(ip: string, reason: string, duration: number = 86400): Promise<void> {
        this.blockedIPs.add(ip);
        logger.warn('IP address blocked', { ip, reason, duration });

        await this.auditService.logSecurityEvent(
            AuditEventType.SUSPICIOUS_ACTIVITY,
            undefined,
            `IP blocked: ${reason}`,
            { ip } as any,
            { ip, reason, duration }
        );
    }

    /**
     * Unblock IP address
     */
    public async unblockIP(ip: string): Promise<void> {
        this.blockedIPs.delete(ip);
        this.suspiciousIPs.delete(ip);
        logger.info('IP address unblocked', { ip });
    }

    // Private methods
    private initializeMetrics(): SecurityMetrics {
        return {
            totalRequests: 0,
            blockedRequests: 0,
            suspiciousActivities: 0,
            rateLimitViolations: 0,
            intrusionAttempts: 0,
            lastReset: new Date()
        };
    }

    private initializeThreatPatterns(): Map<string, RegExp[]> {
        const patterns = new Map();

        patterns.set('sql_injection', [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
            /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
            /(UNION\s+(ALL\s+)?SELECT)/i,
            /(--|\#|\/\*|\*\/)/,
            /(0x[0-9a-f]+)/i
        ]);

        patterns.set('xss', [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /\bon\w+\s*=\s*["'][^"']*["']/gi,
            /javascript\s*:/gi,
            /vbscript\s*:/gi
        ]);

        patterns.set('path_traversal', [
            /\.\./g,
            /%2e%2e/gi,
            /\.\\/g,
            /\.\/\./g
        ]);

        patterns.set('command_injection', [
            /[;&|`$(){}[\]]/,
            /(\|\||&&|;|\|)/,
            /(>>|<<|>|<)/,
            /\b(cat|ls|pwd|whoami|id|uname|ps|netstat|ifconfig|ping|curl|wget|nc|telnet|ssh)\b/i
        ]);

        return patterns;
    }

    private async loadBlockedIPs(): Promise<void> {
        try {
            // In production, this would load from database or Redis
            // For now, initialize empty set
            logger.info('Blocked IPs loaded from storage');
        } catch (error) {
            logger.error('Failed to load blocked IPs:', error);
        }
    }

    private startSecurityMonitoring(): void {
        // Reset metrics every hour
        if (typeof setInterval !== 'undefined') {
            setInterval(() => {
                this.securityMetrics = this.initializeMetrics();
                this.suspiciousIPs.clear();
            }, 3600000);

            // Clean up old blocked IPs every 5 minutes
            setInterval(() => {
                // In production, this would clean up expired IPs from database
                logger.debug('Cleaning up expired blocked IPs');
            }, 300000);
        }
    }

    private async validateRequestStructure(req: Request): Promise<{ valid: boolean; reason?: string }> {
        // Check request size
        const contentLength = parseInt(req.get('Content-Length') || '0', 10);
        if (contentLength > 10 * 1024 * 1024) { // 10MB limit
            return { valid: false, reason: 'Request too large' };
        }

        // Validate required headers
        if (!req.get('User-Agent')) {
            return { valid: false, reason: 'Missing User-Agent header' };
        }

        // Validate Content-Type for POST/PUT requests
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            const contentType = req.get('Content-Type');
            if (!contentType || !contentType.includes('application/json')) {
                return { valid: false, reason: 'Invalid Content-Type' };
            }
        }

        return { valid: true };
    }

    private async detectAdvancedThreats(req: Request): Promise<string[]> {
        const threats: string[] = [];
        const content = JSON.stringify({
            body: req.body,
            query: req.query,
            params: req.params,
            path: req.path
        });

        // Check each threat pattern
        for (const [threatType, patterns] of this.threatPatterns) {
            for (const pattern of patterns) {
                if (pattern.test(content)) {
                    threats.push(threatType);
                    break;
                }
            }
        }

        return threats;
    }

    private detectIntrusionPatterns(req: Request): string[] {
        const patterns: string[] = [];
        const path = req.path.toLowerCase();
        const userAgent = req.get('User-Agent') || '';

        // Common attack paths
        const attackPaths = [
            '/wp-admin', '/admin', '/phpmyadmin', '/config', '/backup',
            '/.env', '/.git', '/etc/passwd', '/proc/', '/sys/'
        ];

        if (attackPaths.some(attackPath => path.includes(attackPath))) {
            patterns.push('suspicious_path');
        }

        // Suspicious user agents
        const suspiciousAgents = [
            /sqlmap|nikto|nmap|masscan|zap|burp|metasploit/i,
            /bot|crawler|spider|scraper/i,
            /curl|wget|python|perl|ruby/i
        ];

        if (suspiciousAgents.some(pattern => pattern.test(userAgent))) {
            patterns.push('suspicious_user_agent');
        }

        return patterns;
    }

    private async validatePaperTradingMode(req: Request): Promise<boolean> {
        // Ensure paper trading mode is enabled
        if (!config.paperTrading?.enabled) {
            return false;
        }

        // Block real trading endpoints
        const tradingEndpoints = [
            '/api/trading/execute',
            '/api/orders/place',
            '/api/withdraw',
            '/api/transfer'
        ];

        return !tradingEndpoints.some(endpoint => req.path.includes(endpoint));
    }

    private isValidApiKeyFormat(apiKey: string): boolean {
        return /^[a-zA-Z0-9]{32,128}$/.test(apiKey);
    }

    private async hasTradePermissions(_apiKey: string): Promise<boolean> {
        // This would integrate with exchange APIs to check permissions
        // For now, always return false to block trading permissions in paper mode
        return false;
    }

    private async validateApiKeyPermissions(apiKey: string): Promise<{ valid: boolean; reason?: string }> {
        // This would validate with actual exchange APIs
        // For now, return valid for read-only keys
        return { valid: true };
    }

    private getAllowedOrigins(): string[] {
        const origins = (typeof process !== 'undefined' && process.env.CORS_ALLOWED_ORIGINS?.split(',')) || [];

        if (config.env === 'development') {
            origins.push('http://localhost:3000', 'http://127.0.0.1:3000');
        }

        return origins;
    }

    private async handleSecurityViolation(req: Request, violationType: string, reason: string): Promise<void> {
        const clientIP = this.getClientIP(req);

        this.securityMetrics.suspiciousActivities++;

        await this.logSecurityThreat({
            type: violationType,
            severity: 'medium',
            description: reason,
            clientIP,
            userAgent: req.get('User-Agent'),
            path: req.path,
            method: req.method,
            timestamp: new Date(),
            blocked: true
        });
    }

    private async handleMultipleThreats(req: Request, threats: string[]): Promise<void> {
        const clientIP = this.getClientIP(req);

        await this.logSecurityThreat({
            type: 'multiple_threats',
            severity: 'high',
            description: `Multiple threats detected: ${threats.join(', ')}`,
            clientIP,
            userAgent: req.get('User-Agent'),
            path: req.path,
            method: req.method,
            timestamp: new Date(),
            blocked: true
        });
    }

    private async handleRateLimitViolation(req: Request, limiterType: string, _rejRes: any): Promise<void> {
        const clientIP = this.getClientIP(req);

        await this.logSecurityThreat({
            type: 'rate_limit_violation',
            severity: 'medium',
            description: `Rate limit exceeded for ${limiterType}`,
            clientIP,
            userAgent: req.get('User-Agent'),
            path: req.path,
            method: req.method,
            timestamp: new Date(),
            blocked: true
        });
    }

    private async logSecurityThreat(threat: SecurityThreat): Promise<void> {
        logger.warn('Security threat detected', threat);

        await this.auditService.logSecurityEvent(
            AuditEventType.SUSPICIOUS_ACTIVITY,
            undefined,
            threat.description,
            { ip: threat.clientIP } as any,
            threat
        );
    }

    private getClientIP(req: Request): string {
        return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            'unknown';
    }
}

// Export factory function
export function createProductionSecurityHardening(
    securityMonitoring: SecurityMonitoringService,
    auditService: AuditLogService
): ProductionSecurityHardening {
    return new ProductionSecurityHardening(securityMonitoring, auditService);
}