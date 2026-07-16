#!/bin/zsh
set -e
cd "$(dirname "$0")"
bash scripts/launch.sh apply
read -n 1 -s -r "?按任意键关闭此窗口…"
