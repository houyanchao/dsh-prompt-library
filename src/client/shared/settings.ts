import { Bus } from '../ui/bus.ts'
import type { Context } from '@deepseek-ai/cordis'

export type SmartEnterMode = 'doubleEnter' | 'ctrlEnter' | 'shiftEnter'

export interface InputSettings {
  readonly smartEnterMode: SmartEnterMode
  readonly smartEnterEnabled: boolean
  readonly smartEnterToastCount: number
  readonly preventAutoScrollEnabled: boolean
}

const KEY = 'dsh.prompt-library.input'
const DEFAULTS: InputSettings = { smartEnterMode: 'doubleEnter', smartEnterEnabled: false, smartEnterToastCount: 0, preventAutoScrollEnabled: true }
const bus = new Bus(DEFAULTS)
let unsaved = false
let reportUnsaved: () => void = () => {}

export function parseInputSettings(value: unknown): Partial<InputSettings> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid input settings')
  const source = value as Record<string, unknown>
  const patch: { -readonly [K in keyof InputSettings]?: InputSettings[K] } = {}
  for (const key of ['smartEnterEnabled', 'preventAutoScrollEnabled'] as const) {
    if (!(key in source)) continue
    if (typeof source[key] !== 'boolean') throw new Error('Invalid input preference')
    patch[key] = source[key]
  }
  if ('smartEnterMode' in source) {
    const mode = source.smartEnterMode
    if (mode !== 'doubleEnter' && mode !== 'ctrlEnter' && mode !== 'shiftEnter') throw new Error('Invalid Enter mode')
    patch.smartEnterMode = mode
  }
  if ('smartEnterToastCount' in source) {
    const count = source.smartEnterToastCount
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) throw new Error('Invalid tip count')
    patch.smartEnterToastCount = count
  }
  return patch
}

function persist(settings: InputSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
    unsaved = false
  } catch {
    if (!unsaved) reportUnsaved()
    unsaved = true
  }
}

function normalize(value: unknown): InputSettings {
  const source = (typeof value === 'object' && value !== null ? value : {}) as Partial<InputSettings>
  return {
    smartEnterMode: source.smartEnterMode === 'ctrlEnter' || source.smartEnterMode === 'shiftEnter' ? source.smartEnterMode : 'doubleEnter',
    smartEnterEnabled: source.smartEnterEnabled === true,
    smartEnterToastCount: typeof source.smartEnterToastCount === 'number' ? source.smartEnterToastCount : 0,
    preventAutoScrollEnabled: source.preventAutoScrollEnabled !== false,
  }
}

function load(): InputSettings {
  if (unsaved) return bus.get()
  const raw = localStorage.getItem(KEY)
  if (raw !== null) return normalize(JSON.parse(raw))
  let migrated = DEFAULTS
  try { migrated = normalize(JSON.parse(localStorage.getItem('dsh.timeline.settings') ?? '{}')) } catch { /* Defaults for corrupt old settings. */ }
  persist(migrated)
  return migrated
}

export function bindInputSettings(ctx: Context, onUnsaved: () => void = () => {}): void {
  ctx.effect(() => {
    reportUnsaved = onUnsaved
    const sync = (): void => { try { bus.set(load()) } catch { /* Keep the current memory snapshot. */ } }
    sync()
    const refresh = (event: StorageEvent): void => {
      if (event.storageArea === localStorage && (event.key === KEY || event.key === null)) sync()
    }
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      reportUnsaved = () => {}
    }
  }, 'dsh-prompt-library: input settings')
}

export const settingsStore = {
  get: (): InputSettings => bus.get(),
  subscribe: bus.subscribe,
  set(patch: Partial<InputSettings>): void {
    let current = bus.get()
    try { current = load() } catch { /* Local storage may be disabled. */ }
    const next = normalize({ ...current, ...patch })
    persist(next)
    bus.set(next)
  },
}
