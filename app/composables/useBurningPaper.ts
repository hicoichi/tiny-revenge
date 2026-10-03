// 紙が燃える様子をWebGLで描く。紙の各点に「火が届く時刻」を前もって決めておき、
// 進行度(progress)との差から、その点が今どの段階にあるかを決める。
//   熱で黄ばみ茶色く焦げる → 燃えている縁が細く明るく揺らぐ → 黒い炭になり残り火が冷えていく → 炭が崩れて穴が開く
// 燃えている縁からは炎の舌と煙が立ち昇り、火の粉と灰の欠片が剥がれて舞う。
// 炭になった部分は反り返るので、紙は細かい格子(メッシュ)として描き、頂点ごとに持ち上げる。
import { fireFlicker, fireLightLevel } from '~/composables/useFireLight';
import { valueNoise } from '~/utils/noise';
import type { PaperSnapshot } from '~/utils/paperSnapshot';
import {
    FRAGMENT_PRECISION,
    FULLSCREEN_VERTEX_SHADER,
    SIMPLEX_NOISE_GLSL,
    bindTexture,
    createFullscreenQuad,
    createProgram,
    createTexture,
    drawFullscreenQuad,
    getUniforms,
    prefersReducedMotion,
    releaseContext,
} from '~/utils/webgl';

// 炎や煙、舞い上がる灰が紙の外へはみ出して描けるよう、canvasを紙より広げる量(CSS px)。
export const BURN_CANVAS_MARGIN = { top: 200, side: 90, bottom: 70 };
// 進行度がこの値に達すると、紙のすべての点が燃え尽きて穴になる。
export const BURN_PROGRESS_END = 1.5;

// 「火が届く時刻」をテクスチャへ詰めるときの範囲(8bitに収めるため)。
const ARRIVAL_MIN = -0.25;
const ARRIVAL_SPAN = 1.6;
// 火が届く時刻を計算する格子の間隔(px)。間は線形補間し、細かな凹凸はシェーダーのノイズで足す。
const GRID_STEP = 4;
const MESH_COLUMNS = 36;
const MESH_ROWS = 46;
const MAX_PARTICLES = 320;
const FLOATS_PER_PARTICLE_VERTEX = 9;

// 燃えている縁より、炭の範囲(この幅だけ進行度が進むと炭が崩れ始める)。
const HOLE_BASE = 0.16;
const HOLE_VARIATION = 0.1;

export interface BurningPaperController {
    // 0(着火)〜BURN_PROGRESS_END(燃え尽き)。
    setProgress: (value: number) => void;
    kill: () => void;
}

interface Particle {
    kind: 'ember' | 'ash';
    x: number;
    y: number;
    vx: number;
    vy: number;
    age: number;
    life: number;
    size: number;
    angle: number;
    spin: number;
    flip: number;
    flipSpeed: number;
    shade: number;
    seed: number;
}

const GLSL_EMISSION = `
// 温度(0〜1.15)を光の色へ。炎(useFlameRenderer)と同じ黒体放射の近似。
vec3 emission(float temp) {
    vec3 color = vec3(1.5 * temp, 1.2 * temp * temp, 0.6 * pow(temp, 5.0));
    return color * smoothstep(0.04, 0.32, temp);
}
`;

const GLSL_ARRIVAL = `
uniform sampler2D uArrival;
uniform vec2 uPaperSize;
float arrival(vec2 paperPx) {
    return texture2D(uArrival, paperPx / uPaperSize).r * ${ARRIVAL_SPAN.toFixed(3)} + ${ARRIVAL_MIN.toFixed(3)};
}
float insidePaper(vec2 paperPx) {
    vec2 uv = paperPx / uPaperSize;
    return step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
}
`;

// 紙の影。上の紙が燃えて穴が開いた部分には影を落とさない。
const SHADOW_FRAGMENT_SHADER = `
${FRAGMENT_PRECISION}
varying vec2 vUv;
uniform vec2 uCanvas;
uniform vec2 uPaperOrigin;
uniform float uProgress;
${GLSL_ARRIVAL}
void main() {
    vec2 canvasPx = vec2(vUv.x, 1.0 - vUv.y) * uCanvas;
    vec2 caster = canvasPx - uPaperOrigin - vec2(0.0, 22.0);
    vec2 q = abs(caster - uPaperSize * 0.5) - uPaperSize * 0.5;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    float shadow = 0.6 * (1.0 - smoothstep(-24.0, 34.0, d));
    vec2 clamped = clamp(caster, vec2(0.0), uPaperSize);
    float hole = smoothstep(${HOLE_BASE.toFixed(3)}, ${(HOLE_BASE + HOLE_VARIATION).toFixed(3)}, uProgress - arrival(clamped));
    float a = shadow * (1.0 - hole);
    gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}
`;

