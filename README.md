# DSH 提示词库

[English](./README.en.md)

从 dsh-timeline 拆出的 DeepSeek Harness 会话插件。把常用指令存成提示词，在会话输入框旁点闪电按钮即可插入草稿，继续补充内容后再发送。

dsh-timeline 运行时，提示词入口由 Timeline 提供，本插件自动暂停。禁用或卸载 Timeline 后，本插件会自动恢复，继续使用自己保存的提示词。

## 使用

- 会话输入框旁的闪电按钮常显。点它打开列表，再点「＋」或空列表中的「添加提示词」进入管理页，可新增、编辑、删除、置顶、上移和下移。
- 置顶项排在前面。保存至少 5 条提示词后，列表显示搜索框，可搜索名称或正文。
- 点一条提示词，正文会追加到当前草稿末尾，与原文隔一个空行，光标移到末尾。
- 也可以从 DSH「设置 → 通用设置 → 提示词库」进入管理页。

## 数据和迁移

首次加载时，如果本插件还没有自己的数据，会从当前浏览器、同一 DSH 地址的 timeline 数据复制提示词，保留顺序和置顶状态。此后两个插件独立保存，本插件的修改会同步到同一地址的其他标签页。

在管理页的「提示词备份」中，可以将提示词导出为 JSON，也可以导入本插件或 timeline 的旧备份。「合并」会更新 ID 相同的提示词，保留其他已有条目。「覆盖」会用备份中的列表替换当前列表。

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

`npm test` 运行提示词存储兼容性测试，`npm run typecheck` 检查类型，`npm run watch` 在开发时持续构建。需要本地已安装 DSH CLI。

## 反馈与支持

遇到问题或有功能建议，欢迎到 [GitHub Issues](https://github.com/houyanchao/dsh-prompt-library/issues) 留言。如果提示词库对你有帮助，可以给[项目仓库](https://github.com/houyanchao/dsh-prompt-library)点个 Star。

## 许可证

[GPL-3.0-or-later](./LICENSE)
