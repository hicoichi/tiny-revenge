<script setup lang="ts">
import { computed } from 'vue';
import { HOLD_COMPLETE_MS, HOLD_RAISE_MS } from '~/constants/revenge';
import { useRevenge } from '~/composables/useRevenge';
import { useRitual } from '~/composables/useRitual';
import type { RitePhase } from '~/types/revenge';

const revenge = useRevenge();
const ritual = useRitual();

// 炎は儀式に入った時点から灯っており、紙が燃え始めると勢いを増す。
const flaring = computed(() =>
    (['ignite', 'burn', 'ash'] as RitePhase[]).includes(ritual.ritePhase.value),
);
const showRaise = computed(() => ritual.ritePhase.value === 'ready');
const showComplete = computed(() => ritual.ritePhase.value === 'raised');

const hint = computed(() => {
    switch (ritual.ritePhase.value) {
        case 'ready':
            return '復讐は記された。';
        case 'raised':
            return 'この復讐を、現実で実行せよ。\n終えたときだけ、完遂を押せ。';
        default:
            return '';
    }
});

function raise() {
    ritual.setRitePhase('raising');
}

function complete() {
    ritual.setRitePhase('ignite');
}
</script>

<template>
    <div class="stage">
        <div class="stage__glow" />
        <div class="stage__pillar stage__pillar--left" />
        <div class="stage__pillar stage__pillar--right" />
        <div class="stage__altar" />
        <div class="stage__altar-top" />

        <RitualFlame :flaring="flaring" />

        <div class="stage__paper-wrap">
            <RitualPaper
                :vow="revenge.vow.value"
                :constraint-label="revenge.constraint.value ?? ''"
                :verb-label="revenge.verb.value ?? ''"
            />
        </div>

        <div class="stage__footer">
            <p class="stage__hint">{{ hint }}</p>
            <RitualHoldButton
                v-if="showRaise"
                label="紙 を 掲 げ る"
                :hold-ms="HOLD_RAISE_MS"
                @complete="raise"
            />
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
    --rr-flame-bottom: 22vh;
}

.stage__glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(
        70% 45% at 50% 30%,
        rgba(90, 80, 62, 0.22) 0%,
        rgba(0, 0, 0, 0) 70%
    );
}

.stage__pillar {
    position: absolute;
    top: 9vh;
    bottom: 0;
    width: 11%;
    background: linear-gradient(90deg, #14120f, #232019 40%, #0d0c0a);
}

.stage__pillar--left {
    left: 0;
    box-shadow: inset -14px 0 24px rgba(0, 0, 0, 0.6);
}

.stage__pillar--right {
    right: 0;
    background: linear-gradient(270deg, #14120f, #232019 40%, #0d0c0a);
    box-shadow: inset 14px 0 24px rgba(0, 0, 0, 0.6);
}

.stage__altar {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    bottom: 0;
    width: 36%;
    height: 20vh;
    background: linear-gradient(180deg, #1d1a15, #100e0c);
    box-shadow: 0 -20px 50px rgba(0, 0, 0, 0.7);
}

.stage__altar-top {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    bottom: 20vh;
    width: 42%;
    height: 12px;
    background: #221f19;
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
    font-size: 11px;
    letter-spacing: 0.34em;
    color: #8a8170;
    text-align: center;
    min-height: 16px;
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

    .stage__paper-wrap {
        top: 7vh;
        perspective: 1400px;
    }
}
</style>