const PAPER_VERTEX_SHADER = `
attribute vec2 aPosition;
attribute vec2 aUv;
attribute float aShade;
uniform vec2 uCanvas;
varying vec2 vUv;
varying float vShade;
void main() {
    vUv = aUv;
    vShade = aShade;
    gl_Position = vec4(aPosition.x / uCanvas.x * 2.0 - 1.0, 1.0 - aPosition.y / uCanvas.y * 2.0, 0.0, 1.0);
}
`;

const PAPER_FRAGMENT_SHADER = `
${FRAGMENT_PRECISION}
varying vec2 vUv;
varying float vShade;
uniform sampler2D uPaper;
uniform float uProgress;
uniform float uTime;
uniform float uLight;
${GLSL_ARRIVAL}
${SIMPLEX_NOISE_GLSL}
void main() {
    vec2 paperPx = vUv * uPaperSize;
    vec4 arrivalSample = texture2D(uArrival, vUv);
    float charVariation = arrivalSample.g;
    // 格子の補間だけでは縁が滑らかすぎるため、細かな凹凸を足して縁をギザギザにする。
    float fine = snoise(vec3(paperPx / 9.0, 3.1)) * 0.5 + snoise(vec3(paperPx / 3.5, 7.7)) * 0.25;
    float local = uProgress - arrival(paperPx) - fine * 0.02;

    vec3 color = texture2D(uPaper, vUv).rgb;

    // 熱による焦げ: 黄ばみ → 茶色 → 焦げ茶。
    float scorch = smoothstep(-0.15, -0.004, local);
    color = mix(color, color * vec3(0.8, 0.62, 0.38), smoothstep(0.0, 0.55, scorch));
    color = mix(color, vec3(0.2, 0.11, 0.05), smoothstep(0.55, 1.0, scorch));

    // 炭。わずかなむらを付けて、一様な黒に見えないようにする。
    float charred = smoothstep(-0.004, 0.014, local);
    color = mix(color, vec3(0.04, 0.034, 0.03) + 0.035 * charVariation, charred);

    // 縁の手前で灰色に白っぽくなり、そこから崩れて穴が開く。
    float holeAt = ${HOLE_BASE.toFixed(3)} + charVariation * ${HOLE_VARIATION.toFixed(3)};
    color = mix(color, vec3(0.3, 0.29, 0.27), smoothstep(holeAt - 0.06, holeAt - 0.012, local) * 0.55);
    float alpha = 1.0 - smoothstep(holeAt - 0.012, holeAt, local);

    // 下の炎に照らされ、反り返った面ほど明るさが変わる。
    color *= vShade;
    color += color * vec3(1.0, 0.5, 0.18) * uLight * (0.35 + 0.65 * vUv.y);

    // 燃えている縁: 細く明るく、揺らぎながら光る。
    float edge = exp(-pow((local - 0.004) / 0.011, 2.0));
    float edgeFlicker = 0.65 + 0.35 * snoise(vec3(paperPx / 18.0, uTime * 4.0));
    // 炭の中で点々と残る火が、時間とともに冷えて消えていく。
    float cooling = charred * (1.0 - smoothstep(0.0, holeAt, local));
    float speck = smoothstep(0.62, 0.9, snoise(vec3(paperPx / 4.5, uTime * 0.7)) * 0.5 + 0.5);
    vec3 glow = vec3(1.0, 0.62, 0.2) * edge * 1.7 * edgeFlicker + vec3(1.0, 0.32, 0.06) * cooling * speck * 1.2;
    color += glow;

    color = min(color, vec3(1.0));
    gl_FragColor = vec4(color * alpha, alpha);
}
`;

