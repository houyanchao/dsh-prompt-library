import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { NS } from '../locales.ts'
import { detectDarkTheme, observeTheme } from '../shared/theme.ts'
import { tooltip } from '../ui/tooltip.tsx'
import { libraryPanel } from './panel.ts'
import { promptsStore, sortPrompts, type Prompt } from './storage.ts'
import css from './promptButton.module.css'

/** 下拉固定尺寸与定位参数（原 _positionPromptDropdown）。 */
const DROPDOWN_WIDTH = 320
const DROPDOWN_HEIGHT = 400
const TOP_PADDING = 20
const GAP = 8

/** 追加文本的最终草稿（原 _defaultInsertText 的 textarea 分支）。 */
function appendPromptText(existingText: string, text: string): string {
  if (existingText.trim() === '') return `${text}\n\n`
  const cleanedText = existingText.replace(/\n+$/, '')
  return `${cleanedText}\n\n${text}\n\n`
}

/** 宿主「命令」按钮（工具行里唯一的 listbox 弹出按钮，InputBar 的 .add）。 */
const COMMAND_BTN_SELECTOR = 'button[aria-haspopup="listbox"]'

/**
 * 提示词库 tooltip 配色：单套固定形态，直接引宿主原生 tooltip 的 token
 * （ui-primitives Tooltip 的深色底板 + 恒白文字；边框取底色即隐形）。
 */
const LIBRARY_TIP_COLOR = {
  backgroundColor: 'var(--dsw-alias-tooltip-bg)',
  textColor: 'var(--dsw-static-neutral-bluish-00)',
  borderColor: 'var(--dsw-alias-tooltip-bg)',
} as const

/**
 * 在【命令】按钮紧邻右侧造一个 portal 挂载座。
 * 容器 display: contents，提示词按钮直接成为工具行的 flex 项、
 * 吃行自己的 16px 间距；行卸载（会话切换）时本组件同月同灭，
 * 清理函数移除容器即可。
 * @param markerRef - 渲染在槽位里的隐藏锚点，向上定位工具行。
 * @returns 挂载座；定位不到命令按钮时为 null（调用方就地渲染兜底）。
 */
function useCommandSideSeat(markerRef: RefObject<HTMLElement | null>): HTMLElement | null {
  const [seat, setSeat] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const marker = markerRef.current
    if (marker === null) return

    // 槽位条目外面有宿主的包装节点，从锚点向上找到包含命令按钮的工具行。
    let tools: HTMLElement | null = marker.parentElement
    while (tools !== null && tools.querySelector(COMMAND_BTN_SELECTOR) === null) {
      tools = tools.parentElement
    }
    const commandBtn = tools?.querySelector(COMMAND_BTN_SELECTOR) ?? null
    if (tools === null || commandBtn === null) return

    // 命令按钮理论上可能被再包一层，锚定到工具行的直接子节点。
    let anchorTop: Element = commandBtn
    while (anchorTop.parentElement !== null && anchorTop.parentElement !== tools) {
      anchorTop = anchorTop.parentElement
    }

    const container = document.createElement('div')
    container.style.display = 'contents'
    tools.insertBefore(container, anchorTop.nextSibling)
    setSeat(container)
    return () => {
      container.remove()
      setSeat(null)
    }
  }, [markerRef])

  return seat
}

type PromptButtonProps = PropsRuntime<'conversation.input.left'> & PropsLocale<typeof NS>

