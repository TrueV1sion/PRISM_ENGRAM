#!/usr/bin/env bash
#
# Start all 15 Protoprism-built MCP servers in HTTP transport mode.
# Each server listens on its designated port (3010-3024) matching the
# MCP_*_URL entries in .env.
#
# Usage:
#   ./scripts/start-mcp-servers.sh          # Start all servers
#   ./scripts/start-mcp-servers.sh stop     # Stop all servers
#   ./scripts/start-mcp-servers.sh status   # Check which servers are running
#

set -euo pipefail

SERVERS_DIR="$(cd "$(dirname "$0")/../mcp-servers" && pwd)"
PID_DIR="/tmp/protoprism-mcp-pids"
LOG_DIR="/tmp/protoprism-mcp-logs"

# Server definitions: name|directory|port|transport_method
# transport_method: env = uses TRANSPORT/PORT env vars
#                   env-alt = uses MCP_TRANSPORT/MCP_PORT env vars
#                   cli = uses --http --port=N CLI flags
SERVERS=(
  "openfda|openfda-mcp-server|3010|env"
  "sec-edgar|sec-edgar-mcp-server|3011|env-alt"
  "federal-register|federal-register-mcp-server|3012|cli"
  "uspto-patents|uspto-patents-mcp-server|3013|cli"
  "congress-gov|congress-gov-mcp-server|3014|cli"
  "bls-data|bls-data-mcp-server|3015|cli-env-port"
  "census-bureau|census-bureau-mcp-server|3016|cli"
  "who-gho|who-gho-mcp-server|3017|env"
  "gpo-govinfo|gpo-govinfo-mcp-server|3018|env"
  "cbo|cbo-mcp-server|3019|env"
  "oecd-health|oecd-health-mcp-server|3020|env"
  "sam-gov|sam-gov-mcp-server|3021|env"
  "fda-orange-book|fda-orange-book-mcp-server|3022|cli"
  "grants-gov|grants-gov-mcp-server|3023|env"
  "ahrq-hcup|ahrq-hcup-mcp-server|3024|env"
)

# Load API keys from .env if present
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source <(grep -E '^[A-Z_]+=' "$ENV_FILE" | grep -v '^#')
  set +a
fi

start_servers() {
  mkdir -p "$PID_DIR" "$LOG_DIR"

  local started=0
  local failed=0

  for entry in "${SERVERS[@]}"; do
    IFS='|' read -r name dir port method <<< "$entry"
    local server_dir="$SERVERS_DIR/$dir"
    local pid_file="$PID_DIR/$name.pid"
    local log_file="$LOG_DIR/$name.log"

    # Check if already running
    if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
      echo "  [SKIP] $name already running (PID $(cat "$pid_file")) on port $port"
      ((started++))
      continue
    fi

    # Verify dist/index.js exists
    if [ ! -f "$server_dir/dist/index.js" ]; then
      echo "  [FAIL] $name: dist/index.js not found in $server_dir"
      ((failed++))
      continue
    fi

    # Build the command based on transport method
    case "$method" in
      env)
        # Uses TRANSPORT=http and PORT=XXXX env vars
        TRANSPORT=http PORT="$port" node "$server_dir/dist/index.js" \
          > "$log_file" 2>&1 &
        ;;
      env-alt)
        # Uses MCP_TRANSPORT=http and MCP_PORT=XXXX env vars
        MCP_TRANSPORT=http MCP_PORT="$port" node "$server_dir/dist/index.js" \
          > "$log_file" 2>&1 &
        ;;
      cli)
        # Uses --http --port XXXX CLI flags (space-separated)
        node "$server_dir/dist/index.js" --http --port "$port" \
          > "$log_file" 2>&1 &
        ;;
      cli-env-port)
        # Uses --http CLI flag + PORT env var
        PORT="$port" node "$server_dir/dist/index.js" --http \
          > "$log_file" 2>&1 &
        ;;
    esac

    local pid=$!
    echo "$pid" > "$pid_file"

    # Brief wait and verify it didn't crash immediately
    sleep 0.3
    if kill -0 "$pid" 2>/dev/null; then
      echo "  [OK]   $name (PID $pid) on port $port"
      ((started++))
    else
      echo "  [FAIL] $name crashed on startup — see $log_file"
      rm -f "$pid_file"
      ((failed++))
    fi
  done

  echo ""
  echo "Started: $started  Failed: $failed"
  echo "Logs: $LOG_DIR/"
}

stop_servers() {
  if [ ! -d "$PID_DIR" ]; then
    echo "No servers running (no PID directory)"
    return
  fi

  local stopped=0
  for entry in "${SERVERS[@]}"; do
    IFS='|' read -r name _ _ _ <<< "$entry"
    local pid_file="$PID_DIR/$name.pid"

    if [ -f "$pid_file" ]; then
      local pid
      pid=$(cat "$pid_file")
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
        echo "  [STOP] $name (PID $pid)"
        ((stopped++))
      fi
      rm -f "$pid_file"
    fi
  done

  echo ""
  echo "Stopped: $stopped servers"
}

check_status() {
  local running=0
  local total=${#SERVERS[@]}

  for entry in "${SERVERS[@]}"; do
    IFS='|' read -r name _ port _ <<< "$entry"
    local pid_file="$PID_DIR/$name.pid"

    if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
      echo "  [UP]   $name  port=$port  PID=$(cat "$pid_file")"
      ((running++))
    else
      echo "  [DOWN] $name  port=$port"
    fi
  done

  echo ""
  echo "$running / $total servers running"
}

# ─── Main ─────────────────────────────────────────────────────

case "${1:-start}" in
  start)
    echo "Starting Protoprism MCP servers..."
    start_servers
    ;;
  stop)
    echo "Stopping Protoprism MCP servers..."
    stop_servers
    ;;
  status)
    echo "Protoprism MCP server status:"
    check_status
    ;;
  restart)
    echo "Restarting Protoprism MCP servers..."
    stop_servers
    echo ""
    sleep 1
    start_servers
    ;;
  *)
    echo "Usage: $0 {start|stop|status|restart}"
    exit 1
    ;;
esac
