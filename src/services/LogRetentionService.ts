import * as fs from 'fs';
import * as path from 'path';
import * as cron from 'node-cron';
import { logger } from '@/utils/logger';
import { auditLogService } from './AuditLogService';

export interface RetentionPolicy {
  logType: string;
  retentionDays: number;
  compressionEnabled: boolean;
  archiveLocation?: string;
}

export interface CleanupResult {
  filesProcessed: number;
  filesDeleted: number;
  filesArchived: number;
  bytesFreed: number;
  errors: string[];
}

export class LogRetentionService {
  private static instance: LogRetentionService;
  private retentionPolicies: Map<string, RetentionPolicy> = new Map();
  private cleanupScheduled = false;

  public static getInstance(): LogRetentionService {
    if (!LogRetentionService.instance) {
      LogRetentionService.instance = new LogRetentionService();
    }
    return LogRetentionService.instance;
  }

  constructor() {
    this.initializeDefaultPolicies();
  }

  /**
   * Initialize default retention policies
   */
  private initializeDefaultPolicies(): void {
    // Application logs - keep for 30 days
    this.retentionPolicies.set('application', {
      logType: 'application',
      retentionDays: 30,
      compressionEnabled: true,
      archiveLocation: 'logs/archive/application'
    });

    // Error logs - keep for 90 days
    this.retentionPolicies.set('error', {
      logType: 'error',
      retentionDays: 90,
      compressionEnabled: true,
      archiveLocation: 'logs/archive/errors'
    });

    // Security logs - keep for 180 days (compliance requirement)
    this.retentionPolicies.set('security', {
      logType: 'security',
      retentionDays: 180,
      compressionEnabled: true,
      archiveLocation: 'logs/archive/security'
    });

    // Trading logs - keep for 365 days (audit requirement)
    this.retentionPolicies.set('trading', {
      logType: 'trading',
      retentionDays: 365,
      compressionEnabled: true,
      archiveLocation: 'logs/archive/trading'
    });

    // Performance logs - keep for 60 days
    this.retentionPolicies.set('performance', {
      logType: 'performance',
      retentionDays: 60,
      compressionEnabled: true,
      archiveLocation: 'logs/archive/performance'
    });

    // Audit logs - keep for 2 years (compliance requirement)
    this.retentionPolicies.set('audit', {
      logType: 'audit',
      retentionDays: 730,
      compressionEnabled: true,
      archiveLocation: 'logs/archive/audit'
    });

    // Debug logs - keep for 7 days
    this.retentionPolicies.set('debug', {
      logType: 'debug',
      retentionDays: 7,
      compressionEnabled: false
    });
  }

  /**
   * Add or update a retention policy
   */
  public setRetentionPolicy(policy: RetentionPolicy): void {
    this.retentionPolicies.set(policy.logType, policy);
    logger.info('Retention policy updated', { 
      logType: policy.logType, 
      retentionDays: policy.retentionDays 
    });
  }

  /**
   * Get retention policy for a log type
   */
  public getRetentionPolicy(logType: string): RetentionPolicy | undefined {
    return this.retentionPolicies.get(logType);
  }

  /**
   * Schedule automatic log cleanup
   */
  public scheduleCleanup(cronExpression: string = '0 2 * * *'): void { // Daily at 2 AM
    if (this.cleanupScheduled) {
      logger.warn('Log cleanup already scheduled');
      return;
    }

    cron.schedule(cronExpression, async () => {
      logger.info('Starting scheduled log cleanup');
      
      auditLogService.logDataRetentionEvent(
        'cleanup_started',
        'all_logs',
        0,
        true,
        'Scheduled cleanup initiated'
      );

      try {
        const results = await this.performCleanup();
        
        logger.info('Scheduled log cleanup completed', { results });
        
        auditLogService.logDataRetentionEvent(
          'cleanup_completed',
          'all_logs',
          results.filesDeleted + results.filesArchived,
          true,
          `Processed ${results.filesProcessed} files, freed ${results.bytesFreed} bytes`
        );
      } catch (error) {
        logger.error('Scheduled log cleanup failed', { error: error.message });
        
        auditLogService.logDataRetentionEvent(
          'cleanup_completed',
          'all_logs',
          0,
          false,
          `Cleanup failed: ${error.message}`
        );
      }
    });

    this.cleanupScheduled = true;
    logger.info('Log cleanup scheduled', { cronExpression });
  }

