// 炎をWebGLのシェーダーで描く。ノイズで歪ませた温度場を黒体放射に近い色へ変換することで、
// 炎の内側の渦、ちぎれて昇る炎の舌、白熱した芯から赤い先端への色の変化を表現する。
// 火の粉はCPUで気流(上昇気流+渦)に乗せて動かし、速度に応じた残像の筋として描く。
// 最後に明るい部分をぼかして重ねる(ブルーム)ことで、炎の光が周囲ににじむ。
import { approachPower, fireFlicker } from '~/composables/useFireLight';
import {
    FRAGMENT_PRECISION,
    FULLSCREEN_VERTEX_SHADER,
    SIMPLEX_NOISE_GLSL,
    bindTexture,
    createFullscreenQuad,
    createProgram,
    createRenderTarget,
    drawFullscreenQuad,
    getUniforms,
    prefersReducedMotion,
    releaseContext,
    resizeRenderTarget,
} from '~/utils/webgl';
import type { RenderTarget } from '~/utils/webgl';

// 炎の座標系(CSS px)。RitualFlameの要素の大きさと一致させること。
export const FLAME_BOX_WIDTH = 640;
export const FLAME_BOX_HEIGHT = 760;
// ブルームが炎の根元で水平に切れないよう、canvasを要素の下へこの分だけはみ出させている。
export const FLAME_BASE_PAD = 120;
const CANVAS_BOX_HEIGHT = FLAME_BOX_HEIGHT + FLAME_BASE_PAD;

// 炎の高さと根元の半幅(炎の座標系のpx)。背景の陽炎・照り返しもこの大きさに合わせる。
export function flameHeight(intensity: number): number {
    return 170 + 230 * intensity;
}

export function flameHalfWidth(intensity: number): number {
    return 40 + 44 * intensity;
}

// 炎の根元の画面上の位置(CSS px, ビューポート基準)と、炎の座標系からの表示倍率。
export interface FlameAnchor {
    x: number;
    y: number;
    scale: number;
}

export interface FlameRendererController {
    // 0(待機)〜1(燃え盛る)。勢いが増した瞬間には火の粉が弾ける。
    setIntensity: (value: number) => void;
    kill: () => void;
}

interface QualityProfile {
    maxDpr: number;
    // 最終出力の画素数の上限。燃え盛る炎は画面より大きく拡大されるため、上限がないとスマホで描き切れない。
    maxPixels: number;
    // 炎本体は最終出力より低い解像度で描く。炎の輪郭はもともと柔らかいので差が目立たない。
    flameScale: number;
    detailOctaves: number;
}

const COMPACT_QUALITY: QualityProfile = { maxDpr: 2, maxPixels: 1_300_000, flameScale: 0.55, detailOctaves: 4 };
const WIDE_QUALITY: QualityProfile = { maxDpr: 2, maxPixels: 2_600_000, flameScale: 0.6, detailOctaves: 5 };

