import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { NS } from '../locales.ts';
export declare function SettingsEntry({ t }: PropsLocale<typeof NS>): import("react").JSX.Element;
export declare function PanelHost({ t, useSessions }: PropsRuntime<'shell.overlay'> & PropsLocale<typeof NS>): import("react").ReactPortal;
