#!/usr/bin/env bash
# KumashAi'yi başlatır ve tarayıcıda açar. Çift tıklayın ya da: ./baslat.sh
cd "$(dirname "$(readlink -f "$0")")" || exit 1
PORT=8795
URL="http://127.0.0.1:$PORT"
if ! curl -fs "$URL/healthz" >/dev/null 2>&1; then
  nohup python3 app/server.py --port "$PORT" >/dev/null 2>&1 &
  for _ in $(seq 1 30); do curl -fs "$URL/healthz" >/dev/null 2>&1 && break; sleep 0.2; done
fi
xdg-open "$URL" >/dev/null 2>&1 || echo "Tarayıcıda açın: $URL"
