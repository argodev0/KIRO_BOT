#!/bin/bash

# Backup Automation Script
# Comprehensive backup solution with scheduling, retention, and cloud storage

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups"
LOG_FILE="$PROJECT_ROOT/logs/backup_$(date +%Y%m%d_%H%M%S).log"
CONFIG_FILE="$PROJECT_ROOT/.backup_config"

# Create directories
mkdir -p "$BACKUP_DIR" "$PROJECT_ROOT/logs"

# Default configuration
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
BACKUP_SCHEDULE=${BACKUP_SCHEDULE:-"0 2 * * *"}
COMPRESSION_LEVEL=${COMPRESSION_LEVEL:-9}
PARALLEL_JOBS=${PARALLEL_JOBS:-2}

# Database connection
POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_DB=${POSTGRES_DB:-trading_bot}
POSTGRES_USER=${POSTGRES_USER:-postgres}

# Cloud storage configuration
AWS_S3_BUCKET=${AWS_S3_BUCKET:-""}
AWS_REGION=${AWS_REGION:-"us-east-1"}
BACKUP_ENCRYPTION=${BACKUP_ENCRYPTION:-"true"}
ENCRYPTION_KEY=${BACKUP_ENCRYPTION_KEY:-""}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Logging functions
log_info() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1"
    echo -e "${BLUE}ℹ️  $1${NC}"
    echo "$msg" >> "$LOG_FILE"
}

log_success() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: $1"
    echo -e "${GREEN}✅ $1${NC}"
    echo "$msg" >> "$LOG_FILE"
}

log_warning() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1"
    echo -e "${YELLOW}⚠️  $1${NC}"
    echo "$msg" >> "$LOG_FILE"
}

log_error() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1"
    echo -e "${RED}❌ $1${NC}"
    echo "$msg" >> "$LOG_FILE"
}

log_step() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] STEP: $1"
    echo -e "${PURPLE}🔄 $1${NC}"
    echo "$msg" >> "$LOG_FILE"
}

# Health check function
health_check() {
    touch /tmp/backup-healthy
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > /tmp/backup-last-run
}

# Load backup configuration
load_config() {
    if [ -f "$CONFIG_FILE" ]; then
        source "$CONFIG_FILE"
        log_info "Loaded backup configuration from $CONFIG_FILE"
    else
        log_info "Using default backup configuration"
    fi
}

# Save backup configuration
save_config() {
    cat > "$CONFIG_FILE" << EOF
# Backup Configuration
RETENTION_DAYS=$RETENTION_DAYS
BACKUP_SCHEDULE="$BACKUP_SCHEDULE"
COMPRESSION_LEVEL=$COMPRESSION_LEVEL
PARALLEL_JOBS=$PARALLEL_JOBS
AWS_S3_BUCKET="$AWS_S3_BUCKET"
AWS_REGION="$AWS_REGION"
BACKUP_ENCRYPTION="$BACKUP_ENCRYPTION"
LAST_BACKUP_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
EOF
    log_success "Backup configuration saved"
}

# Verify prerequisites
verify_prerequisites() {
    log_step "Verifying backup prerequisites"
    
    local errors=0
    
    # Check required commands
    local required_commands=("pg_dump" "gzip" "tar" "find")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "Required command not found: $cmd"
            errors=$((errors + 1))
        fi
    done
    
    # Check database connectivity
    if ! PGPASSWORD="$POSTGRES_PASSWORD" pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB"; then
        log_error "Cannot connect to PostgreSQL database"
        errors=$((errors + 1))
    fi
    
    # Check AWS CLI if S3 backup is configured
    if [ -n "$AWS_S3_BUCKET" ]; then
        if ! command -v "aws" &> /dev/null; then
            log_error "AWS CLI not found but S3 backup is configured"
            errors=$((errors + 1))
        else
            # Test AWS credentials
            if ! aws sts get-caller-identity &> /dev/null; then
                log_error "AWS credentials not configured properly"
                errors=$((errors + 1))
            fi
        fi
    fi
    
    # Check encryption tools if encryption is enabled
    if [ "$BACKUP_ENCRYPTION" = "true" ]; then
        if ! command -v "openssl" &> /dev/null; then
            log_error "OpenSSL not found but encryption is enabled"
            errors=$((errors + 1))
        fi
        
        if [ -z "$ENCRYPTION_KEY" ]; then
            log_error "Encryption key not provided"
            errors=$((errors + 1))
        fi
    fi
    
    if [ $errors -eq 0 ]; then
        log_success "Prerequisites verification passed"
        return 0
    else
        log_error "Prerequisites verification failed with $errors errors"
        return 1
    fi
}

