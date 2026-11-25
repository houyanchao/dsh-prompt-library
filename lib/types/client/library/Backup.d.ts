import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { NS } from '../locales.ts';
type T = TranslateNS<typeof NS>;
/** 数据同步 tab（原 DataSyncTab，仅本地文件导入导出，云同步不迁移）。 */
export declare function DataSyncTab({ t }: {
    readonly t: T;
}): import("react").JSX.Element;
export {};
