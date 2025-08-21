#!/bin/bash

# Database Backup Script for Trading Bot
# Performs automated backups with compression and cloud storage

set -euo pipefail

# Configuration
BACKUP_DIR="/backups"
LOG_FILE="/app/logs/backup.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="trading_bot_backup_${TIMESTAMP}"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

# Database connection
POSTGRES_HOST=${POSTGRES_HOST:-postgres}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_DB=${POSTGRES_DB:-trading_bot}
POSTGRES_USER=${POSTGRES_USER:-postgres}

# AWS S3 configuration
AWS_S3_BUCKET=${AWS_S3_BUCKET:-""}
AWS_REGION=${AWS_REGION:-"us-east-1"}

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Health check function
health_check() {
    touch /tmp/backup-healthy
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up backups older than ${RETENTION_DAYS} days..."
    
    # Local cleanup
    find "$BACKUP_DIR" -name "trading_bot_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
    
    # S3 cleanup if configured
    if [[ -n "$AWS_S3_BUCKET" ]]; then
        aws s3 ls "s3://${AWS_S3_BUCKET}/backups/" --recursive | \
        awk '{print $4}' | \
        while read -r file; do
            if [[ "$file" =~ trading_bot_backup_[0-9]{8}_[0-9]{6}\.sql\.gz$ ]]; then
                file_date=$(echo "$file" | grep -o '[0-9]\{8\}' | head -1)
                if [[ -n "$file_date" ]]; then
                    file_timestamp=$(date -d "$file_date" +%s)
                    cutoff_timestamp=$(date -d "${RETENTION_DAYS} days ago" +%s)
                    
                    if [[ $file_timestamp -lt $cutoff_timestamp ]]; then
                        log "Deleting old S3 backup: $file"
                        aws s3 rm "s3://${AWS_S3_BUCKET}/$file"
                    fi
                fi
            fi
        done
    fi
    
    log "Cleanup completed"
}

# Verify database connection
verify_connection() {
    log "Verifying database connection..."
    
    if ! pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB"; then
        error_exit "Cannot connect to PostgreSQL database"
    fi
    
    log "Database connection verified"
}

# Create backup
create_backup() {
    log "Starting database backup: $BACKUP_NAME"
    
    local backup_file="${BACKUP_DIR}/${BACKUP_NAME}.sql"
    local compressed_file="${backup_file}.gz"
    
    # Create backup directory if it doesn't exist
    mkdir -p "$BACKUP_DIR"
    
    # Perform database dump
    if ! PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        --verbose \
        --no-owner \
        --no-privileges \
        --format=custom \
        --compress=9 \
        --file="$backup_file"; then
        error_exit "Database backup failed"
    fi
    
    # Compress backup
    log "Compressing backup..."
    if ! gzip -9 "$backup_file"; then
        error_exit "Backup compression failed"
    fi
    
    # Verify backup integrity
    log "Verifying backup integrity..."
    if ! gzip -t "$compressed_file"; then
        error_exit "Backup file is corrupted"
    fi
    
    # Get backup size
    local backup_size=$(du -h "$compressed_file" | cut -f1)
    log "Backup created successfully: ${compressed_file} (${backup_size})"
    
    echo "$compressed_file"
}

# Upload to S3
upload_to_s3() {
    local backup_file="$1"
    
    if [[ -z "$AWS_S3_BUCKET" ]]; then
        log "S3 bucket not configured, skipping cloud upload"
        return 0
    fi
    
    log "Uploading backup to S3..."
    
    local s3_key="backups/$(basename "$backup_file")"
    
    if ! aws s3 cp "$backup_file" "s3://${AWS_S3_BUCKET}/${s3_key}" \
        --region "$AWS_REGION" \
        --storage-class STANDARD_IA \
        --metadata "backup-date=$(date -u +%Y-%m-%dT%H:%M:%SZ),database=${POSTGRES_DB}"; then
        error_exit "S3 upload failed"
    fi
    
    log "Backup uploaded to S3: s3://${AWS_S3_BUCKET}/${s3_key}"
}

# Generate backup report
generate_report() {
    local backup_file="$1"
    local backup_size=$(du -h "$backup_file" | cut -f1)
    local backup_count=$(find "$BACKUP_DIR" -name "trading_bot_backup_*.sql.gz" | wc -l)
    
    cat > "${BACKUP_DIR}/backup_report_${TIMESTAMP}.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "backup_name": "$(basename "$backup_file")",
    "backup_size": "$backup_size",
    "backup_path": "$backup_file",
    "database": "$POSTGRES_DB",
    "host": "$POSTGRES_HOST",
    "total_backups": $backup_count,
    "retention_days": $RETENTION_DAYS,
    "s3_bucket": "$AWS_S3_BUCKET",
    "status": "success"
}
EOF
    
    log "Backup report generated: backup_report_${TIMESTAMP}.json"
}

# Main backup process
main() {
    log "=== Starting backup process ==="
    
    # Set health check
    health_check
    
    # Verify prerequisites
    verify_connection
    
    # Cleanup old backups first
    cleanup_old_backups
    
    # Create new backup
    local backup_file
    backup_file=$(create_backup)
    
    # Upload to cloud storage
    upload_to_s3 "$backup_file"
    
    # Generate report
    generate_report "$backup_file"
    
    log "=== Backup process completed successfully ==="
    
    # Update health check
    health_check
}

# Run main function
main "$@"