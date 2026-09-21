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

    // 紙に火が触れた瞬間の一瞬の明るいフラッシュ。
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
                { rotate: 0, skewX: 0 },
                { rotate: 1.4, skewX: 1.3 },
                { rotate: -1.3, skewX: -0.9 },
                { rotate: 0.6, skewX: 0.7 },
                { rotate: 0, skewX: 0 },
            ],
            duration: 2.8,
            repeat: -1,
            ease: 'sine.inOut',
        });
    }

    function fadeOutPaper(el: HTMLElement) {
        return tweenTo(el, { opacity: 0, duration: 0.6 });
    }

    // 保存状態からの復元時など、演出を再生せずに休止状態の見た目へ即座に合わせる。
    function settlePaper(el: HTMLElement) {
        gsap.set(el, { opacity: 1, y: 0, scale: 1, rotateX: 0 });
    }

    // 炎の勢いを power(0=待機 〜 1=燃え盛る)で切り替える。待機中は紙の定位置と重ならない
    // 大きさに抑え、power が上がるほど大きく明るくなる。護摩木をくべる段階的な成長にも使う。
    function flareFlame(el: HTMLElement, power: number) {
        return gsap.to(el, {
            scale: 1.2 + power * 1.2,
            opacity: 0.78 + power * 0.22,
            duration: power > 0 ? 0.8 : 1,
            ease: power > 0 ? 'back.out(2)' : 'power1.out',
        });
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

    // 炉に護摩木がくべられた瞬間に散る火の粉。
    function burstSparks(x: number, y: number) {
        const rand = gsap.utils.random;
        for (let i = 0; i < 9; i += 1) {
            const spark = document.createElement('i');
            Object.assign(spark.style, {
                position: 'fixed',
                left: `${x}px`,
                top: `${y}px`,
                width: '3px',
                height: '3px',
                borderRadius: '50%',
                background: '#ffb14a',
                boxShadow: '0 0 6px #ff7a12',
                pointerEvents: 'none',
                zIndex: '15',
            });
            document.body.appendChild(spark);
            gsap.to(spark, {
                x: rand(-45, 45),
                y: -rand(70, 160),
                opacity: 0,
                duration: rand(0.7, 1.2),
                ease: 'power2.out',
                onComplete: () => spark.remove(),
            });
        }
    }

    // 選んだ護摩木を複製して炉へ飛ばす。元の板は残したまま隠すことで、
    // 選択肢の並びがずれず、飛行中も手札の配置が変わらない。
    function offerGomagi(source: HTMLElement, fireRect: DOMRect): Promise<void> {
        const from = source.getBoundingClientRect();
        const clone = source.cloneNode(true) as HTMLElement;
        // 複製にも配置アニメーション(CSS)が再生されてしまうため、明示的に止める。
        Object.assign(clone.style, {
            position: 'fixed',
            left: `${from.left}px`,
            top: `${from.top}px`,
            width: `${from.width}px`,
            height: `${from.height}px`,
            margin: '0',
            zIndex: '20',
            pointerEvents: 'none',
            animation: 'none',
            transition: 'none',
        });
        document.body.appendChild(clone);
        source.style.visibility = 'hidden';

        const fireX = fireRect.left + fireRect.width / 2;
        const fireY = fireRect.top + fireRect.height / 2;
        const dx = fireX - (from.left + from.width / 2);
        const dy = fireY - (from.top + from.height / 2);

        return new Promise((resolve) => {
            const tl = gsap.timeline({
                onComplete: () => {
                    clone.remove();
                    burstSparks(fireX, fireY);
                    resolve();
                },
            });
            tl.to(clone, { y: -46, scale: 1.1, duration: 0.2, ease: 'power2.out' });
            tl.to(clone, {
                x: dx,
                y: dy,
                rotation: 40,
                scale: 0.35,
                opacity: 0,
                duration: 0.6,
                ease: 'power2.in',
            });
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
        igniteFlash,
        setBurnOrigin,
        growBurnFront,
        warpPaper,
        fadeOutPaper,
        settlePaper,
        flareFlame,
        offerGomagi,
        loopGlowFlicker,
        scatterAsh,
    };
}
