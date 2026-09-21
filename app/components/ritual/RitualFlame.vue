<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRitualAnimation } from '~/composables/useRitualAnimation';
import type { LoopController } from '~/composables/useRitualAnimation';
import { useFireParticles } from '~/composables/useFireParticles';
import type { FireParticlesController } from '~/composables/useFireParticles';

// 0(待機)〜1(燃え盛る)。紙が燃えるときは0/1、護摩木をくべるときは段階的に上げる。
const props = defineProps<{
    power: number;
}>();

const anim = useRitualAnimation();
const rootEl = ref<HTMLElement | null>(null);
const groundGlowEl = ref<HTMLElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);

const loops: LoopController[] = [];
let fire: FireParticlesController | null = null;

onMounted(() => {
    if (groundGlowEl.value) loops.push(anim.loopGlowFlicker(groundGlowEl.value));
    if (rootEl.value) anim.flareFlame(rootEl.value, props.power);
    if (canvasEl.value) {
        fire = useFireParticles(canvasEl.value);
        fire.setIntensity(props.power);
    }
});

onBeforeUnmount(() => {
    loops.forEach((loop) => loop.kill());
    fire?.kill();
});

// 紙が炎に触れる段階(ignite以降)で、待機中の小さな炎から一気に燃え上がる。
watch(
    () => props.power,
    (power) => {
        if (rootEl.value) anim.flareFlame(rootEl.value, power);
        fire?.setIntensity(power);
    },
);
</script>

<template>
    <div ref="rootEl" class="flame">
        <div ref="groundGlowEl" class="flame__ground-glow" />
        <canvas ref="canvasEl" class="flame__canvas" />
    </div>
</template>

<style scoped>
.flame {
    position: absolute;
    left: 50%;
    bottom: var(--rr-flame-bottom, 36vh);
    transform: translateX(-50%) scale(0.52);
    transform-origin: 50% 100%;
    opacity: 0.78;
    width: 640px;
    height: 760px;
    pointer-events: none;
}

.flame__ground-glow {
    position: absolute;
    left: 50%;
    bottom: -10px;
    transform: translateX(-50%);
    width: 760px;
    height: 540px;
    background: radial-gradient(
        50% 55% at 50% 85%,
        rgba(255, 130, 30, 0.68) 0%,
        rgba(255, 90, 0, 0.22) 45%,
        rgba(255, 90, 0, 0) 74%
    );
}

.flame__canvas {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
}
</style>
