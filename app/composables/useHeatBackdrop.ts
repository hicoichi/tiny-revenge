// 儀式の背景写真をWebGLで描き直し、炎の熱で空気が揺らぐ陽炎と、炎に照らされる地面・木々の照り返しを加える。
// 陽炎は「炎の向こうにあるもの」を歪ませる必要があるため、背景そのものを描く側で表現している。
import { approachPower, fireFlicker, fireLightLevel } from '~/composables/useFireLight';
import { flameHalfWidth, flameHeight } from '~/composables/useFlameRenderer';
import type { FlameAnchor } from '~/composables/useFlameRenderer';
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

export interface HeatBackdropOptions {
    src: string;
    getFlameAnchor: () => FlameAnchor | null;
    onReady: () => void;
}

export interface HeatBackdropController {
    setPower: (value: number) => void;
    kill: () => void;
}

// 背景写真は元画像の解像度が上限なので、高DPRで描いても精細にならない。描画負荷を抑えるため上限を低くする。
const MAX_DPR = 1.25;

const BACKDROP_FRAGMENT_SHADER = `
${FRAGMENT_PRECISION}
varying vec2 vUv;
uniform sampler2D uImage;
uniform vec2 uImageSize;
uniform vec2 uCanvas;
uniform vec2 uFire;
uniform float uFireHeight;
uniform float uFireHalfWidth;
uniform float uHaze;
uniform float uLight;
uniform float uTime;

${SIMPLEX_NOISE_GLSL}

// CSSの background-size: cover と同じ切り抜き。frag は左上原点のCSS px。
vec2 coverUv(vec2 frag) {
    float scale = max(uCanvas.x / uImageSize.x, uCanvas.y / uImageSize.y);
    vec2 drawn = uImageSize * scale;
    return (frag - (uCanvas - drawn) * 0.5) / drawn;
}

void main() {
    vec2 frag = vec2(vUv.x, 1.0 - vUv.y) * uCanvas;
    vec2 fromFire = frag - uFire;
    float above = -fromFire.y;

    // 陽炎: 炎の真上に立ち昇る熱気の柱。炎のすぐ上で最も強く、高くなるほど薄れる。
    float column = exp(-pow(fromFire.x / (uFireHalfWidth * 2.2), 2.0));
    float height = smoothstep(uFireHeight * 0.15, uFireHeight * 0.65, above)
        * (1.0 - smoothstep(uFireHeight * 1.3, uFireHeight * 3.2, above));
    float haze = column * height * uHaze;
    vec2 offset = vec2(0.0);
    if (haze > 0.002) {
        // 縦に引き伸ばした細かい揺らぎを上へ流す(熱で膨らんだ空気が立ち昇る見え方)。
        vec3 q = vec3(frag.x / 24.0, frag.y / 36.0 + uTime * 2.6, uTime * 0.7);
        offset = vec2(snoise(q), snoise(q + vec3(17.0, 3.0, 5.0)) * 0.6) * haze;
    }
    vec3 color = texture2D(uImage, coverUv(frag + offset)).rgb;

    // 照り返し: 炎の中ほどを光源とし、距離に応じて弱まる暖色の光。
    // 地面は奥行き方向に潰れて見えるため、炎より下は縦方向に距離を詰めて横長に広げる。
    vec2 toLight = fromFire + vec2(0.0, uFireHeight * 0.35);
    toLight.y *= toLight.y > 0.0 ? 1.8 : 1.0;
    float lightDistance = length(toLight) / (uFireHeight * 1.3 + 40.0);
    float falloff = 1.0 / (1.0 + lightDistance * lightDistance * 3.0);
    vec3 warm = vec3(1.0, 0.52, 0.2);
    color += color * warm * falloff * uLight * 1.6 + warm * falloff * uLight * 0.05;

    gl_FragColor = vec4(color, 1.0);
}
`;

export function useHeatBackdrop(canvas: HTMLCanvasElement, options: HeatBackdropOptions): HeatBackdropController | null {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false });
    if (!gl) return null;

    const program = createProgram(gl, FULLSCREEN_VERTEX_SHADER, BACKDROP_FRAGMENT_SHADER);
    const quad = createFullscreenQuad(gl);
    const texture = createTexture(gl);
    if (!program || !quad || !texture) {
        releaseContext(gl);
        return null;
    }
    const uniforms = getUniforms(gl, program, [
        'uImage',
        'uImageSize',
        'uCanvas',
        'uFire',
        'uFireHeight',
        'uFireHalfWidth',
        'uHaze',
        'uLight',
        'uTime',
    ] as const);

    const reducedMotion = prefersReducedMotion();
    let alive = true;
    let rafId = 0;
    let lastTime = 0;
    let frameCount = 0;
    let power = 0;
    let targetPower = 0;
    let hasPower = false;
    let imageWidth = 0;
    let imageHeight = 0;
    let canvasRect = canvas.getBoundingClientRect();

    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
        if (!alive) return;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        imageWidth = image.naturalWidth;
        imageHeight = image.naturalHeight;
        rafId = requestAnimationFrame(frame);
    };
    image.src = options.src;

    const syncSize = () => {
        canvasRect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        const width = Math.max(1, Math.round(canvasRect.width * dpr));
        const height = Math.max(1, Math.round(canvasRect.height * dpr));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
    };

    const frame = (now: number) => {
        if (!alive) return;
        rafId = requestAnimationFrame(frame);
        if (frameCount % 30 === 0) syncSize();
        frameCount += 1;

        const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
        lastTime = now;
        const seconds = now / 1000;
        power = approachPower(power, targetPower, dt);

        // 炎が見つからない間は、炎のない背景として描く。
        const anchor = options.getFlameAnchor();
        const scale = anchor?.scale ?? 1;

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(program);
        bindTexture(gl, uniforms.uImage, texture, 0);
        gl.uniform2f(uniforms.uImageSize, imageWidth, imageHeight);
        gl.uniform2f(uniforms.uCanvas, canvasRect.width, canvasRect.height);
        gl.uniform2f(
            uniforms.uFire,
            anchor ? anchor.x - canvasRect.left : canvasRect.width / 2,
            anchor ? anchor.y - canvasRect.top : canvasRect.height * 2,
        );
        gl.uniform1f(uniforms.uFireHeight, flameHeight(power) * scale);
        gl.uniform1f(uniforms.uFireHalfWidth, flameHalfWidth(power) * scale);
        gl.uniform1f(uniforms.uHaze, anchor && !reducedMotion ? 1.2 + 4.5 * power : 0);
        gl.uniform1f(uniforms.uLight, anchor ? fireLightLevel(power, fireFlicker(seconds)) : 0);
        gl.uniform1f(uniforms.uTime, seconds % 1000);
        drawFullscreenQuad(gl, program, quad);

        if (frameCount === 1) options.onReady();
    };

    const onContextLost = (event: Event) => {
        event.preventDefault();
        alive = false;
        cancelAnimationFrame(rafId);
    };

    canvas.addEventListener('webglcontextlost', onContextLost);

    return {
        setPower(value: number) {
            if (!hasPower) {
                hasPower = true;
                power = value;
            }
            targetPower = value;
        },
        kill() {
            alive = false;
            cancelAnimationFrame(rafId);
            canvas.removeEventListener('webglcontextlost', onContextLost);
            releaseContext(gl);
        },
    };
}
