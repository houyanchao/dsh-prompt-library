import { useEffect, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { NS } from '../locales.ts'
import { selectCurrentSessionId } from '../shared/currentSession.ts'
import { detectDarkTheme, observeTheme } from '../shared/theme.ts'
import { ToastHost, toast } from '../ui/toast.tsx'
import { TooltipHost, tooltip } from '../ui/tooltip.tsx'
import { PopconfirmHost, popconfirm } from '../ui/popconfirm.tsx'
import { libraryPanel } from './panel.ts'
import { PromptTab } from './PromptManager.tsx'
import { PromptBackupTab } from './Backup.tsx'
import css from './panel.module.css'
import ui from '../ui/ui.module.css'

const tabs = [
  ['prompts', 'panel.tabPrompt'],
  ['backup', 'panel.tabBackup'],
] as const

export function SettingsEntry({ t }: PropsLocale<typeof NS>) {
  return <div className={css.generalRow}>
    <span>{t('prompt.tooltipLibrary')}</span>
    <button type="button" onClick={() => libraryPanel.set('prompts')}>{t('prompt.manage')}</button>
  </div>
}

function dismiss(): void {
  tooltip.hide(true)
  popconfirm.cancel()
  libraryPanel.set(null)
}

export function clearPromptUi(): void {
  dismiss()
  toast.forceHideAll()
}

export function PanelHost({ t, useSessions }: PropsRuntime<'shell.overlay'> & PropsLocale<typeof NS>) {
  const session = useSessions(selectCurrentSessionId)
  const activeTab = useSyncExternalStore(libraryPanel.subscribe, () => libraryPanel.get())
  const dark = useSyncExternalStore(observeTheme, detectDarkTheme)
  const open = activeTab !== null
  useEffect(() => clearPromptUi, [session])
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])
  return createPortal(
    <div className={ui.host} data-theme={dark ? 'dark' : 'light'}>
      {open && <div className={css.modal}>
        <div className={css.overlay} onClick={dismiss} />
        <div className={css.wrapper} role="dialog" aria-modal="true" aria-label={t('prompt.tooltipLibrary')}>
          <div className={css.sidebar}>
            <div className={css.sidebarHeader}>
              <button type="button" className={css.close} aria-label={t('common.cancel')} onClick={dismiss}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
              <span className={css.sidebarTitle}>{t('prompt.tooltipLibrary')}</span>
            </div>
            <div className={css.tabs}>
              {tabs.map(([id, label]) =>
                <button key={id} type="button" className={id === activeTab ? `${css.tab} ${css.tabActive}` : css.tab} onClick={() => libraryPanel.set(id)}>{t(label)}</button>,
              )}
            </div>
          </div>
          <div className={css.main}>
            <div className={css.header}><h2 className={css.title}>{t(tabs.find(([id]) => id === activeTab)![1])}</h2></div>
            <div className={css.content}>
              {activeTab === 'prompts' && <PromptTab t={t} />}
              {activeTab === 'backup' && <PromptBackupTab t={t} />}
            </div>
          </div>
        </div>
      </div>}
      <ToastHost dark={dark} />
      <PopconfirmHost />
      <TooltipHost dark={dark} />
    </div>,
    document.body,
  )
}
