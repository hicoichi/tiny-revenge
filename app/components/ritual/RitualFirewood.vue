<script setup lang="ts">
// 焚火の薪・熾火・石組みを描く。炎の手前と奥に挟むため、layerで奥(back)と手前(front)を描き分ける。
// フィルタ・グラデーションの定義はbackのsvgにまとめ、frontからも同じidで参照する(同一ドキュメント内なので有効)。
// 質感はCSSの単色ではなく、feTurbulenceで作った凹凸をfeDiffuseLightingで照らして立体的に見せている。
defineProps<{
    layer: 'back' | 'front';
}>();

interface Log {
    x: number;
    y: number;
    angle: number;
    length: number;
    height: number;
    // 樹皮の模様の種類。同じ模様を並べると複製に見えるため2種類を使い分ける。
    variant: 'a' | 'b';
}

const BACK_LOGS: Log[] = [{ x: 160, y: 86, angle: -2, length: 176, height: 22, variant: 'a' }];

// 中央に向かって立てかけた2本と、手前に横たえた1本。
const FRONT_LOGS: Log[] = [
    { x: 118, y: 92, angle: -27, length: 150, height: 22, variant: 'b' },
    { x: 204, y: 94, angle: 25, length: 146, height: 21, variant: 'a' },
    { x: 166, y: 111, angle: 3, length: 196, height: 25, variant: 'b' },
];

interface Stone {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
}

const BACK_STONES: Stone[] = [
    { cx: 50, cy: 93, rx: 27, ry: 14 },
    { cx: 98, cy: 88, rx: 24, ry: 13 },
    { cx: 224, cy: 88, rx: 25, ry: 13 },
    { cx: 270, cy: 93, rx: 27, ry: 14 },
];

const FRONT_STONES: Stone[] = [
    { cx: 30, cy: 121, rx: 34, ry: 20 },
    { cx: 86, cy: 133, rx: 37, ry: 18 },
    { cx: 146, cy: 138, rx: 34, ry: 16 },
    { cx: 204, cy: 136, rx: 38, ry: 18 },
    { cx: 262, cy: 130, rx: 37, ry: 19 },
    { cx: 300, cy: 119, rx: 28, ry: 18 },
];
</script>

