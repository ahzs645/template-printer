#!/bin/sh
set -e

# Output to stderr to ensure visibility
echo "=== ENTRYPOINT: Starting container as user: $(id)" >&2

# Resolve data directory target
DATA_DIR_PATH=${DATA_DIR:-/app/backend/data}

# Create data directory if it doesn't exist
mkdir -p "$DATA_DIR_PATH"
echo "=== ENTRYPOINT: Data directory created/verified at ${DATA_DIR_PATH}" >&2

# Always fix permissions for volume-mounted directories
echo "=== ENTRYPOINT: Fixing permissions for ${DATA_DIR_PATH}" >&2
chown -R nodejs:nodejs "$DATA_DIR_PATH"
chmod -R 775 "$DATA_DIR_PATH"

# Also ensure uploads directory exists with correct permissions
mkdir -p /app/backend/uploads
chown -R nodejs:nodejs /app/backend/uploads
chmod -R 775 /app/backend/uploads

# List permissions to verify
echo "=== ENTRYPOINT: Permissions after fix:" >&2
ls -la "$DATA_DIR_PATH" >&2 || true
ls -la /app/backend/ >&2

# Drop to nodejs user and execute command
echo "=== ENTRYPOINT: Switching to nodejs user and executing: $@" >&2
exec su-exec nodejs "$@"
