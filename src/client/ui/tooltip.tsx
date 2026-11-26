import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Bus } from './bus.ts'
import css from './ui.module.css'

const BUTTON_COLORS = {
  light: { backgroundColor: '#f8fafc', textColor: '#334155', borderColor: '#e2e8f0' },
  dark: { backgroundColor: '#27272a', textColor: '#e5e7eb', borderColor: '#3f3f46' },
} as const

interface TooltipColor {
  readonly backgroundColor: string
  readonly textColor: string
  readonly borderColor: string
}

interface TooltipOptions {
  readonly placement?: 'top' | 'bottom' | 'right'
  readonly maxWidth?: number
  readonly showDelay?: number
  readonly gap?: number
  readonly noArrow?: boolean
  readonly size?: 'small'
  readonly color?: TooltipColor
}

interface TooltipState {
  readonly id: string
  readonly target: HTMLElement
  readonly content: string
  readonly options: TooltipOptions
}

const tipBus = new Bus<TooltipState | null>(null)
let showTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

function clearTimers(): void {
  if (showTimer !== null) { clearTimeout(showTimer); showTimer = null }
  if (hideTimer !== null) { clearTimeout(hideTimer); hideTimer = null }
}

export const tooltip = {
  show(id: string, target: HTMLElement, content: string, options: TooltipOptions = {}): void {
    if (!target.isConnected || content === '') return
    clearTimers()
    const current = tipBus.get()
    if (current?.id === id && current.target === target && current.content === content) return
    const delay = options.showDelay ?? 0
    showTimer = setTimeout(() => {
      showTimer = null
      if (!target.isConnected) return
      tipBus.set({ id, target, content, options })
    }, delay)
  },
  hide(immediate = false): void {
    clearTimers()
    if (immediate) {
      tipBus.set(null)
      return
    }
    hideTimer = setTimeout(() => {
      hideTimer = null
      tipBus.set(null)
    }, 100)
  },
}

export function TooltipHost({ dark }: { readonly dark: boolean }) {
  const busTip = useSyncExternalStore(tipBus.subscribe, () => tipBus.get())
  const tipRef = useRef<HTMLDivElement>(null)

  // ==== 隐藏淡出（原 _hideImmediate：移除 visible 类淡出，200ms 后销毁 DOM） ====
  const [tip, setTip] = useState<TooltipState | null>(busTip)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useLayoutEffect(() => {
    if (busTip !== null) {
      // 新 tooltip：立即替换（原版销毁旧实例重建，无并存过渡）。
      if (leaveTimerRef.current !== null) {
        clearTimeout(leaveTimerRef.current)
        leaveTimerRef.current = null
      }
      setTip(busTip)
      return
    }
    if (tip === null) return
    // 隐藏：先移除 visible 类触发 0.15s 淡出，200ms 后卸载（原 cleanupAnimation）。
    tipRef.current?.classList.remove(css.tooltipVisible)
    leaveTimerRef.current = setTimeout(() => {
      leaveTimerRef.current = null
      setTip(null)
    }, 200)
    return () => {
      if (leaveTimerRef.current !== null) {
        clearTimeout(leaveTimerRef.current)
        leaveTimerRef.current = null
      }
    }
    // tip 仅在本效应内派生更新，无需作为依赖。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busTip])

  // ==== 主 tooltip 定位（移植 _showImmediate + _calculatePosition） ====
  useLayoutEffect(() => {
    const el = tipRef.current
    if (el === null || tip === null) return
    // 切换目标时重新淡入（原版销毁旧 DOM 后新实例从隐藏态 rAF 淡入）。
    el.classList.remove(css.tooltipVisible)
    const targetRect = tip.target.getBoundingClientRect()
    const tipRect = el.getBoundingClientRect()
    const gap = tip.options.gap ?? 12
    const pad = 8
    let placement = tip.options.placement ?? 'bottom'
    if (placement === 'top' && targetRect.top - tipRect.height - gap < pad
      && targetRect.bottom + gap + tipRect.height <= window.innerHeight - pad) {
      placement = 'bottom'
    }

    let left: number
    let top: number
    switch (placement) {
      case 'right':
        left = targetRect.right + gap
        top = targetRect.top + (targetRect.height - tipRect.height) / 2
        break
      case 'top':
        left = targetRect.left + (targetRect.width - tipRect.width) / 2
        top = targetRect.top - tipRect.height - gap
        break
      default:
        left = targetRect.left + (targetRect.width - tipRect.width) / 2
        top = targetRect.bottom + gap
    }
    left = Math.round(left)
    top = Math.round(top)

    // 保留与视口边缘的间距。
    if (left < pad) left = pad
    else if (left + tipRect.width > window.innerWidth - pad) left = window.innerWidth - tipRect.width - pad
    if (top < pad) top = pad
    else if (top + tipRect.height > window.innerHeight - pad) top = window.innerHeight - tipRect.height - pad

    // 箭头偏移（原 _calculateArrowOffset）。
    const targetCenterX = targetRect.left + targetRect.width / 2
    const targetCenterY = targetRect.top + targetRect.height / 2
    let arrowOffset = '50%'
    if (placement === 'top' || placement === 'bottom') {
      const offsetPx = targetCenterX - left
      arrowOffset = `${Math.max(12, Math.min(tipRect.width - 12, offsetPx))}px`
    } else {
      const offsetPx = targetCenterY - top
      arrowOffset = `${Math.max(12, Math.min(tipRect.height - 12, offsetPx))}px`
    }

    el.setAttribute('data-placement', placement)
    el.style.setProperty('--arrow-offset', arrowOffset)
    el.style.left = `${left}px`
    el.style.top = `${top}px`
    const frame = requestAnimationFrame(() => {
      if (tipBus.get() === tip) el.classList.add(css.tooltipVisible)
    })
    return () => { cancelAnimationFrame(frame) }
  }, [tip])

  // ==== 安全网：滚动/点击/ESC/失焦 隐藏（移植 _setupGlobalListeners） ====
  useEffect(() => {
    if (tip === null) return
    const onScroll = (): void => { tooltip.hide(true) }
    const onClick = (e: MouseEvent): void => {
      const t = e.target
      if (t instanceof Node && (tip.target === t || tip.target.contains(t))) return
      if (tipRef.current !== null && t instanceof Node && tipRef.current.contains(t)) return
      tooltip.hide(true)
    }
    const onKeydown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') tooltip.hide(true)
    }
    const onBlur = (): void => { tooltip.hide(true) }
    document.addEventListener('scroll', onScroll, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKeydown)
    window.addEventListener('blur', onBlur)

    // 目标移出视口时隐藏（移植 IntersectionObserver 安全网）。
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) tooltip.hide(true)
      }
    }, { threshold: 0 })
    io.observe(tip.target)

    return () => {
      document.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKeydown)
      window.removeEventListener('blur', onBlur)
      io.disconnect()
    }
  }, [tip])

  if (tip === null) return null
  const colors = tip.options.color ?? (dark ? BUTTON_COLORS.dark : BUTTON_COLORS.light)
  return (
    <div
      ref={tipRef}
      className={[
        css.tooltipBase,
        tip.options.noArrow ? css.tooltipNoArrow : '',
        tip.options.size === 'small' ? css.tooltipSmall : '',
      ].filter(Boolean).join(' ')}
      role="tooltip"
      style={{
        maxWidth: tip.options.maxWidth ?? 400,
        '--ui-tooltip-bg': colors.backgroundColor,
        '--ui-tooltip-text': colors.textColor,
        '--ui-tooltip-border': colors.borderColor,
      } as React.CSSProperties}
    >
      {tip.content}
    </div>
  )
}
