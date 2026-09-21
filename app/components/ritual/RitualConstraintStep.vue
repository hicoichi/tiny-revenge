<script setup lang="ts">
defineProps<{
    constraints: readonly string[];
    selected: string | null;
}>();

const emit = defineEmits<{
    select: [value: string];
    back: [];
    next: [];
}>();
</script>

<template>
    <div class="constraint">
        <p class="constraint__mark">肆 ・ 制 約</p>
        <p class="constraint__title">その復讐に、<br />一つの縛りを課す。</p>
        <div class="constraint__list">
            <button
                v-for="label in constraints"
                :key="label"
                type="button"
                class="constraint__item"
                :class="{ 'constraint__item--selected': selected === label }"
                @click="emit('select', label)"
            >
                {{ label }}
            </button>
        </div>
        <div class="constraint__spacer" />
        <RitualStepNav :next-disabled="!selected" @back="emit('back')" @next="emit('next')" />
    </div>
</template>

<style scoped>
.constraint {
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

.constraint__mark {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.42em;
    color: var(--rr-ink-faint);
}

.constraint__title {
    margin: 38px 0 0;
    font-size: clamp(21px, 3.6vw, 25px);
    line-height: 1.7;
    font-weight: 600;
    color: var(--rr-ink-strong);
}

.constraint__list {
    margin-top: 34px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.constraint__item {
    text-align: left;
    background: rgba(255, 255, 255, 0.015);
    border: 1px solid var(--rr-border-soft);
    color: #ddd4c2;
    padding: 17px 20px;
    font-size: 16px;
    letter-spacing: 0.06em;
    cursor: pointer;
    transition: all 0.45s;
    font-family: inherit;
}

.constraint__item:hover {
    border-color: var(--rr-border-selected);
}

.constraint__item--selected {
    background: rgba(201, 162, 39, 0.08);
    border-color: var(--rr-border-selected);
}

.constraint__spacer {
    flex: 1;
}

@media (min-width: 880px) {
    .constraint {
        padding-top: 16vh;
        max-width: 680px;
    }

    .constraint__list {
        gap: 12px;
    }
}
</style>
