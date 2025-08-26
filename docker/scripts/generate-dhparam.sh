#!/bin/bash

# Generate DH Parameters for Enhanced SSL Security
# This script generates Diffie-Hellman parameters for stronger SSL encryption

set -e

DH_SIZE="${DH_SIZE:-2048}"
SSL_DIR="./docker/ssl"
DH_FILE="$SSL_DIR/dhparam.pem"

echo "🔐 Generating DH Parameters for SSL Security"
echo "============================================"

# Create SSL directory if it doesn't exist
mkdir -p "$SSL_DIR"

# Check if DH parameters already exist
if [ -f "$DH_FILE" ]; then
    echo "📋 DH parameters already exist at $DH_FILE"
    
    # Check if they're valid
    if openssl dhparam -in "$DH_FILE" -check -noout 2>/dev/null; then
        echo "✅ Existing DH parameters are valid"
        
        # Check the key size
        existing_size=$(openssl dhparam -in "$DH_FILE" -text -noout | grep "DH Parameters" | grep -o '[0-9]\+' | head -1)
        echo "📏 Existing DH parameter size: ${existing_size:-unknown} bits"
        
        if [ "$existing_size" = "$DH_SIZE" ]; then
            echo "✅ DH parameters are already the correct size ($DH_SIZE bits)"
            exit 0
        else
            echo "⚠️  DH parameters are $existing_size bits, but $DH_SIZE bits requested"
            read -p "Regenerate DH parameters? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "ℹ️  Keeping existing DH parameters"
                exit 0
            fi
        fi
    else
        echo "❌ Existing DH parameters are invalid, regenerating..."
    fi
fi

# Generate new DH parameters
echo "🔄 Generating $DH_SIZE-bit DH parameters..."
echo "⏱️  This may take several minutes depending on system performance..."

start_time=$(date +%s)

# Generate DH parameters with progress indication
if command -v pv >/dev/null 2>&1; then
    # Use pv for progress indication if available
    openssl dhparam -out "$DH_FILE" "$DH_SIZE" 2>&1 | pv -l -s 100 > /dev/null
else
    # Generate without progress indication
    openssl dhparam -out "$DH_FILE" "$DH_SIZE"
fi

end_time=$(date +%s)
duration=$((end_time - start_time))

echo "✅ DH parameters generated successfully!"
echo "📁 Location: $DH_FILE"
echo "⏱️  Generation time: ${duration} seconds"

# Verify the generated parameters
echo "🔍 Verifying DH parameters..."
if openssl dhparam -in "$DH_FILE" -check -noout; then
    echo "✅ DH parameters verification passed"
    
    # Display parameter information
    echo "📋 DH Parameter Information:"
    openssl dhparam -in "$DH_FILE" -text -noout | head -5
else
    echo "❌ DH parameters verification failed"
    rm -f "$DH_FILE"
    exit 1
fi

# Set appropriate permissions
chmod 644 "$DH_FILE"
echo "🔒 Set appropriate permissions (644) on DH parameters file"

# Create backup
backup_file="$SSL_DIR/dhparam.pem.backup.$(date +%Y%m%d_%H%M%S)"
cp "$DH_FILE" "$backup_file"
echo "💾 Backup created: $backup_file"

echo ""
echo "🎉 DH Parameters Setup Complete!"
echo "================================"
echo ""
echo "The DH parameters have been generated and are ready for use with nginx SSL configuration."
echo "Make sure to include the following line in your nginx SSL configuration:"
echo ""
echo "    ssl_dhparam $DH_FILE;"
echo ""
echo "For enhanced security, consider:"
echo "1. Regenerating DH parameters periodically (monthly/quarterly)"
echo "2. Using 4096-bit parameters for maximum security (slower performance)"
echo "3. Keeping backups of your DH parameters in a secure location"
echo ""

# Optional: Test with nginx configuration
if command -v nginx >/dev/null 2>&1; then
    echo "🔍 Testing nginx configuration with new DH parameters..."
    if nginx -t 2>/dev/null; then
        echo "✅ Nginx configuration test passed"
    else
        echo "⚠️  Nginx configuration test failed - please check your SSL configuration"
    fi
fi

echo "✅ DH Parameters generation completed successfully!"