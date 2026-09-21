<script setup lang="ts">
const emit = defineEmits<{
    restart: [];
}>();
</script>

<template>
    <div class="verdict">
        <h2 class="verdict__title">決着</h2>
        <p class="verdict__text">この件は、<br />お前の手で終わった。</p>
        <button type="button" class="verdict__restart" @click="emit('restart')">
            は じ め か ら
        </button>
    </div>
</template>

<style scoped>
.verdict {
    position: absolute;
    inset: 0;
    background: #000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    animation: rr-fade 3s ease both;
}

.verdict__title {
    margin: 0;
    writing-mode: vertical-rl;
    font-size: 44px;
    letter-spacing: 0.3em;
    font-weight: 800;
    color: #cdc4b2;
}

.verdict__text {
    margin: 36px 0 0;
    font-size: 12px;
    letter-spacing: 0.34em;
    color: var(--rr-ink-dim);
    text-align: center;
    line-height: 2.4;
}

.verdict__restart {
    margin-top: 64px;
    background: none;
    border: none;
    color: #3c3830;
    font-size: 10px;
    letter-spacing: 0.34em;
    cursor: pointer;
    padding: 14px;
    font-family: inherit;
}

.verdict__restart:hover {
    color: var(--rr-ink-faint);
}
</style>
