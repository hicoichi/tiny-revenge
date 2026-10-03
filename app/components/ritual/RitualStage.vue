<script setup lang="ts">
import { computed, ref } from 'vue';
import { HOLD_COMPLETE_MS } from '~/constants/revenge';
import { useFireLight } from '~/composables/useFireLight';
import { useRevenge } from '~/composables/useRevenge';
import { useRitual } from '~/composables/useRitual';
import type { FlameAnchor } from '~/composables/useFlameRenderer';
import type { RitePhase } from '~/types/revenge';

const revenge = useRevenge();
const ritual = useRitual();

const stageEl = ref<HTMLElement | null>(null);
const flameRef = ref<{ getAnchor: () => FlameAnchor | null } | null>(null);
const backdropSrc = `${useRuntimeConfig().app.baseURL.replace(/\/?$/, '/')}images/petternC.jpg`;

// 炎は儀式に入った時点から灯っており、紙が燃え始めると勢いを増す。
const flaring = computed(() =>
    (['ignite', 'burn', 'ash'] as RitePhase[]).includes(ritual.ritePhase.value),
);
const flamePower = computed(() => (flaring.value ? 1 : 0));
const showComplete = computed(() => ritual.ritePhase.value === 'ready');

const hint = computed(() => {
    if (ritual.ritePhase.value === 'ready') {
        return 'この復讐を実行せよ。\n終えたら完遂を押せ。';
    }
    return '';
});

// 紙や足元のDOMも、炎と同じ揺らぎで照らす。
useFireLight(stageEl, () => flamePower.value);

function getFlameAnchor(): FlameAnchor | null {
    return flameRef.value?.getAnchor() ?? null;
}

function complete() {
    ritual.setRitePhase('ignite');
}
</script>

<template>
    <div ref="stageEl" class="stage">
        <div class="stage__bg" />
        <RitualHeatBackdrop :src="backdropSrc" :power="flamePower" :get-flame-anchor="getFlameAnchor" />
        <div class="stage__scrim" />

        <RitualFlame ref="flameRef" :power="flamePower" />

        <div class="stage__paper-wrap">
            <RitualPaper
                :vow="revenge.vow.value"
            />
        </div>

        <div class="stage__footer">
            <p class="stage__hint">{{ hint }}</p>
            <RitualHoldButton
                v-if="showComplete"
                label="完 遂"
                variant="primary"
                :hold-ms="HOLD_COMPLETE_MS"
                @complete="complete"
            />
        </div>

        <div class="stage__blackout" :class="{ 'stage__blackout--on': ritual.isBlackout.value }" />
    </div>
</template>

<style scoped>
.stage {
    position: absolute;
    inset: 0;
    max-width: 660px;
    margin: 0 auto;
    overflow: hidden;
    --rr-flame-bottom: 18vh;
}

.stage__bg {
    position: absolute;
    inset: 0;
    background: url('/images/petternC.jpg') center / cover no-repeat;
}

/* 足元のヒント文字・ボタンが写真の上でも読めるよう、下部だけ軽く沈める。 */
.stage__scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(
        180deg,
        rgba(5, 4, 3, 0) 55%,
        rgba(5, 4, 3, 0.55) 82%,
        rgba(5, 4, 3, 0.8) 100%
    );
}

.stage__paper-wrap {
    position: absolute;
    left: 0;
    right: 0;
    top: 10vh;
    display: flex;
    justify-content: center;
    perspective: 900px;
}

.stage__footer {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 0 34px 5vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
}

.stage__hint {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: 0.22em;
    color: var(--rr-ink-brightest);
    /* 背景写真の明るい部分に重なっても読めるよう、暗い縁取りの影を付ける。 */
    text-shadow: 0 0 14px rgba(0, 0, 0, 0.9), 0 1px 3px rgba(0, 0, 0, 0.9);
    text-align: center;
    min-height: 34px;
    white-space: pre-line;
    line-height: 2;
}

.stage__blackout {
    position: absolute;
    inset: 0;
    background: #000;
    pointer-events: none;
    opacity: 0;
    transition: opacity 2.2s ease;
}

.stage__blackout--on {
    opacity: 1;
}

@media (min-width: 880px) {
    .stage {
        max-width: 900px;
    }

    .stage__hint {
        font-size: 20px;
    }

    .stage__paper-wrap {
        top: 7vh;
        perspective: 1400px;
    }
}
</style>
