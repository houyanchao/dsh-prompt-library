<div align="center">

# dsh-prompt-library

**A prompt library for [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/)**

Insert prompts into drafts · Pin and search · JSON backups

[![DSH Plugin](https://img.shields.io/badge/DeepSeek%20Harness-plugin-6128FF)](https://deepseek-harness.github.io/deepseek-harness/)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/houyanchao/dsh-prompt-library/pulls)
[![GitHub stars](https://img.shields.io/github/stars/houyanchao/dsh-prompt-library?style=social)](https://github.com/houyanchao/dsh-prompt-library)

[简体中文](./README.md) | **English**

</div>

## 📖 What is dsh-prompt-library?

Save instructions you use often and give each one a name. For example, save “Summarize these meeting notes by topic and list the action items” as **Meeting notes**. Next time, paste your notes into the composer and choose **Meeting notes** from the lightning button beside it. The instruction appears at the end of your draft, ready to edit and send.

## ✨ Features

- ⚡ **Insert a prompt** — Choose a prompt from the lightning-button menu. The plugin appends it to your draft after a blank line and places the cursor at the end.
- 📌 **Organize your library** — Click **+** in the menu to open the manager. If the library is empty, you can also click **Add Prompt**. Choose **Add** to enter a name and the prompt text. You can edit, delete, pin or move existing prompts up and down.
- 🔍 **Search by name or text** — Pinned prompts appear first. Once you have five or more prompts, a search field appears in the menu.
- 💾 **Back up and restore** — Open **Prompt Backup** in the manager to export JSON for use in another browser. You can also import older dsh-timeline backups. **Merge** updates prompts with matching IDs and keeps the rest. **Overwrite** replaces your library with the prompts in the backup.

You can also open the manager from **Settings → General → Prompt Library → Manage prompts**. The plugin follows the DSH interface language and light or dark theme.

## 📦 Installation

With the DSH CLI and pnpm installed, run these commands to install the plugin from its GitHub repository and launch DSH Web.

```bash
dsh plugin --profile web add https://github.com/houyanchao/dsh-prompt-library/archive/refs/heads/main.tar.gz
dsh web
```

> [!TIP]
> If you run DSH from source, run the commands above from the DSH repository root, replacing the leading `dsh` with `pnpm dsh`.

## 🔄 Migrating from dsh-timeline

The prompt library originated in [dsh-timeline](https://github.com/houyanchao/dsh-timeline). While dsh-timeline is active, it provides the prompt controls and the standalone plugin pauses. Disabling or uninstalling dsh-timeline automatically restores the standalone plugin.

On first activation, if the standalone plugin has no library of its own, it copies the Timeline prompts saved at the same DSH address in your browser, preserving their order and pins. The two plugins then save their libraries independently. Edits to the standalone library appear in other tabs open to the same DSH address in that browser.

## ⭐ Feedback and support

Report bugs or suggest a feature on [GitHub Issues](https://github.com/houyanchao/dsh-prompt-library/issues). If the library saves you time, you can give the project a [star on GitHub](https://github.com/houyanchao/dsh-prompt-library).

## 📄 License

This project is licensed under [GPL-3.0-or-later](./LICENSE).
