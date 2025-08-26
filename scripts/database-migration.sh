#!/bin/bash

# Database Migration Automation Script
# Handles database migrations with backup and rollback capabilities

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$PROJECT_ROOT/database/migrations"
BACKUP_DIR="$PROJECT_ROOT/backups"
LOG_FILE="$PROJECT_ROOT/logs/migration_$(date +%Y%m%d_%H%M%S).log"

# Create directories
mkdir -p "$MIGRATIONS_DIR" "$BACKUP_DIR" "$PROJECT_ROOT/logs"

# Database connection
POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_DB=${POSTGRES_DB:-trading_bot}
POSTGRES_USER=${POSTGRES_USER:-postgres}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Database connection test
test_connection() {
    log_info "Testing database connection..."
    
    if PGPASSWORD="$POSTGRES_PASSWORD" pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB"; then
        log_success "Database connection successful"
        return 0
    else
        log_error "Database connection failed"
        return 1
    fi
}

# Create migration tracking table
create_migration_table() {
    log_info "Creating migration tracking table..."
    
    PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" << 'EOF'
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checksum VARCHAR(64),
    execution_time_ms INTEGER,
    success BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at);
EOF
    
    if [ $? -eq 0 ]; then
        log_success "Migration tracking table created/verified"
    else
        log_error "Failed to create migration tracking table"
        return 1
    fi
}

# Get applied migrations
get_applied_migrations() {
    PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c \
        "SELECT version FROM schema_migrations WHERE success = TRUE ORDER BY version;" | sed 's/^ *//' | grep -v '^$'
}

