import { computed, readonly, ref } from 'vue';
import { REVENGE_QUESTIONS } from '~/constants/revenge';
import type { RitePhase, RitualSnapshot, RitualStep } from '~/types/revenge';

// 燃焼アニメーションの途中経過はアニメーション専用の状態であり、そのまま復元できない。
// 保存データから復元する際は、直前に完了していた「休止状態」まで巻き戻す。
const RESUMABLE_RITE_PHASE: Record<RitePhase, RitePhase> = {
    idle: 'idle',
    appear: 'ready',
    text: 'ready',
    ready: 'ready',
    raising: 'ready',
    raised: 'raised',
    ignite: 'raised',
    burn: 'raised',
    ash: 'raised',
};

// 儀式全体の進行状態。画面をまたいで保持する必要があるためモジュールスコープで共有する。
const step = ref<RitualStep>('start');
const questionIndex = ref(0);
const ritePhase = ref<RitePhase>('idle');
const isBlackout = ref(false);

// questionIndexは常に0〜REVENGE_QUESTIONS.length-1の範囲に保たれるため、非nullを保証してよい。
const currentQuestion = computed(() => REVENGE_QUESTIONS[questionIndex.value]!);
const isFirstQuestion = computed(() => questionIndex.value === 0);
const isLastQuestion = computed(
    () => questionIndex.value === REVENGE_QUESTIONS.length - 1,
);

function next() {
    if (step.value === 'start') {
        step.value = 'question';
        questionIndex.value = 0;
        return;
    }
    if (step.value === 'question') {
        if (!isLastQuestion.value) {
            questionIndex.value += 1;
        } else {
            step.value = 'constraint';
        }
        return;
    }
    if (step.value === 'constraint') {
        step.value = 'verb';
        return;
    }
    if (step.value === 'verb') {
        step.value = 'compose';
    }
}

function back() {
    if (step.value === 'question') {
        if (!isFirstQuestion.value) {
            questionIndex.value -= 1;
        } else {
            step.value = 'start';
        }
        return;
    }
    if (step.value === 'constraint') {
        step.value = 'question';
        questionIndex.value = REVENGE_QUESTIONS.length - 1;
        return;
    }
    if (step.value === 'verb') {
        step.value = 'constraint';
        return;
    }
    if (step.value === 'compose') {
        step.value = 'verb';
    }
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
    questionIndex.value = 0;
    ritePhase.value = 'idle';
    isBlackout.value = false;
}

// 保存用のスナップショットを作る。
function snapshot(): RitualSnapshot {
    return {
        step: step.value,
        questionIndex: questionIndex.value,
        ritePhase: ritePhase.value,
    };
}

// 保存されていたスナップショットから状態を復元する。
function hydrate(data: Partial<RitualSnapshot>) {
    step.value = data.step ?? 'start';
    questionIndex.value = data.questionIndex ?? 0;
    ritePhase.value =
        step.value === 'rite'
            ? RESUMABLE_RITE_PHASE[data.ritePhase ?? 'ready']
            : 'idle';
    isBlackout.value = false;
}

export function useRitual() {
    return {
        step: readonly(step),
        questionIndex: readonly(questionIndex),
        currentQuestion,
        isFirstQuestion,
        isLastQuestion,
        ritePhase: readonly(ritePhase),
        isBlackout: readonly(isBlackout),
        next,
        back,
        enterRite,
        setRitePhase,
        finishRite,
        reset,
        snapshot,
        hydrate,
    };
}
