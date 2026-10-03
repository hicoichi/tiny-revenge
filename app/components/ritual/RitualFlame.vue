<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRitualAnimation } from '~/composables/useRitualAnimation';
import { FLAME_BASE_PAD, FLAME_BOX_WIDTH, useFlameRenderer } from '~/composables/useFlameRenderer';
import type { FlameAnchor } from '~/composables/useFlameRenderer';
import { useFireParticles } from '~/composables/useFireParticles';
import { useFireSound } from '~/composables/useFireSound';
import type { FireParticlesController } from '~/composables/useFireParticles';

// 0(待機)〜1(燃え盛る)。紙が燃えるときは0/1、護摩木をくべるときは段階的に上げる。
const props = defineProps<{
    power: number;
}>();

const anim = useRitualAnimation();
const sound = useFireSound();
const rootEl = ref<HTMLElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);

let fire: FireParticlesController | null = null;

onMounted(() => {
    sound.setPower(props.power);
    if (rootEl.value) anim.flareFlame(rootEl.value, props.power);
    const canvas = canvasEl.value;
    if (!canvas) return;
    // WebGLが使えない環境では、Canvas 2Dの簡易な炎で代替する。
    fire = useFlameRenderer(canvas) ?? useFireParticles(canvas, FLAME_BASE_PAD);
    fire.setIntensity(props.power);
});

onBeforeUnmount(() => {
    fire?.kill();
    sound.setPower(null);
});

// 紙が炎に触れる段階(ignite以降)で、待機中の小さな炎から一気に燃え上がる。
watch(
    () => props.power,
    (power, previous) => {
        if (rootEl.value) anim.flareFlame(rootEl.value, power);
        fire?.setIntensity(power);
        sound.setPower(power);
        if (power > previous) sound.burst();
    },
);

// 背景の陽炎や照り返しを炎に合わせるため、炎の根元の画面上の位置と表示倍率を返す。
function getAnchor(): FlameAnchor | null {
    const el = rootEl.value;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.bottom, scale: rect.width / FLAME_BOX_WIDTH };
}

defineExpose({ getAnchor });
</script>

<template>
    <div ref="rootEl" class="flame">
        <div class="flame__ground-glow" />
        <canvas ref="canvasEl" class="flame__canvas" />
    </div>
</template>

<style scoped>
/* 幅・高さはuseFlameRendererのFLAME_BOX_WIDTH/HEIGHTと一致させること。 */
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

/* 親が書き込む --rr-fire-light に合わせ、炎と同じ揺らぎで足元が明滅する。
   下端で光が水平に切れないよう、根元より十分下まで要素を伸ばし、その手前で光を減衰させきる。 */
.flame__ground-glow {
    position: absolute;
    left: 50%;
    bottom: -200px;
    transform: translateX(-50%);
    width: 760px;
    height: 740px;
    background: radial-gradient(
        380px 297px at 50% 63%,
        rgba(255, 130, 30, 0.68) 0%,
        rgba(255, 90, 0, 0.22) 45%,
        rgba(255, 90, 0, 0) 74%
    );
    opacity: calc(0.3 + var(--rr-fire-light, 0.5) * 0.6);
}

/* 根元の下にもブルームの光を広げるため、FLAME_BASE_PAD(120px)だけ下へはみ出させる。 */
.flame__canvas {
    position: absolute;
    left: 0;
    bottom: -120px;
    width: 100%;
    height: calc(100% + 120px);
}
</style>
