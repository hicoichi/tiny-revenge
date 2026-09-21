import { readonly, ref } from 'vue';
import { REVENGE_STAGES } from '~/constants/revengeStages';
import type { RitePhase, RitualSnapshot, RitualStep } from '~/types/revenge';

// 燃焼アニメーションの途中経過はアニメーション専用の状態であり、そのまま復元できない。
// 保存データから復元する際は、直前に完了していた「休止状態」まで巻き戻す。
const RESUMABLE_RITE_PHASE: Record<RitePhase, RitePhase> = {
    idle: 'idle',
    appear: 'ready',
    text: 'ready',
    ready: 'ready',
    ignite: 'ready',
    burn: 'ready',
    ash: 'ready',
};

// 儀式全体の進行状態。画面をまたいで保持する必要があるためモジュールスコープで共有する。
const step = ref<RitualStep>('start');
const selectIndex = ref(0);
const ritePhase = ref<RitePhase>('idle');
const isBlackout = ref(false);

function next() {
    if (step.value === 'start') {
        step.value = 'select';
        selectIndex.value = 0;
        return;
    }
    if (step.value === 'select') {
        if (selectIndex.value < REVENGE_STAGES.length - 1) {
            selectIndex.value += 1;
        } else {
            step.value = 'decide';
        }
    }
}

// 選び直すために、指定した段階の選択画面へ戻る。
function rewindTo(index: number) {
    step.value = 'select';
    selectIndex.value = index;
}

// 誓いを記し、儀式（紙が現れる演出）へ入る。
function enterRite() {
    step.value = 'rite';
    ritePhase.value = 'appear';
}

function setRitePhase(phase: RitePhase) {
    ritePhase.value = phase;
}

// 紙が燃え尽きた後、暗転を経て決着画面へ進む。時間差はモックの演出タイミングに準拠。
function finishRite() {
    isBlackout.value = true;
    setTimeout(() => {
        step.value = 'verdict';
    }, 2200);
}

function reset() {
    step.value = 'start';
    selectIndex.value = 0;
    ritePhase.value = 'idle';
    isBlackout.value = false;
}

// 保存用のスナップショットを作る。
function snapshot(): RitualSnapshot {
    return {
        step: step.value,
        selectIndex: selectIndex.value,
        ritePhase: ritePhase.value,
    };
}

// 保存されていたスナップショットから状態を復元する。
function hydrate(data: Partial<RitualSnapshot>) {
    step.value = data.step ?? 'start';
    const savedIndex = data.selectIndex ?? 0;
    selectIndex.value =
        Number.isInteger(savedIndex) &&
        savedIndex >= 0 &&
        savedIndex < REVENGE_STAGES.length
            ? savedIndex
            : 0;
    ritePhase.value =
        step.value === 'rite'
            ? RESUMABLE_RITE_PHASE[data.ritePhase ?? 'ready']
            : 'idle';
    isBlackout.value = false;
}

export function useRitual() {
    return {
        step: readonly(step),
        selectIndex: readonly(selectIndex),
        ritePhase: readonly(ritePhase),
        isBlackout: readonly(isBlackout),
        next,
        rewindTo,
        enterRite,
        setRitePhase,
        finishRite,
        reset,
        snapshot,
        hydrate,
    };
}