// 燃えている縁から立ち昇る炎と煙。各画素から真下(紙の上では燃えている縁がある側)を何点か覗き、
// 近くに燃えている縁があれば、そこから昇ってきた炎として光らせる。
const FLAME_FRAGMENT_SHADER = `
${FRAGMENT_PRECISION}
varying vec2 vUv;
uniform vec2 uCanvas;
uniform vec2 uPaperOrigin;
uniform vec2 uIgnition;
uniform float uProgress;
uniform float uTime;
uniform float uSmoke;
${GLSL_ARRIVAL}
${SIMPLEX_NOISE_GLSL}
${GLSL_EMISSION}

float burning(vec2 paperPx) {
    float local = uProgress - arrival(paperPx);
    return exp(-pow((local - 0.03) / 0.05, 2.0)) * insidePaper(paperPx);
}

void main() {
    vec2 canvasPx = vec2(vUv.x, 1.0 - vUv.y) * uCanvas;
    vec2 paperPx = canvasPx - uPaperOrigin;
    float sway = snoise(vec3(canvasPx.x / 70.0, uTime * 0.7, 0.0)) * 7.0;

    float flame = 0.0;
    for (int i = 0; i < 7; i++) {
        float step = float(i) * 9.0;
        vec2 below = paperPx + vec2(sway * step / 54.0, step);
        flame = max(flame, burning(below) * exp(-step / 30.0));
    }
    float smoke = 0.0;
    for (int i = 1; i < 7; i++) {
        float step = float(i) * 30.0;
        vec2 below = paperPx + vec2(sway * step / 60.0, step);
        smoke = max(smoke, burning(below) * exp(-step / 120.0));
    }

    // 上へ流れるノイズで削り、炎を舌の形に千切る。
    float n1 = snoise(vec3(canvasPx.x / 16.0, canvasPx.y / 20.0 + uTime * 3.4, uTime * 0.9)) * 0.5 + 0.5;
    float n2 = snoise(vec3(canvasPx.x / 7.0, canvasPx.y / 9.0 + uTime * 5.0, uTime * 1.4)) * 0.5 + 0.5;
    float temp = clamp(flame * 1.3 - (n1 * 0.55 + n2 * 0.22), 0.0, 1.1);
    vec3 color = emission(temp);

    // 着火の瞬間、火が触れた一点がまぶしく光り、広がりながら炎に引き継がれる。
    float ignite = smoothstep(0.0, 0.02, uProgress) * (1.0 - smoothstep(0.04, 0.22, uProgress));
    color += vec3(1.0, 0.62, 0.22) * exp(-length(paperPx - uIgnition) / (14.0 + 90.0 * uProgress)) * ignite * 1.4;

    color = 1.0 - exp(-color * 1.35);
    float light = max(max(color.r, color.g), color.b);

    float smokeShape = smoothstep(0.38, 0.85, snoise(vec3(canvasPx.x / 38.0, canvasPx.y / 48.0 + uTime * 0.9, uTime * 0.3)) * 0.5 + 0.5);
    float smokeAlpha = smoke * smokeShape * 0.24 * uSmoke * (1.0 - light);
    // 冷たい灰色にすると、穴の向こうの炎に重なったとき黄色が緑がかって濁るため、炎に照らされた暖かい暗色にする。
    vec3 smokeColor = vec3(0.3, 0.25, 0.21);

    gl_FragColor = vec4(color + smokeColor * smokeAlpha, light + smokeAlpha);
}
`;

const PARTICLE_VERTEX_SHADER = `
attribute vec2 aPosition;
attribute vec2 aLocal;
attribute vec4 aColor;
attribute float aKind;
uniform vec2 uCanvas;
varying vec2 vLocal;
varying vec4 vColor;
varying float vKind;
void main() {
    vLocal = aLocal;
    vColor = aColor;
    vKind = aKind;
    gl_Position = vec4(aPosition.x / uCanvas.x * 2.0 - 1.0, 1.0 - aPosition.y / uCanvas.y * 2.0, 0.0, 1.0);
}
`;

// 火の粉は丸い光、灰は縁が不規則な薄片として描く。
const PARTICLE_FRAGMENT_SHADER = `
${FRAGMENT_PRECISION}
varying vec2 vLocal;
varying vec4 vColor;
varying float vKind;
void main() {
    float d2 = dot(vLocal, vLocal);
    if (vKind < 0.5) {
        vec3 light = vColor.rgb * (exp(-d2 * 2.2) + exp(-d2 * 0.5) * 0.15);
        gl_FragColor = vec4(light, max(max(light.r, light.g), light.b));
        return;
    }
    // 灰: vKindの小数部を形の種にし、縁が不規則な薄片にする。vColor.aはフェード。
    float seed = vKind - 1.0;
    float angle = atan(vLocal.y, vLocal.x);
    float radius = 0.75 + 0.18 * sin(angle * 3.0 + seed * 20.0) + 0.1 * sin(angle * 5.0 - seed * 13.0);
    float alpha = (1.0 - smoothstep(radius - 0.12, radius, sqrt(d2))) * 0.92 * vColor.a;
    gl_FragColor = vec4(vColor.rgb * alpha, alpha);
}
`;

