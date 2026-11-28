import type { Context } from '@deepseek-ai/cordis'
import { Bus } from '../ui/bus.ts'

export interface Prompt {
  readonly id: string
  readonly name: string
  readonly content: string
  readonly pinned?: boolean
}

interface Library {
  readonly prompts: readonly Prompt[]
}

const KEY = 'dsh.prompt-library.v1'
const LEGACY_PROMPTS = 'dsh.timeline.prompts'
const EMPTY: Library = { prompts: [] }
const bus = new Bus<Library>(EMPTY)
let unsaved = false
let reportUnsaved: () => void = () => {}

// The v1 reader rejects the entire prompt list without this boolean.
let diskButtonEnabled = true
function writeLibrary(value: Library): void {
  localStorage.setItem(KEY, JSON.stringify({ prompts: value.prompts, promptButtonEnabled: diskButtonEnabled }))
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
}

function readJson(key: string): unknown {
  const raw = localStorage.getItem(key)
  return raw === null ? undefined : JSON.parse(raw)
}

function load(initialize = false): Library {
  if (unsaved) return bus.get()
  const value = readJson(KEY)
  if (value !== undefined) {
    if (!isLibrary(value)) return bus.get()
    diskButtonEnabled = !('promptButtonEnabled' in value) || value.promptButtonEnabled !== false
    return { prompts: value.prompts }
  }
  let prompts: readonly Prompt[] = []
  try {
    const oldPrompts = readJson(LEGACY_PROMPTS)
    if (Array.isArray(oldPrompts)) prompts = oldPrompts.filter(isPrompt)
  } catch { /* A malformed legacy list starts as an empty library. */ }
  diskButtonEnabled = true
  const migrated = { prompts }
  if (initialize) {
    // A failed initial copy has no local edits to protect from other tabs.
    try { writeLibrary(migrated) } catch { reportUnsaved() }
  }
  return migrated
}

function reload(initialize = false): void {
  try { bus.set(load(initialize)) } catch { /* Keep the last usable snapshot. */ }
}

export function bindStorage(ctx: Context, onUnsaved: () => void = () => {}): void {
  ctx.effect(() => {
    reportUnsaved = onUnsaved
    reload(true)
    const refresh = (event: StorageEvent): void => {
      if (event.storageArea === localStorage && (event.key === null || event.key === KEY)) reload()
    }
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      reportUnsaved = () => {}
    }
  }, 'dsh-prompt-box: storage')
}

function changeList(transform: (previous: readonly Prompt[]) => readonly Prompt[]): void {
  let current = bus.get()
  try { current = load() } catch { /* Storage may be unavailable. */ }
  const next = { prompts: transform(current.prompts) }
  try {
    writeLibrary(next)
    unsaved = false
  } catch {
    if (!unsaved) reportUnsaved()
    unsaved = true
  }
  bus.set(next)
}

export const promptsStore = {
  get: (): Library => bus.get(),
  subscribe: bus.subscribe,
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
  const backup = { _meta: { source: 'dsh-prompt-box', version: 2 }, data: { prompts: bus.get().prompts } }
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `dsh-prompt-box-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function restoreBackup(value: unknown, mode: 'merge' | 'overwrite'): void {
  if (!isRecord(value) || !isRecord(value.data)) throw new Error('Invalid backup')
  const source = isRecord(value._meta) ? value._meta.source : undefined
  let prompts: readonly Prompt[]
  if ((source === 'dsh-prompt-box' || source === 'dsh-prompt-library') && isLibrary(value.data)) {
    prompts = value.data.prompts
  } else if (source === 'AIChatTimeline-DSH' || source === undefined) {
    const legacy = value.data[LEGACY_PROMPTS]
    if (!Array.isArray(legacy) || !legacy.every(isPrompt)) throw new Error('Invalid prompt list')
    prompts = legacy
  } else {
    throw new Error('Invalid backup')
  }
  changeList(previous => {
    const entries = new Map<string, Prompt>()
    if (mode === 'merge') for (const prompt of previous) entries.set(prompt.id, prompt)
    for (const prompt of prompts) entries.set(prompt.id, prompt)
    return [...entries.values()]
  })
}
