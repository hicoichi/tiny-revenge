// CSSの形状アニメーションでは炎内部の乱流やパーティクルの物理的な立ち上りを表現できないため、
// canvasに数十個の火の粉パーティクルを乱流風の揺らぎで飛ばし、加算合成で発光させる方式に切り替える。
// GSAPのTween APIは大量パーティクルの毎フレーム更新には不向きなため、ここだけ独自のrAFループを持つ。

export interface FireParticlesController {
    // 0(待機)〜1(燃え盛る)の勢いをなめらかに切り替える。
    setIntensity: (value: number) => void;
    kill: () => void;
}

interface FlameParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    age: number;
    maxLife: number;
    size: number;
    wobbleSeed: number;
    wobbleFreq: number;
}

const PARTICLE_COUNT = 150;
const GRAVITY_LIFT = 34; // 上昇気流による加速(px/s^2)

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

// 寿命(1=生まれたて 〜 0=消える直前)に応じて 白熱 → 黄 → 橙 → 赤 → 煙 へ色を遷移させる。
const COLOR_STOPS: [number, number, number, number][] = [
    [1, 255, 252, 235],
    [0.75, 255, 214, 110],
    [0.5, 255, 150, 40],
    [0.28, 235, 70, 20],
    [0.1, 120, 40, 24],
    [0, 40, 20, 16],
];

// 非整数倍の周波数を重ねたゆらぎ。単純なsin波1本より不規則で、本物の炎の明滅に近い。
function flicker(t: number, seed: number): number {
    return (
        0.5 +
        0.22 * Math.sin(t * 6.1 + seed) +
        0.14 * Math.sin(t * 13.7 + seed * 1.7) +
        0.09 * Math.sin(t * 27.3 + seed * 2.3) +
        0.08 * Math.sin(t * 3.1 * Math.sin(t * 0.4 + seed) + seed * 3.1)
    );
}

// 炎の根元に、実際の燃焼強度と不規則な明滅に連動する光源を描く。
// CSS側の一定パターンな明滅ではなく、炎そのものが放つ光として一体化させる。
function drawGlow(
    ctx: CanvasRenderingContext2D,
    t: number,
    intensity: number,
    width: number,
    height: number,
) {
    const baseX = width / 2;
    const baseY = height - 4;
    // キャンバスの端で円が四角く切り取られないよう、半径は常に短辺の範囲内に収める。
    const safeMax = Math.min(width, height) * 0.48;

    const outerFlicker = flicker(t, 0.4);
    const outerRadius = Math.min(
        (width * 0.34 + intensity * width * 0.22) * (0.82 + outerFlicker * 0.36),
        safeMax,
    );
    const outerAlpha = (0.32 + intensity * 0.4) * (0.7 + outerFlicker * 0.5);
    const outer = ctx.createRadialGradient(baseX, baseY, 0, baseX, baseY, outerRadius);
    outer.addColorStop(0, `rgba(255,140,50,${outerAlpha})`);
    outer.addColorStop(0.55, `rgba(255,90,20,${outerAlpha * 0.45})`);
    outer.addColorStop(1, 'rgba(255,70,10,0)');
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.arc(baseX, baseY, outerRadius, 0, Math.PI * 2);
    ctx.fill();

    const innerFlicker = flicker(t, 5.2);
    const innerRadius = Math.min(
        (width * 0.16 + intensity * width * 0.12) * (0.8 + innerFlicker * 0.5),
        safeMax * 0.6,
    );
    const innerAlpha = (0.55 + intensity * 0.35) * (0.65 + innerFlicker * 0.6);
    const inner = ctx.createRadialGradient(baseX, baseY, 0, baseX, baseY, innerRadius);
    inner.addColorStop(0, `rgba(255,230,150,${innerAlpha})`);
    inner.addColorStop(0.6, `rgba(255,160,60,${innerAlpha * 0.5})`);
    inner.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(baseX, baseY, innerRadius, 0, Math.PI * 2);
    ctx.fill();
}

function particleColor(life: number): string {
    for (let i = 0; i < COLOR_STOPS.length - 1; i += 1) {
        const hi = COLOR_STOPS[i]!;
        const lo = COLOR_STOPS[i + 1]!;
        if (life <= hi[0] && life >= lo[0]) {
            const t = (life - lo[0]) / (hi[0] - lo[0] || 1);
            const r = Math.round(lerp(lo[1], hi[1], t));
            const g = Math.round(lerp(lo[2], hi[2], t));
            const b = Math.round(lerp(lo[3], hi[3], t));
            return `${r},${g},${b}`;
        }
    }
    return '40,20,16';
}

export function useFireParticles(canvas: HTMLCanvasElement): FireParticlesController {
    const ctx = canvas.getContext('2d');

    const width = canvas.clientWidth || 200;
    const height = canvas.clientHeight || 300;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx?.scale(dpr, dpr);

    let alive = true;
    let intensity = 0;
    let targetIntensity = 0;
    let rafId = 0;
    let lastTime = performance.now();

    function spawn(p: FlameParticle) {
        const spread = 26 + intensity * 40;
        p.x = width / 2 + (Math.random() - 0.5) * spread;
        p.y = height - Math.random() * 6;
        p.vx = (Math.random() - 0.5) * 20;
        p.vy = -(55 + Math.random() * 45 + intensity * 110);
        p.maxLife = 0.75 + Math.random() * 0.5 + intensity * 0.4;
        p.age = 0;
        p.size = (24 + Math.random() * 28) * (0.8 + intensity * 0.6);
        p.wobbleSeed = Math.random() * Math.PI * 2;
        p.wobbleFreq = 1.4 + Math.random() * 2.4;
    }

    const particles: FlameParticle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
        const p: FlameParticle = {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            age: 0,
            maxLife: 1,
            size: 0,
            wobbleSeed: 0,
            wobbleFreq: 0,
        };
        spawn(p);
        // 初期配置を寿命上でばらけさせ、起動直後から炎が満ちているように見せる。
        p.age = Math.random() * p.maxLife;
        particles.push(p);
    }

    function frame(now: number) {
        if (!alive || !ctx) return;
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        intensity += (targetIntensity - intensity) * Math.min(dt * 2.2, 1);

        ctx.clearRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'lighter';

        const t = now / 1000;
        drawGlow(ctx, t, intensity, width, height);

        for (const p of particles) {
            p.age += dt;
            if (p.age >= p.maxLife) {
                spawn(p);
                continue;
            }
            const life = 1 - p.age / p.maxLife;
            const wobble = Math.sin(t * p.wobbleFreq + p.wobbleSeed) * (4 + (1 - life) * 10);
            p.x += (p.vx + wobble) * dt;
            p.y += p.vy * dt;
            p.vy -= GRAVITY_LIFT * dt;

            const size = Math.max(p.size * life, 0.4);
            const rgb = particleColor(life);
            const alpha = Math.min(life * 1.4, 1) * (0.55 + intensity * 0.45);

            const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
            gradient.addColorStop(0, `rgba(${rgb},${alpha})`);
            gradient.addColorStop(1, `rgba(${rgb},0)`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
            ctx.fill();
        }

        rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    return {
        setIntensity(value: number) {
            targetIntensity = value;
        },
        kill() {
            alive = false;
            cancelAnimationFrame(rafId);
        },
    };
}
