#!/bin/zsh
cd -- "$(dirname -- "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  print '请先安装 Node.js 20 或更新版本。'
  read -k 1
  exit 1
fi
if curl -fsS --max-time 2 http://127.0.0.1:4174/ >/dev/null 2>&1; then
  open http://127.0.0.1:4174/
else
  (sleep 1; open http://127.0.0.1:4174/) &
  node scripts/serve.mjs
fi
