#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.local/node-v22.22.0-darwin-arm64/bin:$PATH"
BIN="$HOME/.local/pgsql/bin"
DATA_DIR="$HOME/.local/pgsql-data/dharma"

if [ ! -x "$BIN/pg_ctl" ]; then
  echo "Local PostgreSQL not installed."
  echo "Install Docker Desktop and run: docker compose up -d db"
  echo "Or re-run this project's initial Postgres setup from Cursor."
  exit 1
fi

if [ ! -f "$DATA_DIR/PG_VERSION" ]; then
  mkdir -p "$DATA_DIR"
  "$BIN/initdb" -D "$DATA_DIR" -U postgres --auth=trust
fi

if ! "$BIN/pg_isready" -h localhost -p 5432 >/dev/null 2>&1; then
  "$BIN/pg_ctl" -D "$DATA_DIR" -l "$DATA_DIR/server.log" -o "-p 5432" start
  sleep 2
fi

"$BIN/psql" -h localhost -p 5432 -U postgres -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='dharma'" | grep -q 1 || \
  "$BIN/psql" -h localhost -p 5432 -U postgres -d postgres -c "CREATE DATABASE dharma;"

cd "$ROOT"
npm run db:push
npm run seed
echo "Local dev ready. Run: npm run dev"
echo "Frontend: http://localhost:7011"
echo "Admin login: admin / admin"
