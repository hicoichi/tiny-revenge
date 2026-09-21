<script setup lang="ts">
const emit = defineEmits<{
    start: [];
}>();
</script>

<template>
    <div class="start">
        <h1 class="start__title">復讐</h1>
        <p class="start__subtitle">日 常 の 小 さ な 決 着</p>
        <div class="start__divider" />
        <button type="button" class="start__button" @click="emit('start')">
            は じ め る
        </button>
        <p class="start__footnote">答 え は 示 さ れ な い</p>
    </div>
</template>

<style scoped>
.start {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    animation: rr-fade 1.4s ease both;
}

.start__title {
    margin: 0;
    writing-mode: vertical-rl;
    font-size: clamp(44px, 10vw, 62px);
    letter-spacing: 0.24em;
    font-weight: 800;
    color: var(--rr-ink-brightest);
    text-shadow: 0 0 40px rgba(201, 162, 39, 0.18);
}

.start__subtitle {
    margin: 34px 0 0;
    font-size: 12px;
    letter-spacing: 0.5em;
    color: var(--rr-ink-faint);
}

.start__divider {
    width: 1px;
    height: 78px;
    margin: 30px 0;
    background: linear-gradient(#0000, #7a6f58, #0000);
}

.start__button {
    background: none;
    border: 1px solid var(--rr-border-strong);
    color: var(--rr-ink-soft);
    padding: 16px 42px;
    font-size: 14px;
    letter-spacing: 0.34em;
    cursor: pointer;
    transition: all 0.6s;
    font-family: inherit;
}

.start__button:hover {
    border-color: var(--rr-gold);
    color: var(--rr-ink-brightest);
}

.start__footnote {
    position: absolute;
    bottom: 56px;
    margin: 0;
    font-size: 10px;
    letter-spacing: 0.3em;
    color: var(--rr-ink-dim);
}

@media (min-width: 880px) {
    .start__title {
        font-size: 80px;
    }
}
</style>
