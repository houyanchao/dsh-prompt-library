# DSH 提示词库

[English](./README.en.md)

从 dsh-timeline 拆出的 DeepSeek Harness 会话插件。把常用指令存成提示词，在会话输入框旁点闪电按钮即可插入草稿，继续补充内容后再发送。

## 使用

- 点闪电按钮打开列表。点「＋」或空列表中的「添加提示词」进入管理页，可新增、编辑、删除、置顶、上移和下移。
- 置顶项排在前面。保存至少 5 条提示词后，列表显示搜索框，可搜索名称或正文。
- 点一条提示词，正文会追加到当前草稿末尾，与原文隔一个空行，光标移到末尾。
- 「常用设置」保留发送后的阅读位置、换行和发送快捷键。智能回车默认关闭，可设置双击 Enter、Ctrl/⌘ + Enter 或 Shift + Enter 发送。
- 在管理页可隐藏闪电按钮。要重新打开管理页，进入 DSH「设置 → 通用设置 → 提示词库」。

## 数据和迁移

首次加载时，插件会从当前浏览器、同一 DSH 地址的 timeline 数据复制提示词、顺序、置顶状态和相关输入偏好。此后两个插件独立保存，提示词的修改会同步到同一地址的其他标签页。「数据同步」可将提示词和输入偏好导出为 JSON，也可从独立插件或 timeline 的 JSON 备份中按 ID 合并或覆盖恢复。

若同时启用 timeline，建议将重叠的功能交给一个插件：在 timeline 中关闭提示词按钮，以及由独立插件接管的智能回车和「阻止发送后跳到底部」。若迁移时按钮已隐藏，可在 DSH「设置 → 通用设置 → 提示词库」重新打开独立插件的按钮。

## 从 GitHub 安装

安装 DSH CLI 和 pnpm 后运行：

```bash
dsh plugin --profile web add https://github.com/houyanchao/dsh-prompt-library/archive/refs/heads/main.tar.gz
dsh web
```

## 本地构建与安装

使用 Node.js 24.11 或更高版本。在仓库根目录运行：

```bash
npm ci
npm run bundle
npm pack
dsh plugin --profile web add "$PWD/dsh-prompt-library-0.1.0.tgz"
dsh web
```

`npm run typecheck` 检查类型，`npm run watch` 在开发时持续构建。需要本地已安装 DSH CLI。

## 许可证

[GPL-3.0-or-later](./LICENSE)
