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
    | 'detach'
    | 'fall'
    | 'ignite'
    | 'burn'
    | 'ash';
