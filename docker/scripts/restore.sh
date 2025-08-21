#!/bin/bash

# Database Restore Script for Trading Bot
# Restores database from backup with verification

set -euo pipefail

# Configuration
BACKUP_DIR="/backups"
LOG_FILE="/app/logs/restore.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

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

# Usage information
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Options:
    -f, --file FILE         Restore from local backup file
    -s, --s3-key KEY       Restore from S3 backup key
    -l, --list             List available backups
    -t, --test             Test restore (dry run)
    -h, --help             Show this help message

Examples:
    $0 --file /backups/trading_bot_backup_20231201_120000.sql.gz
    $0 --s3-key backups/trading_bot_backup_20231201_120000.sql.gz
    $0 --list
EOF
}

# List available backups
list_backups() {
    log "Available local backups:"
    find "$BACKUP_DIR" -name "trading_bot_backup_*.sql.gz" -type f -exec ls -lh {} \; | \
    awk '{print $9, $5, $6, $7, $8}' | \
    sort -r
    
    if [[ -n "$AWS_S3_BUCKET" ]]; then
        log "Available S3 backups:"
        aws s3 ls "s3://${AWS_S3_BUCKET}/backups/" --recursive | \
        grep "trading_bot_backup_.*\.sql\.gz$" | \
        awk '{print $4, $3, $1, $2}'
    fi
}

# Download backup from S3
download_from_s3() {
    local s3_key="$1"
    local local_file="${BACKUP_DIR}/$(basename "$s3_key")"
    
    log "Downloading backup from S3: $s3_key"
    
    if ! aws s3 cp "s3://${AWS_S3_BUCKET}/${s3_key}" "$local_file" --region "$AWS_REGION"; then
        error_exit "Failed to download backup from S3"
    fi
    
    log "Backup downloaded: $local_file"
    echo "$local_file"
}

# Verify backup file
verify_backup() {
    local backup_file="$1"
    
    log "Verifying backup file: $backup_file"
    
    # Check if file exists
    if [[ ! -f "$backup_file" ]]; then
        error_exit "Backup file not found: $backup_file"
    fi
    
    # Check if file is compressed
    if [[ "$backup_file" == *.gz ]]; then
        if ! gzip -t "$backup_file"; then
            error_exit "Backup file is corrupted: $backup_file"
        fi
    fi
    
    log "Backup file verification passed"
}

# Create pre-restore backup
create_pre_restore_backup() {
    log "Creating pre-restore backup..."
    
    local pre_restore_backup="${BACKUP_DIR}/pre_restore_backup_${TIMESTAMP}.sql.gz"
    
    if ! PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        --verbose \
        --no-owner \
        --no-privileges \
        --format=custom \
        --compress=9 | gzip -9 > "$pre_restore_backup"; then
        error_exit "Pre-restore backup failed"
    fi
    
    log "Pre-restore backup created: $pre_restore_backup"
    echo "$pre_restore_backup"
}