  /**
   * Perform log cleanup based on retention policies
   */
  public async performCleanup(): Promise<CleanupResult> {
    const result: CleanupResult = {
      filesProcessed: 0,
      filesDeleted: 0,
      filesArchived: 0,
      bytesFreed: 0,
      errors: []
    };

    const logsDirectory = path.resolve('logs');
    
    if (!fs.existsSync(logsDirectory)) {
      logger.warn('Logs directory does not exist', { directory: logsDirectory });
      return result;
    }

    try {
      const files = fs.readdirSync(logsDirectory);
      
      for (const file of files) {
        const filePath = path.join(logsDirectory, file);
        const stats = fs.statSync(filePath);
        
        if (!stats.isFile()) {
          continue;
        }

        result.filesProcessed++;
        
        try {
          const logType = this.determineLogType(file);
          const policy = this.retentionPolicies.get(logType);
          
          if (!policy) {
            logger.debug('No retention policy found for log type', { file, logType });
            continue;
          }

          const fileAge = this.getFileAgeDays(stats.mtime);
          
          if (fileAge > policy.retentionDays) {
            if (policy.compressionEnabled && policy.archiveLocation) {
              // Archive the file
              await this.archiveFile(filePath, policy.archiveLocation);
              result.filesArchived++;
              logger.info('Log file archived', { file, age: fileAge, policy: logType });
            } else {
              // Delete the file
              const fileSize = stats.size;
              fs.unlinkSync(filePath);
              result.filesDeleted++;
              result.bytesFreed += fileSize;
              logger.info('Log file deleted', { file, age: fileAge, size: fileSize });
            }
          }
        } catch (error) {
          const errorMsg = `Failed to process file ${file}: ${error.message}`;
          result.errors.push(errorMsg);
          logger.error('Log cleanup error', { file, error: error.message });
        }
      }

      // Clean up empty archive directories
      await this.cleanupEmptyDirectories();
      
    } catch (error) {
      const errorMsg = `Failed to read logs directory: ${error.message}`;
      result.errors.push(errorMsg);
      logger.error('Log cleanup directory error', { error: error.message });
    }

    return result;
  }

  /**
   * Archive a log file
   */
  private async archiveFile(filePath: string, archiveLocation: string): Promise<void> {
    const archiveDir = path.resolve(archiveLocation);
    
    // Create archive directory if it doesn't exist
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    const fileName = path.basename(filePath);
    const archivePath = path.join(archiveDir, fileName);
    
    // Move file to archive location
    fs.renameSync(filePath, archivePath);
    
    // Compress if needed (simple gzip)
    if (archivePath.endsWith('.log')) {
      await this.compressFile(archivePath);
    }
  }

  /**
   * Compress a log file using gzip
   */
  private async compressFile(filePath: string): Promise<void> {
    const zlib = require('zlib');
    const { pipeline } = require('stream');
    const { promisify } = require('util');
    const pipelineAsync = promisify(pipeline);

    const gzipPath = `${filePath}.gz`;
    
    try {
      await pipelineAsync(
        fs.createReadStream(filePath),
        zlib.createGzip(),
        fs.createWriteStream(gzipPath)
      );
      
      // Remove original file after compression
      fs.unlinkSync(filePath);
      
      logger.debug('Log file compressed', { original: filePath, compressed: gzipPath });
    } catch (error) {
      logger.error('Failed to compress log file', { file: filePath, error: error.message });
      throw error;
    }
  }

