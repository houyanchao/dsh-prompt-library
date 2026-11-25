interface SessionRow {
    readonly id: string;
    readonly retainedBy?: {
        readonly mainView?: number;
    };
}
interface SessionsSnapshot {
    readonly current?: string | undefined;
    readonly byId: Readonly<Record<string, SessionRow | undefined>>;
}
/** 新版 DSH 通过主视图的持有计数标识当前会话，旧版直接提供 current。 */
export declare function selectCurrentSessionId(sessions: SessionsSnapshot): string | undefined;
export {};
