#!/bin/sh
# Builds the site and serves it on http://localhost:8095 (PORT=3000 ./start.sh for another port).
cd "$(dirname "$0")" || exit 1
port="${PORT:-8095}"
# A previous preview still holding the port is stopped first, so this always serves the latest code.
for pid in $(lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null); do
  case "$(ps -o command= -p "$pid")" in
    *scripts/serve.mjs*) kill "$pid" && echo "Ancien serveur arrêté (port $port)." ;;
    *) echo "Le port $port est pris par un autre programme (pid $pid). Essaie : PORT=3000 ./start.sh"; exit 1 ;;
  esac
done
sleep 0.3
exec npm run dev
