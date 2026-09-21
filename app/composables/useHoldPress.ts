import { onBeforeUnmount, ref } from 'vue';

// 長押し（ポインタを押し続けて確定する）操作のための汎用ロジック。
// 儀式に限らず使えるため、ドメイン固有の知識は持たない。
export function useHoldPress(durationMs: number, onComplete: () => void) {
    const progress = ref(0);
    let rafId = 0;
    let holding = false;

    function tick(startedAt: number) {
        if (!holding) return;
        const elapsed = performance.now() - startedAt;
        const p = Math.min(1, elapsed / durationMs);
        progress.value = p;
        if (p >= 1) {
            holding = false;
            progress.value = 0;
            onComplete();
            return;
        }
        rafId = requestAnimationFrame(() => tick(startedAt));
    }

    function start() {
        if (holding) return;
        holding = true;
        const startedAt = performance.now();
        rafId = requestAnimationFrame(() => tick(startedAt));
    }

    function end() {
        holding = false;
        cancelAnimationFrame(rafId);
        progress.value = 0;
    }

    onBeforeUnmount(end);

    return { progress, start, end };
}
