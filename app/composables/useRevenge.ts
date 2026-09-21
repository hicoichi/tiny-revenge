import { computed, reactive, readonly, ref } from 'vue';
import {
    MAX_VOW_LENGTH,
    MIN_VOW_LENGTH,
    REVENGE_CONSTRAINTS,
    REVENGE_QUESTIONS,
    REVENGE_VERBS,
} from '~/constants/revenge';
import type { RevengeAnswerKey, RevengeSnapshot } from '~/types/revenge';

// 画面遷移をまたいで保持する必要があるため、モジュールスコープでシングルトンとして状態を持つ。
const answers = reactive({ harm: '', anger: '', want: '' });
const constraint = ref<string | null>(null);
const verb = ref<string | null>(null);
const vow = ref('');

function setAnswer(key: RevengeAnswerKey, value: string) {
    answers[key] = value;
}

function setConstraint(value: string) {
    constraint.value = value;
}

function setVerb(value: string) {
    verb.value = value;
}

function setVow(value: string) {
    vow.value = value.slice(0, MAX_VOW_LENGTH);
}

function resetRevenge() {
    answers.harm = '';
    answers.anger = '';
    answers.want = '';
    constraint.value = null;
    verb.value = null;
    vow.value = '';
}

const isVowValid = computed(() => vow.value.trim().length >= MIN_VOW_LENGTH);

// 保存用のスナップショットを作る。
function snapshot(): RevengeSnapshot {
    return {
        answers: { harm: answers.harm, anger: answers.anger, want: answers.want },
        constraint: constraint.value,
        verb: verb.value,
        vow: vow.value,
    };
}

// 保存されていたスナップショットから状態を復元する。
function hydrate(data: Partial<RevengeSnapshot>) {
    answers.harm = data.answers?.harm ?? '';
    answers.anger = data.answers?.anger ?? '';
    answers.want = data.answers?.want ?? '';
    constraint.value = data.constraint ?? null;
    verb.value = data.verb ?? null;
    vow.value = typeof data.vow === 'string' ? data.vow.slice(0, MAX_VOW_LENGTH) : '';
}

export function useRevenge() {
    return {
        questions: REVENGE_QUESTIONS,
        constraints: REVENGE_CONSTRAINTS,
        verbs: REVENGE_VERBS,
        answers: readonly(answers),
        constraint: readonly(constraint),
        verb: readonly(verb),
        vow: readonly(vow),
        isVowValid,
        setAnswer,
        setConstraint,
        setVerb,
        setVow,
        resetRevenge,
        snapshot,
        hydrate,
    };
}
