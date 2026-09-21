<script setup lang="ts">
import { REVENGE_QUOTES, type RevengeQuote } from '~/constants/quotes';

const emit = defineEmits<{
    start: [];
}>();

// 静的生成(SSG)のHTMLと乱数が食い違いハイドレーション不一致になるため、マウント後に選ぶ
const quote = ref<RevengeQuote | null>(null);

onMounted(() => {
    const index = Math.floor(Math.random() * REVENGE_QUOTES.length);
    quote.value = REVENGE_QUOTES[index] ?? null;
});
</script>

<template>
    <div class="start">
        <h1 class="start__title">焚恨録</h1>
        <p class="start__subtitle">恨 み を 焚 べ 、 灰 へ 還 す</p>
        <div class="start__divider" />
        <button type="button" class="start__button" @click="emit('start')">
            は じ め る
        </button>
        <figure v-if="quote" class="start__quote">
            <blockquote class="start__quote-text">{{ quote.text }}</blockquote>
            <figcaption v-if="quote.author" class="start__quote-author">── {{ quote.author }} ──</figcaption>
        </figure>
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

.start__quote {
    position: absolute;
    bottom: 48px;
    left: 0;
    right: 0;
    margin: 0;
    padding: 0 24px;
    text-align: center;
    animation: rr-fade 2s ease 0.8s both;
}

.start__quote-text {
    margin: 0;
    white-space: pre-line;
    font-size: 12px;
    line-height: 1.9;
    letter-spacing: 0.2em;
    color: var(--rr-ink-faint);
}

.start__quote-author {
    margin-top: 8px;
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