function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
}

function emberColor(temp: number, gain: number): [number, number, number] {
    const r = 1.5 * temp * gain;
    const g = 1.2 * temp * temp * gain;
    const b = 0.6 * temp ** 5 * gain;
    return [1 - Math.exp(-r * 2), 1 - Math.exp(-g * 2), 1 - Math.exp(-b * 2)];
}

// 紙の各点に火が届く時刻を、格子状に計算する。着火点からの距離が基本で、
// 熱は上へ昇るので上方向へは速く、下方向へは遅く燃え広がる。ノイズで前線を不規則に乱す。
function computeArrivalGrid(width: number, height: number, ignitionX: number, ignitionY: number) {
    const columns = Math.ceil(width / GRID_STEP) + 1;
    const rows = Math.ceil(height / GRID_STEP) + 1;
    const arrival = new Float32Array(columns * rows);
    const variation = new Float32Array(columns * rows);
    const weighted = (x: number, y: number) => {
        const dy = y - ignitionY;
        return Math.hypot(x - ignitionX, dy * (dy < 0 ? 0.8 : 1.5));
    };
    const maxDistance = Math.max(weighted(0, 0), weighted(width, 0), weighted(0, height), weighted(width, height));
    for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
            const x = column * GRID_STEP;
            const y = row * GRID_STEP;
            const noise = valueNoise(x * 0.018, y * 0.018, 11) * 0.65 + valueNoise(x * 0.05, y * 0.05, 23) * 0.35;
            const index = row * columns + column;
            arrival[index] = weighted(x, y) / maxDistance + (noise - 0.5) * 0.35;
            variation[index] = valueNoise(x * 0.08, y * 0.08, 37);
        }
    }
    return { columns, rows, arrival, variation };
}

