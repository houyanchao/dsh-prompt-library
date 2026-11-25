import type { Context } from '@deepseek-ai/cordis';
import { zh } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        dshPromptLibrary: keyof typeof zh;
    }
}
export declare const inject: string[];
export declare function apply(ctx: Context): void;
