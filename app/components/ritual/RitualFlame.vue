<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { useRitualAnimation } from '~/composables/useRitualAnimation';
import type { LoopController } from '~/composables/useRitualAnimation';

const props = defineProps<{
    flaring: boolean;
}>();

const anim = useRitualAnimation();
const rootEl = ref<HTMLElement | null>(null);
const groundGlowEl = ref<HTMLElement | null>(null);
const hotCoreEl = ref<HTMLElement | null>(null);
const tongueEls = ref<HTMLElement[]>([]);
const sparkEls = ref<HTMLElement[]>([]);

const TONGUE_COUNT = 8;
const SPARK_COUNT = 9;

function setTongueRef(el: Element | ComponentPublicInstance | null) {
    if (el instanceof HTMLElement) tongueEls.value.push(el);
}

function setSparkRef(el: Element | ComponentPublicInstance | null) {
    if (el instanceof HTMLElement) sparkEls.value.push(el);
}

const loops: LoopController[] = [];

onMounted(() => {
    if (groundGlowEl.value) loops.push(anim.loopGlowFlicker(groundGlowEl.value));
    if (hotCoreEl.value) anim.loopFlame(hotCoreEl.value);
    tongueEls.value.forEach((el, i) => loops.push(anim.loopFlameTongue(el, i)));
    sparkEls.value.forEach((el, i) => loops.push(anim.loopEmber(el, i)));
    if (rootEl.value) anim.flareFlame(rootEl.value, props.flaring);
});

onBeforeUnmount(() => {
    loops.forEach((loop) => loop.kill());
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
        <div ref="groundGlowEl" class="flame__ground-glow" />
        <div class="flame__body">
            <div
                v-for="i in TONGUE_COUNT"
                :key="i"
                :ref="setTongueRef"
                class="flame__tongue"
                :class="`flame__tongue--${i}`"
            />
        </div>
        <div ref="hotCoreEl" class="flame__hot-core" />
        <div class="flame__sparks">
            <span v-for="i in SPARK_COUNT" :key="i" :ref="setSparkRef" class="flame__spark" />
        </div>
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
    width: 300px;
    height: 360px;
    pointer-events: none;
}

.flame__ground-glow {
    position: absolute;
    left: 50%;
    bottom: -10px;
    transform: translateX(-50%);
    width: 460px;
    height: 320px;
    background: radial-gradient(
        50% 55% at 50% 85%,
        rgba(255, 130, 30, 0.68) 0%,
        rgba(255, 90, 0, 0.22) 45%,
        rgba(255, 90, 0, 0) 74%
    );
}

.flame__body {
    position: absolute;
    inset: 0;
}

.flame__tongue {
    position: absolute;
    bottom: 4px;
    left: 50%;
    border-radius: 48% 52% 12% 12% / 88% 88% 12% 12%;
    mix-blend-mode: screen;
    transform-origin: 50% 100%;
}

.flame__tongue--1 {
    width: 78px;
    height: 190px;
    margin-left: -104px;
    background: linear-gradient(0deg, #d9280a 0%, #ff5a15 55%, rgba(255, 90, 10, 0) 96%);
    filter: blur(3px);
}

.flame__tongue--2 {
    width: 46px;
    height: 250px;
    margin-left: -84px;
    background: linear-gradient(0deg, #ff4b12 0%, #ff8a1f 50%, rgba(255, 130, 20, 0) 95%);
    filter: blur(2px);
}

.flame__tongue--3 {
    width: 40px;
    height: 300px;
    margin-left: -46px;
    background: linear-gradient(0deg, #ff7a1f 0%, #ffc25c 45%, rgba(255, 180, 80, 0) 92%);
    filter: blur(1.5px);
}

.flame__tongue--4 {
    width: 34px;
    height: 330px;
    margin-left: -10px;
    background: linear-gradient(0deg, #ffcf6b 0%, #fff3c6 42%, rgba(255, 230, 170, 0) 90%);
    filter: blur(1px);
}

.flame__tongue--5 {
    width: 38px;
    height: 290px;
    margin-left: 16px;
    background: linear-gradient(0deg, #ff8a1f 0%, #ffc25c 46%, rgba(255, 170, 60, 0) 92%);
    filter: blur(1.5px);
}

.flame__tongue--6 {
    width: 44px;
    height: 240px;
    margin-left: 44px;
    background: linear-gradient(0deg, #ff5a15 0%, #ff9a2c 50%, rgba(255, 120, 20, 0) 95%);
    filter: blur(2px);
}

.flame__tongue--7 {
    width: 76px;
    height: 185px;
    margin-left: 70px;
    background: linear-gradient(0deg, #d9280a 0%, #ff5a15 55%, rgba(255, 90, 10, 0) 96%);
    filter: blur(3px);
}

.flame__tongue--8 {
    width: 96px;
    height: 140px;
    margin-left: -48px;
    background: linear-gradient(0deg, #b81f08 0%, #ff4b12 60%, rgba(255, 70, 10, 0) 96%);
    filter: blur(5px);
    mix-blend-mode: normal;
    opacity: 0.85;
}

.flame__hot-core {
    position: absolute;
    left: 50%;
    bottom: 2px;
    transform: translateX(-50%);
    width: 26px;
    height: 92px;
    border-radius: 50% 50% 10% 10% / 90% 90% 10% 10%;
    background: linear-gradient(0deg, #fffbe9, #ffe19a 55%, rgba(255, 180, 90, 0));
    filter: blur(1px);
    mix-blend-mode: screen;
}

.flame__sparks {
    position: absolute;
    inset: 0;
}

.flame__spark {
    position: absolute;
    left: 50%;
    bottom: 50px;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: #ffce7a;
    box-shadow: 0 0 6px 1px rgba(255, 190, 100, 0.8);
    opacity: 0;
}
</style>
