#!/bin/bash

# Enhanced SSL Certificate Setup Script
# This script sets up SSL certificates for production deployment

set -e

# Configuration
DOMAIN_NAME=${DOMAIN_NAME:-"localhost"}
LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL:-"admin@localhost"}
SSL_DIR="/etc/nginx/ssl"
DOCKER_SSL_DIR="./docker/ssl"
CERT_VALIDITY_DAYS=365

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root (needed for Let's Encrypt)
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_info "Running as root - can set up Let's Encrypt certificates"
        return 0
    else
        log_warning "Not running as root - will generate self-signed certificates"
        return 1
    fi
}

# Create SSL directories
create_ssl_directories() {
    log_info "Creating SSL directories..."
    
    # Create Docker SSL directory
    mkdir -p "$DOCKER_SSL_DIR"
    
    # Create nginx SSL directory (if running in container)
    if [ -d "/etc/nginx" ]; then
        mkdir -p "$SSL_DIR"
    fi
    
    log_success "SSL directories created"
}

# Generate self-signed certificates
generate_self_signed_certificates() {
    log_info "Generating self-signed SSL certificates for $DOMAIN_NAME..."
    
    # Generate private key
    openssl genrsa -out "$DOCKER_SSL_DIR/private.key" 2048
    
    # Generate certificate signing request
    openssl req -new -key "$DOCKER_SSL_DIR/private.key" -out "$DOCKER_SSL_DIR/cert.csr" -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN_NAME"
    
    # Generate self-signed certificate
    openssl x509 -req -in "$DOCKER_SSL_DIR/cert.csr" -signkey "$DOCKER_SSL_DIR/private.key" -out "$DOCKER_SSL_DIR/cert.pem" -days $CERT_VALIDITY_DAYS
    
    # Create CA certificate (copy of cert for self-signed)
    cp "$DOCKER_SSL_DIR/cert.pem" "$DOCKER_SSL_DIR/ca.pem"
    
    # Clean up CSR
    rm -f "$DOCKER_SSL_DIR/cert.csr"
    
    log_success "Self-signed certificates generated"
}

# Setup Let's Encrypt certificates (requires root and valid domain)
setup_letsencrypt_certificates() {
    log_info "Setting up Let's Encrypt certificates for $DOMAIN_NAME..."
    
    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        log_error "Certbot is not installed. Installing..."
        
        # Install certbot based on OS
        if command -v apt-get &> /dev/null; then
            apt-get update
            apt-get install -y certbot python3-certbot-nginx
        elif command -v yum &> /dev/null; then
            yum install -y certbot python3-certbot-nginx
        else
            log_error "Cannot install certbot automatically. Please install manually."
            return 1
        fi
    fi
    
    # Stop nginx if running to free port 80
    if systemctl is-active --quiet nginx; then
        log_info "Stopping nginx temporarily for certificate generation..."
        systemctl stop nginx
        NGINX_WAS_RUNNING=true
    fi
    
    # Generate Let's Encrypt certificate
    certbot certonly --standalone \
        --email "$LETSENCRYPT_EMAIL" \
        --agree-tos \
        --no-eff-email \
        --domains "$DOMAIN_NAME" \
        --non-interactive
    
    if [ $? -eq 0 ]; then
        log_success "Let's Encrypt certificates generated successfully"
        
        # Copy certificates to Docker SSL directory
        cp "/etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem" "$DOCKER_SSL_DIR/cert.pem"
        cp "/etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem" "$DOCKER_SSL_DIR/private.key"
        cp "/etc/letsencrypt/live/$DOMAIN_NAME/chain.pem" "$DOCKER_SSL_DIR/ca.pem"
        
        log_success "Certificates copied to Docker SSL directory"
    else
        log_error "Failed to generate Let's Encrypt certificates"
        return 1
    fi
    
    # Restart nginx if it was running
    if [ "$NGINX_WAS_RUNNING" = true ]; then
        log_info "Restarting nginx..."
        systemctl start nginx
    fi
}

