interface TooltipColor {
    readonly backgroundColor: string;
    readonly textColor: string;
    readonly borderColor: string;
}
interface TooltipOptions {
    readonly placement?: 'top' | 'bottom' | 'right';
    readonly maxWidth?: number;
    readonly showDelay?: number;
    readonly gap?: number;
    readonly noArrow?: boolean;
    readonly size?: 'small';
    readonly color?: TooltipColor;
}
export declare const tooltip: {
    show(id: string, target: HTMLElement, content: string, options?: TooltipOptions): void;
    hide(immediate?: boolean): void;
};
export declare function TooltipHost({ dark }: {
    readonly dark: boolean;
}): import("react").JSX.Element | null;
export {};