# Get pending migrations
get_pending_migrations() {
    local applied_migrations
    applied_migrations=$(get_applied_migrations)
    
    local pending=()
    
    if [ -d "$MIGRATIONS_DIR" ]; then
        for migration_file in "$MIGRATIONS_DIR"/*.sql; do
            if [ -f "$migration_file" ]; then
                local version
                version=$(basename "$migration_file" .sql)
                
                if ! echo "$applied_migrations" | grep -q "^$version$"; then
                    pending+=("$version")
                fi
            fi
        done
    fi
    
    printf '%s\n' "${pending[@]}" | sort
}

# Calculate file checksum
calculate_checksum() {
    local file="$1"
    sha256sum "$file" | cut -d' ' -f1
}

# Create pre-migration backup
create_backup() {
    log_info "Creating pre-migration backup..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/pre_migration_backup_${timestamp}.sql"
    
    if PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        --verbose \
        --no-owner \
        --no-privileges \
        --format=custom \
        --file="$backup_file"; then
        
        # Compress backup
        gzip "$backup_file"
        backup_file="${backup_file}.gz"
        
        log_success "Backup created: $backup_file"
        echo "$backup_file"
    else
        log_error "Backup creation failed"
        return 1
    fi
}

# Apply single migration
apply_migration() {
    local version="$1"
    local migration_file="$MIGRATIONS_DIR/${version}.sql"
    
    if [ ! -f "$migration_file" ]; then
        log_error "Migration file not found: $migration_file"
        return 1
    fi
    
    log_info "Applying migration: $version"
    
    # Calculate checksum
    local checksum
    checksum=$(calculate_checksum "$migration_file")
    
    # Record start time
    local start_time=$(date +%s%3N)
    
    # Apply migration in transaction
    local temp_sql="/tmp/migration_${version}.sql"
    cat > "$temp_sql" << EOF
BEGIN;

-- Apply migration
$(cat "$migration_file")

-- Record migration
INSERT INTO schema_migrations (version, name, checksum, execution_time_ms, success)
VALUES ('$version', '$(basename "$migration_file")', '$checksum', 0, TRUE);

COMMIT;
EOF
    
    if PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$temp_sql"; then
        local end_time=$(date +%s%3N)
        local execution_time=$((end_time - start_time))
        
        # Update execution time
        PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
            "UPDATE schema_migrations SET execution_time_ms = $execution_time WHERE version = '$version';"
        
        log_success "Migration applied successfully: $version (${execution_time}ms)"
        rm -f "$temp_sql"
        return 0
    else
        log_error "Migration failed: $version"
        
        # Record failed migration
        PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
            "INSERT INTO schema_migrations (version, name, checksum, success) VALUES ('$version', '$(basename "$migration_file")', '$checksum', FALSE) ON CONFLICT (version) DO UPDATE SET success = FALSE;" || true
        
        rm -f "$temp_sql"
        return 1
    fi
}

# Rollback migration
rollback_migration() {
    local version="$1"
    local rollback_file="$MIGRATIONS_DIR/${version}_rollback.sql"
    
    if [ ! -f "$rollback_file" ]; then
        log_error "Rollback file not found: $rollback_file"
        return 1
    fi
    
    log_info "Rolling back migration: $version"
    
    # Apply rollback in transaction
    local temp_sql="/tmp/rollback_${version}.sql"
    cat > "$temp_sql" << EOF
BEGIN;

-- Apply rollback
$(cat "$rollback_file")

-- Remove migration record
DELETE FROM schema_migrations WHERE version = '$version';

COMMIT;
EOF
    
    if PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$temp_sql"; then
        log_success "Migration rolled back successfully: $version"
        rm -f "$temp_sql"
        return 0
    else
        log_error "Rollback failed: $version"
        rm -f "$temp_sql"
        return 1
    fi
}

# Validate migration files
validate_migrations() {
    log_info "Validating migration files..."
    
    local errors=0
    
    if [ ! -d "$MIGRATIONS_DIR" ]; then
        log_warning "Migrations directory not found: $MIGRATIONS_DIR"
        return 0
    fi
    
    for migration_file in "$MIGRATIONS_DIR"/*.sql; do
        if [ -f "$migration_file" ]; then
            local version
            version=$(basename "$migration_file" .sql)
            
            # Skip rollback files
            if [[ "$version" == *"_rollback" ]]; then
                continue
            fi
            
            # Check file syntax
            if ! sql_syntax_check "$migration_file"; then
                log_error "Syntax error in migration: $migration_file"
                errors=$((errors + 1))
            fi
            
            # Check for rollback file
            local rollback_file="$MIGRATIONS_DIR/${version}_rollback.sql"
            if [ ! -f "$rollback_file" ]; then
                log_warning "No rollback file found for migration: $version"
            fi
        fi
    done
    
    if [ $errors -eq 0 ]; then
        log_success "Migration validation completed"
        return 0
    else
        log_error "Migration validation failed with $errors errors"
        return 1
    fi
}

# Basic SQL syntax check
sql_syntax_check() {
    local file="$1"
    
    # Basic checks for common SQL syntax issues
    if grep -q "DROP TABLE.*IF EXISTS" "$file" && ! grep -q "CASCADE" "$file"; then
        log_warning "DROP TABLE without CASCADE in $file - may cause issues"
    fi
    
    # Check for transaction statements in migration files
    if grep -q "BEGIN\|COMMIT\|ROLLBACK" "$file"; then
        log_warning "Transaction statements found in $file - migrations are wrapped in transactions automatically"
    fi
    
    return 0
}

# Generate migration template
generate_migration() {
    local name="$1"
    local timestamp=$(date +%Y%m%d%H%M%S)
    local version="${timestamp}_${name}"
    local migration_file="$MIGRATIONS_DIR/${version}.sql"
    local rollback_file="$MIGRATIONS_DIR/${version}_rollback.sql"
    
    # Create migration file
    cat > "$migration_file" << EOF
-- Migration: $name
-- Created: $(date)
-- Version: $version

-- Add your migration SQL here
-- Example:
-- CREATE TABLE example_table (
--     id SERIAL PRIMARY KEY,
--     name VARCHAR(255) NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- ALTER TABLE existing_table ADD COLUMN new_column VARCHAR(255);
EOF
    
    # Create rollback file
    cat > "$rollback_file" << EOF
-- Rollback for migration: $name
-- Created: $(date)
-- Version: $version

-- Add your rollback SQL here (reverse of migration)
-- Example:
-- DROP TABLE IF EXISTS example_table;

-- ALTER TABLE existing_table DROP COLUMN IF EXISTS new_column;
EOF
    
    log_success "Migration template created:"
    log_info "  Migration: $migration_file"
    log_info "  Rollback:  $rollback_file"
}

# Show migration status
show_status() {
    log_info "Migration Status"
    echo "================"
    
    # Applied migrations
    local applied_migrations
    applied_migrations=$(get_applied_migrations)
    
    if [ -n "$applied_migrations" ]; then
        echo ""
        echo "Applied Migrations:"
        echo "$applied_migrations" | while read -r version; do
            local info
            info=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c \
                "SELECT applied_at, execution_time_ms FROM schema_migrations WHERE version = '$version';" | sed 's/^ *//')
            echo "  ✅ $version - $info"
        done
    else
        echo ""
        echo "No applied migrations found."
    fi
    
    # Pending migrations
    local pending_migrations
    pending_migrations=$(get_pending_migrations)
    
    if [ -n "$pending_migrations" ]; then
        echo ""
        echo "Pending Migrations:"
        echo "$pending_migrations" | while read -r version; do
            echo "  ⏳ $version"
        done
    else
        echo ""
        echo "No pending migrations."
    fi
}