# Create database backup
create_database_backup() {
    local timestamp="$1"
    local backup_name="database_backup_${timestamp}"
    local backup_file="$BACKUP_DIR/${backup_name}.sql"
    
    log_step "Creating database backup: $backup_name"
    
    # Create database dump
    if PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        --verbose \
        --no-owner \
        --no-privileges \
        --format=custom \
        --compress="$COMPRESSION_LEVEL" \
        --file="$backup_file" 2>> "$LOG_FILE"; then
        
        log_success "Database backup created: $backup_file"
        
        # Get backup size
        local backup_size
        backup_size=$(du -h "$backup_file" | cut -f1)
        log_info "Database backup size: $backup_size"
        
        echo "$backup_file"
        return 0
    else
        log_error "Database backup failed"
        return 1
    fi
}

# Create application backup
create_application_backup() {
    local timestamp="$1"
    local backup_name="application_backup_${timestamp}"
    local backup_file="$BACKUP_DIR/${backup_name}.tar.gz"
    
    log_step "Creating application backup: $backup_name"
    
    # Create list of files to backup
    local backup_items=(
        "src"
        "docker"
        "scripts"
        "package.json"
        "package-lock.json"
        "tsconfig.json"
        ".env.production"
        "prisma"
        "monitoring"
    )
    
    # Create tar archive
    if tar -czf "$backup_file" \
        --exclude="node_modules" \
        --exclude="dist" \
        --exclude="build" \
        --exclude="logs" \
        --exclude="backups" \
        --exclude=".git" \
        -C "$PROJECT_ROOT" \
        "${backup_items[@]}" 2>> "$LOG_FILE"; then
        
        log_success "Application backup created: $backup_file"
        
        # Get backup size
        local backup_size
        backup_size=$(du -h "$backup_file" | cut -f1)
        log_info "Application backup size: $backup_size"
        
        echo "$backup_file"
        return 0
    else
        log_error "Application backup failed"
        return 1
    fi
}

# Create configuration backup
create_configuration_backup() {
    local timestamp="$1"
    local backup_name="configuration_backup_${timestamp}"
    local backup_file="$BACKUP_DIR/${backup_name}.tar.gz"
    
    log_step "Creating configuration backup: $backup_name"
    
    # Create temporary directory for configuration files
    local temp_dir="/tmp/config_backup_$$"
    mkdir -p "$temp_dir"
    
    # Copy configuration files
    cp "$PROJECT_ROOT/.env.production" "$temp_dir/" 2>/dev/null || true
    cp "$PROJECT_ROOT/docker/docker-compose.prod.yml" "$temp_dir/" 2>/dev/null || true
    cp -r "$PROJECT_ROOT/monitoring" "$temp_dir/" 2>/dev/null || true
    cp -r "$PROJECT_ROOT/k8s" "$temp_dir/" 2>/dev/null || true
    
    # Create backup archive
    if tar -czf "$backup_file" -C "$temp_dir" . 2>> "$LOG_FILE"; then
        log_success "Configuration backup created: $backup_file"
        
        # Get backup size
        local backup_size
        backup_size=$(du -h "$backup_file" | cut -f1)
        log_info "Configuration backup size: $backup_size"
        
        # Cleanup
        rm -rf "$temp_dir"
        
        echo "$backup_file"
        return 0
    else
        log_error "Configuration backup failed"
        rm -rf "$temp_dir"
        return 1
    fi
}

# Encrypt backup file
encrypt_backup() {
    local backup_file="$1"
    local encrypted_file="${backup_file}.enc"
    
    if [ "$BACKUP_ENCRYPTION" = "true" ] && [ -n "$ENCRYPTION_KEY" ]; then
        log_info "Encrypting backup: $(basename "$backup_file")"
        
        if openssl enc -aes-256-cbc -salt -in "$backup_file" -out "$encrypted_file" -k "$ENCRYPTION_KEY" 2>> "$LOG_FILE"; then
            log_success "Backup encrypted: $(basename "$encrypted_file")"
            
            # Remove unencrypted file
            rm "$backup_file"
            
            echo "$encrypted_file"
            return 0
        else
            log_error "Backup encryption failed"
            return 1
        fi
    else
        echo "$backup_file"
        return 0
    fi
}

