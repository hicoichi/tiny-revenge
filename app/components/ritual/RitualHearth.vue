<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
    // 炎の勢い(0〜1)。選ぶたびに育つ。
    power: number;
}>();

const fireSpotEl = ref<HTMLElement | null>(null);

// 護摩木がくべられる位置。飛ばす側がこの座標を目標にする。
function getFireRect(): DOMRect | null {
    return fireSpotEl.value?.getBoundingClientRect() ?? null;
}

defineExpose({ getFireRect });
</script>

<template>
    <div class="hearth" aria-hidden="true">
        <RitualFirewood layer="back" />
        <!-- RitualFlameは儀式ステージ用の大きさで作られているため、炉に収まるよう外側で縮小する。
             炎の根元を薪の奥に置き、手前の薪(front)が炎の下部を隠すことで、薪の間から燃え上がって見せる。 -->
        <div class="hearth__flame">
            <RitualFlame :power="power" />
        </div>
        <RitualFirewood layer="front" />
        <div ref="fireSpotEl" class="hearth__spot" />
    </div>
</template>

<style scoped>
.hearth {
    position: relative;
    flex: none;
    /* 画面の縦幅に応じて縮め、スマホでスクロールせずに収める。 */
    width: clamp(150px, 26dvh, 210px);
    aspect-ratio: 320 / 150;
    margin-top: 6px;
    --hearth-flame-scale: 0.17;
}

.hearth__flame {
    position: absolute;
    left: 50%;
    bottom: 34%;
    width: 0;
    height: 0;
    transform: scale(var(--hearth-flame-scale));
    transform-origin: 0 0;
    --rr-flame-bottom: 0px;
    pointer-events: none;
}

.hearth__spot {
    position: absolute;
    left: 50%;
    bottom: 48%;
    width: 8px;
    height: 8px;
    margin-left: -4px;
}

@media (min-width: 880px) {
    .hearth {
        width: 420px;
        --hearth-flame-scale: 0.4;
    }
}
</style>
