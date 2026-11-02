#!/bin/sh
set -eu
backup_dir="${1:-backups/$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$backup_dir"
# Pause writes so MongoDB documents and private assets belong to one consistent backup.
docker compose stop app
trap 'docker compose start app >/dev/null' EXIT INT TERM
docker compose exec -T db sh -c 'mongodump --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db exam --archive --gzip' > "$backup_dir/database.archive.gz"
docker compose run --rm --no-deps --entrypoint tar app -C /app/data -czf - assets > "$backup_dir/assets.tar.gz"
echo "Backup saved to $backup_dir"