# Upload backup to S3
upload_to_s3() {
    local backup_file="$1"
    local backup_type="$2"
    
    if [ -z "$AWS_S3_BUCKET" ]; then
        log_info "S3 backup not configured, skipping upload"
        return 0
    fi
    
    log_step "Uploading backup to S3: $(basename "$backup_file")"
    
    local s3_key="backups/${backup_type}/$(basename "$backup_file")"
    local storage_class="STANDARD_IA"
    
    # Use GLACIER for older backups
    local file_age_days
    file_age_days=$(( ($(date +%s) - $(stat -c %Y "$backup_file")) / 86400 ))
    
    if [ $file_age_days -gt 30 ]; then
        storage_class="GLACIER"
    fi
    
    if aws s3 cp "$backup_file" "s3://${AWS_S3_BUCKET}/${s3_key}" \
        --region "$AWS_REGION" \
        --storage-class "$storage_class" \
        --metadata "backup-type=${backup_type},created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        2>> "$LOG_FILE"; then
        
        log_success "Backup uploaded to S3: s3://${AWS_S3_BUCKET}/${s3_key}"
        return 0
    else
        log_error "S3 upload failed for: $(basename "$backup_file")"
        return 1
    fi
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    local backup_type="$2"
    
    log_step "Verifying backup integrity: $(basename "$backup_file")"
    
    case "$backup_type" in
        "database")
            # For database backups, try to list contents
            if pg_restore --list "$backup_file" > /dev/null 2>&1; then
                log_success "Database backup integrity verified"
                return 0
            else
                log_error "Database backup integrity check failed"
                return 1
            fi
            ;;
        "application"|"configuration")
            # For tar archives, test extraction
            if tar -tzf "$backup_file" > /dev/null 2>&1; then
                log_success "Archive backup integrity verified"
                return 0
            else
                log_error "Archive backup integrity check failed"
                return 1
            fi
            ;;
        *)
            log_warning "Unknown backup type for verification: $backup_type"
            return 0
            ;;
    esac
}

# Cleanup old backups
cleanup_old_backups() {
    log_step "Cleaning up old backups (retention: ${RETENTION_DAYS} days)"
    
    local deleted_count=0
    
    # Local cleanup
    while IFS= read -r -d '' file; do
        log_info "Deleting old backup: $(basename "$file")"
        rm "$file"
        deleted_count=$((deleted_count + 1))
    done < <(find "$BACKUP_DIR" -name "*_backup_*.sql" -o -name "*_backup_*.tar.gz" -o -name "*_backup_*.enc" -mtime +${RETENTION_DAYS} -print0 2>/dev/null)
    
    # S3 cleanup if configured
    if [ -n "$AWS_S3_BUCKET" ]; then
        log_info "Cleaning up old S3 backups..."
        
        aws s3 ls "s3://${AWS_S3_BUCKET}/backups/" --recursive | \
        awk '{print $4}' | \
        while read -r s3_file; do
            if [[ "$s3_file" =~ backup_[0-9]{8}_[0-9]{6} ]]; then
                local file_date
                file_date=$(echo "$s3_file" | grep -o '[0-9]\{8\}_[0-9]\{6\}' | head -1 | cut -d_ -f1)
                
                if [[ -n "$file_date" ]]; then
                    local file_timestamp
                    file_timestamp=$(date -d "$file_date" +%s 2>/dev/null || echo "0")
                    local cutoff_timestamp
                    cutoff_timestamp=$(date -d "${RETENTION_DAYS} days ago" +%s)
                    
                    if [[ $file_timestamp -lt $cutoff_timestamp ]] && [[ $file_timestamp -gt 0 ]]; then
                        log_info "Deleting old S3 backup: $s3_file"
                        aws s3 rm "s3://${AWS_S3_BUCKET}/$s3_file" 2>> "$LOG_FILE" || true
                        deleted_count=$((deleted_count + 1))
                    fi
                fi
            fi
        done
    fi
    
    log_success "Cleanup completed. Deleted $deleted_count old backups"
}

