#!/bin/sh
cd "$(git rev-parse --show-toplevel)"
echo "Pre-commit: running build check..."

# Windows Git Bash needs npm.cmd; Unix uses npm
if command -v npm.cmd > /dev/null 2>&1; then
  npm.cmd run build
else
  npm run build
fi

if [ $? -ne 0 ]; then
  echo "Build failed. Commit blocked."
  exit 1
fi
