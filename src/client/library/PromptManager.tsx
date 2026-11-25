import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { NS } from '../locales.ts'
import { promptsStore, sortPrompts, type Prompt } from './storage.ts'
import { toast } from '../ui/toast.tsx'
import { tooltip } from '../ui/tooltip.tsx'
import { popconfirm } from '../ui/popconfirm.tsx'
import css from './panel.module.css'

type T = TranslateNS<typeof NS>

export interface ToggleProps {
  readonly checked: boolean
  readonly ariaLabel?: string
  readonly onChange: (checked: boolean) => void
}

/** 开关（原 .ait-toggle-switch）。 */
export function Toggle({ checked, ariaLabel, onChange }: ToggleProps) {
  return (
    <label className={css.toggle}>
      <input type="checkbox" checked={checked} aria-label={ariaLabel} onChange={(e) => { onChange(e.target.checked) }} />
      <span className={css.toggleSlider} />
    </label>
  )
}

interface SettingItemProps {
  readonly label: React.ReactNode
  readonly hint: React.ReactNode
  readonly control: React.ReactNode
}

/** 设置行（原 .setting-item）。 */
export function SettingItem({ label, hint, control }: SettingItemProps) {
  return (
    <div className={css.settingItem}>
      <div className={css.settingInfo}>
        <div className={css.settingLabel}>{label}</div>
        <div className={css.settingHint}>{hint}</div>
      </div>
      {control}
    </div>
  )
}
export function PromptTab({ t }: { readonly t: T }) {
  const library = useSyncExternalStore(promptsStore.subscribe, promptsStore.get)
  const prompts = library.prompts
  const sorted = useMemo(() => sortPrompts(prompts), [prompts])
  const [modal, setModal] = useState<{ readonly mode: 'add' } | { readonly mode: 'edit'; readonly prompt: Prompt } | null>(null)

  const actionTooltip = (id: string, text: string) => ({
    'aria-label': text,
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      tooltip.show(id, e.currentTarget, text, {})
    },
    onMouseLeave: () => { tooltip.hide() },
  })

  function change(action: () => void): boolean {
    try { action(); return true } catch { toast.error(t('panel.storageFailed')); return false }
  }

  const deletePrompt = async (id: string): Promise<void> => {
    const confirmed = await popconfirm.show({
      title: t('panel.promptDeleteConfirm'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      confirmTextType: 'danger',
    })
    if (confirmed && change(() => promptsStore.remove(id))) {
      toast.success(t('panel.promptDeleted'))
    }
  }

  return (
    <div className={css.settingsRoot}>
      <div className={css.settingsScroll}>
        <div className={css.promptListSection}>
          <div className={css.promptListHeader}>
            <div className={css.promptListTitle}>{t('panel.promptListTitle')}</div>
            <button type="button" className={css.promptAddBtn} onClick={() => { setModal({ mode: 'add' }) }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>{t('panel.promptAdd')}</span>
            </button>
          </div>
          <div className={css.promptListContainer}>
            {sorted.length === 0
              ? (
                <div className={css.promptEmpty}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <span>{t('panel.promptEmpty')}</span>
                </div>
              )
              : sorted.map(prompt => (
                <div key={prompt.id} className={css.promptItem}>
                  <div className={css.promptItemContent}>
                    <div className={css.promptItemHeader}>
                      <div className={css.promptItemName}>
                        {prompt.pinned === true
                          ? (
                            <span className={css.promptPinBadge}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                                <line x1="5" y1="3" x2="19" y2="3" />
                                <line x1="12" y1="7" x2="12" y2="21" />
                                <polyline points="8 11 12 7 16 11" />
                              </svg>
                            </span>
                          )
                          : null}
                        <span className={css.promptItemNameText}>{prompt.name}</span>
                      </div>
                      <div className={css.promptItemActions}>
                        <button
                          type="button"
                          className={prompt.pinned === true ? `${css.promptItemBtn} ${css.promptPinBtnActive}` : css.promptItemBtn}
                          {...actionTooltip('prompt-pin', t('panel.promptPin'))}
                          onClick={() => {
                            if (!change(() => promptsStore.togglePin(prompt.id))) return
                            const nowPinned = prompt.pinned !== true
                            toast.success(nowPinned ? t('panel.promptPinned') : t('panel.promptUnpinned'))
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                            <line x1="5" y1="3" x2="19" y2="3" />
                            <line x1="12" y1="7" x2="12" y2="21" />
                            <polyline points="8 11 12 7 16 11" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className={css.promptItemBtn}
                          {...actionTooltip('prompt-edit', t('common.edit'))}
                          onClick={() => { setModal({ mode: 'edit', prompt }) }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className={`${css.promptItemBtn} ${css.promptDeleteBtn}`}
                          {...actionTooltip('prompt-delete', t('common.delete'))}
                          onClick={() => { void deletePrompt(prompt.id) }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className={css.promptItemBtn}
                          {...actionTooltip('prompt-move-up', t('panel.promptMoveUp'))}
                          onClick={() => { change(() => promptsStore.move(prompt.id, 'up')) }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <polyline points="18 15 12 9 6 15" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className={css.promptItemBtn}
                          {...actionTooltip('prompt-move-down', t('panel.promptMoveDown'))}
                          onClick={() => { change(() => promptsStore.move(prompt.id, 'down')) }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className={css.promptItemText}>
                      <span className={css.promptItemTextContent}>{prompt.content}</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
      {/* 底部悬浮：显示提示词按钮（DSH 单平台，开关直接内联，不再弹平台子弹窗） */}
      <div className={css.bottomDivider} />
      <div className={css.bottomSection}>
        <SettingItem
          label={t('panel.promptBtnLabel')}
          hint={t('panel.promptBtnHint')}
          control={(
            <Toggle
              ariaLabel={t('panel.promptBtnLabel')}
              checked={library.promptButtonEnabled}
              onChange={(enabled) => { change(() => promptsStore.setButtonEnabled(enabled)) }}
            />
          )}
        />
      </div>
      {modal !== null
        ? (
          <PromptModal
            t={t}
            prompt={modal.mode === 'edit' ? modal.prompt : null}
            onClose={() => { setModal(null) }}
          />
        )
        : null}
    </div>
  )
}

interface PromptModalProps {
  readonly t: T
  /** 编辑目标；null 为新增。 */
  readonly prompt: Prompt | null
  readonly onClose: () => void
}

/** 提示词编辑弹窗（原 showPromptModal；DSH 单平台，无「适用于」平台选择器）。 */
function PromptModal({ t, prompt, onClose }: PromptModalProps) {
  const isEdit = prompt !== null
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)
  const [name, setName] = useState(prompt?.name ?? '')
  const [content, setContent] = useState(prompt?.content ?? '')
  const nameRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const raf = requestAnimationFrame(() => { setVisible(true) })
    return () => { cancelAnimationFrame(raf) }
  }, [])

  // 内容区自动调高（原 autoResize，上限 200px）。
  const autoResize = (): void => {
    const el = contentRef.current
    if (el === null) return
    el.style.height = 'auto'
    el.style.height = `${String(Math.min(el.scrollHeight, 200))}px`
  }
  useEffect(() => { autoResize() }, [])

  const close = (): void => {
    setClosing(true)
    setVisible(false)
    setTimeout(onClose, 200)
  }

  const save = (): void => {
    const trimmedName = name.trim()
    const trimmedContent = content.trim()
    if (trimmedName === '') {
      toast.error(t('panel.promptRequired'))
      nameRef.current?.focus()
      return
    }
    if (trimmedContent === '') {
      toast.error(t('panel.promptRequired'))
      contentRef.current?.focus()
      return
    }
    try {
      if (isEdit) promptsStore.update(prompt.id, { name: trimmedName, content: trimmedContent })
      else promptsStore.add(trimmedName, trimmedContent)
    } catch {
      toast.error(t('panel.storageFailed'))
      return
    }
    toast.success(isEdit ? t('panel.promptUpdated') : t('panel.promptAdded'))
    close()
  }

  return (
    <div className={visible && !closing ? `${css.promptModalOverlay} ${css.promptModalVisible}` : css.promptModalOverlay}>
      <div className={css.promptModal} role="dialog" aria-modal="true" aria-label={isEdit ? t('panel.promptEditTitle') : t('panel.promptAddTitle')}>
        <div className={css.promptModalHeader}>
          <h3>{isEdit ? t('panel.promptEditTitle') : t('panel.promptAddTitle')}</h3>
          <button type="button" className={css.promptModalClose} onClick={close} aria-label={t('common.cancel')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className={css.promptModalBody}>
          <div className={css.promptModalField}>
            <label>
              {t('panel.promptNameLabel')}
              <span className={css.requiredMark}>*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              className={css.promptModalInput}
              placeholder={t('panel.promptNamePlaceholder')}
              maxLength={16}
              value={name}
              onChange={(e) => { setName(e.target.value) }}
            />
          </div>
          <div className={css.promptModalField}>
            <label>
              {t('panel.promptContentLabel')}
              <span className={css.requiredMark}>*</span>
            </label>
            <textarea
              ref={contentRef}
              className={css.promptModalTextarea}
              placeholder={t('panel.promptContentPlaceholder')}
              rows={4}
              maxLength={20000}
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                autoResize()
              }}
            />
            <div className={css.promptCharCounter}>
              <span>{`${String(content.length)}/20000`}</span>
            </div>
          </div>
        </div>
        <div className={css.promptModalFooter}>
          <button type="button" className={`${css.promptModalBtn} ${css.promptModalCancel}`} onClick={close}>
            {t('common.cancel')}
          </button>
          <button type="button" className={`${css.promptModalBtn} ${css.promptModalConfirm}`} onClick={save}>
            {t('panel.promptSave')}
          </button>
        </div>
      </div>
    </div>
  )
}
