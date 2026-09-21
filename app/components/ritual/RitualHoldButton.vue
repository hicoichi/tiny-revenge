<script setup lang="ts">
import { useHoldPress } from '~/composables/useHoldPress';

const props = withDefaults(
    defineProps<{
        label: string;
        holdMs: number;
        disabled?: boolean;
        variant?: 'default' | 'primary';
        hint?: string;
    }>(),
    {
        disabled: false,
        variant: 'default',
        hint: '',
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
        <p v-if="hint" class="hold__hint">{{ hint }}</p>
        <button
            type="button"
            class="hold__button"
            :class="`hold__button--${variant}`"
            :disabled="disabled"
            @pointerdown="onPointerDown"
            @pointerup="end"
            @pointerleave="end"
        >
            <span
                class="hold__fill"
                :style="{ width: `${Math.round(progress * 100)}%` }"
            />
            <span class="hold__label">{{ label }}</span>
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

.hold__hint {
    margin: 0;
    font-size: 10px;
    letter-spacing: 0.32em;
    color: var(--rr-ink-faint);
}

.hold__button {
    position: relative;
    width: 100%;
    background: none;
    border: 1px solid var(--rr-border-strong);
    color: var(--rr-ink-strong);
    padding: 22px 0;
    font-size: 16px;
    letter-spacing: 0.42em;
    font-weight: 600;
    cursor: pointer;
    overflow: hidden;
    touch-action: none;
    font-family: inherit;
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

.hold__label {
    position: relative;
}
</style>
