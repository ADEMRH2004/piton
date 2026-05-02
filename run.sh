#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/fastapi_backend"
FRONTEND_DIR="$ROOT_DIR/nextjs-frontend"

function usage() {
  cat <<EOF
Usage: $0 <command>

Commands:
  install         Install backend and frontend dependencies
  run             Start backend and frontend locally
  docker-up       Build and start all Docker Compose services
  docker-build    Build all Docker Compose services
  docker-down     Stop Docker Compose services
  help            Display this help message
EOF
}

function ensure_node_tools() {
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "pnpm not found, installing globally..."
    npm install -g pnpm
  fi
}

function ensure_uv() {
  if [ -x "$BACKEND_DIR/.venv/bin/uv" ]; then
    return
  fi

  if [ ! -d "$BACKEND_DIR/.venv" ]; then
    echo "Creating backend virtual environment..."
    python3 -m venv "$BACKEND_DIR/.venv"
  fi

  echo "Installing uv into backend virtual environment..."
  "$BACKEND_DIR/.venv/bin/python" -m pip install --upgrade pip
  "$BACKEND_DIR/.venv/bin/python" -m pip install uv
}

function install_backend() {
  echo "Installing backend dependencies..."
  ensure_uv
  cd "$BACKEND_DIR"
  PATH="$BACKEND_DIR/.venv/bin:$PATH" uv sync --frozen
}

function install_frontend() {
  echo "Installing frontend dependencies..."
  ensure_node_tools
  cd "$FRONTEND_DIR"
  pnpm install
  if [ -f ".env.example" ] && [ ! -f ".env" ]; then
    cp .env.example .env
    echo "Created frontend .env from .env.example"
  fi
}

function install_all() {
  install_backend
  install_frontend
  echo "Installation complete."
}

function run_local() {
  echo "Starting backend and frontend locally..."
  cd "$BACKEND_DIR"
  ./start.sh &
  BACKEND_PID=$!

  cd "$FRONTEND_DIR"
  ./start.sh &
  FRONTEND_PID=$!

  trap 'echo "Stopping local services..."; kill "$BACKEND_PID" "$FRONTEND_PID"; exit' INT TERM
  wait
}

function docker_compose() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
  else
    echo "Docker Compose is not installed. Please install Docker Compose." >&2
    exit 1
  fi
}

function docker_up() {
  echo "Building and starting Docker Compose services..."
  cd "$ROOT_DIR"
  $(docker_compose) up --build
}

function docker_build() {
  echo "Building Docker Compose services..."
  cd "$ROOT_DIR"
  $(docker_compose) build --no-cache
}

function docker_down() {
  echo "Stopping Docker Compose services..."
  cd "$ROOT_DIR"
  $(docker_compose) down
}

COMMAND="${1:-help}"
case "$COMMAND" in
  install)
    install_all
    ;;
  run)
    run_local
    ;;
  docker-up)
    docker_up
    ;;
  docker-build)
    docker_build
    ;;
  docker-down)
    docker_down
    ;;
  help|--help|-h)
    usage
    ;;
  *)
    echo "Unknown command: $COMMAND" >&2
    usage
    exit 1
    ;;
esac
