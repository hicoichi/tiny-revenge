export type RevengePickKey = 'target' | 'deed' | 'verb' | 'act' | 'constraint';

export type RevengePicks = Record<RevengePickKey, string | null>;

export interface RevengeItemGroup {
    // 系統名。系統を分けない段階では空文字にする。
    label: string;
    items: readonly string[];
}

export interface RevengeStage {
    key: RevengePickKey;
    // 画面上部の穴埋め文に、未選択のあいだ表示する名前。
    label: string;
    mark: string;
    title: string;
    note?: string;
    // 穴埋め文でこの選択肢の直後に続く句読。
    tail: string;
    groups: readonly RevengeItemGroup[];
    // 別の段階の選択結果に応じて、同じ系統名の行だけを出す。
    groupFrom?: RevengePickKey;
    // 用意した選択肢に合うものがない人のために、自分で書き足せる白木を混ぜる。
    allowsCustom?: boolean;
}

export type RitualStep = 'start' | 'select' | 'decide' | 'rite' | 'verdict';

export type RitePhase =
    | 'idle'
    | 'appear'
    | 'text'
    | 'ready'
    | 'ignite'
    | 'burn'
    | 'ash';

// localStorageへ保存/復元するための状態のスナップショット。
export interface RevengeSnapshot {
    picks: RevengePicks;
}

export interface RitualSnapshot {
    step: RitualStep;
    selectIndex: number;
    ritePhase: RitePhase;
}
