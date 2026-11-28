import type { Context } from '@deepseek-ai/cordis'
import { whenTimelineInactive } from './whenTimelineInactive.ts'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { bindTheme } from './shared/theme.ts'
import { bindStorage } from './library/storage.ts'
import { toast } from './ui/toast.tsx'
import { NS, zh, en } from './locales.ts'
import { clearPromptUi, PanelHost, SettingsEntry } from './library/PanelHost.tsx'
import { PromptButton } from './library/PromptButton.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    dshPromptBox: keyof typeof zh
  }
}

export const inject = ['slots', 'locale', 'theme']

export function apply(ctx: Context): void {
  whenTimelineInactive(ctx, { name: 'dsh-prompt-box', inject, apply: activate })
}

function activate(ctx: Context): void {
  bindTheme(ctx)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-prompt-box: locale')
  const onUnsaved = (): void => { toast.warning(ctx.locale.bind(NS)('panel.sessionOnly')) }
  bindStorage(ctx, onUnsaved)
  ctx.effect(() => clearPromptUi, 'dsh-prompt-box: dismiss prompt UI')
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left', id: 'dsh-prompt-box', locale: NS,
  }, PromptButton))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'dsh-prompt-box', locale: NS,
  }, PanelHost))
  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item', id: 'dsh-prompt-box', locale: NS, order: 80,
  }, SettingsEntry))
}
