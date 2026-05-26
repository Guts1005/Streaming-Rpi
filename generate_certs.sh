#!/bin/bash
# Generate self-signed SSL certificates for Smart Helmet

echo "Generating SSL certificates..."

# Check if certificates already exist
if [ -f "cert.pem" ] && [ -f "key.pem" ]; then
    echo "✓ Certificates already exist"
    exit 0
fi

# Generate self-signed certificate valid for 365 days
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes \
    -subj "/C=IN/ST=Maharashtra/L=Nagpur/O=ThinkingRobot/OU=SmartHelmet/CN=raspberrypi"

if [ $? -eq 0 ]; then
    chmod 600 key.pem cert.pem
    echo "✓ SSL certificates generated successfully"
    echo "  - cert.pem"
    echo "  - key.pem"
else
    echo "✗ Failed to generate certificates"
    exit 1
fi
