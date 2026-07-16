import { readFileSync } from 'node:fs';

const MARKER = 'codex-background-color-injector';
const SETTINGS_KEY = `${MARKER}:settings:v2`;
const ORIGINAL_THEME_ID = '__codex_original__';
const BUNDLED_THEME = (() => {
  const configUrl = new URL('../themes/dark/theme.json', import.meta.url);
  const config = JSON.parse(readFileSync(configUrl, 'utf8'));
  const image = readFileSync(new URL(`../themes/dark/${config.image}`, import.meta.url));
  return {
    ...config,
    imageData: `data:image/jpeg;base64,${image.toString('base64')}`,
  };
})();

function injectedScript() {
  return `/* ${MARKER} */
(() => {
  if (window.__CODEX_BACKGROUND_COLOR_STATE__?.installed) return;
  // 存储版本必须与注入器逻辑绑定。旧版会保留图片和透明度，即便卸载控件后
  // 仍会在下次注入时复现；切换到 v2 后只读取用户在当前版本明确保存的数据。
  const KEY = '${MARKER}:settings:v2';
  const ORIGINAL_THEME_ID = '${ORIGINAL_THEME_ID}';
  const ORIGINAL_TRIGGER_ID = '${MARKER}-enable-dark';
  const BUNDLED_THEME = ${JSON.stringify(BUNDLED_THEME)};
  const defaults = { opacity: 100, uiOpacity: 62, iconTheme: 'default' };
  const saved = (() => { try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return defaults; } })();
  const mountOriginalTrigger = () => {
    if (document.getElementById(ORIGINAL_TRIGGER_ID)) return;
    const trigger = document.createElement('button');
    trigger.id = ORIGINAL_TRIGGER_ID;
    trigger.type = 'button';
    trigger.title = '启用暗黑主题';
    trigger.textContent = '启用暗黑';
    Object.assign(trigger.style, {
      position: 'fixed', right: '16px', bottom: '16px', zIndex: '2147483647',
      minWidth: '88px', height: '34px', padding: '0 12px', border: '1px solid rgba(255,255,255,.36)',
      borderRadius: '10px', background: 'rgba(24,28,37,.92)', color: '#fff',
      cursor: 'pointer', font: '600 12px/1 system-ui', boxShadow: '0 3px 12px rgba(0,0,0,.22)',
    });
    trigger.addEventListener('click', () => {
      // 原始主题模式没有完整注入状态，不能只移除按钮并等待 watcher 轮询。
      // 明确切回内置主题后刷新渲染页，watcher 会立即重新注入完整工作台。
      localStorage.setItem(KEY, JSON.stringify({ ...defaults, themeId: BUNDLED_THEME.id }));
      window.location.reload();
    });
    document.body.appendChild(trigger);
  };
  // 原始模式不创建主题样式、背景层或设置面板，仅保留一个可重新启用的入口。
  if (saved.themeId === ORIGINAL_THEME_ID) { mountOriginalTrigger(); return; }
  document.getElementById(ORIGINAL_TRIGGER_ID)?.remove();
  let imageData = null;
  const root = document.documentElement;
  const appRoot = document.querySelector('#root');
  // 清理上一版误加的临时标记；不能让历史注入残留继续影响整棵界面树。
  document.querySelectorAll('.codex-background-color-usage-popover').forEach((element) => {
    element.classList.remove('codex-background-color-usage-popover');
  });
  const appRootOriginalStyle = appRoot?.getAttribute('style') ?? null;

  const style = document.createElement('style');
  style.id = '${MARKER}-style';
  style.textContent = \
    'html, body, #root, #app { background: transparent !important; }' +
    // 新版 Codex 在 main-surface 与侧栏上额外绘制 app 自带的 blob 背景。
    // 若不移除这一层，自定义背景只能处于其下方，颜色和图片都几乎不可见。
    'main.main-surface, aside.app-shell-left-panel { background-color: transparent !important; background-image: none !important; }' +
    'header.app-header-tint { background-color: transparent !important; }' +
    // 文件树是 Shadow DOM 组件；宿主默认强制 light，必须先切换宿主色彩方案。
    '#root file-tree-container { background-color: transparent !important; color: #fff !important; color-scheme: dark !important; }' +
    // 透明背景下所有界面文字都使用同一高对比度颜色；此前次要文字令牌
    // 会在项目列表与侧栏仍显示灰色，导致用户修改文字颜色看起来未生效。
    '#root { color: #fff !important; -webkit-text-fill-color: #fff !important; }' +
    '#root :is(p, span, div, button, label, li, kbd, small, time) { color: #fff !important; -webkit-text-fill-color: #fff !important; text-shadow: 0 1px 2px rgba(0,0,0,.48); }' +
    // 原生输入控件不会继承上方的白字规则，插入光标会随其原始深色 text color
    // 显示为黑色。显式设定文本与 caret 颜色，保证搜索和普通输入框一致可见。
    '#root :is(input, textarea, [contenteditable="true"]) { color: #fff !important; -webkit-text-fill-color: #fff !important; caret-color: #fff !important; }' +
    '#root :is(.text-token-description-foreground, .text-token-text-secondary, .text-token-text-tertiary, .text-fade-truncate, [class*="text-token-text-secondary"], [class*="text-token-text-tertiary"]) { color: #fff !important; -webkit-text-fill-color: #fff !important; }' +
    // 暗黑模式下，Codex 会把附加、模型、听写等操作图标单独标为
    // text-token-text-primary；它们不继承按钮文字颜色，必须直接覆盖 SVG 的 currentColor。
    '#root[data-codex-background-color-mode="dark"] :is(button, [role="button"]) svg { color: #fff !important; -webkit-text-fill-color: #fff !important; }' +
    // 工具执行摘要、思考状态和项目行的图标不一定包在 button 中；统一覆盖
    // 主内容、侧栏和顶部栏内的 SVG 色值，保留 SVG 自己的 fill="none" 轮廓结构。
    '#root[data-codex-background-color-mode="dark"] :is(main, aside, header) svg { color: #fff !important; -webkit-text-fill-color: #fff !important; }' +
    '#root[data-codex-background-color-mode="dark"] { --color-token-git-decoration-added-resource-foreground: #3eea88; --color-token-git-decoration-deleted-resource-foreground: #ff6f82; }' +
    // 变更统计属于语义信息：新增与删除必须保留各自的 Git 色，而不是跟随全局白字。
    '#root .text-token-git-decoration-added-resource-foreground { color: var(--color-token-git-decoration-added-resource-foreground) !important; -webkit-text-fill-color: var(--color-token-git-decoration-added-resource-foreground) !important; }' +
    '#root .text-token-git-decoration-deleted-resource-foreground { color: var(--color-token-git-decoration-deleted-resource-foreground) !important; -webkit-text-fill-color: var(--color-token-git-decoration-deleted-resource-foreground) !important; }' +
    // 活动摘要中的数字没有原生 Git token 类，按其位置恢复同一语义色，并保持常规字重。
    '#root [class*="group/activity-header"] .turn-diff-default-subtitle span[class*="shrink-0"] { font-weight: 400 !important; font-synthesis: none !important; }' +
    '#root [class*="group/activity-header"] .turn-diff-default-subtitle span[class*="shrink-0"]:first-child { color: var(--color-token-git-decoration-added-resource-foreground) !important; -webkit-text-fill-color: var(--color-token-git-decoration-added-resource-foreground) !important; }' +
    '#root [class*="group/activity-header"] .turn-diff-default-subtitle span[class*="shrink-0"]:last-child { color: var(--color-token-git-decoration-deleted-resource-foreground) !important; -webkit-text-fill-color: var(--color-token-git-decoration-deleted-resource-foreground) !important; }' +
    // “N 个文件已更改”与文件卡共用 turn-diff 结构，不属于 activity-header；
    // 直接命中 Git 数字本身，防止全局白字规则把 + / - 的语义色盖掉。
    '#root [class*="group/turn-diff-header"] .text-token-git-decoration-added-resource-foreground, #root [data-thread-find-skip] > .text-token-git-decoration-added-resource-foreground { color: #3eea88 !important; -webkit-text-fill-color: #3eea88 !important; font-weight: 400 !important; }' +
    '#root [class*="group/turn-diff-header"] .text-token-git-decoration-deleted-resource-foreground, #root [data-thread-find-skip] > .text-token-git-decoration-deleted-resource-foreground { color: #ff6f82 !important; -webkit-text-fill-color: #ff6f82 !important; font-weight: 400 !important; }' +
    // 汇总胶囊的数字有时不携带 Git token class；按统计容器中的固定顺序补齐语义色。
    '#root [data-thread-find-skip] > span:first-child { color: #3eea88 !important; -webkit-text-fill-color: #3eea88 !important; font-weight: 400 !important; }' +
    '#root [data-thread-find-skip] > span:last-child { color: #ff6f82 !important; -webkit-text-fill-color: #ff6f82 !important; font-weight: 400 !important; }' +
    // 悬浮“文件已更改”胶囊使用另一套 DOM；由脚本只给精确数字节点加标记。
    '#root [data-codex-diff-summary-badge] [data-codex-diff-added] { color: #3eea88 !important; -webkit-text-fill-color: #3eea88 !important; font-weight: 400 !important; }' +
    '#root [data-codex-diff-summary-badge] [data-codex-diff-deleted] { color: #ff6f82 !important; -webkit-text-fill-color: #ff6f82 !important; font-weight: 400 !important; }' +
    // 文件变更汇总是可点击的独立提示，补一条细边框以和背景图区分；不改其底色。
    // Markdown 的列表标记是独立的 ::marker 伪元素，不会继承普通文字颜色。
    // 同时为常见 Markdown 元素补齐暗黑表面与边框，避免背景图下的代码和表格失去层次。
    '#root[data-codex-background-color-mode="dark"] :is(article, .prose, [class*="prose"], [class*="markdown"]) { color: #fff !important; }' +
    '#root[data-codex-background-color-mode="dark"] :is(article, .prose, [class*="prose"], [class*="markdown"]) :is(ul, ol) > li::marker { color: #fff !important; }' +
    '#root[data-codex-background-color-mode="dark"] :is(article, .prose, [class*="prose"], [class*="markdown"]) blockquote { color: #fff !important; border-left-color: rgba(255, 255, 255, .6) !important; }' +
    '#root[data-codex-background-color-mode="dark"] :is(article, .prose, [class*="prose"], [class*="markdown"]) :is(th, td) { border-color: rgba(255, 255, 255, .2) !important; }' +
    // 仅“已编辑文件”差异卡取消底色；其他卡片使用 Codex 自己原本的表面色。
    '#root[data-codex-background-color-mode="dark"] [class*="thread-resource-card-row-padding-x"][class*="turn-diff-row-padding-y"][class*="rounded"] { background: transparent !important; border: 1px solid rgba(255, 255, 255, .2) !important; box-shadow: none !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }' +
    '#root[data-codex-background-color-mode="dark"] [class*="thread-resource-card-row-padding-x"][class*="turn-diff-row-padding-y"][class*="rounded"] :is(button, .thread-diff-virtualized) { background-color: transparent !important; background-image: none !important; }' +
    // 普通文件/文档资源卡与“已编辑文件”不是同一组件；同样保留一圈细边框。
    '#root[data-codex-background-color-mode="dark"] [class*="electron:elevation-stroke"][class*="thread-resource-card-row-padding-x"][class*="rounded-lg"] { border: 1px solid rgba(255, 255, 255, .2) !important; box-shadow: none !important; }' +
    // 资源卡内真正可见的操作按钮（打开方式、撤销、审核）使用与卡片一致的细边框。
    '#root[data-codex-background-color-mode="dark"] [class*="electron:elevation-stroke"] :is(button.end-resource-open-button, [class*="pointer-events-auto"] > button) { border-color: rgba(190, 210, 255, .48) !important; }' +
    // 侧栏仅由最外层任务/项目行绘制悬浮色，内部标题不再叠加第二层。
    // 行所在容器保留 8px 内边距。背景向两侧各扩 8px，同时补回行内边距，
    // 让悬浮色铺满侧栏而图标和标题仍保持原来的对齐位置。
    '#root aside.app-shell-left-panel :is([data-app-action-sidebar-thread-row], [data-app-action-sidebar-project-row]) { margin-inline: -8px !important; padding-inline: 16px !important; }' +
    '#root aside.app-shell-left-panel [data-app-action-sidebar-thread-row]:hover, #root aside.app-shell-left-panel [data-app-action-sidebar-project-row]:hover { background-color: rgba(115, 150, 255, .48) !important; border-radius: 8px !important; box-shadow: none !important; }' +
    // 选中态由内层标题触发器绘制，原生背景会在两侧留下父容器的空隙；改由
    // 已扩展的最外层行承接同一种颜色，悬浮和选中时的边界保持一致。
    '#root aside.app-shell-left-panel :is([data-app-action-sidebar-thread-row], [data-app-action-sidebar-project-row]):is([aria-current="page"], [aria-selected="true"], [data-state="active"], :has([aria-current="page"], [aria-selected="true"], [data-state="active"])) { background-color: rgba(115, 150, 255, .48) !important; border-radius: 8px !important; box-shadow: none !important; }' +
    '#root [data-codex-settings-nav-item]:hover { background-color: rgba(115, 150, 255, .48) !important; border-radius: 8px !important; box-shadow: none !important; }' +
    '#root aside.app-shell-left-panel [data-thread-title-trigger]:hover { background-color: transparent !important; }' +
    '#root [data-thread-title-trigger], #root [data-thread-title-trigger] * { color: #fff !important; -webkit-text-fill-color: #fff !important; }' +
    // 输出/来源等 elevation 面板不能回落到 Codex 浅色面；使用中性透明底而非蓝黑实色。
    '#root [class*="electron:elevation-prominent"] { background-color: rgba(0, 0, 0, .18) !important; border: 1px solid rgba(255, 255, 255, .2) !important; box-shadow: none !important; backdrop-filter: blur(12px) !important; -webkit-backdrop-filter: blur(12px) !important; }' +
    '#root [class*="electron:elevation-prominent"] :is(h1, h2, h3, h4, p, span, button, label, small) { color: #fff !important; -webkit-text-fill-color: #fff !important; }' +
    '#root [class*="electron:elevation-prominent"] button[data-slot="thread-summary-panel-item-button"] { border: 0 !important; border-radius: 8px !important; padding: 4px 0 !important; }' +
    '#root [class*="electron:elevation-prominent"] button[data-slot="thread-summary-panel-item-button"]:hover { border-color: transparent !important; background-color: transparent !important; }' +
    // 侧栏用量卡：用 progress 的无障碍标签精确命中，不会影响外层侧栏或普通状态提示。
    '#root [role="status"][aria-live="polite"]:has(progress[aria-label="已使用量"]) { border-color: rgba(190, 210, 255, .24) !important; }' +
    '#root [role="status"][aria-live="polite"]:has(progress[aria-label="已使用量"]) > div:last-child > button { border-color: rgba(190, 210, 255, .22) !important; }' +
    '#root [role="status"][aria-live="polite"]:has(progress[aria-label="已使用量"]) progress[aria-label="已使用量"] { accent-color: #7c9cff !important; background-color: rgba(255,255,255,.18) !important; border-radius: 999px !important; }' +
    '#root [role="status"][aria-live="polite"]:has(progress[aria-label="已使用量"]) progress[aria-label="已使用量"]::-webkit-progress-bar { background-color: rgba(255,255,255,.18) !important; border-radius: 999px !important; }' +
    '#root [role="status"][aria-live="polite"]:has(progress[aria-label="已使用量"]) progress[aria-label="已使用量"]::-webkit-progress-value { background-color: #7c9cff !important; border-radius: 999px !important; }' +
    '#root [role="status"][aria-live="polite"]:has(progress[aria-label="已使用量"]) progress[aria-label="已使用量"]::-moz-progress-bar { background-color: #7c9cff !important; border-radius: 999px !important; }' +
    // 唯一保留的两类实体 surface：输入区与输出面板；避免浅色原生底与白字冲突。
    '#root .composer-surface-chrome { background-color: rgba(0, 0, 0, .18) !important; border: 1px solid rgba(255,255,255,.22) !important; backdrop-filter: blur(12px) !important; -webkit-backdrop-filter: blur(12px) !important; box-shadow: none !important; }' +
    // 登录页没有应用工作区的实体表面；全局透明规则会让继续、注册和 API Key
    // 输入框融进背景图。仅在脚本识别出的独立认证页中恢复边界与状态层。
    '#root[data-codex-background-color-auth] { min-width: 0 !important; min-height: 100dvh !important; overflow: auto !important; font-family: Inter, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif !important; }' +
    '#root[data-codex-background-color-auth] :is(button, input, select, textarea) { box-sizing: border-box !important; }' +
    '#root[data-codex-background-color-auth] button { min-height: 40px !important; padding-inline: 16px !important; border: 1px solid rgba(255,255,255,.58) !important; border-radius: 10px !important; background-color: rgba(8, 14, 24, .16) !important; box-shadow: 0 1px 0 rgba(255,255,255,.12) inset, 0 1px 3px rgba(0,0,0,.18) !important; }' +
    '#root[data-codex-background-color-auth] button:hover:not(:disabled) { border-color: rgba(225,235,255,.88) !important; background-color: rgba(25, 42, 67, .30) !important; }' +
    '#root[data-codex-background-color-auth] button:focus-visible, #root[data-codex-background-color-auth] :is(input, select, textarea):focus-visible { outline: 2px solid rgba(184,207,255,.95) !important; outline-offset: 2px !important; }' +
    '#root[data-codex-background-color-auth] button:disabled { border-color: rgba(255,255,255,.34) !important; background-color: rgba(8, 14, 24, .10) !important; color: rgba(255,255,255,.58) !important; box-shadow: none !important; }' +
    '#root[data-codex-background-color-auth] :is(input, select, textarea) { width: min(100%, 520px) !important; min-height: 44px !important; padding: 10px 14px !important; border: 1px solid rgba(255,255,255,.62) !important; border-radius: 11px !important; background-color: rgba(8, 14, 24, .18) !important; box-shadow: 0 1px 0 rgba(255,255,255,.12) inset !important; color: #fff !important; }' +
    '#root[data-codex-background-color-auth] :is(input, textarea)::placeholder { color: rgba(255,255,255,.76) !important; opacity: 1 !important; }' +
    '@media (max-width: 640px), (max-height: 620px) { #root[data-codex-background-color-auth] { padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)) !important; } #root[data-codex-background-color-auth] button { min-height: 38px !important; } }' +
    // 终端弹层/嵌入终端仅加一条细边框，保持终端自身背景和配色。
    '#root :is(iframe, webview, [data-terminal], [data-testid*="terminal"], [class*="terminal-container"], [class*="TerminalContainer"], [class*="terminal-host"], [class*="TerminalHost"]) { border: 1px solid rgba(255,255,255,.22) !important; border-radius: 10px !important; box-sizing: border-box !important; box-shadow: none !important; }' +
    '#root a, #root .text-token-link { color: #9db8ff !important; }' +
    // 全局透明模式：Codex 会在不同页面使用不同的 surface class（终端、资源、
    // 编辑器、空状态等），不能只靠逐个选择器修补。统一移除内容根节点下的底色，
    // 让用户选择的背景始终可见；图片和图标元素本身不受影响。
    '#root, #root * { background-color: transparent !important; background-image: none !important; }' +
    // 全局透明会同时清掉开关轨道。只恢复具备 switch 语义的控件，未选中态保留
    // 深色半透明底，选中态使用实色强调，避免在浅色背景图上只看见一个圆点。
    '#root[data-codex-background-color-mode="dark"] :is(button[role="switch"], [role="switch"], button[aria-checked], [data-slot*="switch"], [data-slot*="toggle"]) { background-color: rgba(12, 20, 34, .58) !important; border: 1px solid rgba(230, 238, 255, .48) !important; border-radius: 999px !important; box-shadow: 0 1px 2px rgba(0,0,0,.2) inset !important; }' +
    '#root[data-codex-background-color-mode="dark"] :is(button[role="switch"], [role="switch"], button[aria-checked], [data-slot*="switch"], [data-slot*="toggle"])[aria-checked="true"], #root[data-codex-background-color-mode="dark"] :is(button[role="switch"], [role="switch"], button[aria-checked], [data-slot*="switch"], [data-slot*="toggle"])[data-state="checked"] { background-color: #6d8fff !important; border-color: rgba(244, 248, 255, .82) !important; }' +
    // 此版本的开关把 role 放在外层容器：第一层子节点是轨道，第二层才是圆形滑块。
    '#root[data-codex-background-color-mode="dark"] :is(button[role="switch"], [role="switch"], button[aria-checked], [data-slot*="switch"], [data-slot*="toggle"]) > :not(svg) { background-color: rgba(12, 20, 34, .58) !important; border: 1px solid rgba(230, 238, 255, .48) !important; border-radius: 999px !important; box-shadow: 0 1px 2px rgba(0,0,0,.2) inset !important; }' +
    '#root[data-codex-background-color-mode="dark"] :is(button[role="switch"], [role="switch"], button[aria-checked], [data-slot*="switch"], [data-slot*="toggle"])[aria-checked="true"] > :not(svg), #root[data-codex-background-color-mode="dark"] :is(button[role="switch"], [role="switch"], button[aria-checked], [data-slot*="switch"], [data-slot*="toggle"])[data-state="checked"] > :not(svg) { background-color: #6d8fff !important; border-color: rgba(244, 248, 255, .82) !important; }' +
    '#root[data-codex-background-color-mode="dark"] :is(button[role="switch"], [role="switch"], button[aria-checked], [data-slot*="switch"], [data-slot*="toggle"]) > :not(svg) > :not(svg) { background-color: #f7f9ff !important; border-color: rgba(12, 20, 34, .42) !important; box-shadow: 0 1px 3px rgba(0,0,0,.28) !important; }' +
    // 设置页搜索图标有部分版本直接在 path 上写入深色 fill/stroke，无法靠父元素
    // 的 color 继承修正。只对含搜索输入框的容器覆盖，保留其他图标的语义色。
    '#root[data-codex-background-color-mode="dark"] :is([role="search"], [class*="search"], [class*="Search"]):has(input) svg { color: rgba(248,250,255,.92) !important; }' +
    '#root[data-codex-background-color-mode="dark"] :is([role="search"], [class*="search"], [class*="Search"]):has(input) svg [stroke] { stroke: currentColor !important; }' +
    '#root[data-codex-background-color-mode="dark"] :is([role="search"], [class*="search"], [class*="Search"]):has(input) svg [fill]:not([fill="none"]) { fill: currentColor !important; }' +
    // 设置搜索框的真实容器在部分版本没有 search 类名。以输入框本身为锚点，
    // 直接覆盖图标 path 的固定属性，避免放大到整棵应用树。
    '#root[data-codex-background-color-mode="dark"] :has(input[placeholder*="搜索"]) > svg { color: rgba(248,250,255,.92) !important; }' +
    '#root[data-codex-background-color-mode="dark"] :has(input[placeholder*="搜索"]) > svg :is(path, circle, line, polyline, rect)[stroke] { stroke: currentColor !important; }' +
    '#root[data-codex-background-color-mode="dark"] :has(input[placeholder*="搜索"]) > svg :is(path, circle, polygon, rect)[fill]:not([fill="none"]) { fill: currentColor !important; }' +
    // 全局玻璃边界：透明工作台不能继续沿用原主题的黑色边框。常规容器只改变
    // 边框颜色，弹层/菜单则额外获得轻玻璃底，确保快捷键等独立视图有清晰层级。
    '#root[data-codex-background-color-mode="dark"] { --codex-glass-border: rgba(218, 230, 255, .16); --codex-glass-border-strong: rgba(232, 240, 255, .26); --codex-glass-surface: rgba(20, 31, 51, .24); }' +
    // 只有包含已识别设置导航的页面才能获得控件边框。不能以 aria-haspopup 等
    // 通用属性全局命中，否则首页菜单、三点按钮和模型选择器都会被误加边框。
    '#root[data-codex-background-color-mode="dark"] :is(main, [role="dialog"]):has([data-codex-settings-nav-item]) :is(input, textarea, [contenteditable="true"], select, [role="combobox"], button[aria-haspopup="menu"]:not(:has(svg:only-child)), button[aria-haspopup="listbox"]:not(:has(svg:only-child)), button[data-slot*="select"]:not(:has(svg:only-child)), button[data-slot*="dropdown"]:not(:has(svg:only-child)), button[class*="select-trigger"]:not(:has(svg:only-child)), button[class*="dropdown-trigger"]:not(:has(svg:only-child)), button:not(:has(svg:only-child))) { border: 1px solid rgba(255, 255, 255, .72) !important; border-radius: 8px !important; }' +
    '#root[data-codex-background-color-mode="dark"] :is(main, [role="dialog"]):has([data-codex-settings-nav-item]) :is(input, textarea, [contenteditable="true"], select, [role="combobox"], button[aria-haspopup="menu"]:not(:has(svg:only-child)), button[aria-haspopup="listbox"]:not(:has(svg:only-child)), button[data-slot*="select"]:not(:has(svg:only-child)), button[data-slot*="dropdown"]:not(:has(svg:only-child)), button[class*="select-trigger"]:not(:has(svg:only-child)), button[class*="dropdown-trigger"]:not(:has(svg:only-child)), button:not(:has(svg:only-child))):hover:not(:disabled) { border-color: rgba(255, 255, 255, .92) !important; }' +
    // 快捷键等设置列表用伪元素绘制滚动遮罩；真实元素的透明规则不会覆盖它，
    // 会在搜索框下留下白色渐变横条。仅在设置页清除伪元素表面与阴影。
    '#root[data-codex-background-color-mode="dark"] :is(main, [role="dialog"]):has([data-codex-settings-nav-item]) *::before, #root[data-codex-background-color-mode="dark"] :is(main, [role="dialog"]):has([data-codex-settings-nav-item]) *::after { background: transparent !important; box-shadow: none !important; }' +
    '#root[data-codex-background-color-mode="dark"] :is(main.main-surface, aside.app-shell-left-panel, header.app-header-tint) { border-color: var(--codex-glass-border) !important; }' +
    '#root[data-codex-background-color-mode="dark"] aside.app-shell-left-panel { border-right-color: var(--codex-glass-border) !important; }' +
    '#root[data-codex-background-color-mode="dark"] header.app-header-tint { border-bottom-color: var(--codex-glass-border) !important; }' +
    '#root[data-codex-background-color-mode="dark"] :is([class*="electron:elevation-stroke"], [role="separator"]) { border-color: var(--codex-glass-border) !important; }' +
    '#root[data-codex-background-color-mode="dark"] :is([role="dialog"], [role="menu"], [role="listbox"], [class*="electron:elevation-prominent"], [class*="popover"], [class*="modal"]) { background-color: var(--codex-glass-surface) !important; border: 1px solid var(--codex-glass-border-strong) !important; box-shadow: 0 12px 36px rgba(0, 0, 0, .22), 0 1px 0 rgba(255, 255, 255, .08) inset !important; backdrop-filter: blur(18px) saturate(125%) !important; -webkit-backdrop-filter: blur(18px) saturate(125%) !important; }' +
    // 授权决策按钮在 Codex 中通常是无边框样式；透明主题下需要明确的玻璃边界，
    // 否则“拒绝 / 允许一次”会像普通文字一样融入背景。
    '#root[data-codex-background-color-mode="dark"] button[data-codex-glass-action] { min-height: 32px !important; padding: 5px 10px !important; border: 1px solid var(--codex-glass-border-strong) !important; border-radius: 9px !important; background-color: rgba(20, 31, 51, .24) !important; box-shadow: 0 1px 0 rgba(255, 255, 255, .14) inset !important; }' +
    '#root[data-codex-background-color-mode="dark"] button[data-codex-glass-action]:hover { border-color: rgba(242, 247, 255, .86) !important; background-color: rgba(54, 78, 122, .38) !important; }' +
    '#root[data-codex-background-color-mode="dark"] button[data-codex-glass-action]:focus-visible { outline: 2px solid rgba(184, 207, 255, .95) !important; outline-offset: 2px !important; }' +
    '#root canvas { background: transparent !important; mix-blend-mode: multiply; }' +
    // 仅左侧项目行需要自定义悬浮色。不能使用通用 hover 选择器，否则资源面板、
    // 列表和按钮都会叠加一层半透明底色。
    // 发送/停止是唯一需要保留实体底色的主操作，不能随工作台背景一起透明。
    '#root .composer-surface-chrome button[aria-label*="发送"] { background-color: #79f45a !important; color: #17220f !important; }' +
    '#root .composer-surface-chrome button[aria-label="停止"] { background-color: rgba(70,74,82,.88) !important; color: #fff !important; }' +
    '#root .composer-surface-chrome button[aria-label*="发送"] svg, #root .composer-surface-chrome button[aria-label="停止"] svg { color: currentColor !important; }' +
    '#root[data-codex-background-color-injector-icon-theme="material"] [data-sidebar-project-drop-zone="project-icon"] svg { display: none !important; }' +
    '#root[data-codex-background-color-injector-icon-theme="material"] [data-sidebar-project-drop-zone="project-icon"]::before { content: ""; display: block; width: 18px; height: 18px; background: center / contain no-repeat url("data:image/svg+xml,%3Csvg viewBox=%270 0 24 24%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cpath d=%27M10 4H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8c0-1.11-.9-2-2-2h-8l-2-2z%27 fill=%27%2390a4ae%27/%3E%3C/svg%3E"); }' +
    '#root[data-codex-background-color-injector-icon-theme="material"] [data-app-action-sidebar-project-row][aria-expanded="true"] [data-sidebar-project-drop-zone="project-icon"]::before { background-image: url("data:image/svg+xml,%3Csvg viewBox=%270 0 24 24%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cpath d=%27M19 20H4c-1.11 0-2-.9-2-2V6c0-1.11.89-2 2-2h6l2 2h7a2 2 0 0 1 2 2H4v10l2.14-8h17.07l-2.28 8.5c-.23.87-1.01 1.5-1.93 1.5z%27 fill=%27%2390a4ae%27/%3E%3C/svg%3E"); }' +
    'body { min-height: 100vh; }' +
    '#root, #app { position: relative; z-index: 1; }' +
    '#${MARKER}-layer { position: fixed; inset: 0; z-index: 0; pointer-events: none; }' +
    '#${MARKER}-trigger { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; width: 34px; height: 34px; padding: 0; border: 1px solid rgba(255,255,255,.4); border-radius: 10px; background: rgba(0,0,0,.18); color: #fff; cursor: pointer; font: 600 17px/1 system-ui; opacity: .88; }' +
    '#${MARKER}-trigger:hover { opacity: 1; }' +
    '#${MARKER}-panel { position: fixed; right: 16px; bottom: 58px; z-index: 2147483647; width: 220px; padding: 14px; border: 1px solid rgba(255,255,255,.4); border-radius: 13px; background: rgba(0,0,0,.18); box-shadow: none; color: #fff; font: 13px system-ui; }' +
    '#${MARKER}-panel[hidden] { display: none; }' +
    '#${MARKER}-panel label { display: grid; gap: 7px; margin: 0 0 13px; }' +
    '#${MARKER}-panel input[type=range], #${MARKER}-panel input[type=file], #${MARKER}-panel input[type=text], #${MARKER}-panel select { width: 100%; accent-color: #fff; }' +
    '#${MARKER}-panel input[type=text], #${MARKER}-panel select { border: 1px solid rgba(255,255,255,.18); border-radius: 7px; padding: 6px 7px; background: rgba(255,255,255,.08); color: #fff; font: inherit; }' +
    '#${MARKER}-panel .image-status { display: none; align-items: center; gap: 7px; margin-top: 7px; color: rgba(255,255,255,.86); font-size: 11px; }' +
    '#${MARKER}-panel .image-status.active { display: flex; }' +
    '#${MARKER}-panel .image-preview { width: 34px; height: 22px; flex: 0 0 auto; border: 1px solid rgba(255,255,255,.28); border-radius: 4px; background: center / cover no-repeat; }' +
    '#${MARKER}-panel select option { background: #202127; color: #f8f8f2; }' +
    '#${MARKER}-panel select option:checked { background: #45405a; color: #fff; }' +
    '#${MARKER}-panel .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }' +
    '#${MARKER}-panel .clear { border: 0; padding: 0; background: transparent; color: rgba(255,255,255,.72); font: inherit; cursor: pointer; }' +
    '#${MARKER}-panel .clear:hover { color: #fff; }' +
    '#${MARKER}-panel .delete-theme { color: #ff9a9a; } #${MARKER}-panel .delete-theme:hover { color: #ffcccc; } #${MARKER}-panel .delete-theme:disabled { opacity: .35; cursor: not-allowed; }' +
    '#${MARKER}-panel .theme-actions { display: flex; gap: 8px; margin: 3px 0 13px; }' +
    '#${MARKER}-panel .theme-actions button { flex: 1; border: 1px solid rgba(255,255,255,.18); border-radius: 7px; padding: 6px; background: rgba(255,255,255,.1); color: #fff; font: inherit; cursor: pointer; }' +
    '#${MARKER}-panel .author-contact { margin-top: 12px; padding-top: 11px; border-top: 1px solid rgba(255,255,255,.22); color: rgba(255,255,255,.86); font-size: 12px; line-height: 1.55; }' +
    '#${MARKER}-panel .author-contact strong { color: #fff; font-weight: 600; }';
  root.append(style);

  // 部分工作台视图（尤其是终端和内嵌编辑器）会在挂载后以 inline
  // !important 重设白色底图，普通样式规则无法压过它。持续处理新增节点及
  // 样式更新，才能达到与 VS Code 工作台相同的全局背景效果。
  const originalInlineStyles = new Map();
  const FILE_TREE_STYLE_ID = '${MARKER}-file-tree-style';
  const GLASS_SURFACE_SELECTOR = '[role="dialog"], [role="menu"], [role="listbox"], [class*="electron:elevation-"], [class*="popover"], [class*="modal"]';
  const INTERACTIVE_SURFACE_SELECTOR = '[role="switch"], button[aria-checked], [data-slot*="switch"], [data-slot*="toggle"], input[type="checkbox"], input[type="radio"]';
  const GLASS_ACTION_LABELS = new Set(['拒绝', '允许', '允许一次', '不允许', 'deny', 'allow', 'allow once', 'not now']);
  const SETTINGS_NAV_LABELS = new Set(['常规', '外观', '语音', '配置', '个性化', '宠物', '键盘快捷键', '账户', '应用快照', '插件', '浏览器', '电脑操控', '钩子', '连接', 'git', '环境', '工作树', '已归档', '已归档任务', 'general', 'appearance', 'voice', 'features', 'personalization', 'pet', 'keyboard shortcuts', 'account', 'app snapshots', 'extensions', 'browser', 'computer control', 'hooks', 'connectors', 'environment', 'worktrees', 'archived', 'archived tasks']);
  function styleFileTree(tree) {
    if (!(tree instanceof HTMLElement) || tree.tagName !== 'FILE-TREE-CONTAINER' || !tree.shadowRoot) return;
    if (tree.shadowRoot.getElementById(FILE_TREE_STYLE_ID)) return;
    const treeStyle = document.createElement('style');
    treeStyle.id = FILE_TREE_STYLE_ID;
    treeStyle.textContent = ':host { background: transparent !important; color: #fff !important; color-scheme: dark !important; --color-token-main-surface-primary: transparent; --color-token-foreground: #fff; --color-token-text-secondary: rgba(255,255,255,.82); --color-token-text-tertiary: rgba(255,255,255,.7); --color-token-input-placeholder-foreground: rgba(255,255,255,.72); --color-token-list-hover-background: rgba(115,150,255,.48); } [role="tree"], [role="treeitem"] { background-color: transparent !important; } button { color: inherit !important; } button:hover { background-color: rgba(115,150,255,.48) !important; }';
    tree.shadowRoot.append(treeStyle);
  }
  function styleFileTrees(node) {
    if (!(node instanceof HTMLElement)) return;
    if (node.matches('file-tree-container')) styleFileTree(node);
    node.querySelectorAll?.('file-tree-container').forEach(styleFileTree);
  }
  function markDiffSummaryBadge(element) {
    if (!(element instanceof HTMLElement) || !appRoot?.contains(element)) return;
    const text = (element.innerText || '').trim();
    // 只处理完整的“文件已更改 + / -”摘要文本，不给它所在的外层按钮加任何样式。
    if (!/^\\d+\\s*个文件已更[\\s\\S]*?\\+\\s*\\d+\\s*-\\s*\\d+$/.test(text)) return;
    const numbers = [...element.querySelectorAll('*')].filter((node) => /^[+-]\\d+$/.test((node.textContent || '').trim()));
    // 某些版本把 + / - 直接合并为文字节点；仅将这两个数字拆成标记 span。
    if (numbers.length < 2) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      let textNode;
      while (textNode = walker.nextNode()) {
        if (/^[+-]\\d+$/.test(textNode.nodeValue.trim())) textNodes.push(textNode);
      }
      for (const node of textNodes) {
        const stat = document.createElement('span');
        stat.textContent = node.nodeValue;
        stat.setAttribute(/^\\+/.test(node.nodeValue.trim()) ? 'data-codex-diff-added' : 'data-codex-diff-deleted', '');
        node.parentNode?.replaceChild(stat, node);
      }
    }
    const markedNumbers = [...element.querySelectorAll('[data-codex-diff-added], [data-codex-diff-deleted]')];
    const allNumbers = numbers.length >= 2 ? numbers : markedNumbers;
    const added = allNumbers.find((node) => /^\\+\\d+$/.test(node.textContent.trim()));
    const deleted = allNumbers.find((node) => /^-\\d+$/.test(node.textContent.trim()));
    if (!added || !deleted) return;
    element.setAttribute('data-codex-diff-summary-badge', '');
    added.setAttribute('data-codex-diff-added', '');
    deleted.setAttribute('data-codex-diff-deleted', '');
  }
  function markGlassActionButtons(node) {
    if (!(node instanceof HTMLElement)) return;
    const buttons = node.matches('button') ? [node] : [...node.querySelectorAll?.('button') || []];
    for (const button of buttons) {
      const label = (button.innerText || button.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
      const isAction = GLASS_ACTION_LABELS.has(label);
      button.toggleAttribute('data-codex-glass-action', isAction);
      if (isAction) {
        button.style.removeProperty('background-color');
        button.style.removeProperty('background-image');
      }
    }
  }
  function markSettingsNavigation(node) {
    if (!(node instanceof HTMLElement)) return;
    const candidates = node.matches('button, a, [role="button"], [role="tab"]')
      ? [node]
      : [...node.querySelectorAll?.('button, a, [role="button"], [role="tab"]') || []];
    for (const candidate of candidates) {
      const label = (candidate.innerText || candidate.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      candidate.toggleAttribute('data-codex-settings-nav-item', SETTINGS_NAV_LABELS.has(label));
    }
  }
  function makeWorkspaceTransparent(element) {
    if (!(element instanceof HTMLElement) || element === appRoot || !appRoot?.contains(element)) return;
    if (appRoot.hasAttribute('data-codex-background-color-auth') && element.matches('button, input, select, textarea')) return;
    if (element.hasAttribute('data-codex-glass-action')) return;
    if (element.matches(GLASS_SURFACE_SELECTOR)) return;
    // 开关滑块在语义节点的子层；任一子层被写入 inline transparent 都会留下黑色圆点。
    if (element.closest(INTERACTIVE_SURFACE_SELECTOR)) return;
    if (element.matches('button[aria-label*="发送"], button[aria-label="停止"]')) return;
    // 用量进度条采用浏览器原生绘制；若写入 inline transparent 会覆盖 accent-color。
    if (element.matches('progress[aria-label="已使用量"]')) {
      element.style.removeProperty('background-color');
      element.style.removeProperty('background-image');
      return;
    }
    // 这些是需要保留统一玻璃表面的交互容器，不能被观察器写成内联透明色。
    if (element.matches('.composer-surface-chrome, div.rounded-3xl.bg-token-dropdown-background[class*="electron:elevation-prominent"]')) return;
    const computed = getComputedStyle(element);
    if (computed.backgroundColor === 'rgba(0, 0, 0, 0)' && computed.backgroundImage === 'none') return;
    if (!originalInlineStyles.has(element)) originalInlineStyles.set(element, element.getAttribute('style'));
    element.style.setProperty('background-color', 'transparent', 'important');
    element.style.setProperty('background-image', 'none', 'important');
  }
  function makeTreeTransparent(node) {
    if (!(node instanceof HTMLElement)) return;
    styleFileTrees(node);
    markDiffSummaryBadge(node);
    markGlassActionButtons(node);
    markSettingsNavigation(node);
    makeWorkspaceTransparent(node);
    node.querySelectorAll?.('*').forEach((element) => { markDiffSummaryBadge(element); makeWorkspaceTransparent(element); });
    markGlassActionButtons(node);
    markSettingsNavigation(node);
  }
  function markAuthScreen() {
    if (!appRoot) return;
    const content = (appRoot.innerText || '').replace(/\\s+/g, ' ').toLowerCase();
    const isAuth = content.includes('登录 chatgpt') || content.includes('login chatgpt') || content.includes('log in to chatgpt');
    appRoot.toggleAttribute('data-codex-background-color-auth', isAuth);
    if (!isAuth) return;
    appRoot.querySelectorAll('button, input, select, textarea').forEach((element) => {
      element.style.removeProperty('background-color');
      element.style.removeProperty('background-image');
    });
  }
  makeTreeTransparent(appRoot);
  markAuthScreen();
  const transparencyObserver = appRoot ? new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') {
        makeWorkspaceTransparent(record.target);
        markGlassActionButtons(record.target);
        markSettingsNavigation(record.target);
      } else {
        markGlassActionButtons(record.target);
        markSettingsNavigation(record.target);
        record.addedNodes.forEach(makeTreeTransparent);
      }
    }
    markAuthScreen();
  }) : null;
  transparencyObserver?.observe(appRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });

  // Codex 会给这些节点写入带 !important 的运行时样式；普通注入 CSS 无法
  // 覆盖它。保存原始 inline style，随后使用 inline !important 确保背景层可见。
  const surfaceStyles = [...document.querySelectorAll('main.main-surface, aside.app-shell-left-panel, header.app-header-tint')]
    .map((element) => ({ element, style: element.getAttribute('style') }));
  for (const { element } of surfaceStyles) {
    element.style.setProperty('background-color', 'transparent', 'important');
    element.style.setProperty('background-image', 'none', 'important');
  }

  const layer = document.createElement('div');
  layer.id = '${MARKER}-layer';
  document.body.prepend(layer);

  const trigger = document.createElement('button');
  trigger.id = '${MARKER}-trigger'; trigger.type = 'button'; trigger.title = '背景色'; trigger.textContent = '◐';
  const panel = document.createElement('section');
  panel.id = '${MARKER}-panel'; panel.hidden = true;
  panel.innerHTML = '<label><span class="row">已保存主题 <button class="clear delete-theme" id="${MARKER}-delete" type="button" disabled>删除当前主题</button></span><select id="${MARKER}-themes"><option value="">Codex 原始（无注入）</option></select></label><label>主题名称 <input id="${MARKER}-theme-name" type="text" maxlength="40" placeholder="例如：我的背景"></label><div class="theme-actions"><button id="${MARKER}-save" type="button">保存主题</button></div><label>图标主题 <select id="${MARKER}-icon-theme"><option value="default">Codex 默认</option><option value="material">Material Icon Theme</option></select></label><label><span class="row">背景图片 <button class="clear" id="${MARKER}-clear" type="button">清除</button></span><input id="${MARKER}-image" type="file" accept="image/*"><span class="image-status" id="${MARKER}-image-status"><i class="image-preview" id="${MARKER}-image-preview"></i><span id="${MARKER}-image-status-text"></span></span></label><label><span class="row">背景透明度 <output id="${MARKER}-value"></output></span><input id="${MARKER}-opacity" type="range" min="0" max="100"></label><label><span class="row">界面不透明度 <output id="${MARKER}-ui-value"></output></span><input id="${MARKER}-ui-opacity" type="range" min="0" max="100"></label><div class="author-contact"><div>作者微信：<strong>cx00510115</strong></div><div>欢迎加入交流群一起探讨</div></div>';
  document.body.append(trigger, panel);

  const opacity = panel.querySelector('#${MARKER}-opacity');
  const value = panel.querySelector('#${MARKER}-value');
  const uiOpacity = panel.querySelector('#${MARKER}-ui-opacity');
  const uiValue = panel.querySelector('#${MARKER}-ui-value');
  const iconTheme = panel.querySelector('#${MARKER}-icon-theme');
  const image = panel.querySelector('#${MARKER}-image');
  const imageStatus = panel.querySelector('#${MARKER}-image-status');
  const imagePreview = panel.querySelector('#${MARKER}-image-preview');
  const imageStatusText = panel.querySelector('#${MARKER}-image-status-text');
  const clear = panel.querySelector('#${MARKER}-clear');
  const themes = panel.querySelector('#${MARKER}-themes');
  const themeName = panel.querySelector('#${MARKER}-theme-name');
  const saveTheme = panel.querySelector('#${MARKER}-save');
  const deleteTheme = panel.querySelector('#${MARKER}-delete');
  let selectedThemeId = saved.themeId || '';
  opacity.value = saved.opacity; uiOpacity.value = saved.uiOpacity; iconTheme.value = saved.iconTheme;
  function applyIconTheme(id) {
    appRoot?.setAttribute('data-codex-background-color-injector-icon-theme', id === 'material' ? 'material' : 'default');
  }
  function paint() {
    const percent = Number(opacity.value);
    layer.style.background = 'transparent';
    layer.style.backgroundImage = imageData ? 'url("' + imageData + '")' : 'none';
    layer.style.backgroundPosition = 'center';
    layer.style.backgroundRepeat = 'no-repeat';
    layer.style.backgroundSize = 'cover';
    layer.style.opacity = String(percent / 100);
    imageStatus.classList.toggle('active', Boolean(imageData));
    if (imageData) {
      imagePreview.style.backgroundImage = 'url("' + imageData.replace(/"/g, '\\"') + '")';
      imageStatusText.textContent = selectedThemeId === BUNDLED_THEME.id ? '已使用内置背景图片' : '已使用当前主题背景图片';
    } else {
      imagePreview.style.backgroundImage = '';
      imageStatusText.textContent = '';
    }
    value.textContent = percent + '%';
    const uiPercent = Number(uiOpacity.value);
    appRoot?.style.setProperty('background-color', 'rgba(48, 56, 69, ' + (uiPercent / 100) + ')', 'important');
    appRoot?.setAttribute('data-codex-background-color-mode', 'dark');
    uiValue.textContent = uiPercent + '%';
    applyIconTheme(iconTheme.value);
    localStorage.setItem(KEY, JSON.stringify({ opacity: percent, uiOpacity: uiPercent, iconTheme: iconTheme.value, themeId: selectedThemeId }));
  }
  function imageStore() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(KEY, 2);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('data')) request.result.createObjectStore('data');
        if (!request.result.objectStoreNames.contains('themes')) request.result.createObjectStore('themes', { keyPath: 'id' });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
  async function saveImage(value) {
    const db = await imageStore();
    const transaction = db.transaction('data', 'readwrite');
    transaction.objectStore('data').put(value, 'background');
    transaction.oncomplete = () => db.close();
  }
  async function loadImage() {
    const db = await imageStore();
    const transaction = db.transaction('data', 'readonly');
    const request = transaction.objectStore('data').get('background');
    request.onsuccess = () => { imageData = request.result || null; paint(); db.close(); };
  }
  async function readThemes() {
    const db = await imageStore();
    const transaction = db.transaction('themes', 'readonly');
    const request = transaction.objectStore('themes').getAll();
    return new Promise((resolve) => { request.onsuccess = () => { db.close(); resolve(request.result || []); }; });
  }
  async function writeTheme(theme) {
    const db = await imageStore();
    const transaction = db.transaction('themes', 'readwrite');
    transaction.objectStore('themes').put(theme);
    return new Promise((resolve) => { transaction.oncomplete = () => { db.close(); resolve(); }; });
  }
  async function removeTheme(id) {
    const db = await imageStore();
    const transaction = db.transaction('themes', 'readwrite');
    transaction.objectStore('themes').delete(id);
    return new Promise((resolve) => { transaction.oncomplete = () => { db.close(); resolve(); }; });
  }
  function applyTheme(theme) {
    opacity.value = theme.opacity ?? defaults.opacity;
    uiOpacity.value = theme.uiOpacity ?? defaults.uiOpacity;
    iconTheme.value = theme.iconTheme ?? defaults.iconTheme;
    imageData = theme.image || null;
  }
  async function ensureBundledTheme() {
    const all = await readThemes();
    const bundled = {
      ...BUNDLED_THEME,
      image: BUNDLED_THEME.imageData,
    };
    const existing = all.find((theme) => theme.id === bundled.id);
    if (!existing) {
      await writeTheme(bundled);
      return [...all, bundled];
    }
    return all;
  }
  async function refreshThemes() {
    const all = await readThemes();
    themes.innerHTML = '<option value="">Codex 原始（无注入）</option>' + all.map((theme) => '<option value="' + theme.id + '">' + theme.name.replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]) + '</option>').join('');
    themes.value = selectedThemeId;
    deleteTheme.disabled = !selectedThemeId;
    const active = all.find((theme) => theme.id === selectedThemeId);
    if (active) themeName.value = active.name;
    return all;
  }
  opacity.addEventListener('input', paint); uiOpacity.addEventListener('input', paint); iconTheme.addEventListener('change', paint);
  image.addEventListener('change', () => {
    const file = image.files && image.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => { imageData = reader.result; await saveImage(imageData); paint(); };
    reader.readAsDataURL(file);
  });
  clear.addEventListener('click', async () => { imageData = null; image.value = ''; await saveImage(null); paint(); });
  themes.addEventListener('change', async () => {
    selectedThemeId = themes.value;
    deleteTheme.disabled = !selectedThemeId;
    if (!selectedThemeId) {
      localStorage.setItem(KEY, JSON.stringify({ ...defaults, themeId: ORIGINAL_THEME_ID }));
      window.__CODEX_BACKGROUND_COLOR_STATE__?.cleanup?.();
      mountOriginalTrigger();
      return;
    }
    const theme = (await readThemes()).find((item) => item.id === selectedThemeId);
    if (!theme) return;
    themeName.value = theme.name;
    applyTheme(theme);
    paint();
  });
  saveTheme.addEventListener('click', async () => {
    const name = themeName.value.trim();
    if (!name) { themeName.focus(); return; }
    const id = selectedThemeId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    await writeTheme({ id, name, opacity: Number(opacity.value), uiOpacity: Number(uiOpacity.value), iconTheme: iconTheme.value, image: imageData });
    selectedThemeId = id;
    await refreshThemes();
    paint();
  });
  deleteTheme.addEventListener('click', async () => {
    if (!selectedThemeId) return;
    await removeTheme(selectedThemeId);
    selectedThemeId = '';
    themeName.value = '';
    await refreshThemes();
    paint();
  });
  trigger.addEventListener('click', () => { panel.hidden = !panel.hidden; });
  ensureBundledTheme().then(async (all) => {
    if (!selectedThemeId) selectedThemeId = BUNDLED_THEME.id;
    const active = all.find((theme) => theme.id === selectedThemeId);
    if (active) applyTheme(active);
    else loadImage().catch(() => {});
    await refreshThemes();
    paint();
  }).catch(() => { paint(); loadImage().catch(() => {}); });
  window.__CODEX_BACKGROUND_COLOR_STATE__ = {
    installed: true,
    cleanup() {
      transparencyObserver?.disconnect();
      if (appRoot) {
        appRoot.removeAttribute('data-codex-background-color-injector-icon-theme');
        appRoot.removeAttribute('data-codex-background-color-mode');
        appRoot.removeAttribute('data-codex-background-color-auth');
        if (appRootOriginalStyle === null) appRoot.removeAttribute('style');
        else appRoot.setAttribute('style', appRootOriginalStyle);
      }
      for (const [element, originalStyle] of originalInlineStyles) {
        if (!element.isConnected) continue;
        if (originalStyle === null) element.removeAttribute('style');
        else element.setAttribute('style', originalStyle);
      }
      for (const { element, style: originalStyle } of surfaceStyles) {
        if (originalStyle === null) element.removeAttribute('style');
        else element.setAttribute('style', originalStyle);
      }
      document.querySelectorAll('[data-codex-diff-summary-badge], [data-codex-diff-added], [data-codex-diff-deleted], [data-codex-settings-nav-item]').forEach((element) => {
        element.removeAttribute('data-codex-diff-summary-badge');
        element.removeAttribute('data-codex-diff-added');
        element.removeAttribute('data-codex-diff-deleted');
        element.removeAttribute('data-codex-settings-nav-item');
      });
      document.querySelectorAll('file-tree-container').forEach((tree) => tree.shadowRoot?.getElementById(FILE_TREE_STYLE_ID)?.remove());
      style.remove(); layer.remove(); trigger.remove(); panel.remove();
      delete window.__CODEX_BACKGROUND_COLOR_STATE__;
    },
  };
})();`;
}