<template>
    <svg
        class="firewood"
        :class="`firewood--${layer}`"
        viewBox="0 0 320 150"
        preserveAspectRatio="xMidYMax meet"
        aria-hidden="true"
        focusable="false"
    >
        <defs v-if="layer === 'back'">
            <linearGradient id="fw-log-shade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#1d1209" />
                <stop offset="0.22" stop-color="#6b4626" />
                <stop offset="0.5" stop-color="#4a2f17" />
                <stop offset="0.8" stop-color="#24160b" />
                <stop offset="1" stop-color="#0b0704" />
            </linearGradient>
            <radialGradient id="fw-endgrain" cx="0.5" cy="0.5" r="0.6">
                <stop offset="0" stop-color="#d2a86c" />
                <stop offset="0.65" stop-color="#9a7040" />
                <stop offset="1" stop-color="#3b2413" />
            </radialGradient>
            <radialGradient id="fw-stone-shade" cx="0.4" cy="0.3" r="0.8">
                <stop offset="0" stop-color="#7a746a" />
                <stop offset="1" stop-color="#26231f" />
            </radialGradient>
            <radialGradient id="fw-coal-glow" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stop-color="#ff7a1a" stop-opacity="0.95" />
                <stop offset="0.55" stop-color="#d8420a" stop-opacity="0.5" />
                <stop offset="1" stop-color="#8a2004" stop-opacity="0" />
            </radialGradient>
            <radialGradient id="fw-rim-glow" cx="0.5" cy="0.35" r="0.6">
                <stop offset="0" stop-color="#ff8a2a" stop-opacity="0.75" />
                <stop offset="1" stop-color="#ff5a10" stop-opacity="0" />
            </radialGradient>

            <!-- 樹皮: 縦(丸太の長手方向)に流れる凹凸を光で照らし、既存の陰影と掛け合わせる。 -->
            <filter
                v-for="bark in [{ id: 'a', seed: 3 }, { id: 'b', seed: 11 }]"
                :id="`fw-bark-${bark.id}`"
                :key="bark.id"
                x="-2%"
                y="-6%"
                width="104%"
                height="112%"
                color-interpolation-filters="sRGB"
            >
                <feTurbulence type="fractalNoise" baseFrequency="0.02 0.55" numOctaves="4" :seed="bark.seed" result="bump" />
                <feDiffuseLighting in="bump" surfaceScale="3.4" diffuseConstant="1.15" lighting-color="#ffe4bc" result="lit">
                    <feDistantLight azimuth="250" elevation="48" />
                </feDiffuseLighting>
                <feComposite in="lit" in2="SourceGraphic" operator="in" result="litClipped" />
                <feBlend in="SourceGraphic" in2="litClipped" mode="multiply" />
            </filter>

            <!-- 燃えて割れた樹皮の隙間から覗く赤熱。ノイズの一定範囲だけを細い筋として抜き出す。 -->
            <filter
                v-for="crack in [{ id: 'a', seed: 4 }, { id: 'b', seed: 17 }]"
                :id="`fw-cracks-${crack.id}`"
                :key="crack.id"
                x="0"
                y="0"
                width="100%"
                height="100%"
                color-interpolation-filters="sRGB"
            >
                <feTurbulence type="fractalNoise" baseFrequency="0.035 0.28" numOctaves="3" :seed="crack.seed" result="noise" />
                <feColorMatrix in="noise" type="matrix" values="0 0 0 0 1  0 0 0 0 0.42  0 0 0 0 0.06  1 0 0 0 0" result="tinted" />
                <feComponentTransfer in="tinted" result="lines">
                    <feFuncA type="discrete" tableValues="0 0 0 0 0 0 0 1 0 0" />
                </feComponentTransfer>
                <feGaussianBlur in="lines" stdDeviation="0.5" result="soft" />
                <feComposite in="soft" in2="SourceGraphic" operator="in" />
            </filter>

            <!-- 熾火: ノイズの明るい部分だけを橙の塊として残す。 -->
            <filter id="fw-coals" x="-5%" y="-40%" width="110%" height="180%" color-interpolation-filters="sRGB">
                <feTurbulence type="fractalNoise" baseFrequency="0.09 0.16" numOctaves="3" seed="9" result="noise" />
                <feColorMatrix in="noise" type="matrix" values="0 0 0 0 1  0 0 0 0 0.35  0 0 0 0 0.05  3.4 0 0 0 -1.45" result="hot" />
                <feGaussianBlur in="hot" stdDeviation="0.8" result="softHot" />
                <feComposite in="softHot" in2="SourceGraphic" operator="in" />
            </filter>

            <!-- 石: 荒い凹凸を光で照らして岩肌にする。 -->
            <filter id="fw-stone" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
                <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="4" seed="2" result="bump" />
                <feDiffuseLighting in="bump" surfaceScale="4" diffuseConstant="1.15" lighting-color="#e8e0d4" result="lit">
                    <feDistantLight azimuth="235" elevation="52" />
                </feDiffuseLighting>
                <feComposite in="lit" in2="SourceGraphic" operator="in" result="litClipped" />
                <feBlend in="SourceGraphic" in2="litClipped" mode="multiply" />
            </filter>
        </defs>

        <template v-if="layer === 'back'">
            <ellipse
                v-for="(stone, i) in BACK_STONES"
                :key="`bs-${i}`"
                :cx="stone.cx"
                :cy="stone.cy"
                :rx="stone.rx"
                :ry="stone.ry"
                fill="url(#fw-stone-shade)"
                filter="url(#fw-stone)"
                opacity="0.85"
            />

            <ellipse cx="160" cy="104" rx="108" ry="15" fill="#0d0a08" />
            <ellipse cx="160" cy="102" rx="100" ry="15" fill="url(#fw-coal-glow)" class="firewood__coal-glow" />
            <g class="firewood__pulse firewood__pulse--slow">
                <ellipse cx="160" cy="103" rx="84" ry="10" fill="#000" filter="url(#fw-coals)" class="firewood__heat" />
            </g>
        </template>

        <template v-for="(log, i) in layer === 'back' ? BACK_LOGS : FRONT_LOGS" :key="`${layer}-log-${i}`">
            <g :transform="`translate(${log.x} ${log.y}) rotate(${log.angle})`">
                <rect
                    :x="-log.length / 2"
                    :y="-log.height / 2"
                    :width="log.length"
                    :height="log.height"
                    :rx="log.height * 0.4"
                    fill="url(#fw-log-shade)"
                    :filter="`url(#fw-bark-${log.variant})`"
                />
                <g class="firewood__pulse">
                    <rect
                        :x="-log.length / 2"
                        :y="-log.height / 2"
                        :width="log.length"
                        :height="log.height"
                        :rx="log.height * 0.4"
                        fill="#000"
                        :filter="`url(#fw-cracks-${log.variant})`"
                        class="firewood__heat"
                    />
                </g>
                <!-- 切り口(年輪) -->
                <ellipse
                    :cx="log.length / 2 - 3"
                    cy="0"
                    :rx="log.height * 0.2"
                    :ry="log.height / 2 - 1.5"
                    fill="url(#fw-endgrain)"
                />
                <ellipse
                    :cx="log.length / 2 - 3"
                    cy="0"
                    :rx="log.height * 0.13"
                    :ry="log.height * 0.3"
                    fill="none"
                    stroke="rgba(60,36,14,0.5)"
                    stroke-width="0.6"
                />
                <ellipse
                    :cx="log.length / 2 - 3"
                    cy="0"
                    :rx="log.height * 0.06"
                    :ry="log.height * 0.15"
                    fill="none"
                    stroke="rgba(60,36,14,0.55)"
                    stroke-width="0.6"
                />
            </g>
        </template>

        <template v-if="layer === 'front'">
            <ellipse
                v-for="(stone, i) in FRONT_STONES"
                :key="`fs-${i}`"
                :cx="stone.cx"
                :cy="stone.cy"
                :rx="stone.rx"
                :ry="stone.ry"
                fill="url(#fw-stone-shade)"
                filter="url(#fw-stone)"
            />
            <!-- 炎に照らされた縁の赤み。炎が育つほど強くなる。 -->
            <ellipse cx="160" cy="118" rx="170" ry="36" fill="url(#fw-rim-glow)" class="firewood__rim" />
        </template>
    </svg>
</template>

<style scoped>
.firewood {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
}

/* 赤熱は炎の勢いに連動し、さらに不規則に明滅する。明滅は入れ子のgで掛けて、勢いの値と干渉させない。 */
.firewood__heat {
    opacity: calc(0.25 + var(--fire-lv, 0) * 0.2);
    transition: opacity 1.2s;
}

.firewood__coal-glow {
    opacity: calc(0.3 + var(--fire-lv, 0) * 0.17);
    transition: opacity 1.2s;
}

.firewood__pulse {
    animation: rr-ember-pulse 2.6s ease-in-out infinite;
}

.firewood__pulse--slow {
    animation-duration: 3.7s;
    animation-delay: -1.2s;
}

.firewood__rim {
    opacity: calc(0.08 + var(--fire-lv, 0) * 0.16);
    mix-blend-mode: screen;
    transition: opacity 1.2s;
}

@keyframes rr-ember-pulse {
    0%,
    100% {
        opacity: 0.78;
    }
    35% {
        opacity: 1;
    }
    62% {
        opacity: 0.64;
    }
}
</style>