# Validate SSL certificates
validate_ssl_certificates() {
    log_info "Validating SSL certificates..."
    
    local cert_file="$DOCKER_SSL_DIR/cert.pem"
    local key_file="$DOCKER_SSL_DIR/private.key"
    local ca_file="$DOCKER_SSL_DIR/ca.pem"
    
    # Check if certificate files exist
    if [ ! -f "$cert_file" ]; then
        log_error "Certificate file not found: $cert_file"
        return 1
    fi
    
    if [ ! -f "$key_file" ]; then
        log_error "Private key file not found: $key_file"
        return 1
    fi
    
    if [ ! -f "$ca_file" ]; then
        log_error "CA certificate file not found: $ca_file"
        return 1
    fi
    
    # Validate certificate
    if openssl x509 -in "$cert_file" -text -noout > /dev/null 2>&1; then
        log_success "Certificate is valid"
    else
        log_error "Certificate is invalid"
        return 1
    fi
    
    # Validate private key
    if openssl rsa -in "$key_file" -check -noout > /dev/null 2>&1; then
        log_success "Private key is valid"
    else
        log_error "Private key is invalid"
        return 1
    fi
    
    # Check if certificate and key match
    cert_modulus=$(openssl x509 -noout -modulus -in "$cert_file" | openssl md5)
    key_modulus=$(openssl rsa -noout -modulus -in "$key_file" | openssl md5)
    
    if [ "$cert_modulus" = "$key_modulus" ]; then
        log_success "Certificate and private key match"
    else
        log_error "Certificate and private key do not match"
        return 1
    fi
    
    # Display certificate information
    log_info "Certificate information:"
    openssl x509 -in "$cert_file" -text -noout | grep -E "(Subject:|Issuer:|Not Before:|Not After:)"
}

# Set proper file permissions
set_ssl_permissions() {
    log_info "Setting SSL file permissions..."
    
    # Set restrictive permissions for private key
    chmod 600 "$DOCKER_SSL_DIR/private.key"
    
    # Set readable permissions for certificates
    chmod 644 "$DOCKER_SSL_DIR/cert.pem"
    chmod 644 "$DOCKER_SSL_DIR/ca.pem"
    
    log_success "SSL file permissions set"
}

# Generate DH parameters for enhanced security
generate_dhparam() {
    log_info "Generating DH parameters for enhanced security..."
    
    local dhparam_file="$DOCKER_SSL_DIR/dhparam.pem"
    
    if [ ! -f "$dhparam_file" ]; then
        openssl dhparam -out "$dhparam_file" 2048
        chmod 644 "$dhparam_file"
        log_success "DH parameters generated"
    else
        log_info "DH parameters already exist"
    fi
}

# Create SSL configuration snippet
create_ssl_config_snippet() {
    log_info "Creating SSL configuration snippet..."
    
    local ssl_config_file="$DOCKER_SSL_DIR/ssl-params.conf"
    
    cat > "$ssl_config_file" << EOF
# SSL Configuration Parameters
# Generated by enhanced-ssl-setup.sh

# SSL Protocol and Cipher Configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
ssl_prefer_server_ciphers off;

# SSL Session Configuration
ssl_session_timeout 10m;
ssl_session_cache shared:SSL:10m;
ssl_session_tickets off;

# OCSP Stapling
ssl_stapling on;
ssl_stapling_verify on;

# Security Headers
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";

# DH Parameters
ssl_dhparam /etc/nginx/ssl/dhparam.pem;
EOF

    log_success "SSL configuration snippet created: $ssl_config_file"
}

# Main execution
main() {
    log_info "Starting Enhanced SSL Certificate Setup"
    log_info "Domain: $DOMAIN_NAME"
    log_info "Email: $LETSENCRYPT_EMAIL"
    
    # Create SSL directories
    create_ssl_directories
    
    # Check if we should use Let's Encrypt or self-signed certificates
    if check_root && [ "$DOMAIN_NAME" != "localhost" ] && [ "$DOMAIN_NAME" != "127.0.0.1" ]; then
        log_info "Attempting to set up Let's Encrypt certificates..."
        if ! setup_letsencrypt_certificates; then
            log_warning "Let's Encrypt setup failed, falling back to self-signed certificates"
            generate_self_signed_certificates
        fi
    else
        log_info "Using self-signed certificates (localhost or non-root)"
        generate_self_signed_certificates
    fi
    
    # Validate certificates
    if validate_ssl_certificates; then
        log_success "SSL certificate validation passed"
    else
        log_error "SSL certificate validation failed"
        exit 1
    fi
    
    # Set proper permissions
    set_ssl_permissions
    
    # Generate DH parameters
    generate_dhparam
    
    # Create SSL configuration snippet
    create_ssl_config_snippet
    
    log_success "Enhanced SSL setup completed successfully!"
    log_info "Certificate files:"
    log_info "  - Certificate: $DOCKER_SSL_DIR/cert.pem"
    log_info "  - Private Key: $DOCKER_SSL_DIR/private.key"
    log_info "  - CA Certificate: $DOCKER_SSL_DIR/ca.pem"
    log_info "  - DH Parameters: $DOCKER_SSL_DIR/dhparam.pem"
    log_info "  - SSL Config: $DOCKER_SSL_DIR/ssl-params.conf"
}

# Run main function
main "$@"