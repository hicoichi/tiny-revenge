<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useHeatBackdrop } from '~/composables/useHeatBackdrop';
import type { HeatBackdropController } from '~/composables/useHeatBackdrop';
import type { FlameAnchor } from '~/composables/useFlameRenderer';

// CSSの背景の上に重ね、描画の準備ができてから表示する。WebGLが使えない環境ではCSSの背景がそのまま見える。
const props = defineProps<{
    src: string;
    power: number;
    getFlameAnchor: () => FlameAnchor | null;
}>();

const canvasEl = ref<HTMLCanvasElement | null>(null);
const isReady = ref(false);
let backdrop: HeatBackdropController | null = null;

onMounted(() => {
    if (!canvasEl.value) return;
    backdrop = useHeatBackdrop(canvasEl.value, {
        src: props.src,
        getFlameAnchor: props.getFlameAnchor,
        onReady: () => {
            isReady.value = true;
        },
    });
    backdrop?.setPower(props.power);
});

onBeforeUnmount(() => {
    backdrop?.kill();
});

watch(
    () => props.power,
    (power) => backdrop?.setPower(power),
);
</script>

<template>
    <canvas
        ref="canvasEl"
        class="backdrop"
        :class="{ 'backdrop--ready': isReady }"
        aria-hidden="true"
    />
</template>

<style scoped>
.backdrop {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    transition: opacity 0.4s ease;
}

.backdrop--ready {
    opacity: 1;
}
</style>
