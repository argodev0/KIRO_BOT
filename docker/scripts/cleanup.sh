#!/bin/bash

# Cleanup Script for Trading Bot
# Manages log rotation, temporary files, and system maintenance

set -euo pipefail

# Configuration
LOG_FILE="/app/logs/cleanup.log"
RETENTION_DAYS=${RETENTION_DAYS:-7}
MAX_LOG_SIZE=${MAX_LOG_SIZE:-100M}

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Cleanup application logs
cleanup_logs() {
    log "Cleaning up application logs..."
    
    # Rotate large log files
    find /app/logs -name "*.log" -size +${MAX_LOG_SIZE} -exec logrotate -f {} \; 2>/dev/null || true
    
    # Remove old log files
    find /app/logs -name "*.log.*" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
    
    # Compress old logs
    find /app/logs -name "*.log" -mtime +1 -exec gzip {} \; 2>/dev/null || true
    
    log "Log cleanup completed"
}

# Cleanup temporary files
cleanup_temp_files() {
    log "Cleaning up temporary files..."
    
    # Remove old temporary files
    find /tmp -type f -mtime +1 -delete 2>/dev/null || true
    find /app/tmp -type f -mtime +1 -delete 2>/dev/null || true
    
    # Clean up backup temporary files
    find /backups -name "*.tmp" -mtime +1 -delete 2>/dev/null || true
    
    log "Temporary file cleanup completed"
}

# Cleanup old backup reports
cleanup_backup_reports() {
    log "Cleaning up old backup reports..."
    
    # Remove old backup reports
    find /backups -name "backup_report_*.json" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
    find /backups -name "restore_report_*.json" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
    
    log "Backup report cleanup completed"
}

# System maintenance
system_maintenance() {
    log "Performing system maintenance..."
    
    # Clear package cache (if available)
    if command -v apk >/dev/null 2>&1; then
        apk cache clean 2>/dev/null || true
    fi
    
    # Update file permissions
    chmod -R 755 /app/scripts 2>/dev/null || true
    chown -R backup:backup /backups 2>/dev/null || true
    
    log "System maintenance completed"
}

# Generate cleanup report
generate_report() {
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    
    # Calculate disk usage
    local disk_usage=$(df -h /backups | awk 'NR==2 {print $5}')
    local log_count=$(find /app/logs -name "*.log*" | wc -l)
    local backup_count=$(find /backups -name "*.sql.gz" | wc -l)
    
    cat > "/app/logs/cleanup_report_$(date +%Y%m%d_%H%M%S).json" << EOF
{
    "timestamp": "$timestamp",
    "disk_usage": "$disk_usage",
    "log_files": $log_count,
    "backup_files": $backup_count,
    "retention_days": $RETENTION_DAYS,
    "status": "success"
}
EOF
    
    log "Cleanup report generated"
}

# Main cleanup process
main() {
    log "=== Starting cleanup process ==="
    
    cleanup_logs
    cleanup_temp_files
    cleanup_backup_reports
    system_maintenance
    generate_report
    
    log "=== Cleanup process completed ==="
}

# Run main function
main "$@"