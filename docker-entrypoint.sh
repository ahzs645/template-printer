#!/bin/sh
set -e

echo "Starting container as user: $(id)"

# Create data directory if it doesn't exist
mkdir -p /app/backend/data
echo "Data directory created/verified: /app/backend/data"

# Always fix permissions for volume-mounted directories
echo "Fixing permissions for /app/backend/data"
chown -R nodejs:nodejs /app/backend/data

# List permissions to verify
ls -la /app/backend/data

# Drop to nodejs user and execute command
echo "Switching to nodejs user and executing: $@"
exec su-exec nodejs "$@"
