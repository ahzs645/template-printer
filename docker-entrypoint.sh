#!/bin/sh
set -e

# Create data directory if it doesn't exist
mkdir -p /app/backend/data

# Fix permissions if running as root (will be dropped to nodejs user)
if [ "$(id -u)" = "0" ]; then
  chown -R nodejs:nodejs /app/backend/data
  exec su-exec nodejs "$@"
fi

# Otherwise just run the command
exec "$@"
