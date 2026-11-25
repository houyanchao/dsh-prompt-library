import type { Context } from '@deepseek-ai/cordis';
export interface Prompt {
    readonly id: string;
    readonly name: string;
    readonly content: string;
    readonly pinned?: boolean;
}
interface Library {
    readonly prompts: readonly Prompt[];
    readonly promptButtonEnabled: boolean;
}
export declare function bindStorage(ctx: Context, onUnsaved?: () => void): void;
export declare const promptsStore: {
    get: () => Library;
    subscribe: (listener: () => void) => (() => void);
    setButtonEnabled(promptButtonEnabled: boolean): void;
    add(name: string, content: string): void;
    update(id: string, fields: Pick<Prompt, "name" | "content">): void;
    remove(id: string): void;
    togglePin(id: string): void;
    move(id: string, direction: "up" | "down"): void;
};
export declare function sortPrompts(prompts: readonly Prompt[]): readonly Prompt[];
export declare function exportBackup(): void;
export declare function restoreBackup(value: unknown, mode: 'merge' | 'overwrite'): void;
export {};
