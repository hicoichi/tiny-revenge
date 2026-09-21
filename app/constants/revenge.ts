import type { RevengeQuestion } from '~/types/revenge';

export const REVENGE_QUESTIONS: RevengeQuestion[] = [
    { key: 'harm', mark: '壱', text: '何をされた？' },
    { key: 'anger', mark: '弐', text: '何が一番腹立たしかった？' },
    { key: 'want', mark: '参', text: '本当はどうしてほしかった？' },
];

export const REVENGE_CONSTRAINTS = [
    '今日中に実行する',
    'お金を使わない',
    '言葉を使わない',
    '十分以内で実行する',
    '相手に直接連絡しない',
] as const;

export const REVENGE_VERBS = [
    '返す',
    '拒む',
    '奪う',
    '離れる',
    '待たせる',
    '超える',
    '無視する',
    '取り戻す',
] as const;

export const MAX_VOW_LENGTH = 200;
export const MIN_VOW_LENGTH = 2;

export const HOLD_DECIDE_MS = 2200;
export const HOLD_RAISE_MS = 1800;
export const HOLD_COMPLETE_MS = 2600;

export const REVENGE_STORAGE_KEY = 'tiny-revenge:state:v1';
