#!/bin/bash
# run.sh <logfile> <timeout_seconds> <pid-wait: cmd...>
# macOS 自带 bash 3.2 没有 timeout，用后台 + 定时 kill 代替
LOG="$1"; shift
SECS="$1"; shift
: > "$LOG"
"$@" >> "$LOG" 2>&1 &
PID=$!
( sleep "$SECS"; kill -TERM $PID 2>/dev/null; sleep 2; kill -9 $PID 2>/dev/null ) 2>/dev/null &
WATCH=$!
wait $PID 2>/dev/null; RC=$?
kill $WATCH 2>/dev/null
echo "exit=$RC" >> "$LOG"
exit $RC
