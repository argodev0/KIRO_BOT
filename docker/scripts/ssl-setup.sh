#!/bin/bash

# SSL Certificate Setup Script for Production Deployment
# This script sets up Let's Encrypt SSL certificates for the trading bot

set -e

# Configuration
DOMAIN_NAME="${DOMAIN_NAME:-localhost}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-admin@example.com}"
NGINX_CONF_DIR="./docker/nginx"
SSL_DIR="./docker/ssl"

echo "🔒 Setting up SSL certificates for domain: $DOMAIN_NAME"

# Create SSL directory if it doesn't exist
mkdir -p "$SSL_DIR"

# Function to generate self-signed certificates for development/testing
generate_self_signed_cert() {
    echo "📝 Generating self-signed certificate for development..."
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/private.key" \
        -out "$SSL_DIR/cert.pem" \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN_NAME"
    
    # Create chain file (same as cert for self-signed)
    cp "$SSL_DIR/cert.pem" "$SSL_DIR/ca.pem"
    
    echo "✅ Self-signed certificate generated"
}

# Function to setup Let's Encrypt certificates
setup_letsencrypt() {
    echo "🌐 Setting up Let's Encrypt certificate..."
    
    # Check if domain is accessible
    echo "🔍 Checking domain accessibility..."
    if curl -s --connect-timeout 10 --max-time 30 "http://$DOMAIN_NAME" > /dev/null; then
        echo "✅ Domain $DOMAIN_NAME is accessible"
    else
        echo "⚠️  Warning: Domain $DOMAIN_NAME is not accessible"
        echo "   Make sure your domain points to this server before running in production"
        echo "   You can still proceed with certificate setup, but it may fail"
        
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "❌ SSL setup cancelled"
            exit 1
        fi
    fi
    
    # Create directory for certbot challenges
    mkdir -p "./docker/certbot/www"
    
    # Create initial nginx config for certificate challenge
    cat > "$NGINX_CONF_DIR/challenge.conf" << EOF
# Temporary configuration for Let's Encrypt challenge
server {
    listen 80;
    server_name $DOMAIN_NAME;
    
    # Let's Encrypt challenge location
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files \$uri =404;
    }
    
    # Health check for monitoring
    location /health {
        access_log off;
        return 200 'SSL setup in progress...\\n';
        add_header Content-Type text/plain;
    }
    
    # Redirect all other traffic to HTTPS after certificate is obtained
    location / {
        return 200 'Certificate setup in progress. Please wait...\\n';
        add_header Content-Type text/plain;
        add_header X-SSL-Setup "in-progress";
    }
}
EOF
    
    echo "📋 Challenge configuration created at $NGINX_CONF_DIR/challenge.conf"
    
    # Create production SSL configuration template
    create_ssl_config_template
    
    echo "🚀 SSL Setup Instructions:"
    echo "========================="
    echo ""
    echo "1. Start the services with challenge configuration:"
    echo "   docker-compose -f docker/docker-compose.prod.yml up -d nginx certbot"
    echo ""
    echo "2. Wait for certificate generation (check logs):"
    echo "   docker-compose -f docker/docker-compose.prod.yml logs -f certbot"
    echo ""
    echo "3. Once certificates are obtained, switch to production config:"
    echo "   cp $NGINX_CONF_DIR/production.conf $NGINX_CONF_DIR/default.conf"
    echo "   docker-compose -f docker/docker-compose.prod.yml restart frontend"
    echo ""
    echo "4. Verify SSL certificate:"
    echo "   curl -I https://$DOMAIN_NAME/health"
    echo ""
}

# Function to create SSL configuration template
create_ssl_config_template() {
    echo "📝 Creating SSL configuration template..."
    
    # Backup existing production config
    if [ -f "$NGINX_CONF_DIR/production.conf" ]; then
        cp "$NGINX_CONF_DIR/production.conf" "$NGINX_CONF_DIR/production.conf.backup"
    fi
    
    # Update production config with domain-specific settings
    sed "s/\${DOMAIN_NAME}/$DOMAIN_NAME/g" "$NGINX_CONF_DIR/production.conf" > "$NGINX_CONF_DIR/production-ready.conf"
    
    echo "✅ SSL configuration template created"
}

# Function to validate SSL configuration
validate_ssl_config() {
    echo "🔍 Validating SSL configuration..."
    
    # Check if required environment variables are set
    if [ -z "$DOMAIN_NAME" ] || [ "$DOMAIN_NAME" = "localhost" ]; then
        echo "⚠️  DOMAIN_NAME not set or set to localhost"
        echo "   For production, set DOMAIN_NAME to your actual domain"
        return 1
    fi
    
    if [ -z "$LETSENCRYPT_EMAIL" ] || [ "$LETSENCRYPT_EMAIL" = "admin@example.com" ]; then
        echo "⚠️  LETSENCRYPT_EMAIL not set or using default"
        echo "   Set LETSENCRYPT_EMAIL to your actual email address"
        return 1
    fi
    
    echo "✅ SSL configuration validation passed"
    return 0
}

# Function to check certificate expiry
check_certificate_expiry() {
    local cert_file="$1"
    
    if [ -f "$cert_file" ]; then
        local expiry_date=$(openssl x509 -enddate -noout -in "$cert_file" | cut -d= -f2)
        local expiry_timestamp=$(date -d "$expiry_date" +%s)
        local current_timestamp=$(date +%s)
        local days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
        
        echo "📅 Certificate expires in $days_until_expiry days ($expiry_date)"
        
        if [ $days_until_expiry -lt 30 ]; then
            echo "⚠️  Certificate expires in less than 30 days - renewal recommended"
        fi
    else
        echo "❌ Certificate file not found: $cert_file"
    fi
}

# Main execution
case "${1:-setup}" in
    "setup")
        echo "🔧 SSL Certificate Setup"
        echo "======================="
        
        if validate_ssl_config; then
            setup_letsencrypt
        else
            echo "🔧 Using self-signed certificate for development"
            generate_self_signed_cert
        fi
        ;;
        
    "self-signed")
        echo "🔧 Generating self-signed certificate"
        generate_self_signed_cert
        ;;
        
    "validate")
        echo "🔍 Validating SSL configuration"
        validate_ssl_config
        ;;
        
    "check-expiry")
        echo "📅 Checking certificate expiry"
        check_certificate_expiry "$SSL_DIR/cert.pem"
        ;;
        
    "help")
        echo "SSL Certificate Management Script"
        echo "================================"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  setup        - Setup SSL certificates (default)"
        echo "  self-signed  - Generate self-signed certificate"
        echo "  validate     - Validate SSL configuration"
        echo "  check-expiry - Check certificate expiry"
        echo "  help         - Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  DOMAIN_NAME       - Your domain name"
        echo "  LETSENCRYPT_EMAIL - Email for Let's Encrypt"
        ;;
        
    *)
        echo "❌ Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac

echo ""
echo "🔒 SSL setup completed!"