const port = Number(process.argv[2] ?? 9341);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('CDP 端口无效。');
const loopback = new Set(['127.0.0.1', 'localhost', '[::1]']);

function websocketUrl(target) {
  const url = new URL(target.webSocketDebuggerUrl);
  if (url.protocol !== 'ws:' || !loopback.has(url.hostname) || Number(url.port) !== port) throw new Error('拒绝非本机 CDP 连接。');
  return url.href;
}

class Cdp {
  constructor(target) {
    this.ws = new WebSocket(websocketUrl(target));
    this.id = 0;
    this.pending = new Map();
    this.closed = false;
  }
  async open() {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('CDP 连接超时。')), 5000);
      this.ws.addEventListener('open', () => { clearTimeout(timeout); resolve(); }, { once: true });
      this.ws.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('CDP 连接失败。')); }, { once: true });
    });
    this.ws.addEventListener('message', ({ data }) => {
      const message = JSON.parse(String(data));
      const request = this.pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timeout); this.pending.delete(message.id);
      message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
    });
    await this.send('Runtime.enable');
    return this;
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error(method + ' 超时。')); }, 10000);
      this.pending.set(id, { resolve, reject, timeout });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || '渲染器执行失败。');
    return result.result?.value;
  }
  close() { this.closed = true; this.ws.close(); }
}

