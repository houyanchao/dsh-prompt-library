interface ToastColor {
    readonly backgroundColor: string;
    readonly textColor: string;
    readonly borderColor: string;
}
interface ToastPalette {
    readonly light: ToastColor;
    readonly dark: ToastColor;
}
export declare const toast: {
    success: (message: string, color?: ToastPalette) => void;
    error: (message: string, color?: ToastPalette) => void;
    warning: (message: string) => void;
    forceHideAll(): void;
};
export declare function ToastHost({ dark }: {
    readonly dark: boolean;
}): import("react").ReactPortal | null;
export {};
