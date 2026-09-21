<script setup lang="ts">
import { computed } from 'vue';
import { HOLD_DECIDE_MS } from '~/constants/revenge';

const props = defineProps<{
    constraintLabel: string;
    verbLabel: string;
    vow: string;
    isVowValid: boolean;
}>();

const emit = defineEmits<{
    'update:vow': [value: string];
    back: [];
    decide: [];
}>();

const hint = computed(() =>
    props.isVowValid ? '長 押 し で 決 定 す る' : '',
);
</script>

<template>
    <div class="compose">
        <p class="compose__mark">陸 ・ 決 定</p>
        <div class="compose__tags">
            <span class="compose__tag">{{ constraintLabel }}</span>
            <span class="compose__tag compose__tag--verb">{{ verbLabel }}</span>
        </div>
        <p class="compose__title">お前の復讐を、<br />お前の言葉で記せ。</p>
        <textarea
            class="compose__input"
            :value="vow"
            placeholder="例：次に押しつけられたら、断る。"
            @input="emit('update:vow', ($event.target as HTMLTextAreaElement).value)"
        />
        <div class="compose__actions">
            <RitualHoldButton
                label="復 讐 を 決 め る"
                :hold-ms="HOLD_DECIDE_MS"
                :disabled="!isVowValid"
                :hint="hint"
                @complete="emit('decide')"
            />
            <button type="button" class="compose__back" @click="emit('back')">
                も ど る
            </button>
        </div>
    </div>
</template>

<style scoped>
.compose {
    position: absolute;
    inset: 0;
    padding: 12vh 34px 5vh;
    display: flex;
    flex-direction: column;
    max-width: 600px;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
    animation: rr-in 1s ease both;
}

.compose__mark {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.42em;
    color: var(--rr-ink-faint);
}

.compose__tags {
    margin-top: 26px;
    display: flex;
    gap: 8px;
    align-items: center;
}

.compose__tag {
    font-size: 11px;
    letter-spacing: 0.2em;
    color: #8e8471;
    border: 1px solid var(--rr-border-soft);
    padding: 7px 11px;
}

.compose__tag--verb {
    color: var(--rr-gold);
    border-color: #4d4128;
}

.compose__title {
    margin: 26px 0 0;
    font-size: clamp(20px, 3.4vw, 22px);
    line-height: 1.7;
    font-weight: 600;
    color: var(--rr-ink-strong);
}

.compose__input {
    margin-top: 22px;
    flex: 1;
    min-height: 140px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--rr-border-soft);
    color: var(--rr-ink-strong);
    font-size: 18px;
    line-height: 2;
    resize: none;
    padding: 18px;
}

.compose__actions {
    margin-top: 22px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
}

.compose__back {
    background: none;
    border: none;
    color: var(--rr-ink-muted);
    font-size: 11px;
    letter-spacing: 0.3em;
    cursor: pointer;
    padding: 6px 0;
    font-family: inherit;
}

@media (min-width: 880px) {
    .compose {
        padding-top: 14vh;
        max-width: 680px;
    }
}
</style>
