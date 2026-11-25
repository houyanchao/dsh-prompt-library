import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { NS } from '../locales.ts';
type PromptButtonProps = PropsRuntime<'conversation.input.left'> & PropsLocale<typeof NS>;
export declare function PromptButton({ useInput, useSession, inputActions, t }: PromptButtonProps): import("react").JSX.Element | null;
export {};