# Restore database
restore_database() {
    local backup_file="$1"
    local test_mode="${2:-false}"
    
    log "Starting database restore from: $backup_file"
    
    if [[ "$test_mode" == "true" ]]; then
        log "TEST MODE: Performing dry run"
        
        # Test restore to temporary database
        local test_db="${POSTGRES_DB}_restore_test_${TIMESTAMP}"
        
        log "Creating test database: $test_db"
        PGPASSWORD="$POSTGRES_PASSWORD" createdb \
            -h "$POSTGRES_HOST" \
            -p "$POSTGRES_PORT" \
            -U "$POSTGRES_USER" \
            "$test_db"
        
        # Restore to test database
        if [[ "$backup_file" == *.gz ]]; then
            if ! gunzip -c "$backup_file" | PGPASSWORD="$POSTGRES_PASSWORD" pg_restore \
                -h "$POSTGRES_HOST" \
                -p "$POSTGRES_PORT" \
                -U "$POSTGRES_USER" \
                -d "$test_db" \
                --verbose \
                --no-owner \
                --no-privileges; then
                error_exit "Test restore failed"
            fi
        else
            if ! PGPASSWORD="$POSTGRES_PASSWORD" pg_restore \
                -h "$POSTGRES_HOST" \
                -p "$POSTGRES_PORT" \
                -U "$POSTGRES_USER" \
                -d "$test_db" \
                --verbose \
                --no-owner \
                --no-privileges \
                "$backup_file"; then
                error_exit "Test restore failed"
            fi
        fi
        
        # Verify test database
        local table_count
        table_count=$(PGPASSWORD="$POSTGRES_PASSWORD" psql \
            -h "$POSTGRES_HOST" \
            -p "$POSTGRES_PORT" \
            -U "$POSTGRES_USER" \
            -d "$test_db" \
            -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
        
        log "Test restore successful. Tables restored: $table_count"
        
        # Cleanup test database
        PGPASSWORD="$POSTGRES_PASSWORD" dropdb \
            -h "$POSTGRES_HOST" \
            -p "$POSTGRES_PORT" \
            -U "$POSTGRES_USER" \
            "$test_db"
        
        log "Test database cleaned up"
        return 0
    fi
    
    # Actual restore
    log "Performing actual database restore..."
    
    # Drop existing connections
    PGPASSWORD="$POSTGRES_PASSWORD" psql \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d postgres \
        -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$POSTGRES_DB' AND pid <> pg_backend_pid();"
    
    # Drop and recreate database
    PGPASSWORD="$POSTGRES_PASSWORD" dropdb \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        "$POSTGRES_DB" || true
    
    PGPASSWORD="$POSTGRES_PASSWORD" createdb \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        "$POSTGRES_DB"
    
    # Restore database
    if [[ "$backup_file" == *.gz ]]; then
        if ! gunzip -c "$backup_file" | PGPASSWORD="$POSTGRES_PASSWORD" pg_restore \
            -h "$POSTGRES_HOST" \
            -p "$POSTGRES_PORT" \
            -U "$POSTGRES_USER" \
            -d "$POSTGRES_DB" \
            --verbose \
            --no-owner \
            --no-privileges; then
            error_exit "Database restore failed"
        fi
    else
        if ! PGPASSWORD="$POSTGRES_PASSWORD" pg_restore \
            -h "$POSTGRES_HOST" \
            -p "$POSTGRES_PORT" \
            -U "$POSTGRES_USER" \
            -d "$POSTGRES_DB" \
            --verbose \
            --no-owner \
            --no-privileges \
            "$backup_file"; then
            error_exit "Database restore failed"
        fi
    fi
    
    log "Database restore completed successfully"
}

# Verify restore
verify_restore() {
    log "Verifying database restore..."
    
    # Check database connectivity
    if ! pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB"; then
        error_exit "Database is not accessible after restore"
    fi
    
    # Check table count
    local table_count
    table_count=$(PGPASSWORD="$POSTGRES_PASSWORD" psql \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
    
    log "Database verification passed. Tables: $table_count"
}

# Generate restore report
generate_report() {
    local backup_file="$1"
    local pre_restore_backup="$2"
    
    cat > "${BACKUP_DIR}/restore_report_${TIMESTAMP}.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "restored_from": "$(basename "$backup_file")",
    "pre_restore_backup": "$(basename "$pre_restore_backup")",
    "database": "$POSTGRES_DB",
    "host": "$POSTGRES_HOST",
    "status": "success"
}
EOF
    
    log "Restore report generated: restore_report_${TIMESTAMP}.json"
}

# Main restore process
main() {
    local backup_file=""
    local s3_key=""
    local test_mode="false"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--file)
                backup_file="$2"
                shift 2
                ;;
            -s|--s3-key)
                s3_key="$2"
                shift 2
                ;;
            -l|--list)
                list_backups
                exit 0
                ;;
            -t|--test)
                test_mode="true"
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                error_exit "Unknown option: $1"
                ;;
        esac
    done
    
    # Validate arguments
    if [[ -z "$backup_file" && -z "$s3_key" ]]; then
        error_exit "Either --file or --s3-key must be specified"
    fi
    
    log "=== Starting restore process ==="
    
    # Download from S3 if needed
    if [[ -n "$s3_key" ]]; then
        backup_file=$(download_from_s3 "$s3_key")
    fi
    
    # Verify backup file
    verify_backup "$backup_file"
    
    # Create pre-restore backup (unless in test mode)
    local pre_restore_backup=""
    if [[ "$test_mode" != "true" ]]; then
        pre_restore_backup=$(create_pre_restore_backup)
    fi
    
    # Restore database
    restore_database "$backup_file" "$test_mode"
    
    # Verify restore (unless in test mode)
    if [[ "$test_mode" != "true" ]]; then
        verify_restore
        generate_report "$backup_file" "$pre_restore_backup"
    fi
    
    log "=== Restore process completed successfully ==="
}

# Run main function
main "$@"