async function targets() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: controller.signal });
    const all = await response.json();
    return all.filter((target) => target.type === 'page' && target.url?.startsWith('app://') && target.webSocketDebuggerUrl);
  } finally { clearTimeout(timeout); }
}

async function verifiedTargets() {
  const result = [];
  for (const target of await targets()) {
    let session;
    try {
      session = await new Cdp(target).open();
      // Codex 在启动早期会先暴露 CDP page，随后才挂载侧栏/主区域；并且不同
      // 版本的主区域不一定带 role="main"。以根节点和非头像浮层路由来识别主窗口，
      // 并保留侧栏/MAIN 作为更严格的已渲染判定。
      const codex = await session.evaluate(`Boolean(
        document.body && document.querySelector('#root') &&
        !new URL(location.href).searchParams.get('initialRoute')?.includes('avatar-overlay') &&
        (document.querySelector('aside.app-shell-left-panel') || document.querySelector('main') || document.body.innerText.trim())
      )`);
      if (codex) result.push({ target, session }); else session.close();
    } catch { session?.close(); }
  }
  return result;
}

async function applyOnce() {
  // CDP 接口比 React UI 更早就绪。等待渲染窗口完成首次挂载，避免首次启动时
  // 出现“未找到已验证的 Codex 渲染窗口”的竞态错误。
  let connected = [];
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      connected = await verifiedTargets();
      if (connected.length) break;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!connected.length) throw new Error(`未找到已验证的 Codex 渲染窗口（已等待 20 秒）。${lastError ? ` ${lastError.message}` : ''}`);
  for (const { session } of connected) {
    await session.evaluate(injectedScript());
    session.close();
  }
  console.log('背景控件已注入 Codex。');
}

