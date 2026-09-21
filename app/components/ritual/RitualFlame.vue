<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRitualAnimation } from '~/composables/useRitualAnimation';

const anim = useRitualAnimation();
const glowEl = ref<HTMLElement | null>(null);
const coreEl = ref<HTMLElement | null>(null);
const tipEl = ref<HTMLElement | null>(null);

onMounted(() => {
    if (glowEl.value) anim.loopFlame(glowEl.value);
    if (coreEl.value) anim.loopFlame(coreEl.value);
    if (tipEl.value) anim.loopFlame(tipEl.value);
});
</script>

<template>
    <div class="flame">
        <div ref="glowEl" class="flame__glow" />
        <div ref="coreEl" class="flame__core" />
        <div ref="tipEl" class="flame__tip" />
    </div>
</template>

<style scoped>
.flame {
    position: absolute;
    left: 50%;
    bottom: 36vh;
    transform: translateX(-50%);
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
