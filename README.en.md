# DSH Prompt Library

[简体中文](./README.md)

Save reusable instructions in DeepSeek Harness. Open the lightning button next to the composer to append a saved prompt to your draft. You can edit the draft before sending it. This DSH plugin was extracted from [dsh-timeline](https://github.com/houyanchao/dsh-timeline).

While dsh-timeline is running, Timeline provides the prompt controls and this plugin pauses. Disabling or uninstalling Timeline automatically restores this plugin with its own saved prompts.

## Usage

- The lightning button is always visible next to the composer. Click it to open the library, then click **+** or **Add Prompt** to open the manager, where you can add, edit, delete, pin and reorder prompts.
- Pinned prompts appear first. When you have five or more prompts, a search field filters the list by title or content.
- Click a prompt to append it after your draft, separated by a blank line. The composer regains focus with the caret at the end.
- You can also open the manager from DSH **Settings → General → Prompt Library**.

## Storage and migration

If the plugin has no saved library on first use, it copies prompts from timeline on the same DSH origin and browser profile, preserving their order and pins. The two plugins then save their libraries independently. Changes to this library appear in other tabs on the same origin.

Use **Prompt Backup** in the manager to export your prompts as JSON or import a backup from this plugin or timeline, including older backups. **Merge** updates prompts with matching IDs and keeps other existing prompts. **Overwrite** replaces the current list with the list in the backup.

## Install from GitHub

With the DSH CLI and pnpm on your PATH, run the following commands.

```bash
dsh plugin --profile web add https://github.com/houyanchao/dsh-prompt-library/archive/refs/heads/main.tar.gz
dsh web
```

## Build and install locally

Use Node.js 24.11 or later and an installed DSH CLI. Run these commands at the repository root.

```bash
npm ci
npm run bundle
npm pack
dsh plugin --profile web add "$PWD/dsh-prompt-library-0.1.0.tgz"
dsh web
```

Use `npm test` to check prompt storage compatibility, `npm run typecheck` for TypeScript checks and `npm run watch` to rebuild while editing.

## Feedback and support

Report a bug or suggest a feature on [GitHub Issues](https://github.com/houyanchao/dsh-prompt-library/issues). If the prompt library helps you, you can star the [project on GitHub](https://github.com/houyanchao/dsh-prompt-library).

## License

[GPL-3.0-or-later](./LICENSE)
