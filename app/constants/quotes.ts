export interface RevengeQuote {
    text: string;
    // 特定の人物の言葉のみ設定する。ことわざ・故事成語・聖書などは人名を当てず未設定にする(誤った帰属を出さないため)
    author?: string;
}

export const REVENGE_QUOTES: readonly RevengeQuote[] = [
    { text: '復讐は、野蛮な正義である。', author: 'フランシス・ベーコン' },
    {
        text: '我らを傷つければ、血が流れぬと思うか。\n我らを虐げれば、復讐せぬと思うか。',
        author: 'シェイクスピア',
    },
    { text: '復讐は、甘美である。', author: 'バイロン' },
    { text: '目には目を、歯には歯を。' },
    { text: '君子の仇討ちは、十年経っても遅くない。' },
    { text: '復讐は、冷めてから食すのが最も美味い。' },
];
