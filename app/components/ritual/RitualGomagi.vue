<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    label: string;
    index: number;
    // 同じ段階の護摩木の高さを揃えるための、最長の文字数。
    maxChars: number;
    dimmed: boolean;
    disabled: boolean;
    // 何も書かれていない白木。自分で書き足すための1本。
    blank?: boolean;
    // 自分で書いた長い文言は、縦に折り返して2列で書けるよう板を幅広にする。
    wide?: boolean;
}>();

const emit = defineEmits<{
    pick: [label: string, el: HTMLElement];
}>();

// 同じ文言なら毎回同じ見た目になるよう、ラベルから決まる疑似乱数で1本ごとの個体差を作る。
// 全ての護摩木が同じ複製に見えると、手で削った木片の説得力が失われるため。
const seed = computed(() =>
    [...props.label].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7),
);

function rand(slot: number): number {
    const x = Math.sin(seed.value * 12.9898 + slot * 78.233) * 43758.5453;
    return x - Math.floor(x);
}

const uid = computed(() => `gomagi-${seed.value}`);

// 先の尖った板を、手で削ったように少しだけ歪ませた輪郭にする。
const outline = computed(() => {
    const shoulderL = (11 + rand(1) * 3).toFixed(1);
    const shoulderR = (11 + rand(2) * 3).toFixed(1);
    const apex = (47 + rand(3) * 6).toFixed(1);
    const apexY = (rand(4) * 2).toFixed(1);
    const bottomL = (rand(5) * 3).toFixed(1);
    const bottomM = (rand(6) * 3).toFixed(1);
    const bottomR = (rand(7) * 3).toFixed(1);
    return `polygon(0 ${shoulderL}px, ${apex}% ${apexY}px, 100% ${shoulderR}px, 100% calc(100% - ${bottomR}px), 52% calc(100% - ${bottomM}px), 0 calc(100% - ${bottomL}px))`;
});

const tilt = computed(() => `${((rand(8) - 0.5) * 3.6).toFixed(2)}deg`);
const brightness = computed(() => (0.9 + rand(9) * 0.18).toFixed(3));
const grainSeed = computed(() => seed.value % 97);

// 節は全ての板にあると不自然なので、約3本に1本だけにする。
const knot = computed(() =>
    rand(10) < 0.34
        ? { top: `${30 + rand(11) * 40}%`, left: `${18 + rand(12) * 44}%`, size: `${9 + rand(13) * 8}px` }
        : null,
);

function onClick(event: MouseEvent) {
    emit('pick', props.label, event.currentTarget as HTMLElement);
}
</script>

<template>
    <button
        type="button"
        class="gomagi"
        :class="{ 'gomagi--dimmed': dimmed, 'gomagi--blank': blank, 'gomagi--wide': wide }"
        :style="{
            '--n': maxChars,
            '--i': index,
            '--tilt': tilt,
            '--tone': brightness,
        }"
        :aria-label="label"
        :disabled="disabled"
        @click="onClick"
    >
        <span class="gomagi__body" :style="{ clipPath: outline }">
            <svg class="gomagi__grain" aria-hidden="true" width="100%" height="100%" preserveAspectRatio="none">
                <defs>
                    <!-- 縦に流れる木目。細い縞を、低周波のうねりで歪ませて年輪のような流れを出す。 -->
                    <filter :id="`${uid}-grain`" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
                        <feTurbulence type="fractalNoise" baseFrequency="0.32 0.018" numOctaves="3" :seed="grainSeed" result="streak" />
                        <feTurbulence type="fractalNoise" baseFrequency="0.02 0.012" numOctaves="2" :seed="grainSeed + 3" result="wave" />
                        <feDisplacementMap in="streak" in2="wave" scale="14" xChannelSelector="R" yChannelSelector="G" result="warped" />
                        <feColorMatrix in="warped" type="matrix" values="0 0 0 0 0.34  0 0 0 0 0.2  0 0 0 0 0.07  1.9 0 0 0 -0.72" />
                    </filter>
                </defs>
                <rect width="100%" height="100%" fill="#000" :filter="`url(#${uid}-grain)`" />
            </svg>
            <span class="gomagi__crown" />
            <span
                v-if="knot"
                class="gomagi__knot"
                :style="{ top: knot.top, left: knot.left, width: knot.size, height: `calc(${knot.size} * 1.5)` }"
            />
            <span class="gomagi__lit" />
            <span class="gomagi__text-wrap">
                <svg class="gomagi__defs" aria-hidden="true" width="0" height="0" focusable="false">
                    <defs>
                        <!-- 墨の縁のわずかな揺らぎと、ごく弱い筆のかすれ。強くすると文字が判読できなくなるため控えめにする。 -->
                        <filter :id="`${uid}-ink`" x="-20%" y="-5%" width="140%" height="110%" color-interpolation-filters="sRGB">
                            <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" :seed="grainSeed" result="edge" />
                            <feDisplacementMap in="SourceGraphic" in2="edge" scale="1.2" xChannelSelector="R" yChannelSelector="G" result="rough" />
                            <feTurbulence type="fractalNoise" baseFrequency="0.7 0.16" numOctaves="1" :seed="grainSeed + 5" result="dry" />
                            <feColorMatrix in="dry" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -6 0 0 0 4.9" result="mask" />
                            <feComposite in="rough" in2="mask" operator="in" />
                        </filter>
                    </defs>
                </svg>
                <span class="gomagi__text" :style="blank ? undefined : { filter: `url(#${uid}-ink)` }">{{ label }}</span>
            </span>
        </span>
    </button>
