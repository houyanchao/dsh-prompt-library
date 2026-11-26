interface PopconfirmOptions {
    readonly title: string;
    readonly confirmText: string;
    readonly cancelText: string;
}
export declare const popconfirm: {
    show(options: PopconfirmOptions): Promise<boolean>;
    cancel(): void;
};
export declare function PopconfirmHost(): import("react").JSX.Element | null;
export {};
