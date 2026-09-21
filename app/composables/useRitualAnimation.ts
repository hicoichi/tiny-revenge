import gsap from 'gsap';

type TweenVars = gsap.TweenVars;

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

    // 紙を炎の根元(anchorEl)へ落とす。現在の見た目上の位置に関わらず、
    // 実際のDOM座標から必要な移動量を逆算するため、画面サイズが変わっても着地点がずれない。
    function dropPaperInto(el: HTMLElement, anchorEl: HTMLElement) {
        const paperRect = el.getBoundingClientRect();
        const anchorRect = anchorEl.getBoundingClientRect();
        const currentY = Number(gsap.getProperty(el, 'y')) || 0;
        const naturalBottom = paperRect.bottom - currentY;
        const targetY = anchorRect.top - naturalBottom + 14;
        return tweenTo(el, {
            y: targetY,
            scale: 0.76,
            rotate: -10,
            duration: 1.15,
            ease: 'power2.in',
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
        scatterAsh,
    };
}
