<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRitual } from '~/composables/useRitual';
import { useRitualAnimation } from '~/composables/useRitualAnimation';
import type { RitePhase } from '~/types/revenge';

defineProps<{
    vow: string;
    constraintLabel: string;
    verbLabel: string;
}>();

const ritual = useRitual();
const anim = useRitualAnimation();

const paperEl = ref<HTMLElement | null>(null);
const paperInnerEl = ref<HTMLElement | null>(null);
const textEl = ref<HTMLElement | null>(null);

const showText = computed(() => ritual.ritePhase.value !== 'appear');
const isBurning = computed(() =>
    (['ignite', 'burn', 'ash'] as RitePhase[]).includes(ritual.ritePhase.value),
);

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

async function runRaise() {
    const el = paperEl.value;
    if (!el) return;
    await anim.raisePaper(el);
    ritual.setRitePhase('raised');
}

async function runComplete() {
    const el = paperEl.value;
    const inner = paperInnerEl.value;
    if (!el || !inner) return;
    await anim.detachPaper(el);
    ritual.setRitePhase('fall');
    await anim.dropPaper(el);
    ritual.setRitePhase('ignite');
    await anim.ignitePaper(inner);
    ritual.setRitePhase('burn');
    await anim.burnPaper(inner);
    ritual.setRitePhase('ash');
    await anim.fadeOutPaper(el);
    ritual.finishRite();
}

function runForPhase(phase: RitePhase) {
    if (phase === 'appear') runAppear();
    if (phase === 'raising') runRaise();
    if (phase === 'detach') runComplete();
}

// マウント時点で既にphaseが'appear'になっている場合があるため、
// refがDOMに張られた後のonMountedで初回分を処理し、以降の遷移はwatchで処理する。
// 保存状態からの復元で最初から'ready'/'raised'になっている場合は、
// 演出を再生せず休止状態の見た目へ即座に合わせる。
onMounted(() => {
    const phase = ritual.ritePhase.value;
    if (phase === 'ready' || phase === 'raised') {
        const el = paperEl.value;
        if (el) anim.settlePaper(el, phase);
        return;
    }
    runForPhase(phase);
});

watch(() => ritual.ritePhase.value, runForPhase);
</script>

<template>
    <div ref="paperEl" class="paper">
        <div
            ref="paperInnerEl"
            class="paper__card"
            :class="{ 'paper__card--burning': isBurning }"
        >
            <p class="paper__mark">誓 ・ 復 讐</p>
            <div class="paper__rule" />
            <div v-if="showText" ref="textEl" class="paper__vow">
                {{ vow }}
            </div>
            <div class="paper__spacer" />
            <div class="paper__tags">
                <span class="paper__tag">{{ constraintLabel }}</span>
                <span class="paper__tag">{{ verbLabel }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.paper {
    opacity: 0;
    transform-style: preserve-3d;
}

.paper__card {
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

.paper__card--burning {
    -webkit-mask-image: linear-gradient(
        to top,
        rgba(0, 0, 0, 0) 0%,
        rgba(0, 0, 0, 0) 26%,
        rgba(0, 0, 0, 0.4) 33%,
        #000 42%,
        #000 100%
    );
    mask-image: linear-gradient(
        to top,
        rgba(0, 0, 0, 0) 0%,
        rgba(0, 0, 0, 0) 26%,
        rgba(0, 0, 0, 0.4) 33%,
        #000 42%,
        #000 100%
    );
    -webkit-mask-size: 100% 320%;
    mask-size: 100% 320%;
    -webkit-mask-position: 0% 0%;
    mask-position: 0% 0%;
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
}

.paper__spacer {
    flex: 1;
}

.paper__tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}

.paper__tag {
    font-size: 9px;
    letter-spacing: 0.2em;
    color: #6f6550;
    border: 1px solid #b3a88f;
    padding: 5px 8px;
}

@media (min-width: 880px) {
    .paper__card {
        width: 320px;
        min-height: 400px;
        padding: 40px 34px;
    }
}
</style>