export function PromptButton({ useInput, inputActions, t }: PromptButtonProps) {
  const library = useSyncExternalStore(promptsStore.subscribe, promptsStore.get)
  const draft = useInput(s => s.draft)
  const [dark, setDark] = useState(() => detectDarkTheme())
  useEffect(() => observeTheme(() => { setDark(detectDarkTheme()) }), [])

  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const markerRef = useRef<HTMLSpanElement>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft

  const seat = useCommandSideSeat(markerRef)

  const insertPrompt = (prompt: Prompt): void => {
    if (prompt.content === '') return
    let composer = markerRef.current?.parentElement ?? null
    while (composer !== null && !composer.querySelector('[data-input-scroll]')) composer = composer.parentElement
    const scroll = composer?.querySelector('[data-input-scroll]') ?? null
    inputActions.setDraft(appendPromptText(draftRef.current, prompt.content))
    setTimeout(() => {
      const input = scroll?.querySelector<HTMLElement>('textarea, [contenteditable="true"]')
      if (!input?.isConnected) return
      input.focus()
      if (input instanceof HTMLTextAreaElement) {
        input.setSelectionRange(input.value.length, input.value.length)
      } else {
        const selection = window.getSelection()
        if (selection !== null) {
          const range = document.createRange()
          range.selectNodeContents(input)
          range.collapse(false)
          selection.removeAllRanges()
          selection.addRange(range)
        }
      }
      if (scroll !== null) scroll.scrollTop = scroll.scrollHeight
    }, 50)
  }

  const libraryLabel = t('prompt.tooltipLibrary')

  const button = (
    <button
      ref={btnRef}
      type="button"
      className={css.promptBtn}
      aria-label={libraryLabel}
      aria-expanded={open}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        tooltip.hide(true)
        setOpen(v => !v)
      }}
      onMouseEnter={(e) => {
        tooltip.show('prompt-btn-library', e.currentTarget, libraryLabel, {
          placement: 'top',
          showDelay: 300,
          noArrow: true,
          size: 'small',
          color: LIBRARY_TIP_COLOR,
        })
      }}
      onMouseLeave={() => { tooltip.hide() }}
    >
      <svg className={css.promptIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    </button>
  )

  return (
    <>
      {/* 隐藏锚点：只用来定位工具行（本体 portal 到命令按钮右侧的挂载座）。 */}
      <span ref={markerRef} hidden />
      {seat !== null ? createPortal(button, seat) : button}
      {open
        ? (
          <PromptDropdown
            anchor={btnRef.current}
            dark={dark}
            prompts={library.prompts}
            t={t}
            onClose={() => { setOpen(false) }}
            onItemClick={(p) => {
              setOpen(false)
              insertPrompt(p)
            }}
          />
        )
        : null}
    </>
  )
}

interface PromptDropdownProps {
  readonly anchor: HTMLElement | null
  readonly dark: boolean
  readonly prompts: readonly Prompt[]
  readonly t: PromptButtonProps['t']
  readonly onClose: () => void
  readonly onItemClick: (prompt: Prompt) => void
}

