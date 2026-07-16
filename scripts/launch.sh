#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
MODE="${1:-apply}"
STATE_ROOT="$HOME/Library/Application Support/CodexBackgroundColor"
STATE_FILE="$STATE_ROOT/state"
LOG_FILE="$STATE_ROOT/injector.log"
PORT=9341

fail() { /usr/bin/osascript -e "display alert \"Codex 背景色\" message \"$1\" as critical" >/dev/null 2>&1 || true; printf '%s\n' "$1" >&2; exit 1; }

discover_codex() {
  local candidate identifier executable
  for candidate in "${CODEX_APP_BUNDLE:-}" "/Applications/ChatGPT.app" "/Applications/Codex.app" "$HOME/Applications/ChatGPT.app" "$HOME/Applications/Codex.app"; do
    [ -n "$candidate" ] && [ -f "$candidate/Contents/Info.plist" ] || continue
    identifier="$(/usr/bin/plutil -extract CFBundleIdentifier raw -o - "$candidate/Contents/Info.plist" 2>/dev/null || true)"
    [ "$identifier" = "com.openai.codex" ] && { CODEX_BUNDLE="$candidate"; break; }
  done
  if [ -z "${CODEX_BUNDLE:-}" ]; then
    candidate="$(/usr/bin/mdfind 'kMDItemCFBundleIdentifier == "com.openai.codex"' | /usr/bin/head -n 1)"
    [ -n "$candidate" ] && [ -f "$candidate/Contents/Info.plist" ] || fail "找不到官方 Codex 应用（com.openai.codex）。"
    CODEX_BUNDLE="$candidate"
  fi
  executable="$(/usr/bin/plutil -extract CFBundleExecutable raw -o - "$CODEX_BUNDLE/Contents/Info.plist")"
  CODEX_EXE="$CODEX_BUNDLE/Contents/MacOS/$executable"
  NODE="$CODEX_BUNDLE/Contents/Resources/cua_node/bin/node"
  [ -x "$CODEX_EXE" ] || fail "Codex 可执行文件不可用。"
  [ -x "$NODE" ] || fail "未找到 Codex 内置 Node 运行时。"
  /usr/bin/codesign --verify --deep --strict "$CODEX_BUNDLE" >/dev/null 2>&1 || fail "Codex 应用签名无效，请先重新安装官方应用。"
}

wait_for_cdp() {
  local i attempts="${1:-80}"
  for i in $(/usr/bin/seq 1 "$attempts"); do
    /usr/bin/curl -fsS "http://127.0.0.1:$PORT/json/list" >/dev/null 2>&1 && return 0
    /bin/sleep 0.5
  done
  return 1
}

stop_watcher() {
  [ -f "$STATE_FILE" ] || return 0
  local pid
  pid="$(/bin/cat "$STATE_FILE" 2>/dev/null || true)"
  case "$pid" in ''|*[!0-9]*) ;; *) /bin/kill "$pid" 2>/dev/null || true ;; esac
  /bin/rm -f "$STATE_FILE"
}

codex_running() {
  /bin/ps -axo pid=,comm= | /usr/bin/awk -v exe="$CODEX_EXE" '$2 == exe { found=1 } END { exit !found }'
}

stop_codex() {
  local i
  /usr/bin/osascript -e 'tell application id "com.openai.codex" to quit' >/dev/null 2>&1 || true
  for i in $(/usr/bin/seq 1 60); do
    codex_running || return 0
    /bin/sleep 0.25
  done
  # 已由用户主动点击应用，允许结束未响应的旧主进程，避免它吞掉新的 CDP 参数。
  /bin/ps -axo pid=,comm= | /usr/bin/awk -v exe="$CODEX_EXE" '$2 == exe { print $1 }' | /usr/bin/xargs -n 1 /bin/kill -TERM 2>/dev/null || true
  for i in $(/usr/bin/seq 1 20); do
    codex_running || return 0
    /bin/sleep 0.25
  done
  ! codex_running
}

/bin/mkdir -p "$STATE_ROOT"
/bin/chmod 700 "$STATE_ROOT"
discover_codex

if [ "$MODE" = "remove" ]; then
  stop_watcher
  if /usr/bin/curl -fsS "http://127.0.0.1:$PORT/json/list" >/dev/null 2>&1; then
    "$NODE" "$ROOT/src/inject.mjs" "$PORT" --remove || true
  fi
  printf '已停止背景注入器；Codex 安装包未被修改。\n'
  exit 0
fi

stop_watcher
if ! /usr/bin/curl -fsS "http://127.0.0.1:$PORT/json/list" >/dev/null 2>&1; then
  stop_codex || fail "Codex 没有在预期时间内退出，无法安全启用背景注入。"
  : > "$STATE_ROOT/codex-launch.log"
  : > "$STATE_ROOT/codex-launch-error.log"
  /usr/bin/open -na "$CODEX_BUNDLE" --args --remote-debugging-address=127.0.0.1 --remote-debugging-port="$PORT" \
    >>"$STATE_ROOT/codex-launch.log" 2>>"$STATE_ROOT/codex-launch-error.log" || true
  if ! wait_for_cdp 30; then
    # 部分 macOS 构建会吞掉 open --args；此时直接启动经 Info.plist 验证的官方二进制。
    stop_codex || fail "Codex 没有在预期时间内退出，无法改用 CDP 兜底启动。"
    /usr/bin/nohup "$CODEX_EXE" --remote-debugging-address=127.0.0.1 --remote-debugging-port="$PORT" \
      >>"$STATE_ROOT/codex-launch.log" 2>>"$STATE_ROOT/codex-launch-error.log" &
    wait_for_cdp || fail "Codex 没有启动本机 CDP 接口。查看：$STATE_ROOT/codex-launch-error.log"
  fi
fi

# 先移除当前窗口里可能由旧 watcher 注入的内存脚本，再加载磁盘中的最新版。
# 否则注入器的 installed 标记会使更新后的 UI/CSS 永远不生效。
"$NODE" "$ROOT/src/inject.mjs" "$PORT" --remove >/dev/null 2>&1 || true
"$NODE" "$ROOT/src/inject.mjs" "$PORT" || fail "无法将背景控件注入 Codex。"
/usr/bin/nohup "$NODE" "$ROOT/src/inject.mjs" "$PORT" --watch >>"$LOG_FILE" 2>&1 &
echo $! > "$STATE_FILE"
printf '已应用背景控件。右下角 ◐ 可设置图片、透明度和主题。\n'
