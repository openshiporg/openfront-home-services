#!/bin/sh
# Live start: the background worker (outbox drain, expiry, price-book activation) runs beside the
# web server, restarted if it ever exits. The web server is the foreground process, so the
# container lives and dies with it.
( while true; do npx tsx scripts/worker.ts --loop; echo "worker exited; restarting in 5s" >&2; sleep 5; done ) &
exec npx next start