function pickQuality(): QualityProfile {
    const isCompact =
        window.matchMedia('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 700;
    return isCompact ? COMPACT_QUALITY : WIDE_QUALITY;
}

const flameFragmentShader = (octaves: number) => `
${FRAGMENT_PRECISION}
varying vec2 vUv;
uniform vec2 uBox;
uniform vec2 uBase;
uniform float uTime;
uniform float uIntensity;
uniform float uHeight;
uniform float uHalfWidth;
uniform float uBrightness;

${SIMPLEX_NOISE_GLSL}

float fbmCoarse(vec3 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 3; i++) {
        sum += amp * snoise(p);
        p = p * 2.03 + vec3(1.7, 9.2, 3.1);
        amp *= 0.5;
    }
    return sum;
}

float fbmDetail(vec3 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < ${octaves}; i++) {
        sum += amp * snoise(p);
        p = p * 2.07 + vec3(5.1, 3.7, 8.3);
        amp *= 0.5;
    }
    return sum;
}

// 温度(0〜1.15)を光の色へ。赤→橙→黄→白と、温度が高いほど短い波長(緑・青)が加わる黒体放射の近似。
vec3 emission(float temp) {
    vec3 color = vec3(1.5 * temp, 1.2 * temp * temp, 0.6 * pow(temp, 5.0));
    return color * smoothstep(0.04, 0.32, temp);
}

void main() {
    vec2 p = vUv * uBox - uBase;
    float H = uHeight;
    float W = uHalfWidth;

    // 炎から十分離れた画素はノイズを計算せずに捨てる(描画範囲の大半を占めるため負荷が大きく下がる)。
    if (abs(p.x) > W * 3.4 || p.y > H * 1.7 || p.y < -W * 1.4) {
        gl_FragColor = vec4(0.0);
        return;
    }

    float t = uTime;
    float rise = clamp(p.y / H, 0.0, 1.7);

    // 周囲の空気に押される、炎全体のゆったりした揺れ。根元は動かず、上ほど大きく振れる。
    float sway = snoise(vec3(t * 0.35, 0.0, 1.7)) * 0.65 + snoise(vec3(t * 1.1, 3.1, 0.2)) * 0.35;

    // 大きな渦で座標そのものを歪ませる(ドメインワーピング)。上昇気流に乗って上へ流れる。
    vec3 warpCoord = vec3(p.x / 90.0, p.y / 115.0 - t * 1.2, t * 0.3);
    vec2 warp = vec2(fbmCoarse(warpCoord), fbmCoarse(warpCoord + vec3(7.3, 2.9, 4.1)));

    vec2 q = p;
    q.x += warp.x * W * (0.55 + 0.35 * uIntensity) * rise + sway * W * 0.55 * rise * rise;
    q.y += warp.y * H * 0.12 * rise;
    float qy = q.y / H;

    // 根元が丸く、先へ行くほど細くなる炎の輪郭。
    float halfWidth = W * mix(1.0, 0.2, smoothstep(0.0, 1.0, qy)) * sqrt(smoothstep(-0.16, 0.06, qy));
    float side = abs(q.x) / max(halfWidth, 0.5);
    float body = smoothstep(1.15, 0.0, side) * smoothstep(-0.14, 0.04, qy) * (1.0 - smoothstep(0.2, 1.1, qy));

    // 細かい乱流で温度を削る。上ほど強く削るので、先端は千切れた炎の舌となって昇りながら消える。
    vec3 detailCoord = vec3(q.x / 34.0, q.y / 42.0 - t * 4.0, t * 0.6);
    float detail = fbmDetail(detailCoord) * 0.5 + 0.5;
    float temp = clamp(body * 1.1 - detail * 0.45 * (0.4 + qy), 0.0, 1.15);

    vec3 color = emission(temp) * uBrightness;

    // 燃えている根元が足元を照らす光。
    vec2 bed = p / vec2(W * 1.8, W * 0.7);
    color += vec3(1.0, 0.42, 0.12) * 0.18 * exp(-dot(bed, bed)) * uBrightness;

    color = 1.0 - exp(-color * 1.35);
    gl_FragColor = vec4(color, 1.0);
}
`;

const EMBER_VERTEX_SHADER = `
attribute vec2 aPosition;
attribute vec3 aLocal;
attribute vec3 aColor;
uniform vec2 uBox;
varying vec3 vLocal;
varying vec3 vColor;
void main() {
    vLocal = aLocal;
    vColor = aColor;
    gl_Position = vec4(aPosition / uBox * 2.0 - 1.0, 0.0, 1.0);
}
`;

// 火の粉1粒を、移動方向へ伸びたカプセル状の光として描く(露光中に動いた分の残像)。
const EMBER_FRAGMENT_SHADER = `
${FRAGMENT_PRECISION}
varying vec3 vLocal;
varying vec3 vColor;
uniform float uGain;
void main() {
    float along = max(abs(vLocal.x) - vLocal.z, 0.0);
    float d2 = along * along + vLocal.y * vLocal.y;
    float light = exp(-d2 * 1.6) + exp(-d2 * 0.35) * 0.18;
    vec3 color = vColor * light * uGain;
    gl_FragColor = vec4(color, max(max(color.r, color.g), color.b));
}
`;

// 4画素を平均しながら縮小する。明るい部分ほど強く残し、ブルームが炎の芯から広がるようにする。
const DOWNSAMPLE_FRAGMENT_SHADER = `
${FRAGMENT_PRECISION}
varying vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uTexel;
void main() {
    vec3 c = texture2D(uSource, vUv + uTexel * vec2(-0.5, -0.5)).rgb
        + texture2D(uSource, vUv + uTexel * vec2(0.5, -0.5)).rgb
        + texture2D(uSource, vUv + uTexel * vec2(-0.5, 0.5)).rgb
        + texture2D(uSource, vUv + uTexel * vec2(0.5, 0.5)).rgb;
    c *= 0.25;
    float luma = dot(c, vec3(0.3, 0.55, 0.15));
    gl_FragColor = vec4(c * (0.35 + 0.9 * luma), 1.0);
}
`;

const BLUR_FRAGMENT_SHADER = `
${FRAGMENT_PRECISION}
varying vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uStep;
void main() {
    vec3 c = texture2D(uSource, vUv).rgb * 0.2270270;
    c += (texture2D(uSource, vUv + uStep).rgb + texture2D(uSource, vUv - uStep).rgb) * 0.1945946;
    c += (texture2D(uSource, vUv + uStep * 2.0).rgb + texture2D(uSource, vUv - uStep * 2.0).rgb) * 0.1216216;
    c += (texture2D(uSource, vUv + uStep * 3.0).rgb + texture2D(uSource, vUv - uStep * 3.0).rgb) * 0.0540541;
    c += (texture2D(uSource, vUv + uStep * 4.0).rgb + texture2D(uSource, vUv - uStep * 4.0).rgb) * 0.0162162;
    gl_FragColor = vec4(c, 1.0);
}
`;

// 炎とブルームを合成してページへ出す。αを色の最大値にすることで、暗い部分は背景が透け、
// 明るい部分ほど光として背景に重なる(加算合成に近い見え方)。
const COMPOSITE_FRAGMENT_SHADER = `
${FRAGMENT_PRECISION}
varying vec2 vUv;
uniform sampler2D uFlame;
uniform sampler2D uBloomNear;
uniform sampler2D uBloomFar;
void main() {
    vec3 color = texture2D(uFlame, vUv).rgb;
    vec3 bloom = texture2D(uBloomNear, vUv).rgb * 0.75 + texture2D(uBloomFar, vUv).rgb * 1.1;
    // canvasの四辺でブルームが直線的に途切れないよう、端に近いほど弱める。
    float edge = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x)
        * smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
    color = min(color + bloom * edge, vec3(1.0));
    gl_FragColor = vec4(color, max(max(color.r, color.g), color.b));
}
`;

interface Ember {
    // 炎の根元を原点とした位置(炎の座標系のpx, 上が正)。
    x: number;
    y: number;
    vx: number;
    vy: number;
    age: number;
    // 冷えていく速さ。温度は temp0 * exp(-age / coolTime) で下がる。
    coolTime: number;
    temp0: number;
    radius: number;
    twinklePhase: number;
    twinkleFreq: number;
}

const MAX_EMBERS = 220;
const FLOATS_PER_VERTEX = 8;
const VERTICES_PER_EMBER = 6;
// 火の粉の筋の長さを決める露光時間(秒)。
const EMBER_SHUTTER = 1 / 30;

function gaussian(): number {
    return (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
}

// 火の粉と同じ温度→色の変換(シェーダーのemissionと露出を揃えている)。
function emberColor(temp: number, gain: number): [number, number, number] {
    const r = 1.5 * temp * gain;
    const g = 1.2 * temp * temp * gain;
    const b = 0.6 * temp ** 5 * gain;
    return [1 - Math.exp(-r * 2), 1 - Math.exp(-g * 2), 1 - Math.exp(-b * 2)];
}

export function useFlameRenderer(canvas: HTMLCanvasElement): FlameRendererController | null {
    const gl = canvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance',
    });
    if (!gl) return null;

    const quality = pickQuality();
    const reducedMotion = prefersReducedMotion();

    const flameProgram = createProgram(gl, FULLSCREEN_VERTEX_SHADER, flameFragmentShader(quality.detailOctaves));
    const emberProgram = createProgram(gl, EMBER_VERTEX_SHADER, EMBER_FRAGMENT_SHADER);
    const downsampleProgram = createProgram(gl, FULLSCREEN_VERTEX_SHADER, DOWNSAMPLE_FRAGMENT_SHADER);
    const blurProgram = createProgram(gl, FULLSCREEN_VERTEX_SHADER, BLUR_FRAGMENT_SHADER);
    const compositeProgram = createProgram(gl, FULLSCREEN_VERTEX_SHADER, COMPOSITE_FRAGMENT_SHADER);
    const quad = createFullscreenQuad(gl);
    const emberBuffer = gl.createBuffer();
    const flameTarget = createRenderTarget(gl);
    const nearTarget = createRenderTarget(gl);
    const nearScratch = createRenderTarget(gl);
    const farTarget = createRenderTarget(gl);
    const farScratch = createRenderTarget(gl);
    if (
        !flameProgram ||
        !emberProgram ||
        !downsampleProgram ||
        !blurProgram ||
        !compositeProgram ||
        !quad ||
        !emberBuffer ||
        !flameTarget ||
        !nearTarget ||
        !nearScratch ||
        !farTarget ||
        !farScratch
    ) {
        releaseContext(gl);
        return null;
    }

    const flameUniforms = getUniforms(gl, flameProgram, [
        'uBox',
        'uBase',
        'uTime',
        'uIntensity',
        'uHeight',
        'uHalfWidth',
        'uBrightness',
    ] as const);
    const emberUniforms = getUniforms(gl, emberProgram, ['uBox', 'uGain'] as const);
    const downsampleUniforms = getUniforms(gl, downsampleProgram, ['uSource', 'uTexel'] as const);
    const blurUniforms = getUniforms(gl, blurProgram, ['uSource', 'uStep'] as const);
    const compositeUniforms = getUniforms(gl, compositeProgram, ['uFlame', 'uBloomNear', 'uBloomFar'] as const);
    const emberAttributes = {
        position: gl.getAttribLocation(emberProgram, 'aPosition'),
        local: gl.getAttribLocation(emberProgram, 'aLocal'),
        color: gl.getAttribLocation(emberProgram, 'aColor'),
    };

    const emberVertices = new Float32Array(MAX_EMBERS * VERTICES_PER_EMBER * FLOATS_PER_VERTEX);
    gl.bindBuffer(gl.ARRAY_BUFFER, emberBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, emberVertices.byteLength, gl.DYNAMIC_DRAW);

    const embers: Ember[] = [];
    let spawnDebt = 0;
    let alive = true;
    let rafId = 0;
    let lastTime = 0;
    let flameTime = Math.random() * 100;
    let intensity = 0;
    let targetIntensity = 0;
    let hasIntensity = false;
    let frameCount = 0;

    // 表示上の大きさ(GSAPによる拡大を含む)に合わせて描画解像度を決める。
    // 毎フレーム作り直すと重いため、一定以上大きさが変わったときだけ確保し直す。
    const syncSize = () => {
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const dpr = Math.min(window.devicePixelRatio || 1, quality.maxDpr);
        let width = rect.width * dpr;
        let height = rect.height * dpr;
        const pixels = width * height;
        if (pixels > quality.maxPixels) {
            const shrink = Math.sqrt(quality.maxPixels / pixels);
            width *= shrink;
            height *= shrink;
        }
        width = Math.max(32, Math.round(width));
        height = Math.max(32, Math.round(height));
        const changed = Math.abs(width - canvas.width) / canvas.width > 0.1;
        if (!changed && flameTarget.width > 1) return;

        canvas.width = width;
        canvas.height = height;
        const flameWidth = width * quality.flameScale;
        const flameHeightPx = height * quality.flameScale;
        resizeRenderTarget(gl, flameTarget, flameWidth, flameHeightPx);
        resizeRenderTarget(gl, nearTarget, flameWidth / 2, flameHeightPx / 2);
        resizeRenderTarget(gl, nearScratch, flameWidth / 2, flameHeightPx / 2);
        resizeRenderTarget(gl, farTarget, flameWidth / 4, flameHeightPx / 4);
        resizeRenderTarget(gl, farScratch, flameWidth / 4, flameHeightPx / 4);
    };

    const spawnEmber = () => {
        if (embers.length >= MAX_EMBERS) return;
        const H = flameHeight(intensity);
        const W = flameHalfWidth(intensity);
        embers.push({
            x: gaussian() * W * 0.45,
            y: H * (0.05 + Math.random() * 0.3),
            vx: gaussian() * 25,
            vy: (60 + Math.random() * 100) * (0.7 + 0.6 * intensity),
            age: 0,
            coolTime: 0.8 + Math.random() * 1.5,
            temp0: 0.9 + Math.random() * 0.3,
            radius: 0.7 + Math.random() * 1.1,
            twinklePhase: Math.random() * Math.PI * 2,
            twinkleFreq: 5 + Math.random() * 13,
        });
    };

    const burst = (count: number) => {
        if (reducedMotion) return;
        for (let i = 0; i < count; i += 1) spawnEmber();
    };

    // 火の粉を運ぶ空気の流れ。炎の真上の強い上昇気流に、渦を足す。
    // 渦はスカラー場ψの回転(curl)として作るので、湧き出しや吸い込みのない自然な流れになる。
    const airVelocity = (x: number, y: number, t: number): [number, number] => {
        const H = flameHeight(intensity);
        const W = flameHalfWidth(intensity);
        const column = Math.exp(-((x / (W * 1.8)) ** 2));
        const updraft = 30 + (110 + 170 * intensity) * column * (1 - smoothstep(0, H * 2.6, y));

        const turbulence = (0.7 + 0.6 * intensity) * (0.5 + Math.min(y / H, 1.5));
        const k1 = 1 / 70;
        const k2 = 1 / 43;
        const a1 = 45 / k1;
        const a2 = 25 / k2;
        const s1x = k1 * x + 1.3 * t;
        const s1y = 0.8 * k1 * y - 2.1 * t;
        const s2x = 0.7 * k2 * x - 1.7 * t + 1.3;
        const s2y = k2 * y - 2.9 * t;
        const dPsiDy = -a1 * Math.sin(s1x) * Math.sin(s1y) * 0.8 * k1 - a2 * Math.sin(s2x) * Math.sin(s2y) * k2;
        const dPsiDx = a1 * Math.cos(s1x) * k1 * Math.cos(s1y) + a2 * Math.cos(s2x) * 0.7 * k2 * Math.cos(s2y);
        return [dPsiDy * turbulence, updraft - dPsiDx * turbulence];
    };

    const updateEmbers = (dt: number, t: number) => {
        if (!reducedMotion) {
            spawnDebt += (1.2 + 14 * intensity) * dt;
            while (spawnDebt >= 1) {
                spawnEmber();
                spawnDebt -= 1;
            }
        }

        for (let i = embers.length - 1; i >= 0; i -= 1) {
            const ember = embers[i]!;
            const [ax, ay] = airVelocity(ember.x, ember.y, t);
            // 小さい粒ほど空気に引きずられやすく、大きい粒ほど慣性と重さで遅れる。
            const follow = Math.min((2.6 / ember.radius) * dt, 1);
            ember.vx += (ax - ember.vx) * follow;
            ember.vy += (ay - ember.vy) * follow - 18 * ember.radius * dt;
            ember.x += ember.vx * dt;
            ember.y += ember.vy * dt;
            ember.age += dt;

            const temp = ember.temp0 * Math.exp(-ember.age / ember.coolTime);
            const outside = Math.abs(ember.x) > FLAME_BOX_WIDTH * 0.47 || ember.y > FLAME_BOX_HEIGHT - 30;
            if (temp < 0.16 || outside) embers.splice(i, 1);
        }
    };

    // 火の粉ごとに、移動方向へ伸ばした四角形(2三角形)の頂点を書き出す。
    const writeEmberVertices = (t: number): number => {
        // 縮小表示(炉の中の炎)でも火の粉が消えないよう、最低でも出力の約1画素の太さを保つ。
        const minRadius = 0.7 * (FLAME_BOX_WIDTH / canvas.width);
        let offset = 0;
        for (const ember of embers) {
            const temp = ember.temp0 * Math.exp(-ember.age / ember.coolTime);
            // 転がりながら飛ぶ火の粉は、向きによって明るさが細かく変わる。
            const twinkle = 0.55 + 0.45 * Math.abs(Math.sin(ember.twinklePhase + t * ember.twinkleFreq));
            const fadeIn = Math.min(ember.age / 0.12, 1);
            const radius = Math.max(ember.radius, minRadius);
            const speed = Math.hypot(ember.vx, ember.vy) || 1;
            const halfLength = speed * EMBER_SHUTTER * 0.5;
            // 筋が長いほど光が広がるので、1画素あたりの明るさは下げる。
            const energy = (twinkle * fadeIn) / (1 + (halfLength / radius) * 0.5);
            const [r, g, b] = emberColor(temp, energy);

            const dirX = ember.vx / speed;
            const dirY = ember.vy / speed;
            const along = halfLength + radius * 2.5;
            const across = radius * 2.5;
            const cx = FLAME_BOX_WIDTH / 2 + ember.x;
            const cy = FLAME_BASE_PAD + ember.y;
            const localLength = halfLength / radius;
            const corners: [number, number][] = [
                [-1, -1],
                [1, -1],
                [-1, 1],
                [-1, 1],
                [1, -1],
                [1, 1],
            ];
            for (const [sa, sc] of corners) {
                emberVertices[offset++] = cx + dirX * along * sa - dirY * across * sc;
                emberVertices[offset++] = cy + dirY * along * sa + dirX * across * sc;
                emberVertices[offset++] = (along / radius) * sa;
                emberVertices[offset++] = 2.5 * sc;
                emberVertices[offset++] = localLength;
                emberVertices[offset++] = r;
                emberVertices[offset++] = g;
                emberVertices[offset++] = b;
            }
        }
        return offset / FLOATS_PER_VERTEX;
    };

    const drawEmbers = (vertexCount: number, gain: number) => {
        if (vertexCount === 0) return;
        const stride = FLOATS_PER_VERTEX * 4;
        gl.useProgram(emberProgram);
        gl.uniform2f(emberUniforms.uBox, FLAME_BOX_WIDTH, CANVAS_BOX_HEIGHT);
        gl.uniform1f(emberUniforms.uGain, gain);
        gl.bindBuffer(gl.ARRAY_BUFFER, emberBuffer);
        gl.enableVertexAttribArray(emberAttributes.position);
        gl.vertexAttribPointer(emberAttributes.position, 2, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(emberAttributes.local);
        gl.vertexAttribPointer(emberAttributes.local, 3, gl.FLOAT, false, stride, 8);
        gl.enableVertexAttribArray(emberAttributes.color);
        gl.vertexAttribPointer(emberAttributes.color, 3, gl.FLOAT, false, stride, 20);
        gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
        gl.disableVertexAttribArray(emberAttributes.local);
        gl.disableVertexAttribArray(emberAttributes.color);
    };

    const renderPass = (program: WebGLProgram, target: RenderTarget | null) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.framebuffer : null);
        gl.viewport(0, 0, target ? target.width : canvas.width, target ? target.height : canvas.height);
        drawFullscreenQuad(gl, program, quad);
    };

    const downsample = (source: RenderTarget, target: RenderTarget) => {
        gl.useProgram(downsampleProgram);
        bindTexture(gl, downsampleUniforms.uSource, source.texture, 0);
        gl.uniform2f(downsampleUniforms.uTexel, 1 / source.width, 1 / source.height);
        renderPass(downsampleProgram, target);
    };

    // 横→縦の2回に分けてぼかす(ガウスぼかしは方向ごとに分けても結果が同じで、計算量が大幅に減る)。
    const blur = (target: RenderTarget, scratch: RenderTarget, spread: number) => {
        gl.useProgram(blurProgram);
        bindTexture(gl, blurUniforms.uSource, target.texture, 0);
        gl.uniform2f(blurUniforms.uStep, spread / target.width, 0);
        renderPass(blurProgram, scratch);
        bindTexture(gl, blurUniforms.uSource, scratch.texture, 0);
        gl.uniform2f(blurUniforms.uStep, 0, spread / target.height);
        renderPass(blurProgram, target);
    };

    const frame = (now: number) => {
        if (!alive) return;
        rafId = requestAnimationFrame(frame);
        if (frameCount % 15 === 0) syncSize();
        frameCount += 1;

        const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
        lastTime = now;
        const seconds = now / 1000;
        intensity = approachPower(intensity, targetIntensity, dt);
        const flicker = fireFlicker(seconds);
        // 勢いが強いほど炎の中の流れも速くなる。経過時間を勢いに応じて進め、ノイズが途中で飛ばないようにする。
        // 長時間動かしても浮動小数点の精度が落ちないよう、十分大きな周期で巻き戻す。
        flameTime = (flameTime + dt * (1 + 0.5 * intensity) * (reducedMotion ? 0.4 : 1)) % 1000;

        updateEmbers(dt, seconds);
        const vertexCount = writeEmberVertices(seconds);
        gl.bindBuffer(gl.ARRAY_BUFFER, emberBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, emberVertices.subarray(0, vertexCount * FLOATS_PER_VERTEX));

        gl.disable(gl.BLEND);
        gl.useProgram(flameProgram);
        gl.uniform2f(flameUniforms.uBox, FLAME_BOX_WIDTH, CANVAS_BOX_HEIGHT);
        gl.uniform2f(flameUniforms.uBase, FLAME_BOX_WIDTH / 2, FLAME_BASE_PAD);
        gl.uniform1f(flameUniforms.uTime, flameTime);
        gl.uniform1f(flameUniforms.uIntensity, intensity);
        gl.uniform1f(flameUniforms.uHeight, flameHeight(intensity) * (0.9 + 0.18 * flicker));
        gl.uniform1f(flameUniforms.uHalfWidth, flameHalfWidth(intensity));
        gl.uniform1f(flameUniforms.uBrightness, (0.85 + 0.3 * flicker) * (0.85 + 0.25 * intensity));
        renderPass(flameProgram, flameTarget);

        // 低解像度の炎にも火の粉を描き込み、ブルームで火の粉の周りにも光をにじませる。
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.viewport(0, 0, flameTarget.width, flameTarget.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, flameTarget.framebuffer);
        drawEmbers(vertexCount, 0.6);
        gl.disable(gl.BLEND);

        downsample(flameTarget, nearTarget);
        blur(nearTarget, nearScratch, 1);
        downsample(nearTarget, farTarget);
        blur(farTarget, farScratch, 1.5);
        blur(farTarget, farScratch, 2.5);

        gl.useProgram(compositeProgram);
        bindTexture(gl, compositeUniforms.uFlame, flameTarget.texture, 0);
        bindTexture(gl, compositeUniforms.uBloomNear, nearTarget.texture, 1);
        bindTexture(gl, compositeUniforms.uBloomFar, farTarget.texture, 2);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        drawFullscreenQuad(gl, compositeProgram, quad);

        // 火の粉の芯は最終解像度でくっきり描く。
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);
        drawEmbers(vertexCount, 1);
        gl.disable(gl.BLEND);
    };

    const onContextLost = (event: Event) => {
        event.preventDefault();
        alive = false;
        cancelAnimationFrame(rafId);
    };

    canvas.addEventListener('webglcontextlost', onContextLost);
    rafId = requestAnimationFrame(frame);

    return {
        setIntensity(value: number) {
            // 初回(復元時など)は火の粉を弾けさせず、その勢いの状態から始める。
            if (!hasIntensity) {
                hasIntensity = true;
                intensity = value;
            } else if (value > targetIntensity + 0.05) {
                burst(Math.round(10 + 50 * (value - targetIntensity)));
            }
            targetIntensity = value;
        },
        kill() {
            alive = false;
            cancelAnimationFrame(rafId);
            canvas.removeEventListener('webglcontextlost', onContextLost);
            releaseContext(gl);
        },
    };
}
