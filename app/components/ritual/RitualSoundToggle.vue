<script setup lang="ts">
import { useFireSound } from '~/composables/useFireSound';

const sound = useFireSound();
</script>

<template>
    <button
        type="button"
        class="sound-toggle"
        :class="{ 'sound-toggle--off': !sound.isEnabled.value }"
        :aria-pressed="sound.isEnabled.value"
        :aria-label="sound.isEnabled.value ? '炎の音を消す' : '炎の音を出す'"
        @click="sound.toggle()"
    >
        音
    </button>
</template>

<style scoped>
/* 儀式の邪魔をしないよう、画面の隅に小さく置く。上部は誓いの文が画面幅いっぱいに並ぶため、
   下の隅に置き、儀式の長押しボタン(下端から5vh)より低くして重ならないようにする。 */
.sound-toggle {
    position: fixed;
    bottom: calc(8px + env(safe-area-inset-bottom));
    right: calc(8px + env(safe-area-inset-right));
    z-index: 30;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid var(--rr-border);
    background: rgba(11, 10, 9, 0.55);
    color: var(--rr-ink-soft);
    font-family: var(--rr-font);
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    transition:
        color 0.3s,
        border-color 0.3s,
        opacity 0.3s;
}

.sound-toggle:hover {
    border-color: var(--rr-border-selected);
}

.sound-toggle:focus-visible {
    outline: 1px solid var(--rr-gold);
    outline-offset: 3px;
}

/* 消音中は字に斜線を引いて沈める。 */
.sound-toggle--off {
    color: var(--rr-ink-muted);
    opacity: 0.7;
    background-image: linear-gradient(
        135deg,
        transparent calc(50% - 0.5px),
        var(--rr-ink-muted) calc(50% - 0.5px),
        var(--rr-ink-muted) calc(50% + 0.5px),
        transparent calc(50% + 0.5px)
    );
}

@media (min-width: 880px) {
    .sound-toggle {
        bottom: 24px;
        right: 24px;
        width: 40px;
        height: 40px;
        font-size: 16px;
    }
}
</style>
