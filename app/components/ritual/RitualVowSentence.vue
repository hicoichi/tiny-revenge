<script setup lang="ts">
import { REVENGE_STAGES } from '~/constants/revengeStages';
import type { RevengePicks } from '~/types/revenge';

defineProps<{
    picks: Readonly<RevengePicks>;
    // いま選んでいる段階。確認画面のように選択中の段階がないときはnull。
    currentIndex: number | null;
    dimmed: boolean;
}>();

const emit = defineEmits<{
    rewind: [index: number];
}>();
</script>

<template>
    <p class="sentence" :class="{ 'sentence--dimmed': dimmed }" aria-label="組み上がる復讐">
        <template v-for="(stage, index) in REVENGE_STAGES" :key="stage.key">
            <button
                type="button"
                class="sentence__blank"
                :class="{
                    'sentence__blank--filled': picks[stage.key] !== null,
                    'sentence__blank--current': picks[stage.key] === null && index === currentIndex,
                }"
                :disabled="picks[stage.key] === null"
                :aria-label="
                    picks[stage.key] !== null
                        ? `${stage.label}: ${picks[stage.key]}（選び直す）`
                        : stage.label
                "
                @click="emit('rewind', index)"
            >
                {{ picks[stage.key] ?? stage.label }}
            </button>{{ stage.tail }}
        </template>
    </p>
</template>

<style scoped>
.sentence {
    margin: 0;
    max-width: 480px;
    text-align: center;
    font-size: 15px;
    line-height: 2.5;
    letter-spacing: 0.08em;
    color: var(--rr-ink-faint);
    transition: opacity 0.8s;
}

.sentence--dimmed {
    opacity: 0.35;
}

.sentence__blank {
    display: inline-block;
    min-width: 3.4em;
    padding: 0 6px 1px;
    background: none;
    border: none;
    border-bottom: 1px dashed var(--rr-border);
    font-size: inherit;
    letter-spacing: inherit;
    color: var(--rr-ink-dim);
    cursor: default;
}

.sentence__blank--current {
    border-bottom: 1px solid var(--rr-border-selected);
    color: var(--rr-gold);
    animation: rr-blank-pulse 1.8s ease-in-out infinite;
}

.sentence__blank--filled {
    border-bottom: 1px solid var(--rr-gold);
    color: var(--rr-ink-brightest);
    cursor: pointer;
}

.sentence__blank:focus-visible {
    outline: 2px solid var(--rr-gold);
    outline-offset: 3px;
}

@keyframes rr-blank-pulse {
    0%,
    100% {
        border-bottom-color: var(--rr-border-selected);
    }
    50% {
        border-bottom-color: var(--rr-gold-bright);
    }
}

@media (min-width: 880px) {
    .sentence {
        max-width: 720px;
        font-size: 19px;
    }
}
</style>
