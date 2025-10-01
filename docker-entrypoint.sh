#!/bin/sh
set -e

# Output to both stdout and stderr to ensure visibility
echo "=== ENTRYPOINT: Starting container as user: $(id)"
echo "=== ENTRYPOINT: Starting container as user: $(id)" >&2

# Resolve data directory target
DATA_DIR_PATH=${DATA_DIR:-/app/backend/data}
echo "=== ENTRYPOINT: DATA_DIR_PATH=${DATA_DIR_PATH}"

# Create data directory if it doesn't exist
mkdir -p "$DATA_DIR_PATH" || {
  echo "ERROR: Failed to create directory ${DATA_DIR_PATH}" >&2
  exit 1
}
echo "=== ENTRYPOINT: Data directory created/verified at ${DATA_DIR_PATH}"

# Always fix permissions for volume-mounted directories
echo "=== ENTRYPOINT: Fixing permissions for ${DATA_DIR_PATH}"
chown -R nodejs:nodejs "$DATA_DIR_PATH" || {
  echo "ERROR: Failed to chown ${DATA_DIR_PATH}" >&2
  exit 1
}
chmod -R 775 "$DATA_DIR_PATH" || {
  echo "ERROR: Failed to chmod ${DATA_DIR_PATH}" >&2
  exit 1
}

# Also ensure uploads directory exists with correct permissions
mkdir -p /app/backend/uploads
chown -R nodejs:nodejs /app/backend/uploads
chmod -R 775 /app/backend/uploads

# List permissions to verify
echo "=== ENTRYPOINT: Permissions after fix:"
ls -la "$DATA_DIR_PATH" || true
ls -la /app/backend/

# Drop to nodejs user and execute command
echo "=== ENTRYPOINT: Switching to nodejs user and executing: $@"
exec su-exec nodejs "$@"