</template>

<style scoped>
.gomagi {
    --w: 44px;
    position: relative;
    width: var(--w);
    height: calc(var(--n) * 1.2em + 44px);
    padding: 0;
    border: none;
    background: none;
    font-size: 16px;
    cursor: pointer;
    rotate: var(--tilt);
    /* clip-pathが影を切り取ってしまうため、影は輪郭で切られない外側のbuttonに付ける。 */
    filter: drop-shadow(0 9px 8px rgba(0, 0, 0, 0.65)) drop-shadow(0 1px 1px rgba(0, 0, 0, 0.6));
    animation: rr-lay 0.7s ease backwards;
    animation-delay: calc(var(--i) * 70ms);
    transition: transform 0.4s, opacity 0.4s, filter 0.4s;
}

.gomagi--wide {
    width: calc(var(--w) * 1.9);
}

.gomagi--dimmed {
    opacity: 0.18;
    filter: grayscale(1) drop-shadow(0 9px 8px rgba(0, 0, 0, 0.65));
}

@media (hover: hover) {
    .gomagi:hover:not(.gomagi--dimmed) {
        transform: translateY(-8px);
        filter: drop-shadow(0 0 14px rgba(255, 150, 50, 0.5)) drop-shadow(0 12px 9px rgba(0, 0, 0, 0.65));
    }
}

.gomagi:focus-visible {
    outline: 2px solid var(--rr-gold);
    outline-offset: 6px;
}

.gomagi__body {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    overflow: hidden;
    filter: brightness(var(--tone));
    /* 檜のような明るい木肌。左右の縁を暗く/明るくして、板の厚みと角の丸みを出す。 */
    background: linear-gradient(
        90deg,
        #a97f44 0%,
        #cfa96c 9%,
        #e2c78f 32%,
        #e8d19b 52%,
        #dcbd82 76%,
        #c39c5e 92%,
        #8e6733 100%
    );
    box-shadow: inset 2px 0 2px rgba(255, 238, 200, 0.35), inset -3px 0 4px rgba(58, 34, 10, 0.5),
        inset 0 -3px 5px rgba(58, 34, 10, 0.35);
}

.gomagi__grain {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    mix-blend-mode: multiply;
    opacity: 0.9;
}

/* 尖った先を削った面。左を明るく右を暗くして、面取りされた形に見せる。 */
.gomagi__crown {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 20px;
    background: linear-gradient(90deg, rgba(255, 244, 214, 0.34) 50%, rgba(56, 32, 8, 0.32) 50%);
    -webkit-mask-image: linear-gradient(#000 55%, transparent);
    mask-image: linear-gradient(#000 55%, transparent);
}

.gomagi__knot {
    position: absolute;
    border-radius: 50%;
    background: radial-gradient(
        ellipse at 50% 50%,
        #4b2d10 0%,
        #6a4319 38%,
        rgba(140, 98, 48, 0.55) 62%,
        transparent 72%
    );
    box-shadow: 0 0 0 2px rgba(120, 82, 36, 0.28);
}

/* 炉の炎に近い下側ほど、赤く照らされる。炎が育つほど強くなる。 */
.gomagi--blank .gomagi__body {
    filter: brightness(1.1) saturate(0.7);
}

.gomagi--blank .gomagi__text {
    color: rgba(15, 10, 5, 0.5);
    text-shadow: none;
}

.gomagi__lit {
    position: absolute;
    inset: 0;
    background: linear-gradient(0deg, rgba(255, 110, 30, 0.85), rgba(255, 140, 50, 0) 70%);
    mix-blend-mode: soft-light;
    opacity: calc(var(--fire-lv, 0) * 0.22);
    transition: opacity 1s;
}

.gomagi__text-wrap {
    position: absolute;
    inset: 0;
    padding-top: 28px;
    display: flex;
    justify-content: center;
}

.gomagi__defs {
    position: absolute;
}

.gomagi__text {
    writing-mode: vertical-rl;
    /* 力強い筆書体。明朝の太字だとフィルタで潰れて読みにくかったため、字形自体が筆の文字を使う。 */
    font-family: 'Yuji Boku', var(--rr-font);
    font-weight: 400;
    line-height: 1.2;
    letter-spacing: 0.12em;
    color: #0f0a05;
    /* 墨が木肌に染みて縁がわずかに滲む。 */
    text-shadow: 0 0 1.5px rgba(22, 14, 6, 0.75);
}

@media (min-width: 880px) {
    .gomagi {
        --w: 66px;
        font-size: 21px;
        height: calc(var(--n) * 1.2em + 54px);
    }

    .gomagi__text-wrap {
        padding-top: 34px;
    }
}
</style>
