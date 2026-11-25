import { useSyncExternalStore } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { NS } from '../locales.ts'
import { settingsStore, type SmartEnterMode } from '../shared/settings.ts'
import { dropdown } from '../ui/dropdown.tsx'
import { Toggle, SettingItem } from './PromptManager.tsx'
import css from './panel.module.css'

type T = TranslateNS<typeof NS>
const CTRL_LABEL = navigator.platform.toUpperCase().includes('MAC') ? '⌘' : 'Ctrl'

function modeLabel(mode: SmartEnterMode, t: T): string {
  switch (mode) {
    case 'ctrlEnter': return `${CTRL_LABEL} + Enter`
    case 'shiftEnter': return 'Shift + Enter'
    default: return t('panel.smartEnterModeDouble')
  }
}

export function SmartInputTab({ t }: { readonly t: T }) {
  const settings = useSyncExternalStore(settingsStore.subscribe, () => settingsStore.get())

  // 提示文案中的 {mode} 替换为内联 Dropdown trigger（原 hintTemplate）。
  const hintTemplate = t('panel.smartEnterHint')
  const modeIndex = hintTemplate.indexOf('{mode}')
  const hintBefore = modeIndex >= 0 ? hintTemplate.slice(0, modeIndex) : hintTemplate
  const hintAfter = modeIndex >= 0 ? hintTemplate.slice(modeIndex + '{mode}'.length) : ''

  const setMode = (mode: SmartEnterMode): void => {
    // 切模式时重置换行提示次数（原 setMode：smartEnterToastCount: 0）。
    settingsStore.set({ smartEnterMode: mode, smartEnterToastCount: 0 })
  }

  return (
    <div className={css.smartInputRoot}>
      {/* 换行与发送消息：与追问功能同款 setting-item 卡片行（标题/提示在卡内、
          开关同行），提示文案中的 {mode} 仍替换为内联 Dropdown trigger。 */}
      <div className={css.settingSection}>
        <SettingItem
          label={t('panel.smartEnterTitle')}
          hint={(
            <>
              {hintBefore}
              {modeIndex >= 0
                ? (
                  <span
                    className={css.smartEnterModeTrigger}
                    onClick={(e) => {
                      dropdown.show({
                        trigger: e.currentTarget,
                        items: [
                          { label: modeLabel('doubleEnter', t), onClick: () => { setMode('doubleEnter') } },
                          { label: modeLabel('ctrlEnter', t), onClick: () => { setMode('ctrlEnter') } },
                          { label: modeLabel('shiftEnter', t), onClick: () => { setMode('shiftEnter') } },
                        ],
                        width: 180,
                        position: 'bottom-left',
                      })
                    }}
                  >
                    {modeLabel(settings.smartEnterMode, t)}
                    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden>
                      <path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )
                : null}
              {hintAfter}
            </>
          )}
          control={(
            <Toggle
              checked={settings.smartEnterEnabled}
              onChange={(enabled) => { settingsStore.set({ smartEnterEnabled: enabled }) }}
            />
          )}
        />
      </div>
    </div>
  )
}
