<script setup lang="ts">
import { useHoldPress } from '~/composables/useHoldPress';

const props = withDefaults(
    defineProps<{
        label: string;
        holdMs: number;
        disabled?: boolean;
        variant?: 'default' | 'primary';
    }>(),
    {
        disabled: false,
        variant: 'default',
    },
);

const emit = defineEmits<{
    complete: [];
}>();

const { progress, start, end } = useHoldPress(props.holdMs, () => {
    emit('complete');
});

function onPointerDown() {
    if (props.disabled) return;
    start();
}
</script>

<template>
    <div class="hold">
        <button
            type="button"
            class="hold__button"
            :class="`hold__button--${variant}`"
            :disabled="disabled"
            @contextmenu.prevent
            @pointerdown="onPointerDown"
            @pointerup="end"
            @pointerleave="end"
        >
            <span
                class="hold__fill"
                :style="{ width: `${Math.round(progress * 100)}%` }"
            />
            <!-- 押していない間だけ、満ちていく帯を繰り返し見せて「押し続ける」操作だと伝える。 -->
            <span v-if="!disabled && progress === 0" class="hold__sweep" />
            <span class="hold__label">{{ label }}</span>
            <span class="hold__caption">{{ progress > 0 ? '押 し 続 け ろ' : '長 押 し' }}</span>
        </button>
    </div>
</template>

<style scoped>
.hold {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
}

.hold__button {
    position: relative;
    width: 100%;
    background: none;
    border: 1px solid var(--rr-border-strong);
    color: var(--rr-ink-strong);
    padding: 18px 0 16px;
    font-size: 18px;
    letter-spacing: 0.42em;
    font-weight: 600;
    cursor: pointer;
    overflow: hidden;
    touch-action: none;
    font-family: inherit;
    /* 長押しの間に文字が選択されたり、iOSの拡大鏡・メニューが出たりしないようにする。 */
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
}

.hold__button:disabled {
    color: var(--rr-ink-dim);
    cursor: default;
}

.hold__button--primary {
    border-color: var(--rr-flame-border);
    color: var(--rr-flame-ink);
}

.hold__fill {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: var(--rr-hold-fill);
    pointer-events: none;
}

.hold__button--primary .hold__fill {
    background: var(--rr-hold-fill-primary);
}

.hold__sweep {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 100%;
    background: linear-gradient(90deg, transparent, var(--rr-hold-fill), transparent);
    transform: translateX(-100%);
    animation: rr-hold-sweep 2.2s ease-in-out infinite;
    pointer-events: none;
}

.hold__button--primary .hold__sweep {
    background: linear-gradient(90deg, transparent, var(--rr-hold-fill-primary), transparent);
}

.hold__label {
    position: relative;
    display: block;
}

.hold__caption {
    position: relative;
    display: block;
    margin-top: 8px;
    font-size: 12px;
    font-weight: 400;
    letter-spacing: 0.4em;
    color: var(--rr-gold-bright);
}

.hold__button:disabled .hold__caption {
    color: var(--rr-ink-dim);
}

@keyframes rr-hold-sweep {
    0% {
        transform: translateX(-100%);
    }
    70%,
    100% {
        transform: translateX(100%);
    }
}
</style>
