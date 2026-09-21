<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRevenge } from '~/composables/useRevenge';
import { useRevengeStorage } from '~/composables/useRevengeStorage';
import { useRitual } from '~/composables/useRitual';

const revenge = useRevenge();
const ritual = useRitual();
const storage = useRevengeStorage();

onMounted(() => {
    storage.init();
});

// 選択と確認は炎を共有する一続きの場面なので、同じキーにして画面を入れ替えない。
const isOfferingScene = computed(
    () => ritual.step.value === 'select' || ritual.step.value === 'decide',
);

function onRestart() {
    ritual.reset();
    revenge.resetRevenge();
    storage.clear();
}
</script>

<template>
    <div class="experience">
        <!-- 各画面は入場アニメーション(animation)を持つ。typeを指定しないと、その長さ(決着画面は3秒)を
             遷移の長さと誤って判定し、退場が終わるまで画面が切り替わらなくなる。 -->
        <Transition name="rr-screen" mode="out-in" type="transition">
            <RitualStart
                v-if="ritual.step.value === 'start'"
                key="start"
                @start="ritual.next()"
            />

            <RitualOfferingStep v-else-if="isOfferingScene" key="offering" />

            <RitualStage v-else-if="ritual.step.value === 'rite'" key="rite" />

            <RitualVerdict
                v-else-if="ritual.step.value === 'verdict'"
                key="verdict"
                @restart="onRestart"
            />
        </Transition>
    </div>
</template>

<style scoped>
.experience {
    position: relative;
    min-height: 100vh;
    /* iOS Safariでは100vhがツールバーを含む高さになり、下端が隠れてスクロールが必要になる。 */
    min-height: 100dvh;
    width: 100%;
    background: radial-gradient(
        120% 70% at 50% 8%,
        var(--rr-bg-glow) 0%,
        var(--rr-bg) 58%,
        var(--rr-bg-deep) 100%
    );
    color: var(--rr-ink);
    overflow: hidden;
}

.rr-screen-enter-active,
.rr-screen-leave-active {
    transition: opacity 0.6s ease;
}

.rr-screen-enter-from,
.rr-screen-leave-to {
    opacity: 0;
}
</style>
