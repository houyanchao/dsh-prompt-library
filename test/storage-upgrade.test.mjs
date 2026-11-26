import assert from 'node:assert/strict'
import { test } from 'node:test'

const key = 'dsh.prompt-library.v1'
const timelineKey = 'dsh.timeline.prompts'
const prompt = name => ({ id: name, name, content: name })
const names = prompts => prompts.map(item => item.name)
let instance = 0

async function openTab(t, initial, blocked = false) {
  const disk = new Map(Object.entries(initial))
  const storage = {
    blocked,
    writes: 0,
    getItem(key) { return disk.has(key) ? JSON.stringify(disk.get(key)) : null },
    setItem(key, value) {
      this.writes++
      if (this.blocked) throw new Error('Storage is full')
      disk.set(key, JSON.parse(value))
    },
  }
  const window = new EventTarget()
  let dispose
  t.after(() => dispose?.())
  for (const [name, value] of Object.entries({ localStorage: storage, window })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name)
    Object.defineProperty(globalThis, name, { configurable: true, value })
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous)
      else delete globalThis[name]
    })
  }
  const library = await import(`../src/client/library/storage.ts?tab=${++instance}`)
  const warnings = []
  library.bindStorage({ effect: fn => { dispose = fn() } }, () => warnings.push('unsaved'))
  function refresh() {
    const event = Object.assign(new Event('storage'), { key, storageArea: storage })
    window.dispatchEvent(event)
  }
  return { disk, storage, store: library.promptsStore, refresh, warnings }
}

// The previous client keeps its last valid snapshot when the v1 flag is missing.
function oldTab(disk) {
  let snapshot = { prompts: [], promptButtonEnabled: true }
  function read() {
    const record = disk.get(key)
    if (record && Array.isArray(record.prompts) && typeof record.promptButtonEnabled === 'boolean') {
      snapshot = record
    }
    return snapshot
  }
  return {
    read,
    add(name) {
      const previous = read()
      snapshot = { ...previous, prompts: [...previous.prompts, prompt(name)] }
      disk.set(key, snapshot)
    },
  }
}

test('old and upgraded tabs keep edits across a v1 upgrade', async t => {
  const record = { prompts: [prompt('original')], promptButtonEnabled: false }
  const { disk, storage, store, refresh } = await openTab(t, { [key]: record })
  const old = oldTab(disk)
  assert.equal(storage.writes, 0)
  assert.equal(old.read().promptButtonEnabled, false)
  assert.deepEqual(store.get(), { prompts: record.prompts })

  store.add('new tab', 'content')
  assert.equal(old.read().promptButtonEnabled, false)
  assert.deepEqual(names(old.read().prompts), ['original', 'new tab'])

  old.add('old tab')
  refresh()
  assert.deepEqual(names(store.get().prompts), ['original', 'new tab', 'old tab'])
  assert.equal(storage.writes, 1)
  old.add('before storage event')
  store.add('new tab again', 'content')
  assert.deepEqual(names(old.read().prompts), ['original', 'new tab', 'old tab', 'before storage event', 'new tab again'])
})

test('a read-only upgraded tab follows other tabs without rewriting existing records', async t => {
  const record = { prompts: [prompt('initial')], promptButtonEnabled: false }
  const { disk, storage, store, refresh, warnings } = await openTab(t, { [key]: record }, true)
  oldTab(disk).add('other tab')
  refresh()
  assert.deepEqual(names(store.get().prompts), ['initial', 'other tab'])
  assert.equal(storage.writes, 0)
  assert.equal(warnings.length, 0)

  storage.blocked = false
  store.add('local edit', 'content')
  assert.deepEqual(names(disk.get(key).prompts), ['initial', 'other tab', 'local edit'])
  assert.equal(disk.get(key).promptButtonEnabled, false)
})

test('a failed initial migration still observes the next successful write from another tab', async t => {
  const { disk, storage, store, refresh, warnings } = await openTab(t, { [timelineKey]: [prompt('migrated')] }, true)
  assert.equal(warnings.length, 1)
  assert.deepEqual(names(store.get().prompts), ['migrated'])
  disk.set(key, { prompts: [prompt('remote')] })
  refresh()
  assert.deepEqual(names(store.get().prompts), ['remote'])
  storage.blocked = false
  store.add('local edit', 'content')
  assert.equal(disk.get(key).promptButtonEnabled, true)
  assert.deepEqual(names(oldTab(disk).read().prompts), ['remote', 'local edit'])
})