async function watch() {
  while (true) {
    const connected = await verifiedTargets().catch(() => []);
    for (const { session } of connected) {
      const status = await session.evaluate(`(() => {
        try { return JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_KEY)}) || '{}').themeId === ${JSON.stringify(ORIGINAL_THEME_ID)} ? 'original' : Boolean(window.__CODEX_BACKGROUND_COLOR_STATE__?.installed); }
        catch { return Boolean(window.__CODEX_BACKGROUND_COLOR_STATE__?.installed); }
      })()`).catch(() => true);
      if (status !== 'original' && !status) await session.evaluate(injectedScript()).catch(() => {});
      session.close();
    }
    await new Promise((resolve) => setTimeout(resolve, 900));
  }
}

if (process.argv.includes('--enable-dark')) {
  for (const { session } of await verifiedTargets()) {
    await session.evaluate(`localStorage.removeItem(${JSON.stringify(SETTINGS_KEY)}); window.__CODEX_BACKGROUND_COLOR_STATE__?.cleanup?.(); true`);
    await session.evaluate(injectedScript());
    session.close();
  }
  console.log('暗黑主题已启用。');
} else if (process.argv.includes('--remove')) {
  for (const { session } of await verifiedTargets()) {
    await session.evaluate('window.__CODEX_BACKGROUND_COLOR_STATE__?.cleanup?.(); true');
    session.close();
  }
  console.log('背景控件已移除。');
} else if (process.argv.includes('--watch')) {
  await watch();
} else {
  await applyOnce();
}