# Main migration function
run_migrations() {
    log_info "Starting database migration process..."
    
    # Test connection
    if ! test_connection; then
        return 1
    fi
    
    # Create migration table
    if ! create_migration_table; then
        return 1
    fi
    
    # Validate migrations
    if ! validate_migrations; then
        return 1
    fi
    
    # Get pending migrations
    local pending_migrations
    pending_migrations=$(get_pending_migrations)
    
    if [ -z "$pending_migrations" ]; then
        log_success "No pending migrations found"
        return 0
    fi
    
    log_info "Found pending migrations:"
    echo "$pending_migrations" | while read -r version; do
        log_info "  - $version"
    done
    
    # Create backup
    local backup_file
    backup_file=$(create_backup)
    
    if [ $? -ne 0 ]; then
        log_error "Backup creation failed - aborting migrations"
        return 1
    fi
    
    # Apply migrations
    local failed_migrations=()
    
    echo "$pending_migrations" | while read -r version; do
        if ! apply_migration "$version"; then
            failed_migrations+=("$version")
            log_error "Migration failed: $version"
            break
        fi
    done
    
    if [ ${#failed_migrations[@]} -eq 0 ]; then
        log_success "All migrations applied successfully"
        return 0
    else
        log_error "Some migrations failed. Backup available at: $backup_file"
        return 1
    fi
}

# Usage information
usage() {
    cat << EOF
Database Migration Automation Script
===================================

Usage: $0 [command] [options]

Commands:
  migrate              - Run pending migrations
  rollback <version>   - Rollback specific migration
  status              - Show migration status
  validate            - Validate migration files
  generate <name>     - Generate migration template
  help                - Show this help message

Environment Variables:
  POSTGRES_HOST       - Database host (default: localhost)
  POSTGRES_PORT       - Database port (default: 5432)
  POSTGRES_DB         - Database name (default: trading_bot)
  POSTGRES_USER       - Database user (default: postgres)
  POSTGRES_PASSWORD   - Database password (required)

Examples:
  $0 migrate
  $0 rollback 20231201120000_add_user_table
  $0 generate add_trading_pairs_table
  $0 status

EOF
}

# Main script execution
case "${1:-help}" in
    "migrate")
        run_migrations
        ;;
    "rollback")
        if [ -z "${2:-}" ]; then
            log_error "Version required for rollback"
            usage
            exit 1
        fi
        test_connection && rollback_migration "$2"
        ;;
    "status")
        test_connection && show_status
        ;;
    "validate")
        validate_migrations
        ;;
    "generate")
        if [ -z "${2:-}" ]; then
            log_error "Migration name required"
            usage
            exit 1
        fi
        generate_migration "$2"
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