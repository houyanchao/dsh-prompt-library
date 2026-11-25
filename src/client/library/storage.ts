import type { Context } from '@deepseek-ai/cordis'
import { parseInputSettings, settingsStore, type InputSettings } from '../shared/settings.ts'
import { Bus } from '../ui/bus.ts'

export interface Prompt {
  readonly id: string
  readonly name: string
  readonly content: string
  readonly pinned?: boolean
}

interface Library {
  readonly prompts: readonly Prompt[]
  readonly promptButtonEnabled: boolean
}

const KEY = 'dsh.prompt-library.v1'
const LEGACY_PROMPTS = 'dsh.timeline.prompts'
const LEGACY_SETTINGS = 'dsh.timeline.settings'
const EMPTY: Library = { prompts: [], promptButtonEnabled: true }
const bus = new Bus<Library>(EMPTY)
let unsaved = false
let reportUnsaved: () => void = () => {}

function persist(value: Library): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(value))
    unsaved = false
  } catch {
    if (!unsaved) reportUnsaved()
    unsaved = true
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isPrompt(value: unknown): value is Prompt {
  return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string'
    && typeof value.content === 'string' && (value.pinned === undefined || typeof value.pinned === 'boolean')
}

function isLibrary(value: unknown): value is Library {
  return isRecord(value) && Array.isArray(value.prompts) && value.prompts.every(isPrompt)
    && typeof value.promptButtonEnabled === 'boolean'
}

function readJson(key: string): unknown {
  const raw = localStorage.getItem(key)
  return raw === null ? undefined : JSON.parse(raw)
}

function load(): Library {
  if (unsaved) return bus.get()
  const value = readJson(KEY)
  if (value !== undefined) return isLibrary(value) ? value : bus.get()
  let prompts: readonly Prompt[] = []
  let enabled = true
  try {
    const oldPrompts = readJson(LEGACY_PROMPTS)
    if (Array.isArray(oldPrompts)) prompts = oldPrompts.filter(isPrompt)
  } catch { /* A malformed list must not invalidate the separate preference. */ }
  try {
    const settings = readJson(LEGACY_SETTINGS)
    if (isRecord(settings) && typeof settings.promptButtonEnabled === 'boolean') enabled = settings.promptButtonEnabled
  } catch { /* Keep the default visibility. */ }
  const migrated = { prompts, promptButtonEnabled: enabled }
  persist(migrated)
  return migrated
}

function reload(): void {
  try { bus.set(load()) } catch { /* Keep the last usable snapshot. */ }
}

export function bindStorage(ctx: Context, onUnsaved: () => void = () => {}): void {
  ctx.effect(() => {
    reportUnsaved = onUnsaved
    reload()
    const refresh = (event: StorageEvent): void => {
      if (event.storageArea === localStorage && (event.key === null || event.key === KEY)) reload()
    }
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      reportUnsaved = () => {}
    }
  }, 'dsh-prompt-library: storage')
}

function update(transform: (previous: Library) => Library): void {
  let current = bus.get()
  try { current = load() } catch { /* Storage may be unavailable. */ }
  const next = transform(current)
  persist(next)
  bus.set(next)
}

function changeList(transform: (prompts: readonly Prompt[]) => readonly Prompt[]): void {
  update(previous => ({ ...previous, prompts: transform(previous.prompts) }))
}

export const promptsStore = {
  get: (): Library => bus.get(),
  subscribe: bus.subscribe,
  setButtonEnabled(promptButtonEnabled: boolean): void {
    update(previous => ({ ...previous, promptButtonEnabled }))
  },
  add(name: string, content: string): void {
    const id = `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    changeList(list => [...list, { id, name, content }])
  },
  update(id: string, fields: Pick<Prompt, 'name' | 'content'>): void {
    changeList(list => list.map(prompt => prompt.id === id ? { ...prompt, ...fields } : prompt))
  },
  remove(id: string): void {
    changeList(list => list.filter(prompt => prompt.id !== id))
  },
  togglePin(id: string): void {
    changeList(list => list.map(prompt => prompt.id === id ? { ...prompt, pinned: !prompt.pinned } : prompt))
  },
  move(id: string, direction: 'up' | 'down'): void {
    changeList(list => {
      const index = list.findIndex(prompt => prompt.id === id)
      if (index < 0) return list
      const pinned = Boolean(list[index].pinned)
      const step = direction === 'up' ? -1 : 1
      let target = index + step
      while (list[target] !== undefined && Boolean(list[target].pinned) !== pinned) target += step
      if (list[target] === undefined) return list
      const moved = [...list]
      moved[index] = list[target]
      moved[target] = list[index]
      return moved
    })
  },
}

export function sortPrompts(prompts: readonly Prompt[]): readonly Prompt[] {
  return [...prompts].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
}

export function exportBackup(): void {
  const backup = { _meta: { source: 'dsh-prompt-library', version: 1 }, data: { ...bus.get(), inputSettings: settingsStore.get() } }
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `dsh-prompt-library-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function restoreBackup(value: unknown, mode: 'merge' | 'overwrite'): void {
  if (!isRecord(value) || !isRecord(value.data)) throw new Error('Invalid backup')
  const source = isRecord(value._meta) ? value._meta.source : undefined
  let prompts: readonly Prompt[]
  let enabled: boolean | undefined
  let inputSettings: Partial<InputSettings> | undefined
  if (source === 'dsh-prompt-library' && isLibrary(value.data)) {
    prompts = value.data.prompts
    enabled = value.data.promptButtonEnabled
    if ('inputSettings' in value.data) inputSettings = parseInputSettings(value.data.inputSettings)
  } else if (source === 'AIChatTimeline-DSH' || source === undefined) {
    const legacy = value.data[LEGACY_PROMPTS]
    if (!Array.isArray(legacy) || !legacy.every(isPrompt)) throw new Error('Invalid prompt list')
    prompts = legacy
    const settings = value.data[LEGACY_SETTINGS]
    if (settings !== undefined) inputSettings = parseInputSettings(settings)
    if (isRecord(settings) && typeof settings.promptButtonEnabled === 'boolean') enabled = settings.promptButtonEnabled
  } else {
    throw new Error('Invalid backup')
  }
  update(previous => {
    const entries = new Map<string, Prompt>()
    if (mode === 'merge') for (const prompt of previous.prompts) entries.set(prompt.id, prompt)
    for (const prompt of prompts) entries.set(prompt.id, prompt)
    return { prompts: [...entries.values()], promptButtonEnabled: enabled ?? previous.promptButtonEnabled }
  })
  if (inputSettings !== undefined) settingsStore.set(inputSettings)
}
