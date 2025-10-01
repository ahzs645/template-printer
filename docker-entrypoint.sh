#!/bin/sh
set -e

# Output to stderr to ensure visibility
echo "=== ENTRYPOINT: Starting container as user: $(id)" >&2

# Create data directory if it doesn't exist
mkdir -p /app/backend/data
echo "=== ENTRYPOINT: Data directory created/verified" >&2

# Always fix permissions for volume-mounted directories
echo "=== ENTRYPOINT: Fixing permissions for /app/backend/data" >&2
chown -R nodejs:nodejs /app/backend/data
chmod -R 755 /app/backend/data

# Also ensure uploads directory exists with correct permissions
mkdir -p /app/backend/uploads
chown -R nodejs:nodejs /app/backend/uploads
chmod -R 755 /app/backend/uploads

# List permissions to verify
echo "=== ENTRYPOINT: Permissions after fix:" >&2
ls -la /app/backend/ >&2

# Drop to nodejs user and execute command
echo "=== ENTRYPOINT: Switching to nodejs user and executing: $@" >&2
exec su-exec nodejs "$@"
