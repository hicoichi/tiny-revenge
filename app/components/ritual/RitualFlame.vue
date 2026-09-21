<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRitualAnimation } from '~/composables/useRitualAnimation';

const props = defineProps<{
    flaring: boolean;
}>();

const anim = useRitualAnimation();
const rootEl = ref<HTMLElement | null>(null);
const glowEl = ref<HTMLElement | null>(null);
const coreEl = ref<HTMLElement | null>(null);
const tipEl = ref<HTMLElement | null>(null);

onMounted(() => {
    if (glowEl.value) anim.loopFlame(glowEl.value);
    if (coreEl.value) anim.loopFlame(coreEl.value);
    if (tipEl.value) anim.loopFlame(tipEl.value);
    if (rootEl.value) anim.flareFlame(rootEl.value, props.flaring);
});

// 紙が炎に触れる段階(ignite以降)で、待機中の小さな炎から一気に燃え上がる。
watch(
    () => props.flaring,
    (flaring) => {
        if (rootEl.value) anim.flareFlame(rootEl.value, flaring);
    },
);
</script>

<template>
    <div ref="rootEl" class="flame">
        <div ref="glowEl" class="flame__glow" />
        <div ref="coreEl" class="flame__core" />
        <div ref="tipEl" class="flame__tip" />
    </div>
</template>

<style scoped>
.flame {
    position: absolute;
    left: 50%;
    bottom: var(--rr-flame-bottom, 36vh);
    transform: translateX(-50%) scale(0.55);
    transform-origin: 50% 100%;
    opacity: 0.72;
    width: 170px;
    height: 220px;
    pointer-events: none;
}

.flame__glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(
        50% 45% at 50% 78%,
        rgba(255, 150, 40, 0.55),
        rgba(255, 90, 0, 0) 70%
    );
}

.flame__core {
    position: absolute;
    left: 50%;
    bottom: 10px;
    transform: translateX(-50%);
    width: 62px;
    height: 120px;
    border-radius: 50% 50% 45% 45%;
    background: linear-gradient(0deg, #ffd27a, var(--rr-flame) 45%, rgba(255, 60, 0, 0) 92%);
    filter: blur(6px);
}

.flame__tip {
    position: absolute;
    left: 50%;
    bottom: 6px;
    transform: translateX(-50%);
    width: 26px;
    height: 58px;
    border-radius: 50%;
    background: linear-gradient(0deg, #fff3c4, #ffb638 70%, rgba(255, 120, 0, 0));
    filter: blur(3px);
}
</style>