# Generate backup report
generate_backup_report() {
    local timestamp="$1"
    local database_backup="$2"
    local application_backup="$3"
    local configuration_backup="$4"
    
    local report_file="$BACKUP_DIR/backup_report_${timestamp}.json"
    
    # Calculate sizes
    local db_size="0"
    local app_size="0"
    local config_size="0"
    
    [ -f "$database_backup" ] && db_size=$(stat -c%s "$database_backup" 2>/dev/null || echo "0")
    [ -f "$application_backup" ] && app_size=$(stat -c%s "$application_backup" 2>/dev/null || echo "0")
    [ -f "$configuration_backup" ] && config_size=$(stat -c%s "$configuration_backup" 2>/dev/null || echo "0")
    
    # Count total backups
    local total_backups
    total_backups=$(find "$BACKUP_DIR" -name "*_backup_*" -type f | wc -l)
    
    cat > "$report_file" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "backup_id": "$timestamp",
    "status": "success",
    "backups": {
        "database": {
            "file": "$(basename "$database_backup")",
            "size_bytes": $db_size,
            "size_human": "$(du -h "$database_backup" 2>/dev/null | cut -f1 || echo "0B")"
        },
        "application": {
            "file": "$(basename "$application_backup")",
            "size_bytes": $app_size,
            "size_human": "$(du -h "$application_backup" 2>/dev/null | cut -f1 || echo "0B")"
        },
        "configuration": {
            "file": "$(basename "$configuration_backup")",
            "size_bytes": $config_size,
            "size_human": "$(du -h "$configuration_backup" 2>/dev/null | cut -f1 || echo "0B")"
        }
    },
    "storage": {
        "local_path": "$BACKUP_DIR",
        "s3_bucket": "$AWS_S3_BUCKET",
        "encryption_enabled": "$BACKUP_ENCRYPTION"
    },
    "retention": {
        "days": $RETENTION_DAYS,
        "total_backups": $total_backups
    },
    "environment": {
        "database": "$POSTGRES_DB",
        "host": "$POSTGRES_HOST"
    }
}
EOF
    
    log_success "Backup report generated: $report_file"
}

# Main backup process
run_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    
    log_info "🗄️  Starting comprehensive backup process"
    log_info "Backup ID: $timestamp"
    log_info "Log file: $LOG_FILE"
    
    # Set health check
    health_check
    
    # Load configuration
    load_config
    
    # Verify prerequisites
    if ! verify_prerequisites; then
        log_error "Prerequisites check failed"
        return 1
    fi
    
    # Cleanup old backups first
    cleanup_old_backups
    
    local backup_files=()
    local failed_backups=()
    
    # Create database backup
    log_step "Phase 1: Database backup"
    local database_backup
    if database_backup=$(create_database_backup "$timestamp"); then
        if verify_backup "$database_backup" "database"; then
            database_backup=$(encrypt_backup "$database_backup")
            upload_to_s3 "$database_backup" "database"
            backup_files+=("$database_backup")
        else
            failed_backups+=("database")
        fi
    else
        failed_backups+=("database")
    fi
    
    # Create application backup
    log_step "Phase 2: Application backup"
    local application_backup
    if application_backup=$(create_application_backup "$timestamp"); then
        if verify_backup "$application_backup" "application"; then
            application_backup=$(encrypt_backup "$application_backup")
            upload_to_s3 "$application_backup" "application"
            backup_files+=("$application_backup")
        else
            failed_backups+=("application")
        fi
    else
        failed_backups+=("application")
    fi
    
    # Create configuration backup
    log_step "Phase 3: Configuration backup"
    local configuration_backup
    if configuration_backup=$(create_configuration_backup "$timestamp"); then
        if verify_backup "$configuration_backup" "configuration"; then
            configuration_backup=$(encrypt_backup "$configuration_backup")
            upload_to_s3 "$configuration_backup" "configuration"
            backup_files+=("$configuration_backup")
        else
            failed_backups+=("configuration")
        fi
    else
        failed_backups+=("configuration")
    fi
    
    # Generate report
    generate_backup_report "$timestamp" "$database_backup" "$application_backup" "$configuration_backup"
    
    # Save configuration
    save_config
    
    # Final health check
    health_check
    
    # Summary
    echo ""
    echo "📊 Backup Summary"
    echo "================="
    echo "Backup ID: $timestamp"
    echo "Successful backups: ${#backup_files[@]}"
    echo "Failed backups: ${#failed_backups[@]}"
    
    if [ ${#failed_backups[@]} -eq 0 ]; then
        log_success "🎉 All backups completed successfully!"
        return 0
    else
        log_error "❌ Some backups failed: ${failed_backups[*]}"
        return 1
    fi
}

# List available backups
list_backups() {
    log_info "Available backups:"
    echo ""
    
    # Local backups
    echo "Local Backups:"
    echo "=============="
    find "$BACKUP_DIR" -name "*_backup_*" -type f -exec ls -lh {} \; | \
    awk '{print $9, $5, $6, $7, $8}' | \
    sort -r
    
    echo ""
    
    # S3 backups
    if [ -n "$AWS_S3_BUCKET" ]; then
        echo "S3 Backups:"
        echo "==========="
        aws s3 ls "s3://${AWS_S3_BUCKET}/backups/" --recursive | \
        grep "_backup_" | \
        awk '{print $4, $3, $1, $2}'
    fi
}

# Restore from backup
restore_backup() {
    local backup_file="$1"
    local backup_type="${2:-auto}"
    
    log_info "🔄 Starting restore process"
    log_info "Backup file: $backup_file"
    
    # Determine backup type if auto
    if [ "$backup_type" = "auto" ]; then
        if [[ "$backup_file" == *"database_backup"* ]]; then
            backup_type="database"
        elif [[ "$backup_file" == *"application_backup"* ]]; then
            backup_type="application"
        elif [[ "$backup_file" == *"configuration_backup"* ]]; then
            backup_type="configuration"
        else
            log_error "Cannot determine backup type automatically"
            return 1
        fi
    fi
    
    log_info "Backup type: $backup_type"
    
    # Call appropriate restore script
    case "$backup_type" in
        "database")
            "$SCRIPT_DIR/restore.sh" --file "$backup_file"
            ;;
        "application"|"configuration")
            log_info "Extracting backup to temporary location..."
            local temp_dir="/tmp/restore_$$"
            mkdir -p "$temp_dir"
            
            if tar -xzf "$backup_file" -C "$temp_dir"; then
                log_success "Backup extracted to: $temp_dir"
                log_info "Please manually review and apply the restored files"
            else
                log_error "Failed to extract backup"
                rm -rf "$temp_dir"
                return 1
            fi
            ;;
        *)
            log_error "Unknown backup type: $backup_type"
            return 1
            ;;
    esac
}