export function useBurningPaper(canvas: HTMLCanvasElement, snapshot: PaperSnapshot): BurningPaperController | null {
    const gl = canvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: true,
        depth: false,
        stencil: false,
    });
    if (!gl) return null;

    const paperWidth = snapshot.width;
    const paperHeight = snapshot.height;
    const canvasWidth = paperWidth + BURN_CANVAS_MARGIN.side * 2;
    const canvasHeight = paperHeight + BURN_CANVAS_MARGIN.top + BURN_CANVAS_MARGIN.bottom;
    const originX = BURN_CANVAS_MARGIN.side;
    const originY = BURN_CANVAS_MARGIN.top;
    // 下の炎が触れる、紙の下端中央から燃え始める。
    const ignitionX = paperWidth / 2;
    const ignitionY = paperHeight * 0.94;
    const reducedMotion = prefersReducedMotion();

    Object.assign(canvas.style, {
        left: `${-BURN_CANVAS_MARGIN.side}px`,
        top: `${-BURN_CANVAS_MARGIN.top}px`,
        width: `${canvasWidth}px`,
        height: `${canvasHeight}px`,
    });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const shrink = Math.min(1, Math.sqrt(1_600_000 / (canvasWidth * canvasHeight * dpr * dpr)));
    canvas.width = Math.round(canvasWidth * dpr * shrink);
    canvas.height = Math.round(canvasHeight * dpr * shrink);

    const shadowProgram = createProgram(gl, FULLSCREEN_VERTEX_SHADER, SHADOW_FRAGMENT_SHADER);
    const paperProgram = createProgram(gl, PAPER_VERTEX_SHADER, PAPER_FRAGMENT_SHADER);
    const flameProgram = createProgram(gl, FULLSCREEN_VERTEX_SHADER, FLAME_FRAGMENT_SHADER);
    const particleProgram = createProgram(gl, PARTICLE_VERTEX_SHADER, PARTICLE_FRAGMENT_SHADER);
    const quad = createFullscreenQuad(gl);
    const paperTexture = createTexture(gl);
    const arrivalTexture = createTexture(gl);
    const meshBuffer = gl.createBuffer();
    const meshIndexBuffer = gl.createBuffer();
    const particleBuffer = gl.createBuffer();
    if (
        !shadowProgram ||
        !paperProgram ||
        !flameProgram ||
        !particleProgram ||
        !quad ||
        !paperTexture ||
        !arrivalTexture ||
        !meshBuffer ||
        !meshIndexBuffer ||
        !particleBuffer
    ) {
        releaseContext(gl);
        return null;
    }

    const shadowUniforms = getUniforms(gl, shadowProgram, [
        'uCanvas',
        'uPaperOrigin',
        'uProgress',
        'uArrival',
        'uPaperSize',
    ] as const);
    const paperUniforms = getUniforms(gl, paperProgram, [
        'uCanvas',
        'uPaper',
        'uArrival',
        'uPaperSize',
        'uProgress',
        'uTime',
        'uLight',
    ] as const);
    const flameUniforms = getUniforms(gl, flameProgram, [
        'uCanvas',
        'uPaperOrigin',
        'uIgnition',
        'uProgress',
        'uTime',
        'uSmoke',
        'uArrival',
        'uPaperSize',
    ] as const);
    const particleUniforms = getUniforms(gl, particleProgram, ['uCanvas'] as const);

    gl.bindTexture(gl.TEXTURE_2D, paperTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, snapshot.canvas);

    const grid = computeArrivalGrid(paperWidth, paperHeight, ignitionX, ignitionY);
    const arrivalPixels = new Uint8Array(grid.columns * grid.rows * 4);
    for (let i = 0; i < grid.arrival.length; i += 1) {
        const normalized = (grid.arrival[i]! - ARRIVAL_MIN) / ARRIVAL_SPAN;
        arrivalPixels[i * 4] = Math.round(Math.min(Math.max(normalized, 0), 1) * 255);
        arrivalPixels[i * 4 + 1] = Math.round(grid.variation[i]! * 255);
        arrivalPixels[i * 4 + 3] = 255;
    }
    gl.bindTexture(gl.TEXTURE_2D, arrivalTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, grid.columns, grid.rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, arrivalPixels);

    // 格子の値を、紙の座標(px)で補間して引く。
    const sampleGrid = (values: Float32Array, x: number, y: number): number => {
        const gx = Math.min(Math.max(x / GRID_STEP, 0), grid.columns - 1.001);
        const gy = Math.min(Math.max(y / GRID_STEP, 0), grid.rows - 1.001);
        const ix = Math.floor(gx);
        const iy = Math.floor(gy);
        const fx = gx - ix;
        const fy = gy - iy;
        const i = iy * grid.columns + ix;
        const top = values[i]! * (1 - fx) + values[i + 1]! * fx;
        const bottom = values[i + grid.columns]! * (1 - fx) + values[i + grid.columns + 1]! * fx;
        return top * (1 - fy) + bottom * fy;
    };

    // 紙のメッシュ。頂点ごとの反り返りの大きさのばらつきは、あらかじめ決めておく。
    const vertexCount = (MESH_COLUMNS + 1) * (MESH_ROWS + 1);
    const meshVertices = new Float32Array(vertexCount * 5);
    const meshLift = new Float32Array(vertexCount);
    const meshCurl = new Float32Array(vertexCount);
    for (let row = 0; row <= MESH_ROWS; row += 1) {
        for (let column = 0; column <= MESH_COLUMNS; column += 1) {
            const i = row * (MESH_COLUMNS + 1) + column;
            meshCurl[i] = 0.55 + 0.9 * valueNoise(column * 0.35, row * 0.35, 51);
        }
    }
    const meshIndices = new Uint16Array(MESH_COLUMNS * MESH_ROWS * 6);
    let indexOffset = 0;
    for (let row = 0; row < MESH_ROWS; row += 1) {
        for (let column = 0; column < MESH_COLUMNS; column += 1) {
            const a = row * (MESH_COLUMNS + 1) + column;
            const b = a + 1;
            const c = a + MESH_COLUMNS + 1;
            const d = c + 1;
            meshIndices.set([a, c, b, b, c, d], indexOffset);
            indexOffset += 6;
        }
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, meshIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, meshIndices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, meshBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, meshVertices.byteLength, gl.DYNAMIC_DRAW);

    const particles: Particle[] = [];
    const particleVertices = new Float32Array(MAX_PARTICLES * 6 * FLOATS_PER_PARTICLE_VERTEX);
    gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, particleVertices.byteLength, gl.DYNAMIC_DRAW);

    let progress = 0;
    let alive = true;
    let rafId = 0;
    let lastTime = 0;

    // 炭が反り返る。燃えた部分ほど手前へ持ち上がり、遠近法で少しずれて見える。
    // 持ち上がった量の傾きから、炎(下)の側を向いた面を明るく、反対側を暗くする。
    const updateMesh = () => {
        const perspective = 700;
        const centerX = originX + paperWidth / 2;
        const centerY = originY + paperHeight / 2;
        for (let row = 0; row <= MESH_ROWS; row += 1) {
            for (let column = 0; column <= MESH_COLUMNS; column += 1) {
                const i = row * (MESH_COLUMNS + 1) + column;
                const x = (column / MESH_COLUMNS) * paperWidth;
                const y = (row / MESH_ROWS) * paperHeight;
                const local = progress - sampleGrid(grid.arrival, x, y);
                const charred = smoothstep(0, HOLE_BASE, local);
                const heat = smoothstep(-0.12, 0, local);
                meshLift[i] = (charred * charred * 30 + heat * 4) * meshCurl[i]!;
            }
        }
        for (let row = 0; row <= MESH_ROWS; row += 1) {
            for (let column = 0; column <= MESH_COLUMNS; column += 1) {
                const i = row * (MESH_COLUMNS + 1) + column;
                const lift = meshLift[i]!;
                const x = originX + (column / MESH_COLUMNS) * paperWidth;
                const y = originY + (row / MESH_ROWS) * paperHeight;
                const scale = perspective / (perspective - lift);
                const left = meshLift[i - (column > 0 ? 1 : 0)]!;
                const right = meshLift[i + (column < MESH_COLUMNS ? 1 : 0)]!;
                const up = meshLift[i - (row > 0 ? MESH_COLUMNS + 1 : 0)]!;
                const down = meshLift[i + (row < MESH_ROWS ? MESH_COLUMNS + 1 : 0)]!;
                const slopeX = (right - left) / ((paperWidth / MESH_COLUMNS) * 2);
                const slopeY = (down - up) / ((paperHeight / MESH_ROWS) * 2);
                const offset = i * 5;
                meshVertices[offset] = centerX + (x - centerX) * scale;
                meshVertices[offset + 1] = centerY + (y - centerY) * scale - lift * 0.25;
                meshVertices[offset + 2] = column / MESH_COLUMNS;
                meshVertices[offset + 3] = row / MESH_ROWS;
                meshVertices[offset + 4] = Math.min(Math.max(1 - slopeY * 0.9 + slopeX * 0.25, 0.55), 1.25);
            }
        }
    };

    // 燃えている縁、または崩れかけた炭の上の点を、ランダムに探す。
    const findPoint = (minLocal: number, maxLocal: number): [number, number] | null => {
        for (let attempt = 0; attempt < 24; attempt += 1) {
            const x = Math.random() * paperWidth;
            const y = Math.random() * paperHeight;
            const local = progress - sampleGrid(grid.arrival, x, y);
            if (local >= minLocal && local <= maxLocal) return [x, y];
        }
        return null;
    };

    const spawnParticles = (dt: number) => {
        if (reducedMotion || particles.length >= MAX_PARTICLES) return;
        const active = progress > 0.02 && progress < BURN_PROGRESS_END - 0.05;
        if (!active) return;
        if (Math.random() < dt * 30) {
            const point = findPoint(0, 0.05);
            if (point) {
                particles.push({
                    kind: 'ember',
                    x: originX + point[0],
                    y: originY + point[1],
                    vx: (Math.random() - 0.5) * 30,
                    vy: -(50 + Math.random() * 90),
                    age: 0,
                    life: 0.5 + Math.random() * 1.1,
                    size: 0.9 + Math.random() * 1.2,
                    angle: 0,
                    spin: 0,
                    flip: 0,
                    flipSpeed: 0,
                    shade: 0.9 + Math.random() * 0.25,
                    seed: Math.random(),
                });
            }
        }
        if (Math.random() < dt * 16) {
            const point = findPoint(HOLE_BASE - 0.01, HOLE_BASE + HOLE_VARIATION + 0.02);
            if (point) {
                particles.push({
                    kind: 'ash',
                    x: originX + point[0],
                    y: originY + point[1],
                    vx: (Math.random() - 0.5) * 40,
                    vy: -(25 + Math.random() * 60),
                    age: 0,
                    life: 2.4 + Math.random() * 1.8,
                    size: 2.5 + Math.random() * 6,
                    angle: Math.random() * Math.PI * 2,
                    spin: (Math.random() - 0.5) * 5,
                    flip: Math.random() * Math.PI * 2,
                    flipSpeed: 2 + Math.random() * 5,
                    shade: 0.06 + Math.random() * 0.16,
                    seed: Math.random(),
                });
            }
        }
    };

    const updateParticles = (dt: number, t: number) => {
        for (let i = particles.length - 1; i >= 0; i -= 1) {
            const p = particles[i]!;
            p.age += dt;
            if (p.age >= p.life) {
                particles.splice(i, 1);
                continue;
            }
            const sway = Math.sin(t * 2.3 + p.seed * 40) * 18 + Math.sin(t * 5.1 + p.seed * 17) * 8;
            if (p.kind === 'ember') {
                p.vy -= 60 * dt;
                p.vx += (sway - p.vx) * Math.min(dt * 2, 1);
            } else {
                // 灰は熱い空気で舞い上がった後、冷えるにつれて揺れながらゆっくり落ちる。
                const buoyancy = -55 * Math.exp(-p.age / 0.9);
                p.vy += (buoyancy + 22 - p.vy * 0.9) * dt;
                p.vx += (sway * 1.4 - p.vx) * Math.min(dt * 1.2, 1);
                p.angle += p.spin * dt;
                p.flip += p.flipSpeed * dt;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
        }
    };

    const writeParticleVertices = (t: number): number => {
        let offset = 0;
        for (const p of particles) {
            const lifeLeft = 1 - p.age / p.life;
            let r: number;
            let g: number;
            let b: number;
            let fade = 1;
            let halfU: [number, number];
            let halfV: [number, number];
            // 0は火の粉、1以上は灰(小数部は灰の形の種)。
            let kind: number;
            if (p.kind === 'ember') {
                const temp = Math.min(lifeLeft * 1.3, 1.05);
                const twinkle = 0.6 + 0.4 * Math.abs(Math.sin(t * 14 + p.seed * 30));
                [r, g, b] = emberColor(temp, twinkle * p.shade);
                const radius = p.size * 2.4;
                halfU = [radius, 0];
                halfV = [0, radius];
                kind = 0;
            } else {
                fade = Math.min(lifeLeft * 2.5, 1) * Math.min(p.age / 0.15, 1);
                // 剥がれたばかりの灰は縁がまだ赤く光っている。
                const rim = Math.exp(-p.age / 0.35);
                r = p.shade + rim * 0.75;
                g = p.shade * 0.95 + rim * 0.25;
                b = p.shade * 0.9 + rim * 0.04;
                // くるくると裏返りながら舞うので、片方向の幅を回転に合わせて縮める。
                const squash = Math.max(Math.abs(Math.cos(p.flip)), 0.15);
                const cos = Math.cos(p.angle);
                const sin = Math.sin(p.angle);
                halfU = [cos * p.size * squash, sin * p.size * squash];
                halfV = [-sin * p.size, cos * p.size];
                kind = 1 + p.seed * 0.99;
            }
            const corners: [number, number][] = [
                [-1, -1],
                [1, -1],
                [-1, 1],
                [-1, 1],
                [1, -1],
                [1, 1],
            ];
            for (const [su, sv] of corners) {
                particleVertices[offset++] = p.x + halfU[0] * su + halfV[0] * sv;
                particleVertices[offset++] = p.y + halfU[1] * su + halfV[1] * sv;
                particleVertices[offset++] = su * 1.2;
                particleVertices[offset++] = sv * 1.2;
                particleVertices[offset++] = r;
                particleVertices[offset++] = g;
                particleVertices[offset++] = b;
                particleVertices[offset++] = fade;
                particleVertices[offset++] = kind;
            }
        }
        return offset / FLOATS_PER_PARTICLE_VERTEX;
    };

    const bindAttribute = (program: WebGLProgram, name: string, size: number, stride: number, offset: number) => {
        const location = gl.getAttribLocation(program, name);
        if (location < 0) return;
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
    };

    const disableAttributes = (program: WebGLProgram, names: string[]) => {
        for (const name of names) {
            const location = gl.getAttribLocation(program, name);
            if (location >= 0) gl.disableVertexAttribArray(location);
        }
    };

    const frame = (now: number) => {
        if (!alive) return;
        rafId = requestAnimationFrame(frame);
        const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
        lastTime = now;
        const seconds = now / 1000;
        const time = seconds % 1000;

        spawnParticles(dt);
        updateParticles(dt, seconds);
        updateMesh();

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        gl.useProgram(shadowProgram);
        gl.uniform2f(shadowUniforms.uCanvas, canvasWidth, canvasHeight);
        gl.uniform2f(shadowUniforms.uPaperOrigin, originX, originY);
        gl.uniform2f(shadowUniforms.uPaperSize, paperWidth, paperHeight);
        gl.uniform1f(shadowUniforms.uProgress, progress);
        bindTexture(gl, shadowUniforms.uArrival, arrivalTexture, 0);
        drawFullscreenQuad(gl, shadowProgram, quad);
        disableAttributes(shadowProgram, ['aPosition']);

        gl.useProgram(paperProgram);
        gl.uniform2f(paperUniforms.uCanvas, canvasWidth, canvasHeight);
        gl.uniform2f(paperUniforms.uPaperSize, paperWidth, paperHeight);
        gl.uniform1f(paperUniforms.uProgress, progress);
        gl.uniform1f(paperUniforms.uTime, time);
        gl.uniform1f(paperUniforms.uLight, fireLightLevel(1, fireFlicker(seconds)) * 0.35);
        bindTexture(gl, paperUniforms.uPaper, paperTexture, 0);
        bindTexture(gl, paperUniforms.uArrival, arrivalTexture, 1);
        gl.bindBuffer(gl.ARRAY_BUFFER, meshBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, meshVertices);
        bindAttribute(paperProgram, 'aPosition', 2, 20, 0);
        bindAttribute(paperProgram, 'aUv', 2, 20, 8);
        bindAttribute(paperProgram, 'aShade', 1, 20, 16);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, meshIndexBuffer);
        gl.drawElements(gl.TRIANGLES, meshIndices.length, gl.UNSIGNED_SHORT, 0);
        disableAttributes(paperProgram, ['aPosition', 'aUv', 'aShade']);

        gl.useProgram(flameProgram);
        gl.uniform2f(flameUniforms.uCanvas, canvasWidth, canvasHeight);
        gl.uniform2f(flameUniforms.uPaperOrigin, originX, originY);
        gl.uniform2f(flameUniforms.uPaperSize, paperWidth, paperHeight);
        gl.uniform2f(flameUniforms.uIgnition, ignitionX, ignitionY);
        gl.uniform1f(flameUniforms.uProgress, progress);
        gl.uniform1f(flameUniforms.uTime, time);
        gl.uniform1f(flameUniforms.uSmoke, reducedMotion ? 0 : 1);
        bindTexture(gl, flameUniforms.uArrival, arrivalTexture, 0);
        drawFullscreenQuad(gl, flameProgram, quad);
        disableAttributes(flameProgram, ['aPosition']);

        const particleVertexCount = writeParticleVertices(seconds);
        if (particleVertexCount > 0) {
            const stride = FLOATS_PER_PARTICLE_VERTEX * 4;
            gl.useProgram(particleProgram);
            gl.uniform2f(particleUniforms.uCanvas, canvasWidth, canvasHeight);
            gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
            gl.bufferSubData(
                gl.ARRAY_BUFFER,
                0,
                particleVertices.subarray(0, particleVertexCount * FLOATS_PER_PARTICLE_VERTEX),
            );
            bindAttribute(particleProgram, 'aPosition', 2, stride, 0);
            bindAttribute(particleProgram, 'aLocal', 2, stride, 8);
            bindAttribute(particleProgram, 'aColor', 4, stride, 16);
            bindAttribute(particleProgram, 'aKind', 1, stride, 32);
            gl.drawArrays(gl.TRIANGLES, 0, particleVertexCount);
            disableAttributes(particleProgram, ['aPosition', 'aLocal', 'aColor', 'aKind']);
        }
    };

    const onContextLost = (event: Event) => {
        event.preventDefault();
        alive = false;
        cancelAnimationFrame(rafId);
    };

    canvas.addEventListener('webglcontextlost', onContextLost);
    rafId = requestAnimationFrame(frame);

    return {
        setProgress(value: number) {
            progress = value;
        },
        kill() {
            alive = false;
            cancelAnimationFrame(rafId);
            canvas.removeEventListener('webglcontextlost', onContextLost);
            releaseContext(gl);
        },
    };
}
