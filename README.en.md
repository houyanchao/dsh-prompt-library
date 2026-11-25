# DSH Prompt Library

[简体中文](./README.md)

Save reusable instructions in DeepSeek Harness. Open the lightning button next to the composer to append a saved prompt to your draft. You can edit the draft before sending it. This DSH plugin was extracted from [dsh-timeline](https://github.com/houyanchao/dsh-timeline).

## Usage

- Click the lightning button to open the library. Click **+** or **Add Prompt** to open the manager, where you can add, edit, delete, pin and reorder prompts.
- Pinned prompts appear first. When you have five or more prompts, a search field filters the list by title or content.
- Click a prompt to append it after your draft, separated by a blank line. The composer regains focus with the caret at the end.
- The **Settings** tab includes preserving your reading position after sending and an optional Enter-key mode. Choose double Enter, Ctrl/⌘ + Enter or Shift + Enter to send.
- You can hide the lightning button in the manager and reopen it from DSH **Settings → General → Prompt Library**.

## Storage and migration

On first activation, the plugin copies the prompts, order, pins and relevant input preferences from timeline on the same DSH origin and browser profile. It then saves changes independently and shares library changes across tabs on that origin. The **Data Sync** tab exports prompts and input preferences to a JSON backup and restores prompt libraries from this plugin or timeline. Merge matches prompts by ID. Overwrite replaces the list.

If you keep timeline enabled alongside this plugin, disable its prompt button, smart Enter and reading-position protection wherever you use the standalone equivalents. If you hid timeline’s button before migration, use DSH **Settings → General → Prompt Library** to enable the standalone button.

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

Use `npm run typecheck` for TypeScript checks and `npm run watch` to rebuild while editing.

## License

[GPL-3.0-or-later](./LICENSE)