# Setup backup scheduling
setup_schedule() {
    log_info "Setting up backup schedule: $BACKUP_SCHEDULE"
    
    # Create cron job
    local cron_job="$BACKUP_SCHEDULE $SCRIPT_DIR/backup-automation.sh run >> $PROJECT_ROOT/logs/backup_cron.log 2>&1"
    
    # Add to crontab
    (crontab -l 2>/dev/null | grep -v "backup-automation.sh"; echo "$cron_job") | crontab -
    
    log_success "Backup schedule configured"
    log_info "Next backup will run according to schedule: $BACKUP_SCHEDULE"
}

# Usage information
usage() {
    cat << EOF
Backup Automation Script
=======================

Usage: $0 [command] [options]

Commands:
  run                    - Run full backup process
  list                   - List available backups
  restore <file> [type]  - Restore from backup file
  schedule               - Setup automated backup schedule
  cleanup                - Cleanup old backups only
  config                 - Show current configuration
  help                   - Show this help message

Backup Types:
  database      - PostgreSQL database backup
  application   - Application source code backup
  configuration - Configuration files backup

Environment Variables:
  BACKUP_RETENTION_DAYS  - Backup retention period (default: 30)
  BACKUP_SCHEDULE        - Cron schedule (default: "0 2 * * *")
  COMPRESSION_LEVEL      - Compression level 1-9 (default: 9)
  AWS_S3_BUCKET         - S3 bucket for cloud backup
  BACKUP_ENCRYPTION     - Enable encryption (default: true)
  BACKUP_ENCRYPTION_KEY - Encryption key for backups

Examples:
  $0 run
  $0 list
  $0 restore /backups/database_backup_20231201_120000.sql
  $0 schedule

EOF
}

# Main script execution
case "${1:-help}" in
    "run")
        run_backup
        ;;
    "list")
        list_backups
        ;;
    "restore")
        if [ -z "${2:-}" ]; then
            log_error "Backup file required for restore"
            usage
            exit 1
        fi
        restore_backup "$2" "${3:-auto}"
        ;;
    "schedule")
        setup_schedule
        ;;
    "cleanup")
        load_config
        cleanup_old_backups
        ;;
    "config")
        load_config
        echo "Current Backup Configuration:"
        echo "============================"
        echo "Retention Days: $RETENTION_DAYS"
        echo "Schedule: $BACKUP_SCHEDULE"
        echo "Compression Level: $COMPRESSION_LEVEL"
        echo "S3 Bucket: ${AWS_S3_BUCKET:-"Not configured"}"
        echo "Encryption: $BACKUP_ENCRYPTION"
        ;;
    "help")
        usage
        ;;
    *)
        log_error "Unknown command: $1"
        usage
        exit 1
        ;;
esac