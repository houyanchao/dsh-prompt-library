import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Bus } from './bus.ts'
import css from './ui.module.css'

interface ToastColor {
  readonly backgroundColor: string
  readonly textColor: string
  readonly borderColor: string
}

interface ToastPalette {
  readonly light: ToastColor
  readonly dark: ToastColor
}

const white = { backgroundColor: '#ffffff', textColor: '#1f2937', borderColor: '#e5e7eb' }
const darkSurface = { backgroundColor: 'var(--dsw-alias-tooltip-bg)', textColor: '#ffffff', borderColor: 'var(--dsw-alias-tooltip-bg)' }
const types = {
  success: { color: { light: white, dark: white }, icon: '✓', duration: 1000 },
  error: { color: { light: darkSurface, dark: white }, icon: '⚠', duration: 1500 },
  warning: { color: { light: darkSurface, dark: white }, icon: '⚡', duration: 2000 },
}

interface ToastInstance {
  readonly id: number
  readonly message: string
  readonly color: ToastPalette
  readonly icon: string
  readonly leaving: boolean
}

let nextId = 1
const bus = new Bus<readonly ToastInstance[]>([])
const timers = new Map<number, ReturnType<typeof setTimeout>>()

function show(type: keyof typeof types, message: string, color = types[type].color): void {
  if (message === '') return
  const { icon, duration } = types[type]
  const id = nextId++
  bus.update(list => {
    const next = [...list, { id, message, color, icon, leaving: false }]
    const active = next.filter(t => !t.leaving)
    if (active.length <= 3) return next
    const oldest = active[0].id
    clearTimeout(timers.get(oldest))
    timers.delete(oldest)
    return next.filter(t => t.id !== oldest)
  })
  timers.set(id, setTimeout(() => {
    bus.update(list => list.map(t => t.id === id ? { ...t, leaving: true } : t))
    timers.set(id, setTimeout(() => {
      timers.delete(id)
      bus.update(list => list.filter(t => t.id !== id))
    }, 200))
  }, duration))
}

export const toast = {
  success: (message: string, color?: ToastPalette) => show('success', message, color),
  error: (message: string, color?: ToastPalette) => show('error', message, color),
  warning: (message: string) => show('warning', message),
  forceHideAll(): void {
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
    bus.set([])
  },
}

export function ToastHost({ dark }: { readonly dark: boolean }) {
  const list = useSyncExternalStore(bus.subscribe, () => bus.get())
  const refs = useRef(new Map<number, HTMLDivElement>())
  const shown = useRef(new Set<number>())
  const hostRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    let top = 60
    for (const t of list) {
      const el = refs.current.get(t.id)
      if (!el) continue
      if (t.leaving) {
        // 退场时冻结位置，其他提示继续向上堆叠。
        el.classList.remove(css.toastVisible)
        continue
      }
      const rect = el.getBoundingClientRect()
      el.style.left = `${(window.innerWidth - rect.width) / 2}px`
      el.style.top = `${top}px`
      top += rect.height + 10
      if (!shown.current.has(t.id)) {
        shown.current.add(t.id)
        requestAnimationFrame(() => { el.classList.add(css.toastVisible) })
      }
    }
    for (const id of shown.current) {
      if (!refs.current.has(id)) shown.current.delete(id)
    }
    // 与其他同层级弹窗同时打开时，提示置于最前。
    const host = hostRef.current
    if (host?.parentNode === document.body) document.body.appendChild(host)
  }, [list])

  if (!list.length) return null
  return createPortal(
    <div ref={hostRef} className={css.host}>
      {list.map(t => {
        const color = dark ? t.color.dark : t.color.light
        return (
          <div
            key={t.id}
            ref={el => {
              if (el) refs.current.set(t.id, el)
              else refs.current.delete(t.id)
            }}
            className={css.toast}
            style={{ backgroundColor: color.backgroundColor, color: color.textColor, border: `1px solid ${color.borderColor}` }}
          >
            <span className={css.toastIcon}>{t.icon}</span>
            <span>{t.message}</span>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}
