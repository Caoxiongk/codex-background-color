# Codex 全屏背景色

给 macOS 与 Windows 版 Codex 添加可切换的全屏背景、暗黑界面与高对比度文字。通过仅监听本机的 CDP 连接生效，不修改 Codex 的安装文件或代码签名。

项目内置“暗黑狐狸”主题，包含背景图片、白色文字与图标规则。将整个项目文件夹交给其他人后，对方无需单独下载图片，双击即可使用。

## 使用环境

- macOS：已安装官方 Codex（Bundle ID：`com.openai.codex`），允许脚本启动应用；首次双击 `.command` 文件时，如系统提示，请选择“打开”。
- Windows：已安装官方 Codex 与 Node.js；在项目目录运行 `powershell -ExecutionPolicy Bypass -File .\scripts\launch-windows.ps1`。

## 快速开始

1. 下载或复制整个项目文件夹，保留 `themes/dark/background.jpg`。
2. 双击 [运行并注入.command](./运行并注入.command)。
3. 脚本会启动或连接已运行的 Codex，并自动应用内置“暗黑狐狸”主题。
4. 在 Codex 右下角点击 `◐`，打开背景与主题设置。

## 主题与背景

在右下角 `◐` 的设置面板中可以：

- 调节背景图片与界面表面的透明度；
- 从“已保存主题”切换内置主题或自己保存的主题；
- 选择图片后保存为新主题；
- 删除不再使用的自定义主题。

选择“Codex 原始（无注入）”会立即移除背景、样式和设置面板，恢复 Codex 的初始外观。右下角会保留“启用暗黑”按钮；点击它或双击 [启用暗黑主题.command](./启用暗黑主题.command) 即可恢复内置主题。

## 恢复原始 Codex

双击 [恢复原始Codex.command](./恢复原始Codex.command) 可停止注入器并移除当前窗口的背景控件。这个操作不会替换、还原或修改任何 Codex 安装文件。

## 命令行使用

在项目目录执行：

```bash
npm run inject      # 启动并应用主题
npm run apply-dark  # 应用内置暗黑主题
npm run restore     # 停止注入并恢复原始界面
```

## 常见情况

- 找不到 Codex：确认已安装官方 Codex，或将应用放在 `/Applications` 或 `~/Applications`。
- 背景没有更新：再次双击“运行并注入.command”；脚本会先移除旧的内存注入，再加载最新设置。
- 需要分享主题：直接分享整个项目文件夹即可，内置主题图片已包含在 `themes/dark/`。

## 中转站

[https://youmisub.cloud](https://youmisub.cloud)
