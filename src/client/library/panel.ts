import { Bus } from '../ui/bus.ts'

export const libraryPanel = new Bus<'prompts' | 'backup' | 'input' | null>(null)
