#!/bin/bash

ROOT_DIR="$HOME/namecollector/worker"
LOG_DIR="$ROOT_DIR/logs"
DATA_DIR="$ROOT_DIR/data"
ERROR_LOG="$LOG_DIR/error.log"
NODE_PATH=/home/adeel/.nvm/versions/node/v22.4.0/bin/node

mkdir -p "$LOG_DIR"
mkdir -p "$DATA_DIR"

names=(
  "worker"
)

rm -dr $ROOT_DIR/profiles

cleanup() {
    echo "Terminating process..."
    kill $(jobs -p)
    exit 1
}

trap cleanup SIGINT SIGTERM


run_script() {
  local provider=$1
  local profile_dir="$ROOT_DIR/profiles/$provider"
  mkdir -p "$profile_dir"
  
  $NODE_PATH $ROOT_DIR/$provider.js $provider $profile_dir

  if [ $? -ne 0 ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] Error running script for $provider" | tee -a "$ERROR_LOG"
  fi
}

MAX_JOBS=5

if [ "$1" ]; then
  run_script "$1" &
else
  for provider in "${names[@]}"; do
    run_script "$provider" &

    while [ $(jobs -r | wc -l) -ge $MAX_JOBS ]; do
      sleep 1
    done
  done
fi

wait
