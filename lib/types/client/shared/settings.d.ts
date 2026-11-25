import type { Context } from '@deepseek-ai/cordis';
export type SmartEnterMode = 'doubleEnter' | 'ctrlEnter' | 'shiftEnter';
export interface InputSettings {
    readonly smartEnterMode: SmartEnterMode;
    readonly smartEnterEnabled: boolean;
    readonly smartEnterToastCount: number;
    readonly preventAutoScrollEnabled: boolean;
}
export declare function parseInputSettings(value: unknown): Partial<InputSettings>;
export declare function bindInputSettings(ctx: Context, onUnsaved?: () => void): void;
export declare const settingsStore: {
    get: () => InputSettings;
    subscribe: (listener: () => void) => (() => void);
    set(patch: Partial<InputSettings>): void;
};
