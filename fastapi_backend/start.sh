#!/bin/bash

if [ -f /.dockerenv ]; then
    echo "Running in Docker"
    /app/.venv/bin/fastapi dev app/main.py --host 0.0.0.0 --port 8000 --reload &
    /app/.venv/bin/python watcher.py
else
    echo "Running locally with uv"
    uv run fastapi dev app/main.py --host 0.0.0.0 --port 8000 --reload &
    uv run python watcher.py
fi

wait
