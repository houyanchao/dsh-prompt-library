import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { NS } from '../locales.ts';
type T = TranslateNS<typeof NS>;
export interface ToggleProps {
    readonly checked: boolean;
    readonly ariaLabel?: string;
    readonly onChange: (checked: boolean) => void;
}
/** 开关（原 .ait-toggle-switch）。 */
export declare function Toggle({ checked, ariaLabel, onChange }: ToggleProps): import("react").JSX.Element;
interface SettingItemProps {
    readonly label: React.ReactNode;
    readonly hint: React.ReactNode;
    readonly control: React.ReactNode;
}
/** 设置行（原 .setting-item）。 */
export declare function SettingItem({ label, hint, control }: SettingItemProps): import("react").JSX.Element;
export declare function PromptTab({ t }: {
    readonly t: T;
}): import("react").JSX.Element;
export {};
