#!/bin/bash
source /root/.venv/bin/activate
cd /app/backend
export PYTHONPATH="/root/.venv/lib/python3.11/site-packages:$PYTHONPATH"
uvicorn server:app --host 0.0.0.0 --port 8001 --workers 1 --reload