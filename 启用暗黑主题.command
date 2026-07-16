#!/bin/zsh
set -e
cd "$(dirname "$0")"
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node src/inject.mjs 9341 --enable-dark
read -n 1 -s -r "?按任意键关闭此窗口…"
