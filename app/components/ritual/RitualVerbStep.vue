<script setup lang="ts">
defineProps<{
    verbs: readonly string[];
    selected: string | null;
}>();

const emit = defineEmits<{
    select: [value: string];
    back: [];
    next: [];
}>();
</script>

<template>
    <div class="verb">
        <p class="verb__mark">伍 ・ 言 葉</p>
        <p class="verb__title">
            一つの言葉を選べ。<br />
            <span class="verb__note">意味は、自分で決める。</span>
        </p>
        <div class="verb__grid">
            <button
                v-for="label in verbs"
                :key="label"
                type="button"
                class="verb__item"
                :class="{ 'verb__item--selected': selected === label }"
                @click="emit('select', label)"
            >
                {{ label }}
            </button>
        </div>
        <div class="verb__spacer" />
        <RitualStepNav :next-disabled="!selected" @back="emit('back')" @next="emit('next')" />
    </div>
</template>

<style scoped>
.verb {
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

.verb__mark {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.42em;
    color: var(--rr-ink-faint);
}

.verb__title {
    margin: 38px 0 0;
    font-size: clamp(21px, 3.6vw, 25px);
    line-height: 1.7;
    font-weight: 600;
    color: var(--rr-ink-strong);
}

.verb__note {
    font-size: 15px;
    font-weight: 400;
    color: var(--rr-ink-faint);
    line-height: 2;
}

.verb__grid {
    margin-top: 30px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
}

.verb__item {
    background: rgba(255, 255, 255, 0.015);
    border: 1px solid var(--rr-border-soft);
    color: #e2d9c6;
    padding: 20px 0;
    font-size: 20px;
    letter-spacing: 0.2em;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.45s;
    font-family: inherit;
}

.verb__item:hover {
    border-color: var(--rr-border-selected);
}

.verb__item--selected {
    background: rgba(201, 162, 39, 0.08);
    border-color: var(--rr-border-selected);
}

.verb__spacer {
    flex: 1;
}

@media (min-width: 880px) {
    .verb {
        padding-top: 16vh;
        max-width: 680px;
    }

    .verb__grid {
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
    }
}
</style>
