<script setup lang="ts">
import type { RevengeQuestion } from '~/types/revenge';

defineProps<{
    question: RevengeQuestion;
    answer: string;
}>();

const emit = defineEmits<{
    'update:answer': [value: string];
    back: [];
    next: [];
}>();
</script>

<template>
    <div class="question">
        <p class="question__mark">{{ question.mark }} ・ 問 い</p>
        <p class="question__text">{{ question.text }}</p>
        <textarea
            class="question__input"
            :value="answer"
            placeholder="…"
            @change="emit('update:answer', ($event.target as HTMLTextAreaElement).value)"
        />
        <RitualStepNav @back="emit('back')" @next="emit('next')" />
    </div>
</template>

<style scoped>
.question {
    position: absolute;
    inset: 0;
    padding: 14vh 34px 6vh;
    display: flex;
    flex-direction: column;
    max-width: 600px;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
    animation: rr-in 1s ease both;
}

.question__mark {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.42em;
    color: var(--rr-ink-faint);
}

.question__text {
    margin: 44px 0 0;
    font-size: clamp(22px, 4vw, 27px);
    line-height: 1.7;
    font-weight: 600;
    color: var(--rr-ink-strong);
    text-wrap: pretty;
}

.question__input {
    margin-top: 34px;
    flex: 1;
    min-height: 120px;
    background: none;
    border: none;
    border-bottom: 1px solid var(--rr-border-soft);
    color: var(--rr-ink);
    font-size: 17px;
    line-height: 2;
    resize: none;
    padding: 0 0 12px;
}

.question > :deep(.nav) {
    margin-top: 28px;
}

@media (min-width: 880px) {
    .question {
        padding-top: 16vh;
        max-width: 680px;
    }
}
</style>
