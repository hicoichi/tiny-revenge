import gsap from 'gsap';

type TweenVars = gsap.TweenVars;

// setInterval的に自身を再スケジュールし続けるループ演出を、呼び出し側で止められるようにするハンドル。
export interface LoopController {
    kill: () => void;
}

// gsap.to()の完了を待てるように、Tween完了時に解決するPromiseへ包む。
function tweenTo(el: gsap.TweenTarget, vars: TweenVars): Promise<void> {
    return new Promise((resolve) => {
        gsap.to(el, { ...vars, onComplete: resolve });
    });
}

// 儀式演出（紙の移動・変形、炎、灰、フェード、カメラ的な移動・ズーム）を GSAP で表現する。
// UI コンポーネントはここに定義した関数を呼び出すだけにし、アニメーションの詳細を持たない。
export function useRitualAnimation() {
    function appearPaper(el: HTMLElement) {
        gsap.set(el, { opacity: 0, y: 40, rotateX: 38, scale: 0.92 });
        return tweenTo(el, {
            opacity: 1,
            y: 0,
            rotateX: 0,
            scale: 1,
            duration: 2.2,
            ease: 'power3.out',
        });
    }

    function fadeInText(el: HTMLElement) {
        return new Promise<void>((resolve) => {
            gsap.fromTo(
                el,
                { opacity: 0 },
                { opacity: 1, duration: 1.8, ease: 'power1.out', onComplete: resolve },
            );
        });
    }

    function raisePaper(el: HTMLElement) {
        return tweenTo(el, {
            y: -58,
            scale: 0.86,
            duration: 2.8,
            ease: 'power2.inOut',
        });
    }

    function detachPaper(el: HTMLElement) {
        return tweenTo(el, {
            y: -14,
            rotate: 3,
            duration: 1.5,
            ease: 'power1.inOut',
        });
    }

    // 紙を炎の根元(anchorEl)へ、左右に揺れる木の葉のようにひらひらと落とす。
    // 実際のDOM座標から必要な移動量を逆算するため、画面サイズが変わっても着地点がずれない。
    function dropPaperInto(el: HTMLElement, anchorEl: HTMLElement) {
        const paperRect = el.getBoundingClientRect();
        const anchorRect = anchorEl.getBoundingClientRect();
        const currentY = Number(gsap.getProperty(el, 'y')) || 0;
        const naturalBottom = paperRect.bottom - currentY;
        const targetY = anchorRect.top - naturalBottom + 14;
        const rand = gsap.utils.random;
        return new Promise<void>((resolve) => {
            gsap.to(el, {
                keyframes: {
                    y: [
                        targetY * 0.08,
                        targetY * 0.22,
                        targetY * 0.4,
                        targetY * 0.58,
                        targetY * 0.76,
                        targetY * 0.9,
                        targetY,
                    ],
                    x: [
                        rand(-16, -8),
                        rand(14, 24),
                        rand(-26, -16),
                        rand(10, 20),
                        rand(-16, -6),
                        rand(4, 10),
                        0,
                    ],
                    rotate: [
                        rand(-20, -12),
                        rand(10, 18),
                        rand(-22, -14),
                        rand(8, 16),
                        rand(-14, -6),
                        rand(-2, 4),
                        -10,
                    ],
                    scale: [0.97, 0.91, 0.86, 0.82, 0.79, 0.77, 0.76],
                },
                duration: 2.2,
                ease: 'power1.in',
                onComplete: resolve,
            });
        });
    }

    // 炎に触れた瞬間の一瞬の明るいフラッシュ。
    function igniteFlash(el: HTMLElement) {
        return new Promise<void>((resolve) => {
            const tl = gsap.timeline({ onComplete: resolve });
            tl.to(el, {
                filter: 'brightness(1.7) saturate(1.4)',
                duration: 0.16,
                ease: 'power1.out',
            });
            tl.to(el, {
                filter: 'brightness(1) saturate(1)',
                duration: 0.5,
                ease: 'power2.in',
            });
        });
    }

    // 「穴が開いて広がっていく」円の中心を、紙の着火点(下端中央)に合わせて初期化する。
    function setBurnOrigin(circleEl: SVGCircleElement, cx: number, cy: number) {
        gsap.set(circleEl, { attr: { cx, cy, r: 0 } });
    }

    // 穴の前線を表す円の半径を広げる。表面(cream)側と炭(char)側で
    // durationMsは共通にし、delayMsをずらすことで「炭の縁」の幅を作る。
    function growBurnFront(
        circleEl: SVGCircleElement,
        maxRadius: number,
        durationMs: number,
        delayMs = 0,
    ) {
        return tweenTo(circleEl, {
            attr: { r: maxRadius },
            duration: durationMs / 1000,
            delay: delayMs / 1000,
            ease: 'power1.in',
        });
    }

    // 熱で紙が反り、縁が波打つような継続ジッター。呼び出し側でkill()して止める。
    function warpPaper(el: HTMLElement) {
        return gsap.to(el, {
            keyframes: [
                { rotate: -10, skewX: 0 },
                { rotate: -8.6, skewX: 1.3 },
                { rotate: -11.3, skewX: -0.9 },
                { rotate: -9.4, skewX: 0.7 },
                { rotate: -10, skewX: 0 },
            ],
            duration: 2.8,
            repeat: -1,
            ease: 'sine.inOut',
        });
    }

    // 燃え進むにつれて紙全体がわずかに縮んでいく。
    function shrinkPaper(el: HTMLElement, targetScale: number, durationMs: number) {
        return gsap.to(el, {
            scale: targetScale,
            duration: durationMs / 1000,
            ease: 'power1.in',
        });
    }

    function fadeOutPaper(el: HTMLElement) {
        return tweenTo(el, { opacity: 0, duration: 0.6 });
    }

    // 保存状態からの復元時など、演出を再生せずに休止状態の見た目へ即座に合わせる。
    function settlePaper(el: HTMLElement, phase: 'ready' | 'raised') {
        if (phase === 'raised') {
            gsap.set(el, { opacity: 1, y: -58, scale: 0.86, rotateX: 0 });
        } else {
            gsap.set(el, { opacity: 1, y: 0, scale: 1, rotateX: 0 });
        }
    }

    // 炎は表示されている間ずっと揺らぎ続けるループアニメーション。完了しないため呼び切りで良い。
    function loopFlame(el: HTMLElement) {
        return gsap.to(el, {
            scaleY: 1.15,
            scaleX: 0.95,
            opacity: 1,
            duration: 1.1,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
        });
    }

    // 炎の勢いを切り替える(待機中は小さく、紙が触れたら大きく)。
    function flareFlame(el: HTMLElement, active: boolean) {
        return gsap.to(el, {
            scale: active ? 1 : 0.55,
            opacity: active ? 1 : 0.72,
            duration: active ? 0.7 : 1,
            ease: active ? 'back.out(2)' : 'power1.out',
        });
    }

    // 炎の「舌」1本を、毎回ランダムな形へ素早く揺らし続ける。
    // 複数本をそれぞれ違うタイミング・速さで動かすことで、荒々しく燃え盛る炎に見せる。
    function loopFlameTongue(el: HTMLElement, seed = 0): LoopController {
        const rand = gsap.utils.random;
        let alive = true;
        let current: gsap.core.Tween | null = null;

        function cycle() {
            if (!alive) return;
            current = gsap.to(el, {
                scaleY: rand(0.5, 1.75),
                scaleX: rand(0.72, 1.3),
                x: rand(-16, 16),
                y: rand(-18, 6),
                rotate: rand(-11, 11),
                opacity: rand(0.75, 1),
                duration: rand(0.22, 0.5),
                ease: 'sine.inOut',
                onComplete: cycle,
            });
        }

        gsap.delayedCall(seed * 0.08, cycle);

        return {
            kill: () => {
                alive = false;
                current?.kill();
            },
        };
    }

    // 炎全体を照らす光を不規則に明滅させ、燃え盛る勢いの余韻を周囲にも感じさせる。
    function loopGlowFlicker(el: HTMLElement, seed = 0): LoopController {
        const rand = gsap.utils.random;
        let alive = true;
        let current: gsap.core.Tween | null = null;

        function cycle() {
            if (!alive) return;
            current = gsap.to(el, {
                opacity: rand(0.55, 1),
                scale: rand(0.85, 1.15),
                duration: rand(0.25, 0.55),
                ease: 'sine.inOut',
                onComplete: cycle,
            });
        }

        gsap.delayedCall(seed * 0.1, cycle);

        return {
            kill: () => {
                alive = false;
                current?.kill();
            },
        };
    }

    // 根元から立ち上る火の粉。上昇しながらランダムに左右へ漂い、消えてはまた現れる。
    function loopEmber(el: HTMLElement, seed = 0): LoopController {
        const rand = gsap.utils.random;
        let alive = true;
        let current: gsap.core.Tween | null = null;

        function cycle() {
            if (!alive) return;
            const startX = rand(-18, 18);
            const midX = startX + rand(-22, 22);
            const endX = midX + rand(-18, 18);
            gsap.set(el, { x: startX, y: 6, opacity: 0, scale: rand(0.6, 1.1) });
            current = gsap.to(el, {
                keyframes: {
                    y: [-30, -120, -230],
                    x: [startX, midX, endX],
                    opacity: [0, 1, 0],
                },
                duration: rand(1.2, 1.9),
                ease: 'power1.out',
                onComplete: cycle,
            });
        }

        gsap.delayedCall(seed * 0.28, cycle);

        return {
            kill: () => {
                alive = false;
                current?.kill();
                gsap.killTweensOf(el);
            },
        };
    }

    function scatterAsh(els: HTMLElement[]) {
        if (els.length === 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
            gsap.to(els, {
                y: -120,
                x: 18,
                opacity: 0,
                duration: 3,
                stagger: 0.25,
                ease: 'power1.out',
                onComplete: resolve,
            });
        });
    }

    return {
        appearPaper,
        fadeInText,
        raisePaper,
        detachPaper,
        dropPaperInto,
        igniteFlash,
        setBurnOrigin,
        growBurnFront,
        warpPaper,
        shrinkPaper,
        fadeOutPaper,
        settlePaper,
        loopFlame,
        flareFlame,
        loopFlameTongue,
        loopGlowFlicker,
        loopEmber,
        scatterAsh,
    };
}
