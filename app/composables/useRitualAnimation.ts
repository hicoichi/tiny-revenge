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

// 紙の穴の縁を不規則にするための、位置に固定された滑らかなノイズ(バリューノイズ)。
// 以前はSVGのfeTurbulence+マスクで表現していたが、iOS SafariはCSSのmask:url(#id)を解釈しないため、
// どのブラウザでも動くclip-pathのpath()を毎フレーム計算して作る方式にしている。
function latticeValue(ix: number, iy: number, seed: number): number {
    let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 2147483629);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x: number, y: number, seed: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const top = latticeValue(ix, iy, seed) * (1 - sx) + latticeValue(ix + 1, iy, seed) * sx;
    const bottom = latticeValue(ix, iy + 1, seed) * (1 - sx) + latticeValue(ix + 1, iy + 1, seed) * sx;
    return top * (1 - sy) + bottom * sy;
}

// 穴の縁の凹凸の大きさ(px)。以前のSVGフィルタ(displacement scale 26)と同程度の荒さにしている。
const BURN_EDGE_AMPLITUDE = 22;
const BURN_EDGE_STEPS = 96;
const BURN_EDGE_RAMP_RADIUS = 40;

export interface BurnGeometry {
    width: number;
    height: number;
    originX: number;
    originY: number;
}

// 着火点から半径radiusに広がる不規則な穴を、紙(矩形)からくり抜いたclip-pathを作る。
// 穴は矩形に対して偶奇規則(evenodd)で差し引くため、矩形の外にはみ出した部分は影響しない。
function burnClipPath(geometry: BurnGeometry, radius: number, seed: number): string {
    const { width, height, originX, originY } = geometry;
    const points: string[] = [];
    for (let i = 0; i < BURN_EDGE_STEPS; i += 1) {
        const angle = (i / BURN_EDGE_STEPS) * Math.PI * 2;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        // 空間に固定されたノイズを縁の位置で引くので、穴が広がるにつれて縁が自然に形を変える。
        const px = originX + dx * radius;
        const py = originY + dy * radius;
        const noise = valueNoise(px * 0.035, py * 0.035, seed) * 0.65 + valueNoise(px * 0.09, py * 0.09, seed + 7) * 0.35;
        // 燃え始めの小さな穴が突然大きく開かないよう、半径が小さいうちは凹凸を抑える。
        const amplitude = BURN_EDGE_AMPLITUDE * Math.min(1, radius / BURN_EDGE_RAMP_RADIUS);
        const edge = Math.max(0, radius + (noise - 0.5) * 2 * amplitude);
        points.push(`${(originX + dx * edge).toFixed(1)} ${(originY + dy * edge).toFixed(1)}`);
    }
    return `path(evenodd, "M0 0H${width}V${height}H0Z M${points.join(' L')} Z")`;
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

    // 「穴が開いて広がっていく」前線を表す。表面(cream)側と炭(char)側で
    // durationMsは共通にし、delayMsをずらすことで「炭の縁」の幅を作る。
    function growBurnFront(
        el: HTMLElement,
        geometry: BurnGeometry,
        maxRadius: number,
        durationMs: number,
        delayMs = 0,
        seed = 1,
    ) {
        const state = { radius: 0 };
        return new Promise<void>((resolve) => {
            gsap.to(state, {
                radius: maxRadius,
                duration: durationMs / 1000,
                delay: delayMs / 1000,
                ease: 'power1.in',
                onUpdate: () => {
                    el.style.clipPath = burnClipPath(geometry, state.radius, seed);
                },
                onComplete: resolve,
            });
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
