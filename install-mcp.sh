#!/bin/sh
set -eu
cd "$(dirname "$0")"
node tools/setup.mjs
exec node tools/install-mcp.mjs --skip-deps "$@"
