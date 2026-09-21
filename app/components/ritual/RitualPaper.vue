<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { BURN_CHAR_DELAY_MS, BURN_FRONT_MS } from '~/constants/revenge';
import { useRitual } from '~/composables/useRitual';
import { useRitualAnimation } from '~/composables/useRitualAnimation';
import type { RitePhase } from '~/types/revenge';

defineProps<{
    vow: string;
}>();

const ritual = useRitual();
const anim = useRitualAnimation();

const paperEl = ref<HTMLElement | null>(null);
const paperInnerEl = ref<HTMLElement | null>(null);
const paperCharEl = ref<HTMLElement | null>(null);
const textEl = ref<HTMLElement | null>(null);

const showText = computed(() => ritual.ritePhase.value !== 'appear');
const showAsh = computed(() => ritual.ritePhase.value === 'ash');

let warpTween: gsap.core.Tween | null = null;

function wait(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function runAppear() {
    const el = paperEl.value;
    if (!el) return;
    await anim.appearPaper(el);
    ritual.setRitePhase('text');
    await nextTick();
    if (textEl.value) {
        await anim.fadeInText(textEl.value);
    }
    await wait(400);
    ritual.setRitePhase('ready');
}

// 紙は現れた位置に留まったまま、その場で炎が燃え移って燃え尽きる。
async function runComplete() {
    const el = paperEl.value;
    const inner = paperInnerEl.value;
    const char = paperCharEl.value;
    if (!el || !inner || !char) return;

    await anim.igniteFlash(inner);

    ritual.setRitePhase('burn');
    // offsetWidth/Heightは傾きや拡縮の影響を受けない紙そのものの大きさ。
    const width = inner.offsetWidth;
    const height = inner.offsetHeight;
    const geometry = { width, height, originX: width / 2, originY: height * 0.94 };
    const maxRadius = Math.hypot(width / 2, height) * 1.05;
    warpTween = anim.warpPaper(el);
    await Promise.all([
        anim.growBurnFront(inner, geometry, maxRadius, BURN_FRONT_MS, 0, 6),
        anim.growBurnFront(char, geometry, maxRadius, BURN_FRONT_MS, BURN_CHAR_DELAY_MS, 6),
    ]);
    warpTween?.kill();
    warpTween = null;

    ritual.setRitePhase('ash');
    await anim.fadeOutPaper(el);
    ritual.finishRite();
}

function runForPhase(phase: RitePhase) {
    if (phase === 'appear') runAppear();
    if (phase === 'ignite') runComplete();
}

// マウント時点で既にphaseが'appear'になっている場合があるため、
// refがDOMに張られた後のonMountedで初回分を処理し、以降の遷移はwatchで処理する。
// 保存状態からの復元で最初から'ready'になっている場合は、
// 演出を再生せず休止状態の見た目へ即座に合わせる。
onMounted(() => {
    const phase = ritual.ritePhase.value;
    if (phase === 'ready') {
        const el = paperEl.value;
        if (el) anim.settlePaper(el);
        return;
    }
    runForPhase(phase);
});

onBeforeUnmount(() => {
    warpTween?.kill();
});

watch(() => ritual.ritePhase.value, runForPhase);
</script>

<template>
    <div ref="paperEl" class="paper">
        <div ref="paperCharEl" class="paper__char" />
        <div ref="paperInnerEl" class="paper__card">
            <p class="paper__mark">誓 ・ 復 讐</p>
            <div class="paper__rule" />
            <div v-if="showText" ref="textEl" class="paper__vow">
                {{ vow }}
            </div>
            <div class="paper__spacer" />
        </div>

        <RitualAsh v-if="showAsh" />
    </div>
</template>

<style scoped>
.paper {
    position: relative;
    opacity: 0;
    transform-style: preserve-3d;
}

.paper__char {
    position: absolute;
    inset: 0;
    background: radial-gradient(
        circle at 50% 95%,
        #ff7a2a 0%,
        #c6431a 8%,
        #6e2410 20%,
        #24120a 40%,
        #0a0705 62%,
        transparent 80%
    );
}

.paper__card {
    position: relative;
    box-sizing: border-box;
    width: 268px;
    min-height: 340px;
    padding: 32px 28px;
    background: linear-gradient(170deg, var(--rr-paper), var(--rr-paper-dark));
    box-shadow:
        0 22px 44px rgba(0, 0, 0, 0.65),
        inset 0 0 40px rgba(150, 130, 90, 0.22);
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.paper__mark {
    margin: 0;
    font-size: 9px;
    letter-spacing: 0.34em;
    color: #8c8064;
}

.paper__rule {
    height: 1px;
    background: #bdb198;
}

.paper__vow {
    font-size: 18px;
    line-height: 2;
    color: var(--rr-paper-ink);
    font-weight: 600;
    text-wrap: pretty;
    white-space: pre-line;
}

.paper__spacer {
    flex: 1;
}

@media (min-width: 880px) {
    .paper__card {
        width: 320px;
        min-height: 400px;
        padding: 40px 34px;
    }
}
</style>
