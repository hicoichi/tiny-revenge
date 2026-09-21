<script setup lang="ts">
withDefaults(
    defineProps<{
        nextDisabled?: boolean;
        nextLabel?: string;
    }>(),
    {
        nextDisabled: false,
        nextLabel: 'つ ぎ へ',
    },
);

const emit = defineEmits<{
    back: [];
    next: [];
}>();
</script>

<template>
    <div class="nav">
        <button type="button" class="nav__back" @click="emit('back')">
            も ど る
        </button>
        <button
            type="button"
            class="nav__next"
            :disabled="nextDisabled"
            @click="emit('next')"
        >
            {{ nextLabel }}
        </button>
    </div>
</template>

<style scoped>
.nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.nav__back {
    background: none;
    border: none;
    color: var(--rr-ink-muted);
    font-size: 12px;
    letter-spacing: 0.3em;
    cursor: pointer;
    padding: 12px 0;
    font-family: inherit;
}

.nav__next {
    background: none;
    border: 1px solid var(--rr-border-strong);
    color: var(--rr-ink-soft);
    padding: 14px 34px;
    font-size: 13px;
    letter-spacing: 0.3em;
    cursor: pointer;
    transition: all 0.5s;
    font-family: inherit;
}

.nav__next:not(:disabled):hover {
    border-color: var(--rr-gold);
    color: var(--rr-ink-brightest);
}

.nav__next:disabled {
    color: var(--rr-ink-dim);
    cursor: default;
}
</style>
