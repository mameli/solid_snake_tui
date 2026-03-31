#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
TEST_DIR=/tmp/solid-snake-tui-pack-test

cd "$ROOT_DIR"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"

npm pack >/dev/null
TARBALL_PATH=$(ls -t solid-snake-tui-*.tgz | head -n 1)

cat >"$TEST_DIR/package.json" <<'EOF'
{
  "name": "solid-snake-tui-pack-test",
  "private": true,
  "type": "module"
}
EOF

cd "$TEST_DIR"
bun add "$ROOT_DIR/$TARBALL_PATH" >/dev/null
exec bun x solid-snake-tui
