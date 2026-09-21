<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { useRitualAnimation } from '~/composables/useRitualAnimation';

const anim = useRitualAnimation();
const particleRefs = ref<HTMLElement[]>([]);

const PARTICLES = [
    { left: 10, size: 4, color: '#6b6358' },
    { left: 40, size: 3, color: '#857c6e' },
    { left: 70, size: 5, color: '#5c554c' },
    { left: 96, size: 3, color: '#7a7263' },
];

function setParticleRef(el: Element | ComponentPublicInstance | null) {
    if (el instanceof HTMLElement) {
        particleRefs.value.push(el);
    }
}

onMounted(() => {
    anim.scatterAsh(particleRefs.value);
});
</script>

<template>
    <div class="ash">
        <span
            v-for="(particle, index) in PARTICLES"
            :key="index"
            :ref="setParticleRef"
            class="ash__particle"
            :style="{
                left: `${particle.left}px`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                background: particle.color,
            }"
        />
    </div>
</template>

<style scoped>
.ash {
    position: absolute;
    left: 50%;
    bottom: 38vh;
    transform: translateX(-50%);
    width: 120px;
    height: 140px;
    pointer-events: none;
}

.ash__particle {
    position: absolute;
    bottom: 0;
    border-radius: 50%;
    opacity: 0.7;
}
</style>