  /**
   * Determine log type from filename
   */
  private determineLogType(filename: string): string {
    const lowerFilename = filename.toLowerCase();
    
    if (lowerFilename.includes('error')) return 'error';
    if (lowerFilename.includes('security')) return 'security';
    if (lowerFilename.includes('trading')) return 'trading';
    if (lowerFilename.includes('performance')) return 'performance';
    if (lowerFilename.includes('audit')) return 'audit';
    if (lowerFilename.includes('debug')) return 'debug';
    
    return 'application';
  }

  /**
   * Get file age in days
   */
  private getFileAgeDays(modifiedTime: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - modifiedTime.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Clean up empty archive directories
   */
  private async cleanupEmptyDirectories(): Promise<void> {
    const archiveBase = path.resolve('logs/archive');
    
    if (!fs.existsSync(archiveBase)) {
      return;
    }

    try {
      const dirs = fs.readdirSync(archiveBase);
      
      for (const dir of dirs) {
        const dirPath = path.join(archiveBase, dir);
        const stats = fs.statSync(dirPath);
        
        if (stats.isDirectory()) {
          const files = fs.readdirSync(dirPath);
          
          if (files.length === 0) {
            fs.rmdirSync(dirPath);
            logger.debug('Removed empty archive directory', { directory: dirPath });
          }
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup empty directories', { error: error.message });
    }
  }

  /**
   * Get cleanup statistics
   */
  public async getCleanupStatistics(): Promise<{
    totalLogFiles: number;
    totalLogSize: number;
    oldestLogDate: Date | null;
    newestLogDate: Date | null;
    logTypeBreakdown: Record<string, { count: number; size: number }>;
  }> {
    const stats = {
      totalLogFiles: 0,
      totalLogSize: 0,
      oldestLogDate: null as Date | null,
      newestLogDate: null as Date | null,
      logTypeBreakdown: {} as Record<string, { count: number; size: number }>
    };

    const logsDirectory = path.resolve('logs');
    
    if (!fs.existsSync(logsDirectory)) {
      return stats;
    }

    try {
      const files = fs.readdirSync(logsDirectory);
      
      for (const file of files) {
        const filePath = path.join(logsDirectory, file);
        const fileStats = fs.statSync(filePath);
        
        if (!fileStats.isFile()) {
          continue;
        }

        stats.totalLogFiles++;
        stats.totalLogSize += fileStats.size;
        
        if (!stats.oldestLogDate || fileStats.mtime < stats.oldestLogDate) {
          stats.oldestLogDate = fileStats.mtime;
        }
        
        if (!stats.newestLogDate || fileStats.mtime > stats.newestLogDate) {
          stats.newestLogDate = fileStats.mtime;
        }

        const logType = this.determineLogType(file);
        if (!stats.logTypeBreakdown[logType]) {
          stats.logTypeBreakdown[logType] = { count: 0, size: 0 };
        }
        
        stats.logTypeBreakdown[logType].count++;
        stats.logTypeBreakdown[logType].size += fileStats.size;
      }
    } catch (error) {
      logger.error('Failed to get cleanup statistics', { error: error.message });
    }

    return stats;
  }

  /**
   * Force cleanup for a specific log type
   */
  public async forceCleanup(logType: string): Promise<CleanupResult> {
    const policy = this.retentionPolicies.get(logType);
    
    if (!policy) {
      throw new Error(`No retention policy found for log type: ${logType}`);
    }

    logger.info('Starting forced cleanup', { logType });
    
    auditLogService.logDataRetentionEvent(
      'cleanup_started',
      logType,
      0,
      true,
      `Forced cleanup initiated for ${logType}`
    );

    const result = await this.performCleanup();
    
    auditLogService.logDataRetentionEvent(
      'cleanup_completed',
      logType,
      result.filesDeleted + result.filesArchived,
      result.errors.length === 0,
      result.errors.length > 0 ? result.errors.join('; ') : 'Cleanup completed successfully'
    );

    return result;
  }
}

// Export singleton instance
export const logRetentionService = LogRetentionService.getInstance();