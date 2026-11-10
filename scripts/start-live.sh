#!/bin/sh
# Live start: the web server only. No timers: time-based states advance on the requests that touch them (services/maintenance.ts).
exec npx next start
