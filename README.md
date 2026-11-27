<div align="center">

# dsh-prompt-library

**[DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/) 提示词库插件**

一键插入草稿 · 置顶与搜索 · JSON 备份

[![DSH Plugin](https://img.shields.io/badge/DeepSeek%20Harness-plugin-6128FF)](https://deepseek-harness.github.io/deepseek-harness/)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/houyanchao/dsh-prompt-library/pulls)
[![GitHub stars](https://img.shields.io/github/stars/houyanchao/dsh-prompt-library?style=social)](https://github.com/houyanchao/dsh-prompt-library)

**简体中文** | [English](./README.en.md)

</div>

## 📖 dsh-prompt-library 是什么？

把反复用到的指令保存成带名称的提示词。例如，把「请按议题整理这份会议记录，并列出待办事项」保存为「会议纪要」。下次把记录贴进会话输入框，点旁边的闪电按钮选中「会议纪要」，就能在草稿末尾补上这段要求，编辑后再发送。

## ✨ 功能特性

- ⚡ **插入草稿** — 从闪电按钮选一条提示词，正文会追加到已有文字后，中间留一个空行，光标移到末尾。
- 📌 **整理常用提示词** — 点列表右上角的「＋」进入管理页。首次使用也可点「添加提示词」，再点「添加」填写名称和正文。已有条目可以编辑、删除、置顶或上移下移。
- 🔍 **搜索名称和正文** — 置顶项始终排在前面。保存至少 5 条提示词后，列表会显示搜索框。
- 💾 **备份与恢复** — 在管理页的「提示词备份」中导出 JSON，可在另一浏览器导入，也支持导入 dsh-timeline 的旧备份。「合并」更新 ID 相同的条目，保留其余已有提示词。「覆盖」用备份替换当前列表。

也可以从 **设置 → 通用设置 → 提示词库 → 管理提示词** 打开管理页。插件跟随 DSH 的界面语言和深浅主题。

## 📦 安装

### 安装方式 1（客户端）

在 [DeepSeek Harness](https://www.deepseek.com/harness/) 客户端打开「插件」→「添加插件」，粘贴下面的仓库地址，点击「安装」。

```text
https://github.com/houyanchao/dsh-prompt-library
```

![DeepSeek Harness 客户端中的「插件」页面、「添加插件」按钮和输入框](./docs/install-client.png)

### 安装方式 2（通过命令行从 GitHub 安装）

```bash
# 安装 dsh-prompt-library 插件
dsh plugin --profile web add https://github.com/houyanchao/dsh-prompt-library/archive/refs/heads/main.tar.gz
```

## 🔄 从 dsh-timeline 迁移

这个提示词库源自 [dsh-timeline](https://github.com/houyanchao/dsh-timeline)。dsh-timeline 运行时，由它提供提示词入口，独立插件自动暂停。禁用或卸载 dsh-timeline 后，独立插件会自动恢复。

独立插件首次启用且尚无自己的数据时，会复制当前浏览器中同一 DSH 地址下的 Timeline 提示词，保留原有顺序和置顶状态。此后两个库独立保存。同一浏览器中打开相同 DSH 地址的其他标签页，会同步显示独立提示词库的更改。

## ⭐ 支持一下

如果 dsh-prompt-library 好用，欢迎给个🌟，帮助更多人发现它！

遇到问题或有功能建议，欢迎提交 [GitHub Issue](https://github.com/houyanchao/dsh-prompt-library/issues)。

## 📄 许可证

本项目基于 [GPL-3.0-or-later](./LICENSE) 协议开源。
