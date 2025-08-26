#!/bin/bash

# SSL Certificate Renewal Script
# This script handles automatic renewal of Let's Encrypt certificates

set -e

DOMAIN_NAME="${DOMAIN_NAME:-localhost}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-admin@example.com}"

echo "🔄 SSL Certificate Renewal for $DOMAIN_NAME"
echo "============================================"

# Function to check if certificate needs renewal
needs_renewal() {
    local cert_file="/etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem"
    
    if [ ! -f "$cert_file" ]; then
        echo "📝 Certificate not found, needs initial creation"
        return 0
    fi
    
    # Check if certificate expires in less than 30 days
    local expiry_date=$(openssl x509 -enddate -noout -in "$cert_file" | cut -d= -f2)
    local expiry_timestamp=$(date -d "$expiry_date" +%s)
    local current_timestamp=$(date +%s)
    local days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
    
    echo "📅 Certificate expires in $days_until_expiry days"
    
    if [ $days_until_expiry -lt 30 ]; then
        echo "⚠️  Certificate needs renewal (expires in less than 30 days)"
        return 0
    else
        echo "✅ Certificate is still valid"
        return 1
    fi
}

# Function to renew certificate
renew_certificate() {
    echo "🔄 Renewing certificate for $DOMAIN_NAME..."
    
    # Pre-renewal checks
    echo "🔍 Performing pre-renewal checks..."
    
    # Check if webroot directory exists and is writable
    if [ ! -d "/var/www/certbot" ]; then
        echo "❌ Certbot webroot directory not found"
        return 1
    fi
    
    if [ ! -w "/var/www/certbot" ]; then
        echo "❌ Certbot webroot directory not writable"
        return 1
    fi
    
    # Check if domain is still accessible
    if ! curl -s --connect-timeout 10 "http://$DOMAIN_NAME/.well-known/acme-challenge/" > /dev/null 2>&1; then
        echo "⚠️  Warning: ACME challenge endpoint may not be accessible"
    fi
    
    # Attempt renewal with detailed logging
    echo "🔄 Attempting certificate renewal..."
    if certbot renew \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$LETSENCRYPT_EMAIL" \
        --agree-tos \
        --no-eff-email \
        --quiet \
        --no-random-sleep-on-renew; then
        
        echo "✅ Certificate renewed successfully"
        
        # Verify the new certificate
        local cert_file="/etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem"
        if [ -f "$cert_file" ]; then
            local expiry_date=$(openssl x509 -enddate -noout -in "$cert_file" | cut -d= -f2)
            echo "📅 New certificate expires: $expiry_date"
        fi
        
        # Test nginx configuration before reload
        echo "🔍 Testing nginx configuration..."
        if nginx -t 2>/dev/null; then
            echo "✅ Nginx configuration is valid"
            
            # Reload nginx to use new certificate
            echo "🔄 Reloading nginx with new certificate..."
            if nginx -s reload; then
                echo "✅ Nginx reloaded successfully"
                
                # Verify SSL is working
                sleep 2
                if curl -s --connect-timeout 10 "https://$DOMAIN_NAME/health" > /dev/null; then
                    echo "✅ SSL certificate is working correctly"
                else
                    echo "⚠️  Warning: SSL endpoint may not be responding"
                fi
            else
                echo "❌ Failed to reload nginx"
                return 1
            fi
        else
            echo "❌ Nginx configuration test failed"
            echo "🔍 Nginx configuration errors:"
            nginx -t
            return 1
        fi
    else
        echo "❌ Certificate renewal failed"
        echo "🔍 Checking certbot logs for details..."
        tail -n 20 /var/log/letsencrypt/letsencrypt.log 2>/dev/null || echo "No certbot logs available"
        return 1
    fi
}

# Function to create initial certificate
create_initial_certificate() {
    echo "📝 Creating initial certificate for $DOMAIN_NAME..."
    
    certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$LETSENCRYPT_EMAIL" \
        --agree-tos \
        --no-eff-email \
        --force-renewal \
        -d "$DOMAIN_NAME"
    
    if [ $? -eq 0 ]; then
        echo "✅ Initial certificate created successfully"
    else
        echo "❌ Failed to create initial certificate"
        return 1
    fi
}

# Function to validate certificate
validate_certificate() {
    local cert_file="/etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem"
    
    if [ -f "$cert_file" ]; then
        echo "🔍 Validating certificate..."
        
        # Check certificate validity
        if openssl x509 -checkend 86400 -noout -in "$cert_file"; then
            echo "✅ Certificate is valid for at least 24 hours"
        else
            echo "⚠️  Certificate expires within 24 hours"
        fi
        
        # Display certificate information
        echo "📋 Certificate Information:"
        openssl x509 -subject -issuer -dates -noout -in "$cert_file"
    else
        echo "❌ Certificate file not found: $cert_file"
        return 1
    fi
}

# Function to send renewal notification
send_notification() {
    local status="$1"
    local message="$2"
    
    echo "📧 Sending notification: $status - $message"
    
    # Here you could add webhook notifications, email alerts, etc.
    # For now, just log to syslog
    logger "SSL Certificate Renewal: $status - $message for domain $DOMAIN_NAME"
}

# Main execution
main() {
    echo "🚀 Starting SSL certificate renewal process..."
    
    # Validate environment
    if [ -z "$DOMAIN_NAME" ] || [ "$DOMAIN_NAME" = "localhost" ]; then
        echo "⚠️  DOMAIN_NAME not properly configured"
        exit 1
    fi
    
    # Check if certificate exists and needs renewal
    if needs_renewal; then
        if [ -f "/etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem" ]; then
            # Renew existing certificate
            if renew_certificate; then
                send_notification "SUCCESS" "Certificate renewed successfully"
                validate_certificate
            else
                send_notification "ERROR" "Certificate renewal failed"
                exit 1
            fi
        else
            # Create initial certificate
            if create_initial_certificate; then
                send_notification "SUCCESS" "Initial certificate created successfully"
                validate_certificate
            else
                send_notification "ERROR" "Initial certificate creation failed"
                exit 1
            fi
        fi
    else
        echo "ℹ️  No renewal needed at this time"
        validate_certificate
    fi
    
    echo "✅ SSL certificate renewal process completed"
}

# Handle script arguments
case "${1:-renew}" in
    "renew")
        main
        ;;
    "force")
        echo "🔄 Forcing certificate renewal..."
        renew_certificate
        ;;
    "create")
        echo "📝 Creating initial certificate..."
        create_initial_certificate
        ;;
    "validate")
        echo "🔍 Validating certificate..."
        validate_certificate
        ;;
    "help")
        echo "SSL Certificate Renewal Script"
        echo "============================="
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  renew    - Check and renew certificate if needed (default)"
        echo "  force    - Force certificate renewal"
        echo "  create   - Create initial certificate"
        echo "  validate - Validate existing certificate"
        echo "  help     - Show this help message"
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac