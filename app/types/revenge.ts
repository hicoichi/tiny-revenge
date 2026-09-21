export interface RevengeAnswers {
    harm: string;
    anger: string;
    want: string;
}

export type RevengeAnswerKey = keyof RevengeAnswers;

export interface RevengeQuestion {
    key: RevengeAnswerKey;
    mark: string;
    text: string;
}

export type RitualStep =
    | 'start'
    | 'question'
    | 'constraint'
    | 'verb'
    | 'compose'
    | 'rite'
    | 'verdict';

export type RitePhase =
    | 'idle'
    | 'appear'
    | 'text'
    | 'ready'
    | 'raising'
    | 'raised'
    | 'ignite'
    | 'burn'
    | 'ash';

// localStorageへ保存/復元するための状態のスナップショット。
export interface RevengeSnapshot {
    answers: RevengeAnswers;
    constraint: string | null;
    verb: string | null;
    vow: string;
}

export interface RitualSnapshot {
    step: RitualStep;
    questionIndex: number;
    ritePhase: RitePhase;
}
