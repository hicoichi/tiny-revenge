import { onBeforeUnmount, onMounted } from 'vue';
import type { Ref } from 'vue';

// 炎・背景の照り返し・紙・床の明滅を、別々のループからでも完全に同期させるため、
// 状態を持たず時刻だけから決まる関数にしている。
// 非整数倍の周波数を重ねているので、単純なsin波1本より不規則で本物の炎の明滅に近い。
export function fireFlicker(seconds: number): number {
    const t = seconds;
    const value =
        0.5 +
        0.22 * Math.sin(t * 6.1 + 0.4) +
        0.14 * Math.sin(t * 13.7 + 0.7) +
        0.09 * Math.sin(t * 27.3 + 0.9) +
        0.08 * Math.sin(t * 3.1 * Math.sin(t * 0.4 + 0.4) + 1.2);
    return Math.min(Math.max(value, 0), 1);
}

// 炎の勢い(power)の変化を、どの描画でも同じ速さでなめらかに追従させる。
export function approachPower(current: number, target: number, dt: number): number {
    return current + (target - current) * Math.min(dt * 2.2, 1);
}

// 周囲が炎に照らされる強さ。待機中の小さな炎でもわずかに照らす。
export function fireLightLevel(power: number, flicker: number): number {
    return (0.2 + 0.8 * power) * (0.7 + 0.6 * flicker);
}

// 炎に照らされる強さを CSS変数 --rr-fire-light として要素に書き込み続ける。
// 子孫のDOM(紙・床・炎の足元の光)はこの変数を参照するだけで、炎と同じ揺らぎで明滅する。
export function useFireLight(target: Ref<HTMLElement | null>, power: () => number) {
    let rafId = 0;
    let lastTime = 0;
    let smoothed = power();

    function frame(now: number) {
        const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
        lastTime = now;
        smoothed = approachPower(smoothed, power(), dt);
        const level = fireLightLevel(smoothed, fireFlicker(now / 1000));
        target.value?.style.setProperty('--rr-fire-light', level.toFixed(3));
        rafId = requestAnimationFrame(frame);
    }

    onMounted(() => {
        rafId = requestAnimationFrame(frame);
    });

    onBeforeUnmount(() => {
        cancelAnimationFrame(rafId);
    });
}
