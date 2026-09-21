import { computed, reactive, readonly } from 'vue';
import { MAX_CUSTOM_ACT_LENGTH, REVENGE_STAGES } from '~/constants/revengeStages';
import type {
    RevengeItemGroup,
    RevengePickKey,
    RevengePicks,
    RevengeSnapshot,
    RevengeStage,
} from '~/types/revenge';

// 画面遷移をまたいで保持する必要があるため、モジュールスコープでシングルトンとして状態を持つ。
const picks = reactive<RevengePicks>({
    target: null,
    deed: null,
    verb: null,
    act: null,
    constraint: null,
});

// 選択済みの数。炎の勢いなど、進み具合を表す表示に使う。
const pickedCount = computed(
    () => REVENGE_STAGES.filter((stage) => picks[stage.key] !== null).length,
);

const isComplete = computed(() => pickedCount.value === REVENGE_STAGES.length);

// 儀式で紙に記す復讐の文。すべての選択が揃ったときだけ組み立てる。
const vow = computed(() => {
    if (!isComplete.value) return '';
    return [
        `${picks.target}に、${picks.deed}。`,
        `だから、${picks.verb}。`,
        `具体的には、${picks.act}。`,
        `ただし、${picks.constraint}。`,
    ].join('\n');
});

// 選んだ手段が属する系統名。行為の絞り込みに使う。
function groupLabelOf(sourceKey: RevengePickKey): string | null {
    const chosen = picks[sourceKey];
    if (chosen === null) return null;
    const source = REVENGE_STAGES.find((stage) => stage.key === sourceKey);
    return source?.groups.find((group) => group.items.includes(chosen))?.label ?? null;
}

// その段階で選べる系統。別の段階の選択に従う段階(行為)は、該当する系統だけに絞る。
function groupsFor(stage: RevengeStage): readonly RevengeItemGroup[] {
    if (!stage.groupFrom) return stage.groups;
    const label = groupLabelOf(stage.groupFrom);
    return stage.groups.filter((group) => group.label === label);
}

function setPick(key: RevengePickKey, value: string) {
    picks[key] = value;
}

// 選び直すときは、その段階より後ろの選択も前提が変わるためまとめて取り消す。
function clearPicksFrom(index: number) {
    REVENGE_STAGES.slice(index).forEach((stage) => {
        picks[stage.key] = null;
    });
}

function resetRevenge() {
    clearPicksFrom(0);
}

// 保存用のスナップショットを作る。
function snapshot(): RevengeSnapshot {
    return { picks: { ...picks } };
}

// 保存されていたスナップショットから状態を復元する。
// 選択肢の定義が変わっても壊れないよう、現在の選択肢に含まれる値(または白木で書いた短文)だけを受け入れる。
function isValidPick(stage: RevengeStage, value: unknown): value is string {
    if (typeof value !== 'string' || value.length === 0) return false;
    if (stage.groups.some((group) => group.items.includes(value))) return true;
    return Boolean(stage.allowsCustom) && value.length <= MAX_CUSTOM_ACT_LENGTH;
}

function hydrate(data: Partial<RevengeSnapshot>) {
    REVENGE_STAGES.forEach((stage) => {
        const saved = data.picks?.[stage.key];
        picks[stage.key] = isValidPick(stage, saved) ? saved : null;
    });
}

export function useRevenge() {
    return {
        stages: REVENGE_STAGES,
        picks: readonly(picks),
        pickedCount,
        isComplete,
        vow,
        groupsFor,
        setPick,
        clearPicksFrom,
        resetRevenge,
        snapshot,
        hydrate,
    };
}
