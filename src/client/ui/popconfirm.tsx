import { useEffect, useState, useSyncExternalStore } from 'react'
import { Bus } from './bus.ts'
import css from './ui.module.css'

interface PopconfirmOptions {
  readonly title: string
  readonly confirmText: string
  readonly cancelText: string
}

interface PopconfirmState extends PopconfirmOptions {
  readonly resolve: (result: boolean) => void
  readonly closing: boolean
}

const bus = new Bus<PopconfirmState | null>(null)

function close(result: boolean): void {
  const current = bus.get()
  if (current === null || current.closing) return
  const closing = { ...current, closing: true }
  bus.set(closing)
  current.resolve(result)
  setTimeout(() => {
    if (bus.get() === closing) bus.set(null)
  }, 200)
}

export const popconfirm = {
  show(options: PopconfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const current = bus.get()
      if (current !== null && !current.closing) close(false)
      bus.set({ ...options, resolve, closing: false })
    })
  },
  cancel(): void {
    const current = bus.get()
    if (current === null) return
    bus.set(null)
    if (!current.closing) current.resolve(false)
  },
}

export function PopconfirmHost() {
  const state = useSyncExternalStore(bus.subscribe, () => bus.get())

  // 进入动画：挂载后下一帧再加 visible 类（原版 requestAnimationFrame 淡入 + scale 弹入）。
  const active = state !== null && !state.closing
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    if (!active) {
      setEntered(false)
      return
    }
    const raf = requestAnimationFrame(() => { setEntered(true) })
    return () => { cancelAnimationFrame(raf) }
  }, [active])

  // ESC 取消（移植 _handleEscape；原版 100ms 后才挂监听，避免触发点击立即关闭，
  // React 合成事件在下一轮冒泡前不会命中，直接挂即可）。
  useEffect(() => {
    if (state === null || state.closing) return
    const onKeydown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close(false)
    }
    document.addEventListener('keydown', onKeydown)
    return () => { document.removeEventListener('keydown', onKeydown) }
  }, [state])

  if (state === null) return null

  return (
    <div
      className={!state.closing && entered ? `${css.popconfirmOverlay} ${css.popconfirmVisible}` : css.popconfirmOverlay}
      onClick={(e) => { if (e.target === e.currentTarget) close(false) }}
    >
      <div className={css.popconfirm} role="alertdialog" aria-modal="true">
        <div className={css.popconfirmContent}>
          <div className={css.popconfirmTitle}>{state.title}</div>
          <div className={css.popconfirmActions}>
            <button
              type="button"
              className={`${css.popconfirmBtn} ${css.popconfirmBtnCancel}`}
              onClick={(e) => { e.stopPropagation(); close(false) }}
            >
              {state.cancelText}
            </button>
            <button
              type="button"
              className={`${css.popconfirmBtn} ${css.popconfirmBtnDanger}`}
              onClick={(e) => { e.stopPropagation(); close(true) }}
            >
              {state.confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