/** 提示词下拉面板（原 createPromptDropdownUI，portal 到 body）。 */
function PromptDropdown({ anchor, dark, prompts, t, onClose, onItemClick }: PromptDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [query, setQuery] = useState('')

  // 定位（原 _positionPromptDropdown：与按钮左对齐、向上展开、边界修正）。
  useLayoutEffect(() => {
    const el = containerRef.current
    if (el === null || anchor === null) return
    const buttonRect = anchor.getBoundingClientRect()

    let left = buttonRect.left
    if (left + DROPDOWN_WIDTH > window.innerWidth - 8) {
      left = window.innerWidth - DROPDOWN_WIDTH - 8
    }
    left = Math.max(8, left)
    const top = Math.max(TOP_PADDING, buttonRect.top - GAP - DROPDOWN_HEIGHT)

    el.style.width = `${DROPDOWN_WIDTH}px`
    el.style.height = `${DROPDOWN_HEIGHT}px`
    el.style.left = `${left}px`
    el.style.top = `${top}px`
  }, [anchor])

  // 入场动画（原 requestAnimationFrame 加 visible 类）。
  useEffect(() => {
    const raf = requestAnimationFrame(() => { setVisible(true) })
    return () => { cancelAnimationFrame(raf) }
  }, [])

  // 点击外部关闭（原 _boundCloseOnClickOutside，capture）。
  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      const target = e.target as Node
      if (containerRef.current?.contains(target) !== true && target !== anchor && anchor?.contains(target) !== true) {
        tooltip.hide(true)
        onClose()
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('click', onClick, true)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', onClick, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sorted = sortPrompts(prompts)
  const q = query.trim().toLowerCase()
  const filtered = q === ''
    ? sorted
    : sorted.filter(p => p.name.toLowerCase().includes(q) || p.content.toLowerCase().includes(q))

  const openManage = (): void => {
    // 下拉卸载时不会触发 mouseleave，导航前主动清理提示。
    tooltip.hide(true)
    onClose()
    libraryPanel.set('prompts')
  }

  const showManageTooltip = (target: HTMLButtonElement): void => {
    tooltip.show('prompt-manage', target, t('prompt.manage'), {
      placement: 'top',
      noArrow: true,
      size: 'small',
      color: LIBRARY_TIP_COLOR,
    })
  }

  return createPortal(
    <>
      <div className={css.overlay} onClick={onClose} />
      <div
        ref={containerRef}
        className={visible ? `${css.container} ${css.visible}` : css.container}
        data-theme={dark ? 'dark' : 'light'}
      >
        <div className={css.header}>
          <span className={css.title}>{t('prompt.title')}</span>
          <button
            type="button"
            className={css.manageButton}
            aria-label={t('prompt.manage')}
            onClick={openManage}
            onMouseEnter={(event) => showManageTooltip(event.currentTarget)}
            onFocus={(event) => showManageTooltip(event.currentTarget)}
            onMouseLeave={() => tooltip.hide()}
            onBlur={() => tooltip.hide()}
          >
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M7 1V13M1 7H13" />
            </svg>
          </button>
        </div>
        {sorted.length >= 5
          ? (
            <div className={css.search}>
              <input
                type="text"
                className={css.searchInput}
                placeholder={t('prompt.search')}
                autoComplete="off"
                value={query}
                onChange={(e) => { setQuery(e.target.value) }}
              />
            </div>
          )
          : null}
        <div className={css.body}>
          {sorted.length === 0
            ? (
              <div className={css.empty}>
                <span className={css.emptyHint}>{t('prompt.emptyHint')}</span>
                <button
                  type="button"
                  className={css.emptyAction}
                  onClick={(e) => {
                    e.stopPropagation()
                    openManage()
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span>{t('prompt.add')}</span>
                </button>
              </div>
            )
            : filtered.length === 0
              ? <div className={css.searchEmpty}>{t('prompt.noResults')}</div>
              : filtered.map(prompt => (
                <PromptItem key={prompt.id} prompt={prompt} onClick={() => { onItemClick(prompt) }} />
              ))}
        </div>
      </div>
    </>,
    document.body,
  )
}

interface PromptItemProps {
  readonly prompt: Prompt
  readonly onClick: () => void
}

/** 单条提示词（原 _promptDropdownCreateItem：置顶图标 + 溢出时 hover tooltip）。 */
function PromptItem({ prompt, onClick }: PromptItemProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  return (
    <div
      className={css.item}
      onClick={onClick}
      onMouseEnter={(e) => {
        const contentEl = contentRef.current
        if (prompt.content === '' || contentEl === null) return
        if (contentEl.scrollWidth <= contentEl.clientWidth) return
        tooltip.show(`prompt-dd-${prompt.id}`, e.currentTarget, prompt.content, {
          placement: 'right',
          maxWidth: 300,
          showDelay: 300,
          gap: 14,
        })
      }}
      onMouseLeave={() => { tooltip.hide() }}
    >
      <div className={css.itemMain}>
        {prompt.pinned === true
          ? (
            <span className={`${css.itemIcon} ${css.pinnedIcon}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2.5" aria-hidden>
                <line x1="5" y1="3" x2="19" y2="3" />
                <line x1="12" y1="7" x2="12" y2="21" />
                <polyline points="8 11 12 7 16 11" />
              </svg>
            </span>
          )
          : null}
        <span className={css.itemName}>{prompt.name}</span>
      </div>
      <div ref={contentRef} className={css.itemContent}>{prompt.content}</div>
    </div>
  )
}
